---
title: Deploy app builds from Convex
created: 2026-11-08
completed: 2026-11-08
---

Add internal actions `apps:startDeploy`, `apps:finishDeploy` and `apps:rollback`. Start checks the file list (root `index.html`, allow-listed extensions, no `..`, 10 MB per file, 50 MB per build), claims the site, and returns presigned R2 PUT URLs for files not already stored (check whether the r2 component can presign a chosen key; if not, add `@aws-sdk/s3-request-presigner`). Finish confirms every object and size, rewrites relative URLs in `index.html` to `/_build/<buildId>/`, checks it against new app shell rules in `@workspace/html` (no inline script, style, handlers or `style` attributes, no third-party URLs), writes `versions/<hash>.html` and `live/index.html`, records the build, writes an audit entry and releases the claim. Record the presigned upload ADR.

Done when: tests cover the checks, the rewrite, the claim and rollback, and deploying an identical build twice uploads nothing the second time.

Related: [SPEC §11](../../SPEC.md#11-later-specs-outlines), [ADR-022](../../docs/decisions/ADR-022-upload-app-builds-with-presigned-urls.md)
