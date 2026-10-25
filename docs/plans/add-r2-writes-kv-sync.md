---
title: T12 Add R2 writes and KV sync
depth: detailed
created: 2026-10-25
---

# T12 Add R2 writes and KV sync

Connect Convex to the edge's storage. Convex writes objects to the R2 bucket the Worker serves from, through `@convex-dev/r2`. Whenever a site's domains or status change, it rewrites that site's `host:<hostname>` entries in the `ROUTES` KV namespace through Cloudflare's REST API. Owners get the first domain mutations, and a self-check action proves an object round-trips through R2 on a real deployment.

## Context

- SPEC §5 defines the KV contract: `host:<hostname>` maps to `{ site, status }` for a primary domain and `{ redirect }` for a redirect. `packages/core` already exports `routeKey`, `RouteEntry`/`routeEntrySchema`, the R2 key builders and `normaliseHost`.
- SPEC §8 lists the Convex secrets: `R2_*` (per `@convex-dev/r2`), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_ACCOUNT_ID`.
- T09 is in place:
  - the `domains` table (`hostname`, `kind` primary/redirect, `status` pending/active);
  - `siteMutation` with `role: "owner"`, `ownDoc` and `audit`;
  - the seed, which creates `r2c2.localhost` and `www.r2c2.localhost`.
- ADR-008 makes the site ID the Convex document ID, so dev and production IDs differ. The schema cleanup task notes that each environment needs its own bucket and namespace.
- ADR-006 sets the error style: `ConvexError` with a `code` for user-facing failures.
- T13 (publish) is the main caller of the R2 writes. T12 provides the storage layer and proves it, not the publish flow.
- This container has no Cloudflare credentials. Unit tests mock the network. The real round trip runs on your dev deployment once its secrets are set.

## Approach

### R2 (`convex/convex.config.ts`, `convex/storage.ts`)

- Install the component with `app.use(r2)`. `storage.ts` exports one `r2 = new R2(components.r2)`, configured from the `R2_*` environment variables.
- `putObject(ctx, key, body, contentType)` is a thin wrapper over `r2.store` that T13 calls with keys from `packages/core` (`versionKey`, `liveKey`, `assetKey`, `elementsKey`). Response headers stay the Worker's job (SPEC §5), so objects carry only their content type.
- `storage.check` is an internal action, run with `vp run --filter @workspace/backend r2:check`. It writes `_check/<random>.txt`, reads it back through `r2.getUrl`, deletes it and returns `{ ok: true }`. It throws a `ConvexError` naming whatever step failed, such as a missing env var or a denied write.

### KV sync (`convex/routes.ts`)

- **`routeEntries(site, domains)`** is a pure function returning one row per hostname: either a `RouteEntry` or `null`, meaning delete.
  - An active primary gives `{ site: site._id, status: site.status }`.
  - An active redirect gives `{ redirect: "https://<active primary hostname>" }`, or `null` if the site has no active primary.
  - A pending domain gives `null`.
  - It's typed against `RouteEntry` from core.
- **`routes.sync`** is an internal action that takes `{ siteId, version, removed?: string[], attempt? }`.
  - It loads the site and its domains through an internal query and computes the entries.
  - It makes at most two Cloudflare calls: `PUT …/storage/kv/namespaces/{ns}/bulk` for the entries to write, and `POST …/bulk/delete` for the `null` rows plus `removed` hostnames. Both use `Authorization: Bearer $CLOUDFLARE_API_TOKEN`.
  - **Stale deletes:** `removed` is filtered against the current `domains` rows, across every site, before deleting. A delayed retry therefore never deletes a hostname that was added again in the meantime. If the site no longer exists, the surviving `removed` hostnames are still deleted.
  - **Out-of-order runs:** each mutation that schedules a sync bumps a `routesVersion` counter on the site, a new optional field. A run whose `version` is older than the site's current one does nothing, because a newer run is queued. The check happens right before writing, which leaves only a tiny window for an older run to finish after a newer one.
  - **Failures:** a non-2xx response, or a 2xx with Cloudflare's `success: false`, is a failure. There are five attempts in total: the first, then retries after 5 s, 30 s, 2 min and 10 min. After that it logs the error and gives up, so a Cloudflare outage can't loop forever.
  - **No credentials:** if the `CLOUDFLARE_*` variables aren't set (local or test deployments), the run logs a skip and exits, with no retries.
  - It rewrites the site's entries in full on every run, so it's idempotent.
- **Triggers:** every mutation that changes what KV should hold schedules `routes.sync` with `runAfter(0)` in the same transaction. That way a change can't commit without its sync being queued.

### Domain and site mutations (`convex/domains.ts`, `convex/sites.ts`)

- **`domains.list`** (member) lists the site's domains.
- **`domains.add`** (owner) takes `{ hostname, kind }`.
  - **Normalising:** the input is parsed as `new URL("https://" + input)` and normalised with core's `normaliseHost`, which takes a `URL` and lowercases the hostname, strips the port and the trailing dot.
  - **Validating:** the result must match a hostname pattern of dot-separated labels, each 1–63 characters of `a-z0-9-` that don't start or end with `-`, at most 253 characters in total, and ending in a letters-only TLD, so IP addresses fail. `*.localhost` passes for dev. Inputs with a path, query, `@` or anything else besides a host and an optional port fail too. All of these are `invalid_hostname`.
  - A hostname that already exists on any site is `hostname_taken`.
  - A second primary on the same site is `primary_exists`.
  - New domains are `active` in milestone 1. `pending` arrives with client domains through Cloudflare for SaaS.
  - It's audited.
- **`domains.remove`** (owner) loads the domain through `ownDoc` and deletes it. It schedules a sync with the hostname in `removed`, and it's audited. Removing a primary while the site still has redirects is refused with `primary_has_redirects`, so redirects never silently stop resolving. Remove the redirects first, or add the new primary before removing the old one. (`primary_exists` blocks having two primaries, so changing the primary means removing the redirects first.)
- **`sites.setStatus`** (owner) switches between `live` and `coming-soon`, is audited and schedules a sync.
- **The seed** schedules a sync every time it runs, including for an already-seeded deployment.

### Environment

- `packages/backend/.env.example` and the README list the eight secrets with the `npx convex env set` commands.
- Each Convex deployment gets its own bucket and namespace: dev uses `r2c2-sites-dev` and a dev `ROUTES` namespace, and production uses `r2c2-sites`.
- The Cloudflare API token needs only **Workers KV Storage: Edit** on the account.

## Alternatives considered

- **Workers KV through a Worker endpoint (Convex → signed request → Worker writes KV):** it reuses the signing scheme, but it adds a route, a deploy dependency and a second hop for an admin-only write. The REST API is direct.
- **One KV write per domain change instead of a full rewrite of the site:** it's cheaper per call, but it needs ordering logic. A primary hostname change, for example, invalidates every redirect. Rewriting a site's few entries is simpler and self-healing.
- **The `@convex-dev/action-retrier` component for retries:** it's sturdier, but it's another component for one call site. Rescheduling with an attempt counter is about 10 lines. Revisit if T13's purge retries want the same thing.
- **Writing R2 with the AWS SDK directly:** SPEC §2 pins `@convex-dev/r2`, which also keeps object metadata in Convex.

## Scope

- In:
  - the R2 component, `putObject` and `storage.check`
  - `routeEntries` and `routes.sync` with retries
  - `domains.list`, `domains.add` and `domains.remove`
  - `sites.setStatus`
  - the seed scheduling a sync
  - env docs and tests
  - the schema cleanup task (added on this PR)
- Out:
  - the publish flow and purge (T13)
  - client domains, certificates and `pending` handling (Cloudflare for SaaS, later)
  - the Loft UI for domains (T15+)
  - making the local `wrangler dev` see remote KV (T07/T23)

## Action items

- [x] Add `@convex-dev/r2` (0.10.4) to the catalog and `packages/backend`; add `convex/convex.config.ts`
- [x] Write `storage.ts`: `r2`, `putObject` and the `check` action, plus an `r2:check` script
- [x] Write `routes.ts`: `routeEntries`, an internal query for site and domains, and the `sync` action with bulk PUT/delete and retries
- [x] Write `domains.ts` (`list`, `add`, `remove`) and `sites.setStatus`, each scheduling a sync and writing an audit entry
- [x] Make the seed schedule a sync
- [x] Tests: `routeEntries` cases, mutation validation and errors, sync calls (mocked `fetch`), and retry scheduling. `putObject` is left to `r2:check`, because faking the component's signed S3 upload wasn't worth it for a one-line wrapper. `convex/_generated/api.d.ts` was updated by hand (new modules plus `components.r2`), since codegen needs a configured deployment; `convex dev` regenerates the same output
- [x] Update `.env.example`, the README and SPEC §8 (one bucket and namespace per environment)
- [x] Add `tasks/someday/clean-up-convex-schema.md`
- [x] Run `vp check`, `vp test` and `vp run build`

## Testing

convex-test suites with `fetch` stubbed:

- `routeEntries`: a primary only, a primary with redirects, a redirect with no primary, pending domains, and a `coming-soon` site.
- `domains.add`/`remove`:
  - a hostname with a port and capitals is normalised;
  - garbage and paths are refused;
  - a hostname taken on another site is refused;
  - a second primary is refused;
  - editors are `forbidden` and non-members `not_found`;
  - removing a primary that still has redirects is refused;
  - each change is audited, bumps `routesVersion` and schedules exactly one sync.
- `routes.sync`:
  - the bulk PUT body, the bulk delete keys (including `removed`), the auth header and the URL;
  - a re-added hostname isn't deleted;
  - a stale `version` skips;
  - missing env vars skip;
  - a non-2xx response or `success: false` reschedules with the next delay;
  - it gives up after the fifth attempt.
- `putObject`: register the component with `@convex-dev/r2/test` and stub the S3 `PUT` that `r2.store` makes from an action. If the component's upload can't be faked cleanly in convex-test, drop this unit test and rely on `r2:check` against the dev deployment.

On the dev deployment, after the secrets are set:

- `vp run --filter @workspace/backend r2:check` returns `{ ok: true }`;
- adding a domain shows `host:<hostname>` in the dev namespace (`wrangler kv key get`).

## Risks

- **A KV write lands but its delete is lost:** the full rewrite on the next change heals it. A manual `routes.sync` run (`convex run routes:sync`) fixes it immediately.
- **The Cloudflare API token is too broad:** document the single KV Edit permission, and keep the token only in Convex env (SPEC §7).
- **Concurrent syncs for one site:** the `routesVersion` check makes an older run skip, so only the newest run writes, apart from the small window between its check and its write. Any later change resyncs everything.
- **Bulk endpoint limits** (10,000 keys or 100 MB per call): far beyond one site's domains.

## Decisions

- No ADR: this follows SPEC §2 (`@convex-dev/r2`) and §5/§8, with no new long-lived choices. Revisit if the retries move to a component.
