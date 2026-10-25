import { HtmlValidate } from "html-validate"
import type { Issue } from "./issues"

const validator = new HtmlValidate({
  root: true,
  elements: [
    "html5",
    {
      "site-form": { flow: true, transparent: true },
    },
  ],
  rules: {
    "heading-level": ["error", { allowMultipleH1: false }],
    "empty-heading": "error",
    "input-missing-label": "error",
    "wcag/h30": "error",
  },
})

export async function validateStructure(html: string): Promise<Issue[]> {
  const report = await validator.validateString(html)
  return report.results.flatMap((result) =>
    result.messages.map(({ line, column, ruleId, message }) => ({
      line,
      column,
      rule: ruleId,
      message: `${message}.`,
    }))
  )
}
