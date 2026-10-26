import { ConvexError } from "convex/values"

/** Every `data.code` a public function can fail with, for the Loft to switch on. */
export type ErrorCode =
  | "unauthenticated"
  | "not_found"
  | "forbidden"
  | "invalid_hostname"
  | "reserved_hostname"
  | "hostname_taken"
  | "primary_exists"
  | "site_address"
  | "invalid_path"
  | "path_taken"
  | "page_too_large"
  | "form_conflict"

/** The details a code carries alongside it, for the Loft's messages. */
export type ErrorDetails = {
  form_conflict: { form: string }
}

type DetailsArg<C extends ErrorCode> = C extends keyof ErrorDetails
  ? [details: ErrorDetails[C]]
  : []

/** A ConvexError the Loft can switch on, with the code's details such as `{ form }`. */
export const fail = <C extends ErrorCode>(
  code: C,
  ...[details]: DetailsArg<C>
) => new ConvexError({ code, ...details })
