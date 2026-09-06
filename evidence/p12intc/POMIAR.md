# P12-int-c — pomiar i naprawa literałów starego słownika (DEC-424)

Baza: `mvp/p12intc-zapisy-slownik7` od m03 `29992c920b`. Grep pomiaru (bez `--include`, bez
mapowania legacy w `initiativeStatuses.ts`, bez testów):

```
grep -n "'\(EXECUTING\|BLOCKED\|TRACKING\|DONE\|SCHEDULED\|PLANNING\|REVIEW\|PROMOTED\|CANCELLED\|ARCHIVED\|PENDING_REVIEW\)'" \
  server/src/services/initiative/initiativeTransitionService.ts server/src/services/*.ts \
  server/src/controllers/*.ts server/src/routes/**/*.ts
```

Surowy wynik: `00-pomiar-grep-raw.txt` (266 trafień, 98 plików nietestowych po odjęciu `__tests__`/`.test.`).
Kontekst (±2/+1 linii): `00-pomiar-kontekst.txt`.

**WAŻNE — literówka ścieżki w zleceniu.** Zlecenie wskazywało
`server/src/services/initiativeTransitionService.ts`; realny plik leży w
`server/src/services/initiative/initiativeTransitionService.ts` (podkatalog). Ten sam podkatalog
(`services/initiative/`) mieści `initiativeLifecycleCanon.ts` i `initiativeGateReadinessService.ts` —
oba miały własne, poważne fantomy tego samego kształtu, spoza dosłownego zasięgu polecenia grep
(`services/*.ts` nie schodzi do podkatalogów). Zmierzyłem je ręcznie, chodząc za realnym importerem.

## Klasyfikacja 266 trafień

| Kategoria | Liczba (szac.) | Działanie |
|---|---|---|
| Komentarze/dokumentacja (nie kod) | ~40 | brak — nic nie wykonuje się |
| Inny słownik (task.status, decision.status, tool_sessions.status, ai_actions.status, budgets.status, financial_analyses.status, valuations.status, project.status, case.status, KPI mapping/decyzje itd.) | ~185 | poza zakresem P12 (własny, wąski słownik — §2 P12_STATUSY_INICJATYW.md) |
| `initiatives.status` / `initiative` pole — MARTWE (chronione przez CHECK bazy, nieosiągalne) | ~15 | pozostawione (fizycznie nieosiągalne po migracji `20262103_p12`); część naprawiona przy okazji dla higieny (patrz niżej) |
| `initiatives.status` / flaga `on_hold` — ŻYWY BŁĄD (czytane/porównywane z fantomem, realnie psuje wynik) | **29** | **NAPRAWIONE** (lista plik:linia niżej) |

## Naprawione pliki (żywe błędy na słowniku inicjatywy)

| Plik:linia (przed naprawą) | Było | Naprawiono na |
|---|---|---|
| `controllers/InitiativeController.ts:5890,5935` (getGateReadinessCheck) | `['PLANNING','APPROVED']`, `status==='DONE'` | `[PENDING_APPROVAL,APPROVED]`, `status===CLOSED` |
| `controllers/InitiativeController.ts:2958-2969,3002` (getInitiativesByStatus) | filtr statusów bez normalizacji przez SSOT | `normalizeInitiativeStatus()` na wejściu |
| `services/initiative/initiativeLifecycleCanon.ts` (`normalizeInitiativeDbStatusForRead`, `mapDbStatusToP11Lifecycle`) | zwracał literały starego słownika (REVIEW/EXECUTING/DONE); switch kluczował po starych 13 wartościach → default 'intake' dla PENDING_APPROVAL/IN_EXECUTION/CLOSED/REJECTED | zwraca kod słownika 7; switch po nowych kodach |
| `services/initiative/initiativeTransitionService.ts` (`applyDecisionBlockTransitionOnClient`) | brak egzekwowania `INITIATIVE_FLAG_RULES` — on_hold ustawiany z DOWOLNEGO nieterminalnego statusu | odmowa `INITIATIVE_FLAG_INVALID_STATE`, gdy `currentStatus !== IN_EXECUTION` |
| `services/closureDeliveryReceiptService.ts:215` (`ensureReceiptForMaterializedDone`) | `UPPER(i.status)='DONE'` (nigdy nie trafiało) | `=?` z `InitiativeStatus.CLOSED` |
| `routes/initiatives-additive.routes.ts:409,429` | `NOT IN ('CANCELLED','ARCHIVED')` | `<>'REJECTED' AND NOT archived` |
| `routes/my-work.routes.ts:9002-9003,9089-9093` | `IN ('EXECUTING',...)`, `='BLOCKED'` | `='IN_EXECUTION'`, `='IN_EXECUTION' AND on_hold` |
| `routes/pmo/workstreams.routes.ts:122,380` | `IN ('DONE','COMPLETED')` | `='CLOSED'` |
| `services/aiContextBuilder.ts:822,1434,1559` | `NOT IN ('COMPLETED','CANCELLED')`, `='COMPLETED'`/`='CANCELLED'` | `NOT IN ('CLOSED','REJECTED')`, `='CLOSED'`/`='REJECTED'` |
| `services/aiOperatorService.ts:264,1012` | `IN ('ACTIVE','IN_PROGRESS','AT_RISK','BLOCKED','PLANNING')`, `IN ('AT_RISK','BLOCKED')` | `='IN_EXECUTION'`, `='IN_EXECUTION' AND on_hold` |
| `services/aiRiskChangeControl.ts:223,327,400` | `IN ('EXECUTING','APPROVED')` ×3 | `IN ('IN_EXECUTION','APPROVED')` |
| `services/delayDetectionService.ts:110,128,199,248,273,316` | `status==='BLOCKED'`, `NOT IN ('DONE','CANCELLED','ARCHIVED'[,'DRAFT'])`, `status!=='DONE'` ×3 | `on_hold`, `NOT IN ('CLOSED','REJECTED'[,'DRAFT'])` + `NOT archived`, `status!=='CLOSED'` |
| `services/executionBudgetService.ts:396` | `NOT IN ('DRAFT','CANCELLED','ARCHIVED')` | `NOT IN ('DRAFT','REJECTED')` |
| `services/executionControlReadService.ts:43,56,75` | `NOT IN (...)`, `!=='DONE'`, `==='BLOCKED'` | `NOT IN ('CLOSED','REJECTED','DRAFT')`, `!=='CLOSED'`, `on_hold` |
| `services/executiveAggregateService.ts:185,190,737,819` | `='EXECUTING'`, `='BLOCKED'`, `NOT IN ('COMPLETED','DONE')`, `==='BLOCKED'` | `='IN_EXECUTION'`, `='IN_EXECUTION' AND on_hold`, `NOT IN ('CLOSED','REJECTED')`, `on_hold` |
| `services/initiativeGenerationService.ts:1122` | `NOT IN ('ARCHIVED','CANCELLED')` | `<>'REJECTED' AND NOT archived` |
| `services/kpiAttributionService.ts:228-241,250` | `getStatusMultiplier` na starym słowniku (DONE/TRACKING/EXECUTING/PROMOTED/PENDING_REVIEW/BLOCKED/CANCELLED) → zawsze trafiał w domyślne 0.3; `['DONE','TRACKING'].includes()` | przemapowane na 7 kodów + flagę on_hold; `status==='CLOSED'` |
| `services/pmoHealthService.ts:271` | `IN ('blocked','BLOCKED')` | `='IN_EXECUTION' AND on_hold` |
| `services/presentationGeneratorService.ts:1323` | `NOT IN ('CANCELLED','ARCHIVED')` | `<>'REJECTED' AND NOT archived` |
| `services/reportCadenceService.ts:148` | `='EXECUTING'` | `='IN_EXECUTION'` |
| `services/riskDetectionService.ts:137-189,213` | `NOT IN(...)`, `===DONE\|\|===CANCELLED` ×2, `!=='BLOCKED'` | `NOT IN ('CLOSED','REJECTED')`+flaga archived, `===CLOSED\|\|===REJECTED`, `on_hold` |
| `services/stabilizationService.ts:48,84,231-232` | `NOT IN('COMPLETED','CANCELLED')`, `IN(...)`, `='COMPLETED'`/`='CANCELLED'` | `NOT IN('CLOSED','REJECTED')`, `IN(...)`, `='CLOSED'`/`='REJECTED'` |
| `services/stageGateService.ts:339` | `NOT IN ('DONE','CANCELLED')` | `NOT IN ('CLOSED','REJECTED')` |
| `services/statusReportService.ts:271(select),370(data),465-471,519` | `data.status==='BLOCKED'` ×4 | dodano `on_hold` do SELECT/danych, `data.onHold` |
| `services/v8ExecutionControlTowerService.ts:58(INIT_TERMINAL),222,232,329,505` | `Set(['DONE','CANCELLED','ARCHIVED','DRAFT'])`, `NOT IN(...)`×2, `normStatus(i.status)==='BLOCKED'` | `Set(['CLOSED','REJECTED','DRAFT'])`, `NOT IN('CLOSED','REJECTED'[,'DRAFT'])`, `Boolean(i.on_hold)` |

## Poza zakresem — potwierdzone innym słownikiem (próbka zweryfikowana ręcznie)

`AssessmentController.ts`, `ToolController.ts` (status sesji Tools/Assessment — §2 P12 doc, „skrzynki
wejściowe zostają przy swoich wąskich słownikach"), `TaskController.ts`/`ExecutionController.ts`
(status TASKA, nie inicjatywy), `DecisionController.ts` (tylko komentarze), `statusMachine.ts`
(TASK_STATUSES/DECISION_STATUSES/EXECUTION_STAGES — moduł już ujednolicony pod DEC-424, komentarz
na górze pliku), `budgetingService.ts`/`financialAnalysisService.ts`/`valuationService.ts` (własne
tabele budgets/financial_analyses/valuations), `caseWorkspace/*.routes.ts` (case status),
`assessmentPermissionService.ts` (approval-request status), `partnerCommissionService.ts`/
`partnerConfigService.ts`/`partnerReferralService.ts` (partner/commission status),
`presentationBenchmarkTrendService.ts`/`presentationGovernanceCardService.ts`/
`presentationKnowledgeOutlineService.ts`/`presentationStudioSourceArtifactsService.ts` (deck/gate
status), `feedbackDigest.ts`/`feedback.routes.ts` (ticket status), `reportImportService.ts`
(import status), `slaService.ts` (własny agregat na tasks), `sponsorReportService.ts` (report
status), `taskAssignmentService.ts`/`triggerEvaluationService.ts` (task/project status),
`workqueueService.ts` (queue-item status), `aiActionExecutor.ts`/`aiRunLedgerService.ts` (ACTION_STATUS
AI), `wave9OutcomeRuntimeService.ts` (gate decision Wave9), `economics.routes.ts`/`dataExport.routes.ts`/
`ai.routes.ts`/`v8/finance.routes.ts`/`v8/results.routes.ts`/`resultsVnext/kpiRecoveryChildren.routes.ts`
(własne wąskie słowniki analiz/eksportów/KPI recovery). `pmo/initiatives.routes.ts:2702` = status
TASKA w kontekście inicjatywy (`t.status`).

## ZNALEZISKA nie naprawione w tej sesji (zgłoszone jako osobne zadania w tle)

1. **`server/src/services/demo/demoSeedService.ts`** — lokalna, ukryta kopia starego 13-wartościowego
   słownika (`CANONICAL_INITIATIVE_STATUSES`, `LEGACY_INITIATIVE_STATUS_MAP`, funkcja
   `normalizeInitiativeStatus` cieniująca prawdziwy SSOT) używana do budowania wartości wstawianej
   do `initiatives.status` przy seedowaniu demo — grozi naruszeniem `initiatives_status_check_p12`.
   Poza dosłownym zasięgiem zlecenia (`services/demo/` to inny podkatalog). Zadanie w tle:
   `task_63b3e2b9`.
2. **`server/src/services/v8/transformationInitiativeTransitionAdapterService.ts`** — cały silnik
   "early lifecycle proposals" (trasy `/:id/lifecycle-transition-proposals`,
   `/:id/lifecycle-transition-executions`) woła `executeInitiativeTransition` ze starymi kodami
   (PROMOTED/PLANNING/SCHEDULED/EXECUTING/DONE) — KAŻDE wywołanie kończy się teraz
   `UNKNOWN_STATUS`. Wymaga decyzji produktowej (5 domen bramek → maks. 3 granice SSOT, utrata
   rozróżnienia), świadomie zostawione jako Fala 2 wg `P12_STATUSY_INICJATYW.md` §2. Zadanie w tle:
   `task_3b19cd8a`.
3. `getBlockingReadinessItems` (`initiativeGateReadinessService.ts:118-120`) — warunek
   `currentStatus === 'DONE'` (wymóg właściciela biznesowego + KPI przed zamknięciem) jest martwy
   (statusy zapisane w bazie to już `CLOSED`) — osłabia bramkę zamknięcia (nie testowałem/nie
   naprawiłem, poza dosłownym zasięgiem, ale ten sam kształt błędu).
4. `InitiativeManagementView.tsx` (front, poza zasięgiem — grep był server-only) woła
   `/initiatives/by-status/REVIEW` i `/initiatives/by-status/APPROVED` — komponent jest DEAD
   (zero importerów), więc nieszkodliwe. `DiscoveryToolsHub.tsx:1326` woła
   `Api.getInitiativesByStatus` z pełną starą listą 11 statusów — TO JEST żywy wołacz frontendowy;
   backend (naprawiony w tej sesji) teraz normalizuje wejście przez SSOT, więc zapytanie i tak
   zwróci poprawne wiersze, ale front warto policzyć/odchudzić osobno (nie dotykałem front-endu —
   poza zasięgiem tego zlecenia serwerowego).
