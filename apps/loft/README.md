# Loft

Where staff sign in and work on their sites: TanStack Start, talking to the Convex
backend in `packages/backend` through `@convex-dev/react-query`.

## Running it

Copy `.env.example` to `.env.local` and fill in your Convex dev deployment's two URLs
(the Convex dashboard lists both):

- `VITE_CONVEX_URL`, the `.convex.cloud` URL the browser connects to
- `CONVEX_SITE_URL`, the `.convex.site` URL the Loft's server calls for sign-in

```bash
vp run dev   # from the repo root: the Loft on http://localhost:3000, the edge and convex dev
```

The deployment's `SITE_URL` must be the Loft's origin, `http://localhost:3000` in dev, or
Better Auth refuses the sign-in. Create an account with `staff:create` (see the backend
README), then sign in.

The Loft runs in workerd through `@cloudflare/vite-plugin`, both in dev and when built
(`wrangler.jsonc`). `vp preview` serves the built Worker locally, with the same
`.env.local`.

## Deploying

Production is the `r2c2-loft` Worker at its `workers.dev` address, kept off `lofty.page`
(ADR-015). GitHub Actions runs `vp run deploy` after CI passes on `master`. The build
inlines `VITE_CONVEX_URL` for the browser, and the server reads both URLs from the
Worker's secrets. See [`docs/deploy.md`](../../docs/deploy.md).

## Sign-in

Better Auth runs in Convex. The browser never calls Convex's auth routes directly:
`src/routes/api/auth/$.ts` passes `/api/auth/*` on to `CONVEX_SITE_URL`, so the session
cookies belong to the Loft. On every navigation the root route reads a Convex token from
those cookies on the server (`src/lib/auth-server.ts`), so server-rendered queries run as
the user and the browser's client starts signed in.

Signed-out visitors only reach `/sign-in`. Every other page lives under the `_authed`
layout, which redirects to `/sign-in?redirect=…`. The Convex client waits for a token
before it sends a query, so only routes under `_authed` should run Convex queries.

## Pages

`/sites/$siteId` lists a site's pages and creates new ones. `/sites/$siteId/pages/$pageId`
is the HTML editor: the draft on the left, and a sandboxed `srcdoc` iframe on the right
with no scripts. The CSS comes from the `preview:preview` action, called 400 ms after
typing stops, which also returns the house-rule errors and warnings. Save (or ⌘/Ctrl+S)
writes the draft; nothing is published.

## Publishing and history

The editor's **Publish** button saves any unsaved changes, asks for confirmation, then
runs `publish:publish`; house-rule errors show under the editor, and a published page is
live within a minute. **History** (`/sites/$siteId/pages/$pageId/history`) lists the
page's published versions, with rollback, and its draft snapshots, with a preview and
restore. Restoring keeps the replaced draft in history, so it can be undone.
