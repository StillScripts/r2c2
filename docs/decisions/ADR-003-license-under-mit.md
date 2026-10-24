# ADR-003: License the project under MIT

## Status

Accepted

## Date

2026-10-25

## Context

R2C2 is a public repo meant as a starter others can fork and run for their own sites
(SPEC T24). The skills in `.claude/skills/` keep their own upstream licenses (Apache-2.0 and MIT, in
each folder's `LICENSE.txt`).

## Decision

License the project under MIT, in `LICENSE` at the repo root.

## Alternatives Considered

### Apache-2.0

- Pros: explicit patent grant; matches most of the adapted skills
- Cons: longer, and asks forks to carry a NOTICE file and mark changed files
- Rejected: the patent grant matters little for a site builder; MIT is simpler to adopt

### AGPL-3.0

- Pros: hosted forks must share their changes
- Cons: puts off people who want to run or sell their own version
- Rejected: the goal is a starter people build on freely

## Consequences

- `LICENSE` covers everything except the adapted skills.
- Dependencies must stay compatible with MIT distribution; avoid copyleft packages.
