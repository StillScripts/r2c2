import sanitizeHtml from "sanitize-html"
import {
  ALLOWED_SCHEMES,
  ALLOWED_TAGS,
  GLOBAL_ATTRIBUTES,
  TAG_ATTRIBUTES,
  URL_ATTRIBUTES,
} from "./allowlist"
import { elements, parse } from "./parse"

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { "*": GLOBAL_ATTRIBUTES, ...TAG_ATTRIBUTES },
  allowedSchemes: ALLOWED_SCHEMES,
  allowedSchemesAppliedToAttributes: URL_ATTRIBUTES,
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
}

const structure = (html: string) =>
  [...elements(parse(html))].map((element) =>
    JSON.stringify([
      element.name,
      Object.entries(element.attribs).sort(([a], [b]) => a.localeCompare(b)),
    ])
  )

export class SanitiserChangedPageError extends Error {
  constructor() {
    super("The sanitiser changed a page that passed the house rules.")
  }
}

export function sanitise(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS)
  const [before, after] = [structure(html), structure(clean)]
  if (before.length !== after.length || before.some((e, i) => e !== after[i])) {
    throw new SanitiserChangedPageError()
  }
  return clean
}
