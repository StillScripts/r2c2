import { Link } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"
import { SiteBadge } from "@/components/loft/site-badge"
import type { Overview } from "@/lib/home"

/** A site on Home: its badge, name, address and whether it's live. */
export function SiteRow({ site }: { site: Overview["sites"][number] }) {
  const live = site.status === "live"
  return (
    <Link
      to="/sites/$siteId"
      params={{ siteId: site.siteId }}
      className="flex items-center gap-2.5 rounded-2xl py-1"
    >
      <SiteBadge name={site.name} brand={site.brand} className="size-7.5" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px]">{site.name}</span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {site.address}
        </span>
      </span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs",
          live ? "text-live-text" : "text-muted-foreground"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-1.75 rounded-full",
            live ? "bg-live" : "bg-fill-3"
          )}
        />
        {live ? "Live" : "Coming soon"}
      </span>
    </Link>
  )
}
