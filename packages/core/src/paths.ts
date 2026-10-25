const TRACKING_PARAMS = new Set(["gclid", "fbclid"])

export const normaliseHost = (url: URL) => url.hostname.replace(/\.$/, "")

const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

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

export function normalisePath(pathname: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname).toLowerCase()
  } catch {
    return null
  }
  if (/[\\\0]/.test(decoded)) return null

  const segments = decoded.split("/").filter(Boolean)
  if (segments.includes(".") || segments.includes("..")) return null
  return `/${segments.join("/")}`
}

export function stripTrackingParams(url: URL): URL {
  const stripped = new URL(url)
  for (const key of url.searchParams.keys()) {
    if (key.startsWith("utm_") || TRACKING_PARAMS.has(key)) {
      stripped.searchParams.delete(key)
    }
  }
  return stripped
}
