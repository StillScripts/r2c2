import { ConvexError } from "convex/values"

/** Every `data.code` a public function can fail with, for the Loft to switch on. */
export type ErrorCode =
  | "unauthenticated"
  | "not_found"
  | "forbidden"
  | "invalid_hostname"
  | "hostname_taken"
  | "primary_exists"
  | "primary_has_redirects"
  | "invalid_path"
  | "path_taken"
  | "page_too_large"
  | "form_conflict"

/** A ConvexError the Loft can switch on, with optional details such as `{ form }`. */
export const fail = (code: ErrorCode, details?: Record<string, string>) =>
  new ConvexError({ code, ...details })
