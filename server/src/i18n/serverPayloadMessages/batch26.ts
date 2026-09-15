import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_26: readonly ServerPayloadMessage[] = [
  {
    "en": "updateDefinition: organizationId is required",
    "pl": "updateDefinition: identyfikator organizacji jest wymagany"
  },
  {
    "en": "updateDefinition: kpiId is required",
    "pl": "updateDefinition: wymagany jest kpiId"
  },
  {
    "en": "updateDefinition: expectedVersion must be a positive integer",
    "pl": "updateDefinition: oczekiwana wersja musi być dodatnią liczbą całkowitą"
  },
  {
    "en": "archiveDefinition: organizationId is required",
    "pl": "ArchiveDefinition: identyfikator organizacji jest wymagany"
  },
  {
    "en": "archiveDefinition: kpiId is required",
    "pl": "ArchiveDefinition: wymagany jest kpiId"
  },
  {
    "en": "Connector not found",
    "pl": "Nie znaleziono złącza"
  },
  {
    "en": "Schedule not found",
    "pl": "Nie znaleziono harmonogramu"
  },
  {
    "en": "Wallboard not found",
    "pl": "Nie znaleziono płyty ściennej"
  },
  {
    "en": "Parent not found",
    "pl": "Nie znaleziono rodzica"
  },
  {
    "en": "[addCorrectiveAction] insert returned no row",
    "pl": "Wstawka [addCorrectiveAction] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[updateCorrectiveAction] update returned no row for ${actionId}",
    "pl": "[updateCorrectiveAction] aktualizacja nie zwróciła żadnego wiersza dla ${actionId}"
  },
  {
    "en": "[createKpiDraft] active policy ${policy.policyId} could not be re-read mid-transaction",
    "pl": "[createKpiDraft] aktywna polityka ${policy.policyId} nie mogła zostać ponownie odczytana w trakcie transakcji"
  },
  {
    "en": "[createKpiDraft] insert into rvn_kpi_definitions returned no row",
    "pl": "[createKpiDraft] wstaw do rvn_kpi_definitions nie zwróciło żadnego wiersza"
  },
  {
    "en": "[createKpiDraft] insert into rvn_kpi_definition_versions returned no row",
    "pl": "[createKpiDraft] wstaw do rvn_kpi_definition_versions nie zwróciło żadnego wiersza"
  },
  {
    "en": "[editDraft] update returned no row for ${definitionVersionId}",
    "pl": "Aktualizacja [editDraft] nie zwróciła żadnego wiersza dla ${definitionVersionId}"
  },
  {
    "en": "[submitDefinition] update returned no row for ${definitionVersionId}",
    "pl": "Aktualizacja [submitDefinition] nie zwróciła żadnego wiersza dla ${definitionVersionId}"
  },
  {
    "en": "[approveDefinitionVersion] update returned no row for ${definitionVersionId}",
    "pl": "Aktualizacja [approveDefinitionVersion] nie zwróciła żadnego wiersza dla ${definitionVersionId}"
  },
  {
    "en": "[rejectDefinitionVersion] update returned no row for ${definitionVersionId}",
    "pl": "Aktualizacja [rejectDefinitionVersion] nie zwróciła żadnego wiersza dla ${definitionVersionId}"
  },
  {
    "en": "[reviseDefinition] KPI ${currentRow.kpi_id} not found while locking its parent row for version numbering",
    "pl": "[reviseDefinition] Nie znaleziono KPI ${currentRow.kpi_id} podczas blokowania wiersza nadrzędnego w celu numerowania wersji"
  },
  {
    "en": "[reviseDefinition] insert into rvn_kpi_definition_versions returned no row",
    "pl": "[reviseDefinition] wstaw do rvn_kpi_definition_versions nie zwrócił żadnego wiersza"
  },
  {
    "en": "[${spec.eventType}] update returned no row for ${kpiId}",
    "pl": "[${spec.eventType}] aktualizacja nie zwróciła żadnego wiersza dla ${kpiId}"
  },
  {
    "en": "[closeDeviationCase] update returned no row for ${caseId}",
    "pl": "Aktualizacja [closeDeviationCase] ​​nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[acknowledgeDeviationCase] update returned no row for ${caseId}",
    "pl": "Aktualizacja [acknowledgeDeviationCase] ​​nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[submitRootCause] update returned no row for ${caseId}",
    "pl": "Aktualizacja [submitRootCause] nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[submitPlan] update returned no row for ${caseId}",
    "pl": "Aktualizacja [submitPlan] nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[approvePlan] update returned no row for ${caseId}",
    "pl": "Aktualizacja [approvePlan] nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[recordRecoveryObservation] update returned no row for ${caseId}",
    "pl": "Aktualizacja [recordRecoveryObservation] nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[submitEffectivenessVerification] verification insert returned no row",
    "pl": "[submitEffectivenessVerification] wstawka weryfikacyjna nie zwróciła żadnego wiersza"
  },
  {
    "en": "[submitEffectivenessVerification] case update returned no row for ${caseId}",
    "pl": "[submitEffectivenessVerification] aktualizacja sprawy nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[${eventType}] update returned no row for ${caseId}",
    "pl": "[${eventType}] aktualizacja nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[reopenDeviationCase] insert returned no row",
    "pl": "Wstawka [reopenDeviationCase] ​​nie zwróciła żadnego wiersza"
  },
  {
    "en": "[proposeInitiativeKpiImpact] insert returned no row",
    "pl": "Wstawka [proposeInitiativeKpiImpact] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[commitInitiativeKpiImpact] update returned no row for ${impactId}",
    "pl": "Aktualizacja [commitInitiativeKpiImpact] nie zwróciła żadnego wiersza dla ${impactId}"
  },
  {
    "en": "[recordReviewedAttribution] update returned no row for ${impactId}",
    "pl": "Aktualizacja [recordReviewedAttribution] nie zwróciła żadnego wiersza dla ${impactId}"
  },
  {
    "en": "[supersedeInitiativeKpiImpact] update returned no row for ${impactId}",
    "pl": "Aktualizacja [supersedeInitiativeKpiImpact] nie zwróciła żadnego wiersza dla ${impactId}"
  },
  {
    "en": "[supersedeInitiativeKpiImpact] replacement insert returned no row",
    "pl": "[supersedeInitiativeKpiImpact] wstawka zastępcza nie zwróciła żadnego wiersza"
  },
  {
    "en": "[supersedeInitiativeKpiImpact] final update returned no row for ${impactId}",
    "pl": "[supersedeInitiativeKpiImpact] ostateczna aktualizacja nie zwróciła żadnego wiersza dla ${impactId}"
  },
  {
    "en": "[recordMeasurement] insert returned no row",
    "pl": "[recordMeasurement] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[recordMeasurement] idempotent event ${existingEvent.event_id} has no measurement result",
    "pl": "[recordMeasurement] zdarzenie idempotentne ${existingEvent.event_id} nie ma wyniku pomiaru"
  },
  {
    "en": "[insertSupersedingMeasurement] insert returned no row",
    "pl": "[insertSupersedingMeasurement] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[createScorecard] active policy ${policy.policyId} could not be re-read mid-transaction",
    "pl": "[createScorecard] aktywna polityka ${policy.policyId} nie mogła zostać ponownie odczytana w trakcie transakcji"
  },
  {
    "en": "[createScorecard] insert into rvn_kpi_scorecards returned no row",
    "pl": "[createScorecard] wstaw do rvn_kpi_scorecards nie zwrócił żadnego wiersza"
  },
  {
    "en": "[addScorecardItem] insert into rvn_kpi_scorecard_items returned no row",
    "pl": "[addScorecardItem] wstawka do rvn_kpi_scorecard_items nie zwróciła żadnego wiersza"
  },
  {
    "en": "[addScorecardItem] scorecard update returned no row for ${scorecardId}",
    "pl": "[addScorecardItem] aktualizacja karty wyników nie zwróciła żadnego wiersza dla ${scorecardId}"
  },
  {
    "en": "[removeScorecardItem] scorecard update returned no row for ${scorecardId}",
    "pl": "[removeScorecardItem] aktualizacja karty wyników nie zwróciła żadnego wiersza dla ${scorecardId}"
  },
  {
    "en": "[reorderScorecardItems] scorecard update returned no row for ${scorecardId}",
    "pl": "[reorderScorecardItems] aktualizacja karty wyników nie zwróciła żadnego wiersza dla ${scorecardId}"
  },
  {
    "en": "[${spec.eventType}] update returned no row for ${scorecardId}",
    "pl": "[${spec.eventType}] aktualizacja nie zwróciła żadnego wiersza dla ${scorecardId}"
  },
  {
    "en": "[createReviewSnapshot] insert returned no row",
    "pl": "[createReviewSnapshot] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[publishReviewSnapshot] update returned no row for ${snapshotId}",
    "pl": "Aktualizacja [publishReviewSnapshot] nie zwróciła wiersza dla ${snapshotId}"
  },
  {
    "en": "[proposeAlignment] winning alignment ${alignmentId} could not be re-read after SAVEPOINT rollback",
    "pl": "[proposeAlignment] zwycięskie wyrównanie ${alignmentId} nie mogło zostać ponownie odczytane po wycofaniu SAVEPOINT"
  },
  {
    "en": "[proposeAlignment] insert into okr_vnext_alignments returned no row",
    "pl": "[proposeAlignment] wstaw do okr_vnext_alignments nie zwrócił żadnego wiersza"
  },
  {
    "en": "[proposeAlignment] 23505 on ux_okr_vnext_alignments_live_edge but no winning row found for (${sourceObjectiveId}, ${targ",
    "pl": "[proposeAlignment] 23505 na ux_okr_vnext_alignments_live_edge, ale nie znaleziono zwycięskiego wiersza dla (${sourceObjectiveId}, ${targ"
  },
  {
    "en": "[acceptAlignment] update returned no row for ${alignmentId}",
    "pl": "Aktualizacja [acceptAlignment] nie zwróciła żadnego wiersza dla ${alignmentId}"
  },
  {
    "en": "[rejectAlignment] update returned no row for ${alignmentId}",
    "pl": "Aktualizacja [rejectAlignment] nie zwróciła żadnego wiersza dla ${alignmentId}"
  },
  {
    "en": "[removeAlignment] update returned no row for ${alignmentId}",
    "pl": "Aktualizacja [removeAlignment] nie zwróciła żadnego wiersza dla ${alignmentId}"
  },
  {
    "en": "[okrCheckInCommands] set ${setId} not found for key result under it",
    "pl": "[okrCheckInCommands] nie znaleziono zestawu ${setId} dla kluczowego wyniku pod nim"
  },
  {
    "en": "[applySetRollupUpdate] update returned no row for ${setRow.set_id}",
    "pl": "Aktualizacja [applySetRollupUpdate] nie zwróciła żadnego wiersza dla ${setRow.set_id}"
  },
  {
    "en": "[recordCheckIn] insert into okr_vnext_checkins returned no row",
    "pl": "[recordCheckIn] wstaw do okr_vnext_checkins nie zwrócił żadnego wiersza"
  },
  {
    "en": "[recordCheckIn] 23505 on ux_okr_vnext_checkins_kr_occurrence_original but no winning row found for (${keyResultId}, ${ca",
    "pl": "[recordCheckIn] 23505 w dniu ux_okr_vnext_checkins_kr_occurrence_original, ale nie znaleziono zwycięskiego wiersza dla (${keyResultId}, ${ca"
  },
  {
    "en": "[recordCheckIn] update returned no row for key result ${keyResultId}",
    "pl": "Aktualizacja [recordCheckIn] nie zwróciła wiersza dla kluczowego wyniku ${keyResultId}"
  }
];
