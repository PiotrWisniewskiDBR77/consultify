# P19 — Outputs Library — verification evidence (2026-03-30)

Scope: packets **P19-B** (delivered) and **P19-C** (`verified(evidence)`) per `FINAL_IMPLEMENTATION_PLAN_19_OUTPUTS_LIBRARY_2026-03-29.md`.

## Automated tests (run locally)

```bash
npx vitest run \
  tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx \
  tests/unit/components/ReportsAndPresentations/outputsLibraryTabQuery.test.ts \
  tests/unit/components/ReportsAndPresentations/artifactNavigation.test.ts \
  tests/integration/routes/artifacts.routes.test.ts
```

Expected: all pass.

## Staging proof script (§5.3 — operator checklist)

Environment: authenticated user with org that has registry-backed artifacts (or demo data where enabled).

1. Open **Presentations** (canonical route `/presentations`). Confirm tabs: **All**, **Mine**, **Needs review**, **Documents**, **Presentations**, **Sheets**, **Templates**.
2. **All** — confirm mixed rows (document / presentation / sheet) when data exists; single-click row selects preview; double-click or **Open** goes to full editor path (report/deck) or sheet workflow.
3. **Mine** — URL `?tab=mine`; list matches owner-scoped registry (`view=mine` on API).
4. **Needs review** — URL `?tab=needs_review`; list matches review queue (`view=review` on API). Confirm preview shows review/publish fields from trust-state when `artifactId` present.
5. From **My Work → Home**, use outputs shortcuts if present — they must land on the same `tab=` values as the hub (single module: `outputsLibraryTabQuery.ts`).
6. **Export / audit** — for an artifact with export history, open preview and confirm export trace line; full audit trail remains **P18** (`/api/artifacts/:id/trust-state`).

Optional capture: short screen recording or screenshots of steps 2–4 attached to the PR.

## Rollback posture (§8.3)

- Revert the P19-B UI commit(s) that changed tab wiring / `resolveArtifactOpenPath`; listing remains available via API and prior routes.
- No destructive DB migrations introduced by this verification slice.

## Known limits

- Fourth “materialized type” in a single aggregate row set is **registry runtime** (`report` | `presentation` | `sheet`). Additional lanes (**Documents**, **Sheets**, **Templates** tabs) cover other discoverability paths inside the same hub shell.
- `native_artifact` runtime rows are not yet mapped in the aggregate UI mapper; they may still appear via typed list endpoints as the registry evolves.

## UI/UX standards audit addendum (2026-04-11)

Full audit conducted against FROZEN_LAYOUTS, app-table-standard, table-preview-pane-standard, and module-hub-standard.

### Gaps found and resolved

| ID | Standard | Gap | Resolution |
|----|----------|-----|------------|
| UI-1 | table-preview-pane-standard §4 | Missing `onOpenFull` → no "Open" button in PreviewPaneShell header | Added `onOpenFull` to all 4 tab components (OutputsAggregate, Reports, Presentations, Templates) |
| UI-2 | table-preview-pane-standard §3.2 | Duplicate title in preview body (PreviewPaneShell already renders title) | Removed title from ReportPreviewBody, PresentationPreviewBody, TemplatePreviewBody |
| UI-3 | table-preview-pane-standard §4 | OutputsAggregate preview footer had redundant border-t and padding (shell provides these) | Removed redundant styling from footer render |
| UI-4 | table-preview-pane-standard §4 | OutputsAggregate preview body had redundant p-4 (shell body already padded) | Removed duplicate padding |
| UI-5 | table-preview-pane-standard §4 | Templates tab missing `onRowDoubleClick` (double-click should open) | Added `onRowDoubleClick` to TemplatesTabContent |
| G4 | Documentation | TemplatesTabContent header comment drift | Already resolved (header references `/api/artifacts?artifactFamily=template`) |

### Standards compliance summary

- FROZEN_LAYOUTS: 5/5 rules PASS
- app-table-standard: kebab actions, resizable columns, header filters — all PASS
- table-preview-pane-standard: PreviewPaneShell with title, close, "Open" header button, scrollable body, sticky footer — all PASS
- module-hub-standard: ModuleHub pattern with view modes, command row, search — PASS

See full audit: `evidence/P19_FULL_AUDIT_2026-04-11.md`.

## Ledger

- P19-C verification batch: `93a30d1f04`; ledger SHA annotation: `2ee56f5cfd` (branch `ws/c-artifact-evidence`).
