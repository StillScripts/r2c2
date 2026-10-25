import { useConvexMutation } from "@convex-dev/react-query"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { campaign } from "@/lib/enquiry"
import { errorMessage } from "@/lib/errors"
import { when } from "@/lib/format"
import { parseEnquiryParams } from "@/lib/params"
import { enquiryQuery } from "@/lib/queries"

export const Route = createFileRoute(
  "/_authed/sites/$siteId/enquiries/$enquiryId"
)({
  params: { parse: parseEnquiryParams },
  loader: ({ context: { queryClient }, params: { siteId, enquiryId } }) =>
    queryClient.ensureQueryData(enquiryQuery(siteId, enquiryId)),
  component: EnquiryDetail,
})

function EnquiryDetail() {
  const { siteId, enquiryId } = Route.useParams()
  const { data: enquiry } = useSuspenseQuery(enquiryQuery(siteId, enquiryId))
  const setStatus = useConvexMutation(api.enquiries.setStatus)
  const update = useMutation({
    mutationFn: (status: "new" | "handled") =>
      setStatus({ siteId, enquiryId, status }),
  })
  const handled = enquiry.status === "handled"
  const utm = enquiry.source && campaign(enquiry.source.utm)

  const details: [string, string | undefined][] = [
    ["Form", enquiry.form],
    ["Received", when(enquiry.createdAt)],
    ["Page", enquiry.source?.page],
    ["Referrer", enquiry.source?.referrer],
    ["Campaign", utm || undefined],
  ]

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link
          to="/sites/$siteId/enquiries"
          params={{ siteId }}
          search={{ status: enquiry.status }}
          className="text-sm text-muted-foreground hover:underline"
        >
          Enquiries
        </Link>
        <h1 className="text-2xl font-medium">
          {handled ? "Handled enquiry" : "New enquiry"}
        </h1>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-3xl border p-6">
        {Object.entries(enquiry.data).map(([field, value]) => (
          <Detail key={field} label={field} value={value} />
        ))}
      </dl>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {details.map(
          ([label, value]) =>
            value && <Detail key={label} label={label} value={value} />
        )}
      </dl>
      {update.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(update.error)}
        </p>
      )}
      <Button
        variant={handled ? "outline" : "default"}
        disabled={update.isPending}
        onClick={() => update.mutate(handled ? "new" : "handled")}
        className="self-start"
      >
        {handled ? "Reopen" : "Mark handled"}
      </Button>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">{value}</dd>
    </>
  )
}
