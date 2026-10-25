import { useConvexAction, useConvexMutation } from "@convex-dev/react-query"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useBlocker } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import { Button } from "@workspace/ui/components/button"
import type { FunctionReturnType } from "convex/server"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { errorMessage } from "@/lib/errors"
import { parsePageParams } from "@/lib/params"
import { previewDocument } from "@/lib/preview"
import { pageQuery } from "@/lib/queries"

const PREVIEW_DELAY_MS = 400

type Preview = FunctionReturnType<typeof api.preview.preview> & {
  html: string
}

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

  const [draft, setDraft] = useState(page.draftHtml)
  const preview = usePreview(siteId, draft)
  const srcDoc = useMemo(
    () => previewDocument(preview?.html ?? page.draftHtml, preview?.css ?? ""),
    [preview, page.draftHtml]
  )
  const unsaved = draft !== page.draftHtml

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
          <Link
            to="/sites/$siteId"
            params={{ siteId }}
            className="text-sm text-muted-foreground hover:underline"
          >
            Pages
          </Link>
          <h1 className="truncate text-lg font-medium">
            {page.title}{" "}
            <span className="font-mono text-sm text-muted-foreground">
              {page.path}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {saveDraft.error ? (
            <span role="alert" className="text-destructive">
              {errorMessage(saveDraft.error)}
            </span>
          ) : (
            unsaved && (
              <span className="text-muted-foreground">Unsaved changes</span>
            )
          )}
          <Button onClick={save} disabled={!unsaved || saveDraft.isPending}>
            {saveDraft.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <textarea
            aria-label="Page HTML"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none rounded-2xl border bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <Issues preview={preview} />
        </div>
        <iframe
          title="Preview"
          sandbox=""
          srcDoc={srcDoc}
          className="h-full min-h-80 w-full rounded-2xl border bg-white"
        />
      </div>
    </main>
  )
}

/** The latest preview for the draft, fetched once typing pauses. Stale responses are dropped. */
function usePreview(siteId: Id<"sites">, html: string) {
  const runPreview = useConvexAction(api.preview.preview)
  const [preview, setPreview] = useState<Preview>()
  const latest = useRef(0)

  useEffect(() => {
    const request = ++latest.current
    const timer = setTimeout(() => {
      runPreview({ siteId, html }).then(
        (result) =>
          request === latest.current && setPreview({ ...result, html }),
        () => {}
      )
    }, PREVIEW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [runPreview, siteId, html])

  return preview
}

function Issues({ preview }: { preview?: Preview }) {
  const issues = [
    ...(preview?.errors.map((issue) => ({ ...issue, error: true })) ?? []),
    ...(preview?.warnings.map((issue) => ({ ...issue, error: false })) ?? []),
  ]
  if (issues.length === 0) return null
  return (
    <ul className="max-h-40 overflow-auto rounded-2xl border p-3 text-sm">
      {issues.map((issue) => (
        <li
          key={`${issue.rule}:${issue.line}:${issue.column}:${issue.message}`}
          className={issue.error ? "text-destructive" : "text-muted-foreground"}
        >
          Line {issue.line}: {issue.message}
        </li>
      ))}
    </ul>
  )
}
