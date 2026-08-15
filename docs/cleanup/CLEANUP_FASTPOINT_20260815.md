# FASTPOINT CLEANUP CHECKPOINT — 2026-08-15

## 1) Stan źródła (zablokowane do dalszych zmian produktowych)

- Repo (lokalny): `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`
- HEAD: `635fd2d48d`
- Branch: `codex/sync-demo-20260729`
- Freeze: aktywny (kontynuujemy wyłącznie dokumentację i klasyfikację)
- Test-gate (standard sharded): `f6a00552802d3a5d0f2bbd2c72316c05b55b8f82`
  - `4052/4052` plików
  - `38 798 PASS / 581 FAIL / 485 PENDING / 19 TODO`
  - `0 missing / 0 unexpected`
  - `performance` oddzielnie `PENDING`

## 2) Status drzewa Git (na wejściu do dalszej rekonstrukcji)

- W pracy: `364` pozycji `git status --short`
- Tracked modified: `175`
- Untracked: `189`
- Wrażliwe obszary: `src`, `server`, `tests`, `docs`

## 3) Dowody routingu (krytyczne dla sprzątania kanonu)

### routeConfig (źródło ścieżek)
- `src/routes/routeConfig.ts`:
  - `MY_WORK: '/my-work'`
  - `INITIATIVES: '/initiatives'`
  - `FINANCE: '/finance'`
  - `EXECUTION: '/execution'`
  - `RESULTS: '/results'`
  - `DOCUMENT_STUDIO: '/document-studio'`
  - `PRESENTATIONS: '/presentations'`, `PRESENTATION_STUDIO: '/presentation-studio'`
  - `ASSESSMENT.ROOT: '/assessment'`
  - `AGENT_PLAN: '/agent-plan'`
  - `CASE_STUDIES: '/case-studies'`
  - `AUDITS` entry in assessment subtree: `/assessment/audits`

### AppRoutes (konkretne mounty)
- My Work: route `/my-work/*` => `MyWorkView` w `MainLayout + ProductionModuleGate`
  - stare `/vault` i `/agent-plan` są przekierowaniami do `?tab=`
- Initiatives: `/initiatives` => `InitiativesHub` (plus aliasy `/roadmap`, `/portfolio` -> redirect)
- Execution: `/execution` => `ExecutionHub` (+ `/implementation`, `/rollout` redirecty)
- Finance: `/finance` (+ `/finance/statements/:id`, `/finance/models/:id`) => `EconomicsView`
- Results: `/results` => `ResultsHub`; aliasy `/kpi-okr` i `/benefits` redirect do `/results`
- Assessments: `/assessment/*` => `AssessmentHub` (wiele zakładek)
- Audits: `/audit-programs` + `/audit-programs/drd-report/:reportId` => audit hubs
- Materials: `/presentations`, `/document-studio`, `/presentation-studio`, `/presentations/wizard`, `/presentations/builder/:deckId`

### Sidebar menu (single source navigation)
- `src/components/navigation/Sidebar/menuConfig.ts`:
  - My Work, Interview, Tools, Assessment, Initiatives, Execution, Results, Finance, Materials
  - Audit pod `MODULE_AUDITS` widoczny jako osobny wpis (status badge docelowo do korekty `soon->beta` wg komentarzy)
  - Client Vault i Run agent usunięte jako osobne pozycje, pozostawione jako zakładki My Work

## 4) Dowód backend mountów (najważniejsze endpointy)

- `server/src/Gateway.ts`:
  - `app.use('/api/my-work', myWorkRoutes)`
  - `app.use('/api/finance-v4', deprecationHeader('/api/v8/finance'), financeEnterpriseRoutes)`
  - `app.use('/api/v8/finance', ...financeRoutes)`
  - `deprecationHeader('/api/v8/execution-control')`
  - `app.use('/api/v10/teresa', v10TeresaRoutes)`
- Dedicated routers wykryte m.in.:
  - `server/src/routes/v8/results.routes.ts`
  - `server/src/routes/v8/finance.routes.ts`
  - `server/src/routes/v8/financeValueRoutes.ts`
  - `server/src/routes/assessment-enterprise.routes.ts`
  - `server/src/routes/audit-programs.routes.ts`
  - `server/src/routes/my-work/*` (delegated API set)

## 5) Zapisane klasyfikacje untracked (koszyki robocze)

Pełny manifest: `/tmp/untracked_manifest.tsv` (timestampowy dump wygenerowany dziś).

- `KEEP_DOC_PACKAGE`: AI_HANDOVER, Harvard, *_COMPLETE_*_REPORT, artefakty decyzji/kontrolne, materiały handover
- `KEEP_CLEANUP_DOC`: `docs/cleanup/*` oraz dokumentacja inwentaryzacyjna
- `ARCHIVE_VISUAL` / `QUARANTINE_RUNTIME`: katalog `artifacts/*`, `*.png`, tymczasowe logi i run-artefakty
- `REVIEW`: pozostałe artefakty, do rozstrzygnięcia ręcznie (włączając duże backupy i stare zrzuty)

## 6) Decyzja teraz

- **Nie ruszam** już feature code.
- Następny krok: modułowo domknąć P1 (My Work/Initiatives/Execution/Results/Finance/Materials/Assessment) pod kątem:
  - `route + component + API + menu + feature flag + fixture/demo evidence`.
- Dopiero gdy te decyzje będą spójne przechodzimy do aktywnego clean-tree rebuild (commit-safe, moduł po module).
