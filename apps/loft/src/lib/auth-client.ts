import { convexClient } from "@convex-dev/better-auth/client/plugins"
import type { AuthClient } from "@convex-dev/better-auth/react"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({ plugins: [convexClient()] })

// The component's AuthClient type infers `useSession().data` as never, so it rejects a real client
export const providerAuthClient = authClient as unknown as AuthClient
