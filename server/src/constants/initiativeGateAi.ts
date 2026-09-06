/**
 * Initiative Gate AI — canonical constants (M13 Depth · Fala 1 / sub-moduł G1).
 *
 * SSOT spec: docs/product/INITIATIVE_GATE_AI_SPEC.md
 *
 * This module is PURE DATA (no DB, no LLM). It declares, for each forward
 * progress gate, which initiative sections the AI substantive-readiness rollup
 * must evaluate, which gates additionally run the timeline analyzer, and the
 * default readiness threshold. Section keys MUST match the registry
 * (`src/components/Initiatives/sections/registry.ts` / migration 529 section
 * types). The regressive/lateral gates (SEND_BACK, REJECT, BLOCK, UNBLOCK,
 * CANCEL, ARCHIVE) plus the creation gate (CREATE_DRAFT) are intentionally
 * outside AI_GATES — AI readiness only gates forward progress on an existing
 * card. Mapa `GATE_REQUIRED_SECTIONS` musi jednak pokrywać KAŻDĄ bramkę ze
 * słownika `GateType` (DEC-424 dołożył CREATE_DRAFT i ARCHIVE).
 */
import { GateType, type GateTypeValue } from './initiativeStatuses.js';

/** Default substantive-readiness pass threshold (0–100). Per-org overridable. */
export const DEFAULT_GATE_AI_THRESHOLD = 75;

/**
 * The 9 forward-progress gates that get an AI readiness check.
 * Order mirrors the happy path (DRAFT → … → CLOSED).
 */
export const AI_GATES: GateTypeValue[] = [
  GateType.SUBMIT_FOR_REVIEW,
  GateType.APPROVE_TO_INITIATIVE,
  GateType.ACCEPT,
  GateType.START_PLANNING,
  GateType.APPROVE,
  GateType.SCHEDULE,
  GateType.START,
  GateType.COMPLETE,
  GateType.START_TRACKING,
];

/**
 * Gates that additionally run the timeline analyzer (dependencies / date /
 * resource conflicts). Planning gates only — see GATE_AI_SPEC §4.
 */
export const GATE_AI_TIMELINE_GATES: ReadonlySet<GateTypeValue> = new Set([
  GateType.SCHEDULE,
  GateType.START,
]);

/**
 * Per-gate required sections for the substantive rollup (GATE_AI_SPEC §3).
 * Starting proposal — domain-tunable (pytanie Q1). Keys are registry section
 * keys. Empty/absent → no substantive sections required for that gate.
 */
export const GATE_REQUIRED_SECTIONS: Record<GateTypeValue, string[]> = {
  // ── Forward progress gates (AI-evaluated) ──────────────────────────────
  [GateType.SUBMIT_FOR_REVIEW]: ['overview', 'problemDefinition'],
  [GateType.APPROVE_TO_INITIATIVE]: ['overview', 'problemDefinition', 'targetState', 'scope'],
  [GateType.ACCEPT]: ['overview', 'problemDefinition', 'scope', 'financialImpact', 'raid'],
  [GateType.START_PLANNING]: ['overview', 'problemDefinition', 'scope', 'tasks', 'team'],
  [GateType.APPROVE]: [
    'overview',
    'problemDefinition',
    'scope',
    'financialImpact',
    'raid',
    'kpis',
    'gates',
  ],
  [GateType.SCHEDULE]: ['tasks', 'timeline', 'resources', 'dependencies', 'team'],
  [GateType.START]: ['timeline', 'resources', 'team', 'dependencies'],
  [GateType.COMPLETE]: ['tasks', 'kpis'],
  [GateType.START_TRACKING]: ['kpis', 'control'],

  // ── Bramka tworzenia: karta jeszcze nie istnieje ───────────────────────
  // PROPOSED → DRAFT niesie tylko tytuł i uzasadnienie (warunek
  // TITLE_AND_JUSTIFICATION), więc nie ma sekcji do oceny merytorycznej.
  [GateType.CREATE_DRAFT]: [],

  // ── Regressive / lateral gates: no AI readiness ────────────────────────
  [GateType.SEND_BACK]: [],
  [GateType.REJECT]: [],
  [GateType.BLOCK]: [],
  [GateType.UNBLOCK]: [],
  [GateType.CANCEL]: [],
  // ARCHIVE to operacja na fladze `archived`, nie postęp cyklu życia.
  [GateType.ARCHIVE]: [],
};

/** True when a gate participates in the AI readiness flow. */
export function isAiGate(gate: GateTypeValue): boolean {
  return AI_GATES.includes(gate);
}

/** True when a gate additionally runs the timeline analyzer. */
export function gateHasTimelineCheck(gate: GateTypeValue): boolean {
  return GATE_AI_TIMELINE_GATES.has(gate);
}
