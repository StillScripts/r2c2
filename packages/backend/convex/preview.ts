"use node"

import { checkPage, compileCss, type Issue, loadTheme } from "@workspace/html"
import { v } from "convex/values"
import { api } from "./_generated/api"
import { action } from "./_generated/server"

/** Compile a draft's CSS and check its house rules, the same way publish will. */
export const preview = action({
  args: { siteId: v.id("sites"), html: v.string() },
  handler: async (
    ctx,
    { siteId, html }
  ): Promise<{ css: string; errors: Issue[]; warnings: Issue[] }> => {
    const site = await ctx.runQuery(api.sites.get, { siteId })
    const theme = await loadTheme(site.theme)
    const [{ css }, { errors, warnings }] = await Promise.all([
      compileCss(html, theme),
      checkPage(html, theme),
    ])
    return { css, errors, warnings }
  },
})
