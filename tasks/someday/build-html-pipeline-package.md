---
title: T11 Build the HTML pipeline package
created: 2026-10-24
---

Create `packages/html`, which checks, cleans and compiles page HTML.

- House rules check with line-numbered, fixable errors; sanitise with an allow-list; add stable `data-r2c2-id` attributes; extract `<site-form>` definitions
- Tailwind compile from HTML plus the site's theme tokens and component classes using `tailwindcss` `compile()`; content hashing

Done when tests cover every house rule, script and event handler stripping, `javascript:` URLs, ID stability across edits and form extraction.

Related: [SPEC §4](../../SPEC.md#4-how-it-works), [SPEC §7](../../SPEC.md#7-security-rules), [SPEC §12](../../SPEC.md#12-html-house-rules)
