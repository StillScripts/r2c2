---
title: T19 Add enquiry intake in Convex
depth: detailed
created: 2026-10-25
---

# T19 Add enquiry intake in Convex

Give Convex an HTTP endpoint that accepts enquiries forwarded by the edge.

- **Verify:** it checks the edge's signature.
- **Validate:** it checks the fields against the form registry that publish maintains.
- **Protect:** it rate-limits per site and drops duplicates.
- **Store:** it saves each enquiry through an internal mutation.

Public sites never call Convex directly (SPEC §7); this endpoint is the only way in.

## Context

- **Signing (SPEC §5):** the Worker signs each request with `x-r2c2-signature: t=<s>,v1=<hex HMAC>` over `t\nsiteId\nMETHOD\npath\nsha256(body)`, plus `x-r2c2-site`. The signature must be under 60 s old.
- **Code that already exists:**
  - `packages/core` has `verify()`, `SITE_HEADER`, `MAX_ENQUIRY_BYTES`, `EnquirySource` and `EnquiryResponse`;
  - the backend has the `forms` registry (`by_site_name`, fields: name, type, required, maxLength), the `enquiries` table, `fail()`/error codes, and convex-test.
- **SPEC §7 rules that apply here:**
  - validate at the edge and again in Convex;
  - rate limit per site in Convex with the rate limiter component (`@convex-dev/rate-limiter` 0.4.2, pinned in SPEC §2);
  - dedupe on (site, form, body hash, 10-minute window).
- **T18/T21 decision:** a no-JS form post has no Turnstile token and no `_source`. The edge (T21) accepts it when the honeypot is empty and forwards it without `_source`, so `source` becomes optional on stored enquiries.
- **Callers:** the edge's forms route (T21) is the only caller. Email (T20) will be scheduled from the store mutation, so T19 leaves a clear hook for it.
- **Secret:** `R2C2_SIGNING_SECRET` is on the Convex deployment (SPEC §8).

## Approach

### Contract (`packages/core/src/enquiry.ts`)

- `ENQUIRY_INTAKE_PATH = "/api/enquiries"` is the signed path, shared by the edge and Convex.
- `enquiryIntakeSchema` (zod) is the body the edge forwards: `{ form: string, data: Record<string, string>, source?: EnquirySource }`. The edge strips `cf-turnstile-response`, the honeypot and `_source` out of the browser's body before signing. So Convex never sees bot-check fields, and the browser contract (`enquirySchema`) stays separate from the edge-to-Convex one.

### HTTP action (`convex/http.ts`, `convex/enquiries.ts`)

`POST /api/enquiries` runs these steps in order, stopping at the first failure:

1. **Size:** a body larger than `MAX_ENQUIRY_BYTES` gets `413`.
2. **Signature:** `verify(R2C2_SIGNING_SECRET, { siteId: header, method: "POST", path: ENQUIRY_INTAKE_PATH, body: rawBody }, signatureHeader)`. A missing or wrong signature, or one older than 60 s, gets `401` with no detail. A missing secret logs an error and returns `503`.
3. **Parse:** the body goes through `enquiryIntakeSchema`. Failure gets `400 { ok: false, errors }`.
4. **Store:** it calls the internal mutation `enquiries.receive({ siteId, form, data, source, bodyHash })`. That returns either `{ ok: true }`, which includes duplicates, or one of the error codes below. The action maps each to a status:

| Result                                                           | Status                      |
| ---------------------------------------------------------------- | --------------------------- |
| stored, or duplicate                                             | `201 { ok: true }`          |
| `unknown_site` (site ID not a valid `sites` ID, or no such site) | `404`                       |
| `invalid` (field errors)                                         | `400 { ok: false, errors }` |
| `rate_limited`                                                   | `429`                       |

Duplicates return `201` like new ones, so retries are safe and the response leaks nothing.

### Internal mutation `enquiries.receive`

Everything below runs in one transaction:

1. **Site:** `normalizeId("sites", siteId)` and load the site, otherwise `unknown_site`.
2. **Form:** load `forms` by `(siteId, form)`. An unknown form is `invalid` with `errors: { form: ["Unknown form."] }`.
3. **Fields:** check `data` against the registry.
   - Extra keys: `"Unexpected field."`.
   - Missing required fields: `"Required."`.
   - Over `maxLength`: `"Too long (max N)."`.
   - `type: "email"` that isn't a plausible address: `"Enter a valid email."`.
   - Errors are keyed by field name, which matches `<site-form>`'s field-error mapping.
4. **Rate limit:** a token bucket per site, `enquiry:<siteId>`, at 20 per minute with bursts up to 40. Exceeding it is `rate_limited`. It runs after validation, so malformed posts don't use up a site's budget.
5. **Dedupe:**
   - The key is the `bodyHash` the action computed: SHA-256 of the canonical `{ form, data }` with keys sorted, so a field-order change still matches. `source` is deliberately left out.
   - Look it up on a new `by_site_hash` index (`siteId`, `bodyHash`). A match with `createdAt` in the last 10 minutes returns `{ ok: true }` without inserting.
6. **Insert:** `enquiries` with `status: "new"` and `createdAt`. T20 adds the email schedule right after this insert.

### Schema

`enquiries` gains:

- `bodyHash: v.string()` and an index `by_site_hash`;
- `source` becomes `v.optional(enquirySource)`.

There's no data to migrate, because enquiries can't arrive yet.

### Rate limiter component

`app.use(rateLimiter)` goes in `convex.config.ts`, with one `RateLimiter` instance in `enquiries.ts` (named limit `enquiry`, token bucket). `_generated/api.d.ts` gets `components.rateLimiter` by hand, as in T12, until `convex dev` regenerates it.

## Alternatives considered

- **Validation in the HTTP action, with a thin mutation:** actions can't read the registry and insert atomically, so it would cost two round trips and race the dedupe check. Doing everything in one mutation is transactional.
- **Forwarding the browser body unchanged (Turnstile token, honeypot, `_source`):** Convex would have to know about bot checks it never verifies. A separate intake schema keeps each side's responsibilities clear.
- **Dedupe with a unique "idempotency key" header from the edge:** the SPEC asks for a body-hash window, which also catches a person double-submitting from two tabs, which an edge-generated key wouldn't.
- **Rate limiting in the action with an in-memory counter:** it doesn't work across isolates. The component is the SPEC's choice.

## Scope

- In:
  - the intake schema and path in core
  - the HTTP route and action
  - the `receive` mutation (site, form, fields, rate limit, dedupe, insert)
  - the schema change
  - the rate limiter component
  - tests
- Out:
  - the edge forms route that signs and forwards (T21)
  - email (T20)
  - the enquiries inbox (T17)
  - edge-side per-IP limits (T21)

## Action items

- [ ] Add `@convex-dev/rate-limiter` (0.4.2) to the catalog and backend; register it in `convex.config.ts`
- [ ] Add `ENQUIRY_INTAKE_PATH` and `enquiryIntakeSchema` to `packages/core`, with tests
- [ ] Update the schema: `bodyHash`, `by_site_hash`, optional `source`
- [ ] Write `enquiries.receive`: site, form, fields, rate limit, dedupe, insert
- [ ] Write `convex/http.ts` and the intake action: size, signature, parse, status mapping
- [ ] Update `_generated/api.d.ts` by hand for the new modules and `components.rateLimiter`
- [ ] Write the tests below; run `vp check`, `vp test` and `vp run build`

## Testing

convex-test with `t.fetch` against the HTTP route, signing with core's `sign()` and a test secret set through `vi.stubEnv`:

- **Signature:**
  - unsigned, a wrong secret, older than 60 s, a tampered body, and a site header that doesn't match the signature all get `401`;
  - a missing secret gets `503`.
- **Body:**
  - over 32 KB gets `413`;
  - malformed JSON or the wrong shape gets `400`.
- **Site and form:**
  - a site ID that isn't valid, or a deleted site, gets `404`;
  - an unknown form gets `400` on the `form` key.
- **Fields:** an extra field, a missing required field, an over-long value and a bad email each get `400`, with the error on the right key.
- **Success:**
  - a valid post gets `201` and stores `data`, `source` (optional), `status: "new"`, `createdAt` and `bodyHash`;
  - a no-JS post without `source` gets `201`.
- **Dedupe:**
  - the same post twice within 10 minutes stores one row and returns `201` both times;
  - field order doesn't matter;
  - after 10 minutes (fake timers) it stores again.
- **Rate limit:** going over the per-site budget gets `429`, and another site is unaffected.

## Risks

- **Clock skew between the Worker and Convex:** the 60 s window allows normal skew, and the tests cover the boundary.
- **Body-hash collisions or near-duplicates:** only exact duplicates of form and data are dropped. Different messages always store.
- **The rate limiter component's API in 0.4.2:** check it against its README and test helper during the work, and adjust the limit config to match.
- **Hand-edited generated code:** same as T12. `convex dev` on your device regenerates it.

## Decisions

- No ADR: this follows SPEC §5 and §7 and the T18 decision on no-JS posts. The intake path and schema are recorded in core as the contract T21 must match.
