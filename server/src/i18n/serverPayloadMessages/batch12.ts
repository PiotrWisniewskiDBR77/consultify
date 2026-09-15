import type { ServerPayloadMessage } from './index.js';

export const SERVER_PAYLOAD_MESSAGES_BATCH_12: readonly ServerPayloadMessage[] = [
  {
    "en": "business_version ${params.businessVersionId} has artifact_type=${bv.artifact_type}, not VALUATION_CASE",
    "pl": "business_version ${params.businessVersionId} ma artifact_type=${bv.artifact_type}, a nie VALUATION_CASE"
  },
  {
    "en": "business_version ${params.businessVersionId} is already registered as a variant",
    "pl": "business_version ${params.businessVersionId} jest już zarejestrowany jako wariant"
  },
  {
    "en": "business_version ${params.businessVersionId} not found for organization ${params.organizationId}",
    "pl": "business_version ${params.businessVersionId} nie znaleziony dla organizacji ${params.organizationId}"
  },
  {
    "en": "compareVersions requires both business_version_id to belong to artifact_id=${params.artifactId}; got A.artifact_id=${a.artifact_id}, B.artifact_id=${b.artifact_id}",
    "pl": "compareVersions wymaga, aby oba business_version_id należały do artifact_id=${params.artifactId}; otrzymano A.artifact_id=${a.artifact_id}, B.artifact_id=${b.artifact_id}"
  },
  {
    "en": "component ${c.componentKind} as_of_date (${c.asOfDate}) does not match bridge header as_of_date (${headerAsOfDate})",
    "pl": "komponent ${c.componentKind} as_of_date (${c.asOfDate}) nie pasuje do nagłówka mostka as_of_date (${headerAsOfDate})"
  },
  {
    "en": "component ${c.componentKind} has a negative amountDecimal (${c.amountDecimal}) — magnitude must be non-negative, direction comes from sign",
    "pl": "komponent ${c.componentKind} ma ujemną amountDecimal (${c.amountDecimal}) — wielkość musi być nieujemna, kierunek pochodzi od znaku"
  },
  {
    "en": "computeAnalysisKpis: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}",
    "pl": "computeAnalysisKpis: completeJobSuccess zgłosił NOT_RUNNING dla zadania ${runningJob.id}: ${completed.message}"
  },
  {
    "en": "createComputeSnapshot failed (${snap.code}): ${snap.message}",
    "pl": "utworzenie snapshotu obliczeniowego nie powiodło się (${snap.code}): ${snap.message}"
  },
  {
    "en": "data is required and must be an object",
    "pl": "dane są wymagane i muszą być obiektem"
  },
  {
    "en": "direct assumptions currency does not match FCFF currency",
    "pl": "waluta założeń bezpośrednich nie pasuje do waluty FCFF"
  },
  {
    "en": "directCashTaxRatePct is required for direct assumptions; cash tax is never inferred as zero",
    "pl": "directCashTaxRatePct jest wymagany dla założeń bezpośrednich; podatek gotówkowy nigdy nie jest wnioskowany jako zero"
  },
  {
    "en": "edge_type ${edgeType} requires assumption_snapshot_hash",
    "pl": "edge_type ${edgeType} wymaga assumption_snapshot_hash"
  },
  {
    "en": "empty result",
    "pl": "pusty wynik"
  },
  {
    "en": "event_id=${event.event_id} event_type=${event.event_type} org=${event.organization_id} attempts=${failResult.attempts} last_error=${message}",
    "pl": "event_id=${event.event_id} event_type=${event.event_type} org=${event.organization_id} attempts=${failResult.attempts} last_error=${message}",
    "runtime": false
  },
  {
    "en": "event_id=${event.event_id} event_type=${event.event_type} org=${event.organization_id} attempts=${failResult.attempts} last_error=NO_CONSUMER_REGISTERED",
    "pl": "event_id=${event.event_id} event_type=${event.event_type} org=${event.organization_id} attempts=${failResult.attempts} last_error=NO_CONSUMER_REGISTERED",
    "runtime": false
  },
  {
    "en": "exit_multiple_value must be > 0, got ${params.exitMultiple}",
    "pl": "exit_multiple_value musi być > 0, otrzymano ${params.exitMultiple}"
  },
  {
    "en": "expectedVersion (or If-Match) is required for this operation",
    "pl": "expectedVersion (lub If-Match) jest wymagany dla tej operacji"
  },
  {
    "en": "extraction_failed:${message}",
    "pl": "ekstrakcja_nie_powiodła_się:${message}"
  },
  {
    "en": "fieldId required",
    "pl": "wymagany fieldId"
  },
  {
    "en": "fieldsToMergeOn must contain at least one field ID",
    "pl": "fieldsToMergeOn musi zawierać co najmniej jeden identyfikator pola"
  },
  {
    "en": "financeExportService only exports STATEMENT_PACK artifacts today (got ${artifact.artifact_type})",
    "pl": "financeExportService eksportuje tylko artefakty STATEMENT_PACK dzisiaj (otrzymano ${artifact.artifact_type})"
  },
  {
    "en": "finance_prediction_can_start_compute(${params.businessVersionId}) = false — PREDICTION_COMPUTE job type refused",
    "pl": "finance_prediction_can_start_compute(${params.businessVersionId}) = false — typ zadania PREDICTION_COMPUTE odrzucony"
  },
  {
    "en": "financial_statement_lines has no row for line_code=${code}",
    "pl": "financial_statement_lines nie ma wiersza dla line_code=${code}"
  },
  {
    "en": "finding_statement cannot be empty",
    "pl": "finding_statement nie może być pusty"
  },
  {
    "en": "finding_statement is required",
    "pl": "finding_statement jest wymagany"
  },
  {
    "en": "forecastPeriodIds has ${params.forecastPeriodIds.length} entries but horizon_months=${ctx.model.horizon_months}",
    "pl": "forecastPeriodIds ma ${params.forecastPeriodIds.length} wpisów, ale horizon_months=${ctx.model.horizon_months}"
  },
  {
    "en": "formId required",
    "pl": "wymagany formId"
  },
  {
    "en": "image_openai_vision_http_${response.status}",
    "pl": "image_openai_vision_http_${response.status}",
    "runtime": false
  },
  {
    "en": "invalid SAML signature",
    "pl": "nieprawidłowa sygnatura SAML"
  },
  {
    "en": "invalid filterByFormula (parse error): ${reason} — formula: ${formula}",
    "pl": "nieprawidłowy filterByFormula (błąd parsowania): ${reason} — formuła: ${formula}"
  },
  {
    "en": "isAdjustment=true requires a non-empty adjustmentReason",
    "pl": "isAdjustment=true wymaga niepustego adjustmentReason"
  },
  {
    "en": "kpiComputeService: business_version ${params.businessVersionId} not found",
    "pl": "kpiComputeService: business_version ${params.businessVersionId} nie znaleziony"
  },
  {
    "en": "limits cannot be empty",
    "pl": "limity nie mogą być puste"
  },
  {
    "en": "limits is required",
    "pl": "limity są wymagane"
  },
  {
    "en": "malformed SAML response",
    "pl": "błędna odpowiedź SAML"
  },
  {
    "en": "matched cell has an invalid CellRef",
    "pl": "dopasowana komórka ma nieprawidłowy CellRef"
  },
  {
    "en": "meeting note materialization failed",
    "pl": "materializacja notatki spotkania nie powiodła się"
  },
  {
    "en": "method ${u.methodId} not found for business_version ${params.businessVersionId} / organization ${params.organizationId}",
    "pl": "metoda ${u.methodId} nie znaleziona dla business_version ${params.businessVersionId} / organizacja ${params.organizationId}"
  },
  {
    "en": "modelId required",
    "pl": "wymagany modelId"
  },
  {
    "en": "name and partnerType are required",
    "pl": "nazwa i partnerType są wymagane"
  },
  {
    "en": "next_action cannot be empty",
    "pl": "next_action nie może być pusty"
  },
  {
    "en": "next_action is required",
    "pl": "next_action jest wymagany"
  },
  {
    "en": "no NameID in assertion",
    "pl": "brak NameID w asercji"
  },
  {
    "en": "organizationId and subscriptionPlanId are required",
    "pl": "organizationId i subscriptionPlanId są wymagane"
  },
  {
    "en": "organizationId and workspaceId required for create_base",
    "pl": "organizationId i workspaceId wymagane do create_base"
  },
  {
    "en": "organizationId is required to create a task",
    "pl": "organizationId jest wymagany do utworzenia zadania"
  },
  {
    "en": "organizationId is required — nothing was read, so nothing can be asserted",
    "pl": "organizationId jest wymagany — nic nie zostało odczytane, więc nic nie można stwierdzić"
  },
  {
    "en": "partnerId, validFrom, and revenueSharePercent are required",
    "pl": "partnerId, validFrom i revenueSharePercent są wymagane"
  },
  {
    "en": "prev_hash mismatch: expected ${expectedPrevHash}, got ${row.prev_hash}",
    "pl": "niezgodność prev_hash: oczekiwano ${expectedPrevHash}, otrzymano ${row.prev_hash}"
  },
  {
    "en": "priority value must be a string",
    "pl": "wartość priorytetu musi być ciągiem znaków"
  },
  {
    "en": "readback_summary is required for this readback status",
    "pl": "readback_summary jest wymagany dla tego statusu readback"
  },
  {
    "en": "recordId required",
    "pl": "recordId wymagane"
  },
  {
    "en": "recordId required for delete",
    "pl": "recordId wymagane do usunięcia"
  },
  {
    "en": "recordId required for update",
    "pl": "recordId wymagane do aktualizacji"
  },
  {
    "en": "record_hash mismatch: stored ${row.record_hash}, computed ${recomputed}",
    "pl": "niezgodność record_hash: przechowywany ${row.record_hash}, obliczony ${recomputed}"
  },
  {
    "en": "removal_reason is required for pointer removal",
    "pl": "removal_reason jest wymagany do usunięcia wskaźnika"
  },
  {
    "en": "reopen requires a non-empty reason",
    "pl": "ponowne otwarcie wymaga niepustego powodu"
  },
  {
    "en": "reopenVersion failed: ${reopenResult.code} — ${reopenResult.message}",
    "pl": "ponowne otwarcie wersji nie powiodło się: ${reopenResult.code} — ${reopenResult.message}"
  },
  {
    "en": "resolver.cellRefAt returned an invalid CellRef",
    "pl": "resolver.cellRefAt zwrócił nieprawidłowy CellRef"
  },
  {
    "en": "restore point ${restorePoint.workspaceStateKey} does not describe workspace ${key}",
    "pl": "punkt przywracania ${restorePoint.workspaceStateKey} nie opisuje obszaru roboczego ${key}"
  }
];
