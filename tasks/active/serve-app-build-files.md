---
title: Serve app build files at the edge
created: 2026-11-08
---

Add `BUILD_PREFIX` (`/_build/`), `buildKey(siteId, buildId, path)` and `parseBuildPath` to `@workspace/core`, and a renderer route that serves `sites/<siteId>/builds/<buildId>/<path>` from R2 with the immutable asset headers. Keep the path's case, decode it, reject `..`, and serve only allow-listed extensions (`ASSET_CONTENT_TYPES` plus `json`; no SVG, no HTML). Record the `/_build/` and path-case ADRs.

Done when: an object at `builds/<buildId>/assets/Index-AbC.js` is served at `/_build/<buildId>/assets/Index-AbC.js` with immutable headers, and `..`, `.html`, `.svg` and missing files return the site's 404.

Related: [SPEC §5](../../SPEC.md#5-contracts-packagescore), [ADR-020](../../docs/decisions/ADR-020-serve-app-builds-under-build-prefix.md), [ADR-021](../../docs/decisions/ADR-021-keep-path-case-for-build-files.md)
