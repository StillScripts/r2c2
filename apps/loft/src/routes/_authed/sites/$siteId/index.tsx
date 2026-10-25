import { useConvexMutation } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useState, type FormEvent } from "react"
import { errorMessage } from "@/lib/errors"
import { pagesQuery, siteQuery } from "@/lib/queries"

export const Route = createFileRoute("/_authed/sites/$siteId/")({
  loader: ({ context, params }) => {
    const siteId = params.siteId as Id<"sites">
    return Promise.all([
      context.queryClient.ensureQueryData(siteQuery(siteId)),
      context.queryClient.ensureQueryData(pagesQuery(siteId)),
    ])
  },
  component: SitePages,
})

function SitePages() {
  const siteId = Route.useParams().siteId as Id<"sites">
  const { data: site } = useSuspenseQuery(siteQuery(siteId))
  const { data: pages } = useSuspenseQuery(pagesQuery(siteId))

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          Your sites
        </Link>
        <h1 className="text-2xl font-medium">{site.name}</h1>
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
  const create = useConvexMutation(api.pages.create)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(undefined)
    try {
      const pageId = await create({
        siteId,
        path: form.get("path") as string,
        title: form.get("title") as string,
      })
      await navigate({
        to: "/sites/$siteId/pages/$pageId",
        params: { siteId, pageId },
      })
    } catch (caught) {
      setError(errorMessage(caught))
      setPending(false)
    }
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
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create page"}
      </Button>
    </form>
  )
}
