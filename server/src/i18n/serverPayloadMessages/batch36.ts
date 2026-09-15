import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_36: readonly ServerPayloadMessage[] = [
  {
    "en": "Idea materialization read-back failed for ${ideaId} (idea=${Boolean(ideaReadBack.rows[0])}, map=${Boolean(mapReadBack.rows[0])})",
    "pl": "Odczyt zwrotny materializacji pomysłu ${ideaId} nie powiódł się (pomysł=${Boolean(ideaReadBack.rows[0])}, mapa=${Boolean(mapReadBack.rows[0])})"
  },
  {
    "en": "[atelier-finance-seed] refusing to acknowledge a NEEDS_OPERATOR hold without a note: state what was found and why it is safe to proceed.",
    "pl": "[atelier-finance-seed] odmowa potwierdzenia blokady NEEDS_OPERATOR bez notatki: opisz, co znaleziono i dlaczego można bezpiecznie kontynuować."
  },
  {
    "en": "baselineComputeService: engine bug — BS does not balance for ${periodId}: assets=${totalAssets} liab+equity=${totalLiabilitiesEquity} diff=${Math.abs(totalAssets - totalLiabilitiesEquity)}",
    "pl": "baselineComputeService: błąd silnika — BS nie bilansuje się dla ${periodId}: aktywa=${totalAssets} zobowiązania+kapitał=${totalLiabilitiesEquity} różnica=${Math.abs(totalAssets - totalLiabilitiesEquity)}"
  },
  {
    "en": "executeStmtLinesOperations applied ${appliedCells} cells, expected ${diff.toAdd.length + diff.toChange.length + diff.toClear.length} — aborting transaction",
    "pl": "executeStmtLinesOperations zastosowało ${appliedCells} komórek, oczekiwano ${diff.toAdd.length + diff.toChange.length + diff.toClear.length} — transakcja zostaje przerwana"
  },
  {
    "en": "lineageFreshnessService: edge ${edge.id} targets version ${targetVersionId} which does not exist in organization ${organizationId}",
    "pl": "lineageFreshnessService: krawędź ${edge.id} wskazuje wersję ${targetVersionId}, która nie istnieje w organizacji ${organizationId}"
  },
  {
    "en": "lineageFreshnessService: freshness UPDATE affected ${updated.changes} rows for version ${targetVersionId} (expected exactly 1)",
    "pl": "lineageFreshnessService: operacja UPDATE świeżości objęła ${updated.changes} wierszy wersji ${targetVersionId} (oczekiwano dokładnie 1)"
  },
  {
    "en": "predictionComputeService: finance_business_versions.source_working_revision_id is not set for ${params.businessVersionId}",
    "pl": "predictionComputeService: finance_business_versions.source_working_revision_id nie jest ustawione dla ${params.businessVersionId}"
  },
  {
    "en": "predictionComputeService: overlay engine bug — BS does not balance for ${periodId}: assets=${totalAssets} liab+equity=${totalLiabilitiesEquity} diff=${Math.abs(totalAssets - totalLiabilitiesEquity)}",
    "pl": "predictionComputeService: błąd silnika nakładki — BS nie bilansuje się dla ${periodId}: aktywa=${totalAssets} zobowiązania+kapitał=${totalLiabilitiesEquity} różnica=${Math.abs(totalAssets - totalLiabilitiesEquity)}"
  },
  {
    "en": "predictionComputeService: finance_business_versions.source_working_revision_id is not set for the Prediction Scenario ${params.businessVersionId}",
    "pl": "predictionComputeService: finance_business_versions.source_working_revision_id nie jest ustawione dla scenariusza prognozy ${params.businessVersionId}"
  },
  {
    "en": "runDcfFcffValuation: ${claimResult.message}",
    "pl": "Wycena DCF/FCFF: ${claimResult.message}"
  },
  {
    "en": "runDcfFcffValuation: finance_business_versions.source_working_revision_id is not set for ${params.valuationBusinessVersionId}",
    "pl": "runDcfFcffValuation: finance_business_versions.source_working_revision_id nie jest ustawione dla ${params.valuationBusinessVersionId}"
  },
  {
    "en": "OperationStack.push: priorValues.length (${priorValues.length}) must equal operation target count (${targets.length}) for operation ${operation.operationId}",
    "pl": "OperationStack.push: priorValues.length (${priorValues.length}) musi być równe liczbie celów operacji (${targets.length}) dla operacji ${operation.operationId}"
  },
  {
    "en": "[FinancialStatementService] Idempotency reservation conflict for ${organizationId}/${idempotencyKey} but no row found on re-read",
    "pl": "[FinancialStatementService] konflikt rezerwacji idempotencji dla ${organizationId}/${idempotencyKey}, ale ponowny odczyt nie zwrócił wiersza"
  },
  {
    "en": "[OrgContext] Failed to publish snapshot version for org ${organizationId} after ${MAX_ATTEMPTS} attempts (version contention).",
    "pl": "[OrgContext] Nie udało się opublikować wersji migawki organizacji ${organizationId} po ${MAX_ATTEMPTS} próbach (konflikt wersji)."
  },
  {
    "en": "[proposeAlignment] 23505 on ux_okr_vnext_alignments_live_edge but no winning row found for (${sourceObjectiveId}, ${targetObjectiveId})",
    "pl": "[proposeAlignment] błąd 23505 dla ux_okr_vnext_alignments_live_edge, ale nie znaleziono zwycięskiego wiersza dla (${sourceObjectiveId}, ${targetObjectiveId})"
  },
  {
    "en": "[recordCheckIn] 23505 on ux_okr_vnext_checkins_kr_occurrence_original but no winning row found for (${keyResultId}, ${cadenceOccurrenceId})",
    "pl": "[recordCheckIn] błąd 23505 dla ux_okr_vnext_checkins_kr_occurrence_original, ale nie znaleziono zwycięskiego wiersza dla (${keyResultId}, ${cadenceOccurrenceId})"
  },
  {
    "en": "[recordObjectiveReflection] idempotency conflict on (${organizationId}, ${idempotencyKey}) but existing event row not found",
    "pl": "[recordObjectiveReflection] konflikt idempotencji dla (${organizationId}, ${idempotencyKey}), ale nie znaleziono istniejącego wiersza zdarzenia"
  },
  {
    "en": "[recordOkrReflectionTeresaDraft] idempotency conflict on (${organizationId}, ${idempotencyKey}) but existing event row not found",
    "pl": "[recordOkrReflectionTeresaDraft] konflikt idempotencji dla (${organizationId}, ${idempotencyKey}), ale nie znaleziono istniejącego wiersza zdarzenia"
  },
  {
    "en": "[writeReviewEvent] idempotency conflict on (${eventInput.organizationId}, ${eventInput.idempotencyKey}) but existing event row not found",
    "pl": "[writeReviewEvent] konflikt idempotencji dla (${eventInput.organizationId}, ${eventInput.idempotencyKey}), ale nie znaleziono istniejącego wiersza zdarzenia"
  },
  {
    "en": "[createOkrSet] 23505 on ux_okr_vnext_sets_one_per_scope_cycle_owner but no winning row found for (${programId}, ${cycleId}, ${scopeType}, ${scopeId}, ${ownerUserId})",
    "pl": "[createOkrSet] błąd 23505 dla ux_okr_vnext_sets_one_per_scope_cycle_owner, ale nie znaleziono zwycięskiego wiersza dla (${programId}, ${cycleId}, ${scopeType}, ${scopeId}, ${ownerUserId})"
  },
  {
    "en": "[executeAtomicCommand] idempotency conflict on (${organizationId}, ${eventInput.idempotencyKey}) but existing event row not found",
    "pl": "[executeAtomicCommand] konflikt idempotencji dla (${organizationId}, ${eventInput.idempotencyKey}), ale nie znaleziono istniejącego wiersza zdarzenia"
  },
  {
    "en": "[executeAtomicCreate] idempotency conflict on (${organizationId}, ${eventInput.idempotencyKey}) but existing event row not found",
    "pl": "[executeAtomicCreate] konflikt idempotencji dla (${organizationId}, ${eventInput.idempotencyKey}), ale nie znaleziono istniejącego wiersza zdarzenia"
  },
  {
    "en": "[financeProjectionConsumer] expected an open/investigating reconciliation for link ${link.link_id} after openRoiFinanceReconciliation, found none",
    "pl": "[financeProjectionConsumer] po openRoiFinanceReconciliation oczekiwano otwartego lub analizowanego uzgodnienia dla łącza ${link.link_id}, ale go nie znaleziono"
  },
  {
    "en": "[createRoiCase] 23505 on ux_rvn_roi_cases_one_active_per_initiative but no winning row found for initiative ${initiativeId}",
    "pl": "[createRoiCase] błąd 23505 dla ux_rvn_roi_cases_one_active_per_initiative, ale nie znaleziono zwycięskiego wiersza dla inicjatywy ${initiativeId}"
  },
  {
    "en": "[startRoiCasePostInvestmentReview] ROI case ${caseId} compare/benefits-realization view returned null while its own row is locked — internal invariant violated",
    "pl": "[startRoiCasePostInvestmentReview] widok porównania lub realizacji korzyści sprawy ROI ${caseId} zwrócił null, gdy jej wiersz był zablokowany — naruszono wewnętrzny niezmiennik"
  },
  {
    "en": "Schema was modified since this proposal was created (proposal version: ${proposalSchemaVersion}, current: ${currentSV}). Please regenerate.",
    "pl": "Schemat został zmieniony po utworzeniu tej propozycji (wersja propozycji: ${proposalSchemaVersion}, bieżąca: ${currentSV}). Wygeneruj ponownie."
  },
  {
    "en": "Cardinality violation: field ${fromFieldId} allows only one-to-one links (existing: ${cnt}, adding: ${toRecordIds.length})",
    "pl": "Naruszenie kardynalności: pole ${fromFieldId} dopuszcza wyłącznie łącza jeden do jednego (istniejące: ${cnt}, dodawane: ${toRecordIds.length})"
  },
  {
    "en": "Cardinality violation: target record ${toRecordId} is already linked from another record (one-to-many constraint on field ${fromFieldId})",
    "pl": "Naruszenie kardynalności: rekord docelowy ${toRecordId} jest już połączony z innym rekordem (ograniczenie jeden do wielu w polu ${fromFieldId})"
  },
  {
    "en": "Execution run ${current.executionRunId} must be proposals_ready, waiting_for_review, approved_for_apply or applying before materialization",
    "pl": "Przebieg wykonania ${current.executionRunId} musi mieć status proposals_ready, waiting_for_review, approved_for_apply lub applying przed materializacją"
  },
  {
    "en": "Failed to load AiService: ${error instanceof Error ? error.message : String(error)}",
    "pl": "Nie udało się załadować AiService: ${error instanceof Error ? error.message : String(error)}"
  },
  {
    "en": "Unknown task type: ${taskType}",
    "pl": "Nieznany typ zadania: ${taskType}"
  }
];
