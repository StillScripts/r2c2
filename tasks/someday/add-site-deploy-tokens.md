---
title: Add per-site deploy tokens
created: 2026-11-08
---

Add a `deployTokens` table (`siteId`, `name`, `tokenHash`, `createdBy`, `createdAt`, `lastUsedAt`), staff CLI commands to create and revoke a token (shown once, stored hashed), and HTTP actions `POST /deploy/start` and `POST /deploy/finish` that take a bearer token, rate-limit, and call the same deploy logic for that token's site only. The deploy command gains `--token` and `--url`. Record the deploy token ADR.

Done when: a token deploys its own site and is refused for any other; a revoked token is refused; no token is stored in plain text.
