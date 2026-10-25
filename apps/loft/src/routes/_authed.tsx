import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useEffect } from "react"
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
    <div className="min-h-svh">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <span className="font-medium">Loft</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{me.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
