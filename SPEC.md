# R2C2 spec

R2C2 (React + R2, Convex + Cloudflare) is an open-source architecture for running many websites from one Cloudflare Worker. Pages are written in the R2C2 Loft (a React app), frozen to plain HTML in R2 at publish time, and served from Cloudflare's edge, so a visit almost never runs our code. Convex holds sites, drafts, versions and enquiries, but it is never in the path that serves a page.

This file is the reference for every task in `tasks/`. Read the sections a task points to before starting it.

## 1. Milestone 1

**Goal:** a public repo that hosts the R2C2 marketing site on R2C2 itself, published from the Loft, and takes enquiries through its contact form.

In scope:

- Monorepo, tooling and CI
- Edge Worker: domain → site → cached page, assets, signed purge, `/_api` forms route
- Convex backend: sites, domains, pages, versions, enquiries, audit log, publish pipeline to R2
- Loft: sign-in, sites, pages, HTML editor with preview, publish, versions, rollback, enquiries inbox
- `<site-form>` element and the enquiry path end to end, with email notification
- The marketing site as the first real site, live on its own domain

**The Loft** is the app where people manage their sites. It should feel elegant, simple, clean and calm: a quiet place to get something done, with nothing competing for attention. In practice that means generous whitespace, one primary action per screen, a live preview next to whatever you're editing, and no dashboards full of numbers. Over time the main way in becomes a conversation (typed or spoken), with the same tools the MCP server exposes.

Out of scope for milestone 1 (see section 11): AI editing, MCP, draft preview links, client custom domains through Cloudflare for SaaS, live-data tags, bookings, payments, docs site.

## 2. Locked decisions

| Area            | Decision                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Language        | TypeScript everywhere. No Rust.                                                                                           |
| Package manager | pnpm 12 workspaces, versions pinned once in the pnpm catalog                                                              |
| Toolchain       | Vite+ (`vite-plus`): `vp dev`, `vp build`, `vp check` (format, lint, type check), `vp test`, `vp run` for workspace tasks |
| TypeScript      | 7.x                                                                                                                       |
| Loft            | TanStack Start (React), Tailwind v4, shadcn components on Base UI, Convex React with `@convex-dev/react-query`            |
| Auth            | Better Auth through `@convex-dev/better-auth`, staff only in milestone 1                                                  |
| Backend         | Convex: schema, functions, publish pipeline, R2 writes, email                                                             |
| Storage         | Cloudflare R2, one bucket, Oceania location hint                                                                          |
| Serving         | One Cloudflare Worker: gateway entrypoint (every request) and renderer entrypoint (behind Workers Cache)                  |
| Routing table   | Cloudflare KV: hostname → site                                                                                            |
| Email           | `@convex-dev/resend`                                                                                                      |
| Validation      | zod schemas in `packages/core` for anything crossing a network boundary; Convex validators inside Convex                  |
| Public pages    | No framework. Finished HTML plus one small shared script for custom elements                                              |

Pinned versions at the time of writing (check with `vp outdated` before T01, keep exact pins in the catalog):

```yaml
react: 19.3.1
react-dom: 19.3.1
"@tanstack/react-start": 1.169.4
"@tanstack/react-router": 1.170.46
"@tanstack/react-query": 5.104.5
convex: 1.48.0
convex-helpers: 0.1.129
"@convex-dev/react-query": 0.1.0
"@convex-dev/better-auth": 0.12.5
better-auth: ~1.6.33 # @convex-dev/better-auth allows <1.7.0
"@convex-dev/r2": 0.10.4
"@convex-dev/resend": 0.2.10
"@convex-dev/rate-limiter": 0.4.2
"@convex-dev/table-history": 0.1.6 # beta
"@base-ui/react": 1.9.0
tailwindcss: 4.3.3
"@tailwindcss/vite": 4.3.3
"@vitejs/plugin-react": 6.1.2
vite-plus: 1.4.0
typescript: 7.0.2
wrangler: 4.152.0
zod: 4.6.7
sanitize-html: 2.18.1
```

Known compatibility notes:

- `pnpm-workspace.yaml` needs `overrides: { "vite@*": "npm:@voidzero-dev/vite-plus-core@1.4.0" }`, `peerDependencyRules.allowedVersions: { vite: "*", "better-auth>vitest": "5" }` and `allowBuilds: { esbuild: true }`. pnpm 11+ ignores the `pnpm` field in `package.json`.
- `@cloudflare/vitest-pool-workers` is deprecated and renamed `@cloudflare/vitest-plugin`, which supports Vitest 5. `apps/edge` runs its Workers runtime tests through that plugin under `vp test`, alongside everything else. Keep Worker logic in `packages/core` as pure functions where possible.

## 3. Repo layout

```
r2c2/
├─ apps/
│  ├─ loft/              TanStack Start + React: the Loft, the product
│  └─ edge/              Cloudflare Worker: gateway, renderer, /_api
├─ packages/
│  ├─ backend/           convex/: schema, functions, publish pipeline
│  ├─ core/              contracts shared by edge and backend
│  ├─ html/              sanitise, element IDs, form registry, Tailwind compile
│  ├─ elements/          <site-form> and future custom elements
│  └─ ui/                shadcn components on Base UI for the Loft
├─ sites/
│  └─ r2c2/              source HTML of the marketing site (seed content)
├─ docs/                 plans/ and decisions/ (ADRs)
├─ tasks/                one file per task, folder = status
├─ pnpm-workspace.yaml
├─ vite.config.ts        root Vite+ config: lint, format, test for all
├─ AGENTS.md
└─ SPEC.md
```

Internal packages ship as source (`exports` point at `src`) and are consumed with `workspace:*`. No build step for internal packages.

## 4. How it works

**Serving a page**

1. The site's domain points at Cloudflare and reaches the Worker.
2. The gateway lowercases the host, strips the port and trailing dot, normalises the path, and drops tracking parameters (`utm_*`, `gclid`, `fbclid`).
3. The gateway reads `host:<hostname>` from KV. Unknown host: 404. Redirect entry: 301. `coming-soon`: holding page.
4. The gateway calls the renderer entrypoint with `props: { siteId }`. Workers Cache keys on path plus props, so sites never share entries. A hit returns here.
5. On a miss, the renderer reads `sites/<siteId>/live/<path>/index.html` from R2 and returns it with the headers in section 5.

**Publishing a page** (Convex action)

1. Check the house rules (section 12) and stop with readable errors if any fail. Sanitise the HTML, add stable `data-r2c2-id` attributes to elements, and record each `<site-form>` and its fields.
2. Compile the page's Tailwind with the site's theme in-process (`tailwindcss` `compile()`), hash it.
3. Write `versions/<hash>.html` and `assets/<cssHash>.css`, then copy the version to `live/<path>/index.html`.
4. Mark the version live in Convex, call the Worker's signed purge route with the page's tag, write an audit entry.
5. If the purge fails, retry through the Convex scheduler. Always write R2 before purging.

Rollback is the same steps 3 to 5 with an older version.

**Taking an enquiry**

1. `<site-form>` wraps a real `<form method="post" action="/_api/forms/<name>">`, so it works without JavaScript.
2. The gateway rate-limits, checks size, checks Turnstile, derives `siteId` from the hostname, validates the body against the zod schema, and signs the request.
3. A Convex HTTP action verifies the signature, checks the fields against that form's registry from publish, stores the enquiry through an internal mutation, and schedules an email.

## 5. Contracts (`packages/core`)

**KV routing entries**

```jsonc
// key: host:r2c2.dev
// site: the Convex `sites` document ID (ADR-008)
{ "site": "k17f3ana2bs2vfzvjxh5a1tsss8gzwng", "status": "live" }  // status: live | coming-soon
// key: host:www.r2c2.dev
{ "redirect": "https://r2c2.dev" }
```

**R2 keys**

```
sites/<siteId>/live/<path>/index.html     current page, one read per miss
sites/<siteId>/versions/<hash>.html       every publish, immutable
sites/<siteId>/assets/<hash>.<ext>        CSS, JS, images, immutable
sites/<siteId>/404.html                   per-site not-found page
shared/elements/<hash>.js                 custom elements script
```

Path rules: `/` → `index.html`; `/about` and `/about/` → `about/index.html`; lowercase; no `..`.

**Response headers**

| Response      | Cache-Control                                                  | Other                                                                                                |
| ------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Page HTML     | `public, max-age=0, s-maxage=60, stale-while-revalidate=86400` | `cache-tag: site-<id>,page-<pageId>`, `etag: "<hash>"`, CSP, HSTS, `x-content-type-options: nosniff` |
| Hashed assets | `public, max-age=31536000, immutable`                          |                                                                                                      |
| `/_api/*`     | `no-store`                                                     |                                                                                                      |
| 404           | `public, max-age=0, s-maxage=60`                               |                                                                                                      |

CSP for pages: `default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data:; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`.

**Signed requests (Worker → Convex)**

- Header `x-r2c2-signature: t=<unix seconds>,v1=<hex HMAC-SHA256>` over `t + "\n" + siteId + "\n" + method + "\n" + path + "\n" + sha256(body)`.
- Header `x-r2c2-site: <siteId>`.
- Convex rejects missing, invalid, or older than 60 seconds. Use Web Crypto on both sides. One shared secret, `R2C2_SIGNING_SECRET`, in Worker secrets and Convex env.
- The purge route uses the same scheme in the other direction (Convex → Worker).

**Enquiry API**

- `POST /_api/forms/:form`, JSON or form-encoded, max 32 KB.
- Body: declared fields plus `cf-turnstile-response` and `_source` (`{ page, referrer, utm }`, filled by the element).
- Responses: `201 { ok: true }`, `400 { ok: false, errors }`, `429`, `403` for failed bot check. HTML form posts get a 303 to `?sent=<form>` on the same page, so only the form that was sent confirms.

## 6. Data model (Convex, milestone 1)

| Table          | Key fields                                                                            | Indexes               |
| -------------- | ------------------------------------------------------------------------------------- | --------------------- |
| `sites`        | name, slug, status, theme (Tailwind `@theme` tokens and `@utility` component classes) | by_slug               |
| `domains`      | siteId, hostname, kind (`primary` \| `redirect`), status (`pending` \| `active`)      | by_hostname, by_site  |
| `pages`        | siteId, path, title, draftHtml, liveVersionId                                         | by_site_path          |
| `pageVersions` | siteId, pageId, hash, cssHash, forms, publishedBy, publishedAt                        | by_page               |
| `forms`        | siteId, name, fields (name, type, required, maxLength)                                | by_site_name          |
| `enquiries`    | siteId, form, data, source, status (`new` \| `handled`), createdAt                    | by_site_created       |
| `memberships`  | userId (`identity.subject`), siteId, role (`owner` \| `editor`)                       | by_user_site, by_site |
| `auditLog`     | siteId, actor, action, target, at                                                     | by_site_at            |

Indexes on site-owned tables start with `siteId`. Every function that touches site data goes through a `siteQuery` / `siteMutation` helper (convex-helpers custom functions) that loads the site and checks membership; a site the caller isn't a member of is `not_found`, the same as a missing one. Any other document ID a function takes is loaded through `ownDoc()`, which refuses documents from another site.

**Draft history.** The official `@convex-dev/table-history` component is attached to `pages` as `pageHistory`. It's in beta, so call it only through one helper, `recordDraft()`, which keeps it easy to swap.

- Record a snapshot when an AI edit is applied, before a publish, before a restore, and on a manual save if the last snapshot is more than five minutes old. Never on every keystroke.
- Restoring writes the old snapshot back as the current draft, which is itself recorded, so a restore can be undone.
- Published versions stay in `pageVersions` and R2; draft history never replaces them.
- Check how the component handles retention before launch, and prune old snapshots if storage grows.

## 7. Security rules

- The site comes from the hostname at the edge. Never trust a site ID sent by a browser.
- Public sites call no public Convex functions. `/_api` routes map to HTTP actions that verify the signature and call internal functions.
- Validate at the edge (zod) and again in Convex.
- Sanitise every published page: no `<script>` except the platform elements script, no inline event handlers, no `javascript:` URLs, allow-listed tags and attributes.
- Rate limit `/_api` per IP and per site at the edge, and again per site in Convex with the rate limiter component.
- Writes carry idempotency keys. Enquiries dedupe on (site, form, body hash, 10-minute window).
- Secrets live only where used: Resend key and R2 credentials in Convex; signing secret in both; Turnstile secret in the Worker.
- Every publish, rollback and enquiry status change writes an audit entry.
- Loft functions check the signed-in user's membership for the site on every call.

## 8. Environments and secrets

| Where  | Name                                                                                                                           | Purpose                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Worker | `SITES` (R2 binding), `ROUTES` (KV binding)                                                                                    | storage and routing           |
| Worker | `R2C2_SIGNING_SECRET`, `TURNSTILE_SECRET`, `CONVEX_SITE_URL`                                                                   | signing, bot check, backend   |
| Convex | `R2C2_SIGNING_SECRET`, `EDGE_PURGE_URL`                                                                                        | signing, purge                |
| Convex | `R2_*` (per `@convex-dev/r2`), `RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_ACCOUNT_ID` | storage, email, KV sync       |
| Convex | `BETTER_AUTH_SECRET`, `SITE_URL`                                                                                               | Loft auth                     |
| CLI    | `CONVEX_DEPLOYMENT` (local `.env.local` only)                                                                                  | which deployment the CLI uses |
| Loft   | `VITE_CONVEX_URL`, `CONVEX_SITE_URL`                                                                                           | backend                       |

Commit `.env.example` files only. Environments: local (Convex dev deployment, `wrangler dev`), preview per PR later, production.

## 9. Working rules

**Branches and PRs**

- Run each task with the `handle-task` skill, which follows the naming conventions in `AGENTS.md`: one task, one branch, from an up-to-date `master`, and the task moves to `tasks/done/` in the same PR.
- Small commits. List the task's "Done when" criteria in the PR as a checklist.
- CI must pass: `vp check`, `vp test` and `vp run build`. Squash merge. Delete the branch.

**Definition of done**

- Acceptance criteria met and ticked in the PR.
- Tests cover the behaviour, not the implementation.
- No new lint, format or type errors.
- New env vars added to `.env.example` and section 8.
- Contracts changed only in `packages/core`, with both sides updated in the same PR.

**Review checkpoints.** Pause for an outside review (a fresh Claude session given repo access) after T08 (edge serving), T13 (publish pipeline) and T21 (enquiry path).

## 10. Things to prove early (T05 spike)

Workers Cache launched in July 2026. Before building on it, confirm:

1. Passing `siteId` as `props` from the gateway isolates cache entries across hostnames.
2. `ctx.cache.purge({ tags })` called from the renderer clears the page in every location.
3. `s-maxage` is honoured separately from `max-age`.

If any fails, fall back to the Cache API (`caches.default` with `Cache-Tag`) and zone-level purge by tag. Either way, record the decision as an ADR in `docs/decisions/`.

## 11. Later specs (outlines)

**Draft previews.** `/_draft/<token>/<path>` on the site's own domain, served by the gateway from R2 `sites/<siteId>/drafts/<draftId>/…`. Signed, expiring tokens; `Cache-Control: no-store`; `X-Robots-Tag: noindex, nofollow`; never in sitemaps.

**AI editing in the Loft.** Select an element by `data-r2c2-id`, prompt, receive a patch for that element only, review a before/after, apply to the draft. Uses the site's theme tokens and allowed tags as context. Server-side validation returns readable errors the model can fix.

**MCP server.** A `/mcp` route on the Loft (Streamable HTTP) calling the same Convex functions as the Loft. OAuth through Better Auth's MCP plugin (client identity via CIMD). Note: `@better-auth/mcp` tracks Better Auth 1.7, while `@convex-dev/better-auth` allows only <1.7, so wait for that range to widen or run auth separately. Tools: `list_sites`, `list_pages`, `get_page`, `edit_element`, `preview_draft`, `publish_draft` (flagged destructive), `rollback_page`, `list_enquiries`. Resources: design tokens and allowed tags. Treat enquiry text as untrusted data in tool results.

**Client domains.** Cloudflare for SaaS custom hostnames created from the Loft, CNAME to the fallback hostname, KV entry written when the certificate is active. Apex domains need CNAME flattening, a `www` redirect, or the Enterprise apex proxying add-on. Check Turnstile's hostname limits per widget.

**Live-data tags.** `<site-hours>`, `<site-listings>`: a cached data entrypoint (60 s, purge by `data-<key>` tag) and HTMLRewriter in the renderer. Pages that bake site data republish automatically when it changes.

**Bookings.** `<site-booking>`: slots from `/_api/availability` (cached 30 s), holds and confirmations as Convex mutations so double-booking is impossible, optional Stripe deposit, calendar sync.

**Payments.** Stripe Connect, each business a connected account, optional platform fee. `<site-buy>` asks Convex to create a Checkout session with server-side prices. Stripe webhooks go straight to a Convex HTTP action that verifies Stripe's signature.

**Docs site.** Markdown in `docs/`, published through R2C2 as its own site.

**Templates.** Copy what's content, reference what's design.

- Referenced, so one change updates every page: the theme, component classes, shared parts placed with `<site-part name="header">` and filled in at publish, and collection templates (one item template filled from data, such as listings or staff).
- Copied, so the page owns its HTML afterwards: sections (hero, services, team, testimonials, FAQ, contact) and page starters.
- Site kits bundle a theme, parts, sections and starter pages, such as a dental clinic kit. They live in the repo as plain folders: `kits/<name>/` with `theme.css`, `parts/`, `sections/`, `pages/` and `kit.json`, so the community can contribute them.
- The AI gets the site's kit and the house rules as context on every edit. The MCP server exposes the same kit as resources.
- In the Loft this stays nearly invisible: "Start from a kit" for a new site, a few starters for a new page, and one small theme panel with a live preview.

## 12. HTML house rules

Every page is checked at publish in `packages/html`, whether it came from a person, the Loft's AI or an MCP client. A failure stops the publish and returns specific, fixable messages with line numbers, such as: `Line 12: bg-[#1f5b8a] isn't a theme colour. Use bg-brand.`

- Only allowed tags, attributes and platform custom tags. No scripts, inline event handlers or `style` attributes.
- Colours, fonts, radius and shadows come only from the site's theme tokens. No arbitrary values such as `bg-[#1f5b8a]` or `font-[Georgia]`.
- Prefer the site's component classes (`btn`, `card`, `section`, `prose`) over long utility strings, so a rebrand is a theme change.
- Images come from the site's media in R2, never hotlinked, and have alt text.
- One `h1` per page, headings in order, labelled form fields, descriptive link text.
- Every page has a title and description. The canonical URL is added automatically.
- Fonts are self-hosted. No third-party requests from a page.
- A size limit per page (start at 500 KB of HTML).

An HTML linter such as html-validate can cover structure and accessibility; the theme and class checks are our own rules on top.
