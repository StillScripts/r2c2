import { useConvexAction } from "@convex-dev/react-query"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Input } from "@workspace/ui/components/input"
import type { FunctionReturnType } from "convex/server"
import { type FormEvent, useState } from "react"
import { CodeTextarea } from "@/components/code-textarea"
import { Issues, PreviewFrame } from "@/components/page-preview"
import { useDebouncedResult } from "@/lib/debounced-result"
import { useEditorGuards } from "@/lib/editor-guards"
import { errorMessage } from "@/lib/errors"
import { fullHeight } from "@/lib/layout"
import { parseSiteParams } from "@/lib/params"
import { pageQuery, pagesQuery, siteQuery } from "@/lib/queries"
import {
  addColour,
  hexColour,
  isColourName,
  readColours,
  setColour,
} from "@/lib/theme-colours"

export const Route = createFileRoute("/_authed/sites/$siteId/theme")({
  params: { parse: parseSiteParams },
  loader: async ({ context, params: { siteId } }) => {
    const [site] = await Promise.all([
      context.queryClient.ensureQueryData(siteQuery(siteId)),
      context.queryClient.ensureQueryData(pagesQuery(siteId)),
    ])
    if (site.role !== "owner") {
      throw redirect({ to: "/sites/$siteId", params: { siteId } })
    }
  },
  component: ThemePanel,
})

function ThemePanel() {
  const { siteId } = Route.useParams()
  const { data: site } = useSuspenseQuery(siteQuery(siteId))
  const { data: pages } = useSuspenseQuery(pagesQuery(siteId))
  const [theme, setTheme] = useState(site.theme)
  const [pageId, setPageId] = useState(
    (pages.find((page) => page.path === "/") ?? pages[0])?._id
  )
  const saveTheme = useMutation({
    mutationFn: useConvexAction(api.theme.save),
  })
  const preview = useThemePreview(siteId, theme, pageId)
  const unsaved = theme !== site.theme
  const problem =
    saveTheme.data?.ok === false ? saveTheme.data.message : preview.problem
  const alert = saveTheme.error ? errorMessage(saveTheme.error) : problem
  const status = unsaved
    ? "Unsaved changes"
    : saveTheme.data?.ok && "Theme saved."

  function edit(next: string) {
    setTheme(next)
    if (saveTheme.data) saveTheme.reset()
  }

  function save() {
    if (unsaved && !saveTheme.isPending) saveTheme.mutate({ siteId, theme })
  }

  useEditorGuards({ unsaved, save })

  return (
    <main className={cn("flex flex-col gap-3 p-4", fullHeight)}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/sites/$siteId"
            params={{ siteId }}
            className="text-sm text-muted-foreground hover:underline"
          >
            {site.name}
          </Link>
          <h1 className="text-lg font-medium">Theme</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {status && <span className="text-muted-foreground">{status}</span>}
          <Button onClick={save} disabled={!unsaved || saveTheme.isPending}>
            {saveTheme.isPending ? "Saving…" : "Save theme"}
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-3">
          <ColourTokens theme={theme} onChange={edit} />
          <CodeTextarea
            aria-label="Theme CSS"
            value={theme}
            onChange={(event) => edit(event.target.value)}
            placeholder={"@theme {\n  --color-brand: #2f3bff;\n}"}
            className="min-h-40 flex-1 resize-none"
          />
          {alert && (
            <p role="alert" className="text-sm text-destructive">
              {alert}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Tailwind CSS: <code>@theme</code> tokens and <code>@utility</code>{" "}
            classes, on top of Tailwind&apos;s defaults. Published pages pick up
            a new theme when they&apos;re next published.
          </p>
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          {pageId ? (
            <>
              <select
                aria-label="Preview page"
                value={pageId}
                onChange={(event) =>
                  setPageId(event.target.value as Id<"pages">)
                }
                className="h-9 self-start rounded-4xl border bg-transparent px-3 text-sm"
              >
                {pages.map((page) => (
                  <option key={page._id} value={page._id}>
                    {page.title} ({page.path})
                  </option>
                ))}
              </select>
              <div className="min-h-0 flex-1">
                <PreviewFrame preview={preview.shown} fallback={preview.html} />
              </div>
              <Issues
                errors={preview.shown?.errors}
                warnings={preview.shown?.warnings}
              />
            </>
          ) : (
            <p className="text-muted-foreground">
              Create a page to preview the theme on it.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

type ThemePreview = Extract<
  FunctionReturnType<typeof api.theme.preview>,
  { ok: true }
> & { html: string }

/** A page's draft previewed with the unsaved theme, keeping the last one that compiled on screen. */
function useThemePreview(
  siteId: Id<"sites">,
  theme: string,
  pageId: Id<"pages"> | undefined
) {
  const { data: page } = useQuery({
    ...pageQuery(siteId, pageId!),
    enabled: pageId !== undefined,
  })
  const html = page?.draftHtml
  const runPreview = useConvexAction(api.theme.preview)
  const result = useDebouncedResult(
    html === undefined ? undefined : `${html}\0${theme}`,
    async () => ({
      ...(await runPreview({ siteId, theme, html: html! })),
      html: html!,
    })
  )
  const [shown, setShown] = useState<ThemePreview>()
  if (result?.ok && result !== shown) setShown(result)
  return {
    shown,
    html: html ?? "",
    problem: result?.ok === false ? result.message : undefined,
  }
}

function ColourTokens({
  theme,
  onChange,
}: {
  theme: string
  onChange: (theme: string) => void
}) {
  const colours = readColours(theme)
  return (
    <section className="flex max-h-[45%] flex-col gap-2 overflow-auto rounded-2xl border p-3">
      <h2 className="text-sm font-medium">Colours</h2>
      {colours.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {colours.map(({ name, value }) => (
            <li key={name} className="flex items-center gap-2">
              <ColourSwatch
                label={`${name} colour`}
                value={value}
                onChange={(next) => onChange(setColour(theme, name, next))}
              />
              <span className="w-28 truncate font-mono text-sm" title={name}>
                {name}
              </span>
              <Input
                aria-label={`${name} value`}
                value={value}
                onChange={(event) =>
                  onChange(setColour(theme, name, event.target.value))
                }
                className="font-mono"
              />
            </li>
          ))}
        </ul>
      )}
      <AddColour
        taken={colours.map(({ name }) => name)}
        onAdd={(name, value) => onChange(addColour(theme, name, value))}
      />
    </section>
  )
}

/** A colour input for hex values, or a plain swatch for anything a colour input can't hold. */
function ColourSwatch({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const hex = hexColour(value)
  const className = "size-8 shrink-0 rounded-lg border"
  return hex ? (
    <input
      type="color"
      aria-label={label}
      value={hex}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  ) : (
    <span
      role="img"
      aria-label={label}
      style={{ background: value }}
      className={className}
    />
  )
}

function AddColour({
  taken,
  onAdd,
}: {
  taken: string[]
  onAdd: (name: string, value: string) => void
}) {
  const [name, setName] = useState("")
  const [value, setValue] = useState("#000000")
  const valid = isColourName(name) && !taken.includes(name)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid) return
    onAdd(name, value)
    setName("")
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <ColourSwatch label="New colour" value={value} onChange={setValue} />
      <Input
        aria-label="New colour name"
        placeholder="brand-soft"
        value={name}
        onChange={(event) => setName(event.target.value.trim())}
        className="font-mono"
      />
      <Button type="submit" variant="outline" disabled={!valid}>
        Add colour
      </Button>
    </form>
  )
}
