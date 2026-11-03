import type { Id } from "@workspace/backend/dataModel"
import { describe, expect, it } from "vite-plus/test"
import {
  activityRow,
  greetingFor,
  type Overview,
  suggestions,
  summaryLine,
} from "./home"

const a = "a" as Id<"sites">
const b = "b" as Id<"sites">
const how = "how" as Id<"pages">

const summary = (over: Partial<Overview["summary"]> = {}) => ({
  firstVisit: false,
  published: [],
  newEnquiries: 0,
  drafts: [],
  ...over,
})

const site = (siteId: Id<"sites">, name: string, newEnquiries = 0) => ({
  siteId,
  name,
  newEnquiries,
  address: `${name}.lofty.page`,
  status: "live" as const,
  brand: null,
  role: "owner" as const,
})

const draft = { siteId: a, pageId: how, path: "/how", at: 1 }

describe("greetingFor", () => {
  it("follows the time of day", () => {
    expect([0, 11, 12, 16, 17, 23].map(greetingFor)).toEqual([
      "Morning",
      "Morning",
      "Afternoon",
      "Afternoon",
      "Evening",
      "Evening",
    ])
  })
})

describe("summaryLine", () => {
  it("says what went live and what came in", () => {
    expect(
      summaryLine(summary({ published: ["/pricing"], newEnquiries: 2 }))
    ).toBe(
      "/pricing went live, and 2 new enquiries came in. Nothing needs you yet."
    )
  })

  it("names two pages and counts more", () => {
    expect(summaryLine(summary({ published: ["/a", "/b"] }))).toBe(
      "/a and /b went live. Nothing needs you yet."
    )
    expect(summaryLine(summary({ published: ["/a", "/b", "/c"] }))).toBe(
      "3 pages went live. Nothing needs you yet."
    )
  })

  it("says when nothing happened, and uses the singular", () => {
    expect(summaryLine(summary())).toBe(
      "Nothing new since your last visit. Nothing needs you yet."
    )
    expect(summaryLine(summary({ newEnquiries: 1 }))).toBe(
      "1 new enquiry came in. Nothing needs you yet."
    )
  })

  it("says when drafts are waiting instead", () => {
    expect(summaryLine(summary({ drafts: [draft] }))).toBe(
      "Nothing new since your last visit. 1 draft is waiting to be published."
    )
    expect(summaryLine(summary({ drafts: [draft, draft] }))).toMatch(
      /2 drafts are waiting to be published\.$/
    )
  })

  it("welcomes a first visit", () => {
    expect(summaryLine(summary({ firstVisit: true }))).toBe(
      "Welcome to the Loft. Nothing needs you yet."
    )
  })
})

describe("suggestions", () => {
  it("suggests the enquiries, then the newest draft", () => {
    expect(
      suggestions({
        sites: [site(a, "R2C2", 2)],
        summary: summary({ drafts: [draft] }),
      })
    ).toMatchObject([
      {
        label: "Read the 2 new enquiries",
        link: { to: "/sites/$siteId/enquiries", params: { siteId: a } },
      },
      {
        label: "Publish the /how draft",
        link: {
          to: "/sites/$siteId/pages/$pageId",
          params: { siteId: a, pageId: how },
        },
      },
    ])
  })

  it("names the site when you have several, busiest first, at most two", () => {
    const c = "c" as Id<"sites">
    expect(
      suggestions({
        sites: [site(a, "A", 1), site(b, "B", 3), site(c, "C", 2)],
        summary: summary(),
      }).map(({ label }) => label)
    ).toEqual([
      "Read the 3 new enquiries for B",
      "Read the 2 new enquiries for C",
    ])
  })

  it("suggests nothing when nothing's waiting", () => {
    expect(suggestions({ sites: [site(a, "A")], summary: summary() })).toEqual(
      []
    )
  })
})

describe("activityRow", () => {
  const base = { at: 1, siteId: a, siteName: "R2C2" }

  it("words page actions as outcomes and links to the page", () => {
    expect(
      activityRow({
        ...base,
        kind: "page",
        action: "page.publish",
        path: "/pricing",
        pageId: how,
      })
    ).toMatchObject({
      icon: "live",
      title: "Published /pricing",
      detail: "R2C2",
      link: { params: { siteId: a, pageId: how } },
    })
    expect(
      activityRow({
        ...base,
        kind: "page",
        action: "page.restore",
        path: "/how",
      })
    ).toEqual({
      icon: "draft",
      title: "Restored an earlier draft of /how",
      detail: "R2C2",
      link: undefined,
    })
  })

  it("groups enquiries by form and links to the inbox", () => {
    expect(
      activityRow({ ...base, kind: "enquiry", form: "contact", count: 1 })
    ).toMatchObject({
      icon: "enquiry",
      title: "1 new enquiry",
      detail: "From the contact form",
      link: { to: "/sites/$siteId/enquiries", search: { status: "new" } },
    })
  })
})
