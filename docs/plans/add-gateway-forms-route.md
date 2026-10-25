---
title: T21 Add the gateway forms route
depth: detailed
created: 2026-10-25
---

# T21 Add the gateway forms route

Accept `POST /_api/forms/:form` at the edge, check it, and forward it signed to Convex's enquiry intake (T19). This completes the enquiry path: `<site-form>` (T18) → edge → Convex.

## Context

- **SPEC §4/§5/§7:** the gateway rate-limits, checks size, checks Turnstile, derives the site from the hostname, validates with zod, signs and forwards. Responses: `201 { ok: true }`, `400 { ok: false, errors }`, `429`, `403` for a failed bot check. HTML form posts get a `303` to `?sent=<form>`. `/_api/*` is `no-store`.
- **What already exists:**
  - The gateway (`apps/edge/src/index.ts`) looks up `host:<hostname>` in KV and only allows `GET`/`HEAD`.
  - Core has `enquirySchema` (browser JSON body), `enquiryIntakeSchema` and `ENQUIRY_INTAKE_PATH` (edge → Convex), `MAX_ENQUIRY_BYTES`, `signedHeaders`, `API_HEADERS`.
  - Publish (T13) adds `sitekey` and a hidden `website` honeypot (`HONEYPOT_FIELD` in `packages/html`) to every form.
  - `<site-form>` posts JSON with `Accept: application/json`, the fields, `cf-turnstile-response` and `_source`. Without JavaScript the browser posts form-encoded fields, including the empty honeypot and no token.
  - Convex answers `201`, `400 { errors }`, `404` (unknown site), `429`, `401`/`503` (signing problems).
- **Worker env (SPEC §8, `apps/edge/.env.example`):** `R2C2_SIGNING_SECRET`, `TURNSTILE_SECRET`, `CONVEX_SITE_URL`.

## Approach

### Route

The gateway handles `POST /_api/forms/<name>` before its `GET`/`HEAD` check; any other method on that path is `405`. The steps run in order and stop at the first failure:

1. **Form name:** `<name>` must look like a form name (`[a-z0-9-]+`), otherwise `404`.
2. **Site:** the KV lookup the gateway already does. A site entry (live or coming-soon) gives the `siteId`; unknown or redirect hosts get `404`.
3. **Origin:** if an `Origin` header is present it must match the request's origin, otherwise `403`. This stops other sites posting into ours; the CSP's `form-action 'self'` covers our side.
4. **Size:** the body is read as bytes; over `MAX_ENQUIRY_BYTES` is `413`.
5. **Parse:** `application/json` is parsed with `enquirySchema` (token and `_source` required). `application/x-www-form-urlencoded` becomes a string record. Anything else is `415`. A parse failure is `400`.
6. **Bot check:**
   - **With a token** (JSON, or a form post from a page where JavaScript ran): Turnstile `siteverify` with `TURNSTILE_SECRET`, the token and `CF-Connecting-IP`. Failure is `403`.
   - **Without a token:** only form-encoded posts, and only when the `website` honeypot is present and empty. Otherwise `403`.
   - **Honeypot filled** on either path: answer as if it worked (`201` or `303`) but forward nothing, so bots learn nothing.
7. **Rate limit:** Workers Rate Limiting bindings keyed on `<siteId>:<ip>`. `FORMS_LIMIT` allows 10 a minute for verified posts; `FORMS_NOJS_LIMIT` allows 3 a minute for honeypot-only posts. Over the limit is `429`. Convex's per-site limit (T19) stays as the backstop.
8. **Forward:** strip `cf-turnstile-response`, `_source` and `website`. Build `{ form, data, source? }` (checked against `enquiryIntakeSchema`) and `POST` it to `CONVEX_SITE_URL + ENQUIRY_INTAKE_PATH` with `signedHeaders`.
9. **Answer:** Convex's `201`/`400`/`429` pass through. `404` from Convex is `404`. Anything else (`401`, `503`, network error) is logged and becomes `502`, so the visitor sees a general error.

### Response format

- **JSON callers** (`Accept` includes `application/json`): the `EnquiryResponse` body with the status above and `API_HEADERS`.
- **HTML form posts:**
  - success is `303` to the page the form was on, with `sent=<form>` added. The page is the `Referer` when it's same-origin, otherwise `/`.
  - errors get a small built-in HTML page with the status and a "go back" link; field errors are listed. These pages are `no-store`.

### Secrets and config

- `wrangler.jsonc` gets the two `ratelimits` bindings and `CONVEX_SITE_URL` as a var placeholder. `env.d.ts` gets `R2C2_SIGNING_SECRET`, `TURNSTILE_SECRET`, `CONVEX_SITE_URL` and the bindings.
- A missing secret or URL logs an error and returns `503`, like Convex does.

### Code layout

- `apps/edge/src/forms.ts`: the route handler and its helpers (parse, bot check, forward, answer).
- `apps/edge/src/index.ts`: dispatch `/_api/forms/` to it before the method check.

## Alternatives considered

- **Rate limiting in KV or a Durable Object:** KV is too slow and eventually consistent for counters; a Durable Object is more to run. The rate limiting binding is built for this, and Convex has its own per-site limit behind it.
- **Rejecting no-JS posts outright:** simpler, but breaks forms for visitors without JavaScript, which T18 promised to support.
- **Turnstile on the no-JS path through a `<noscript>` challenge:** Turnstile needs JavaScript, so the honeypot plus a tighter limit is the practical option.

## Scope

- In: the forms route, Turnstile check, honeypot, rate limit bindings, signing and forwarding, JSON and HTML responses, env typing, tests.
- Out:
  - the Loft enquiries inbox (T17) and email (T20)
  - a real end-to-end run against a local Convex. The task's done-when needs T17 for the inbox, so it moves to the outside review before T22.

## Action items

- [ ] Add the rate limit bindings and env typing; update `.env.example`
- [ ] Write `apps/edge/src/forms.ts` and dispatch to it from the gateway
- [ ] Tests below; run `vp check`, `vp test`, `vp run build`

## Testing

Workers tests through the gateway, with `fetch` stubbed for Turnstile `siteverify` and the Convex intake. The Convex stub verifies the signature with `verifyRequest` and records what it received.

- **JS post:** forwards `{ form, data, source }` without bot-check fields, signed; answers `201 { ok: true }`.
- **No-JS post:** with an empty honeypot it forwards without `source` and answers `303` to the referring page with `?sent=<form>`; without a honeypot it's `403`.
- **Bot checks:** a failed Turnstile check is `403`; a filled honeypot answers success and forwards nothing.
- **Guards:** unknown host `404`, bad form name `404`, foreign `Origin` `403`, oversize `413`, wrong content type `415`, bad JSON `400`, missing secret `503`.
- **Convex outcomes:** `400` field errors pass through as JSON and as an HTML list; `429` passes through; `500` becomes `502`.
- **Rate limit:** the no-JS limit trips before the JS one (if the local binding enforces limits in tests; otherwise the binding call is asserted).

## Risks

- **Rate limiting in local tests:** Miniflare's binding may not enforce limits. If not, the test checks the key and binding used, and the real limits are checked on the dev deployment.
- **`fetch` stubbing in Workers tests:** if stubbing the global doesn't reach the handler, Turnstile and Convex calls go through a small injectable `outbound` function instead.
- **Referer missing:** some browsers strip it; the redirect falls back to `/`, which still shows the site.

## Decisions

- No ADR: this follows SPEC §4/§5/§7 and the T18 decision on no-JS posts.
