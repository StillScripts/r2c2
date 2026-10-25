declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./worker")
  }
}

declare const process: { argv: string[]; exitCode?: number }
