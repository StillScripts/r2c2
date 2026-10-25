import type { ErrorCode } from "@workspace/backend/errors"
import { MAX_PAGE_BYTES } from "@workspace/core"
import { ConvexError } from "convex/values"

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  invalid_path:
    "Use / or lowercase words joined by hyphens, like /about or /services/cleaning.",
  path_taken: "This site already has a page at that path.",
  page_too_large: `The page is over ${MAX_PAGE_BYTES / 1024} KB.`,
}

/** A readable message for an error from a Convex function. */
export function errorMessage(error: unknown) {
  const code =
    error instanceof ConvexError
      ? (error.data as { code?: ErrorCode }).code
      : undefined
  return (code && MESSAGES[code]) ?? "Something went wrong. Please try again."
}
