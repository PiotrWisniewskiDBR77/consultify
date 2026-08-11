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
