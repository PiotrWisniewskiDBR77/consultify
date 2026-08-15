# Module Closure — Decision Draft (48h window)

## Wersja robocza (evidence-first, bez zmian produktowych)

### GREEN / READY FOR INTEGRATION CHECK
1. **My Work**
   - Route: `/my-work/*` -> `MyWorkView` -> `MyWorkHub` (widoczne w `AppRoutes.tsx` + `MENU`)
   - API: `/api/my-work` mount w `server/src/Gateway.ts`, rozdzielone sub-routery
   - Backend: `server/src/routes/my-work/*.routes.ts`
   - Status: `READY_FOR_RUNTIME_CHECK` (druga część: spójność table/preview + e2e demo)

2. **Initiatives**
   - Route: `/initiatives` -> `InitiativesHub`, aliasy do kanonicznego `/initiatives`
   - API: `api` w okręgu `server/src/routes` (initiative routes)
   - Status: `READY_FOR_BLOCKER_CLEANSING` (akcji backend-less, stubs)

3. **Execution**
   - Route: `/execution` -> `ExecutionHub` + V8UnavailableBanner
   - API: m.in. `/api/v8/execution-control`, `/api/finance` etc.
   - Status: `READY_FOR_BLOCKER_CLEANSING` (zmienne gating i non-green tests)

4. **Assessment**
   - Route: `/assessment/*` -> `AssessmentHub`
   - API: `assessment-enterprise.routes.ts` + `assessment` routes
   - Status: `READY_FOR_RUNTIME_CHECK`

### YELLOW / LIMITED / BLOCKED
5. **Results (KPI/ROI/OKR)**
   - Route: `ROUTES.RESULTS` + aliasy `/kpi-okr`, `/benefits`
   - API: `v8/results.routes.ts`
   - UI: `ResultsHub` montowane w kanonicznej trasie
   - Problem: `resultsVNextFeatureFlags` domyślnie OFF i produkcyjna widoczność/surface w UI wymaga potwierdzenia
   - Status: `BLOCKED_DATA` do momentu jednoznacznego seed + demo smoke

6. **Finance**
   - Route: `/finance` i detail routes -> `EconomicsView`
   - API: `/api/finance*`, `/api/v8/finance*` oraz legacy v4 mapy
   - Problem: dualizacja właścicieli (legacy/v3/v2) i duplikacja surface
   - Status: `BLOCKED_ARCHITECTURE`

7. **Materials (Documents/Presentations/Excel)**
   - Route: `/presentations`, `/document-studio`, `/presentation-studio` + redirects/builder
   - API: dokumentacja i presentation routes
   - Status: `READY_FOR_RUNTIME_RECHECK`

8. **Audits**
   - Functional route: `/audit-programs` -> `AuditProgramsHub`; showcase pozostaje oddzielny
   - API: `audit-programs.routes.ts`
   - Problem: częściowo nadal mismatch scope między showcase a lifecycle
   - Status: `BLOCKED_SCOPE`

## Natychmiastowy plan na kolejne 5h

1) Zamknąć definicję koszyków:
- `docs/cleanup/` i `AI_HANDOVER` jako keep;
- `artifacts/` jako quarantine;
- pozostałe REVIEW przejrzeć i przenieść do archive/keep.

2) Dla każdego z modułów z `BLOCKED_*`:
- jednozdaniowy kontrakt produkcyjny, jedna decyzja właściciela, jedna akcja.

3) Nie ruszać routingu/menu poza zgodą — tylko porządnie usuwać duplikaty i martwe ścieżki,
które już są potwierdzone jako nieużywane (bez zmian biznesowych).

4) Twardy gate końcowy: 4052 standard testów + performance jako oddzielny gate + 1:1 fixture proof dla modułów P1.
