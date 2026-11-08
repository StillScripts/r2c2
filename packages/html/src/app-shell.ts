import type { Element } from "domhandler"
import { textContent } from "domutils"
import { type Issue, issueAt } from "./issues"
import { elements, locator, parse, serialise } from "./parse"

export type AppShell =
  | { ok: true; html: string }
  | { ok: false; errors: Issue[] }

export type AppShellOptions = {
  /** Where the build's files are served, e.g. `/_build/<buildId>/` */
  base: string
  /** Every path in the build, such as `assets/index-AbC.js` */
  files: ReadonlySet<string>
}

// Attributes that load something; links (`<a>`, `<area>`) only navigate
const URL_ATTRIBUTES = ["src", "href", "poster", "data", "action", "formaction"]
const SRCSET_ATTRIBUTES = ["srcset", "imagesrcset"]
const LINK_TAGS = new Set(["a", "area"])

const SCHEME = /^[a-z][a-z0-9+.-]*:/i

type Rewrite = { url: string } | { rule: string; message: string }

function rewriteUrl(url: string, { base, files }: AppShellOptions): Rewrite {
  const trimmed = url.trim()
  if (!trimmed || trimmed.startsWith("#") || /^data:/i.test(trimmed)) {
    return { url }
  }
  if (SCHEME.test(trimmed) || trimmed.startsWith("//")) {
    return {
      rule: "third-party-url",
      message: `${trimmed} isn't in the build. Apps load every file from their own build.`,
    }
  }
  if (trimmed.startsWith("/")) {
    return {
      rule: "absolute-url",
      message: `${trimmed} is an absolute path. Build with a relative base (Vite: base: "./") so it loads from the build.`,
    }
  }
  const [, path = "", rest = ""] = /^([^?#]*)(.*)$/.exec(trimmed) ?? []
  const resolved = new URL(path, "https://build/").pathname.slice(1)
  if (!files.has(resolved)) {
    return {
      rule: "missing-file",
      message: `${trimmed} isn't a file in the build.`,
    }
  }
  return { url: `${base}${resolved}${rest}` }
}

/**
 * Check an app build's `index.html` against the app shell rules (no inline scripts,
 * styles, handlers or `style` attributes, nothing from another origin) and point its
 * relative URLs at the build's files under `base` (ADR-020).
 */
export function buildAppShell(
  html: string,
  options: AppShellOptions
): AppShell {
  const doc = parse(html)
  const locate = locator(html)
  const errors: Issue[] = []
  const at = (element: Element, rule: string, message: string) =>
    errors.push(issueAt(locate, element, rule, message))

  // The URL to write back: rewritten into the build, or as it was when it's refused
  const rewrite = (element: Element, url: string) => {
    const result = rewriteUrl(url, options)
    if ("url" in result) return result.url
    at(element, result.rule, result.message)
    return url
  }

  for (const element of elements(doc)) {
    const { name: tag, attribs } = element
    if (tag === "script" && (!attribs.src || textContent(element).trim())) {
      at(
        element,
        "inline-script",
        "Scripts must load from a file in the build."
      )
    }
    if (tag === "style") {
      at(
        element,
        "inline-style",
        "Styles must load from a CSS file in the build."
      )
    }
    if (tag === "base") {
      at(
        element,
        "no-base",
        "<base> isn't allowed; URLs are relative to the build."
      )
    }
    for (const [name, value] of Object.entries(attribs)) {
      if (name.startsWith("on")) {
        at(
          element,
          "inline-handler",
          `${name} isn't allowed. Attach handlers in a script file.`
        )
      } else if (name === "style") {
        at(
          element,
          "style-attribute",
          "style attributes aren't allowed. Use a CSS file."
        )
      } else if (URL_ATTRIBUTES.includes(name) && !LINK_TAGS.has(tag)) {
        attribs[name] = rewrite(element, value)
      } else if (SRCSET_ATTRIBUTES.includes(name)) {
        attribs[name] = value
          .split(",")
          .map((candidate) => {
            const [url = "", ...descriptor] = candidate.trim().split(/\s+/)
            return [rewrite(element, url), ...descriptor].join(" ")
          })
          .join(", ")
      }
    }
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, html: serialise(doc) }
}
