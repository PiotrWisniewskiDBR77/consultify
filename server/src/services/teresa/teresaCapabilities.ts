/**
 * Teresa capability registry + handlers, scoped to the Dynamic SWOT tool
 * (`dynamic-swot`, K1 engine: src/config/swot/swotTensionEngine.ts).
 *
 * TERESA_CAPABILITIES (src/method-core/contracts/teresa.ts) is a closed set
 * shared by the conversation route AND local buttons — the anti-duplication
 * rule (TOOL_SESSION_WORKSPACE_STANDARD.md §6A) requires both to resolve to
 * the SAME registry entry, which is why this module exports one definition
 * table and both callers (conversation / button) are expected to import it
 * rather than re-implement drafting logic.
 *
 * Every handler here only READS session.items / session.tensions (computed
 * fresh from swotTensionEngine, never cached) and produces TeresaStatement /
 * TeresaProposedChange values. NOTHING in this file writes anywhere — that
 * is the kernel's job (teresaKernel.ts), and only after human confirmation.
 *
 * K1 DISCIPLINE: no handler below ever asserts a fact about which tensions
 * exist or their priority — that is exclusively swotTensionEngine output.
 * Handlers may reference tension ids for grounding but never fabricate or
 * override one.
 */
import type { SWOTItem } from '../tools/domain/swotTypes.js';
import {
  TERESA_CAPABILITIES,
  TERESA_FORBIDDEN_EFFECTS,
  type TeresaCapabilityDefinition,
  type TeresaCapabilityId,
  type TeresaForbiddenEffect,
  type TeresaIntent,
  type TeresaProposedChange,
  type TeresaQualityCheck,
  type TeresaQualityVerdict,
  type TeresaStatement,
} from '../../method-core/contracts/teresa.js';

export interface TeresaSwotSessionSnapshot {
  sessionId: string;
  organizationId: string;
  methodPackVersion: string;
  items: SWOTItem[];
}

export interface TeresaCapabilityContext {
  intent: TeresaIntent;
  session: TeresaSwotSessionSnapshot;
}

export interface TeresaCapabilityOutcome {
  statements: TeresaStatement[];
  proposedChanges: TeresaProposedChange[];
  quality: TeresaQualityVerdict;
}

export type TeresaCapabilityHandler = (ctx: TeresaCapabilityContext) => TeresaCapabilityOutcome;

export interface TeresaCapabilityEntry {
  definition: TeresaCapabilityDefinition;
  /** Undefined for capabilities this slice does not draft yet — propose() rejects those explicitly. */
  handler?: TeresaCapabilityHandler;
}

/** Guard used by the kernel before ANY propose/commit — defends the data-level rule as a runtime check too. */
export function assertCapabilityNotForbidden(capabilityId: string): void {
  if ((TERESA_FORBIDDEN_EFFECTS as readonly string[]).includes(capabilityId)) {
    throw new Error(
      `teresaCapabilities: "${capabilityId}" is a forbidden effect (TERESA_FORBIDDEN_EFFECTS) — Teresa may never hold it.`
    );
  }
}

function verdict(failedChecks: TeresaQualityCheck[]): TeresaQualityVerdict {
  if (failedChecks.length === 0) return { verdict: 'valid', failedChecks: [] };
  // A capability whose grounding is entirely missing (no evidence AND an
  // unsupported claim) cannot be salvaged by human edits to wording alone —
  // invalid. A single soft gap is reviewable.
  const hard = failedChecks.filter(
    (c) => c === 'no_unsupported_claim' || c === 'no_invented_number'
  );
  if (hard.length > 0 && failedChecks.length >= 2) {
    return { verdict: 'invalid', failedChecks };
  }
  return { verdict: 'needs_human_review', failedChecks };
}

const acceptedItems = (session: TeresaSwotSessionSnapshot) =>
  session.items.filter((i) => i.proposalStatus === 'accepted' || i.proposalStatus === undefined);

const byQuadrant = (session: TeresaSwotSessionSnapshot, quadrant: SWOTItem['quadrant']) =>
  acceptedItems(session).filter((i) => i.quadrant === quadrant);

// ---------------------------------------------------------------------------
// 1. explain_question_plainly — "Teresa explains a question"
// ---------------------------------------------------------------------------
const explainQuestionPlainly: TeresaCapabilityHandler = ({ intent }) => {
  const failed: TeresaQualityCheck[] = [];
  if (!intent.unitId) failed.push('names_unit_and_level');
  const quadrant = intent.unitId ?? 'strengths';
  const text = intent.utterance?.trim();
  const explanation = text
    ? `To pytanie prosi o "${text}" w ćwiartce ${quadrant}: potrzebna jest KONKRETNA, weryfikowalna pozycja — nie ogólnik ani aspiracja.`
    : `To pytanie dotyczy ćwiartki ${quadrant}: wskaż konkretną, weryfikowalną pozycję (fakt lub obserwację), nie ogólnik.`;
  return {
    statements: [
      {
        kind: 'interpretation',
        text: explanation,
        sourceRefs: intent.unitId ? [`quadrant:${quadrant}`] : [],
      },
    ],
    proposedChanges: [],
    quality: verdict(failed),
  };
};

// ---------------------------------------------------------------------------
// 2. ask_next_best_question — "asks a deepening question"
// ---------------------------------------------------------------------------
const QUADRANTS: SWOTItem['quadrant'][] = ['strengths', 'weaknesses', 'opportunities', 'threats'];
const askNextBestQuestion: TeresaCapabilityHandler = ({ session }) => {
  const counts = QUADRANTS.map((q) => ({ q, n: byQuadrant(session, q).length }));
  counts.sort((a, b) => a.n - b.n);
  const weakest = counts[0];
  const question =
    weakest.n === 0
      ? `Ćwiartka ${weakest.q} nie ma jeszcze żadnej zaakceptowanej pozycji — co konkretnie tu widzisz?`
      : `Ćwiartka ${weakest.q} ma tylko ${weakest.n} pozycję/e — jest coś jeszcze, co powinno się tu znaleźć?`;
  return {
    statements: [{ kind: 'proposal', text: question, sourceRefs: [`quadrant:${weakest.q}`] }],
    proposedChanges: [],
    quality: verdict([]),
  };
};

// ---------------------------------------------------------------------------
// 3. summarize_response_without_invention — "proposes a note"
// ---------------------------------------------------------------------------
const summarizeResponseWithoutInvention: TeresaCapabilityHandler = ({ intent }) => {
  const text = intent.utterance?.trim();
  const failed: TeresaQualityCheck[] = [];
  if (!text) {
    failed.push('no_unsupported_claim', 'lists_supporting_evidence');
    return {
      statements: [
        {
          kind: 'missing_evidence',
          text: 'Brak wypowiedzi do podsumowania — nie ma z czego zbudować notatki.',
          sourceRefs: [],
        },
      ],
      proposedChanges: [],
      quality: verdict(failed),
    };
  }
  // "Without invention": the note text is the trimmed utterance itself, never
  // a paraphrase that could add a number or claim the utterance didn't make.
  return {
    statements: [
      { kind: 'respondent_declaration', text, sourceRefs: ['utterance'] },
      { kind: 'proposal', text: `Zapisać jako notatkę: "${text}"`, sourceRefs: ['utterance'] },
    ],
    proposedChanges: [
      {
        target: 'note',
        targetId: null,
        before: null,
        after: { text, source: 'teresa_draft' },
      },
    ],
    quality: verdict([]),
  };
};

// ---------------------------------------------------------------------------
// 4. draft_finding — "proposes an S/W/O/T classification"
// ---------------------------------------------------------------------------
const draftFinding: TeresaCapabilityHandler = ({ intent, session }) => {
  const quadrant = (intent.unitId as SWOTItem['quadrant'] | undefined) ?? undefined;
  const text = intent.utterance?.trim();
  const failed: TeresaQualityCheck[] = [];
  if (!quadrant) failed.push('names_unit_and_level');
  if (!text) failed.push('no_unsupported_claim', 'lists_supporting_evidence');
  if (failed.length > 0) {
    return {
      statements: [
        {
          kind: 'missing_evidence',
          text: 'Brak ćwiartki lub treści pozycji — nie mogę zaproponować klasyfikacji S/W/O/T.',
          sourceRefs: [],
        },
      ],
      proposedChanges: [],
      quality: verdict(failed),
    };
  }
  // Point at the exact fragment: an existing item with near-identical text in
  // the SAME quadrant is the fragment this proposal would edit; otherwise it
  // is a new item (targetId null, but quadrant still names where it lands).
  const existing = byQuadrant(session, quadrant!).find(
    (i) => i.text.trim().toLowerCase() === text!.toLowerCase()
  );
  return {
    statements: [
      {
        kind: 'proposal',
        text: `Klasyfikacja: "${text}" -> ${quadrant}.`,
        sourceRefs: existing ? [`item:${existing.id}`] : [],
      },
    ],
    proposedChanges: [
      {
        target: 'finding',
        targetId: existing?.id ?? null,
        before: existing ? { text: existing.text, quadrant: existing.quadrant } : null,
        after: { text, quadrant, impact: 'medium' },
      },
    ],
    quality: verdict([]),
  };
};

// ---------------------------------------------------------------------------
// 5. challenge_coverage_and_scale — "challenges missing evidence"
// ---------------------------------------------------------------------------
const challengeCoverageAndScale: TeresaCapabilityHandler = ({ session }) => {
  const unevidenced = acceptedItems(session).filter(
    (i) =>
      !i.evidenceStatus && !i.evidenceNote && !(i.linkedSignalIds && i.linkedSignalIds.length > 0)
  );
  if (unevidenced.length === 0) {
    return {
      statements: [
        {
          kind: 'confirmed_fact',
          text: 'Każda zaakceptowana pozycja ma powiązany dowód lub notatkę — brak luki pokrycia.',
          sourceRefs: acceptedItems(session).map((i) => `item:${i.id}`),
        },
      ],
      proposedChanges: [],
      quality: verdict([]),
    };
  }
  return {
    statements: unevidenced.map((i) => ({
      kind: 'missing_evidence' as const,
      text: `Pozycja "${i.text}" (${i.quadrant}) nie ma dowodu ani notatki — na czym się opiera?`,
      sourceRefs: [`item:${i.id}`],
    })),
    proposedChanges: unevidenced.map((i) => ({
      target: 'evidence_request' as const,
      targetId: i.id,
      before: null,
      after: { request: `Podaj dowód lub źródło dla: "${i.text}"` },
    })),
    quality: verdict(['lists_missing_evidence']),
  };
};

// ---------------------------------------------------------------------------
// 6. detect_contradiction — "flags a conflict"
// ---------------------------------------------------------------------------
const OPPOSITE: Record<SWOTItem['quadrant'], SWOTItem['quadrant']> = {
  strengths: 'weaknesses',
  weaknesses: 'strengths',
  opportunities: 'threats',
  threats: 'opportunities',
};
const detectContradiction: TeresaCapabilityHandler = ({ session }) => {
  const items = acceptedItems(session);
  const conflicts: Array<[SWOTItem, SWOTItem]> = [];
  for (const a of items) {
    const oppositeQuadrant = OPPOSITE[a.quadrant];
    for (const b of items) {
      if (b.quadrant !== oppositeQuadrant) continue;
      const sharedSignal =
        a.linkedSignalIds && b.linkedSignalIds
          ? a.linkedSignalIds.some((s) => b.linkedSignalIds!.includes(s))
          : false;
      const sameWords = a.text.trim().toLowerCase() === b.text.trim().toLowerCase();
      if (sharedSignal || sameWords) conflicts.push([a, b]);
    }
  }
  if (conflicts.length === 0) {
    return {
      statements: [
        {
          kind: 'confirmed_fact',
          text: 'Brak wykrytego konfliktu między pozycjami przeciwstawnych ćwiartek.',
          sourceRefs: [],
        },
      ],
      proposedChanges: [],
      quality: verdict([]),
    };
  }
  const [a, b] = conflicts[0];
  return {
    statements: [
      {
        kind: 'interpretation',
        text: `Konflikt: "${a.text}" (${a.quadrant}) i "${b.text}" (${b.quadrant}) opierają się na tym samym sygnale/treści — który opis jest aktualny?`,
        sourceRefs: [`item:${a.id}`, `item:${b.id}`],
      },
    ],
    proposedChanges: [
      {
        target: 'finding',
        targetId: a.id,
        before: { text: a.text, quadrant: a.quadrant },
        after: { conflictWith: b.id, needsHumanReview: true },
      },
    ],
    quality: verdict(['states_next_decision']),
  };
};

// ---------------------------------------------------------------------------
// Registry — full closed-set definitions; handlers only for the 6 above.
// ---------------------------------------------------------------------------
function def(
  id: TeresaCapabilityId,
  producesProposal: boolean,
  requiredQualityChecks: TeresaQualityCheck[]
): TeresaCapabilityDefinition {
  return {
    id,
    inputSchemaRef: `teresa/${id}.input`,
    outputSchemaRef: `teresa/${id}.output`,
    allowedSources: ['method_pack', 'session_answers', 'evidence'],
    allowedRoles: ['lead_assessor', 'assessor', 'reviewer'],
    producesProposal,
    requiredQualityChecks,
  };
}

export const TERESA_CAPABILITY_REGISTRY: Record<TeresaCapabilityId, TeresaCapabilityEntry> = {
  explain_method_unit: {
    definition: def('explain_method_unit', false, ['consistent_with_method_pack']),
  },
  diagnose_candidate_level: {
    definition: def('diagnose_candidate_level', true, [
      'names_unit_and_level',
      'lists_supporting_evidence',
    ]),
  },
  ask_next_best_question: {
    definition: def('ask_next_best_question', false, []),
    handler: askNextBestQuestion,
  },
  request_specific_evidence: {
    definition: def('request_specific_evidence', true, ['lists_missing_evidence']),
  },
  summarize_response_without_invention: {
    definition: def('summarize_response_without_invention', true, [
      'lists_supporting_evidence',
      'no_unsupported_claim',
      'no_invented_number',
    ]),
    handler: summarizeResponseWithoutInvention,
  },
  map_response_to_attributes: {
    definition: def('map_response_to_attributes', true, ['names_attributes']),
  },
  detect_contradiction: {
    definition: def('detect_contradiction', true, [
      'lists_supporting_evidence',
      'states_next_decision',
    ]),
    handler: detectContradiction,
  },
  challenge_coverage_and_scale: {
    definition: def('challenge_coverage_and_scale', true, [
      'lists_missing_evidence',
      'states_next_decision',
    ]),
    handler: challengeCoverageAndScale,
  },
  draft_score_proposal: {
    definition: def('draft_score_proposal', true, ['names_unit_and_level', 'no_invented_number']),
  },
  prepare_calibration_brief: {
    definition: def('prepare_calibration_brief', true, ['states_limitations']),
  },
  suggest_target_and_pathway: {
    definition: def('suggest_target_and_pathway', true, ['states_next_decision']),
  },
  draft_finding: {
    definition: def('draft_finding', true, [
      'names_unit_and_level',
      'lists_supporting_evidence',
      'lists_missing_evidence',
      'states_next_decision',
    ]),
    handler: draftFinding,
  },
  cluster_findings: { definition: def('cluster_findings', true, ['names_attributes']) },
  draft_initiative_proposals: {
    definition: def('draft_initiative_proposals', true, ['states_next_decision']),
  },
  prepare_output_outline: {
    definition: def('prepare_output_outline', true, ['states_limitations']),
  },
  explain_question_plainly: {
    definition: def('explain_question_plainly', false, [
      'names_unit_and_level',
      'consistent_with_method_pack',
    ]),
    handler: explainQuestionPlainly,
  },
  explain_why_question_matters: {
    definition: def('explain_why_question_matters', false, ['consistent_with_method_pack']),
  },
  compare_adjacent_levels: {
    definition: def('compare_adjacent_levels', false, ['names_unit_and_level']),
  },
  show_answer_examples: {
    definition: def('show_answer_examples', false, ['consistent_with_method_pack']),
  },
  identify_likely_respondent_role: {
    definition: def('identify_likely_respondent_role', false, []),
  },
  suggest_evidence_to_request: {
    definition: def('suggest_evidence_to_request', true, ['lists_missing_evidence']),
  },
  rephrase_question_without_changing_intent: {
    definition: def('rephrase_question_without_changing_intent', false, [
      'consistent_with_method_pack',
    ]),
  },
  resolve_i_dont_know: { definition: def('resolve_i_dont_know', true, ['states_next_decision']) },
};

/** Data-level closed-set guarantee, also asserted by a unit test. */
export const CAPABILITIES_ARE_NEVER_FORBIDDEN: boolean = TERESA_CAPABILITIES.every(
  (c) => !(TERESA_FORBIDDEN_EFFECTS as readonly string[]).includes(c)
);

export type { TeresaForbiddenEffect };
