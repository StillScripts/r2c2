import { DNS_LABEL } from "./paths"

// A slug is one DNS label, so a site's address is always one level below the sites domain
const SLUG = new RegExp(`^${DNS_LABEL}$`)

/** Names kept for the platform's own hostnames under the sites domain. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "www",
  "app",
  "api",
  "loft",
  "docs",
  "admin",
  "mail",
  "status",
  "help",
  "blog",
  "cdn",
  "assets",
])

export const isSiteSlug = (slug: string) =>
  SLUG.test(slug) && !RESERVED_SLUGS.has(slug)
