import type { Element } from "domhandler"
import { textContent } from "domutils"
import {
  ALLOWED_SCHEMES,
  ALLOWED_TAGS,
  isAllowedAttribute,
  MEDIA_PREFIX,
  META_NAMES,
  REQUEST_ATTRIBUTES,
  URL_ATTRIBUTES,
} from "./allowlist"
import { formsIn } from "./forms"
import { type Issue, issueAt } from "./issues"
import { classTokens, elements, locator, parse } from "./parse"
import type { Theme } from "./theme"
import { validateStructure } from "./validator"

export const MAX_PAGE_BYTES = 500 * 1024
export const UTILITY_WARNING_THRESHOLD = 8

const GENERIC_LINK_TEXT = new Set(["click here", "here", "read more", "link"])

const scheme = (url: string) =>
  url
    .replace(/[\s\p{Cc}]/gu, "")
    .toLowerCase()
    .match(/^([a-z][a-z0-9+.-]*):/)?.[1]

const urls = (name: string, value: string) =>
  name === "srcset"
    ? value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]!)
    : [value]

export async function checkPage(html: string, theme: Theme) {
  const doc = parse(html)
  const locate = locator(html)
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const at = (element: Element, rule: string, message: string) =>
    errors.push(issueAt(locate, element, rule, message))

  if (new TextEncoder().encode(html).length > MAX_PAGE_BYTES) {
    errors.push({
      line: 1,
      column: 1,
      rule: "page-size",
      message: `The page is over ${MAX_PAGE_BYTES / 1024} KB.`,
    })
  }

  const classes: { element: Element; token: string }[] = []
  for (const element of elements(doc)) {
    const tag = element.name
    if (!ALLOWED_TAGS.includes(tag)) {
      at(element, "allowed-tags", `<${tag}> isn't allowed.`)
      continue
    }

    for (const [name, value] of Object.entries(element.attribs)) {
      if (name.startsWith("on")) {
        at(
          element,
          "no-inline-handlers",
          `Inline handlers like ${name} aren't allowed.`
        )
      } else if (name === "style") {
        at(
          element,
          "no-style",
          "style attributes aren't allowed. Use theme classes."
        )
      } else if (!isAllowedAttribute(tag, name)) {
        at(element, "allowed-attributes", `${name} isn't allowed on <${tag}>.`)
      } else if (URL_ATTRIBUTES.includes(name)) {
        for (const url of urls(name, value)) {
          const protocol = scheme(url)
          if (protocol && !ALLOWED_SCHEMES.includes(protocol)) {
            at(element, "allowed-urls", `${protocol}: URLs aren't allowed.`)
          } else if (
            REQUEST_ATTRIBUTES.includes(name) &&
            !url.startsWith(MEDIA_PREFIX)
          ) {
            at(
              element,
              "site-media",
              `${url} isn't site media. Upload it and use its ${MEDIA_PREFIX} path.`
            )
          } else if (name === "action" && (protocol || url.startsWith("//"))) {
            at(element, "allowed-urls", "Forms can only post to this site.")
          }
        }
      }
    }

    if (tag === "img" && !element.attribs.alt?.trim()) {
      at(element, "img-alt", "Images need alt text describing them.")
    }
    if (tag === "meta" && !("charset" in element.attribs)) {
      if (!META_NAMES.includes(element.attribs.name ?? "")) {
        at(
          element,
          "allowed-meta",
          `Only ${META_NAMES.join(" and ")} meta tags are allowed.`
        )
      }
    }
    if (
      tag === "a" &&
      GENERIC_LINK_TEXT.has(textContent(element).trim().toLowerCase())
    ) {
      at(element, "link-text", "Link text should say where the link goes.")
    }

    const tokens = classTokens(element)
    for (const token of tokens) {
      if (/[[(]/.test(token)) {
        at(
          element,
          "theme-only",
          `${token} isn't allowed. Use theme tokens${theme.colours.length ? ` (colours: ${theme.colours.join(", ")})` : ""}.`
        )
      } else classes.push({ element, token })
    }
    const utilities = tokens.filter((token) => !theme.components.has(token))
    if (
      utilities.length > UTILITY_WARNING_THRESHOLD &&
      utilities.length === tokens.length
    ) {
      warnings.push(
        issueAt(
          locate,
          element,
          "prefer-components",
          `${utilities.length} utility classes. Consider a component class like ${[...theme.components].join(", ")}.`
        )
      )
    }
  }

  const invalid = new Set(
    theme.invalidClasses([...new Set(classes.map((c) => c.token))])
  )
  for (const { element, token } of classes) {
    if (invalid.has(token))
      at(element, "theme-only", `${token} isn't a theme class.`)
  }

  const all = [...elements(doc)]
  const titles = all.filter((element) => element.name === "title")
  if (titles.length !== 1 || !textContent(titles[0]!).trim()) {
    errors.push({
      line: 1,
      column: 1,
      rule: "page-title",
      message: "The page needs one non-empty <title>.",
    })
  }
  const descriptions = all.filter(
    (element) =>
      element.name === "meta" && element.attribs.name === "description"
  )
  if (descriptions.length !== 1 || !descriptions[0]!.attribs.content?.trim()) {
    errors.push({
      line: 1,
      column: 1,
      rule: "page-description",
      message: 'The page needs one non-empty <meta name="description">.',
    })
  }

  errors.push(
    ...formsIn(doc, locate).errors,
    ...(await validateStructure(html))
  )
  errors.sort((a, b) => a.line - b.line || a.column - b.column)
  return { errors, warnings }
}
