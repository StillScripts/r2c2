import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { enquirySummary } from "@workspace/core"
import { when } from "@/lib/format"
import { parseSiteParams } from "@/lib/params"
import { type EnquiryStatus, enquiriesQuery, siteQuery } from "@/lib/queries"

const TABS: [EnquiryStatus, string][] = [
  ["new", "New"],
  ["handled", "Handled"],
]

export const Route = createFileRoute("/_authed/sites/$siteId/enquiries/")({
  params: { parse: parseSiteParams },
  validateSearch: (search): { status: EnquiryStatus } => ({
    status: search.status === "handled" ? "handled" : "new",
  }),
  loaderDeps: ({ search: { status } }) => ({ status }),
  loader: ({ context: { queryClient }, params: { siteId }, deps }) =>
    Promise.all([
      queryClient.ensureQueryData(siteQuery(siteId)),
      queryClient.ensureQueryData(enquiriesQuery(siteId, deps.status)),
    ]),
  component: Inbox,
})

function Inbox() {
  const { siteId } = Route.useParams()
  const { status } = Route.useSearch()
  const { data: site } = useSuspenseQuery(siteQuery(siteId))
  const {
    data: { enquiries, capped },
  } = useSuspenseQuery(enquiriesQuery(siteId, status))

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link
          to="/sites/$siteId"
          params={{ siteId }}
          className="text-sm text-muted-foreground hover:underline"
        >
          {site.name}
        </Link>
        <h1 className="text-2xl font-medium">Enquiries</h1>
      </div>
      <nav className="flex gap-4 border-b">
        {TABS.map(([tab, label]) => (
          <Link
            key={tab}
            to="/sites/$siteId/enquiries"
            params={{ siteId }}
            search={{ status: tab }}
            aria-current={tab === status ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent pb-2 text-muted-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
      {enquiries.length === 0 ? (
        <p className="text-muted-foreground">
          {status === "new" ? "No new enquiries." : "No handled enquiries yet."}
        </p>
      ) : (
        <ul className="divide-y rounded-3xl border">
          {enquiries.map((enquiry) => (
            <li key={enquiry._id}>
              <Link
                to="/sites/$siteId/enquiries/$enquiryId"
                params={{ siteId, enquiryId: enquiry._id }}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-muted"
              >
                <span className="flex justify-between gap-4">
                  <span className="truncate">
                    {enquirySummary(enquiry.data)}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {when(enquiry.createdAt)}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {enquiry.form}
                  {enquiry.source && ` · from ${enquiry.source.page}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {capped && (
        <p className="text-sm text-muted-foreground">
          Showing the latest {enquiries.length}.
        </p>
      )}
    </main>
  )
}
