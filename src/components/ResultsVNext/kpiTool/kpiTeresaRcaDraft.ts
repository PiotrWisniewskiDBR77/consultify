/**
 * RN-G5 lane `teresa` (2026-08-12) — KPI-domain wiring for the shared
 * `TeresaProposalPanel`, the `reflection_rca` advisor mode (KPI-E006 §D,
 * verified against real code — `server/src/services/v8/teresaCopilotService.ts`
 * `handleKpiDeviationReflectionRca` calls `submitRootCause`
 * (`server/src/services/resultsVnext/kpi/kpiDeviationCommands.ts`) with
 * `actorUserId: userId` — the APPROVING HUMAN, never a `'teresa'` sentinel —
 * so the pre-existing self-approval gate on `approvePlan` downstream still
 * applies. Proven end-to-end by the real-Postgres test
 * `tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts`, which
 * already exists on this branch and is NOT modified by this lane.
 *
 * UNLIKE ROI's `pir_lessons_draft` (a two-gate structure — Teresa writes
 * ONLY a draft column, a SEPARATE human disposition step promotes it),
 * `reflection_rca`'s `execute` step commits the REAL
 * `rootCauseSummary`/`rootCauseCategory` on the deviation case — there is no
 * second draft column. This is a deliberate, documented difference from
 * ROI, not an oversight: the case's own state machine only exposes the
 * "propose → approve → execute → audit" P08 lifecycle as its single
 * decision point, so `TeresaProposalPanel`'s own approve/execute gates ARE
 * the human decision this write requires. To keep this honest (no silent
 * "Teresa invents the analysis and a human rubber-stamps text they never
 * really read"), `buildKpiRcaSuggestion` below NEVER lets the panel show
 * text the human did not themselves type: it is a thin snapshot of the
 * ALREADY-VISIBLE `rootCauseSummary`/`rootCauseCategory`/`recurrenceFlag`
 * fields on `KpiDeviationCaseSubview`'s own pre-existing manual form (the
 * exact same fields the pre-existing "Zapisz analizę" button reads) — the
 * "Ask Teresa" action is disabled until those fields are filled, same
 * disabled condition as the manual submit button. Teresa's role here is
 * routing the human's own already-written analysis through the governed,
 * audited P08 pipeline — not authoring it.
 */
import type { DeviationCaseDto } from './kpiDeviationApi';
import type { TeresaEvidenceBreakdownValue } from '../teresa/TeresaEvidenceBreakdown';
import type { TeresaHandoffContext } from '../teresa/teresaHandoffTypes';

export interface KpiRcaFormSnapshot {
  rootCauseSummary: string;
  rootCauseCategory: string;
  recurrenceFlag: boolean;
}

export interface KpiTeresaRcaSuggestion {
  evidenceBreakdown: TeresaEvidenceBreakdownValue;
  evidencePointers: string[];
}

export function buildKpiRcaSuggestion(params: {
  kase: DeviationCaseDto;
  form: KpiRcaFormSnapshot;
  isPolish: boolean;
}): KpiTeresaRcaSuggestion {
  const { kase, form, isPolish } = params;
  const facts: string[] = [
    isPolish
      ? `Sprawa odchylenia ${kase.caseId.slice(0, 8)}, dotkliwość: ${kase.severity}, wykryta ${kase.detectedAt}.`
      : `Deviation case ${kase.caseId.slice(0, 8)}, severity: ${kase.severity}, detected ${kase.detectedAt}.`,
    isPolish
      ? `Pomiar wywołujący: ${kase.triggerMeasurementId.slice(0, 8)}.`
      : `Trigger measurement: ${kase.triggerMeasurementId.slice(0, 8)}.`,
    isPolish
      ? 'Treść poniżej to DOKŁADNIE to, co wpisałeś/aś w formularzu tego ekranu — Teresa niczego nie dopisała.'
      : 'The text below is EXACTLY what you typed into this screen\'s own form — Teresa added nothing.',
  ];
  const inference: string[] = [];
  const missing: string[] = [];

  if (kase.recurrenceFlag !== form.recurrenceFlag && form.recurrenceFlag) {
    inference.push(
      isPolish
        ? 'Oznaczono jako powtarzające się odchylenie.'
        : 'Marked as a recurring deviation.'
    );
  }
  if (!form.rootCauseSummary.trim()) {
    missing.push(isPolish ? 'Podsumowanie przyczyny jest puste.' : 'Root cause summary is empty.');
  }
  if (!form.rootCauseCategory.trim()) {
    missing.push(isPolish ? 'Kategoria przyczyny jest pusta.' : 'Root cause category is empty.');
  }

  return {
    evidenceBreakdown: {
      facts,
      inference,
      missing_evidence: missing,
      recommendation: isPolish
        ? 'Sprawdź treść poniżej — to Twój własny tekst. Zatwierdź, aby zapisać go jako oficjalną analizę przyczyny źródłowej.'
        : 'Review the text below — it is your own writing. Approve to record it as the official root cause analysis.',
    },
    evidencePointers: [`deviation_case:${kase.caseId}`, `measurement:${kase.triggerMeasurementId}`],
  };
}

export function buildKpiRcaHandoffContext(params: {
  kase: DeviationCaseDto;
  suggestion: KpiTeresaRcaSuggestion;
  sessionId: string;
}): TeresaHandoffContext {
  const { kase, suggestion, sessionId } = params;
  return {
    origin: 'teresa',
    user_intent: `Record root cause analysis for deviation case ${kase.caseId}`,
    active_surface: `results/kpi/${kase.kpiId}/deviation-cases/${kase.caseId}`,
    org_context_ref: kase.organizationId,
    runtime_binding: { session_id: sessionId, conversation_id: sessionId },
    bounded_context_pack: [
      {
        ref: `deviation_case:${kase.caseId}`,
        type: 'kpi_deviation_case',
        deeplink: `/results/kpi/${kase.kpiId}/deviation-cases/${kase.caseId}`,
      },
    ],
    constraints: [
      'Teresa never approves the corrective plan that follows this analysis (KPI-E006 self-approval gate).',
      'Only draftable while the case is in status=analysis_required.',
    ],
    assumptions: [],
    uncertainty_boundary: {
      missing_inputs: suggestion.evidenceBreakdown.missing_evidence,
      conflicts: [],
      what_would_change_next_action: [],
    },
    evidence_pointers: suggestion.evidencePointers,
    proposed_next_action: { target_module: 'kpi', handoff_intent: 'append', requires_approval: true },
    audit_stub: { actor: 'teresa', timestamp: new Date().toISOString() },
  };
}

export function buildKpiRcaTargetPayload(params: {
  kase: DeviationCaseDto;
  form: KpiRcaFormSnapshot;
  suggestion: KpiTeresaRcaSuggestion;
}): Record<string, unknown> {
  const { kase, form, suggestion } = params;
  return {
    kpi_handoff_context: {
      advisor_mode: 'reflection_rca',
      target_resource: { resource_type: 'deviation_case', resource_id: kase.caseId },
      expected_version: kase.rowVersion,
      reflection_rca: {
        case_id: kase.caseId,
        proposed_root_cause_summary: form.rootCauseSummary.trim(),
        proposed_root_cause_category: form.rootCauseCategory.trim(),
        recurrence_flag: form.recurrenceFlag,
        evidence_breakdown: suggestion.evidenceBreakdown,
      },
    },
    evidence_pointers: suggestion.evidencePointers,
  };
}

export function kpiRcaConsequencePreview(isPolish: boolean): string {
  return isPolish
    ? 'Po wykonaniu zapisane zostaną: podsumowanie przyczyny, kategoria przyczyny i flaga powtarzalności ' +
      'na tej sprawie odchylenia — dokładnie to, co widzisz powyżej. Sprawa przejdzie do stanu „Wymaga planu". ' +
      'Zatwierdzenie planu korygującego to ODDZIELNY krok i nadal wymaga innej osoby niż Ty (self-approval jest zablokowany).'
    : 'On execute, this deviation case will record: the root cause summary, category, and recurrence flag — ' +
      'exactly what you see above. The case will move to "Plan required". Approving the corrective plan is a ' +
      'SEPARATE step and still requires someone other than you (self-approval remains blocked).';
}
