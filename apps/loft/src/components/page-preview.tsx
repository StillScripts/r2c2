import { useConvexAction } from "@convex-dev/react-query"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import type { FunctionReturnType } from "convex/server"
import { useMemo } from "react"
import { useDebouncedResult } from "@/lib/debounced-result"
import { previewDocument } from "@/lib/preview"

type Preview = FunctionReturnType<typeof api.preview.preview> & {
  html: string
}

export type Issue = Preview["errors"][number]

/** The latest preview for the HTML, fetched once typing pauses. */
export function usePreview(siteId: Id<"sites">, html: string) {
  const runPreview = useConvexAction(api.preview.preview)
  return useDebouncedResult(html, async () => ({
    ...(await runPreview({ siteId, html })),
    html,
  }))
}

/** A sandboxed, script-free frame showing the previewed HTML with its compiled CSS. */
export function PreviewFrame({
  preview,
  fallback,
}: {
  preview?: { html: string; css: string }
  fallback: string
}) {
  const srcDoc = useMemo(
    () => previewDocument(preview?.html ?? fallback, preview?.css ?? ""),
    [preview, fallback]
  )
  return (
    <iframe
      title="Preview"
      sandbox=""
      srcDoc={srcDoc}
      className="h-full min-h-80 w-full rounded-2xl border bg-white"
    />
  )
}

export function Issues({
  errors = [],
  warnings = [],
}: {
  errors?: Issue[]
  warnings?: Issue[]
}) {
  const issues = [
    ...errors.map((issue) => ({ ...issue, error: true })),
    ...warnings.map((issue) => ({ ...issue, error: false })),
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
