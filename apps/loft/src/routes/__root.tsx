import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import type { ConvexQueryClient } from "@convex-dev/react-query"
import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"

import appCss from "@workspace/ui/globals.css?url"
import { providerAuthClient } from "@/lib/auth-client"
import { getToken } from "@/lib/auth-server"

const getAuth = createServerFn({ method: "GET" }).handler(() => getToken())

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  beforeLoad: async ({ context }) => {
    const token = await getAuth()
    if (token) context.convexQueryClient.serverHttpClient?.setAuth(token)
    return { token }
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "R2C2 Loft",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { convexQueryClient, token } = Route.useRouteContext()
  return (
    <ConvexBetterAuthProvider
      client={convexQueryClient.convexClient}
      authClient={providerAuthClient}
      initialToken={token}
    >
      <Outlet />
    </ConvexBetterAuthProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
