import { expect, test } from "vite-plus/test"
import { isSiteSlug } from "./sites"

test.each(["r2c2", "a", "acme-dental", "a".repeat(63)])(
  "%s is a slug",
  (slug) => expect(isSiteSlug(slug)).toBe(true)
)

test.each([
  "",
  "Acme",
  "-acme",
  "acme-",
  "acme.dental",
  "a_b",
  "a".repeat(64),
  "www",
  "app",
])("%j isn't a slug", (slug) => expect(isSiteSlug(slug)).toBe(false))
