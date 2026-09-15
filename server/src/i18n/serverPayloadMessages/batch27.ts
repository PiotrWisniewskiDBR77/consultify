import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_27: readonly ServerPayloadMessage[] = [
  {
    "en": "[correctCheckIn] insert into okr_vnext_checkins returned no row",
    "pl": "[correctCheckIn] wstaw do okr_vnext_checkins nie zwrócił żadnego wiersza"
  },
  {
    "en": "[correctCheckIn] update returned no row for key result ${originalRow.key_result_id}",
    "pl": "Aktualizacja [correctCheckIn] nie zwróciła wiersza dla kluczowego wyniku ${originalRow.key_result_id}"
  },
  {
    "en": "[createCycle] OKR Program ${programId} is active but has no active_policy_version_id",
    "pl": "[createCycle] Program OKR ${programId} jest aktywny, ale nie ma active_policy_version_id"
  },
  {
    "en": "[createCycle] insert into okr_vnext_cycles returned no row",
    "pl": "[createCycle] wstaw do okr_vnext_cycles nie zwrócił żadnego wiersza"
  },
  {
    "en": "[${spec.eventType}] update returned no row for ${cycleId}",
    "pl": "[${spec.eventType}] aktualizacja nie zwróciła żadnego wiersza dla ${cycleId}"
  },
  {
    "en": "[generateCadenceOccurrences] Cycle ${cycleId} not found",
    "pl": "[generateCadenceOccurrences] Nie znaleziono cyklu ${cycleId}"
  },
  {
    "en": "[generateCadenceOccurrences] pinned policy version ${cycleRow.policy_version_id} not found for Cycle ${cycleId}",
    "pl": "[generateCadenceOccurrences] nie znaleziono przypiętej wersji zasad ${cycleRow.policy_version_id} dla cyklu ${cycleId}"
  },
  {
    "en": "[requestDecisionFromSupportRequest] decision-link insert returned no row",
    "pl": "[requestDecisionFromSupportRequest] Wstawienie linku decyzyjnego nie zwróciło żadnego wiersza"
  },
  {
    "en": "[requestDecisionFromSupportRequest] support-request update returned no row for ${requestId}",
    "pl": "[requestDecisionFromSupportRequest] aktualizacja żądania wsparcia nie zwróciła żadnego wiersza dla ${requestId}"
  },
  {
    "en": "[acknowledgeDecisionResolution] update returned no row for ${linkId}",
    "pl": "Aktualizacja [acknowledgeDecisionResolution] nie zwróciła żadnego wiersza dla ${linkId}"
  },
  {
    "en": "[createKeyResult] insert returned no row",
    "pl": "[createKeyResult] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[updateKeyResult] update returned no row for ${keyResultId}",
    "pl": "Aktualizacja [updateKeyResult] nie zwróciła wiersza dla ${keyResultId}"
  },
  {
    "en": "[cancelKeyResult] update returned no row for ${keyResultId}",
    "pl": "Aktualizacja [cancelKeyResult] nie zwróciła żadnego wiersza dla ${keyResultId}"
  },
  {
    "en": "[${op}] set ${setId} not found",
    "pl": "[${op}] zestaw ${setId} nie został znaleziony"
  },
  {
    "en": "[resolveOkrCyclePinnedPolicySnapshot] no pinned policy version found for set ${setId}",
    "pl": "[resolveOkrCyclePinnedPolicySnapshot] Nie znaleziono przypiętej wersji zasad dla zestawu ${setId}"
  },
  {
    "en": "[recomputeObjectiveRollup] update returned no row for ${objectiveId}",
    "pl": "Aktualizacja [recomputeObjectiveRollup] nie zwróciła żadnego wiersza dla ${objectiveId}"
  },
  {
    "en": "[createObjective] insert returned no row",
    "pl": "[createObjective] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[updateObjective] update returned no row for ${objectiveId}",
    "pl": "[updateObjective] aktualizacja nie zwróciła żadnego wiersza dla ${objectiveId}"
  },
  {
    "en": "[cancelObjective] update returned no row for ${objectiveId}",
    "pl": "[cancelObjective] aktualizacja nie zwróciła żadnego wiersza dla ${objectiveId}"
  },
  {
    "en": "[createProgram] insert into okr_vnext_programs returned no row",
    "pl": "[createProgram] wstaw do okr_vnext_programs nie zwrócił żadnego wiersza"
  },
  {
    "en": "[editProgramDraft] update returned no row for ${programId}",
    "pl": "Aktualizacja [editProgramDraft] nie zwróciła żadnego wiersza dla ${programId}"
  },
  {
    "en": "[publishProgram] insert into okr_vnext_program_policy_versions returned no row",
    "pl": "[publishProgram] wstaw do okr_vnext_program_policy_versions nie zwrócił żadnego wiersza"
  },
  {
    "en": "[publishProgram] update returned no row for ${programId}",
    "pl": "Aktualizacja [publishProgram] nie zwróciła żadnego wiersza dla ${programId}"
  },
  {
    "en": "[finalScoreOkrSet] update returned no row for ${setId}",
    "pl": "Aktualizacja [finalScoreOkrSet] nie zwróciła żadnego wiersza dla ${setId}"
  },
  {
    "en": "[recordObjectiveReflection] insert returned no row for objective ${objectiveId}",
    "pl": "[recordObjectiveReflection] wstawka nie zwróciła żadnego wiersza dla celu ${objectiveId}"
  },
  {
    "en": "[recordObjectiveReflection] update returned no row for objective ${objectiveId}",
    "pl": "Aktualizacja [recordObjectiveReflection] nie zwróciła żadnego wiersza dla celu ${objectiveId}"
  },
  {
    "en": "[recordObjectiveReflection] idempotency conflict on (${organizationId}, ${idempotencyKey}) but existing event row not fo",
    "pl": "[recordObjectiveReflection] konflikt idempotencji w (${organizationId}, ${idempotencyKey}), ale istniejący wiersz zdarzenia nie dotyczy"
  },
  {
    "en": "[recordOkrReflectionTeresaDraft] insert returned no row for objective ${objectiveId}",
    "pl": "[recordOkrReflectionTeresaDraft] wstawka nie zwróciła wiersza dla celu ${objectiveId}"
  },
  {
    "en": "[recordOkrReflectionTeresaDraft] update returned no row for objective ${objectiveId}",
    "pl": "Aktualizacja [recordOkrReflectionTeresaDraft] nie zwróciła żadnego wiersza dla celu ${objectiveId}"
  },
  {
    "en": "[recordOkrReflectionTeresaDraft] idempotency conflict on (${organizationId}, ${idempotencyKey}) but existing event row n",
    "pl": "[recordOkrReflectionTeresaDraft] konflikt idempotencji na (${organizationId}, ${idempotencyKey}), ale istniejący wiersz zdarzenia n"
  },
  {
    "en": "[recordOkrReflectionTeresaDraftDisposition] update returned no row for objective ${objectiveId}",
    "pl": "[recordOkrReflectionTeresaDraftDisposition] aktualizacja nie zwróciła żadnego wiersza dla celu ${objectiveId}"
  },
  {
    "en": "[writeReviewEvent] idempotency conflict on (${eventInput.organizationId}, ${eventInput.idempotencyKey}) but existing eve",
    "pl": "[writeReviewEvent] konflikt idempotencji w dniu (${eventInput.organizationId}, ${eventInput.idempotencyKey}), ale istniejącym wigilii"
  },
  {
    "en": "[createOkrSet] winning set ${setId} could not be re-read after SAVEPOINT rollback",
    "pl": "[createOkrSet] zwycięski zestaw ${setId} nie mógł zostać ponownie odczytany po wycofaniu SAVEPOINT"
  },
  {
    "en": "[createOkrSet] active policy ${policy.policyId} could not be re-read mid-transaction",
    "pl": "[createOkrSet] aktywna polityka ${policy.policyId} nie mogła zostać ponownie odczytana w trakcie transakcji"
  },
  {
    "en": "[createOkrSet] insert into okr_vnext_sets returned no row",
    "pl": "[createOkrSet] wstaw do okr_vnext_sets nie zwrócił żadnego wiersza"
  },
  {
    "en": "[createOkrSet] 23505 on ux_okr_vnext_sets_one_per_scope_cycle_owner but no winning row found for (${programId}, ${cycleI",
    "pl": "[createOkrSet] 23505 na ux_okr_vnext_sets_one_per_scope_cycle_owner, ale nie znaleziono zwycięskiego wiersza dla (${programId}, ${cycleI"
  },
  {
    "en": "[updateOkrSetDraft] update returned no row for ${setId}",
    "pl": "[updateOkrSetDraft] aktualizacja nie zwróciła żadnego wiersza dla ${setId}"
  },
  {
    "en": "[narrowOkrSetVisibility] active policy ${policy.policyId} could not be re-read mid-transaction",
    "pl": "[narrowOkrSetVisibility] aktywna polityka ${policy.policyId} nie mogła zostać ponownie odczytana w trakcie transakcji"
  },
  {
    "en": "[narrowOkrSetVisibility] update returned no row for ${setId}",
    "pl": "Aktualizacja [narrowOkrSetVisibility] nie zwróciła żadnego wiersza dla ${setId}"
  },
  {
    "en": "[submitOkrSetForApproval] update returned no row for ${setId}",
    "pl": "Aktualizacja [submitOkrSetForApproval] nie zwróciła żadnego wiersza dla ${setId}"
  },
  {
    "en": "[approveOkrSet] insert into okr_vnext_approved_snapshots returned no row for ${setId}",
    "pl": "[approveOkrSet] wstaw do okr_vnext_approved_snapshots nie zwrócił wiersza dla ${setId}"
  },
  {
    "en": "[approveOkrSet] update returned no row for ${setId}",
    "pl": "Aktualizacja [approveOkrSet] nie zwróciła żadnego wiersza dla ${setId}"
  },
  {
    "en": "[requestChangesOnOkrSet] update returned no row for ${setId}",
    "pl": "Aktualizacja [requestChangesOnOkrSet] nie zwróciła żadnego wiersza dla ${setId}"
  },
  {
    "en": "[${spec.eventType}] update returned no row for ${setId}",
    "pl": "[${spec.eventType}] aktualizacja nie zwróciła żadnego wiersza dla ${setId}"
  },
  {
    "en": "[closeOkrSet] update returned no row for ${setId}",
    "pl": "Aktualizacja [closeOkrSet] nie zwróciła wiersza dla ${setId}"
  },
  {
    "en": "[recordOkrSetMaterialChange] insert into okr_vnext_set_versions returned no row for ${setId}",
    "pl": "[recordOkrSetMaterialChange] wstaw do okr_vnext_set_versions nie zwrócił wiersza dla ${setId}"
  },
  {
    "en": "[recordOkrSetMaterialChange] update returned no row for ${setId}",
    "pl": "Aktualizacja [recordOkrSetMaterialChange] nie zwróciła żadnego wiersza dla ${setId}"
  },
  {
    "en": "[postComment] insert returned no row",
    "pl": "[postComment] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[postRecognition] insert returned no row",
    "pl": "[postRecognition] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[raiseSupportRequest] insert returned no row",
    "pl": "Wstawka [raiseSupportRequest] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[acknowledgeSupportRequest] update returned no row for ${requestId}",
    "pl": "Aktualizacja [acknowledgeSupportRequest] nie zwróciła żadnego wiersza dla ${requestId}"
  },
  {
    "en": "[resolveSupportRequest] update returned no row for ${requestId}",
    "pl": "Aktualizacja [resolveSupportRequest] nie zwróciła żadnego wiersza dla ${requestId}"
  },
  {
    "en": "[dismissSupportRequest] update returned no row for ${requestId}",
    "pl": "[dismissSupportRequest] aktualizacja nie zwróciła żadnego wiersza dla ${requestId}"
  },
  {
    "en": "[executeAtomicCommand] idempotency conflict on (${organizationId}, ${eventInput.idempotencyKey}) but existing event row ",
    "pl": "[executeAtomicCommand] konflikt idempotencji na (${organizationId}, ${eventInput.idempotencyKey}), ale istniejący wiersz zdarzenia"
  },
  {
    "en": "[executeAtomicCreate] idempotency conflict on (${organizationId}, ${eventInput.idempotencyKey}) but existing event row n",
    "pl": "[executeAtomicCreate] konflikt idempotencji na (${organizationId}, ${eventInput.idempotencyKey}), ale istniejący wiersz zdarzenia n"
  },
  {
    "en": "[financeProjectionConsumer] event ${event.event_id} (${event.event_type}) missing required payload.${key}",
    "pl": "[financeProjectionConsumer] zdarzenie ${event.event_id} (${event.event_type}) brak wymaganego ładunku.${key}"
  },
  {
    "en": "[financeProjectionConsumer] rvn_roi_cases row not found for case ${caseId} org ${organizationId}",
    "pl": "[financeProjectionConsumer] Nie znaleziono wiersza rvn_roi_cases dla sprawy ${caseId} org ${organizationId}"
  },
  {
    "en": "[financeProjectionConsumer] expected an open/investigating reconciliation for link ${link.link_id} after openRoiFinanceR",
    "pl": "[financeProjectionConsumer] oczekiwał otwartego/badania uzgodnienia dla łącza ${link.link_id} po openRoiFinanceR"
  },
  {
    "en": "[financeProjectionConsumer] rvn_roi_finance_links row not found for link ${linkId}",
    "pl": "[financeProjectionConsumer] rvn_roi_finance_links nie znaleziono wiersza dla linku ${linkId}"
  },
  {
    "en": "resultsTextMatchSql requires at least one column",
    "pl": "resultsTextMatchSql wymaga co najmniej jednej kolumny"
  }
];
