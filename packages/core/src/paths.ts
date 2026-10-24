const TRACKING_PARAMS = new Set(["gclid", "fbclid"])

export const normaliseHost = (url: URL) => url.hostname.replace(/\.$/, "")

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
