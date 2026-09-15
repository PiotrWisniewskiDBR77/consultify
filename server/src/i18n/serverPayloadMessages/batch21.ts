import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_21: readonly ServerPayloadMessage[] = [
  {
    "en": "finance_comment_assignments insert returned no row",
    "pl": "Wkładka finance_comment_assignments nie zwróciła żadnego wiersza"
  },
  {
    "en": "compute_jobs enqueue: ON CONFLICT DO NOTHING but no existing row found on read-back",
    "pl": "kolejkowanie compute_jobs: ON CONFLICT DO NOTHING nie zwróciło istniejącego wiersza przy odczycie zwrotnym"
  },
  {
    "en": "compute_jobs succeeded-update returned no row",
    "pl": "compute_jobs aktualizacja powiodła się, nie zwrócono żadnego wiersza"
  },
  {
    "en": "compute publication CAS lost after revision lock",
    "pl": "oblicz publikację CAS utraconą po zablokowaniu wersji"
  },
  {
    "en": "reapExpiredLeases: requeue/fail update for job ${job.id} returned no row",
    "pl": "reapExpiredLeases: aktualizacja w kolejce/niepowodzenie dla zadania ${job.id} nie zwróciła żadnego wiersza"
  },
  {
    "en": "org_concurrency_limit() returned no row/NULL — migration not applied?",
    "pl": "org_concurrency_limit() nie zwróciło żadnego wiersza/NULL — migracja nie została zastosowana?"
  },
  {
    "en": "finance_exceptions RAISED insert returned no row",
    "pl": "finance_exceptions Wstawka RAISED nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_exceptions ${eventType} insert returned no row",
    "pl": "finance_exceptions ${eventType} wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "executeStmtLinesOperations: unsupported table ${ref.tableName}",
    "pl": "wykonywaniaStmtLinesOperations: nieobsługiwana tabela ${ref.tableName}"
  },
  {
    "en": "finance_stmt_entities copy-forward insert returned no row",
    "pl": "finance_stmt_entities Wstawianie kopiowania do przodu nie zwróciło żadnego wiersza"
  },
  {
    "en": "executeStmtLinesOperations applied ${appliedCells} cells, expected ${diff.toAdd.length + diff.toChange.length + diff.toC",
    "pl": "wykonanieStmtLinesOperations zastosowało ${appliedCells} komórek, oczekiwano ${diff.toAdd.length + diff.toChange.length + diff.toC"
  },
  {
    "en": "finance_working_revisions insert (Excel import) returned no row",
    "pl": "Wkładka finance_working_revisions (import programu Excel) nie zwróciła żadnego wiersza"
  },
  {
    "en": "formulaAstEvaluator: unknown operator ${String(_exhaustive)}",
    "pl": "formułaAstEvaluator: nieznany operator ${String(_exhaustive)}"
  },
  {
    "en": "attemptReadinessTransition=true requires actorId, role, and expectedVersion",
    "pl": "próbaReadinessTransition=true wymaga identyfikatora aktora, roli i oczekiwanej wersji"
  },
  {
    "en": "lineageFreshnessService: edge ${edge.id} targets version ${targetVersionId} which does not exist in organization ${organ",
    "pl": "lineageFreshnessService: Edge ${edge.id} celuje w wersję ${targetVersionId}, która nie istnieje w organizacji ${organ"
  },
  {
    "en": "lineageFreshnessService: freshness UPDATE affected ${updated.changes} rows for version ${targetVersionId} (expected exac",
    "pl": "lineageFreshnessService: operacja UPDATE świeżości objęła ${updated.changes} wierszy wersji ${targetVersionId} (oczekiwano dokładnie"
  },
  {
    "en": "finance_lineage_freshness_events insert returned no row",
    "pl": "Wkładka finance_lineage_freshness_events nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_lineage_edges insert returned no row",
    "pl": "Wkładka finance_lineage_edges nie zwróciła żadnego wiersza"
  },
  {
    "en": "resolvePeriodOffset: unknown periodOffset ${String(_exhaustive)}",
    "pl": "rozwiązaniePeriodOffset: nieznane przesunięcie okresu ${String(_exhaustive)}"
  },
  {
    "en": "daysInPeriod: unparseable period_start/period_end for ${period.periodId}",
    "pl": "dniInPeriod: niemożliwy do przeanalizowania period_start/period_end dla ${period.periodId}"
  },
  {
    "en": "daysInPeriod: non-positive day count (${days}) for ${period.periodId}",
    "pl": "DaysInPeriod: liczba dni dodatnia (${days}) dla ${period.periodId}"
  },
  {
    "en": "predictionComputeService: no finance_business_versions row for Baseline Model ${baselineModelVersionId}",
    "pl": "przewidywanieComputeService: brak wiersza finance_business_versions dla modelu bazowego ${baselineModelVersionId}"
  },
  {
    "en": "predictionComputeService: finance_business_versions.source_working_revision_id is not set for ${params.businessVersionId",
    "pl": "przewidywanieComputeService: finance_business_versions.source_working_revision_id nie jest ustawione dla ${params.businessVersionId"
  },
  {
    "en": "predictionComputeService: no finance_business_versions row for Prediction Scenario ${params.businessVersionId}",
    "pl": "przewidywanieComputeService: brak wiersza finance_business_versions dla scenariusza prognozy ${params.businessVersionId}"
  },
  {
    "en": "predictionComputeService: period ${periodId} not found or not a MONTH period",
    "pl": "predictionComputeService: nie znaleziono okresu ${periodId} albo okres nie ma typu MONTH"
  },
  {
    "en": "predictionComputeService: no PRIOR_YEAR_SAME_PERIOD REVENUE actual for ${priorYearKey}",
    "pl": "predictionComputeService: brak wartości rzeczywistej REVENUE dla PRIOR_YEAR_SAME_PERIOD ${priorYearKey}"
  },
  {
    "en": "predictionComputeService: overlay engine bug — BS does not balance for ${periodId}: assets=${totalAssets} liab+equity=${",
    "pl": "przewidywanieComputeService: błąd silnika nakładki — BS nie bilansuje dla ${periodId}: aktywa=${totalAssets} liab+equity=${"
  },
  {
    "en": "predictionComputeService: canonical line ${code} not found",
    "pl": "przewidywanieComputeService: nie znaleziono linii kanonicznej ${code}"
  },
  {
    "en": "predictionComputeService: finance_business_versions.source_working_revision_id is not set for the Prediction Scenario ${",
    "pl": "przewidywanieComputeService: finance_business_versions.source_working_revision_id nie jest ustawione dla scenariusza przewidywania ${"
  },
  {
    "en": "finance_review_checklists insert returned no row",
    "pl": "Wkładka finance_review_checklists nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_review_checklists check update returned no row",
    "pl": "finance_review_checklists aktualizacja sprawdzająca nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_review_checklists uncheck update returned no row",
    "pl": "finance_review_checklists odznacz aktualizacja nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_saved_views insert returned no row",
    "pl": "Wkładka finance_saved_views nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_saved_views update returned no row",
    "pl": "Aktualizacja finance_saved_views nie zwróciła żadnego wiersza"
  },
  {
    "en": "Financial statement not found for organization",
    "pl": "Nie znaleziono sprawozdania finansowego dla organizacji"
  },
  {
    "en": "Canonical statement pack alias belongs to another organization",
    "pl": "Alias ​​pakietu instrukcji Canonical należy do innej organizacji"
  },
  {
    "en": "Canonical statement pack has no current revision",
    "pl": "Pakiet oświadczeń kanonicznych nie ma aktualnej wersji"
  },
  {
    "en": "Statement pack registration produced no pack",
    "pl": "Rejestracja pakietu wyciągowego nie wygenerowała żadnego pakietu"
  },
  {
    "en": "finance_reconciliation_runs insert returned no row",
    "pl": "Wkładka finance_reconciliation_runs nie zwróciła żadnego wiersza"
  },
  {
    "en": "finance_stmt_reconciliation insert returned no row",
    "pl": "Wkładka finance_stmt_reconciliation nie zwróciła żadnego wiersza"
  },
  {
    "en": "Failed to raise reconciliation-residual exception: ${raised.message}",
    "pl": "Nie udało się zgłosić wyjątku pozostałości po uzgodnieniu: ${raised.message}"
  },
  {
    "en": "Failed to raise reconciliation-coverage exception: ${raised.message}",
    "pl": "Nie udało się zgłosić wyjątku dotyczącego uzgodnienia: ${raised.message}"
  },
  {
    "en": "Failed to raise period-over-period jump exception: ${raised.message}",
    "pl": "Nie udało się zgłosić wyjątku przeskoku między okresami: ${raised.message}"
  },
  {
    "en": "writeBridge: header row not found after upsert",
    "pl": "writeBridge: po wstawieniu nie znaleziono wiersza nagłówka"
  },
  {
    "en": "finance_valuation_methods conflict row missing in tenant-scoped readback",
    "pl": "Brak wiersza konfliktu finance_valuation_methods w odczycie zwrotnym o zasięgu dzierżawy"
  },
  {
    "en": "finance_valuation_methods failure-state readback missing",
    "pl": "finance_valuation_methods brak odczytu stanu awarii"
  },
  {
    "en": "runDcfFcffValuation: no finance_business_versions row for ${params.valuationBusinessVersionId}",
    "pl": "runDcfFcffValuation: brak wiersza finance_business_versions dla ${params.valuationBusinessVersionId}"
  },
  {
    "en": "runDcfFcffValuation: finance_business_versions.source_working_revision_id is not set for ${params.valuationBusinessVersi",
    "pl": "runDcfFcffValuation: finance_business_versions.source_working_revision_id nie jest ustawione dla ${params.valuationBusinessVersi"
  },
  {
    "en": "valuation publication transaction returned no method",
    "pl": "transakcja publikacji wyceny nie zwróciła żadnej metody"
  },
  {
    "en": "writeTerminalRow: GORDON_GROWTH convention requires gPct",
    "pl": "writeTerminalRow: Konwencja GORDON_GROWTH wymaga gPct"
  },
  {
    "en": "writeTerminalRow: EXIT_MULTIPLE convention requires exitMultipleValue",
    "pl": "writeTerminalRow: Konwencja EXIT_MULTIPLE wymaga exitMultipleValue"
  },
  {
    "en": "createCase: insert returned no row",
    "pl": "createCase: wstaw nie zwrócił żadnego wiersza"
  },
  {
    "en": "createVariant: insert returned no row",
    "pl": "createVariant: wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "createVariant: business_version vanished mid-transaction",
    "pl": "createVariant: business_version zniknął w połowie transakcji"
  },
  {
    "en": "renameVariant: variant vanished after update",
    "pl": "renameVariant: wariant zniknął po aktualizacji"
  },
  {
    "en": "upsertWaccInputs: no row returned (organization mismatch on conflict, or insert failure)",
    "pl": "upsertWaccInputs: nie zwrócono żadnego wiersza (niezgodność organizacji w przypadku konfliktu lub błąd wstawiania)"
  },
  {
    "en": "AutosaveScheduler: debounceMs and maxWaitMs must be positive",
    "pl": "AutosaveScheduler: debounceMs i maxWaitMs muszą być dodatnie"
  },
  {
    "en": "finance_working_revisions checkpoint insert returned no row",
    "pl": "Wstawienie punktu kontrolnego finance_working_revisions nie zwróciło żadnego wiersza"
  },
  {
    "en": "OperationStack: maxDepth must be a positive integer, got ${maxDepth}",
    "pl": "OperationStack: maxDepth musi być dodatnią liczbą całkowitą, otrzymano ${maxDepth}"
  },
  {
    "en": "OperationStack.push: priorValues.length (${priorValues.length}) must equal operation target count (${targets.length}) fo",
    "pl": "OperationStack.push: beforeValues.length (${priorValues.length}) musi być równa liczbie celów operacji (${targets.length}) dla"
  }
];
