---
title: T01 Initialise the monorepo
created: 2026-10-24
plan: docs/plans/initialise-vite-plus-monorepo.md
---

Set up the workspace every other task builds on. The repo already has a Vite+ workspace (pnpm 11, turbo scripts, `apps/loft`, `packages/ui`); bring it in line with SPEC §2 and §3, including exact pins for the Loft's `latest` and TypeScript 6 dependencies.

- pnpm 12 workspace with the catalog, overrides, peer rules and `allowBuilds` from SPEC §2
- Root `vite.config.ts` (Vite+) with lint, format and test projects; base `tsconfig.json`; `.gitignore`; Node 24 in `engines`
- Empty packages from SPEC §3, each with `package.json` exporting `src`
- Check versions with `vp outdated` first and keep exact pins in the catalog

Done when `vp install`, `vp check` and `vp test` pass on a clean clone.

Related: [SPEC §2](../../SPEC.md#2-locked-decisions), [SPEC §3](../../SPEC.md#3-repo-layout)
