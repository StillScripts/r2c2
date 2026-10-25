import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vite-plus"

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          CONVEX_SITE_URL: "https://convex.test",
          R2C2_SIGNING_SECRET: "test-signing-secret",
          TURNSTILE_SECRET: "test-turnstile-secret",
        },
      },
    }),
  ],
})
