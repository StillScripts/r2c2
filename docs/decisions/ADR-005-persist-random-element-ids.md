# ADR-005: Persist random element IDs in the draft

## Status

Accepted

## Date

2026-10-25

## Context

Each element in a page needs a stable `data-r2c2-id` (SPEC §4) so the Loft's AI editing and the MCP tools can target one element, and so history can follow it. IDs must survive text edits, reordering and republishing.

## Decision

`assignElementIds` gives each body element a random 8-character base36 ID once and keeps it. An element that already has an ID keeps it. A duplicate ID (from copy and paste) stays on the first element in document order, and later copies get new IDs. It runs in the Convex mutation that saves a draft, so IDs exist before any AI edit, and again at publish as a no-op guarantee.

## Alternatives Considered

### IDs derived from content (hash of tag, path and text)

- Pros: no need to store anything
- Cons: an ID changes whenever an element's text or position changes
- Rejected: breaks AI-edit targeting and history

### Assign IDs only at publish

- Pros: one place to run it
- Cons: the AI editor needs IDs before a publish, and writing them back from an action races with concurrent edits
- Rejected: assign on save instead

## Consequences

- `data-r2c2-id` attributes live in `pages.draftHtml` and ship in published HTML.
- Editors and AI or MCP tools must keep the attribute. A client that drops it causes new IDs on the next save.
- Wiring it into the draft-save mutation belongs to T09/T15.

## Related

- Plan: docs/plans/build-html-pipeline-package.md
