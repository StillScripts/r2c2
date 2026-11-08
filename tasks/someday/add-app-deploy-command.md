---
title: Add an app deploy command
created: 2026-11-08
---

Add `scripts/deploy-app.ts` and `app:deploy` / `app:rollback` scripts to `@workspace/backend`: `vp run --filter @workspace/backend app:deploy -- <dist folder> --into <slug>`, with `--prod` passed to `convex run` like `site:import`. It hashes the files, calls start, uploads to the presigned URLs, calls finish, and prints the build ID and URL. Document it in `docs/deploy.md`.

Done when: the `dist` of a fresh Vite app deploys to a local app site, loads at its local address, and `app:rollback` restores the previous build.
