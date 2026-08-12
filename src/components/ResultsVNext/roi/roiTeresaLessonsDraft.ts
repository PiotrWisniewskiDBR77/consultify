/**
 * RN-G4 lane `teresa` (FALA 2, 2026-08-11) — ROI-domain wiring for the
 * shared `TeresaProposalPanel`: the ONE real, landed ROI advisor mode
 * (`pir_lessons_draft`, ROI-E008 §2/A1-A2, verified against real code —
 * `server/src/services/v8/teresaCopilotService.ts` L3106-3145 calls
 * `recordRoiPirTeresaLessonsDraft` in
 * `server/src/services/resultsVnext/roi/roiPirCommands.ts` L827-903).
 *
 * IMPORTANT SCOPING NOTE: `buildRoiPirLessonsDraftSuggestion` below composes
 * the PROPOSED `draft_lessons_text`/`evidence_breakdown` CLIENT-SIDE, from
 * already-visible PIR/case fields only (case title, PIR sequence/status,
 * the frozen `review_snapshot_hash`, whether a human draft already exists)
 * — it never invents a number or a fact. This is a deliberate, documented
 * simplification: real Teresa narrative generation happens through the
 * chat/LLM layer, which lives in `server/**`/`src/components/AIChat/**`,
 * both outside this lane's allowlist and unwired to this results-vnext
 * surface. The server-side command this suggestion feeds
 * (`recordRoiPirTeresaLessonsDraft`) does not itself generate any text
 * either — it persists whatever `draftPayload` the caller sends, so this
 * client-side compose step stands in for "Teresa already drafted this in
 * chat" without a real chat round-trip. The two-gate structure (this write
 * only touches `teresa_draft_lessons_payload`/`teresa_draft_generated_at`;
 * `lessons_learned` only ever changes via the pre-existing, human-authored
 * `recordRoiPirTeresaDraftDisposition` disposition step) is what keeps this
 * honest — nothing here can silently become the record of truth.
 */
import type { RoiCaseListItem } from './roiApi';
import type { RoiPostInvestmentReview } from './roiCaseFullToolApi';
import type {
  ResultsRoiHandoffContext,
  TeresaHandoffContext,
} from '../teresa/teresaHandoffTypes';
import type { TeresaEvidenceBreakdownValue } from '../teresa/TeresaEvidenceBreakdown';

export interface RoiTeresaPirLessonsDraftSuggestion {
  draftLessonsText: string;
  evidenceBreakdown: TeresaEvidenceBreakdownValue;
  evidencePointers: string[];
}

export function buildRoiPirLessonsDraftSuggestion(params: {
  roiCase: RoiCaseListItem;
  pir: RoiPostInvestmentReview;
  isPolish: boolean;
}): RoiTeresaPirLessonsDraftSuggestion {
  const { roiCase, pir, isPolish } = params;
  const facts: string[] = [
    isPolish
      ? `Sprawa „${roiCase.title}" (case-id: ${roiCase.caseId}).`
      : `Case "${roiCase.title}" (case-id: ${roiCase.caseId}).`,
    isPolish
      ? `PIR #${pir.sequenceNumber}, status: ${pir.status}, rozpoczęty ${pir.startedAt}.`
      : `PIR #${pir.sequenceNumber}, status: ${pir.status}, started ${pir.startedAt}.`,
    isPolish
      ? `Migawka przeglądu jest zamrożona (review_snapshot_hash: ${pir.reviewSnapshotHash}).`
      : `The review snapshot is frozen (review_snapshot_hash: ${pir.reviewSnapshotHash}).`,
  ];
  const inference: string[] = [];
  const missing: string[] = [];

  if (pir.outcome) {
    facts.push(
      isPolish ? `Wynik zapisany przez człowieka: ${pir.outcome}.` : `Human-recorded outcome: ${pir.outcome}.`
    );
  } else {
    missing.push(
      isPolish
        ? 'Pole „Wynik" nie zostało jeszcze wypełnione przez człowieka.'
        : 'The "Outcome" field has not been filled in by a human yet.'
    );
  }

  if (pir.lessonsLearned) {
    inference.push(
      isPolish
        ? 'Istnieje już ludzki szkic wniosków — Teresa go NIE nadpisuje, tylko proponuje wersję do porównania.'
        : 'A human lessons-learned draft already exists — Teresa does NOT overwrite it, only proposes a version to compare.'
    );
  } else {
    missing.push(
      isPolish
        ? 'Brak jeszcze żadnego ludzkiego tekstu wniosków do porównania.'
        : 'No human lessons-learned text exists yet to compare against.'
    );
  }

  const draftLessonsText = isPolish
    ? `Szkic Teresy do przeglądu — PIR #${pir.sequenceNumber} sprawy „${roiCase.title}". ` +
      'Ten tekst jest WYŁĄCZNIE propozycją: nic nie trafi do pola „Wnioski" bez Twojej osobnej ' +
      'decyzji w oknie „Decyzja o szkicu Teresy". Uzupełnij lub zastąp treść przed akceptacją.'
    : `Teresa's draft for review — PIR #${pir.sequenceNumber} of case "${roiCase.title}". ` +
      'This text is ONLY a proposal: nothing lands in "Lessons learned" without your separate ' +
      'decision in "Teresa draft decision". Edit or replace before accepting.';

  return {
    draftLessonsText,
    evidenceBreakdown: {
      facts,
      inference,
      missing_evidence: missing,
      recommendation: isPolish
        ? 'Przejrzyj szkic, uzupełnij realną treść i podejmij decyzję w oknie „Decyzja o szkicu Teresy".'
        : 'Review the draft, fill in the real content, and decide in "Teresa draft decision".',
    },
    evidencePointers: [
      `roi_case:${roiCase.caseId}`,
      `roi_pir:${pir.pirId}`,
      `review_snapshot_hash:${pir.reviewSnapshotHash}`,
    ],
  };
}

export function buildRoiPirLessonsDraftHandoffContext(params: {
  roiCase: RoiCaseListItem;
  pir: RoiPostInvestmentReview;
  organizationId: string;
  suggestion: RoiTeresaPirLessonsDraftSuggestion;
  sessionId: string;
}): TeresaHandoffContext {
  const { roiCase, pir, organizationId, suggestion, sessionId } = params;
  return {
    origin: 'teresa',
    user_intent: `Draft PIR lessons for case "${roiCase.title}" (PIR #${pir.sequenceNumber})`,
    active_surface: `results/roi/case/${roiCase.caseId}/learn/pir/${pir.pirId}`,
    org_context_ref: organizationId,
    runtime_binding: { session_id: sessionId, conversation_id: sessionId },
    bounded_context_pack: [
      { ref: `roi_case:${roiCase.caseId}`, type: 'roi_case', deeplink: `/results/roi/${roiCase.caseId}` },
      { ref: `roi_pir:${pir.pirId}`, type: 'roi_pir', deeplink: null },
    ],
    constraints: [
      'Teresa never writes lessons_learned directly (ROI-E006 D13 two-gate structure).',
      'Only draftable while the PIR is in status=draft.',
    ],
    assumptions: [],
    uncertainty_boundary: {
      missing_inputs: suggestion.evidenceBreakdown.missing_evidence,
      conflicts: [],
      what_would_change_next_action: [],
    },
    evidence_pointers: suggestion.evidencePointers,
    proposed_next_action: { target_module: 'roi', handoff_intent: 'append', requires_approval: true },
    audit_stub: { actor: 'teresa', timestamp: new Date().toISOString() },
  };
}

export function buildRoiPirLessonsDraftTargetPayload(params: {
  pir: RoiPostInvestmentReview;
  caseId: string;
  suggestion: RoiTeresaPirLessonsDraftSuggestion;
}): Record<string, unknown> {
  const { pir, caseId, suggestion } = params;
  const roiHandoffContext: ResultsRoiHandoffContext = {
    advisor_mode: 'pir_lessons_draft',
    target_resource: { resource_type: 'roi_pir', resource_id: pir.pirId },
    case_id: caseId,
    expected_version: pir.rowVersion,
    pir_lessons_draft: {
      draft_lessons_text: suggestion.draftLessonsText,
      evidence_breakdown: suggestion.evidenceBreakdown,
    },
  };
  return {
    roi_handoff_context: roiHandoffContext,
    evidence_pointers: suggestion.evidencePointers,
  };
}

export function roiPirTeresaConsequencePreview(pir: RoiPostInvestmentReview, isPolish: boolean): string {
  return isPolish
    ? `Po wykonaniu zapisane zostaną WYŁĄCZNIE dwie kolumny PIR #${pir.sequenceNumber}: ` +
      'teresa_draft_lessons_payload i teresa_draft_generated_at. Pole „Wnioski" (lessons_learned) ' +
      'NIE zmieni się automatycznie — wymaga Twojej osobnej decyzji w oknie „Decyzja o szkicu Teresy".'
    : `On execute, ONLY two columns of PIR #${pir.sequenceNumber} will be written: ` +
      'teresa_draft_lessons_payload and teresa_draft_generated_at. The "Lessons learned" field ' +
      'will NOT change automatically — it needs your separate decision in "Teresa draft decision".';
}
