---
title: T06 Build the renderer
created: 2026-10-24
---

Serve published pages and assets from R2.

- Reads `live/<path>/index.html` from R2; streams it with the page headers from SPEC §5
- Serves `assets/<hash>.*` and `shared/elements/<hash>.js` as immutable; per-site `404.html` with a fallback

Done when tests cover hit, miss, 404, assets and headers.

Spec: [SPEC §4, §5](../../SPEC.md)
