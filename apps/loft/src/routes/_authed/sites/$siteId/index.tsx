import { useConvexMutation } from "@convex-dev/react-query"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import type { FunctionArgs } from "convex/server"
import type { FormEvent } from "react"
import { errorMessage } from "@/lib/errors"
import { parseSiteParams } from "@/lib/params"
import { newEnquiriesQuery, pagesQuery, siteQuery } from "@/lib/queries"
import { INBOX_LIMIT } from "@workspace/core"

export const Route = createFileRoute("/_authed/sites/$siteId/")({
  params: { parse: parseSiteParams },
  loader: ({ context, params: { siteId } }) =>
    Promise.all([
      context.queryClient.ensureQueryData(siteQuery(siteId)),
      context.queryClient.ensureQueryData(pagesQuery(siteId)),
      context.queryClient.ensureQueryData(newEnquiriesQuery(siteId)),
    ]),
  component: SitePages,
})

function SitePages() {
  const { siteId } = Route.useParams()
  const { data: site } = useSuspenseQuery(siteQuery(siteId))
  const { data: pages } = useSuspenseQuery(pagesQuery(siteId))
  const { data: newCount } = useSuspenseQuery(newEnquiriesQuery(siteId))

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          Your sites
        </Link>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-medium">{site.name}</h1>
          <Link
            to="/sites/$siteId/enquiries"
            params={{ siteId }}
            search={{ status: "new" }}
            className="text-sm hover:underline"
          >
            Enquiries
            {newCount > 0 &&
              ` (${newCount > INBOX_LIMIT ? `${INBOX_LIMIT}+` : newCount} new)`}
          </Link>
        </div>
      </div>
      {pages.length === 0 ? (
        <p className="text-muted-foreground">This site has no pages yet.</p>
      ) : (
        <ul className="divide-y rounded-3xl border">
          {pages.map((page) => (
            <li key={page._id}>
              <Link
                to="/sites/$siteId/pages/$pageId"
                params={{ siteId, pageId: page._id }}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted"
              >
                <span className="flex flex-col">
                  <span>{page.title}</span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {page.path}
                  </span>
                </span>
                {page.isLive && (
                  <span className="text-sm text-muted-foreground">Live</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewPageForm siteId={siteId} />
    </main>
  )
}

function NewPageForm({ siteId }: { siteId: Id<"sites"> }) {
  const navigate = useNavigate()
  const createPage = useConvexMutation(api.pages.create)
  const create = useMutation({
    mutationFn: (args: FunctionArgs<typeof api.pages.create>) =>
      createPage(args),
    onSuccess: (pageId) =>
      navigate({
        to: "/sites/$siteId/pages/$pageId",
        params: { siteId, pageId },
      }),
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    create.mutate({
      siteId,
      path: form.get("path") as string,
      title: form.get("title") as string,
    })
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-3xl border p-6"
    >
      <h2 className="font-medium">New page</h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="path">Path</Label>
        <Input id="path" name="path" placeholder="/about" required />
      </div>
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(create.error)}
        </p>
      )}
      <Button type="submit" disabled={create.isPending} className="self-start">
        {create.isPending ? "Creating…" : "Create page"}
      </Button>
    </form>
  )
}
