# V8.1 Reports / Presentations Legacy Entry Neutralization

Date: 2026-03-26
Lane: `Reports / Presentations`
Taxonomy: `T1`
Tranche: `Tranche 1`

## What was neutralized

Two historical entry surfaces were turned into explicit redirect shims:

- `src/components/Reports/ReportsEntryRouter.tsx`
- `src/views/FullReportsView.tsx`

Both now resolve to the canonical outputs library documents lane:

- `/presentations?tab=documents`

## Why this matters

These files were no longer part of the live routing path, but they still represented
an alternative conceptual entry into reports/management reporting.

Turning them into redirect shims means:

- accidental reuse no longer reactivates split-brain behavior
- old symbolic entry names can remain in the repo without carrying product logic
- the canonical reports entry remains the outputs library documents lane

## Residual note

Some historical reports/presentations components remain in the tree for archival or
documentation continuity, but they are no longer part of the live route authority.
