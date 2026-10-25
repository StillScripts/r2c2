declare namespace Cloudflare {
  interface Env {
    SITES: R2Bucket
    ROUTES: KVNamespace
    FORMS_LIMIT: RateLimit
    FORMS_NOJS_LIMIT: RateLimit
    CONVEX_SITE_URL?: string
    R2C2_SIGNING_SECRET?: string
    TURNSTILE_SECRET?: string
  }
  interface GlobalProps {
    mainModule: typeof import("./index")
  }
}
