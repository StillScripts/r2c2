# ADR-021: Keep path case under /_build/

## Status

Accepted

## Date

2026-11-08

## Context

The gateway lowercases every page path with `normalisePath` (`packages/core/src/paths.ts`), so `/About` and `/about` are the same page (SPEC §5). Bundlers emit mixed-case file names such as `index-AbC12.js`, and their content hashes are case-sensitive, so lowercasing would break every such URL. R2 keys are case-sensitive too.

## Decision

Paths under `/_build/` skip lowercasing. The gateway hands them to the renderer as they arrive, and `parseBuildPath` decodes them, keeps their case, and refuses backslashes, NUL, empty, `.` and `..` segments. Page paths stay lowercased exactly as before. The file extension is matched case-insensitively, so `Data.JSON` is still JSON.

## Alternatives Considered

### Require lowercase build file names

- Pros: one path rule for the whole site
- Cons: every app would need special bundler settings for its output names, and a single uppercase file from a dependency would break the deploy
- Rejected: apps should deploy with their bundler's defaults

### Store build keys lowercased and look them up lowercased

- Pros: case-insensitive URLs, like pages
- Cons: two files differing only by case would collide, and the deploy would have to detect that
- Rejected: matching the bundler's names exactly is simpler and never ambiguous

## Consequences

- `/_build/<id>/Index.js` and `/_build/<id>/index.js` are different files; a wrong-case request gets the site's 404.
- The `..` and encoding checks that `normalisePath` gives pages are repeated in `parseBuildPath`, and both are tested.

## Related

- Task: tasks/active/serve-app-build-files.md
- Builds on: [ADR-020](ADR-020-serve-app-builds-under-build-prefix.md)
