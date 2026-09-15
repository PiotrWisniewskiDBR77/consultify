import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_28: readonly ServerPayloadMessage[] = [
  {
    "en": "[publishRoiGovernedVisibilityPolicy] idempotencyKey is required",
    "pl": "[publishRoiGovernedVisibilityPolicy] idempotencyKey jest wymagany"
  },
  {
    "en": "[publishRoiGovernedVisibilityPolicy] insert returned no row",
    "pl": "[publishRoiGovernedVisibilityPolicy] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[recordActualEntry] insert returned no row",
    "pl": "Wstawienie [recordActualEntry] nie zwróciło żadnego wiersza"
  },
  {
    "en": "[insertSupersedingActualEntry] insert returned no row",
    "pl": "[insertSupersedingActualEntry] wstawka nie zwróciła żadnego wiersza"
  },
  {
    "en": "[publishRoiActualSnapshot] insert into rvn_roi_actual_snapshots returned no row",
    "pl": "[publishRoiActualSnapshot] wstaw do rvn_roi_actual_snapshots nie zwrócił żadnego wiersza"
  },
  {
    "en": "[${op}] case ${caseId} not found",
    "pl": "[${op}] nie znaleziono przypadku ${caseId}"
  },
  {
    "en": "[addAssumption] insert returned no row",
    "pl": "Wkładka [addZałożenie] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[updateAssumption] update returned no row for ${assumptionId}",
    "pl": "[updateAssumption] aktualizacja nie zwróciła żadnego wiersza dla ${assumptionId}"
  },
  {
    "en": "[removeAssumption] update returned no row for ${assumptionId}",
    "pl": "Aktualizacja [usuń założenie] nie zwróciła żadnego wiersza dla ${assumptionId}"
  },
  {
    "en": "[captureOrUpdateBaseline] update returned no row for case ${caseId}",
    "pl": "Aktualizacja [captureOrUpdateBaseline] nie zwróciła żadnego wiersza dla przypadku ${caseId}"
  },
  {
    "en": "[addBenefitEvidenceLink] insert returned no row",
    "pl": "Wstawka [addBenefitEvidenceLink] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[flagBenefitEvidenceLinkDisputed] update returned no row for ${linkId}",
    "pl": "Aktualizacja [flagBenefitEvidenceLinkDisputed] nie zwróciła żadnego wiersza dla ${linkId}"
  },
  {
    "en": "[flagEvidenceLinkFreshnessCheck] update returned no row for ${linkId}",
    "pl": "Aktualizacja [flagEvidenceLinkFreshnessCheck] nie zwróciła żadnego wiersza dla ${linkId}"
  },
  {
    "en": "[addBenefitLine] insert returned no row",
    "pl": "Wstawka [addBenefitLine] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[updateBenefitLine] update returned no row for ${benefitLineId}",
    "pl": "Aktualizacja [updateBenefitLine] nie zwróciła żadnego wiersza dla ${benefitLineId}"
  },
  {
    "en": "[removeBenefitLine] update returned no row for ${benefitLineId}",
    "pl": "Aktualizacja [removeBenefitLine] nie zwróciła wiersza dla ${benefitLineId}"
  },
  {
    "en": "[startRoiCaseBenefitsRealization] update returned no row for ${caseId}",
    "pl": "Aktualizacja [startRoiCaseBenefitsRealization] nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[cancelRoiCase] update returned no row for ${caseId}",
    "pl": "Aktualizacja [cancelRoiCase] ​​nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[captureOrUpdateCalculationPolicy] case ${caseId} not found",
    "pl": "[captureOrUpdateCalculationPolicy] nie znaleziono przypadku ${caseId}"
  },
  {
    "en": "[captureOrUpdateCalculationPolicy] update returned no row for case ${caseId}",
    "pl": "Aktualizacja [captureOrUpdateCalculationPolicy] nie zwróciła żadnego wiersza dla przypadku ${caseId}"
  },
  {
    "en": "[buildEngineInputFromDb] case ${caseId} has no calculation-policy shell row",
    "pl": "[buildEngineInputFromDb] przypadek ${caseId} nie zawiera wiersza powłoki polityki obliczeniowej"
  },
  {
    "en": "[computeCurrentEconomicModelHash] case ${caseId} not found",
    "pl": "[computeCurrentEconomicModelHash] przypadek ${caseId} nie został znaleziony"
  },
  {
    "en": "[createRoiCalculationRun] insert into rvn_roi_calculation_runs returned no row",
    "pl": "[createRoiCalculationRun] wstaw do rvn_roi_calculation_runs nie zwrócił żadnego wiersza"
  },
  {
    "en": "[rejectRoiCase] update returned no row for ${caseId}",
    "pl": "Aktualizacja [rejectRoiCase] ​​nie zwróciła wiersza dla ${caseId}"
  },
  {
    "en": "[requestChangesOnRoiCase] update returned no row for ${caseId}",
    "pl": "Aktualizacja [requestChangesOnRoiCase] ​​nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[reopenApprovedRoiCaseForRevision] update returned no row for ${caseId}",
    "pl": "Aktualizacja [reopenApprovedRoiCaseForRevision] nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[createRoiCase] winning case ${caseId} could not be re-read after SAVEPOINT rollback",
    "pl": "[createRoiCase] ​​zwycięska sprawa ${caseId} nie mogła zostać ponownie odczytana po wycofaniu SAVEPOINT"
  },
  {
    "en": "[createRoiCase] winning case ${caseId} has no baseline shell row",
    "pl": "[createRoiCase] ​​zwycięski przypadek ${caseId} nie zawiera wiersza powłoki bazowej"
  },
  {
    "en": "[createRoiCase] winning case ${caseId} has no calculation-policy shell row",
    "pl": "[createRoiCase] ​​zwycięski przypadek ${caseId} nie zawiera wiersza powłoki polityki obliczeniowej"
  },
  {
    "en": "[createRoiCase] active policy ${policy.policyId} could not be re-read mid-transaction",
    "pl": "[createRoiCase] ​​aktywna polityka ${policy.policyId} nie mogła zostać ponownie odczytana w trakcie transakcji"
  },
  {
    "en": "[createRoiCase] insert into rvn_roi_cases returned no row",
    "pl": "[createRoiCase] ​​wstaw do rvn_roi_cases nie zwrócił żadnego wiersza"
  },
  {
    "en": "[createRoiCase] 23505 on ux_rvn_roi_cases_one_active_per_initiative but no winning row found for initiative ${initiative",
    "pl": "[createRoiCase] ​​23505 na ux_rvn_roi_cases_one_active_per_initiative, ale nie znaleziono zwycięskiego wiersza dla inicjatywy ${initiative"
  },
  {
    "en": "[createRoiCase] insert into rvn_roi_baselines returned no row",
    "pl": "[createRoiCase] ​​wstaw do rvn_roi_baselines nie zwrócił żadnego wiersza"
  },
  {
    "en": "[createRoiCase] insert into rvn_roi_calculation_policy returned no row",
    "pl": "[createRoiCase] ​​wstaw do rvn_roi_calculation_policy nie zwrócił żadnego wiersza"
  },
  {
    "en": "[updateRoiCaseDetails] update returned no row for ${caseId}",
    "pl": "[updateRoiCaseDetails] aktualizacja nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[archiveRoiCase] no-op update returned no row for ${caseId}",
    "pl": "[archiveRoiCase] ​​aktualizacja bez operacji nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[archiveRoiCase] update returned no row for ${caseId}",
    "pl": "Aktualizacja [archiveRoiCase] ​​nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[${spec.eventType}] no baseline row found for case ${caseId}",
    "pl": "[${spec.eventType}] nie znaleziono wiersza linii bazowej dla przypadku ${caseId}"
  },
  {
    "en": "[${spec.eventType}] update returned no row for ${caseId}",
    "pl": "[${spec.eventType}] aktualizacja nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[addCostLine] insert returned no row",
    "pl": "Wstawka [addCostLine] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[updateCostLine] update returned no row for ${costLineId}",
    "pl": "Aktualizacja [updateCostLine] nie zwróciła wiersza dla ${costLineId}"
  },
  {
    "en": "[removeCostLine] update returned no row for ${costLineId}",
    "pl": "Aktualizacja [removeCostLine] nie zwróciła żadnego wiersza dla ${costLineId}"
  },
  {
    "en": "[createRoiFinanceLink] insert returned no row",
    "pl": "Wstawka [createRoiFinanceLink] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[openRoiFinanceReconciliation] insert returned no row",
    "pl": "Wstawka [openRoiFinanceReconciliation] nie zwróciła żadnego wiersza"
  },
  {
    "en": "[openRoiFinanceReconciliation] replay event ${existingEvent.event_id} has no reconciliation result",
    "pl": "[openRoiFinanceReconciliation] zdarzenie ponownego odtwarzania ${existingEvent.event_id} nie ma wyniku uzgodnienia"
  },
  {
    "en": "Update-status race hooks are test-only.",
    "pl": "Haki wyścigowe o statusie aktualizacji służą wyłącznie do celów testowych."
  },
  {
    "en": "[updateRoiFinanceReconciliationStatus] replay event ${existing.event_id} has no reconciliation result",
    "pl": "[updateRoiFinanceReconciliationStatus] zdarzenie ponownego odtwarzania ${existing.event_id} nie ma wyniku uzgodnienia"
  },
  {
    "en": "[updateRoiFinanceReconciliationStatus] update returned no row for ${reconciliationId}",
    "pl": "Aktualizacja [updateRoiFinanceReconciliationStatus] nie zwróciła żadnego wiersza dla ${reconciliationId}"
  },
  {
    "en": "[updateRoiFinanceReconciliationStatus] replay event ${existingEvent.event_id} has no reconciliation result",
    "pl": "[updateRoiFinanceReconciliationStatus] zdarzenie ponownego odtwarzania ${existingEvent.event_id} nie ma wyniku uzgodnienia"
  },
  {
    "en": "[createRoiForecastVersion] no calculation-policy row found for case ${caseId}",
    "pl": "[createRoiForecastVersion] nie znaleziono wiersza zasad obliczeń dla przypadku ${caseId}"
  },
  {
    "en": "[createRoiForecastVersion] insert into rvn_roi_forecast_versions returned no row",
    "pl": "[createRoiForecastVersion] wstaw do rvn_roi_forecast_versions nie zwrócił żadnego wiersza"
  },
  {
    "en": "[scheduleRoiCasePostInvestmentReview] update returned no row for ${caseId}",
    "pl": "Aktualizacja [scheduleRoiCasePostInvestmentReview] nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[markRoiCasePostInvestmentReviewDue] update returned no row for ${caseId}",
    "pl": "Aktualizacja [markRoiCasePostInvestmentReviewDue] nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[startRoiCasePostInvestmentReview] ROI case ${caseId} has no latest_approved_snapshot_id — internal invariant violated",
    "pl": "[startRoiCasePostInvestmentReview] Przypadek ROI ${caseId} nie ma latest_approved_snapshot_id — naruszono wewnętrzny niezmiennik"
  },
  {
    "en": "[startRoiCasePostInvestmentReview] ROI case ${caseId} compare/benefits-realization view returned null while its own row ",
    "pl": "[startRoiCasePostInvestmentReview] Przypadek ROI ${caseId} widok porównania/realizacji korzyści zwrócił wartość null i własny wiersz"
  },
  {
    "en": "[startRoiCasePostInvestmentReview] insert into rvn_roi_post_investment_reviews returned no row",
    "pl": "[startRoiCasePostInvestmentReview] wstawka do rvn_roi_post_investment_reviews nie zwróciła żadnego wiersza"
  },
  {
    "en": "[startRoiCasePostInvestmentReview] case update returned no row for ${caseId}",
    "pl": "[startRoiCasePostInvestmentReview] aktualizacja sprawy nie zwróciła żadnego wiersza dla ${caseId}"
  },
  {
    "en": "[updateRoiPostInvestmentReviewDraft] update returned no row for ${pirId}",
    "pl": "[updateRoiPostInvestmentReviewDraft] aktualizacja nie zwróciła żadnego wiersza dla ${pirId}"
  },
  {
    "en": "[recordRoiPirTeresaDraftDisposition] update returned no row for ${pirId}",
    "pl": "Aktualizacja [recordRoiPirTeresaDraftDisposition] nie zwróciła żadnego wiersza dla ${pirId}"
  },
  {
    "en": "[recordRoiPirTeresaLessonsDraft] update returned no row for ${pirId}",
    "pl": "Aktualizacja [recordRoiPirTeresaLessonsDraft] nie zwróciła żadnego wiersza dla ${pirId}"
  }
];
