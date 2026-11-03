import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
  useRouter,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { LoftView } from "@/components/loft/loft-view"
import { ShellHeader } from "@/components/loft/shell-header"
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
  // The deepest screen that asks for a dim gets it
  const dim = useMatches({
    select: (matches) =>
      matches
        .map((match) => match.staticData.viewDim)
        .filter(Boolean)
        .at(-1),
  })

  async function signOut() {
    await authClient.signOut()
    await router.navigate({ to: "/sign-in" })
  }

  useEffect(() => {
    if (!me) void signOut()
  }, [me])

  if (!me) return null

  return (
    <div className="flex min-h-svh flex-col gap-4 px-4 pt-5 pb-4.5 sm:gap-5 sm:px-6 sm:py-5.5">
      <LoftView view={me.view} dim={dim} />
      <ShellHeader me={me} onSignOut={signOut} />
      <Outlet />
    </div>
  )
}
