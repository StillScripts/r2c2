import type { ErrorCode, ErrorDetails } from "@workspace/backend/errors"
import { MAX_PAGE_BYTES } from "@workspace/core"
import { ConvexError } from "convex/values"

type Messages = {
  [C in ErrorCode]?: C extends keyof ErrorDetails
    ? (details: ErrorDetails[C]) => string
    : string
}

const MESSAGES: Messages = {
  invalid_path:
    "Use / or lowercase words joined by hyphens, like /about or /services/cleaning.",
  path_taken: "This site already has a page at that path.",
  page_too_large: `The page is over ${MAX_PAGE_BYTES / 1024} KB.`,
  form_conflict: ({ form }) =>
    `Another live page has a form named "${form}" with different fields. Make them match, or rename one.`,
}

/** A readable message for an error from a Convex function. */
export function errorMessage(error: unknown) {
  const data =
    error instanceof ConvexError
      ? (error.data as { code?: ErrorCode })
      : undefined
  const message = data?.code && MESSAGES[data.code]
  // `fail` gives each code its own details, so the data fits the code's message
  if (typeof message === "function") return message(data as never)
  return message ?? "Something went wrong. Please try again."
}
