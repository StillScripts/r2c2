/** A same-origin path to return to after sign-in, or `/` for anything else. */
export function safeRedirect(target: unknown) {
  if (typeof target !== "string") return "/"
  return /^\/(?![/\\])/.test(target) ? target : "/"
}
