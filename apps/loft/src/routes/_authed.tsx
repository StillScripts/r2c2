import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useEffect } from "react"
import { LocalTime } from "@/components/loft/local-time"
import { LoftView } from "@/components/loft/loft-view"
import { ViewSwitcher } from "@/components/loft/view-switcher"
import { authClient } from "@/lib/auth-client"
import { meQuery } from "@/lib/queries"

export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context, location }) => {
    if (!context.token) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } })
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: AuthedLayout,
})

function AuthedLayout() {
  const router = useRouter()
  const { data: me } = useSuspenseQuery(meQuery)

  async function signOut() {
    await authClient.signOut()
    await router.navigate({ to: "/sign-in" })
  }

  useEffect(() => {
    if (!me) void signOut()
  }, [me])

  if (!me) return null

  return (
    <div className="flex min-h-svh flex-col gap-3 p-3">
      <LoftView view={me.view} />
      <header className="flex h-14 items-center justify-between gap-4 rounded-full px-5 glass">
        <span className="font-serif text-2xl">Loft</span>
        <div className="flex items-center gap-3 text-sm">
          <ViewSwitcher view={me.view} />
          <LocalTime />
          <span className="hidden text-muted-foreground md:inline">
            {me.email}
          </span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <div className="rounded-3xl glass">
        <Outlet />
      </div>
    </div>
  )
}
