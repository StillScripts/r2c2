---
title: Explain form conflicts when publishing in the Loft
created: 2026-10-26
---

Publishing a page whose `<site-form>` has the same name as a form on another live page, but different fields, throws `form_conflict` with `{ form }`. Publish and rollback both do this. The Loft has no message for it in `apps/loft/src/lib/errors.ts`, so staff see "Something went wrong. Please try again." with no hint how to fix it.

- Add a `form_conflict` message that names the form, e.g. `Another live page has a form named "contact" with different fields. Make them match, or rename one.`
- `errorMessage()` only maps codes to fixed strings, so let a message use the error's details (`form`)
- Cover it in the Loft's tests

Found publishing the r2c2 home page while a test `/contact` page with a different `contact` form was live in dev.

Related: [T13 publish and rollback](../done/add-publish-and-rollback.md)
