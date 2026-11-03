import { createFileRoute } from "@tanstack/react-router"
import { parseSiteParams } from "@/lib/params"
import { newEnquiriesQuery } from "@/lib/queries"

// Every site screen shows the site menu, which counts new enquiries
export const Route = createFileRoute("/_authed/sites/$siteId")({
  params: { parse: parseSiteParams },
  loader: ({ context, params: { siteId } }) =>
    context.queryClient.ensureQueryData(newEnquiriesQuery(siteId)),
})
