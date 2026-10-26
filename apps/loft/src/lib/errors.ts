import type { ErrorCode } from "@workspace/backend/errors"
import { MAX_PAGE_BYTES } from "@workspace/core"
import { ConvexError } from "convex/values"

type Details = Partial<Record<string, string>>

const MESSAGES: Partial<
  Record<ErrorCode, string | ((details: Details) => string)>
> = {
  invalid_path:
    "Use / or lowercase words joined by hyphens, like /about or /services/cleaning.",
  path_taken: "This site already has a page at that path.",
  page_too_large: `The page is over ${MAX_PAGE_BYTES / 1024} KB.`,
  form_conflict: ({ form }) =>
    `Another live page has a form named "${form}" with different fields. Make them match, or rename one.`,
}

/** A readable message for an error from a Convex function. */
export function errorMessage(error: unknown) {
  const { code, ...details } =
    error instanceof ConvexError
      ? (error.data as { code?: ErrorCode } & Details)
      : {}
  const message = code && MESSAGES[code]
  if (typeof message === "function") return message(details)
  return message ?? "Something went wrong. Please try again."
}
