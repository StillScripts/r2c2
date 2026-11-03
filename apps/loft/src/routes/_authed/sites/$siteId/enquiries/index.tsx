import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { enquirySummary } from "@workspace/core"
import { when } from "@/lib/format"
import { type EnquiryStatus, enquiriesQuery } from "@/lib/queries"
import { cn } from "@workspace/ui/lib/utils"
import { card, screen } from "@/lib/layout"

const TABS: [EnquiryStatus, string][] = [
  ["new", "New"],
  ["handled", "Handled"],
]

export const Route = createFileRoute("/_authed/sites/$siteId/enquiries/")({
  validateSearch: (search): { status: EnquiryStatus } => ({
    status: search.status === "handled" ? "handled" : "new",
  }),
  loaderDeps: ({ search: { status } }) => ({ status }),
  loader: ({ context: { queryClient }, params: { siteId }, deps }) =>
    queryClient.ensureQueryData(enquiriesQuery(siteId, deps.status)),
  component: Inbox,
})

function Inbox() {
  const { siteId } = Route.useParams()
  const { status } = Route.useSearch()
  const {
    data: { enquiries, capped },
  } = useSuspenseQuery(enquiriesQuery(siteId, status))

  return (
    <main className={cn(screen, "max-w-2xl")}>
      <h1 className="font-serif text-4xl">Enquiries</h1>
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
        <ul className={cn("divide-y", card)}>
          {enquiries.map((enquiry) => (
            <li key={enquiry._id}>
              <Link
                to="/sites/$siteId/enquiries/$enquiryId"
                params={{ siteId, enquiryId: enquiry._id }}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-fill-2"
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
