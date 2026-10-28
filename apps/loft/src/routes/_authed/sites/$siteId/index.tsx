import { useConvexAction, useConvexMutation } from "@convex-dev/react-query"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import type { Doc, Id } from "@workspace/backend/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import type { FunctionArgs } from "convex/server"
import { type FormEvent, useState } from "react"
import { ConfirmButton } from "@/components/confirm-button"
import { errorMessage } from "@/lib/errors"
import { parseSiteParams } from "@/lib/params"
import { newEnquiriesQuery, pagesQuery, siteQuery } from "@/lib/queries"

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
  const {
    data: { count, capped },
  } = useSuspenseQuery(newEnquiriesQuery(siteId))

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
            {count > 0 && ` (${count}${capped ? "+" : ""} new)`}
          </Link>
        </div>
      </div>
      <SiteStatus
        siteId={siteId}
        status={site.status}
        isOwner={site.role === "owner"}
        homeIsLive={pages.some((page) => page.path === "/" && page.isLive)}
      />
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
      {site.role === "owner" && (
        <ThemeEditor siteId={siteId} saved={site.theme} />
      )}
    </main>
  )
}

const STATUS_COPY = {
  live: {
    heading: "Live",
    hint: "Visitors see your published pages.",
    action: "Switch to Coming soon",
    confirm: "Switch to Coming soon?",
    next: "coming-soon",
  },
  "coming-soon": {
    heading: "Coming soon",
    hint: "Visitors see a holding page on every path.",
    action: "Go live",
    confirm: "Take this site live?",
    next: "live",
  },
} as const

function SiteStatus({
  siteId,
  status,
  isOwner,
  homeIsLive,
}: {
  siteId: Id<"sites">
  status: Doc<"sites">["status"]
  isOwner: boolean
  homeIsLive: boolean
}) {
  const change = useMutation({
    mutationFn: useConvexMutation(api.sites.setStatus),
  })
  const copy = STATUS_COPY[status]

  return (
    <section className="flex flex-col gap-3 rounded-3xl border p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="font-medium">{copy.heading}</h2>
          <p className="text-sm text-muted-foreground">{copy.hint}</p>
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
                  {!homeIsLive &&
                    "The home page (/) isn't published yet, so visitors to it will see a not-found page. "}
                  Visitors will see your published pages within about a minute.
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

function ThemeEditor({
  siteId,
  saved,
}: {
  siteId: Id<"sites">
  saved: string
}) {
  const [theme, setTheme] = useState(saved)
  const save = useMutation({ mutationFn: useConvexAction(api.theme.save) })
  const unsaved = theme !== saved
  const failed = save.data?.ok === false ? save.data.message : undefined
  const alert = save.error ? errorMessage(save.error) : failed

  return (
    <form
      method="post"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({ siteId, theme })
      }}
      className="flex flex-col gap-4 rounded-3xl border p-6"
    >
      <div className="flex flex-col">
        <h2 className="font-medium">Theme</h2>
        <p className="text-sm text-muted-foreground">
          Tailwind CSS: <code>@theme</code> tokens and <code>@utility</code>{" "}
          classes, on top of Tailwind&apos;s defaults. Published pages pick up a
          new theme when they&apos;re next published.
        </p>
      </div>
      <textarea
        aria-label="Theme CSS"
        value={theme}
        onChange={(event) => {
          setTheme(event.target.value)
          if (save.data) save.reset()
        }}
        spellCheck={false}
        rows={12}
        placeholder={"@theme {\n  --color-brand: #2f3bff;\n}"}
        className="resize-y rounded-2xl border bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      {alert && (
        <p role="alert" className="text-sm text-destructive">
          {alert}
        </p>
      )}
      {save.data?.ok && !unsaved && (
        <p className="text-sm text-muted-foreground">Theme saved.</p>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={!unsaved || save.isPending}
        className="self-start"
      >
        {save.isPending ? "Saving…" : "Save theme"}
      </Button>
    </form>
  )
}
