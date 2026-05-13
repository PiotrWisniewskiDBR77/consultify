---
module_id: MODULE_OUTPUTS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Outputs Library

## Runtime Behavior (As-Is)

- Outputs lane centers on `/presentations` with `ReportsAndPresentationsHub` handling aggregate, mine, review, documents, presentations, sheets, and templates tabs.
- Legacy reports entry points redirect into outputs tab contexts instead of separate module ownership.
- Artifact-level create/edit operations route users to specialized builders (`/reports/builder`, presentation wizard/deck builder) while library identity stays in outputs lane.
- `AppView.PRESENTATIONS` resolves to `/presentations` (library shell), while `AppView.FULL_STEP6_REPORTS` still resolves to `/reports/builder` as a report-builder-first legacy signal.

## Function Runtime Breakdown

- `OUT_LIBRARY_HUB`: primary outputs library runtime.
- `OUT_REPORT_BUILDER`: report editing/building route.
- `OUT_PRESENTATION_WIZARD` and `OUT_DECK_BUILDER`: presentation create/edit route functions.
- `OUT_SHARED_PRESENTATION`: shared/embed viewing function.
- `OUT_LEGACY_REPORT_REDIRECT`: legacy route bridge into canonical outputs lane.

## Route Ownership Map (Deep Audit Snapshot)

| Route | Runtime shell | Module owner | Evidence |
| --- | --- | --- | --- |
| `/presentations` | `ReportsAndPresentationsHub` | `09_outputs` | `src/routes/AppRoutes.tsx`, `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` |
| `/reports`, `/reports/management` | redirect -> `/presentations?tab=documents` | `09_outputs` | `src/routes/AppRoutes.tsx` |
| `/reports/builder*` | `ReportBuilderView` | `09_outputs` | `src/routes/AppRoutes.tsx` |
| `/presentations/wizard` | `PresentationWizard` | `09_outputs` | `src/routes/AppRoutes.tsx` |
| `/presentations/builder/:deckId` | `DeckBuilder` | `09_outputs` | `src/routes/AppRoutes.tsx` |
| `/wordy` | `V4ComingSoonView` | `10_dokumenty` | `src/routes/AppRoutes.tsx` |
| `/excele` | `V4ComingSoonView` | `11_tabele` | `src/routes/AppRoutes.tsx` |
| `/prezentacje` | `V4ComingSoonView` | `12_prezentacje` | `src/routes/AppRoutes.tsx` |

## Cross-Module As-Is Risks

- `builder_entry_watch`: Stage 1.5 resolved docs wording by separating `AppView.PRESENTATIONS` (`/presentations` shell) from `AppView.FULL_STEP6_REPORTS` (`/reports/builder`); owner/runtime evidence is still needed to confirm the direct builder entry does not create a second canonical shell.
- `dormant_runtime_gap`: `WordyView` / `ExceleView` / `PrezentacjeView` are imported in routing layer but not mounted on lane routes, so docs must keep placeholder truth explicit.

## State Handling (As-Is)

- Active tab can be route/query driven (`tab` parsing in outputs hub).
- Hub maintains filters, search, view mode, open documents, and contextual help state.
- Data loading is split by artifact family (`useReports`, `usePresentations`, `useTemplates`, `useArtifactOutputsList`, `useSheetOutputs`).

## Security / Tenant / Governance (As-Is)

- Artifact action targets and governance summaries are fetched through explicit API calls in `useRapData`.
- Review/access actions are explicit user-triggered operations; no hidden route-level artifact mutation branch.
- Outputs lane runs inside authenticated app shell and module production gating.
