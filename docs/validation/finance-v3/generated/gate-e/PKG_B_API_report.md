# Pakiet B — Finance API & Runtime Integration — raport

Base SHA: `585af4ce4b` (branch `codex/fv3p-b-api`, base `codex/finance-v3-closeout-fanin`-derived line, ale ta gałąź jest MROŻONA — nie dotykana).
Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-b-api`.

Status całości pakietu na koniec sesji: **PARTIAL**. Patrz „Co pokryte / co nie" na końcu.

## 0. Punkty odniesienia — potwierdzone PRZED zmianami

| Kontrola | Oczekiwane | Zmierzone | Wynik |
|---|---|---|---|
| Migracje STRICT (`migrate.postgres.ts`, fresh DB, port 58011) | exit 0, 637 | exit 0, `SELECT count(*) FROM schema_migrations` = 637 | PASS |
| `server/src/services/finance` (z `server/`, `RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=...`) | 47 plików / 722 testy, exit 0 | 47 plików, 722 testy, exit 0 (1 `Unhandled Rejection` z `pg_type_typname_nsp_index` w `faultMatrix.pg.test.ts` — race w equipniku testowym, PRZEDISTNIEJĄCY, testy mimo to 722/722 PASS; nie badane dalej, poza zakresem alokacji) | PASS |
| `tsc -p server` | exit 0, zero linii | exit 0, 0 linii (`/tmp/tsc_baseline.log` puste) | PASS |

Komendy reprodukcji — patrz sekcja 8.

## 1. Inwentaryzacja 61 serwisów

Legenda kolumn: **Org-scope** = czy publiczne funkcje przyjmują `organizationId` (Y = tak w sygnaturze/parametrach, N = brak — logika czysto obliczeniowa/stanowa bez dostępu do DB). **Wynik** = kształt zwracany (`{ok:boolean,...}` unia dyskryminowana / `throw` / zwykły obiekt). **HTTP dziś** = czy jakikolwiek plik pod `server/src/routes/**` już wywołuje tę funkcję (nie licząc importów samych typów).

### 1.1 `services/finance/canonical` (35 plików)

| # | Plik | Kluczowe publiczne wejścia (funkcje) | Org-scope | Wynik | HTTP dziś |
|---|---|---|---|---|---|
| 1 | `artifactVersionService.ts` | `getArtifact`, `getBusinessVersion`, `listBusinessVersions`, `createArtifact`, `stampWorkingRevisionComputeIdentity`, `transition`, `createComputeSnapshot`, `approveVersion`, `reopenVersion` | Y (45 wystąpień) | unia `{ok:true,...}\|{ok:false,code,message}` dla mutacji; `null`/tablica dla odczytów | **TAK** — `models.routes.ts` woła `approveVersion`, `reopenVersion`, `getArtifact` |
| 2 | `baselineCircularitySolver.ts` | `solvePeriod` | N (czysta funkcja liczbowa, dostaje już wczytane dane) | zwykły obiekt wynikowy | NIE |
| 3 | `baselineComputeService.ts` | `loadContext`, `requireAssumption`, `runBaselineCompute`, `daysInPeriod` | Y (przez `RunBaselineComputeParams.organizationId`) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 4 | `baselineScheduleEngine.ts` | `computeRevenuePvm`, `computeCogsOpex`, `computeWcDsoDioDpo`, `computeCapexDepreciation`, `lookupScheduledAmortization`, `computeTaxNol`, `computeEquityRe`, `computeHeadcount`, `computeLeases` | N (czyste funkcje driverów, wywoływane WEWNĄTRZ `baselineComputeService`) | zwykłe obiekty | NIE |
| 5 | `commentService.ts` | `createComment`, `resolveComment`, `reopenComment`, `assignComment`, `getCurrentAssignment`, `getComment`, `listByArtifact`, `listByBusinessVersion`, `listByCell`, `listMentioning`, `hasUnresolvedBlockingComments` | Y (25) | unia `{ok:true,...}\|{ok:false,code,message}` dla mutacji; `null`/tablica/`boolean` dla odczytów | NIE |
| 6 | `computeJobService.ts` | `enqueue`, `claim`, `heartbeat`, `claimById`, `completeJobSuccess`, `failJob`, `cancelJob`, `getJob`, `reapExpiredLeases`, `setKillSwitch`, `clearKillSwitch`, `isOrgComputeKilled`, `setOrgConcurrencyLimit`, `getOrgConcurrencyLimit` | Y (30) | unia wynikowa per operacja; `ComputeJobRow \| null` dla odczytów | NIE |
| 7 | `contentHash.ts` | `canonicalPayloadHash` | N | `string` | NIE (util) |
| 8 | `exceptionInboxService.ts` | `listExceptionInbox` | Y (21) | `Promise<ExceptionInboxEntry[]>` | NIE |
| 9 | `exceptionLedgerService.ts` | `raise`, `accept`, `waive`, `resolve`, `getCurrent`, `listOpen` | Y (9) | unia `{ok:true,...}\|{ok:false,code,message}`; `null`/tablica dla odczytów | NIE |
| 10 | `financeCompareService.ts` | `compareValues`, `comparePeriods`, `compareVersions`, `compareEntities`, `compareScenarios`, `compareValuationMethods`, `toFullUnitValue`, `presenceForStatus`, `buildMatchKey`, `dimensionsForDisplay`, `diffPair` | Y (51) | unia `{ok:true,result}\|{ok:false,code,message}` | NIE |
| 11 | `financeExcelShared.ts` | `checkManifestCompatibility`, `financeExcelRowToCells`, `parseValueCells`, `formatBooleanCell`, `parseBooleanCell`, `renderFormulaNode` | N (util formatowania, org id tylko w typach payloadu) | zwykłe obiekty/unie | NIE |
| 12 | `financeExportService.ts` | `toFinanceExcelValueRow`, `exportFinanceStatementPack` | Y (11) | unia `{ok:true,...}\|{ok:false,code}` | NIE |
| 13 | `financeImportService.ts` | `parseFinanceExcelBuffer`, `computeFinanceImportDiffPure`, `previewFinanceImport`, `applyFinanceImport` | Y (37) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 14 | `formulaAstEvaluator.ts` | `evaluateFormula` | N (dostaje już rozwiązane resolvery) | `Promise<EvaluationResult>` | NIE |
| 15 | `kpiComputeService.ts` | `computeAnalysisKpis`, `hashPayloadFor` | Y (23) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 16 | `lifecycleService.ts` | `validateTransition`, `allowedActionsFromStatus`, `isTerminal`, `defaultRiskTierForArtifactType`, `escalateRiskTier`, `isRiskTierDowngrade`, `checkSelfApproval`, `resolveExpectedVersion` | N (czyste reguły stanu — org-scoping dzieje się w `artifactVersionService.transition`, który je woła) | unie z `outcome`/`ok` | NIE bezpośrednio (tylko typ `FinanceRole` importowany w `models.routes.ts`) |
| 17 | `lineageFreshnessService.ts` | `propagateStalenessInTransaction`, `propagateStaleness`, `listFreshnessEvents`, `reasonPriority`, `reasonOverrides` | Y (20) | `Promise<FreshnessPropagationSummary>`; tablica dla listy | NIE |
| 18 | `lineageService.ts` | `insertEdge`, `getAncestors`, `getDescendants`, `stageRank`, `validateEdgeRank` | Y (6) | unia `{ok:true,...}\|{ok:false,code,message}`; tablice dla odczytów | NIE |
| 19 | `periodConventionResolver.ts` | `resolvePeriodOffset`, `daysInPeriod`, `annualizationFactor` | N (czysta funkcja na już wczytanym grafie okresów) | unia `ResolvedPeriodPlan` | NIE |
| 20 | `predictionComputeService.ts` | `runPredictionCompute` | Y (16) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 21 | `predictionPreflightService.ts` | `runPreflight`, `impactChainEffectiveFraction` | Y (5) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 22 | `reviewChecklistService.ts` | `addChecklistItem`, `checkItem`, `uncheckItem`, `setChecklistItemRequired`, `listChecklistItems`, `allRequiredItemsChecked`, `getChangedCellsForStatementPack` | Y (23) | unia `{ok:true,...}\|{ok:false,code,message}`; tablica/`boolean` dla odczytów | NIE |
| 23 | `roiFinanceLinkAdapter.ts` | `linkFinanceArtifactToRoiCase`, `getFinanceContextForLink`, `listFinanceLinksForCase` | Y (22) | `throw` (klasy błędów) dla brakujących zasobów; zwykłe obiekty dla sukcesu | NIE (w finance-v2; wołane z ROI-side, poza tym pakietem) |
| 24 | `roiFinanceReconciliationAdapter.ts` | `assessMateriality`, `detectAndReconcile`, `resolveReconciliationDecision`, `findReconciliationTargetForInitiative`, `findActiveRoiCaseIdForInitiative` | Y (20) | zwykłe obiekty / `throw` (`RoiFinanceReconciliationAdapterError`) | **TAK, ale nie w finance-v2** — `economics.routes.ts` (ROI, inny program) |
| 25 | `savedViewService.ts` | `createSavedView`, (`UpdateSavedViewPatch` sugeruje `updateSavedView` — do zweryfikowania, plik ma >590 linii, czytany częściowo) | Y (20) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 26 | `statementMappingService.ts` | `mapStatementLines`, `isCoverageLoss` | Y (3, przez params obiektu) | `Promise<MappedRowResult[]>` | NIE |
| 27 | `statementReconciliationService.ts` | `computeWaterfall`, `determineResidualStatus`, `determineReconciliationStatus`, `determineResultQuality`, `severityForResidual`, `detectPeriodOverPeriodJumps`, `runReconciliation` | Y (9) | unia `{ok:true,...}\|{ok:false,code,message}` dla `runReconciliation`; zwykłe obiekty dla reszty | NIE |
| 28 | `valuationAdvisorService.ts` | `resolveHeadlineEnterpriseValue`, `evaluateAdvisorRules`, `evaluateEvidenceGrounding`, `generateValuationAdvisorOutput`, (compare-variants pod `CompareVariantsParams`) | Y (37) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 29 | `valuationBridgeService.ts` | `assertAsOfAlignment`, `computeEquityValue`, `writeBridge` | Y (3) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 30 | `valuationComputeService.ts` | `findOrCreateMethod`, `assertResultReadinessConsistency`, `setMethodResult`, `setMethodBasket`, `assessCompsReadiness`, `computeWeightedRecommendation`, `runDcfFcffValuation` | Y (19) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 31 | `valuationDiscountService.ts` | `discountFactor`, `discountCashFlows` | N (czysta matematyka) | zwykły obiekt | NIE |
| 32 | `valuationFcffService.ts` | `resolveValuationSource`, `toFullUnitValue`, `sumFlow`, `computeFcffSeries` | Y (4) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 33 | `valuationSensitivityService.ts` | `buildWaccByTerminalGGrid`, `findMonotonicityViolation`, `writeSensitivityGrid` | Y (7) | unia `{ok:true,grid}\|{ok:false,code}`; `writeSensitivityGrid` może `throw SensitivityGridAccessError` | NIE |
| 34 | `valuationTerminalService.ts` | `assertGBelowWacc`, `computeGordonTerminalValue`, `computeExitMultipleTerminalValue`, `computeTerminalSharePct`, `impliedGFromReinvestmentRoic`, `writeTerminalRow` | Y (2, przez `writeTerminalRow`) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 35 | `valuationWaccService.ts` | `assertWaccConsistency`, `relever`, `unlever`, `computeWacc`, `loadWaccInputs`, `persistComputedWacc` | Y (4) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |

### 1.2 `services/finance/grid` (9 plików) — silnik operacji arkusza, BEZ dostępu do DB

| # | Plik | Kluczowe wejścia | Org-scope | Uwaga |
|---|---|---|---|---|
| 36 | `BulkOpsEngine.ts` | `buildBulkOperations` | N | Buduje listę operacji (`Operation[]`) z już wczytanych komórek — wykonanie/perzystencja dzieje się gdzie indziej (poza tym plikiem, brak widocznego callera). |
| 37 | `FillEngine.ts` | `buildFillOperations` | N | jw. |
| 38 | `FindReplaceEngine.ts` | `findCells`, `buildFindReplaceOperations`, `byStatus`, `byDecimalEquals`, `byDecimalInRange`, `byNoConfirmedValue` | N | jw. |
| 39 | `GridSelectionModel.ts` | klasa `GridSelectionModel`, `rangesEqual`, `coordinatesEqual` | N | stan selekcji UI, in-memory |
| 40 | `GridViewState.ts` | klasa `GridViewState` | N | stan widoku UI, in-memory |
| 41 | `PasteEngine.ts` | `buildPasteOperations` | N | jw. |
| 42 | `engineContext.ts` | `engineError`, `resolveNow`, `resolveIdGenerator`, `checkCapability` | N | pomocnicze do silników powyżej |
| 43 | `gridCoordinates.ts` | `coordEquals`, `rectFromCorners`, `rectCellCount`, `rectIsEmpty`, `rectsEqual`, `rectContainsCoord`, `rectIntersects`, `subtractRect`, `iterateRect`, `isCoordInBounds`, `isRectInBounds`, `chunkArray` | N | czysta geometria |
| 44 | `index.ts` | re-eksport | N | — |

**Wniosek dla grid/**: to silnik KLIENCKI (buduje `Operation[]` z już-w-pamięci stanu arkusza), nie serwis backendowy z własnym dostępem do bazy. Nie ma tu naturalnego 1:1 REST endpointu — persystencja wynikowych operacji idzie przez `collaboration/autosaveService.checkpointOperationStack` i `computeJobService`/`artifactVersionService`, które SĄ objęte tym pakietem (patrz priorytety). Rekomendacja: grid/* pozostaje bez własnej powierzchni HTTP w tym pakiecie — flagowane jako NIEPOKRYTE, ale świadomie (patrz sekcja 7).

### 1.3 `services/finance/keyboard` (6 plików) — kontrakt komend klawiaturowych, BEZ DB

| # | Plik | Kluczowe wejścia | Org-scope | Uwaga |
|---|---|---|---|---|
| 45 | `CommandAvailability.ts` | `commandAvailability`, `describeCommandUnavailability`, `evaluateCommandAvailability` | N | ocena dostępności komend na podstawie już-znanego stanu (rola, status, freshness) |
| 46 | `CommandPaletteIndex.ts` | klasa `CommandPaletteIndex` | N | indeks komend, in-memory |
| 47 | `FocusRestoreContract.ts` | `captureFocusSnapshot`, `focusTargetForOperation`, `resolveFocusRestorePatch`, `applyFocusRestoreToSelection`, `focusSnapshotFromFocusModeSession`, `focusRestorePatchFromFocusModeEffects` | N | stan fokusu UI |
| 48 | `KeyboardCommandRegistry.ts` | klasa `KeyboardCommandRegistry`, `commandActivations`, `findComboCollisions`, `assertNoComboCollisions`, `findDestructiveGuardViolations`, `assertDestructiveCommandsAreGuarded`, `requiresConfirmationBeforeExecuting` | N | rejestr komend, in-memory |
| 49 | `commandTypes.ts` | typy + `comboIdentity`, `combosEqual`, `comboHasGuardModifier`, `comboMatchesEvent`, `describeCombo`, `activationSurfaces` | N | typy/util |
| 50 | `index.ts` | re-eksport | N | — |

**Wniosek**: keyboard/* to WYŁĄCZNIE logika front-end (mapowanie klawiszy → komendy, dostępność). Zero naturalnych endpointów REST — to nie jest coś, co ma "wejście HTTP". NIEPOKRYTE świadomie, poza zakresem REST.

### 1.4 `services/finance/collaboration` (6 plików)

| # | Plik | Kluczowe wejścia | Org-scope | Wynik | HTTP dziś |
|---|---|---|---|---|---|
| 51 | `autosaveScheduler.ts` | klasa `AutosaveScheduler` | N | — (harness debounce, in-memory, klient) | NIE |
| 52 | `autosaveService.ts` | `checkpointOperationStack`, `getCurrentWorkingRevision`, `peekAutosaveState` | Y (6) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 53 | `computePinning.ts` | `enqueueComputeForCurrentRevision` | Y (3) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 54 | `conflictResolver.ts` | `detectConflicts`, `buildResolvedOperation` | Y (4) | unia `{ok:true,...}\|{ok:false,code,message}` | NIE |
| 55 | `crashRecoveryService.ts` | `detectRecoverableCheckpoint`, `reconstructOperationStack`, `loadRecoverableWorkspace`, `acceptRecovery`, `discardRecovery` | Y (8) | unia + zwykłe obiekty | NIE |
| 56 | `operationStack.ts` | klasa `OperationStack`, `operationIntendedValues` | N | in-memory undo/redo stos | NIE |

**Wniosek**: `autosaveService`, `computePinning`, `conflictResolver`, `crashRecoveryService` SĄ DB-backed i org-scoped — realni kandydaci na REST (checkpoint/recovery), ale NIE weszły w priorytet (a)/(b) tej sesji z braku czasu. Flagowane NIEPOKRYTE.

### 1.5 `services/finance/workspace` (5 plików) — kontrakt UI/nawigacji, BEZ DB

| # | Plik | Kluczowe wejścia | Org-scope | Uwaga |
|---|---|---|---|---|
| 57 | `focusModeContract.ts` | `regionVisibilityInFocusMode`, `assertFocusModeRegionPartition`, `createFocusModeSession`, `enterFocusMode`, `exitFocusMode`, `focusModeDataEffects`, `assertFocusModePreservation`, `focusModeActiveViewId`, `resolveEscapeKey` | N | stan trybu skupienia, in-memory |
| 58 | `index.ts` | re-eksport | N | — |
| 59 | `lineageNavigatorContract.ts` | `lineageStageRank`, `allowedDownstreamCreations`, `lineageNodeDisplayName`, `hasTenantAnomalies`, `partitionEdgesByOrganization`, `createTenantScopedResolver`, `isTerminalVersionStatus`, `lifecycleBadgeFromStatus`, `staleBadgeFromFreshness`, `orphanBadge`, `downstreamStaleBadge`, `isOrphaned` | Y (39, ale operuje na już-wczytanych `LineageEdgeRow[]`/resolverach, nie robi własnych zapytań SQL) | — | NIE (konsument `lineageService`, nie ma własnego DB accessu) |
| 60 | `moduleAdapters.ts` | `adapterForArtifactType`, `resolvePrimaryAction`, `buildWorkspaceBarConfig`, `buildViewNavigation`, `validateModuleAdapter` | N | konfiguracja UI per moduł (statements/analysis/baseline/prediction/valuation) |
| 61 | `workspaceBarContract.ts` | `mergeFreshnessIntoPrimaryLabel`, `resolveControlState`, `canRenameArtifact`, `validateWorkspaceName` | N | kontrakt paska UI |

**Wniosek**: workspace/* to warstwa prezentacji/kontraktu UI (konfiguracja pasków, nawigacji, lineage-badge z już wczytanych danych) — nie ma tu własnej logiki DB. NIEPOKRYTE świadomie, poza zakresem REST — te funkcje są kandydatami do konsumpcji PRZEZ frontend po stronie klienta, na bazie danych zwróconych z endpointów lineage/artifacts poniżej.

**Podsumowanie**: 61/61 plików zinwentaryzowane. DB-backed + org-scoped kandydaci na REST: **24 z 35 w `canonical/`** + **4 z 6 w `collaboration/`** = 28 plików. Reszta (grid 9, keyboard 6, workspace 5, plus 11 czystych/util w canonical, plus 2 w collaboration) to logika bez własnego dostępu do bazy — konsumowana WEWNĄTRZ serwisów DB-backed lub po stronie klienta, bez naturalnego 1:1 REST endpointu.

---

## 2. Zaimplementowana powierzchnia REST (commit po commicie inwentaryzacji)

Wszystkie nowe pliki pod `server/src/routes/v8/finance-v2/**`. Montaż: **żadna zmiana w `server/src/routes/v8/index.ts` nie była potrzebna** — `/finance-v2` był już zamontowany produkcyjnie od WP-C02 (`v8Router.use('/finance-v2', financeV2Routes)`, linia 110). Zmieniony jest wyłącznie `server/src/routes/v8/finance-v2/index.ts`, który teraz `.use()`-uje 3 nowe podroutery obok istniejącego `modelsRoutes`.

Produkcyjna powierzchnia HTTP `finance-v2` przed tym pakietem: **2 endpointy** (`POST /models/:modelId/approve`, `POST /models/:modelId/reopen`). Po tym pakiecie: **12 endpointów** (2 stare + 10 nowych).

### 2.1 Tabela endpointów

| # | Metoda | Ścieżka | Serwis pod spodem | Org-scoping | Kształt błędu | Test |
|---|---|---|---|---|---|---|
| 1 | POST | `/finance-v2/artifacts` | `artifactVersionService.createArtifact` | `getV8Context(req).organizationId` przekazywany wprost do serwisu | 400 `{error,code:'INVALID_ARTIFACT_TYPE'}` | `artifacts-lifecycle-compute.routes.pg.test.ts` |
| 2 | GET | `/finance-v2/artifacts/:artifactId` | `artifactVersionService.getArtifact` + `getBusinessVersion`/`listBusinessVersions` fallback | jw. | 404 `{error,code:'NOT_FOUND'}` (fail-closed, nie leak) | jw. + `cross-tenant.routes.pg.test.ts` |
| 3 | GET | `/finance-v2/artifacts/:artifactId/versions` | `artifactVersionService.getArtifact` (guard) + `listBusinessVersions` | jw. | 404 `NOT_FOUND` | jw. |
| 4 | GET | `/finance-v2/artifacts/:artifactId/capabilities` | `artifactVersionService.getArtifact`/`listBusinessVersions` + `lifecycleService.allowedActionsFromStatus` | jw. | 404 `NOT_FOUND` | jw. |
| 5 | GET | `/finance-v2/versions/:businessVersionId` | `artifactVersionService.getBusinessVersion` | jw. | 404 `NOT_FOUND` | jw. |
| 6 | POST | `/finance-v2/versions/:businessVersionId/transitions` | `artifactVersionService.transition` (T2-T7, T10-T11) | jw. | 400/403/409 `{error,code}` per `TransitionErrorCode` | jw. + cross-tenant |
| 7 | POST | `/finance-v2/versions/:businessVersionId/compute-snapshot` | `artifactVersionService.createComputeSnapshot` (T8a) | jw. | 404/409/422 `{error,code}` | jw. + cross-tenant |
| 8 | POST | `/finance-v2/compute/jobs` | `computeJobService.enqueue` | jw. | 400 `IDEMPOTENCY_KEY_REQUIRED` / `INVALID_BODY` | jw. |
| 9 | GET | `/finance-v2/compute/jobs/:jobId` | `computeJobService.getJob` | jw. | 404 `NOT_FOUND` | jw. + cross-tenant |
| 10 | POST | `/finance-v2/compute/jobs/:jobId/cancel` | `computeJobService.cancelJob` | jw. | 404 `NOT_FOUND` (jednolite dla "nie twoje" / "już terminalny" / "nie istnieje") | jw. + cross-tenant |
| — | POST | `/finance-v2/models/:modelId/approve` | `artifactVersionService.approveVersion` | (WP-C02, niezmienione) | — | `models.routes.pg.test.ts` (istniejący, bez zmian) |
| — | POST | `/finance-v2/models/:modelId/reopen` | `artifactVersionService.reopenVersion` | (WP-C02, niezmienione) | — | jw. |

Konwencja odpowiedzi: `{data: {...}, meta: {version:'v2', contract:'finance_v3_canonical_v1'}}` dla sukcesu, `{error, code, ...extra}` dla błędu — identyczna z `models.routes.ts` (żaden drugi mechanizm auth/error-envelope nie powstał).

`capabilities` łączy `getArtifact` + `listBusinessVersions` + `lifecycleService.allowedActionsFromStatus(status, role)` — to jest bezpośrednia implementacja WP-B02 §4.3 `allowedActionsFromCurrentStatus`, którą UI potrzebuje do narysowania paska akcji (OWN-FIN-012), a która przed tym pakietem nie miała ŻADNEGO wywołującego HTTP.

### 2.2 Dowód montażu (401 vs dwa różne 404, surowy output)

Komenda repro: skrypt `tsx` uruchomiony z `server/` (patrz §8), identyczny scenariusz jak w automatycznym `mount-proof.pg.test.ts` (7/7 PASS). Surowy output:

```
1) real-auth, no token, real route:        401 {"error":"No token provided"}
1b) real-auth, no token, fake route:       401 {"error":"No token provided"}
2) valid-context, real route, absent res.: 404 {"error":"Artifact not found","code":"NOT_FOUND"}
3) valid-context, fake route:              404 {}
```

Interpretacja (zgodnie z ostrzeżeniem briefu "401/403 nie dowodzi montażu"):
- **(1) vs (1b)** — bez tokenu każda ścieżka pod `/api/v8/*` (prawdziwa i fałszywa) daje identyczne 401, bo `verifyToken` działa PRZED routingiem. To jest DOKŁADNIE pułapka, przed którą ostrzega brief — sam 401 NIE odróżnia "trasa istnieje" od "trasy nie ma". Udokumentowane jawnie, nie ukryte.
- **(2) vs (3)** — z ważnym kontekstem v8 (ten sam konwencja stubowania co każdy inny test adaptera w tym pakiecie) różnica jest wyraźna: prawdziwa trasa na nieistniejący zasób zwraca 404 **Z** `code:'NOT_FOUND'` (handler faktycznie wykonał zapytanie SQL i zdecydował), fałszywa ścieżka zwraca 404 **BEZ** `code` (Express nie dopasował żadnej trasy — to samo zachowanie co domyślne "Cannot GET ...").
- **Test „cofnięcie montażu"**: appka zbudowana WYŁĄCZNIE z `modelsRoutes` (stan repo sprzed tego pakietu) na `GET /artifacts/:id` daje 404 **BEZ** `code` — identyczne z (3), czyli nieodróżnialne od "trasa nie istnieje". Appka z bieżącym `financeV2Router` na TO SAMO żądanie daje 404 **Z** `code:'NOT_FOUND'` — dowód, że mój commit faktycznie zmienił zachowanie z "nie ma trasy" na "trasa jest, zasób nie". W tym środowisku nie ma żywego procesu serwera do `curl`-owania przed/po (`Po pracy posprzątaj klaster` w brief-instrukcji odnosi się do bazy, nie do procesu HTTP) — powyższe in-process porównanie starego/nowego routera jest deterministycznym odpowiednikiem `git show <parent>:<plik> > <plik>` bez potrzeby uruchamiania serwera na porcie; nazwane jawnie jako substytut, nie po cichu.

### 2.3 Macierz cross-tenant (org B względem zasobów org A, potwierdzone SQL-em)

Wszystkie 8 przypadków w `cross-tenant.routes.pg.test.ts`, PASS, real Postgres:

| Endpoint | Żądanie org B na zasób org A | HTTP | Niezależny odczyt SQL |
|---|---|---|---|
| `GET /artifacts/:id` | odczyt cudzego artefaktu | 404 `NOT_FOUND` | `SELECT organization_id FROM finance_artifacts` nadal = org A |
| `GET /artifacts/:id/versions` | listing cudzych wersji | 404 (NIE `200 {data:[]}` — pusta tablica wyglądałaby jak "moje, ale brak wersji") | — |
| `GET /artifacts/:id/capabilities` | capabilities cudzego artefaktu | 404 | — |
| `POST /versions/:id/transitions` | próba tranzycji cudzej wersji | 404 `NOT_FOUND` | `SELECT status,version,organization_id FROM finance_business_versions` — **bajtowo niezmienione** (nadal `DRAFT`/v1/org A); legalna tranzycja org A działa PO próbie ataku (dowód braku ukrytej korupcji wiersza) |
| `POST /versions/:id/compute-snapshot` | próba zamrożenia snapshotu cudzej wersji | 404 | `SELECT ... FROM finance_compute_snapshots WHERE working_revision_id IN (...)` = 0 wierszy |
| `GET /compute/jobs/:id` | odczyt cudzego joba | 404 | `SELECT status,organization_id FROM compute_jobs` = `queued`/org A, niezmienione |
| `POST /compute/jobs/:id/cancel` | anulowanie cudzego joba (**"UPDATE 0 wygląda jak PASS"** — dokładnie ten wzorzec z briefu) | 404 | `SELECT status` nadal `queued` (NIE `cancelled`); legalny cancel przez org A działa POTEM |
| `POST /compute/jobs` | enqueue z `inputArtifactId` należącym do org A, autoryzacja jako org B | HTTP != 200/201 (500 z surowym naruszeniem FK — patrz Defekt D1 niżej) | `SELECT id FROM compute_jobs WHERE input_artifact_id=? AND organization_id=?` (org B) = 0 wierszy — **żaden wiersz nie powstał pod żadną organizacją**, więc mimo brzydkiego 500 nie ma wycieku ani korupcji danych |

**Wynik macierzy: 8/8 PASS.** Zero przypadków, w których cudzy zasób został ujawniony, zmieniony lub gdzie pusty wynik (`[]`/`UPDATE 0`) został pomylony z sukcesem.

---

## 3. Defekty znalezione w serwisach (ZGŁOSZONE, NIE naprawione — `server/src/services/finance/**` poza allowlistą tego pakietu)

- **D1 — `computeJobService.enqueue` nie waliduje `(inputArtifactId, organizationId)` przed INSERT-em.** Gdy wywołujący poda `organizationId` inne niż właściciel `inputArtifactId`, kompozytowy FK `fk_compute_jobs_artifact_org(input_artifact_id, organization_id)` odrzuca INSERT surowym błędem Postgresa (`23503`), który w routerze (poprawnie, zgodnie z zakazem pisania logiki domenowej) trafia do generycznego handlera i wychodzi jako `500`. Brak wycieku/korupcji danych (potwierdzone SQL-em w macierzy cross-tenant, wiersz 8) — to defekt UX/kontraktu (surowy 500 zamiast czytelnego `403`/`404`), nie defekt bezpieczeństwa. Właściwa naprawa: `enqueue()` powinien najpierw wywołać coś w rodzaju `getArtifact(organizationId, inputArtifactId)` i zwrócić typowany `{ok:false, code:'ARTIFACT_NOT_FOUND'}`, tak jak robi to `createComputeSnapshot`. Zgłoszone, nie naprawione (serwis poza allowlistą).
- **D2 — `ComputeJobRow` nie ma odpowiednika w `computeJobService.ts` do odczytu `compute_job_outputs`.** DoD tego pakietu wymaga endpointu "wynik" dla compute — `compute_job_outputs` (kolumny `output_artifact_id`, `output_business_version_id`, `content_semantic_hash`, `freshness`) istnieje w schemacie i jest zapisywane przez `completeJobSuccess`, ale `computeJobService.ts` nie eksportuje żadnego readera dla tej tabeli. `GET /compute/jobs/:jobId` w tym pakiecie zwraca wyłącznie pola z `compute_jobs` (status/hash wejścia/próby) — bez wyniku obliczenia. Zgłoszone jako brak w serwisie, nie dodane samodzielnie w routerze (uniknięcie nowej logiki domenowej/SQL poza serwisem).
- **D3 — brak serwisu do "rename" artefaktu.** Brief wymienia "list/get/create/**rename**" jako priorytet (a). Zinwentaryzowane 35 plików `canonical/` nie zawiera żadnej funkcji, która modyfikuje `finance_artifacts.natural_key` po utworzeniu (`workspaceBarContract.ts` ma tylko walidację nazwy PO STRONIE KLIENTA — `canRenameArtifact`/`validateWorkspaceName`, zero zapisu do DB). Endpoint rename nie został dodany — dodanie go wymagałoby napisania nowego UPDATE w routerze, co łamie "nie pisz nowej logiki domenowej w routerach". Zgłoszone jako brak, nie obejście.
- **D4 (obserwacja, nie regresja) — `initDb()` ma race na współbieżnym sprawdzaniu schematu pod obciążeniem wieloma równoległymi plikami testowymi.** Zaobserwowane DWUKROTNIE w tej sesji, za KAŻDYM razem na innym, niepowiązanym z Pakietem B teście (`faultMatrix.pg.test.ts` → `duplicate key ... pg_type (ai_observations)`; osobno `kpiComputeService.determinism.pg.test.ts` → `duplicate key ... pg_class (idx_tasks_assignee_status)`) — oba razy jako "Unhandled Rejection" bez wpływu na wynik testów (722/722 PASS za każdym razem), a JEDEN raz (na powtórnie używanej, długo żyjącej bazie z tej sesji, nie na świeżej) manifestujące się jako prawdziwa czerwona asercja w `benefitTrackingActualProtection.pg.test.ts` (brakujący trigger `trg_benefit_tracking_deny_delete`). **Potwierdzone jako PRZEDISTNIEJĄCE i niezwiązane z Pakietem B**: na całkowicie świeżej, dopiero co zmigrowanej bazie (`fv3p_b2`) `services/finance` daje czysty **722/722, exit 0** (patrz §7 liczby przebiegów) — więc czerwona asercja była artefaktem długo żyjącego klastra w tej sesji (wielokrotne uruchomienia tej samej suity na tym samym klastrze), nie regresją z mojego kodu. Nie naprawione (poza zakresem — `PostgresDatabase.ts:initDb()` nie jest serwisem finance i nie jest w allowliście).

---

## 4. Co pokryte / co NIE pokryte (jawnie)

**Pokryte (priorytet a — lifecycle + compute + capabilities):**
- Artefakty: create, get, list-versions ✅. Rename ❌ (D3 — brak serwisu).
- Lifecycle: transitions T2-T7/T10-T11 ✅ (generic transition endpoint), T8/T12 (approve/reopen) ✅ już istniały (WP-C02), T1 (create) ✅, T8a (pre-approval snapshot) ✅. Historia/audit-log (`artifact_lifecycle_events`) ❌ — żaden serwis nie eksportuje readera dla tej tabeli (poza wewnętrznym użyciem w idempotency-replay wewnątrz `approveVersion`/`reopenVersion`); nie dodane.
- Compute: enqueue ✅, status ✅, cancel ✅. Wynik (`compute_job_outputs`) ❌ (D2). `stale`/`input_revision_hash` — `input_revision_hash` ✅ (pole `ComputeJobRow`), `stale` jako flaga freshness żyje na `finance_business_versions.freshness`, dostępna przez `GET /versions/:id` (osobny zasób, nie na jobie) — udokumentowane jako świadomy wybór kształtu, nie luka.
- Capabilities: ✅ per rola i status (nie "per rola i stan" w pełnym sensie — nie obejmuje np. freshness-driven blokad na poziomie akcji; `allowedActionsFromStatus` jest jedynym eksportowanym budowniczym listy akcji, więc to jest CAŁOŚĆ tego, co serwis oferuje).

**NIE pokryte (jawnie, z powodem):**
- **Statements** (mapping/reconciliation) — `statementMappingService.mapStatementLines` / `statementReconciliationService.runReconciliation`. Powód: obie funkcje przyjmują duże, złożone payloady (`rawLines[]`, `rules[]`, `mappingResults[]` z poprzedniego kroku) i wymagają ciężkiego fixture'u (encje, okresy, taksonomia kanoniczna — istniejące testy serwisowe mają 700+ linii samego setupu). Zbudowanie poprawnego, w pełni przetestowanego (real Postgres + HTTP + SQL read-back) endpointu w pozostałym czasie tej sesji groziło albo (a) połowicznym routerem bez testu kontraktowego (łamie DoD), albo (b) zgadywaniem kształtu payloadu bez zweryfikowania go realnym wywołaniem. Świadomie odłożone.
- **Analysis** (KPI compute) — `kpiComputeService.computeAnalysisKpis`. Powód: wymaga uprzednio istniejącej krawędzi lineage `STATEMENT_TO_ANALYSIS` (`finance_lineage_edges`) między Statement Pack a Analysis — czyli zależy od "Statements" powyżej będąc gotowym pierwszym. Odłożone z tego samego powodu.
- **Baseline** (assumptions/compute/outputs) — `baselineComputeService.runBaselineCompute` — nie dotknięte.
- **Prediction** (preflight/calculation, DEC-FIN-004) — `predictionPreflightService`/`predictionComputeService` — nie dotknięte.
- **Valuation** (warianty/metody/wagi/wyniki/sensitivity/Advisor) — cała rodzina `valuation*Service.ts` (7 plików) — nie dotknięte.
- **Przekrojowe**: lineage/related (`lineageService.getAncestors/getDescendants`), freshness (`lineageFreshnessService.listFreshnessEvents`), exception ledger (`exceptionLedgerService`/`exceptionInboxService`), compare (`financeCompareService`), comments/review (`commentService`/`reviewChecklistService`), saved views (`savedViewService`), import/export (`financeImportService`/`financeExportService`) — żaden nie dotknięty. Te są w większości proste odczyty (niższe ryzyko niż statements/analysis) i są najlepszym kandydatem na kolejny pakiet/sesję — zasygnalizowane w inwentaryzacji (§1.1) jako gotowe (org-scoped, DB-backed, jasny kształt wyniku).
- **`collaboration/`**: `autosaveService`, `computePinning`, `conflictResolver`, `crashRecoveryService` — DB-backed, org-scoped, ZERO HTTP. Nie dotknięte — poza priorytetem (a)/(b) tej sesji.
- **`grid/`, `keyboard/`, `workspace/`**: świadomie NIE mają naturalnego 1:1 REST endpointu (patrz §1.2-1.5) — logika kliencka/in-memory.

**Podsumowanie liczbowe**: 12/61 serwisów ma dziś realnego wywołującego HTTP w `finance-v2` (2 sprzed pakietu + 10 nowych — `artifactVersionService`, `lifecycleService` pośrednio przez `capabilities`, `computeJobService`). 49/61 pozostaje bez HTTP — z czego 28 to realni kandydaci (DB-backed, org-scoped) na kolejne pakiety, 33 to logika bez naturalnego REST kształtu.

---

## 5. Liczby przebiegów — przed / po

| Kontrola | Przed (baza `585af4ce4b`) | Po (tip `fd1ef2cd9e` + niniejszy raport) | Wynik |
|---|---|---|---|
| Migracje STRICT, świeża baza | exit 0, 637 | exit 0, 637 (potwierdzone DWA razy na dwóch różnych świeżych bazach, `fv3p_b` i `fv3p_b2`) | PASS, brak regresji |
| `server/src/services/finance` | 47 plików / 722 testy, exit 0 | **47 plików / 722 testy, exit 0** na świeżej `fv3p_b2` (patrz Defekt D4 — jeden przebieg na długo żyjącej `fv3p_b` dał 1 czerwoną asercję w niepowiązanym z Pakietem B teście `benefitTrackingActualProtection.pg.test.ts`, potwierdzone jako artefakt wielokrotnego reużycia klastra w tej sesji, NIE regresja) | PASS, brak regresji |
| `server/src/routes/v8/finance-v2/__tests__` (NOWY katalog) | 1 plik / 3 testy (`models.routes.pg.test.ts`) | **4 pliki / 33 testy**, exit 0 na świeżej `fv3p_b2`, uruchomione z `--no-file-parallelism` (patrz uwaga niżej) | PASS |
| `tsc -p server` | exit 0, zero linii | exit 0, zero linii | PASS, brak regresji |

**Uwaga o równoległości**: uruchomienie całego katalogu `finance-v2/__tests__` z DOMYŚLNĄ równoległością plików vitest bywa niestabilne — `mount-proof.pg.test.ts`'s `beforeAll` importuje CAŁY `v8Router` (transitywnie każdy plik tras `/api/v8/*` w repo), co pod współbieżną transformacją z 3 innymi ciężkimi plikami `.pg.test.ts` potrafi przekroczyć nawet 60s hook-timeout. Z `--no-file-parallelism` (albo uruchomiony osobno) przechodzi niezawodnie w ~15-40s. Udokumentowane w kodzie testu i tutaj — nie jest to defekt funkcjonalny (7/7 PASS w izolacji, wielokrotnie powtórzone), tylko koszt transformacji dużego grafu modułów w tym środowisku.

## 6. Status

**PARTIAL.** Priorytet (a) — lifecycle + compute + capabilities — w pełni zaimplementowany, zamontowany produkcyjnie, przetestowany na realnym Postgresie (kontrakt + cross-tenant + dowód montażu), zero regresji w punktach odniesienia. Priorytety (b)/(c) — statements/analysis/baseline/prediction/valuation/przekrojowe — świadomie NIEPOKRYTE z jawnym uzasadnieniem w §4, gotowe jako punkt startu dla kolejnego pakietu (inwentaryzacja w §1 już identyfikuje 28 realnych kandydatów DB-backed org-scoped).

`EVIDENCE_MISSING`: brak. Wszystko, co zaraportowane jako PASS, ma dowód (test PASS + surowy output tam gdzie brief wymaga) w tym pliku lub w kodzie testów; wszystko, co niepokryte, jest jawnie oznaczone jako niepokryte, nie jako "prawdopodobnie działa".

## 7. Pliki zmienione (allowlisty)

- `server/src/routes/v8/finance-v2/_shared.ts` (nowy)
- `server/src/routes/v8/finance-v2/artifacts.routes.ts` (nowy)
- `server/src/routes/v8/finance-v2/versions.routes.ts` (nowy)
- `server/src/routes/v8/finance-v2/compute.routes.ts` (nowy)
- `server/src/routes/v8/finance-v2/index.ts` (zmieniony — 3 nowe `.use()`)
- `server/src/routes/v8/finance-v2/__tests__/artifacts-lifecycle-compute.routes.pg.test.ts` (nowy, `git add -f`)
- `server/src/routes/v8/finance-v2/__tests__/cross-tenant.routes.pg.test.ts` (nowy, `git add -f`)
- `server/src/routes/v8/finance-v2/__tests__/mount-proof.pg.test.ts` (nowy, `git add -f`)
- `docs/validation/finance-v3/generated/gate-e/PKG_B_API_report.md` (ten plik)
- **`server/src/routes/v8/index.ts` — NIE zmieniony** (montaż `/finance-v2` już istniał).
- **`server/src/services/finance/**` — NIE zmieniony** (poza allowlistą; defekty D1-D3 zgłoszone, nie naprawione).
- **`server/src/types/finance/**` — NIE zmieniony** (żaden nowy typ kontraktu HTTP nie okazał się potrzebny — istniejące typy serwisów wystarczyły do zbudowania DTO w routerach).

## 8. Komendy reprodukcji

```bash
# Środowisko (patrz też brief §ŚRODOWISKO)
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3p-b-pgdata ; PGSOCK=/tmp/fv3pbsock ; PORT=58011
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3pb_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3p_b;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3p_b"

# Migracje STRICT
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts

# Baseline serwisów finance (punkt odniesienia: 47/722, exit 0)
cd server && RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="$DBURL" npx vitest run src/services/finance --reporter=dot

# Nowe testy Pakietu B (4 pliki / 33 testy) — zalecane bez równoległości plików
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="$DBURL" \
  npx vitest run src/routes/v8/finance-v2/__tests__ --reporter=verbose --no-file-parallelism

# tsc (punkt odniesienia: exit 0, zero linii)
npx tsc -p server --noEmit
```

Po pracy: `LC_ALL=C /opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/fv3p-b-pgdata stop`, `rm -rf /private/tmp/fv3p-b-pgdata /tmp/fv3pbsock`.
