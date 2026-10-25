---
title: Add AI editing to the Loft
created: 2026-10-24
---

Select an element by `data-r2c2-id`, prompt for a patch to that element only, review a before and after, and apply it to the draft.

- Before building, trial Effect for the generate, validate and retry pipeline: typed errors, retry budget, timeouts, cancellation, possibly `@effect/ai-anthropic`. Keep it to one Convex Node action, and record the outcome as an ADR that follows up [ADR-006](../../docs/decisions/ADR-006-defer-effect-adoption.md).

Related: [SPEC §11](../../SPEC.md#11-later-specs-outlines), [ADR-006](../../docs/decisions/ADR-006-defer-effect-adoption.md)
