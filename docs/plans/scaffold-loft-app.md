---
title: T14 Connect the Loft to Convex and sign-in
depth: detailed
created: 2026-10-25
---

# T14 Connect the Loft to Convex and sign-in

Connect `apps/loft` to the Convex backend through `@convex-dev/react-query`, and to the
staff sign-in from T10 through Better Auth's React client. Signed-out visitors only reach
`/sign-in`. A signed-in member lands on `/`, which lists their sites from `staff:me`.

## Context

- `apps/loft` is a bare TanStack Start app: `src/router.tsx`, `src/routes/__root.tsx` and
  a placeholder `src/routes/index.tsx`. `@workspace/ui` has only `Button`.
- T10 runs Better Auth inside Convex (`packages/backend/convex/auth.ts`), with routes
  registered on the `.convex.site` HTTP router. CORS was left off on purpose, because
  the Loft calls those routes through its own server. `SITE_URL`, the Loft's origin, is
  Better Auth's `baseURL`.
- `staff:me` (`packages/backend/convex/staff.ts`) already returns the signed-in user's
  name, email and sites (`siteId`, `name`, `role`), or `null` when signed out. The Loft
  imports the API from `@workspace/backend/api`.
- `@convex-dev/better-auth` 0.12.5 ships `react-start` (`convexBetterAuthReactStart`: a
  `handler` that proxies `/api/auth/*` to `CONVEX_SITE_URL` and a `getToken` that reads
  the request cookies on the server) and `react` (`ConvexBetterAuthProvider`). It sets
  `x-better-auth-forwarded-host`, so cookies are issued for the Loft's origin.
- SPEC §2 pins `@tanstack/react-query` 5.104.5 and `@convex-dev/react-query` 0.1.0.
  `@tanstack/react-router-ssr-query` 1.167.3 supports router 1.170.46 and react-query
  5.104.
- `apps/loft/.env.example` already has `VITE_CONVEX_URL` and `CONVEX_SITE_URL`.
- Better Auth's `baseURL` is the deployment's `SITE_URL`, so it must equal the Loft's
  origin: `http://localhost:3000` in dev, which matches `vp dev --port 3000`. The backend
  README already says so, and the Loft README repeats it.
- ADR-010: the Loft deploys to Cloudflare Workers later, so server code avoids Node-only
  APIs.

## Approach

**Clients (`src/router.tsx`).** `getRouter()` makes a `ConvexQueryClient` from
`VITE_CONVEX_URL` with `expectAuth: true` (no unauthenticated queries go out before the
token arrives), and a `QueryClient` whose `queryKeyHashFn` and `queryFn` come from it,
then calls `convexQueryClient.connect(queryClient)`. The router gets
`{ queryClient, convexQueryClient }` as context, and `setupRouterSsrQueryIntegration`
streams query data from the server render to the client.

**Auth plumbing (`src/lib/`).**

- `auth-client.ts`: `createAuthClient({ plugins: [convexClient()] })` from
  `better-auth/react`. It has no `baseURL`, so it calls the Loft's own `/api/auth`.
- `auth-server.ts`: `convexBetterAuthReactStart({ convexUrl, convexSiteUrl })`, reading
  `VITE_CONVEX_URL` and `CONVEX_SITE_URL` from `process.env`. It exports `handler` and
  `getToken`.
- `src/routes/api/auth/$.ts`: a server route whose `GET` and `POST` pass the request to
  `handler`.

**Root route (`__root.tsx`).** It moves to `createRootRouteWithContext`. `beforeLoad`
calls a `getAuth` server function (`createServerFn` → `getToken()`). During the server
render it hands the token to `convexQueryClient.serverHttpClient`, so SSR queries run as
the user. It returns `{ token }` into the route context. The root
component wraps the outlet in `ConvexBetterAuthProvider` with the Convex client,
`authClient` and `initialToken`, so the browser's websocket starts authenticated with no
flash.

**Routes.**

- `/sign-in`: email and password form calling `authClient.signIn.email`. On success it
  calls `router.invalidate()` and navigates to `redirect` (a validated search param,
  default `/`). Its `beforeLoad` sends visitors who are already signed in to `/`. Errors
  show inline: wrong password, and `Something went wrong` for anything else. No sign-up
  link, since sign-up is closed (ADR-009).
- `_authed` (pathless layout): `beforeLoad` redirects to `/sign-in?redirect=<href>` when
  there is no token. Its loader prefetches `convexQuery(api.staff.me, {})`.
  It renders a small header with the user's email from that query and a **Sign out**
  button: `authClient.signOut()`, then `router.invalidate()`, then go to `/sign-in`. If
  `me` comes back `null` (a stale cookie whose token no longer verifies), the layout
  signs out and redirects to `/sign-in` the same way.
- `_authed/index.tsx` (`/`): reads the same cached `me` query with `useSuspenseQuery`
  and lists sites by name and role, or shows "You aren't a member of any site yet" for
  an empty list.
- The 404 page stays public.

Because the Convex client uses `expectAuth: true`, a query sent while signed out waits
for a token instead of failing. Only routes under `_authed` run Convex queries.

Sign-out is a button in the signed-in layout rather than its own page. A `/sign-out`
route that signs out when it loads would fire on link preload (`defaultPreload: "intent"`).
The button is the "sign-out page" the task asks for.

**UI.** Add `Input` and `Label` to `@workspace/ui` in the `base-rhea` style, so the form
uses shared components. The shadcn registry was unreachable from the agent session, so
they were written by hand to match `Button`. Card-like layout with plain Tailwind.

**Dependencies.** Catalog pins for `@tanstack/react-query` 5.104.5,
`@convex-dev/react-query` 0.1.0 and `@tanstack/react-router-ssr-query` 1.167.3. `loft`
adds those plus `convex`, `better-auth`, `@convex-dev/better-auth` and
`@workspace/backend`.

## Alternatives considered

- Better Auth's `crossDomain` plugin, with the browser calling `.convex.site` directly:
  needs CORS and trusted origins on the backend, cookies on a third-party domain, and no
  SSR token. T10 already chose the proxy.
- Client-only auth (no `getToken` in `beforeLoad`): simpler, but every signed-in page
  first renders signed out, and the redirect guard can't run on the server.
- Plain `convex/react` `useQuery` without react-query: SPEC §2 locks
  `@convex-dev/react-query`, and route loaders need the query client for SSR.

## Scope

- In: dependencies and catalog pins; router, root route and providers; the auth proxy
  route; `/sign-in`, the signed-in layout with sign-out, and the sites list on `/`;
  `Input` and `Label` in `@workspace/ui`; `.env.example` notes and a short Loft README;
  tests for the pure helpers.
- Out: opening a site or any editor UI (later tasks), creating staff from the Loft,
  password reset and social sign-in (`add-social-sign-in-and-verification`), Workers
  deploy config (`deploy-to-production`), and backend changes.

## Action items

- [x] Pin the three new packages in `pnpm-workspace.yaml` and add the dependencies to
      `apps/loft/package.json`. Run `vp install`.
- [x] Add `Input` and `Label` to `packages/ui` (by hand: the shadcn registry was
      blocked in the agent session).
- [x] Add `src/lib/auth-client.ts`, `src/lib/auth-server.ts` and the
      `src/routes/api/auth/$.ts` proxy route.
- [x] Rework `src/router.tsx` for the Convex and query clients, router context and SSR
      query integration.
- [x] Rework `__root.tsx`: context type, `getAuth` server function in `beforeLoad`, and
      `ConvexBetterAuthProvider`.
- [x] Add `/sign-in`, the `_authed` layout with sign-out, and the sites list at `/`.
      Remove the old placeholder index.
- [x] Keep the redirect target safe: only same-origin paths starting with `/` are
      accepted. Put that in a small helper and unit test it.
- [x] Document the Loft's env and how to run it locally (`apps/loft/README.md`, and
      `.env.example` comments).
- [x] Run `vp check`, `vp test` and `vp run build`. Start `vp dev` and check that `/`
      redirects to `/sign-in` and the form renders.

## Testing

- `vp test`: a unit test for the redirect helper (accepts `/`, `/x?y`; rejects
  `//evil.com`, `https://…`, `javascript:` and empty values, falling back to `/`).
- `vp run build` proves the server route, server function and SSR bundle compile.
- Manual in this session: `vp dev` against a stub `.convex.site` server showed `/`
  redirecting to `/sign-in?redirect=%2F`, `/api/auth/*` reaching the stub, and in
  Chromium a wrong password showing "Wrong email or password." The form posts with
  `method="post"`, so a submit before hydration never puts the password in the URL.
- Manual on a real dev deployment (needs Convex credentials this session doesn't have):
  sign in with an account from `staff:create` and see the seed site listed, reload and
  stay signed in, sign out and land on `/sign-in`, and get an inline error for a wrong
  password. Listed in the PR as a reviewer check.

## Risks

- **No Convex deployment in the agent session**, so sign-in can't be checked end to end
  here. Mitigation: follow the component's documented TanStack Start setup closely, and
  list the manual check in the PR.
- **`process.env` on Workers.** `auth-server.ts` reads `process.env`, which Workers only
  provide with `nodejs_compat`. Mitigation: it's fine for `vp dev`, and the deploy task
  sets the flag (already noted in ADR-010).
- **Version drift** between `@tanstack/react-router-ssr-query` 1.167.3 and router
  1.170.46. Its peer range allows it. If types clash, fall back to wiring
  `dehydrate`/`hydrate` by hand.

## Open questions

- The task slug `scaffold-loft-app` predates the task's current title. It's kept as the
  shared id for the task, plan and branch, rather than renamed mid-flight.

## Decisions

No new ADR. The proxy-through-the-Loft shape was settled in T10's plan, and the libraries
are locked in SPEC §2.
