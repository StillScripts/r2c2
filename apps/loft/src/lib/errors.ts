import { ConvexError } from "convex/values"

const MESSAGES: Record<string, string> = {
  invalid_path:
    "Use / or lowercase words joined by hyphens, like /about or /services/cleaning.",
  path_taken: "This site already has a page at that path.",
  page_too_large: "The page is over 500 KB.",
}

/** A readable message for an error from a Convex function. */
export function errorMessage(error: unknown) {
  const code =
    error instanceof ConvexError
      ? (error.data as { code?: string }).code
      : undefined
  return (code && MESSAGES[code]) ?? "Something went wrong. Please try again."
}
