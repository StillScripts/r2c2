---
title: T18 Build the `<site-form>` element
depth: detailed
created: 2026-10-25
---

# T18 Build the `<site-form>` element

Build `packages/elements` with the `<site-form>` custom element. It progressively enhances a real `<form>`: without JavaScript the form posts natively. With JavaScript it adds a Turnstile widget, captures `_source`, submits JSON and shows sending, success and error states. `vp pack` builds it into one small script, and a Playwright test proves both paths in a real browser.

## Context

- **Contracts.** SPEC §4 ("Taking an enquiry") and §5 (enquiry API) define the contract:
  - Posts go to `POST /_api/forms/:form`, as JSON or form-encoded, up to 32 KB.
  - The body is the declared fields plus `cf-turnstile-response` and `_source` (`{ page, referrer, utm }`).
  - Responses: `201 { ok: true }`, `400 { ok: false, errors }`, `429`, `403`. HTML form posts get a `303` to `?sent=1`.
- **What exists today.** `packages/core` has `enquirySchema`, `EnquiryResponse` and `MAX_ENQUIRY_BYTES`. `packages/html` (T11) allows `<site-form name>` wrapping `form`, `label`, `input`, `textarea`, `select` and `button`, and `extractForms` reads its fields. `packages/elements` is an empty stub.
- **CSP.** The CSP (SPEC §5) allows `script-src 'self' https://challenges.cloudflare.com` and `frame-src https://challenges.cloudflare.com`, so the element script must be same-origin and Turnstile loads from Cloudflare. There are no inline scripts or styles.
- **Who serves it.** Uploading the built script to `shared/elements/<hash>.js` is T12/T13's R2 work. Adding the `<script type="module">` tag to pages that use an element is T13. The gateway route that accepts posts is T21.

## Approach

### Authored markup (unchanged from T11)

```html
<site-form name="contact">
  <form method="post" action="/_api/forms/contact">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required />
    <button type="submit" class="btn">Send</button>
  </form>
</site-form>
```

Without JavaScript this is an ordinary form post. Nothing in the markup depends on the element.

### Element behaviour (`src/site-form.ts`)

`customElements.define("site-form", SiteForm)`. On connect, it finds its child `<form>` and does nothing more if there isn't one.

- **Turnstile.** It loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once per page, through a shared promise. It renders a widget into a container it inserts before the submit button, or at the end of the form if there's no button. Turnstile puts its token in a hidden `cf-turnstile-response` input inside the form.
  - **Sitekey:** from the `sitekey` attribute that T13 adds when it assembles the published document, after the check and the sanitiser, next to the canonical URL and the script tag. The authored HTML never carries it, so T11's allow-list stays as it is.
  - **The one third-party request:** this is the only third-party request a page makes, and only pages with a form make it. SPEC §5's CSP allows exactly this origin.
- **Submit.** It calls `preventDefault`, then builds the body:
  - the `FormData` fields, as strings;
  - `_source`: `page` is `location.pathname`, `referrer` is `document.referrer`, and `utm` is the `utm_*` query parameters.

  The `utm_*` parameters are still in `location.search`, because the gateway strips tracking parameters from its cache key, not with a redirect. It then POSTs JSON to `form.action` with `Accept: application/json`. The body is typed against `Enquiry` from `@workspace/core`. That's a type-only import: no values come from core, so zod is never bundled. The 32 KB limit is enforced by the server, not duplicated in the browser.

- **States.**
  - The state shows in a `data-state` attribute on `<site-form>`: `idle`, `sending`, `sent` or `error`. Themes can style each state with selectors such as `site-form[data-state=sent]`.
  - There's an ARIA live region (`role="status"`) for messages.
  - The submit button is disabled while sending.
  - On `201` the form resets, the state becomes `sent` and a success message shows.
  - On `400`, `errors` is `Record<string, string[]>`.
    - Each key that matches a field name gets `aria-invalid="true"` and the first message, shown in a `<p id="<form>-<field>-error">` linked with `aria-describedby`. Focus moves to the first invalid field.
    - Keys with no matching field (`cf-turnstile-response`, `_source.*`) give the general error.
    - Old field messages clear on the next submit.
  - `403`, `429`, a network failure or anything else gives a general error message, and the Turnstile widget resets.
- **No-JS success.** When the page loads with `?sent=1` (the `303` target), the element shows the success state, so a no-JS post that comes back with JavaScript available still confirms.
- **Showing messages.** The element shows and hides its own status and field-error nodes with the `hidden` property. They need no CSS, because a page's Tailwind only contains classes the page uses. `data-state` is just an optional hook for theme styling.
- **Messages.** Default English messages for now. Customisable copy comes later, since T11's allow-list has no attributes for it yet.

### Build (`vite.config.ts` → `vp pack`)

One ESM entry (`src/index.ts`), `platform: "browser"` and minified. Only the element's own code ends up in the bundle. The output goes to a fixed name, `dist/site-elements.js`. `vp run build` in the package produces it, and the root `vp run build` picks it up.

- **Hashing at upload, not in the build.** T12/T13 hash the file with `hashContent` when uploading it to `shared/elements/<hash>.js`, the same way they hash the page CSS. No manifest is needed.
- **Which pages need the script.** T13 decides from `PLATFORM_TAGS` in `packages/html`'s allow-list, which already lists `site-form`. Nothing is exported from this package for that.

### Browser test (`src/site-form.browser.test.ts`, run by `vp test`)

A Node-mode test drives Playwright directly. Vitest's browser mode can't turn JavaScript off, because its runner runs in the page.

- **Server.** In `beforeAll` the test packs the element into a temporary directory with `build()` from `vite-plus/pack`, so it doesn't depend on `vp run build` having run first (CI runs `vp test` before the build). A `node:http` server on a random port serves a test page, that script and a stub `/_api/forms/contact`. The stub records what it received and answers like SPEC §5: a `303` to `?sent=1` for form-encoded posts, `201` or `400` for JSON. `page.route` replaces Cloudflare's Turnstile script with a tiny stub that renders a container and fills `cf-turnstile-response`, so the test is offline and deterministic.
- **JS off** (`javaScriptEnabled: false`): fill in the form and submit. The server receives a form-encoded body with the fields, and the page lands on `?sent=1`.
- **JS on:** fill in the form and submit. The server receives JSON with the fields, `cf-turnstile-response` and `_source` (page, referrer, and utm from a `?utm_source=` URL). The page doesn't navigate, `data-state` becomes `sent` and the status shows the success text. A second case gets a `400` and checks `aria-invalid` and the field message. A third case gets a `500` and checks the general error.

### Dependencies and CI

- `playwright` is added to the catalog, pinned to the version preinstalled in cloud sessions (1.63.0), so local runs use the bundled Chromium.
- CI gets a `vp exec --filter @workspace/elements playwright install --with-deps chromium` step before `vp test`.

## Alternatives considered

- **Vitest browser mode with the Playwright provider:** it gives nice in-page assertions, but it can't test the no-JS path, and we'd need two test setups. Playwright alone covers both.
- **Shadow DOM:** it would hide the authored form from the page's theme CSS and from the house rules. The element enhances light-DOM children instead.
- **Bundling zod to validate on the client:** it adds about 15 KB to every page for checks the browser (`required`, `maxlength`, `type=email`) and the server already do.

## Scope

- In:
  - `packages/elements`: the `site-form` element, the `vp pack` build, and the Playwright browser test
  - the catalog entry for `playwright`
  - the CI Playwright install step
- Out:
  - uploading to R2 and adding the script tag at publish (T12/T13)
  - the gateway forms route, rate limits and the Turnstile check (T21)
  - customisable messages
  - other elements

## Action items

- [x] Add `playwright` (1.63.0) to the catalog and `packages/elements`; add the CI install step
- [x] Configure `vp pack` in `packages/elements/vite.config.ts` (browser ESM, minified, `dist/site-elements.js`) and a `build` script
- [x] Implement the `site-form` element: Turnstile loader and widget, JSON submit, `_source`, states, field errors, `?sent=1`
- [x] Write the Playwright test: server, Turnstile stub, JS-off post, JS-on success, 400 field errors, 500 general error
- [x] Run `vp check`, `vp test` and `vp run build`; check the minified size

## Testing

The Playwright suite above runs in `vp test` locally and in CI. Edge cases it covers: a form with no fields beyond Turnstile, the `utm_*` capture, the field-level `400` mapping, a disabled button while sending, and a page loaded with `?sent=1`.

## Risks

- **Playwright browsers in CI:** they add install time. Mitigation: install Chromium only. Add a browser cache if CI time grows.
- **The Turnstile API changes or loads slowly:** the element loads it with `render=explicit` and lazily on connect. A failed load leaves the form usable, and the server then rejects it with `403`, which shows the general error.
- **Version drift between the preinstalled Playwright and the catalog:** pinning to 1.63.0 matches the cloud image. When the image moves, bump the catalog.

## Decisions

- No ADR needed: this follows SPEC §4/§5 and T11's allow-list. Revisit if the sitekey becomes per-site.

## Resolved questions

- **Sitekey:** T13 adds a `sitekey` attribute to each `<site-form>` when it assembles the published page.
- **No-JS posts:** T21 accepts form-encoded posts without a Turnstile token when a honeypot field is empty, with a lower rate limit, and `_source` is optional for those posts. The honeypot has to work without JavaScript, so it can't come from the element. T13 adds it (a visually hidden `<input name="website">`) next to the sitekey, and T21 checks it. T18's test page includes it and checks that a no-JS post sends it empty.
