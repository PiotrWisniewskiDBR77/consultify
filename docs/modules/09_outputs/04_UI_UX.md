---
module_id: MODULE_OUTPUTS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Outputs Library

## 1. Main Screen

As-Is: `/presentations` renders `ReportsAndPresentationsHub` with multi-tab library UX. Specialized create/edit screens route to report or presentation builders while the library remains the entry shell. Legacy report routes redirect to outputs tabs to avoid parallel module surfaces.

## 2. Runtime States

- Loading: each data-source hook family must expose loading state for tabs and artifact lists.
- Empty: empty library/tab states must explain whether no outputs exist, filters hide them or the selected tab has no artifacts.
- Error: failed loads/actions must show clear error UI or toast copy.
- Degraded: unavailable action-target endpoints, partial artifact metadata or separated shared/embed contexts must be visible.
- Success: create/edit/review/share/export actions must confirm the result and tell the user where the artifact now lives.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps module-level navigation. Menu 3 is the Outputs command/top bar for active tab, artifact selection, filters and contextual library actions.

## 4. AI Actions Placement

Contextual AI/output generation actions must live in Menu 3/right-side command placement or artifact-scoped controls. They must not be duplicated below the canvas or in both library canvas and Menu 3.

## 5. Next Action Guidance

Outputs UX must tell the user whether to create a new item, open an artifact, continue editing in a builder, review, share, export, retry or switch tabs.

## 6. Source / Evidence / Provenance

Generated outputs, reports and presentations must preserve source artifact, creator/source workflow, review state and evidence for claims. Shared/embed routes must not expose authenticated-only provenance beyond allowed access.

## 7. Approval / Diff / Review

Review/mine/all artifact views are explicit tabs. Governance/access actions fetched through action-target endpoints must require explicit user action; generated client-ready outputs require review before final/approved state.

## 8. Anti-Patterns

- Parallel hidden report surfaces outside Outputs ownership.
- Export/share success without visible artifact state.
- AI generation duplicated in canvas and Menu 3.
- Source-free generated output presented as approved.
- Shared/embed route leaking authenticated library controls.

## 9. As-Is Gaps

- Existing docs confirm tab synchronization, explicit review/mine/all tabs and action-target endpoints, but not the full copy/evidence matrix for every artifact family.
- Review/diff rendering for specialized builders is owned by those builders and needs separate runtime validation.

## 10. Acceptance Criteria

- `/presentations` renders `ReportsAndPresentationsHub` as the Outputs entry shell.
- Loading, empty, error, degraded and success states are explicit per tab/data source.
- AI/output actions use Menu 3/right-side or artifact-scoped placement without duplication.
- Outputs show source/provenance and review state.
- Share/export/finalization require explicit user action and visible result.

## 11. Function Annex — Outputs Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `OUT_LIBRARY_HUB` | Library Hub | `/presentations` | real | `ReportsAndPresentationsHub` | `functions/OUT_LIBRARY_HUB.md` |
| `OUT_REPORT_BUILDER` | Report Builder Route | `/reports/builder`, `/reports/builder/:reportId` | real | `ReportBuilderView` | `functions/OUT_REPORT_BUILDER.md` |
| `OUT_PRESENTATION_WIZARD` | Presentation Wizard | `/presentations/wizard` | real | `PresentationWizard` | `functions/OUT_PRESENTATION_WIZARD.md` |
| `OUT_DECK_BUILDER` | Deck Builder | `/presentations/builder/:deckId` | real | `DeckBuilder` | `functions/OUT_DECK_BUILDER.md` |
| `OUT_SHARED_PRESENTATION` | Shared Presentation Surface | shared/embed presentation routes | real | `SharedPresentationView` | `functions/OUT_SHARED_PRESENTATION.md` |
| `OUT_LEGACY_REPORT_REDIRECT` | Legacy Reports Redirect Bridge | `/reports`, `/reports/management` | partial | route redirect to outputs tabs | `functions/OUT_LEGACY_REPORT_REDIRECT.md` |
