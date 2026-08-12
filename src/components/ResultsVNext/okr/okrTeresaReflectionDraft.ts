/**
 * RN-G5 lane `teresa` (2026-08-12, orchestrator-mandated follow-up: OKR was
 * the one domain of the three left entirely unwired) — OKR-domain wiring
 * for the shared `TeresaProposalPanel`: the `reflection_synthesis` advisor
 * mode (OKR-E008/OKR-F-027, verified against real code —
 * `server/src/services/v8/teresaCopilotService.ts` L3390-3441
 * `handleOkrReflectionSynthesis` calls `recordOkrReflectionTeresaDraft`
 * in `server/src/services/resultsVnext/okr/okrReflectionCommands.ts`).
 *
 * TWO-GATE structure, structurally identical to ROI's `pir_lessons_draft`
 * (execute writes ONLY `teresa_draft_reflection_payload`/
 * `teresa_draft_generated_at` on `okr_vnext_reflections`, never
 * `what_worked`/`what_did_not_work`/`why`/`learning`/`next_cycle_change`/
 * `disposition`) — BUT with one real, confirmed divergence from ROI that
 * this file's design accounts for rather than papers over:
 *
 * ROI has a dedicated REST route for the SECOND gate
 * (`POST .../post-investment-reviews/:pirId/teresa-draft-disposition`,
 * `server/src/routes/resultsVnext/roi.routes.ts` L2798) that lets a human
 * record accept/reject on the ALREADY-PERSISTED draft, independently of
 * actually copying its text into the real narrative fields.
 *
 * OKR has NO SUCH ROUTE. Grepped `server/src/routes/resultsVnext/okr.routes.ts`
 * for `teresa-draft-disposition`/`TeresaDraft` — zero hits. The command
 * function `recordOkrReflectionTeresaDraftDisposition` exists server-side
 * (confirmed in `okrReflectionCommands.ts` and exercised directly by
 * `tests/resultsVnext/okr/okrReflectionTeresaDraft.realdb.test.ts`) but is
 * never wired to an Express route — a genuine, confirmed SERVER GAP
 * (`server/**` is frozen for this lane; flagged for the parallel track /
 * a future session, not fixed here).
 *
 * Building a UI button that calls a route which does not exist would be
 * dishonest scaffolding, so this lane does NOT attempt a ROI-style
 * disposition modal for OKR. Instead: once Teresa's draft is generated and
 * executed (the FULL governed P08 propose→approve/reject→execute→audit
 * pipeline, identical in rigor to ROI/KPI), the draft text this session
 * just sent is shown back to the human (from local state — there is also
 * NO `GET .../objectives/:id/reflection` endpoint per
 * `okrWorkspaceApi.ts`'s own documented gap, so it cannot be re-fetched
 * from the server either) with a PURELY CLIENT-SIDE "insert into fields"
 * convenience action that fills the pre-existing, human-editable reflection
 * textareas in `OkrReviewReflectionView.tsx` — no network call. The human
 * must still review/edit and click the PRE-EXISTING "Zapisz refleksję"
 * button (`recordObjectiveReflection`) to commit anything to the real
 * narrative fields. This keeps every D13 invariant true even with the gap:
 * Teresa never writes the narrative, the human's own explicit click is the
 * only authorized command that does, and the generation half still gets
 * the full audited P08 lifecycle.
 */
import type { OkrObjectiveWithKeyResultsDto } from './okrObjectiveApi';
import type { OkrSetDto } from './okrApi';
import type {
  ResultsOkrHandoffContext,
  TeresaHandoffContext,
} from '../teresa/teresaHandoffTypes';
import type { TeresaEvidenceBreakdownValue } from '../teresa/TeresaEvidenceBreakdown';

export interface OkrTeresaReflectionSuggestion {
  draftReflectionText: string;
  evidenceBreakdown: TeresaEvidenceBreakdownValue;
  evidencePointers: string[];
}

export function buildOkrReflectionSuggestion(params: {
  set: OkrSetDto;
  objective: OkrObjectiveWithKeyResultsDto;
  isPolish: boolean;
}): OkrTeresaReflectionSuggestion {
  const { set, objective, isPolish } = params;
  const facts: string[] = [
    isPolish
      ? `Cel „${objective.title}" (zestaw: ${set.title}).`
      : `Objective "${objective.title}" (set: ${set.title}).`,
    isPolish
      ? `Status zestawu: ${set.status}. Wersja: ${set.rowVersion}.`
      : `Set status: ${set.status}. Row version: ${set.rowVersion}.`,
  ];
  const inference: string[] = [];
  const missing: string[] = [];

  if (objective.progress != null) {
    const pct = (Number(objective.progress) * 100).toFixed(0);
    facts.push(
      isPolish
        ? `Postęp celu: ${pct}% (${objective.progressCalcReason || 'brak uzasadnienia'}).`
        : `Objective progress: ${pct}% (${objective.progressCalcReason || 'no reason given'}).`
    );
  } else {
    missing.push(
      isPolish
        ? 'Postęp celu nie jest jeszcze policzalny (brak danych z Kluczowych Rezultatów).'
        : 'Objective progress is not calculable yet (no Key Result data).'
    );
  }
  if (objective.keyResults && objective.keyResults.length > 0) {
    facts.push(
      isPolish
        ? `${objective.keyResults.length} Kluczowych Rezultatów pod tym celem.`
        : `${objective.keyResults.length} Key Results under this objective.`
    );
  } else {
    missing.push(
      isPolish ? 'Ten cel nie ma jeszcze żadnych Kluczowych Rezultatów.' : 'This objective has no Key Results yet.'
    );
  }
  inference.push(
    isPolish
      ? 'To WYŁĄCZNIE szkic do przeglądu — nic nie trafi do pól refleksji bez Twojej osobnej edycji i kliknięcia „Zapisz refleksję".'
      : 'This is ONLY a draft for review — nothing lands in the reflection fields without your own edit and a separate "Save reflection" click.'
  );

  const draftReflectionText = isPolish
    ? `Szkic Teresy do przeglądu — cel „${objective.title}" (zestaw „${set.title}"). ` +
      'Ten tekst jest WYŁĄCZNIE propozycją: skopiuj go (przyciskiem „Wstaw szkic Teresy do pól" poniżej), ' +
      'popraw treść i uzupełnij pola Co zadziałało / Co nie zadziałało / Dlaczego / Czego się nauczono / ' +
      'Zmiana w kolejnym cyklu, a następnie kliknij „Zapisz refleksję" — dopiero to jest oficjalny zapis.'
    : `Teresa's draft for review — objective "${objective.title}" (set "${set.title}"). ` +
      'This text is ONLY a proposal: copy it in (the "Insert Teresa\'s draft into fields" button below), ' +
      'edit it, fill in What worked / What didn\'t work / Why / Learning / Next-cycle change, then click ' +
      '"Save reflection" — only that click is the official record.';

  return {
    draftReflectionText,
    evidenceBreakdown: {
      facts,
      inference,
      missing_evidence: missing,
      recommendation: isPolish
        ? 'Przejrzyj szkic, wstaw go do pól, popraw i zapisz refleksję ręcznie.'
        : 'Review the draft, insert it into the fields, edit, and save the reflection manually.',
    },
    evidencePointers: [`okr_set:${set.setId}`, `okr_objective:${objective.objectiveId}`],
  };
}

export function buildOkrReflectionHandoffContext(params: {
  set: OkrSetDto;
  objective: OkrObjectiveWithKeyResultsDto;
  organizationId: string;
  suggestion: OkrTeresaReflectionSuggestion;
  sessionId: string;
}): TeresaHandoffContext {
  const { set, objective, organizationId, suggestion, sessionId } = params;
  return {
    origin: 'teresa',
    user_intent: `Draft a reflection synthesis for objective "${objective.title}" (set "${set.title}")`,
    active_surface: `results/okr/sets/${set.setId}/review/objective/${objective.objectiveId}`,
    org_context_ref: organizationId,
    runtime_binding: { session_id: sessionId, conversation_id: sessionId },
    bounded_context_pack: [
      { ref: `okr_set:${set.setId}`, type: 'okr_set', deeplink: `/results/okr/sets/${set.setId}` },
      { ref: `okr_objective:${objective.objectiveId}`, type: 'okr_objective', deeplink: null },
    ],
    constraints: [
      'Teresa never writes what_worked/what_did_not_work/why/learning/next_cycle_change/disposition directly (OKR-E008 D-OKR8-7 two-gate structure).',
      'No REST route exists yet for a dedicated draft-disposition decision on OKR (confirmed gap, unlike ROI) — the human commits via the pre-existing manual "Save reflection" action instead.',
    ],
    assumptions: [],
    uncertainty_boundary: {
      missing_inputs: suggestion.evidenceBreakdown.missing_evidence,
      conflicts: [],
      what_would_change_next_action: [],
    },
    evidence_pointers: suggestion.evidencePointers,
    proposed_next_action: { target_module: 'okr', handoff_intent: 'append', requires_approval: true },
    audit_stub: { actor: 'teresa', timestamp: new Date().toISOString() },
  };
}

export function buildOkrReflectionTargetPayload(params: {
  set: OkrSetDto;
  objective: OkrObjectiveWithKeyResultsDto;
  expectedVersion: number;
  suggestion: OkrTeresaReflectionSuggestion;
}): Record<string, unknown> {
  const { set, objective, expectedVersion, suggestion } = params;
  const okrHandoffContext: ResultsOkrHandoffContext = {
    advisor_mode: 'reflection_synthesis',
    target_resource: { resource_type: 'okr_objective', resource_id: objective.objectiveId },
    expected_version: expectedVersion,
    reflection_synthesis: {
      set_id: set.setId,
      objective_id: objective.objectiveId,
      draft_reflection_text: suggestion.draftReflectionText,
      proposed_disposition_hint: null,
      evidence_breakdown: suggestion.evidenceBreakdown,
    },
  };
  return {
    okr_handoff_context: okrHandoffContext,
    evidence_pointers: suggestion.evidencePointers,
  };
}

export function okrReflectionTeresaConsequencePreview(isPolish: boolean): string {
  return isPolish
    ? 'Po wykonaniu zapisane zostaną WYŁĄCZNIE dwie kolumny szkicu refleksji: ' +
      'teresa_draft_reflection_payload i teresa_draft_generated_at. Pola „Co zadziałało" / „Co nie zadziałało" / ' +
      '„Dlaczego" / „Czego się nauczono" / „Zmiana w kolejnym cyklu" / „Dyspozycja" NIE zmienią się automatycznie ' +
      '— serwer nie ma jeszcze osobnego punktu końcowego do zapisania decyzji o tym szkicu (potwierdzona luka), ' +
      'więc jedyną drogą do oficjalnego zapisu pozostaje ręczne wstawienie treści i kliknięcie „Zapisz refleksję".'
    : 'On execute, ONLY two columns of the reflection draft will be written: ' +
      'teresa_draft_reflection_payload and teresa_draft_generated_at. The "What worked" / "What didn\'t work" / ' +
      '"Why" / "Learning" / "Next-cycle change" / "Disposition" fields will NOT change automatically — the server ' +
      'has no dedicated endpoint yet to record a decision on this draft (a confirmed gap), so the only path to an ' +
      'official record remains manually inserting the text and clicking "Save reflection".';
}

/** Extracts the CAS `row_version` Teresa's execute step actually wrote, from
 * `execution.handoff_result` (`teresaCopilotService.ts`'s own
 * `handleOkrReflectionSynthesis` return shape: `{handoff:'okr',
 * advisor_mode, objective_id, set_id, row_version, real_entity, outcome,
 * draft}`). Needed because — per the same documented gap as the manual
 * save path — there is no GET endpoint to re-discover this later; the
 * session-scoped `reflectionVersions` cache in `OkrReviewReflectionView.tsx`
 * is the only place this client remembers a reflection row's CAS version,
 * so Teresa's own successful writes must feed that SAME cache or a
 * subsequent manual "Save reflection" would stale-CAS-fail against a
 * version the client never learned about. */
export function extractOkrReflectionRowVersionFromHandoffResult(
  handoffResult: Record<string, unknown> | undefined
): number | null {
  if (!handoffResult) return null;
  const raw = handoffResult.row_version;
  return typeof raw === 'number' ? raw : null;
}
