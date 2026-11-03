import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { requireUserId } from "./access"
import { siteAddress } from "./domains"
import { inboxPage } from "./enquiries"
import { brandOf, memberSites } from "./sites"

/** A gap longer than this since Home last saw you starts a new visit. */
export const VISIT_GAP_MS = 30 * 60 * 1000
/** Within a visit, Home's record of you is refreshed at most this often, so it rarely re-runs the overview. */
export const SEEN_REFRESH_MS = 5 * 60 * 1000
/** How many rows "Lately" shows. */
export const ACTIVITY_LIMIT = 4
// Most audit entries aren't page actions, so read more than are shown
const AUDIT_PER_SITE = 50
const RECENT_PER_SITE = 20

const PAGE_ACTIONS = [
  "page.publish",
  "page.rollback",
  "page.create",
  "page.restore",
] as const
type PageAction = (typeof PAGE_ACTIONS)[number]
const isPageAction = (action: string): action is PageAction =>
  (PAGE_ACTIONS as readonly string[]).includes(action)

/** A row in "Lately", as data; the Loft words it. */
export type Activity = { at: number; siteId: Id<"sites">; siteName: string } & (
  | { kind: "page"; action: PageAction; path: string; pageId?: Id<"pages"> }
  | { kind: "enquiry"; form: string; count: number }
)

const visitOf = (ctx: QueryCtx, userId: string) =>
  ctx.db
    .query("visits")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()

/** Note that Home saw the caller, starting a new visit after a long enough gap. */
export const markSeen = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const now = Date.now()
    const visit = await visitOf(ctx, userId)
    if (!visit) {
      await ctx.db.insert("visits", { userId, lastSeenAt: now })
      return
    }
    const away = now - visit.lastSeenAt
    if (away <= SEEN_REFRESH_MS) return
    await ctx.db.patch("visits", visit._id, {
      lastSeenAt: now,
      ...(away > VISIT_GAP_MS && { previousSeenAt: visit.lastSeenAt }),
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
  const [log, inbox, drafts] = await Promise.all([
    ctx.db
      .query("auditLog")
      .withIndex("by_site_at", (q) => q.eq("siteId", site._id))
      .order("desc")
      .take(AUDIT_PER_SITE),
    inboxPage(ctx, site._id, "new"),
    ctx.db
      .query("pages")
      .withIndex("by_site_draft", (q) =>
        q.eq("siteId", site._id).gt("draftChangedAt", 0)
      )
      .collect(),
  ])
  const base = { siteId: site._id, siteName: site.name }

  const pageRows = log
    .slice(0, RECENT_PER_SITE)
    .flatMap(({ action, target, at }): Activity[] =>
      isPageAction(action)
        ? [{ ...base, kind: "page", action, path: target, at }]
        : []
    )
  const byForm = new Map<string, Doc<"enquiries">[]>()
  for (const enquiry of inbox.enquiries) {
    const group = byForm.get(enquiry.form)
    if (group) group.push(enquiry)
    else byForm.set(enquiry.form, [enquiry])
  }
  const enquiryRows = [...byForm].map(([form, enquiries]): Activity => ({
    ...base,
    kind: "enquiry",
    form,
    count: enquiries.length,
    at: enquiries[0]!.createdAt,
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
    published:
      since === undefined
        ? []
        : log
            .filter(({ action, at }) => action === "page.publish" && at > since)
            .map(({ target }) => target),
    newSince:
      since === undefined
        ? 0
        : inbox.enquiries.filter(({ createdAt }) => createdAt > since).length,
    drafts: drafts.map(({ _id, path, draftChangedAt }) => ({
      siteId: site._id,
      pageId: _id,
      path,
      at: draftChangedAt!,
    })),
  }
}

/** Links an activity row to its page, if the page still exists. Only the rows shown are looked up. */
async function withPage(ctx: QueryCtx, row: Activity): Promise<Activity> {
  if (row.kind !== "page") return row
  const page = await ctx.db
    .query("pages")
    .withIndex("by_site_path", (q) =>
      q.eq("siteId", row.siteId).eq("path", row.path)
    )
    .unique()
  return page ? { ...row, pageId: page._id } : row
}

/** Everything Home shows, across the caller's sites. Activity never names who did it. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const [sites, visit] = await Promise.all([
      memberSites(ctx, userId),
      visitOf(ctx, userId),
    ])
    const since = visit?.previousSeenAt
    const parts = await Promise.all(
      sites.map(({ site, role }) => siteOverview(ctx, site, role, since))
    )
    const shown = parts
      .flatMap(({ activity }) => activity)
      .sort(newestFirst)
      .slice(0, ACTIVITY_LIMIT)

    return {
      sites: parts
        .map(({ site }) => site)
        .sort((a, b) => a.name.localeCompare(b.name)),
      activity: await Promise.all(shown.map((row) => withPage(ctx, row))),
      summary: {
        firstVisit: since === undefined,
        published: [...new Set(parts.flatMap(({ published }) => published))],
        newEnquiries: parts.reduce((sum, { newSince }) => sum + newSince, 0),
        drafts: parts.flatMap(({ drafts }) => drafts).sort(newestFirst),
      },
    }
  },
})
