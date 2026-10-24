---
title: T01 Initialise the monorepo
created: 2026-10-24
---

Set up the workspace every other task builds on. The repo already has a Vite+ workspace (pnpm 11, turbo scripts, `apps/web`, `packages/ui`); bring it in line with SPEC §2 and §3, and settle whether `apps/web` becomes `apps/loft`.

- pnpm 12 workspace with the catalog, overrides, peer rules and `allowBuilds` from SPEC §2
- Root `vite.config.ts` (Vite+) with lint, format and test projects; base `tsconfig.json`; `.gitignore`; Node 24 in `engines`
- Empty packages from SPEC §3, each with `package.json` exporting `src`
- Check versions with `vp outdated` first and keep exact pins in the catalog

Done when `vp install`, `vp check` and `vp test` pass on a clean clone.

Spec: [SPEC §2, §3](../../SPEC.md)
