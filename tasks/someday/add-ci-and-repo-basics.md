---
title: T02 Add CI and repo basics
created: 2026-10-24
---

Run `vp check` and `vp test` on every PR and add the files a public repo needs.

- GitHub Actions on PRs and `master`: `voidzero-dev/setup-vp` pinned to an exact version, then `vp check` and `vp test`
- LICENSE (per `choose-project-license`), README stub, `.env.example` per app with the variables in SPEC §8

Done when a PR shows a green check and `master` is protected.

Needs: `choose-project-license`

Spec: [SPEC §9](../../SPEC.md)
