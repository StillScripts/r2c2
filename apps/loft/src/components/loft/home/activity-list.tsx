import { ClientOnly, Link } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"
import { File, Globe, Inbox } from "lucide-react"
import { shortWhen } from "@/lib/format"
import { type Activity, activityRow } from "@/lib/home"
import { HomePanel } from "./home-panel"

const ICONS = {
  live: { icon: Globe, chip: "bg-live-tint text-live-text" },
  enquiry: { icon: Inbox, chip: "lamp" },
  draft: { icon: File, chip: "bg-fill-3 text-foreground" },
} as const

const ROW = "flex min-h-13 items-center gap-3 border-t border-fill-1 py-1.5"

/** "Lately": what happened on your sites, written as outcomes. */
export function ActivityList({ rows }: { rows: Activity[] }) {
  return (
    <HomePanel id="lately" title="Lately" className="flex-[999_1_520px] gap-1">
      {rows.length === 0 ? (
        <p className="border-t border-fill-1 py-3 text-sm text-muted-foreground">
          Nothing yet. Publish a page and it shows up here.
        </p>
      ) : (
        <ul>
          {rows.map((row) => {
            const { icon, title, detail, link } = activityRow(row)
            const { icon: Icon, chip } = ICONS[icon]
            const content = (
              <>
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
                  <span className="truncate text-[15px]">{title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {detail}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <ClientOnly>{shortWhen(row.at)}</ClientOnly>
                </span>
              </>
            )
            return (
              <li key={`${row.siteId}:${title}:${row.at}`}>
                {link ? (
                  <Link {...link} className={ROW}>
                    {content}
                  </Link>
                ) : (
                  <div className={ROW}>{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </HomePanel>
  )
}
