declare namespace Cloudflare {
  interface Env {
    SITES: R2Bucket
    ROUTES: KVNamespace
  }
  interface GlobalProps {
    mainModule: typeof import("./index")
  }
}
