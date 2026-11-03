import { Link } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"
import { File, Globe, Inbox } from "lucide-react"
import type { ReactNode } from "react"
import { ClientOnly } from "@/components/client-only"
import { shortWhen } from "@/lib/format"
import type { Overview } from "@/lib/home"

type Row = Overview["activity"][number]

const KINDS = {
  live: { icon: Globe, chip: "bg-live-tint text-live-text" },
  enquiry: { icon: Inbox, chip: "lamp" },
  draft: { icon: File, chip: "bg-fill-3 text-foreground" },
} as const

const ROW = "flex min-h-13 items-center gap-3 border-t border-fill-1 py-1.5"

function RowLink({ row, children }: { row: Row; children: ReactNode }) {
  if (row.kind === "enquiry") {
    return (
      <Link
        to="/sites/$siteId/enquiries"
        params={{ siteId: row.siteId }}
        search={{ status: "new" }}
        className={ROW}
      >
        {children}
      </Link>
    )
  }
  if (row.pageId) {
    return (
      <Link
        to="/sites/$siteId/pages/$pageId"
        params={{ siteId: row.siteId, pageId: row.pageId }}
        className={ROW}
      >
        {children}
      </Link>
    )
  }
  return <div className={ROW}>{children}</div>
}

/** "Lately": what happened on your sites, written as outcomes. */
export function ActivityList({ rows }: { rows: Row[] }) {
  return (
    <section
      aria-labelledby="lately"
      className="flex min-w-0 flex-[999_1_520px] flex-col gap-1 rounded-3xl px-5 py-4.5 glass"
    >
      <h2
        id="lately"
        className="pb-2 text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
      >
        Lately
      </h2>
      {rows.length === 0 ? (
        <p className="border-t border-fill-1 py-3 text-sm text-muted-foreground">
          Nothing yet. Publish a page and it shows up here.
        </p>
      ) : (
        <ul>
          {rows.map((row) => {
            const { icon: Icon, chip } = KINDS[row.kind]
            return (
              <li key={`${row.kind}:${row.siteId}:${row.title}:${row.at}`}>
                <RowLink row={row}>
                  <span
                    className={cn(
                      "grid size-7.5 shrink-0 place-items-center rounded-full",
                      chip
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4"
                      strokeWidth={1.9}
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px]">{row.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <ClientOnly>{shortWhen(row.at)}</ClientOnly>
                  </span>
                </RowLink>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
