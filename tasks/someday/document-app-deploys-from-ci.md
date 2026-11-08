---
title: Document deploying from another repo's CI
created: 2026-11-08
---

Make the deploy client runnable outside this repo (no workspace imports), and add a docs page with an example GitHub Actions workflow: check out, build, deploy with an `R2C2_DEPLOY_TOKEN` secret. Note the app requirements: relative `base`, separate JS and CSS files, no inline scripts or styles, self-hosted fonts.

Done when: a workflow copied from the docs into an empty repo deploys a Vite app on push.
