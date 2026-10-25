---
title: T18 Build the `<site-form>` element
created: 2026-10-24
completed: 2026-10-25
plan: docs/plans/build-site-form-element.md
---

Create `packages/elements`, starting with the enquiry form element.

- Progressive enhancement over a real form, JSON submit, Turnstile widget, success and error states, `_source` capture
- Built with `vp pack`, hashed, published to `shared/elements/<hash>.js`; the publish pipeline adds the script tag when a page uses an element

Done when the form works with JavaScript on and off in a browser test.

Related: [SPEC §4](../../SPEC.md#4-how-it-works), [SPEC §5](../../SPEC.md#5-contracts-packagescore)
