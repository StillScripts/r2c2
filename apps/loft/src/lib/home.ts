import type { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import type { FunctionReturnType } from "convex/server"

export type Overview = FunctionReturnType<typeof api.home.overview>
type Summary = Overview["summary"]

/** "Morning" before 12, "Afternoon" before 17, otherwise "Evening". */
export const greetingFor = (hour: number) =>
  hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

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
  newEnquiries,
  drafts,
}: Summary) {
  const happened = [
    wentLive(published),
    newEnquiries > 0 &&
      `${count(newEnquiries, "new enquiry", "new enquiries")} came in`,
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
  const sentence = `${lead} ${needs}`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

export type Suggestion =
  | { kind: "enquiries"; label: string; siteId: Id<"sites"> }
  | { kind: "draft"; label: string; siteId: Id<"sites">; pageId: Id<"pages"> }

/** Up to three things worth doing now: new enquiries per site, then the newest draft waiting. */
export function suggestions({ sites, summary }: Overview): Suggestion[] {
  const several = sites.length > 1
  const name = (siteId: Id<"sites">) =>
    sites.find((site) => site.siteId === siteId)?.name
  const enquiries = sites
    .filter((site) => site.newEnquiries > 0)
    .sort((a, b) => b.newEnquiries - a.newEnquiries)
    .slice(0, 2)
    .map((site): Suggestion => ({
      kind: "enquiries",
      label: `Read the ${count(site.newEnquiries, "new enquiry", "new enquiries")}${several ? ` for ${site.name}` : ""}`,
      siteId: site.siteId,
    }))
  const draft = summary.drafts[0]
  return draft
    ? [
        ...enquiries,
        {
          kind: "draft",
          label: `Publish the ${draft.path} draft${several ? ` on ${name(draft.siteId)}` : ""}`,
          siteId: draft.siteId,
          pageId: draft.pageId,
        },
      ]
    : enquiries
}
