/**
 * Teresa capability registry — client-side wiring (A5/S4, 2026-08-13).
 *
 * `src/method-core/contracts/teresa.ts` declares `TERESA_CAPABILITIES` (the
 * closed set of 23 ids) and the shape of `TeresaCapabilityDefinition`, but no
 * concrete registry existed anywhere in the client before this file — every
 * capability button/tool call had nothing to read a label, a description or
 * an input schema from. This is that registry, ONE entry per capability, no
 * more no less than the closed set (enforced by `capabilities.test.ts`).
 *
 * SSOT for the human-facing text and role/quality assignments below:
 * `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/TERESA_ASSESSMENT_FACILITATION_PLAYBOOK.md`
 * §2 (the interview loop), §3 (capability catalogue), §5 (boundaries), §6
 * (quality gate). Where the playbook is silent on a specific role/quality
 * assignment, the choice here follows the loop's own logic (documented per
 * group below) rather than inventing a new source of truth.
 *
 * This registry is domain-agnostic on purpose (DRD/SIRI both read it) — no
 * axis/level-scale name appears here, only capability metadata.
 */
import type {
  MethodProcessRole,
  TeresaCapabilityDefinition,
  TeresaCapabilityId,
  TeresaQualityCheck,
} from '@/method-core/contracts';
import { METHOD_PROCESS_ROLES, TERESA_CAPABILITIES } from '@/method-core/contracts';

/** Minimal JSON Schema shape — same idea as `ideaActionRegistry.ts`'s `JSONSchema`,
 * duplicated here rather than imported to keep this module free of a
 * dependency on the (unrelated) Idea Workspace action registry. */
export interface TeresaCapabilityParamSchema {
  type: 'object';
  properties: Record<string, { type: string; description: string }>;
  required?: string[];
}

/** Roles who actively run the interview (ask, probe, propose). Playbook §2
 * ("Teresa działa jak … facylitator") — the loop is driven by whoever holds
 * one of these three roles; `respondent`/`evidence_owner`/`observer` receive
 * the conversation but do not drive Teresa's next move. */
const FACILITATOR_ROLES: readonly MethodProcessRole[] = ['owner', 'lead_assessor', 'assessor'];

/** Facilitators plus whoever reviews/synthesises after the interview (findings,
 * calibration, output outline, initiative drafts — playbook §2 steps 8-10). */
const SYNTHESIS_ROLES: readonly MethodProcessRole[] = ['owner', 'lead_assessor', 'assessor', 'reviewer'];

/** Pure explanation capabilities are safe for every role holding ANY seat in
 * the session — a respondent asking "why does this question matter" is the
 * playbook's own example use case (§2 step 1), not a privileged action. */
const ANY_ROLE: readonly MethodProcessRole[] = METHOD_PROCESS_ROLES;

export interface TeresaCapabilityUiDefinition extends TeresaCapabilityDefinition {
  /** Polish label for buttons/menus — short, imperative-free (a noun phrase). */
  readonly labelPl: string;
  /** Polish description for the Teresa tool manifest / hover help. */
  readonly description: string;
  /** Which `TeresaIntent` fields this capability needs filled in to run. */
  readonly requiredContext: readonly ('unitId' | 'level' | 'questionId')[];
  readonly parameters: TeresaCapabilityParamSchema;
}

function schemaRef(id: TeresaCapabilityId, side: 'input' | 'output'): string {
  // Self-referencing on purpose: no standalone JSON Schema file exists for
  // these capabilities yet (contract only fixes the shape of TeresaIntent /
  // TeresaPreview, not per-capability field requirements) — the ref points at
  // the one place that IS authoritative today, this registry entry itself,
  // rather than a schema file that would be fiction.
  return `src/method-core/teresa/capabilities.ts#${id}.${side}`;
}

function paramsFor(requiredContext: readonly ('unitId' | 'level' | 'questionId')[]): TeresaCapabilityParamSchema {
  const properties: TeresaCapabilityParamSchema['properties'] = {};
  if (requiredContext.includes('unitId')) {
    properties.unitId = { type: 'string', description: 'Jednostka metody (obszar/oś), której dotyczy pytanie.' };
  }
  if (requiredContext.includes('level')) {
    properties.level = { type: 'number', description: 'Poziom dojrzałości, którego dotyczy działanie.' };
  }
  if (requiredContext.includes('questionId')) {
    properties.questionId = { type: 'string', description: 'Konkretne pytanie z Method Pack.' };
  }
  return { type: 'object', properties, required: [...requiredContext] };
}

interface CapabilitySeed {
  readonly id: TeresaCapabilityId;
  readonly labelPl: string;
  readonly description: string;
  readonly allowedSources: readonly ('method_pack' | 'session_answers' | 'evidence' | 'vault')[];
  readonly allowedRoles: readonly MethodProcessRole[];
  readonly producesProposal: boolean;
  readonly requiredQualityChecks: readonly TeresaQualityCheck[];
  readonly requiredContext: readonly ('unitId' | 'level' | 'questionId')[];
}

// Order matches the two groups in the contract file and the playbook §3:
// facilitation loop (15) then question help (8) — 23 total.
const SEEDS: readonly CapabilitySeed[] = [
  {
    id: 'explain_method_unit',
    labelPl: 'Wyjaśnij kryterium',
    description:
      'Wyjaśnia, czym jest ta jednostka metody i dlaczego ma znaczenie — na podstawie Method Pack, bez propozycji zmian.',
    allowedSources: ['method_pack'],
    allowedRoles: ANY_ROLE,
    producesProposal: false,
    requiredQualityChecks: ['names_unit_and_level', 'no_unsupported_claim', 'consistent_with_method_pack'],
    requiredContext: ['unitId'],
  },
  {
    id: 'diagnose_candidate_level',
    labelPl: 'Zdiagnozuj prawdopodobny poziom',
    description:
      'Prywatna diagnoza Teresy — prawdopodobny poziom na podstawie tego, co już wiadomo, BEZ ujawniania „pożądanej” odpowiedzi respondentowi (playbook §2 krok 3).',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: false,
    requiredQualityChecks: ['names_unit_and_level', 'no_unsupported_claim', 'consistent_with_method_pack'],
    requiredContext: ['unitId'],
  },
  {
    id: 'ask_next_best_question',
    labelPl: 'Zadaj pytanie pogłębiające',
    description: 'Proponuje kolejne najlepsze pytanie różnicujące dla tej jednostki.',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: false,
    requiredQualityChecks: ['names_unit_and_level', 'consistent_with_method_pack'],
    requiredContext: ['unitId'],
  },
  {
    id: 'request_specific_evidence',
    labelPl: 'Poproś o konkretny dowód',
    description: 'Formułuje konkretną prośbę o dowód — do akceptacji, zanim trafi do respondenta.',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: true,
    requiredQualityChecks: ['names_unit_and_level', 'lists_missing_evidence', 'states_next_decision'],
    requiredContext: ['unitId'],
  },
  {
    id: 'summarize_response_without_invention',
    labelPl: 'Zaproponuj notatkę',
    description:
      'Streszcza odpowiedź respondenta bez dodawania niczego, czego respondent nie powiedział — zero wymyślonych liczb czy faktów.',
    allowedSources: ['session_answers'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: true,
    requiredQualityChecks: ['no_unsupported_claim', 'no_invented_number', 'lists_supporting_evidence'],
    requiredContext: ['unitId'],
  },
  {
    id: 'map_response_to_attributes',
    labelPl: 'Zaproponuj klasyfikację dowodu',
    description: 'Mapuje treść odpowiedzi na atrybuty jednostki metody — do przeglądu, nie automatyczny zapis.',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: true,
    requiredQualityChecks: ['names_unit_and_level', 'names_attributes', 'no_unsupported_claim'],
    requiredContext: ['unitId'],
  },
  {
    id: 'detect_contradiction',
    labelPl: 'Wskaż niespójność',
    description: 'Wskazuje sprzeczność między odpowiedziami/dowodami — nigdy nie scala ich sama (playbook §5).',
    allowedSources: ['session_answers'],
    allowedRoles: [...FACILITATOR_ROLES, 'reviewer'],
    producesProposal: true,
    requiredQualityChecks: ['no_unsupported_claim', 'states_next_decision'],
    requiredContext: ['unitId'],
  },
  {
    id: 'challenge_coverage_and_scale',
    labelPl: 'Sprawdź pokrycie i skalę',
    description: 'Pyta, czy odpowiedź obejmuje cały zakres/skalę stosowania wymaganą na tym poziomie.',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: false,
    requiredQualityChecks: ['names_unit_and_level', 'states_limitations'],
    requiredContext: ['unitId', 'level'],
  },
  {
    id: 'draft_score_proposal',
    labelPl: 'Zaproponuj poziom',
    description:
      'Szkicuje propozycję poziomu wraz z rationale — NIGDY zatwierdzenie. Musi nazwać unit/level, atrybuty, dowody za i przeciw, ograniczenia i następną decyzję (playbook §6), inaczej preview jest invalid/needs_human_review.',
    allowedSources: ['method_pack', 'session_answers', 'evidence'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: true,
    requiredQualityChecks: [
      'names_unit_and_level',
      'names_attributes',
      'lists_supporting_evidence',
      'lists_missing_evidence',
      'states_limitations',
      'states_next_decision',
      'no_unsupported_claim',
      'no_invented_number',
      'consistent_with_method_pack',
    ],
    requiredContext: ['unitId', 'level'],
  },
  {
    id: 'prepare_calibration_brief',
    labelPl: 'Przygotuj brief kalibracyjny',
    description: 'Zestawia materiał do kalibracji między ocenami — evidence za/przeciw i ograniczenia.',
    allowedSources: ['method_pack', 'session_answers', 'evidence'],
    allowedRoles: SYNTHESIS_ROLES,
    producesProposal: true,
    requiredQualityChecks: ['names_unit_and_level', 'lists_supporting_evidence', 'lists_missing_evidence', 'states_limitations'],
    requiredContext: ['unitId'],
  },
  {
    id: 'suggest_target_and_pathway',
    labelPl: 'Zaproponuj cel i ścieżkę',
    description:
      'Proponuje docelowy poziom i ścieżkę dojścia — propozycja typu „note”, nie zatwierdzenie targetu (approve_target jest zabronione Teresie).',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: true,
    requiredQualityChecks: ['names_unit_and_level', 'states_next_decision', 'no_unsupported_claim'],
    requiredContext: ['unitId'],
  },
  {
    id: 'draft_finding',
    labelPl: 'Zaproponuj finding',
    description: 'Szkicuje finding (obserwację) z jednostki — do przeglądu w Output.',
    allowedSources: ['method_pack', 'session_answers', 'evidence'],
    allowedRoles: SYNTHESIS_ROLES,
    producesProposal: true,
    requiredQualityChecks: ['names_unit_and_level', 'lists_supporting_evidence', 'states_limitations', 'no_unsupported_claim', 'no_invented_number'],
    requiredContext: ['unitId'],
  },
  {
    id: 'cluster_findings',
    labelPl: 'Grupuj findingi',
    description: 'Grupuje istniejące findingi w tematy — do przeglądu, nie automatyczny zapis.',
    allowedSources: ['session_answers'],
    allowedRoles: ['owner', 'lead_assessor', 'reviewer'],
    producesProposal: true,
    requiredQualityChecks: ['no_unsupported_claim', 'states_next_decision'],
    requiredContext: [],
  },
  {
    id: 'draft_initiative_proposals',
    labelPl: 'Zaproponuj szkic inicjatywy',
    description:
      'Szkicuje DRAFT inicjatywy z findingów — nigdy Registered/Approved Initiative (register_initiative jest zabronione Teresie; rejestracja to osobny, ludzki krok w module Initiatives).',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: ['owner', 'lead_assessor', 'reviewer'],
    producesProposal: true,
    requiredQualityChecks: ['states_next_decision', 'no_unsupported_claim', 'no_invented_number'],
    requiredContext: [],
  },
  {
    id: 'prepare_output_outline',
    labelPl: 'Przygotuj zarys Output',
    description: 'Przygotowuje zarys struktury Output przed zamrożeniem sesji — do przeglądu.',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: ['owner', 'lead_assessor', 'reviewer'],
    producesProposal: true,
    requiredQualityChecks: ['states_limitations', 'states_next_decision'],
    requiredContext: [],
  },
  // ── question help ────────────────────────────────────────────────────
  {
    id: 'explain_question_plainly',
    labelPl: 'Wyjaśnij pytanie prostym językiem',
    description: 'Tłumaczy pytanie prostym językiem, bez żargonu metody.',
    allowedSources: ['method_pack'],
    allowedRoles: ANY_ROLE,
    producesProposal: false,
    requiredQualityChecks: ['no_unsupported_claim', 'consistent_with_method_pack'],
    requiredContext: ['questionId'],
  },
  {
    id: 'explain_why_question_matters',
    labelPl: 'Wyjaśnij, dlaczego to pytanie ma znaczenie',
    description: 'Tłumaczy biznesowy sens pytania — dlaczego w ogóle je zadajemy.',
    allowedSources: ['method_pack'],
    allowedRoles: ANY_ROLE,
    producesProposal: false,
    requiredQualityChecks: ['no_unsupported_claim', 'consistent_with_method_pack'],
    requiredContext: ['questionId'],
  },
  {
    id: 'compare_adjacent_levels',
    labelPl: 'Porównaj sąsiednie poziomy',
    description: 'Pokazuje różnicę między tym a sąsiednimi poziomami — czym różni się odpowiedź „tak” na każdym z nich.',
    allowedSources: ['method_pack'],
    allowedRoles: ANY_ROLE,
    producesProposal: false,
    requiredQualityChecks: ['names_unit_and_level', 'consistent_with_method_pack'],
    requiredContext: ['questionId', 'level'],
  },
  {
    id: 'show_answer_examples',
    labelPl: 'Pokaż przykłady odpowiedzi',
    description: 'Pokazuje przykładowe odpowiedzi z Method Pack (pozytywną/częściową/negatywną) dla tego pytania.',
    allowedSources: ['method_pack'],
    allowedRoles: ANY_ROLE,
    producesProposal: false,
    requiredQualityChecks: ['consistent_with_method_pack', 'no_invented_number'],
    requiredContext: ['questionId'],
  },
  {
    id: 'identify_likely_respondent_role',
    labelPl: 'Wskaż prawdopodobną rolę respondenta',
    description: 'Sugeruje, kto w organizacji najprawdopodobniej zna odpowiedź na to pytanie.',
    allowedSources: ['method_pack'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: false,
    requiredQualityChecks: ['consistent_with_method_pack'],
    requiredContext: ['questionId'],
  },
  {
    id: 'suggest_evidence_to_request',
    labelPl: 'Zaproponuj dowód do poproszenia',
    description: 'Sugeruje konkretny typ dowodu wartego poproszenia dla tego pytania.',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: true,
    requiredQualityChecks: ['lists_missing_evidence', 'states_next_decision'],
    requiredContext: ['questionId'],
  },
  {
    id: 'rephrase_question_without_changing_intent',
    labelPl: 'Przeformułuj pytanie',
    description: 'Przeformułowuje pytanie innymi słowami — bez zmiany tego, o co pytanie faktycznie pyta.',
    allowedSources: ['method_pack'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: false,
    requiredQualityChecks: ['consistent_with_method_pack', 'no_unsupported_claim'],
    requiredContext: ['questionId'],
  },
  {
    id: 'resolve_i_dont_know',
    labelPl: 'Pomóż przy „nie wiem”',
    description:
      'Gdy respondent nie zna odpowiedzi, Teresa NIE naciska na wybór poziomu — pomaga ustalić, czego brakuje, i proponuje follow-up do akceptacji (playbook §5). Nie wybiera osoby ani nie wysyła prośby bez decyzji użytkownika.',
    allowedSources: ['method_pack', 'session_answers'],
    allowedRoles: FACILITATOR_ROLES,
    producesProposal: true,
    requiredQualityChecks: ['states_next_decision', 'no_unsupported_claim'],
    requiredContext: ['questionId'],
  },
];

function buildRegistry(): Readonly<Record<TeresaCapabilityId, TeresaCapabilityUiDefinition>> {
  const out = {} as Record<TeresaCapabilityId, TeresaCapabilityUiDefinition>;
  for (const seed of SEEDS) {
    out[seed.id] = {
      id: seed.id,
      inputSchemaRef: schemaRef(seed.id, 'input'),
      outputSchemaRef: schemaRef(seed.id, 'output'),
      allowedSources: seed.allowedSources,
      allowedRoles: seed.allowedRoles,
      producesProposal: seed.producesProposal,
      requiredQualityChecks: seed.requiredQualityChecks,
      labelPl: seed.labelPl,
      description: seed.description,
      requiredContext: seed.requiredContext,
      parameters: paramsFor(seed.requiredContext),
    };
  }
  return Object.freeze(out);
}

/** ONE entry per `TeresaCapabilityId` — closed set, verified 1:1 against
 * `TERESA_CAPABILITIES` by `capabilities.test.ts` (no more, no fewer). */
export const TERESA_CAPABILITY_REGISTRY: Readonly<Record<TeresaCapabilityId, TeresaCapabilityUiDefinition>> =
  buildRegistry();

export function getTeresaCapability(id: TeresaCapabilityId): TeresaCapabilityUiDefinition {
  return TERESA_CAPABILITY_REGISTRY[id];
}

export function listTeresaCapabilities(): readonly TeresaCapabilityUiDefinition[] {
  return TERESA_CAPABILITIES.map((id) => TERESA_CAPABILITY_REGISTRY[id]);
}

/** Defensive runtime check mirroring the type-level guarantee — a capability
 * id can never collide with a forbidden effect name because they are
 * disjoint closed sets in the contract, but this makes the invariant
 * checkable without reading two files side by side. */
export function isKnownTeresaCapability(id: string): id is TeresaCapabilityId {
  return Object.prototype.hasOwnProperty.call(TERESA_CAPABILITY_REGISTRY, id);
}
