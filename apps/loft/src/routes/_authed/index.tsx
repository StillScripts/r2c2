import { useConvexMutation } from "@convex-dev/react-query"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { useEffect } from "react"
import { ActivityList } from "@/components/loft/home/activity-list"
import { CoreInput } from "@/components/loft/home/core-input"
import { Greeting } from "@/components/loft/home/greeting"
import { SiteRow } from "@/components/loft/home/site-row"
import { SuggestionChips } from "@/components/loft/home/suggestion-chips"
import { CONVERSATION_ENABLED } from "@/lib/flags"
import { suggestions, summaryLine } from "@/lib/home"
import { homeQuery, meQuery } from "@/lib/queries"

export const Route = createFileRoute("/_authed/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  staticData: { viewDim: "rgb(8 22 34 / 0.2)" },
  component: Home,
})

function Home() {
  const { data: me } = useSuspenseQuery(meQuery)
  const { data: overview } = useSuspenseQuery(homeQuery)
  const markSeen = useConvexMutation(api.home.markSeen)
  useEffect(() => {
    void markSeen({})
  }, [markSeen])

  const chips = suggestions(overview)

  return (
    <main className="mx-auto flex w-full max-w-260 flex-col gap-6.5 pt-[3vh]">
      <div className="flex flex-col gap-2.5">
        <Greeting name={me?.name ?? ""} />
        <p className="max-w-175 text-base leading-[1.45] text-white text-on-view sm:text-xl">
          {summaryLine(overview.summary)}
        </p>
      </div>
      {CONVERSATION_ENABLED ? (
        <CoreInput>
          <SuggestionChips chips={chips} />
        </CoreInput>
      ) : (
        <SuggestionChips chips={chips} onView />
      )}
      <div className="flex flex-wrap items-stretch gap-4">
        <ActivityList rows={overview.activity} />
        <section
          aria-labelledby="sites"
          className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 self-start rounded-3xl px-5 py-4 glass"
        >
          <h2
            id="sites"
            className="text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
          >
            Sites
          </h2>
          {overview.sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You aren&apos;t a member of any site yet.
            </p>
          ) : (
            overview.sites.map((site) => (
              <SiteRow key={site.siteId} site={site} />
            ))
          )}
        </section>
      </div>
    </main>
  )
}
