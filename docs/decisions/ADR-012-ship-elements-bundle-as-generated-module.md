# ADR-012: Ship the elements bundle as a generated backend module

## Status

Accepted

## Date

2026-10-25

## Context

Published pages that use a platform element such as `<site-form>` load one shared script, built from `packages/elements` with `vp pack`. The CSP only allows same-origin scripts, so the script lives once in R2 at `shared/elements/<hash>.js`, and the edge serves it to every site at `/_elements/<hash>.js` (T06). Each page's HTML names the hash it was published with, so a change to the script reaches a page when that page is next published, and older pages keep the version they were tested with.

Publish (T13) runs as a Convex action. It can't read files from the repo, and Convex's bundler can't import a built file as text. So something has to carry the built script from the repo into R2.

## Decision

A backend script, `vp run --filter @workspace/backend elements`, builds `packages/elements` and writes the minified JS as a string into `packages/backend/elements.gen.ts`. The file is committed and deploys with the backend. Publish hashes it, uploads it to `elementsKey(hash)` the first time a page needs that version (after a `HEAD` check), and links the page to `/_elements/<hash>.js`. CI reruns the script and fails if the committed file differs, so the bundle can't drift from its source.

## Alternatives Considered

### Upload at deploy time

- Pros: no generated file in git
- Cons: every environment, including local dev, needs an extra step, and Convex has to be told the hash through an env var that can disagree with what's in R2
- Rejected: publish would depend on a deploy step having run correctly

### Upload from a CLI action, with the hash in a settings table

- Pros: no generated file, no deploy pipeline changes
- Cons: a manual step after every change, a new table, and pages can point at a script nobody uploaded
- Rejected: easy to forget, and it fails silently on live sites

## Consequences

- Publishing only depends on the deployed backend code: there is nothing extra to set up per environment.
- A PR that changes `packages/elements` must also commit the regenerated `elements.gen.ts`; CI says so if it's missing.
- The generated file (a few KB) shows up in diffs whenever the elements change.
- Old versions of the script stay in R2 for pages published with them. Pruning unreferenced versions is future work if it ever matters.

## Related

- Plan: docs/plans/add-publish-and-rollback.md
- Task: tasks/done/add-publish-and-rollback.md
- Elements: docs/plans/build-site-form-element.md
