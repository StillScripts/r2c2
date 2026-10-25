import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { meQuery } from "@/lib/queries"

export const Route = createFileRoute("/_authed/")({ component: Sites })

function Sites() {
  const sites = useSuspenseQuery(meQuery).data?.sites ?? []

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium">Your sites</h1>
      {sites.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          You aren&apos;t a member of any site yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y rounded-3xl border">
          {sites.map((site) => (
            <li key={site.siteId}>
              <Link
                to="/sites/$siteId"
                params={{ siteId: site.siteId }}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted"
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
