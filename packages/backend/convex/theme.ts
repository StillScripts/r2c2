"use node"

import { pageBytes } from "@workspace/core"
import { loadTheme } from "@workspace/html"
import { v } from "convex/values"
// Imported here so Convex installs tailwindcss as an external package: imports from
// @workspace/html don't count, and loadTheme reads tailwindcss/index.css at runtime
import "tailwindcss"
import { api, internal } from "./_generated/api"
import { action } from "./_generated/server"
import { fail } from "./errors"
import { MAX_THEME_BYTES } from "./sites"

/** Compile a site's theme and save it if it compiles, or say why it doesn't. */
export const save = action({
  args: { siteId: v.id("sites"), theme: v.string() },
  handler: async (
    ctx,
    { siteId, theme }
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    // Refuse outsiders and editors before spending time compiling
    const site = await ctx.runQuery(api.sites.get, { siteId })
    if (site.role !== "owner") throw fail("forbidden")
    if (pageBytes(theme) > MAX_THEME_BYTES) {
      return {
        ok: false,
        message: `The theme is over ${MAX_THEME_BYTES / 1024} KB.`,
      }
    }
    try {
      await loadTheme(theme)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, message: `The theme doesn't compile: ${message}` }
    }
    await ctx.runMutation(internal.sites.setTheme, { siteId, theme })
    return { ok: true }
  },
})
