import sanitizeHtml from "sanitize-html"
import {
  ALLOWED_SCHEMES,
  ALLOWED_TAGS,
  attributeProblem,
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
  transformTags: {
    "*": (tagName, attribs) => ({
      tagName,
      attribs: Object.fromEntries(
        Object.entries(attribs).filter(
          ([name, value]) => !attributeProblem(tagName, name, value)
        )
      ),
    }),
  },
}

const structure = (html: string) =>
  JSON.stringify(
    elements(parse(html)).map((element) => [
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
  if (structure(clean) !== structure(html))
    throw new SanitiserChangedPageError()
  return clean
}
