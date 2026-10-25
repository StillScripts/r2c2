import type { Document, Element } from "domhandler"
import { type Issue, issueAt, type Locate } from "./issues"
import { elements, locator, parse } from "./parse"

export type FormField = {
  name: string
  type: string
  required: boolean
  maxLength?: number
}

export type FormDefinition = { name: string; fields: FormField[] }

const IGNORED_INPUTS = new Set(["submit", "reset", "button", "image", "hidden"])

function toField(element: Element): Omit<FormField, "name"> | null {
  if (!["input", "textarea", "select"].includes(element.name)) return null
  const type =
    element.name === "input" ? (element.attribs.type ?? "text") : element.name
  if (IGNORED_INPUTS.has(type)) return null
  const maxLength = Number(element.attribs.maxlength)
  return {
    type,
    required: "required" in element.attribs,
    ...(Number.isInteger(maxLength) && { maxLength }),
  }
}

export function formsIn(doc: Document, locate: Locate) {
  const forms: FormDefinition[] = []
  const errors: Issue[] = []
  const error = (element: Element, message: string) =>
    errors.push(issueAt(locate, element, "site-form", message))

  for (const form of elements(doc)) {
    if (form.name !== "site-form") continue
    const name = form.attribs.name?.trim()
    const duplicate = forms.some((f) => f.name === name)
    if (!name) error(form, "<site-form> needs a name attribute.")
    else if (duplicate) {
      error(form, `There's already a form named "${name}" on this page.`)
    }

    const fields: FormField[] = []
    for (const element of elements(form)) {
      const field = toField(element)
      if (!field) continue
      const fieldName = element.attribs.name?.trim()
      if (!fieldName) error(element, "Fields in a form need a name attribute.")
      else if (fields.some((f) => f.name === fieldName)) {
        error(element, `The form already has a field named "${fieldName}".`)
      } else fields.push({ name: fieldName, ...field })
    }
    if (name && !duplicate) forms.push({ name, fields })
  }
  return { forms, errors }
}

export const extractForms = (html: string) =>
  formsIn(parse(html), locator(html))
