# ADR-022: Upload app builds to R2 with presigned URLs

## Status

Accepted

## Date

2026-11-08

## Context

An app build ([ADR-020](ADR-020-serve-app-builds-under-build-prefix.md)) can be up to 50 MB across up to 1,000 files. Convex arguments are capped at a few megabytes and actions have time and memory limits, so the files can't pass through a Convex function. R2 credentials live only in Convex (SPEC §7), so the client can't write to the bucket itself.

## Decision

`apps:startDeploy` returns a presigned `PUT` URL for each file R2 doesn't hold yet, and the client uploads straight to R2. `apps:finishDeploy` then checks every object before anything goes live.

- URLs come from the `@convex-dev/r2` component's `generateUploadUrl(key)`, which presigns a key we choose (`buildKey(siteId, buildId, path)`) for 15 minutes. No `@aws-sdk/s3-request-presigner` dependency is added.
- The URL doesn't sign the size or content type. Finish refuses any object whose size differs from the file list, and the edge sets content types from the extension, so neither matters. Content isn't re-hashed: the caller already deploys to its own site, so a wrong hash can only break that site.
- Start claims the site in `appClaims` for the same 15 minutes and records the file list, so finish trusts only what start checked. A second deploy or rollback is refused while the claim is held; an expired one is taken over.
- Files already stored at the right size get no URL. The build ID comes from the contents, so deploying the same build again uploads nothing.

## Alternatives Considered

### Send files through a Convex HTTP action

- Pros: one request per file, no presigning
- Cons: every byte passes through Convex, counting against bandwidth and action limits
- Rejected: R2 can take the upload directly

### Sign content type, length and checksum with `@aws-sdk/s3-request-presigner`

- Pros: R2 itself refuses a wrong size or content
- Cons: a new dependency, and clients must send matching headers exactly
- Rejected for now: finish's size check covers what matters; revisit if untrusted clients ever deploy

## Consequences

- An abandoned deploy leaves uploaded files in R2 until pruning is decided (SPEC §11 open questions); they are reused if the same build deploys again.
- A client has 15 minutes from start to finish. A larger or slower upload starts again and is asked only for what's missing.

## Related

- Task: tasks/active/add-app-build-deploys.md
- Spec: SPEC §11 "App sites"
- Builds on: [ADR-020](ADR-020-serve-app-builds-under-build-prefix.md)
