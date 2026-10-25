import type { Element } from "domhandler"
import type { locator } from "./parse"

export type Issue = {
  line: number
  column: number
  rule: string
  message: string
}

export type Locate = ReturnType<typeof locator>

export const issueAt = (
  locate: Locate,
  element: Element,
  rule: string,
  message: string
): Issue => ({ ...locate(element.startIndex ?? 0), rule, message })

export const formatIssue = (issue: Issue) =>
  `Line ${issue.line}: ${issue.message}`
