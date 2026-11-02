# ADR-017: Call the Loft's scenes views

## Status

Accepted

## Date

2026-10-28

## Context

The Loft is getting a scene behind its UI (Harbour, Coast or Alps) that each user picks for themselves ([design spec §5](../design/loft.md#5-views)). The repo already uses "theme" for a site's Tailwind `@theme` tokens and component classes. They're stored on `sites.theme`, checked by the house rules, and edited by the planned theme panel (SPEC §6, §11, §12).

Using the same word for a per-user backdrop would make tasks, code and AI prompts ambiguous. "Change the theme" could mean restyling the published site or changing the Loft's backdrop, and the AI acts on what it is told.

## Decision

Call them **views**.

- In code it's `view`, with the ids `harbour`, `coast` and `alps`. A view is stored on the user's preferences, never on a site.
- "Theme" keeps meaning only a site's design tokens.
- UI copy says "view" ("Coast view", "Choose your view").

## Alternatives Considered

### Themes

- Pros: the familiar word for an app's look
- Cons: collides with site themes, a core concept in the spec, the house rules and the AI's context
- Rejected: the ambiguity reaches the AI, not just people

### Rooms or lofts

- Pros: playful, and fits the Loft's name
- Cons: suggests separate spaces with their own content rather than a backdrop. The design also chose one loft with many views over several lofts.
- Rejected: it promises more than a change of scenery

### Scenes

- Pros: accurate for the artwork
- Cons: reads oddly in UI copy ("Coast scene")
- Rejected for the product name, but fine as an informal word for the SVG art

## Consequences

- Preferences, components and copy use `view`, and the theme panel task stays about site themes.
- Adding a view is one SVG and an id.
- The design canvas source calls Harbour `city`. Code uses `harbour`.

## Related

- Design spec: docs/design/loft.md
- Task: tasks/someday/add-loft-views.md
