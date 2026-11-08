import { useConvexMutation } from "@convex-dev/react-query"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import type { Doc, Id } from "@workspace/backend/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import type { FunctionArgs, FunctionReturnType } from "convex/server"
import type { FormEvent } from "react"
import { ConfirmButton } from "@/components/confirm-button"
import { errorMessage } from "@/lib/errors"
import { card, screen } from "@/lib/layout"
import { pagesQuery, siteQuery } from "@/lib/queries"

export const Route = createFileRoute("/_authed/sites/$siteId/")({
  loader: ({ context, params: { siteId } }) =>
    Promise.all([
      context.queryClient.ensureQueryData(siteQuery(siteId)),
      context.queryClient.ensureQueryData(pagesQuery(siteId)),
    ]),
  component: SiteScreen,
})

const CONTENT = {
  pages: {
    shows: "your published pages",
    nothingLive:
      "The home page (/) isn't published yet, so visitors to it will see a not-found page.",
  },
  app: {
    shows: "your live build",
    nothingLive:
      "No build is deployed yet, so visitors will see a not-found page.",
  },
} as const

function SiteScreen() {
  const { siteId } = Route.useParams()
  const { data: site } = useSuspenseQuery(siteQuery(siteId))
  const { data: pages } = useSuspenseQuery(pagesQuery(siteId))
  const isApp = site.kind === "app"

  return (
    <main className={cn(screen, "max-w-2xl")}>
      <h1 className="font-serif text-4xl">{site.name}</h1>
      <SiteStatus
        siteId={siteId}
        status={site.status}
        kind={site.kind}
        isOwner={site.role === "owner"}
        isServing={
          isApp
            ? site.liveBuildId !== undefined
            : pages.some((page) => page.path === "/" && page.isLive)
        }
      />
      {isApp ? (
        <AppBuild hasBuild={site.liveBuildId !== undefined} />
      ) : (
        <>
          <PageList siteId={siteId} pages={pages} />
          <NewPageForm siteId={siteId} />
        </>
      )}
    </main>
  )
}

function AppBuild({ hasBuild }: { hasBuild: boolean }) {
  return (
    <section className={cn("flex flex-col gap-1 p-5", card)}>
      <h2 className="font-medium">Deployed from a build</h2>
      <p className="text-sm text-muted-foreground">
        This site serves an app build as-is, so it has no pages or theme to edit
        here. {hasBuild ? "A build is live." : "No build is deployed yet."}
      </p>
    </section>
  )
}

function PageList({
  siteId,
  pages,
}: {
  siteId: Id<"sites">
  pages: FunctionReturnType<typeof api.pages.list>
}) {
  return pages.length === 0 ? (
    <p className="text-muted-foreground">This site has no pages yet.</p>
  ) : (
    <ul className={cn("divide-y", card)}>
      {pages.map((page) => (
        <li key={page._id}>
          <Link
            to="/sites/$siteId/pages/$pageId"
            params={{ siteId, pageId: page._id }}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-fill-2"
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
  )
}

const STATUS_COPY = {
  live: {
    heading: "Live",
    hint: (shows: string) => `Visitors see ${shows}.`,
    action: "Switch to Coming soon",
    confirm: "Switch to Coming soon?",
    next: "coming-soon",
  },
  "coming-soon": {
    heading: "Coming soon",
    hint: () => "Visitors see a holding page on every path.",
    action: "Go live",
    confirm: "Take this site live?",
    next: "live",
  },
} as const

function SiteStatus({
  siteId,
  status,
  kind,
  isOwner,
  isServing,
}: {
  siteId: Id<"sites">
  status: Doc<"sites">["status"]
  kind: keyof typeof CONTENT
  isOwner: boolean
  isServing: boolean
}) {
  const change = useMutation({
    mutationFn: useConvexMutation(api.sites.setStatus),
  })
  const copy = STATUS_COPY[status]
  const content = CONTENT[kind]

  return (
    <section className={cn("flex flex-col gap-3 p-5", card)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="font-medium">{copy.heading}</h2>
          <p className="text-sm text-muted-foreground">
            {copy.hint(content.shows)}
          </p>
        </div>
        {isOwner && (
          <ConfirmButton
            variant={status === "live" ? "outline" : "default"}
            disabled={change.isPending}
            title={copy.confirm}
            description={
              status === "live" ? (
                "Every page will show the holding page instead, within about a minute."
              ) : (
                <>
                  {!isServing && `${content.nothingLive} `}
                  Visitors will see {content.shows} within about a minute.
                </>
              )
            }
            confirmLabel={copy.action}
            onConfirm={() => change.mutate({ siteId, status: copy.next })}
          >
            {change.isPending ? "Saving…" : copy.action}
          </ConfirmButton>
        )}
      </div>
      {change.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(change.error)}
        </p>
      )}
    </section>
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
      className={cn("flex flex-col gap-4 p-5", card)}
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
