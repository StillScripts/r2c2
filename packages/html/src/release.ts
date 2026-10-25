import { hashContent } from "@workspace/core"
import { type Document, Element, ProcessingInstruction } from "domhandler"
import { appendChild, prependChild, removeElement } from "domutils"
import { PLATFORM_TAGS } from "./allowlist"
import { checkPage } from "./check"
import { compileCss } from "./css"
import { extractForms, type FormDefinition } from "./forms"
import { assignElementIds } from "./ids"
import { type Issue, issueAt } from "./issues"
import { byTag, locator, parse, serialise } from "./parse"
import { sanitise } from "./sanitise"
import type { Theme } from "./theme"

/** The field name of the hidden honeypot publish adds to every form (T21 checks it). */
export const HONEYPOT_FIELD = "website"

export type ReleaseOptions = {
  theme: Theme
  /** `https://<primary host><path>`, or undefined when the site has no primary domain */
  canonicalUrl?: string
  /** The Turnstile site key, required when the page has a `<site-form>` */
  sitekey?: string
  /** Where the page loads the shared elements script from, e.g. `/_elements/<hash>.js` */
  elementsUrl: string
  /** Where the page loads its CSS from, given the CSS hash */
  cssUrl: (cssHash: string) => string
}

export type Release =
  | { ok: false; errors: Issue[]; warnings: Issue[] }
  | {
      ok: true
      draftWithIds: string
      html: string
      hash: string
      css: string
      cssHash: string
      forms: FormDefinition[]
      warnings: Issue[]
    }

const element = (name: string, attribs: Record<string, string>) =>
  new Element(name, attribs)

function formIssues(html: string, sitekey: string | undefined) {
  const locate = locator(html)
  const issues: Issue[] = []
  for (const form of byTag("site-form", parse(html))) {
    if (!sitekey) {
      issues.push(
        issueAt(
          locate,
          form,
          "sitekey",
          "Forms can't be published yet: the site has no Turnstile site key."
        )
      )
    }
    for (const field of byTag("input", form).concat(
      byTag("textarea", form),
      byTag("select", form)
    )) {
      if (field.attribs.name === HONEYPOT_FIELD) {
        issues.push(
          issueAt(
            locate,
            field,
            "honeypot",
            `"${HONEYPOT_FIELD}" is reserved; give this field another name.`
          )
        )
      }
    }
  }
  return issues
}

/** Add the doctype, canonical URL, CSS link, elements script, sitekeys and honeypots. */
function assemble(doc: Document, options: ReleaseOptions, cssHash: string) {
  doc.children
    .filter((node) => node instanceof ProcessingInstruction)
    .forEach(removeElement)
  const head = byTag("head", doc)[0]!
  if (options.canonicalUrl) {
    appendChild(
      head,
      element("link", { rel: "canonical", href: options.canonicalUrl })
    )
  }
  appendChild(
    head,
    element("link", { rel: "stylesheet", href: options.cssUrl(cssHash) })
  )
  if (PLATFORM_TAGS.some((tag) => byTag(tag, doc).length > 0)) {
    appendChild(
      head,
      element("script", { type: "module", src: options.elementsUrl })
    )
  }
  return `<!doctype html>\n${serialise(doc).trimStart()}`
}

function addFormExtras(doc: Document, sitekey: string) {
  for (const siteForm of byTag("site-form", doc)) {
    siteForm.attribs.sitekey = sitekey
    for (const form of byTag("form", siteForm)) {
      prependChild(
        form,
        element("input", {
          name: HONEYPOT_FIELD,
          class: "sr-only",
          tabindex: "-1",
          autocomplete: "off",
          "aria-hidden": "true",
        })
      )
    }
  }
}

/**
 * Turn a draft into the finished page publish writes to R2, or the house-rule errors
 * that stop it. Has no side effects, so the same draft and options give the same hash.
 */
export async function buildRelease(
  draft: string,
  options: ReleaseOptions
): Promise<Release> {
  const draftWithIds = assignElementIds(draft)
  const check = await checkPage(draftWithIds, options.theme)
  const errors = [...check.errors, ...formIssues(draftWithIds, options.sitekey)]
  if (errors.length > 0) return { ok: false, errors, warnings: check.warnings }

  const clean = sanitise(draftWithIds)
  const { forms } = extractForms(clean)
  const doc = parse(clean)
  if (options.sitekey) addFormExtras(doc, options.sitekey)
  const body = serialise(doc)
  const { css, hash: cssHash } = await compileCss(body, options.theme)
  const html = assemble(parse(body), options, cssHash)

  return {
    ok: true,
    draftWithIds,
    html,
    hash: await hashContent(html),
    css,
    cssHash,
    forms,
    warnings: check.warnings,
  }
}
