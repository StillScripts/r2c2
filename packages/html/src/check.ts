import { MAX_PAGE_BYTES, pageBytes } from "@workspace/core"
import type { Element } from "domhandler"
import { textContent } from "domutils"
import { ALLOWED_TAGS, attributeProblem } from "./allowlist"
import { formsIn } from "./forms"
import { type Issue, issueAt } from "./issues"
import { byTag, classTokens, elements, locator, parse } from "./parse"
import type { Theme } from "./theme"
import { validateStructure } from "./validator"

export const UTILITY_WARNING_THRESHOLD = 8

const GENERIC_LINK_TEXT = new Set(["click here", "here", "read more", "link"])

const pageIssue = (rule: string, message: string): Issue => ({
  line: 1,
  column: 1,
  rule,
  message,
})

const hasOneNonEmpty = (values: (string | undefined)[]) =>
  values.length === 1 && !!values[0]?.trim()

export async function checkPage(html: string, theme: Theme) {
  if (pageBytes(html) > MAX_PAGE_BYTES) {
    const message = `The page is over ${MAX_PAGE_BYTES / 1024} KB.`
    return {
      errors: [pageIssue("page-size", message)],
      warnings: [],
      forms: [],
    }
  }

  const doc = parse(html)
  const locate = locator(html)
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const at = (element: Element, rule: string, message: string) =>
    errors.push(issueAt(locate, element, rule, message))

  const titles: string[] = []
  const descriptions: (string | undefined)[] = []
  const classes: { element: Element; token: string }[] = []

  for (const element of elements(doc)) {
    const { name: tag, attribs } = element
    if (!ALLOWED_TAGS.includes(tag)) {
      at(element, "allowed-tags", `<${tag}> isn't allowed.`)
      continue
    }
    for (const [name, value] of Object.entries(attribs)) {
      const problem = attributeProblem(tag, name, value)
      if (problem) at(element, problem.rule, problem.message)
    }

    if (tag === "title") titles.push(textContent(element))
    if (tag === "meta" && attribs.name === "description") {
      descriptions.push(attribs.content)
    }
    if (tag === "img" && !attribs.alt?.trim()) {
      at(element, "img-alt", "Images need alt text describing them.")
    }
    if (
      tag === "a" &&
      GENERIC_LINK_TEXT.has(textContent(element).trim().toLowerCase())
    ) {
      at(element, "link-text", "Link text should say where the link goes.")
    }

    const tokens = classTokens(element)
    for (const token of tokens) {
      if (token.includes("url(")) {
        at(
          element,
          "no-url",
          `${token} isn't allowed. Images come from the site's media.`
        )
      } else classes.push({ element, token })
    }
    if (
      tokens.length > UTILITY_WARNING_THRESHOLD &&
      !tokens.some((token) => theme.components.has(token))
    ) {
      warnings.push(
        issueAt(
          locate,
          element,
          "prefer-components",
          `${tokens.length} utility classes. Consider a component class like ${[...theme.components].join(", ")}.`
        )
      )
    }
  }

  const invalid = new Set(
    theme.invalidClasses([...new Set(classes.map((c) => c.token))])
  )
  // A class the theme can't compile makes no CSS, so it can't break the page
  for (const { element, token } of classes) {
    if (invalid.has(token)) {
      warnings.push(
        issueAt(
          locate,
          element,
          "unknown-class",
          `${token} doesn't match anything in this site's theme, so it has no effect.`
        )
      )
    }
  }

  // Publish adds the canonical URL, CSS and script to the head, so it must exist
  if (byTag("head", doc).length === 0) {
    errors.push(
      pageIssue(
        "page-head",
        "The page needs a <head> for its <title> and description."
      )
    )
  }
  if (!hasOneNonEmpty(titles)) {
    errors.push(
      pageIssue("page-title", "The page needs one non-empty <title>.")
    )
  }
  if (!hasOneNonEmpty(descriptions)) {
    errors.push(
      pageIssue(
        "page-description",
        'The page needs one non-empty <meta name="description">.'
      )
    )
  }

  const { forms, errors: formErrors } = formsIn(doc, locate)
  errors.push(...formErrors, ...(await validateStructure(html)))
  const byPosition = (a: Issue, b: Issue) =>
    a.line - b.line || a.column - b.column
  errors.sort(byPosition)
  warnings.sort(byPosition)
  return { errors, warnings, forms }
}
