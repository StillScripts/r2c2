import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { cn } from "@workspace/ui/lib/utils"
import { card, screen } from "@/lib/layout"
import { meQuery } from "@/lib/queries"

export const Route = createFileRoute("/_authed/")({ component: Sites })

function Sites() {
  const sites = useSuspenseQuery(meQuery).data?.sites ?? []

  return (
    <main className={cn(screen, "max-w-2xl")}>
      <h1 className="font-serif text-4xl">Your sites</h1>
      {sites.length === 0 ? (
        <p className="text-muted-foreground">
          You aren&apos;t a member of any site yet.
        </p>
      ) : (
        <ul className={cn("divide-y", card)}>
          {sites.map((site) => (
            <li key={site.siteId}>
              <Link
                to="/sites/$siteId"
                params={{ siteId: site.siteId }}
                className="flex items-center justify-between px-4 py-3 hover:bg-fill-2"
              >
                <span>{site.name}</span>
                <span className="text-sm text-muted-foreground capitalize">
                  {site.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
