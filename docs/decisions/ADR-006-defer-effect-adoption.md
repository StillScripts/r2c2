# ADR-006: Defer Effect; return errors as values for now

## Status

Accepted

## Date

2026-10-25

## Context

Effect 4.0 went stable on 2026-10-01. It offers typed errors, declarative retries and timeouts, and structured concurrency. Those are appealing for a repo meant to be written entirely by AI agents, since failure modes show up in types the compiler checks.

Where the code stands today:

- It has four `try/catch` blocks and one `throw` in total. The pure code already returns failures as values: `checkPage` returns issues, `attributeProblem` returns a problem or `undefined`, `verify` returns a boolean, and `extractForms` returns `{ forms, errors }`.
- Convex functions are plain async code that throw `ConvexError`. Convex already handles transactions, retries and scheduling. The only Effect–Convex bridge, Confect (0.0.35), is pre-1.0 and requires `effect` ^3.19, not v4.
- The edge Worker does very little per request, and `<site-form>` is a 2.6 kB browser script.
- Effect 4's API differs a lot from v3, and most published examples are v3. Agents are likely to write v3-style code or call APIs that don't exist.

## Decision

Don't adopt Effect across the repo now. The house style for errors is:

- **Pure code** returns failures as values (issue lists, `Problem | undefined`, `{ ok, ... }` results) instead of throwing.
- **Convex functions** throw `ConvexError` for failures a user should see.
- **`throw`** is for bugs and invariants only, such as `SanitiserChangedPageError`.

Revisit Effect when AI editing starts. That pipeline (prompt, patch, schema check, `checkPage`, feed the errors back, retry within a budget, with timeouts and cancellation) is where typed errors and declarative retries would earn their cost. Trial it there, limited to one Convex Node action and possibly using `@effect/ai-anthropic`, then record the outcome in a new ADR.

## Alternatives Considered

### Adopt Effect everywhere now

- Pros: one typed error model across the repo; errors visible in every signature
- Cons: works against Convex, which has no v4 integration; adds a runtime and concepts to the Worker and the browser script; a large, newly changed API for agents to get right
- Rejected: high cost for code that has almost no error handling to improve

### Never adopt Effect

- Pros: one plain-TypeScript style forever
- Cons: the AI editing pipeline would hand-roll retries, timeouts and error unions
- Rejected for now: the AI editing work deserves a real trial

## Consequences

- No new dependency. New code follows the error style above, which reviewers and agents can check.
- The AI editing task carries the Effect trial, so the question comes back when it matters.
- If the trial adopts Effect for AI editing, it stays inside that module unless a later ADR widens it.

## Related

- Task: tasks/someday/add-loft-ai-editing.md
