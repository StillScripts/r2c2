const TRACKING_PARAMS = new Set(["gclid", "fbclid"])

export function normaliseHost(host: string): string | null {
  if (/[/\\?#@\s]/.test(host)) return null
  try {
    return new URL(`http://${host}`).hostname.replace(/\.$/, "") || null
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
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null
  }
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
