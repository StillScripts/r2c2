import { useConvexAction, useConvexMutation } from "@convex-dev/react-query"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import type { FunctionReturnType } from "convex/server"
import { useState } from "react"
import { ConfirmButton } from "@/components/confirm-button"
import { PreviewFrame, usePreview } from "@/components/page-preview"
import { errorMessage } from "@/lib/errors"
import { when } from "@/lib/format"
import { parsePageParams } from "@/lib/params"
import {
  historyQuery,
  pageQuery,
  snapshotQuery,
  versionsQuery,
} from "@/lib/queries"

export const Route = createFileRoute(
  "/_authed/sites/$siteId/pages/$pageId_/history"
)({
  params: { parse: parsePageParams },
  loader: ({ context: { queryClient }, params: { siteId, pageId } }) =>
    Promise.all([
      queryClient.ensureQueryData(pageQuery(siteId, pageId)),
      queryClient.ensureQueryData(versionsQuery(siteId, pageId)),
      queryClient.ensureQueryData(historyQuery(siteId, pageId)),
    ]),
  component: PageHistory,
})

type Reason = FunctionReturnType<typeof api.pages.history>[number]["reason"]

const REASONS: Record<Reason, string> = {
  save: "Saved",
  publish: "Published",
  restore: "Before a restore",
  "ai-edit": "AI edit",
}

function PageHistory() {
  const { siteId, pageId } = Route.useParams()
  const { data: page } = useSuspenseQuery(pageQuery(siteId, pageId))

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <Link
          to="/sites/$siteId/pages/$pageId"
          params={{ siteId, pageId }}
          className="text-sm text-muted-foreground hover:underline"
        >
          Back to the editor
        </Link>
        <h1 className="text-2xl font-medium">
          History of {page.title}{" "}
          <span className="font-mono text-base text-muted-foreground">
            {page.path}
          </span>
        </h1>
      </div>
      <Versions
        siteId={siteId}
        pageId={pageId}
        liveVersionId={page.liveVersionId}
      />
      <DraftHistory siteId={siteId} pageId={pageId} />
    </main>
  )
}

type PageProps = { siteId: Id<"sites">; pageId: Id<"pages"> }

function Versions({
  siteId,
  pageId,
  liveVersionId,
}: PageProps & { liveVersionId?: Id<"pageVersions"> }) {
  const { data: versions } = useSuspenseQuery(versionsQuery(siteId, pageId))
  const rollback = useMutation({
    mutationFn: useConvexAction(api.publish.rollback),
  })

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Published versions</h2>
      {rollback.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(rollback.error)}
        </p>
      )}
      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This page hasn't been published yet.
        </p>
      ) : (
        <ul className="divide-y rounded-3xl border">
          {versions.map((version) => (
            <li
              key={version._id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span>
                {when(version.publishedAt)}
                <span className="text-muted-foreground">
                  {" "}
                  by {version.publishedBy}
                </span>
              </span>
              {version._id === liveVersionId ? (
                <span className="text-sm text-muted-foreground">Live</span>
              ) : (
                <ConfirmButton
                  variant="outline"
                  size="sm"
                  disabled={rollback.isPending}
                  title="Roll back to this version?"
                  description={`Visitors will see the version published ${when(version.publishedAt)} within a minute. Your draft stays as it is.`}
                  confirmLabel="Roll back"
                  onConfirm={() =>
                    rollback.mutate({ siteId, pageId, versionId: version._id })
                  }
                >
                  Roll back
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DraftHistory({ siteId, pageId }: PageProps) {
  const navigate = useNavigate()
  const { data: snapshots } = useSuspenseQuery(historyQuery(siteId, pageId))
  const [selected, setSelected] = useState(snapshots[0]?.ts)
  const { data: html = "" } = useQuery({
    ...snapshotQuery(siteId, pageId, selected ?? 0),
    enabled: selected !== undefined,
  })
  const preview = usePreview(siteId, html)
  const restore = useMutation({
    mutationFn: useConvexMutation(api.pages.restoreDraft),
    onSuccess: () =>
      navigate({
        to: "/sites/$siteId/pages/$pageId",
        params: { siteId, pageId },
      }),
  })

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Draft history</h2>
      {restore.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(restore.error)}
        </p>
      )}
      {snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Snapshots appear here as you save and publish.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <ul className="divide-y self-start rounded-3xl border">
            {snapshots.map((s) => (
              <li
                key={s.ts}
                className="flex items-center justify-between gap-2 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => setSelected(s.ts)}
                  aria-pressed={s.ts === selected}
                  className="text-left aria-pressed:font-medium"
                >
                  {when(s.ts)}
                  <span className="block text-sm text-muted-foreground">
                    {REASONS[s.reason]} by {s.author}
                  </span>
                </button>
                {s.ts === selected && (
                  <ConfirmButton
                    variant="outline"
                    size="sm"
                    disabled={restore.isPending}
                    title="Restore this draft?"
                    description="It replaces the current draft. The current draft is kept in history, so you can undo this."
                    confirmLabel="Restore"
                    onConfirm={() =>
                      restore.mutate({ siteId, pageId, ts: s.ts })
                    }
                  >
                    Restore
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
          <div className="h-[32rem]">
            <PreviewFrame preview={preview} fallback={html} />
          </div>
        </div>
      )}
    </section>
  )
}
