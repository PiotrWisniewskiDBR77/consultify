# Baseline Quality Evidence — 2026-05-07

## Scope

Continuation after Table Studio Foundation closeout. Goal: reduce repo-wide baseline constraints without changing product behavior.

## Changes Applied

- Restored frontend `npm run type-check` by adding narrow type shims and missing route/workspace mappings.
- Added typed `WorkCanvasApi` client for existing `/api/work-canvas` endpoints used by `WorkCanvasShell`.
- Exported and typed `ResearchSessionsDock` props used by the Work Canvas research panel.
- Restored backend `npm run typecheck` by fixing compile-only presentation module typing issues:
  - subscriber dashboard DB row typings,
  - `presentation_view` read capability,
  - Express param/query narrowing,
  - optional quality gate status fallback,
  - presentation deck document/service type alignment.

## Validation

| Gate | Command | Result |
| --- | --- | --- |
| Frontend typecheck | `npm run type-check` | PASS |
| Backend typecheck | `cd server && npm run typecheck` | PASS |
| Touched frontend lint | `npx eslint <touched frontend files> --quiet` | PASS |
| IDE diagnostics | `ReadLints` on touched files | PASS |
| Locale syntax | `node -e "JSON.parse(...)"` for EN/PL locale files | PASS |
| Full repo lint | `npm run lint` | FAIL — existing format/import-sort baseline |

## Remaining Constraint

Full `npm run lint` still fails on existing repo-wide Prettier and `simple-import-sort` violations: 1788 auto-fixable errors across backend routes/services/tests and frontend superadmin surfaces. This block intentionally did not auto-format the whole repository because that would create a high-noise, high-blast-radius diff unrelated to Table Studio behavior.

## Gate Result

`DONE_WITH_CONSTRAINTS`

Typecheck blockers are cleared. Remaining baseline is formatting/import order only and should be handled as a dedicated low-risk formatting PR or staged per-module lint cleanup.
