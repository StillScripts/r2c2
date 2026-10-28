import { useConvexAction, useConvexMutation } from "@convex-dev/react-query"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useBlocker } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useEffectEvent, useState } from "react"
import { CodeTextarea } from "@/components/code-textarea"
import { ConfirmButton } from "@/components/confirm-button"
import { Issues, PreviewFrame, usePreview } from "@/components/page-preview"
import { errorMessage } from "@/lib/errors"
import { parsePageParams } from "@/lib/params"
import { pageQuery } from "@/lib/queries"

export const Route = createFileRoute("/_authed/sites/$siteId/pages/$pageId")({
  params: { parse: parsePageParams },
  loader: ({ context, params: { siteId, pageId } }) =>
    context.queryClient.ensureQueryData(pageQuery(siteId, pageId)),
  component: PageEditor,
})

function PageEditor() {
  const { siteId, pageId } = Route.useParams()
  const { data: page } = useSuspenseQuery(pageQuery(siteId, pageId))
  const saveDraft = useMutation({
    mutationFn: useConvexMutation(api.pages.saveDraft),
  })
  const runPublish = useConvexAction(api.publish.publish)
  const publish = useMutation({
    mutationFn: async () => {
      if (unsaved)
        await saveDraft.mutateAsync({ siteId, pageId, draftHtml: draft })
      return runPublish({ siteId, pageId })
    },
  })

  const [draft, setDraft] = useState(page.draftHtml)
  const preview = usePreview(siteId, draft)
  const unsaved = draft !== page.draftHtml
  const failedPublish = publish.data?.ok === false ? publish.data : undefined
  const error = saveDraft.error ?? publish.error
  const alert = error
    ? errorMessage(error)
    : failedPublish && "Fix the errors below to publish."
  const status = unsaved
    ? "Unsaved changes"
    : publish.data?.ok && "Published. It's live within a minute."
  const issues = failedPublish ?? preview

  function save() {
    if (unsaved && !saveDraft.isPending) {
      saveDraft.mutate({ siteId, pageId, draftHtml: draft })
    }
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault()
      save()
    }
  })
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useBlocker({
    shouldBlockFn: () =>
      unsaved && !window.confirm("Leave without saving your changes?"),
    enableBeforeUnload: unsaved,
  })

  return (
    <main className="flex h-[calc(100svh-3.5rem)] flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex gap-3 text-sm text-muted-foreground">
            <Link
              to="/sites/$siteId"
              params={{ siteId }}
              className="hover:underline"
            >
              Pages
            </Link>
            <Link
              to="/sites/$siteId/pages/$pageId/history"
              params={{ siteId, pageId }}
              className="hover:underline"
            >
              History
            </Link>
          </div>
          <h1 className="truncate text-lg font-medium">
            {page.title}{" "}
            <span className="font-mono text-sm text-muted-foreground">
              {page.path}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {alert ? (
            <span role="alert" className="text-destructive">
              {alert}
            </span>
          ) : (
            status && <span className="text-muted-foreground">{status}</span>
          )}
          <Button
            variant="outline"
            onClick={save}
            disabled={!unsaved || saveDraft.isPending}
          >
            {saveDraft.isPending ? "Saving…" : "Save"}
          </Button>
          <ConfirmButton
            disabled={publish.isPending}
            title="Publish this page?"
            description={
              <>
                {unsaved && "Your changes will be saved first. "}
                Visitors to <span className="font-mono">{page.path}</span> will
                see this draft within a minute.
              </>
            }
            confirmLabel="Publish"
            onConfirm={() => publish.mutate()}
          >
            {publish.isPending ? "Publishing…" : "Publish"}
          </ConfirmButton>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <CodeTextarea
            aria-label="Page HTML"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              if (publish.data) publish.reset()
            }}
            className="min-h-0 flex-1 resize-none"
          />
          <Issues errors={issues?.errors} warnings={issues?.warnings} />
        </div>
        <PreviewFrame preview={preview} fallback={page.draftHtml} />
      </div>
    </main>
  )
}
