import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { requireUserId } from "./access"
import { siteAddress } from "./domains"
import { inboxPage } from "./enquiries"
import { DEFAULT_VIEW, preferencesOf } from "./preferences"
import { brandOf } from "./sites"

/** A gap longer than this since Home last saw you starts a new visit. */
export const VISIT_GAP_MS = 30 * 60 * 1000
/** How many rows "Lately" shows. */
export const ACTIVITY_LIMIT = 4
const AUDIT_PER_SITE = 20
const PUBLISHED_PER_SITE = 50

const ACTIVITY = {
  "page.publish": {
    kind: "live",
    title: (path: string) => `Published ${path}`,
  },
  "page.rollback": {
    kind: "live",
    title: (path: string) => `Rolled back ${path}`,
  },
  "page.create": { kind: "draft", title: (path: string) => `Created ${path}` },
  "page.restore": {
    kind: "draft",
    title: (path: string) => `Restored an earlier draft of ${path}`,
  },
} as const

type ActivityKind = "live" | "draft" | "enquiry"

export type Activity = {
  kind: ActivityKind
  title: string
  detail: string
  at: number
  siteId: Id<"sites">
  pageId?: Id<"pages">
}

/** Note that Home saw the caller, starting a new visit after a long enough gap. */
export const markSeen = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    const preferences = await preferencesOf(ctx, userId)
    if (!preferences) {
      await ctx.db.insert("preferences", {
        userId,
        view: DEFAULT_VIEW,
        lastSeenAt: now,
      })
      return
    }
    const { lastSeenAt } = preferences
    const newVisit = lastSeenAt !== undefined && now - lastSeenAt > VISIT_GAP_MS
    await ctx.db.patch("preferences", preferences._id, {
      lastSeenAt: now,
      ...(newVisit && { previousSeenAt: lastSeenAt }),
    })
  },
})

const newestFirst = (a: { at: number }, b: { at: number }) => b.at - a.at

/** One site's part of Home: its row, its activity and what's changed since `since`. */
async function siteOverview(
  ctx: QueryCtx,
  site: Doc<"sites">,
  role: Doc<"memberships">["role"],
  since: number | undefined
) {
  const auditFrom = (from?: number, limit = AUDIT_PER_SITE) =>
    ctx.db
      .query("auditLog")
      .withIndex("by_site_at", (q) =>
        from === undefined
          ? q.eq("siteId", site._id)
          : q.eq("siteId", site._id).gt("at", from)
      )
      .order("desc")
      .take(limit)
  const [recent, inbox, pages, sinceLog] = await Promise.all([
    auditFrom(),
    inboxPage(ctx, site._id, "new"),
    ctx.db
      .query("pages")
      .withIndex("by_site_path", (q) => q.eq("siteId", site._id))
      .collect(),
    since === undefined ? [] : auditFrom(since, PUBLISHED_PER_SITE),
  ])
  const pageAt = new Map(pages.map((page) => [page.path, page._id]))

  const pageRows = recent.flatMap(({ action, target, at }): Activity[] => {
    const known = ACTIVITY[action as keyof typeof ACTIVITY]
    if (!known) return []
    return [
      {
        kind: known.kind,
        title: known.title(target),
        detail: site.name,
        at,
        siteId: site._id,
        pageId: pageAt.get(target),
      },
    ]
  })
  const byForm = new Map<string, Doc<"enquiries">[]>()
  for (const enquiry of inbox.enquiries) {
    byForm.set(enquiry.form, [...(byForm.get(enquiry.form) ?? []), enquiry])
  }
  const enquiryRows = [...byForm].map(([form, enquiries]): Activity => ({
    kind: "enquiry",
    title: `${enquiries.length} new ${enquiries.length === 1 ? "enquiry" : "enquiries"}`,
    detail: `From the ${form} form`,
    at: enquiries[0]!.createdAt,
    siteId: site._id,
  }))

  return {
    site: {
      siteId: site._id,
      name: site.name,
      address: siteAddress(site.slug),
      status: site.status,
      brand: brandOf(site.theme),
      role,
      newEnquiries: inbox.enquiries.length,
    },
    activity: [...pageRows, ...enquiryRows],
    published: sinceLog
      .filter(({ action }) => action === "page.publish")
      .map(({ target }) => target),
    newSince:
      since === undefined
        ? 0
        : inbox.enquiries.filter(({ createdAt }) => createdAt > since).length,
    drafts: pages.flatMap(({ _id, path, draftChangedAt }) =>
      draftChangedAt === undefined
        ? []
        : [{ siteId: site._id, pageId: _id, path, at: draftChangedAt }]
    ),
  }
}

/** Everything Home shows, across the caller's sites. Activity never names who did it. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const [memberships, preferences] = await Promise.all([
      ctx.db
        .query("memberships")
        .withIndex("by_user_site", (q) => q.eq("userId", userId))
        .collect(),
      preferencesOf(ctx, userId),
    ])
    const since = preferences?.previousSeenAt
    const parts = (
      await Promise.all(
        memberships.map(async ({ siteId, role }) => {
          const site = await ctx.db.get("sites", siteId)
          return site && siteOverview(ctx, site, role, since)
        })
      )
    ).filter((part) => part !== null)

    return {
      sites: parts
        .map(({ site }) => site)
        .sort((a, b) => a.name.localeCompare(b.name)),
      activity: parts
        .flatMap(({ activity }) => activity)
        .sort(newestFirst)
        .slice(0, ACTIVITY_LIMIT),
      summary: {
        firstVisit: since === undefined,
        published: [...new Set(parts.flatMap(({ published }) => published))],
        newEnquiries: parts.reduce((sum, { newSince }) => sum + newSince, 0),
        drafts: parts.flatMap(({ drafts }) => drafts).sort(newestFirst),
      },
    }
  },
})
