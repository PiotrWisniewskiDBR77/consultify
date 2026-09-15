import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_13: readonly ServerPayloadMessage[] = [
  {
    "en": "restore point belongs to organization ${restorePoint.organizationId}, workspace is ${state.organizationId}",
    "pl": "punkt przywracania należy do organizacji ${restorePoint.organizationId}, obszar roboczy to ${state.organizationId}"
  },
  {
    "en": "risk_score field has an invalid scale (${String(scaleRaw)})",
    "pl": "pole risk_score ma nieprawidłową skalę (${String(scaleRaw)})"
  },
  {
    "en": "risk_score value must be an integer",
    "pl": "wartość risk_score musi być liczbą całkowitą"
  },
  {
    "en": "risk_score value must be between 1 and ${scale}",
    "pl": "wartość risk_score musi być między 1 a ${scale}"
  },
  {
    "en": "runDcfFcffValuation: ${claimResult.message}",
    "pl": "runDcfFcffValuation: ${claimResult.message}",
    "runtime": false
  },
  {
    "en": "runDcfFcffValuation: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}",
    "pl": "runDcfFcffValuation: completeJobSuccess zgłosił NOT_RUNNING dla zadania ${runningJob.id}: ${completed.message}"
  },
  {
    "en": "runOverlayCompute: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}",
    "pl": "runOverlayCompute: completeJobSuccess zgłosił NOT_RUNNING dla zadania ${runningJob.id}: ${completed.message}"
  },
  {
    "en": "runStandardBase: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}",
    "pl": "runStandardBase: completeJobSuccess zgłosił NOT_RUNNING dla zadania ${runningJob.id}: ${completed.message}"
  },
  {
    "en": "script actions are disabled",
    "pl": "działania skryptu są wyłączone"
  },
  {
    "en": "sectionOverrides must be an object keyed by section id",
    "pl": "sectionOverrides musi być obiektem kluczowanym przez id sekcji"
  },
  {
    "en": "signature verification failed",
    "pl": "weryfikacja podpisu nie powiodła się"
  },
  {
    "en": "source rect is ragged (missing cell)",
    "pl": "prostokąt źródłowy jest nierówny (brak komórki)"
  },
  {
    "en": "sourceA/B artifactRef.organizationId (${artifactRef.organizationId}) does not match compareValues params.organizationId (${organizationId})",
    "pl": "sourceA/B artifactRef.organizationId (${artifactRef.organizationId}) nie pasuje do compareValues params.organizationId (${organizationId})"
  },
  {
    "en": "sourceVersionId not found in this organization",
    "pl": "sourceVersionId nie znaleziony w tej organizacji"
  },
  {
    "en": "source_reference external value exceeds ${SOURCE_REFERENCE_MAX_EXTERNAL_URL} chars",
    "pl": "wartość zewnętrzna source_reference przekracza ${SOURCE_REFERENCE_MAX_EXTERNAL_URL} znaków"
  },
  {
    "en": "source_reference value is empty",
    "pl": "wartość source_reference jest pusta"
  },
  {
    "en": "source_reference value must be a UUID (allow_external is false)",
    "pl": "wartość source_reference musi być UUID (allow_external to false)"
  },
  {
    "en": "source_reference value must be a string or object",
    "pl": "wartość source_reference musi być ciągiem znaków lub obiektem"
  },
  {
    "en": "source_reference.external_url exceeds ${SOURCE_REFERENCE_MAX_EXTERNAL_URL} chars",
    "pl": "external_url source_reference przekracza ${SOURCE_REFERENCE_MAX_EXTERNAL_URL} znaków"
  },
  {
    "en": "source_reference.external_url is not allowed (allow_external = false)",
    "pl": "external_url source_reference jest niedozwolony (allow_external = false)"
  },
  {
    "en": "source_reference.external_url must be a non-empty string",
    "pl": "external_url source_reference musi być niepustym ciągiem znaków"
  },
  {
    "en": "source_reference.source_id must be a UUID string",
    "pl": "source_id source_reference musi być ciągiem znaków UUID"
  },
  {
    "en": "tableId not resolved (dependency not executed?)",
    "pl": "tableId nie został rozwiązany (zależność nie została wykonana?)"
  },
  {
    "en": "tableId required",
    "pl": "tableId wymagane"
  },
  {
    "en": "target capital structure sums to ${targetDebtPct + targetEquityPct}, not ~100 (chk_finance_wacc_target_structure_sum should have already rejected this at the DB layer)",
    "pl": "suma docelowej struktury kapitałowej wynosi ${targetDebtPct + targetEquityPct}, nie ~100 (chk_finance_wacc_target_structure_sum powinno już odrzucić to na poziomie DB)"
  },
  {
    "en": "target stage_rank (${targetRank}) must be greater than source stage_rank (${sourceRank}) for edge_type ${edgeType}",
    "pl": "stage_rank docelowy (${targetRank}) musi być większy niż stage_rank źródłowy (${sourceRank}) dla edge_type ${edgeType}"
  },
  {
    "en": "target_capital_structure_equity_pct=${targetEquityPct} — Hamada relevering requires a positive equity weight (D/E undefined at 0% equity)",
    "pl": "target_capital_structure_equity_pct=${targetEquityPct} — Hamada relevering wymaga dodatniego udziału kapitału własnego (D/E niezdefiniowane przy 0% kapitału własnego)"
  },
  {
    "en": "task_id is required",
    "pl": "task_id jest wymagane"
  },
  {
    "en": "terminal growth g_pct (${gPct}) must be strictly less than computed WACC (${waccPct}) — Gordon Growth is undefined/negative otherwise",
    "pl": "terminalny wzrost g_pct (${gPct}) musi być ścisłe mniejszy niż obliczone WACC (${waccPct}) — w przeciwnym razie wzrost Gordona jest niezdefiniowany/ujemny"
  },
  {
    "en": "terminal.gPct is required",
    "pl": "terminal.gPct jest wymagany"
  },
  {
    "en": "unsupported expression in filterByFormula (node: ${node.type})",
    "pl": "nieobsługiwane wyrażenie w filterByFormula (węzeł: ${node.type})"
  },
  {
    "en": "valuationAsOfDate is required for direct net-debt bridge",
    "pl": "valuationAsOfDate jest wymagany dla bezpośredniego mostu net-debt"
  },
  {
    "en": "variantIdA and variantIdB are the same variant",
    "pl": "variantIdA i variantIdB są tym samym wariantem"
  },
  {
    "en": "verified above",
    "pl": "zweryfikowane powyżej"
  },
  {
    "en": "viewId required",
    "pl": "viewId wymagane"
  },
  {
    "en": "⚠️ Your Partner Discount Expires in ${data.daysRemaining} Days",
    "pl": "⚠️ Twoja zniżka partnera wygasa za ${data.daysRemaining} dni"
  },
  {
    "en": "🎉 New Referral: ${data.organizationName}",
    "pl": "🎉 Nowe polecenie: ${data.organizationName}"
  },
  {
    "en": "💰 Commission Earned: ${data.currency} ${data.commissionAmount.toFixed(2)}",
    "pl": "💰 Naliczona prowizja: ${data.currency} ${data.commissionAmount.toFixed(2)}"
  },
  {
    "en": "${alert.message} | Failed checks: ${alert.checks}",
    "pl": "${alert.message} | Nieudane kontrole: ${alert.checks}"
  },
  {
    "en": "Invalid code. ${remainingAttempts} attempts remaining.",
    "pl": "Nieprawidłowy kod. Pozostało prób: ${remainingAttempts}."
  },
  {
    "en": "Invalid code. Please request a new code.",
    "pl": "Nieprawidłowy kod. Poproś o nowy kod."
  },
  {
    "en": "Model not allowed by policy: ${modelId}",
    "pl": "Model niedozwolony przez politykę: ${modelId}"
  },
  {
    "en": "AI budget exceeded: ${warning}",
    "pl": "Przekroczono budżet AI: ${warning}"
  },
  {
    "en": "Meeting execution requires organizationId",
    "pl": "Wykonanie spotkania wymaga organizationId"
  },
  {
    "en": "Meeting execution requires title and start_time",
    "pl": "Wykonanie spotkania wymaga tytułu i start_time"
  },
  {
    "en": "AI prompt step requires a prompt",
    "pl": "Krok promptu AI wymaga promptu"
  },
  {
    "en": "Unknown step type: ${step.type}",
    "pl": "Nieznany typ kroku: ${step.type}"
  },
  {
    "en": "${alert.message}${alert.checks?.length ? ",
    "pl": "${alert.message}${alert.checks?.length ? ",
    "runtime": false
  },
  {
    "en": "Invalid code. ${remainingAttempts > 0 ? ",
    "pl": "Invalid code. ${remainingAttempts > 0 ? ",
    "runtime": false
  }
];
