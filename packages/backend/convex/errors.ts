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

export const fail = (code: ErrorCode) => new ConvexError({ code })
