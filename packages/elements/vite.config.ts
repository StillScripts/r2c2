import { defineConfig } from "vite-plus"

export const PACK = {
  entry: { "site-elements": "src/index.ts" },
  platform: "browser",
  format: "esm",
  minify: true,
  dts: false,
} as const

export default defineConfig({ pack: PACK })
