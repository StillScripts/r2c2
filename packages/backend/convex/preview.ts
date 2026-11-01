"use node"

import { checkPage, compileCss, type Issue, loadTheme } from "@workspace/html"
import { v } from "convex/values"
// Imported here so Convex installs tailwindcss as an external package: imports from
// @workspace/html don't count, and loadTheme reads tailwindcss/index.css at runtime
import "tailwindcss"
import { api } from "./_generated/api"
import { action } from "./_generated/server"

/** A draft's compiled CSS and house-rule issues under a theme, the same way publish will. */
export async function previewPage(html: string, themeCss: string) {
  const theme = await loadTheme(themeCss)
  const [{ css }, { errors, warnings }] = await Promise.all([
    compileCss(html, theme),
    checkPage(html, theme),
  ])
  return { css, errors, warnings }
}

export type PagePreview = { css: string; errors: Issue[]; warnings: Issue[] }

/** Compile a draft's CSS and check its house rules with the site's theme. */
export const preview = action({
  args: { siteId: v.id("sites"), html: v.string() },
  handler: async (ctx, { siteId, html }): Promise<PagePreview> => {
    const site = await ctx.runQuery(api.sites.get, { siteId })
    return previewPage(html, site.theme)
  },
})
