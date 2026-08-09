/**
 * P08 Teresa Copilot Canon
 *
 * Frozen contract from FINAL_IMPLEMENTATION_PLAN_08_TERESA §2.3.
 *
 * Teresa is a contextual copilot — she proposes, the user approves,
 * the target module executes. No silent writes, no autonomous engine.
 *
 * Sections:
 *   §2.3.1 — P0 handoff targets + required context payload
 *   §2.3.2 — Action governance envelope
 *   §2.3.3 — Voice posture
 *   §2.3.4 — Evidence / citations posture
 *   §2.3.5 — Hard boundaries (Teresa vs Anna) + module-owned writes
 *   §2.3.6 — Anti-duplicate gate
 *   §2.3.7 — Degraded / error posture (10 scenarios)
 *   §2.3.8 — Acceptance checklist (12 items)
 */

// ────────────────────────────────────────────────────────────────
// §2.3.1 — Handoff targets + required context payload
// ────────────────────────────────────────────────────────────────

export const P08_COPILOT_CONTRACT = 'teresa_copilot_v1';

export type HandoffTargetModule =
  | 'radar'
  | 'initiatives'
  | 'calendar'
  | 'notebook'
  | 'interview'
  | 'excele'
  | 'ideas'
  | 'results'
  | 'kpi'
  | 'roi'
  | 'execution'
  | 'finance'
  | 'meeting'
  | 'outputs'
  | 'documents'
  | 'tables'
  | 'presentations';

export interface TeresaHandoffContext {
  origin: 'teresa';
  user_intent: string;
  active_surface: string;
  org_context_ref: string;
  operation_contract_ref?: string | null;
  runtime_binding?: {
    conversation_id?: string | null;
    session_id?: string | null;
    context_snapshot_id?: string | null;
    execution_run_id?: string | null;
    artifact_run_id?: string | null;
    tool_invocation_id?: string | null;
  };
  bounded_context_pack: Array<{
    ref: string;
    type: string;
    deeplink?: string | null;
  }>;
  constraints: string[];
  assumptions: string[];
  uncertainty_boundary: {
    missing_inputs: string[];
    conflicts: string[];
    what_would_change_next_action: string[];
  };
  evidence_pointers: string[];
  proposed_next_action: {
    target_module: HandoffTargetModule;
    handoff_intent: 'open' | 'create' | 'append';
    requires_approval: true;
  };
  audit_stub: {
    actor: string;
    timestamp: string;
    proposal_id?: string | null;
  };
}

export interface RadarHandoffPayload {
  why_now: string;
  time_window: string;
  triggered_rules: string[];
  evidence_pointers: string[];
  uncertainty_boundary: TeresaHandoffContext['uncertainty_boundary'];
  next_action_safe_fallback: string;
}

export interface InitiativesHandoffPayload {
  initiative_seed: {
    problem_statement: string;
    proposed_outcome: string;
    assumptions: string[];
    risks: string[];
    next_steps: string[];
    time_window?: string | null;
  };
  proposal_only: true;
}

export interface CalendarHandoffPayload {
  calendar_intent: {
    what: string;
    when: string;
    timezone: string;
  };
  permission_gradient_expectation: 'free_busy' | 'read' | 'write';
  conflict_safe_write_posture: 'if_match_etag' | 'deny';
  recovery_steps: string[];
}

export interface NotebookHandoffPayload {
  notebook_handoff_context: {
    title: string;
    body_preview: string;
    source: 'teresa' | 'user_edit' | 'ai_transform';
    /** #21: opcjonalny termin przypomnienia z „przypomnij mi …". */
    reminder?: { dueAt: string | null; term: string | null };
  };
  provenance_markers: {
    source: string;
    user_edit: boolean;
    ai_transform: boolean;
  };
  evidence_pointers: string[];
}

export interface InterviewHandoffPayload {
  interview_handoff_context: {
    action: 'generate_insight' | 'submit_review' | 'export_initiative' | 'view_evidence';
    session_ids?: string[];
    insight_id?: string;
    title?: string;
  };
  evidence_pointers: string[];
}

export const P08_HANDOFF_TARGETS = {
  radar: {
    module: 'Radar' as const,
    contract_ref: 'P06',
    description: 'Triage cockpit / why-now → next action',
    required_common_payload: true,
    required_extra_fields: [
      'why_now',
      'time_window',
      'triggered_rules',
      'evidence_pointers',
      'uncertainty_boundary',
      'next_action_safe_fallback',
    ] as const,
  },
  initiatives: {
    module: 'Inicjatywy' as const,
    contract_ref: 'P11',
    description: 'Living object (triage→plan→execute) with write-truth governance',
    required_common_payload: true,
    required_extra_fields: ['initiative_seed', 'proposal_only'] as const,
  },
  calendar: {
    module: 'Kalendarz' as const,
    contract_ref: 'P02',
    description: 'Time surface + interoperability; no fake writes',
    required_common_payload: true,
    required_extra_fields: [
      'calendar_intent',
      'permission_gradient_expectation',
      'conflict_safe_write_posture',
      'recovery_steps',
    ] as const,
  },
  notebook: {
    module: 'Notatki' as const,
    contract_ref: 'P07',
    description: 'Durable working memory + provenance; capture-first fallback lane',
    required_common_payload: true,
    required_extra_fields: [
      'notebook_handoff_context',
      'provenance_markers',
      'evidence_pointers',
    ] as const,
  },
  interview: {
    module: 'Wywiady' as const,
    contract_ref: 'P10',
    description: 'Interview insights — generate, review, export, evidence map',
    required_common_payload: true,
    required_extra_fields: ['interview_handoff_context', 'evidence_pointers'] as const,
  },
  excele: {
    module: 'Excele' as const,
    contract_ref: 'P12',
    description: 'Workbook generation and spreadsheet workflows',
    required_common_payload: true,
    required_extra_fields: ['prompt'] as const,
  },
  ideas: {
    module: 'Ideas' as const,
    contract_ref: 'P09',
    description: 'Visual workspace tools: Mind Map, Process Flow, Table, Whiteboard',
    required_common_payload: true,
    required_extra_fields: ['ideas_context', 'canvas_type'] as const,
  },
  documents: {
    module: 'Dokumenty' as const,
    contract_ref: 'ARTIFACT_STUDIO_DOC',
    description: 'Governed edits of an opened Document Studio artifact',
    required_common_payload: true,
    required_extra_fields: ['artifact_id', 'instruction', 'document_context'] as const,
  },
} as const;

export const P08_HANDOFF_TARGET_MODULES: HandoffTargetModule[] = [
  'radar',
  'initiatives',
  'calendar',
  'notebook',
  'interview',
  'excele',
  'ideas',
  'documents',
];

export const P08_COMMON_PAYLOAD_FIELDS = [
  'origin',
  'user_intent',
  'active_surface',
  'org_context_ref',
  'bounded_context_pack',
  'constraints',
  'assumptions',
  'uncertainty_boundary',
  'evidence_pointers',
  'proposed_next_action',
  'audit_stub',
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.2 — Action governance envelope
// ────────────────────────────────────────────────────────────────

export const P08_ACTION_ENVELOPE_STATES = [
  'proposal',
  'pending_approval',
  'approved',
  'executing',
  'completed',
  'undone',
  'rejected',
] as const;

export type ActionEnvelopeState = (typeof P08_ACTION_ENVELOPE_STATES)[number];

export const P08_ACTION_ENVELOPE_TRANSITIONS: Record<ActionEnvelopeState, ActionEnvelopeState[]> = {
  proposal: ['pending_approval', 'rejected'],
  pending_approval: ['approved', 'rejected'],
  approved: ['executing'],
  executing: ['completed', 'rejected'],
  completed: ['undone'],
  undone: [],
  rejected: [],
};

export const P08_ACTION_ENVELOPE_RULES = {
  approve_not_review:
    'approve(run) ≠ review(artifact): user must explicitly approve execution, not just review the proposal',
  no_silent_writes: 'No auto-apply, no background save. Every mutation requires explicit approval.',
  no_parallel_approvals:
    'Only one active approval request per user/session. New proposals must cancel/version previous.',
  idempotency_posture: 'Retry must not create duplicates, especially for create operations.',
  truth_preserving_failure:
    'If audit/traces cannot be written, the action is blocked or marked degraded(audit_unavailable) — never claim success.',
  audit_required: 'Every action has a trace: who/when/what input/what outcome. No ghost actions.',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.3 — Voice posture
// ────────────────────────────────────────────────────────────────

export type VoiceAvailability = 'available' | 'degraded' | 'unavailable';

export const P08_VOICE_POSTURE = {
  availability: {
    states: ['available', 'degraded', 'unavailable'] as VoiceAvailability[],
    rule: 'Teresa always communicates voice status and reason (permissions/device/network)',
  },
  fallback_to_text: {
    rule: 'When voice is degraded/unavailable, all critical actions fall back to text (readable proposal + Approve button)',
    trigger_conditions: [
      'voice_degraded',
      'voice_unavailable',
      'mic_permission_denied',
      'network_unstable',
    ],
  },
  recovery_grammar: [
    'Przechodzę na tekst, bo voice jest niestabilny. Oto proposal.',
    'Powtórz proszę ostatnią instrukcję',
    'Nie mogę wykonać tej akcji bez zatwierdzenia. Powiedz: "Zatwierdź" albo kliknij Approve.',
    'Wstrzymuję wykonanie — brak wymaganych danych: {missing_inputs}.',
  ] as const,
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.4 — Evidence / citations posture
// ────────────────────────────────────────────────────────────────

export const P08_CITATION_POSTURE = {
  explicit_sources: {
    rule: 'Teresa can give "why" only in cited mode: evidence_pointers[] with link/ref to app object / SSOT / activity',
    required_fields: ['evidence_pointers'],
  },
  missing_source_boundary: {
    rule: 'When source is missing, Teresa must declare uncertainty: missing_inputs[], conflicts[]',
    required_fields: ['missing_inputs', 'conflicts'],
  },
  uncertainty_marker: {
    rule: 'No overclaim "I know because I know" without evidence or uncertainty boundary. Opinion vs fact must be marked.',
    forbidden: ['overclaim_without_evidence', 'opinion_as_fact_unmarked'],
  },
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.5 — Hard boundaries: Teresa vs Anna + module-owned writes
// ────────────────────────────────────────────────────────────────

export const P08_ANNA_BOUNDARY = {
  teresa: {
    scope: 'Internal product copilot on org objects',
    can: [
      'Access org data within permission scope',
      'Initiate proposal + handoff to target modules',
      'Maintain conversation context across surfaces',
      'Voice + text interaction within product',
    ],
    cannot: [
      'Act as public-facing assistant',
      'Bypass module-owned write governance',
      'Execute without explicit user approval',
      'Access data outside org/tenant scope',
    ],
  },
  anna: {
    scope: 'Public assistant without org data access',
    can: [
      'Answer general product questions',
      'Guide visitors through public content',
      'Collect leads and demo requests',
    ],
    cannot: [
      'Access org data',
      'Execute runtime actions on org objects',
      'Be used as a policy escape for Teresa limitations',
    ],
  },
  no_bypass:
    'No copy/paste policy escape between Teresa and Anna. They are separate runtimes with separate data access.',
} as const;

export const P08_WRITE_OWNERSHIP = {
  rule: 'Teresa initiates handoff, module owns writes',
  detail:
    'The only place where writes happen are target modules (Radar/Inicjatywy/Kalendarz/Notatki/Wywiady) per their own canon. Teresa does not create side-writes or parallel models.',
  teresa_role: 'initiator' as const,
  module_role: 'writer' as const,
  forbidden: [
    'Teresa-owned side writes',
    'Parallel data models outside target modules',
    'Background saves without module governance',
    'Direct DB writes bypassing module service layer',
  ],
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.6 — Anti-duplicate gate
// ────────────────────────────────────────────────────────────────

export const P08_ANTI_DUPLICATE_RULES = {
  run_grammar_source: 'P17 — run grammar is not duplicated in P08',
  single_payload_core:
    'Handoff payloads have 1 shared core (teresa_handoff_context) + per-target extensions; no payload v2 per module',
  near_duplicate_detection: {
    rule: 'If Teresa detects near-duplicate (parallel initiatives/notes for same problem statement), she must stop execution, indicate conflict, and propose merge/select-canonical',
    actions: ['stop_execution', 'indicate_conflict', 'propose_merge_or_select_canonical'],
  },
  no_parallel_approvals:
    'Only one active approval per user/session. New proposals cancel/version previous.',
  no_parallel_grammars: 'No per-module custom grammar; all modules consume the same envelope.',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.7 — Degraded / error posture (10 scenarios)
// ────────────────────────────────────────────────────────────────

export interface DegradedScenario {
  id: string;
  scenario: string;
  visible_state: string;
  safe_next_action: string;
  no_silent_data_loss: true;
}

export const P08_DEGRADED_SCENARIOS: DegradedScenario[] = [
  {
    id: 'D01',
    scenario: 'Voice unavailable / mic permission denied',
    visible_state: 'voice_unavailable',
    safe_next_action: 'Fallback to text + CTA "Continue in text"',
    no_silent_data_loss: true,
  },
  {
    id: 'D02',
    scenario: 'ASR uncertainty / low confidence',
    visible_state: 'asr_low_confidence',
    safe_next_action: 'Show transcript + ask to confirm; no execution',
    no_silent_data_loss: true,
  },
  {
    id: 'D03',
    scenario: 'Approval missing / timed out',
    visible_state: 'approval_expired',
    safe_next_action: 'Proposal expires; require re-approve; no partial writes',
    no_silent_data_loss: true,
  },
  {
    id: 'D04',
    scenario: 'Permission denied in target module',
    visible_state: 'blocked(permission)',
    safe_next_action: 'Request access / capture in Notatki as fallback',
    no_silent_data_loss: true,
  },
  {
    id: 'D05',
    scenario: 'Tool/action failed (network/timeout/503)',
    visible_state: 'degraded(tool_unavailable)',
    safe_next_action: 'Retry guidance + keep proposal intact',
    no_silent_data_loss: true,
  },
  {
    id: 'D06',
    scenario: 'Stale context / entity not found',
    visible_state: 'degraded(stale)',
    safe_next_action: 'Refresh/readback; never assume it worked',
    no_silent_data_loss: true,
  },
  {
    id: 'D07',
    scenario: 'Conflict/ETag mismatch (Calendar write)',
    visible_state: 'conflict',
    safe_next_action: 'Deny overwrite; propose manual resolution steps',
    no_silent_data_loss: true,
  },
  {
    id: 'D08',
    scenario: 'Audit/traces unavailable',
    visible_state: 'degraded(audit_unavailable)',
    safe_next_action:
      'Block execution or mark degraded with explicit warning; never claim completion',
    no_silent_data_loss: true,
  },
  {
    id: 'D09',
    scenario: 'Duplicate detected (near-duplicate initiative/note/signal)',
    visible_state: 'duplicate_detected',
    safe_next_action: 'Stop and propose merge/select-canonical',
    no_silent_data_loss: true,
  },
  {
    id: 'D10',
    scenario: 'Partial data (e.g. Radar sources 206)',
    visible_state: 'partial_data',
    safe_next_action: 'Show "partial" + list missing inputs; avoid P0 overclaim',
    no_silent_data_loss: true,
  },
];

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Acceptance checklist (12 items)
// ────────────────────────────────────────────────────────────────

export const P08_ACCEPTANCE_CHECKLIST: Array<{
  id: number;
  requirement: string;
  section: string;
  testable: boolean;
}> = [
  {
    id: 1,
    requirement: 'P0 targets list (3-5) frozen: Radar/P11/P02/P07',
    section: '§2.3.1',
    testable: true,
  },
  {
    id: 2,
    requirement:
      'Each target has required payload: common teresa_handoff_context + per-target additions',
    section: '§2.3.1',
    testable: true,
  },
  {
    id: 3,
    requirement: 'Action envelope: proposal→explicit approval→execution→audit/traces (per P17)',
    section: '§2.3.2',
    testable: true,
  },
  {
    id: 4,
    requirement: 'approve(run) ≠ review(artifact) is explicit; no silent writes',
    section: '§2.3.2',
    testable: true,
  },
  {
    id: 5,
    requirement: 'No parallel approvals is a hard rule (anti-duplicate governance)',
    section: '§2.3.2',
    testable: true,
  },
  {
    id: 6,
    requirement: 'Voice posture: availability + fallback to text + recovery grammar',
    section: '§2.3.3',
    testable: true,
  },
  {
    id: 7,
    requirement:
      'Evidence pointers/citations posture is explicit; missing source = uncertainty boundary',
    section: '§2.3.4',
    testable: true,
  },
  {
    id: 8,
    requirement: 'Hard boundary vs Anna/public assistant is documented; no bypass',
    section: '§2.3.5',
    testable: true,
  },
  {
    id: 9,
    requirement: 'Module-owned writes: Teresa initiates handoff, not owner of writes',
    section: '§2.3.5',
    testable: true,
  },
  {
    id: 10,
    requirement: 'Degraded/error posture has minimum 8 scenarios with safe next action',
    section: '§2.3.7',
    testable: true,
  },
  {
    id: 11,
    requirement: 'Anti-duplicate: near-duplicate stop + merge/select-canonical',
    section: '§2.3.6',
    testable: true,
  },
  { id: 12, requirement: 'Evidence ledger filled for P08', section: '§10', testable: true },
];

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Validate that a handoff context has all required common fields.
 */
export const P08_BOUNDED_CONTEXT_PACK_MAX = 5;

export function validateHandoffContext(ctx: Record<string, unknown>): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  for (const field of P08_COMMON_PAYLOAD_FIELDS) {
    if (ctx[field] === undefined || ctx[field] === null) {
      missing.push(field);
    }
  }
  const bcp = ctx.bounded_context_pack;
  if (Array.isArray(bcp) && bcp.length > P08_BOUNDED_CONTEXT_PACK_MAX) {
    warnings.push(
      `bounded_context_pack exceeds max ${P08_BOUNDED_CONTEXT_PACK_MAX} (got ${bcp.length})`
    );
  }
  return { valid: missing.length === 0, missing, warnings };
}

/**
 * Validate that a handoff to a specific target has the required extra fields.
 */
export function validateTargetPayload(
  target: HandoffTargetModule,
  payload: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const targetDef = (P08_HANDOFF_TARGETS as any)[target];
  if (!targetDef) {
    return { valid: false, missing: [`unsupported_target:${target}`] };
  }
  const missing: string[] = [];
  for (const field of targetDef.required_extra_fields) {
    if (payload[field] === undefined || payload[field] === null) {
      missing.push(field);
    }
  }
  return { valid: missing.length === 0, missing };
}

/**
 * Check if an envelope state transition is valid.
 */
export function isValidEnvelopeTransition(
  from: ActionEnvelopeState,
  to: ActionEnvelopeState
): boolean {
  return P08_ACTION_ENVELOPE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Determine voice availability based on runtime conditions.
 */
export function resolveVoiceAvailability(conditions: {
  micPermission: boolean;
  networkStable: boolean;
  runtimeReady: boolean;
}): VoiceAvailability {
  if (!conditions.micPermission) return 'unavailable';
  if (!conditions.networkStable || !conditions.runtimeReady) return 'degraded';
  return 'available';
}

/**
 * Check if an actor is Teresa (for write ownership validation).
 */
export function isTeresaInitiated(actor: string): boolean {
  return actor === 'teresa' || actor.startsWith('teresa:');
}

/**
 * Validate that Teresa is not the writer — only the initiator.
 */
export function validateWriteOwnership(
  initiator: string,
  writer: string
): {
  valid: boolean;
  reason?: string;
} {
  if (!isTeresaInitiated(initiator)) {
    return { valid: true };
  }
  if (isTeresaInitiated(writer)) {
    return {
      valid: false,
      reason: 'Teresa cannot be both initiator and writer. Module must own writes.',
    };
  }
  return { valid: true };
}
