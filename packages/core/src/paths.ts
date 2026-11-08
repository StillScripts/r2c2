export const normaliseHost = (url: URL) => url.hostname.replace(/\.$/, "")

/** One DNS label: lowercase letters, digits and inner hyphens, at most 63 characters. */
export const DNS_LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"

const HOSTNAME = new RegExp(
  `^(?=.{1,253}$)(?:${DNS_LABEL}\\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$`
)

/** Normalise a typed-in hostname, or return null if it isn't a bare hostname. */
export function parseHostname(input: string): string | null {
  const trimmed = input.trim()
  if (!/^[^/?#@\s]+$/.test(trimmed)) return null
  try {
    const hostname = normaliseHost(new URL(`https://${trimmed}`))
    return HOSTNAME.test(hostname) ? hostname : null
  } catch {
    return null
  }
}

/** Decode a URL path into its segments, keeping case and empty segments, or null if it could escape: bad encoding, a backslash, NUL, `.` or `..`. */
export function pathSegments(pathname: string): string[] | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (/[\\\0]/.test(decoded)) return null
  const segments = decoded.split("/")
  return segments.some((s) => s === "." || s === "..") ? null : segments
}

export function normalisePath(pathname: string): string | null {
  const segments = pathSegments(pathname)
  return segments && `/${segments.filter(Boolean).join("/").toLowerCase()}`
}
