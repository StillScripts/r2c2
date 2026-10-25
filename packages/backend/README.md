# @workspace/backend

The Convex backend in `convex/`: schema, functions and the publish pipeline. The Loft
imports its API from `@workspace/backend/api`.

```bash
vp run --filter @workspace/backend dev   # push functions and watch for changes
vp run --filter @workspace/backend seed  # create the r2c2 site (safe to rerun)
vp test                                  # includes the convex-test suites
```

Every public function that touches site data is defined with `siteQuery` or
`siteMutation` from `convex/access.ts`, and loads any other document through `ownDoc`.
