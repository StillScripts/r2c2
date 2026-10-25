import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { betterAuth } from "better-auth/minimal"
import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import authConfig from "./auth.config"

export const authComponent = createClient<DataModel>(components.betterAuth)

/**
 * Better Auth for the Loft's staff: email and password, with public sign-up closed
 * (ADR-009). Only `staff:create` passes `signUp: true`.
 */
export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { signUp = false }: { signUp?: boolean } = {}
) =>
  betterAuth({
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: true, disableSignUp: !signUp },
    plugins: [convex({ authConfig })],
  })
