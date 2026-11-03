import { linkOptions } from "@tanstack/react-router"
import type { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import type { FunctionReturnType } from "convex/server"

export type Overview = FunctionReturnType<typeof api.home.overview>
type Summary = Overview["summary"]
export type Activity = Overview["activity"][number]

const inboxLink = (siteId: Id<"sites">) =>
  linkOptions({
    to: "/sites/$siteId/enquiries",
    params: { siteId },
    search: { status: "new" },
  })

const editorLink = (siteId: Id<"sites">, pageId: Id<"pages">) =>
  linkOptions({
    to: "/sites/$siteId/pages/$pageId",
    params: { siteId, pageId },
  })

/** "Morning" before 12, "Afternoon" before 17, otherwise "Evening". */
export const greetingFor = (hour: number) =>
  hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

const newEnquiries = (n: number) => count(n, "new enquiry", "new enquiries")

function wentLive(paths: string[]) {
  if (paths.length === 0) return undefined
  if (paths.length === 1) return `${paths[0]} went live`
  if (paths.length === 2) return `${paths[0]} and ${paths[1]} went live`
  return `${paths.length} pages went live`
}

/** One sentence on what happened since your last visit, and whether anything needs you. */
export function summaryLine({
  firstVisit,
  published,
  newEnquiries: arrived,
  drafts,
}: Summary) {
  const happened = [
    wentLive(published),
    arrived > 0 && `${newEnquiries(arrived)} came in`,
  ].filter(Boolean)
  const lead = firstVisit
    ? "Welcome to the Loft."
    : happened.length === 0
      ? "Nothing new since your last visit."
      : `${happened.join(", and ")}.`
  const needs =
    drafts.length === 0
      ? "Nothing needs you yet."
      : `${count(drafts.length, "draft is", "drafts are")} waiting to be published.`
  return `${lead} ${needs}`
}

const PAGE_TITLES = {
  "page.publish": "Published",
  "page.rollback": "Rolled back",
  "page.create": "Created",
  "page.restore": "Restored an earlier draft of",
} as const

/** A "Lately" row's words, its icon and where it links, if anywhere. */
export function activityRow(row: Activity) {
  if (row.kind === "enquiry") {
    return {
      icon: "enquiry" as const,
      title: newEnquiries(row.count),
      detail: `From the ${row.form} form`,
      link: inboxLink(row.siteId),
    }
  }
  const live = row.action === "page.publish" || row.action === "page.rollback"
  return {
    icon: live ? ("live" as const) : ("draft" as const),
    title: `${PAGE_TITLES[row.action]} ${row.path}`,
    detail: row.siteName,
    link: row.pageId && editorLink(row.siteId, row.pageId),
  }
}

export type Suggestion = {
  label: string
  link: ReturnType<typeof inboxLink> | ReturnType<typeof editorLink>
}

/** Up to three things worth doing now: new enquiries per site, then the newest draft waiting. */
export function suggestions({
  sites,
  summary,
}: Pick<Overview, "sites" | "summary">): Suggestion[] {
  const several = sites.length > 1
  const name = (siteId: Id<"sites">) =>
    sites.find((site) => site.siteId === siteId)?.name
  const enquiries = sites
    .filter((site) => site.newEnquiries > 0)
    .sort((a, b) => b.newEnquiries - a.newEnquiries)
    .slice(0, 2)
    .map((site): Suggestion => ({
      label: `Read the ${newEnquiries(site.newEnquiries)}${several ? ` for ${site.name}` : ""}`,
      link: inboxLink(site.siteId),
    }))
  const draft = summary.drafts[0]
  if (!draft) return enquiries
  return [
    ...enquiries,
    {
      label: `Publish the ${draft.path} draft${several ? ` on ${name(draft.siteId)}` : ""}`,
      link: editorLink(draft.siteId, draft.pageId),
    },
  ]
}
