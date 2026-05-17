---
module_id: MODULE_OUTPUTS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Outputs Library

## Route / AppView / Sidebar (As-Is)

- Sidebar entry `MODULE_PRESENTATIONS` maps to `AppView.PRESENTATIONS` in `menuConfig.ts`.
- Canonical route in `routeConfig.ts`: `/presentations` (outputs library lane).
- Related routes in `AppRoutes.tsx`:
  - `/presentations` -> `ReportsAndPresentationsHub`
  - `/reports` and `/reports/management` -> redirects to `/presentations?tab=documents`
  - `/reports/builder` (+ `/:reportId`) -> `ReportBuilderView`
  - `/presentations/wizard` -> `PresentationWizard`
  - `/presentations/builder/:deckId` -> `DeckBuilder`
  - shared/embed presentation routes -> `SharedPresentationView`

## Main Component Paths (As-Is)

- `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` — library runtime.
- `src/components/ReportsAndPresentations/useRapData.ts` — outputs registry and origin action data hooks.
- `src/views/ReportBuilderView.tsx`, `src/components/Presentations/PresentationWizard.tsx`, `src/components/Presentations/DeckBuilder/DeckBuilder.tsx`.

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `OUT_LIBRARY_HUB` | `ReportsAndPresentationsHub` | canonical outputs library surface. |
| `OUT_REPORT_BUILDER` | `ReportBuilderView` | report build/edit route surface. |
| `OUT_PRESENTATION_WIZARD` | `PresentationWizard` | guided presentation creation route. |
| `OUT_DECK_BUILDER` | `DeckBuilder` | deck edit route surface. |
| `OUT_SHARED_PRESENTATION` | `SharedPresentationView` | shared/embed presentation surface. |
| `OUT_LEGACY_REPORT_REDIRECT` | route redirect handlers | migration bridge to outputs tabs. |

## API / Services / Models (Confirmable)

- Shared API client and headers: `src/services/api.ts`.
- Outputs data fetch/action hooks: `src/components/ReportsAndPresentations/useRapData.ts` (`/api/artifacts`, `/api/report-builder/*`, `/api/presentations/decks/*` paths).
- Outputs models: `src/components/ReportsAndPresentations/types.ts`.

## Test / Evidence References (Confirmable)

- No dedicated `ReportsAndPresentationsHub` test file found in module folder scan.
- One file matched naming pattern: `src/components/ReportsAndPresentations/TemplatesTabContent.tsx` (not a test file; retained as runtime evidence only).

## Known Gaps (As-Is)

- Core outputs library has no module-local automated tests (`code_gap`).
- Route aliases from legacy reports paths remain active (`duplicate`/migration bridge by design).
