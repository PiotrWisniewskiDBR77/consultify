/**
 * P08 Teresa Copilot Canon — Integration tests.
 *
 * Covers: §2.3.1 handoff targets, §2.3.2 action envelope, §2.3.3 voice posture,
 * §2.3.4 citations, §2.3.5 boundaries, §2.3.6 anti-duplicate, §2.3.7 degraded,
 * §2.3.8 acceptance checklist.
 */
import { describe, expect, it } from 'vitest';

import {
  isValidEnvelopeTransition,
  P08_ACCEPTANCE_CHECKLIST,
  P08_ACTION_ENVELOPE_RULES,
  P08_ACTION_ENVELOPE_STATES,
  P08_ACTION_ENVELOPE_TRANSITIONS,
  P08_ANNA_BOUNDARY,
  P08_ANTI_DUPLICATE_RULES,
  P08_CITATION_POSTURE,
  P08_COMMON_PAYLOAD_FIELDS,
  P08_COPILOT_CONTRACT,
  P08_DEGRADED_SCENARIOS,
  P08_HANDOFF_TARGET_MODULES,
  P08_HANDOFF_TARGETS,
  P08_VOICE_POSTURE,
  P08_WRITE_OWNERSHIP,
  resolveVoiceAvailability,
  validateHandoffContext,
  validateTargetPayload,
  validateWriteOwnership,
} from '../../../services/v8/teresaCopilotCanon.js';

// ────────────────────────────────────────────────────────────────
// §2.3.1 — Handoff targets
// ────────────────────────────────────────────────────────────────

describe('P08 §2.3.1 — Handoff targets', () => {
  it('includes required target modules for Teresa handoff', () => {
    expect(P08_HANDOFF_TARGET_MODULES).toEqual([
      'radar',
      'initiatives',
      'calendar',
      'notebook',
      'interview',
      'excele',
      'ideas',
      'documents',
      'presentations',
      'kpi',
      'roi',
      'okr',
    ]);
    expect(Object.keys(P08_HANDOFF_TARGETS)).toHaveLength(12);
  });

  it('radar target references P06 and requires correct extra fields', () => {
    const radar = P08_HANDOFF_TARGETS.radar;
    expect(radar.contract_ref).toBe('P06');
    expect(radar.required_common_payload).toBe(true);
    expect(radar.required_extra_fields).toContain('why_now');
    expect(radar.required_extra_fields).toContain('time_window');
    expect(radar.required_extra_fields).toContain('triggered_rules');
    expect(radar.required_extra_fields).toContain('next_action_safe_fallback');
  });

  it('initiatives target references P11 and requires initiative_seed + proposal_only', () => {
    const init = P08_HANDOFF_TARGETS.initiatives;
    expect(init.contract_ref).toBe('P11');
    expect(init.required_extra_fields).toContain('initiative_seed');
    expect(init.required_extra_fields).toContain('proposal_only');
  });

  it('calendar target references P02 and requires conflict-safe write posture', () => {
    const cal = P08_HANDOFF_TARGETS.calendar;
    expect(cal.contract_ref).toBe('P02');
    expect(cal.required_extra_fields).toContain('calendar_intent');
    expect(cal.required_extra_fields).toContain('conflict_safe_write_posture');
    expect(cal.required_extra_fields).toContain('permission_gradient_expectation');
  });

  it('notebook target references P07 and requires provenance markers', () => {
    const nb = P08_HANDOFF_TARGETS.notebook;
    expect(nb.contract_ref).toBe('P07');
    expect(nb.required_extra_fields).toContain('notebook_handoff_context');
    expect(nb.required_extra_fields).toContain('provenance_markers');
    expect(nb.required_extra_fields).toContain('evidence_pointers');
  });

  it('common payload has all required fields from §2.3.1', () => {
    expect(P08_COMMON_PAYLOAD_FIELDS).toContain('origin');
    expect(P08_COMMON_PAYLOAD_FIELDS).toContain('user_intent');
    expect(P08_COMMON_PAYLOAD_FIELDS).toContain('active_surface');
    expect(P08_COMMON_PAYLOAD_FIELDS).toContain('org_context_ref');
    expect(P08_COMMON_PAYLOAD_FIELDS).toContain('bounded_context_pack');
    expect(P08_COMMON_PAYLOAD_FIELDS).toContain('uncertainty_boundary');
    expect(P08_COMMON_PAYLOAD_FIELDS).toContain('evidence_pointers');
    expect(P08_COMMON_PAYLOAD_FIELDS).toContain('proposed_next_action');
    expect(P08_COMMON_PAYLOAD_FIELDS).toContain('audit_stub');
  });
});

// ────────────────────────────────────────────────────────────────
// §2.3.1 — Payload validation helpers
// ────────────────────────────────────────────────────────────────

describe('P08 §2.3.1 — Payload validation', () => {
  const validContext: Record<string, unknown> = {
    origin: 'teresa',
    user_intent: 'Create a new initiative for Q3 planning',
    active_surface: 'radar/triage',
    org_context_ref: 'org:dbr77',
    bounded_context_pack: [{ ref: 'init-001', type: 'initiative' }],
    constraints: ['do not change dates'],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: ['signal:sig-001'],
    proposed_next_action: {
      target_module: 'initiatives',
      handoff_intent: 'create',
      requires_approval: true,
    },
    audit_stub: { actor: 'teresa:copilot', timestamp: '2026-03-31T12:00:00Z' },
  };

  it('validates a complete handoff context as valid', () => {
    const result = validateHandoffContext(validContext);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('detects missing fields in handoff context', () => {
    const incomplete = { origin: 'teresa', user_intent: 'test' };
    const result = validateHandoffContext(incomplete);
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing).toContain('active_surface');
  });

  it('validates radar target payload correctly', () => {
    const radarPayload = {
      why_now: 'Q3 deadline approaching',
      time_window: '2026-Q3',
      triggered_rules: ['deadline_proximity'],
      evidence_pointers: ['signal:sig-001'],
      uncertainty_boundary: {
        missing_inputs: [],
        conflicts: [],
        what_would_change_next_action: [],
      },
      next_action_safe_fallback: 'Capture in notebook',
    };
    const result = validateTargetPayload('radar', radarPayload);
    expect(result.valid).toBe(true);
  });

  it('detects missing fields in target payload', () => {
    const result = validateTargetPayload('radar', { why_now: 'test' });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('time_window');
  });
});

// ────────────────────────────────────────────────────────────────
// §2.3.2 — Action governance envelope
// ────────────────────────────────────────────────────────────────

describe('P08 §2.3.2 — Action governance envelope', () => {
  it('has 7 envelope states, including the audited undo result', () => {
    expect(P08_ACTION_ENVELOPE_STATES).toHaveLength(7);
    expect(P08_ACTION_ENVELOPE_STATES).toContain('proposal');
    expect(P08_ACTION_ENVELOPE_STATES).toContain('pending_approval');
    expect(P08_ACTION_ENVELOPE_STATES).toContain('approved');
    expect(P08_ACTION_ENVELOPE_STATES).toContain('executing');
    expect(P08_ACTION_ENVELOPE_STATES).toContain('completed');
    expect(P08_ACTION_ENVELOPE_STATES).toContain('undone');
    expect(P08_ACTION_ENVELOPE_STATES).toContain('rejected');
  });

  it('approve(run) ≠ review(artifact) rule is explicit', () => {
    expect(P08_ACTION_ENVELOPE_RULES.approve_not_review).toContain('approve(run)');
    expect(P08_ACTION_ENVELOPE_RULES.approve_not_review).toContain('review');
  });

  it('no silent writes rule exists', () => {
    expect(P08_ACTION_ENVELOPE_RULES.no_silent_writes).toBeTruthy();
    expect(P08_ACTION_ENVELOPE_RULES.no_silent_writes).toContain('No auto-apply');
  });

  it('no parallel approvals rule exists', () => {
    expect(P08_ACTION_ENVELOPE_RULES.no_parallel_approvals).toBeTruthy();
    expect(P08_ACTION_ENVELOPE_RULES.no_parallel_approvals).toContain('one active approval');
  });

  it('audit required rule exists', () => {
    expect(P08_ACTION_ENVELOPE_RULES.audit_required).toBeTruthy();
  });

  it('valid transitions: proposal → pending_approval', () => {
    expect(isValidEnvelopeTransition('proposal', 'pending_approval')).toBe(true);
  });

  it('valid transitions: approved → executing', () => {
    expect(isValidEnvelopeTransition('approved', 'executing')).toBe(true);
  });

  it('invalid transitions: proposal → executing (skip approval)', () => {
    expect(isValidEnvelopeTransition('proposal', 'executing')).toBe(false);
  });

  it('invalid transitions: completed → proposal (no restart)', () => {
    expect(isValidEnvelopeTransition('completed', 'proposal')).toBe(false);
  });

  it('completed can only be undone; undone and rejected are terminal states', () => {
    expect(P08_ACTION_ENVELOPE_TRANSITIONS.completed).toEqual(['undone']);
    expect(P08_ACTION_ENVELOPE_TRANSITIONS.undone).toHaveLength(0);
    expect(P08_ACTION_ENVELOPE_TRANSITIONS.rejected).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────
// §2.3.3 — Voice posture
// ────────────────────────────────────────────────────────────────

describe('P08 §2.3.3 — Voice posture', () => {
  it('has 3 availability states', () => {
    expect(P08_VOICE_POSTURE.availability.states).toHaveLength(3);
    expect(P08_VOICE_POSTURE.availability.states).toContain('available');
    expect(P08_VOICE_POSTURE.availability.states).toContain('degraded');
    expect(P08_VOICE_POSTURE.availability.states).toContain('unavailable');
  });

  it('fallback to text has trigger conditions', () => {
    expect(P08_VOICE_POSTURE.fallback_to_text.trigger_conditions.length).toBeGreaterThan(0);
  });

  it('recovery grammar has at least 4 frozen phrases', () => {
    expect(P08_VOICE_POSTURE.recovery_grammar.length).toBeGreaterThanOrEqual(4);
  });

  it('resolveVoiceAvailability returns unavailable when mic denied', () => {
    expect(
      resolveVoiceAvailability({ micPermission: false, networkStable: true, runtimeReady: true })
    ).toBe('unavailable');
  });

  it('resolveVoiceAvailability returns degraded when network unstable', () => {
    expect(
      resolveVoiceAvailability({ micPermission: true, networkStable: false, runtimeReady: true })
    ).toBe('degraded');
  });

  it('resolveVoiceAvailability returns available when all conditions met', () => {
    expect(
      resolveVoiceAvailability({ micPermission: true, networkStable: true, runtimeReady: true })
    ).toBe('available');
  });
});

// ────────────────────────────────────────────────────────────────
// §2.3.4 — Citations posture
// ────────────────────────────────────────────────────────────────

describe('P08 §2.3.4 — Citations posture', () => {
  it('explicit sources require evidence_pointers', () => {
    expect(P08_CITATION_POSTURE.explicit_sources.required_fields).toContain('evidence_pointers');
  });

  it('missing source boundary requires missing_inputs and conflicts', () => {
    expect(P08_CITATION_POSTURE.missing_source_boundary.required_fields).toContain(
      'missing_inputs'
    );
    expect(P08_CITATION_POSTURE.missing_source_boundary.required_fields).toContain('conflicts');
  });

  it('uncertainty marker forbids overclaim without evidence', () => {
    expect(P08_CITATION_POSTURE.uncertainty_marker.forbidden).toContain(
      'overclaim_without_evidence'
    );
  });
});

// ────────────────────────────────────────────────────────────────
// §2.3.5 — Hard boundaries + write ownership
// ────────────────────────────────────────────────────────────────

describe('P08 §2.3.5 — Teresa vs Anna boundary', () => {
  it('Teresa scope is internal product copilot', () => {
    expect(P08_ANNA_BOUNDARY.teresa.scope).toContain('Internal');
  });

  it('Anna scope is public assistant without org data', () => {
    expect(P08_ANNA_BOUNDARY.anna.scope).toContain('Public');
    expect(P08_ANNA_BOUNDARY.anna.cannot).toContain('Access org data');
  });

  it('no bypass rule exists', () => {
    expect(P08_ANNA_BOUNDARY.no_bypass).toContain('separate runtimes');
  });

  it('write ownership: Teresa is initiator, module is writer', () => {
    expect(P08_WRITE_OWNERSHIP.teresa_role).toBe('initiator');
    expect(P08_WRITE_OWNERSHIP.module_role).toBe('writer');
  });

  it('validateWriteOwnership rejects Teresa as both initiator and writer', () => {
    const result = validateWriteOwnership('teresa:copilot', 'teresa:copilot');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('cannot be both');
  });

  it('validateWriteOwnership allows Teresa initiator + module writer', () => {
    const result = validateWriteOwnership('teresa:copilot', 'calendar_service');
    expect(result.valid).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// §2.3.6 — Anti-duplicate gate
// ────────────────────────────────────────────────────────────────

describe('P08 §2.3.6 — Anti-duplicate gate', () => {
  it('run grammar source is P17', () => {
    expect(P08_ANTI_DUPLICATE_RULES.run_grammar_source).toContain('P17');
  });

  it('near-duplicate detection requires stop + conflict + merge', () => {
    const actions = P08_ANTI_DUPLICATE_RULES.near_duplicate_detection.actions;
    expect(actions).toContain('stop_execution');
    expect(actions).toContain('indicate_conflict');
    expect(actions).toContain('propose_merge_or_select_canonical');
  });
});

// ────────────────────────────────────────────────────────────────
// §2.3.7 — Degraded posture
// ────────────────────────────────────────────────────────────────

describe('P08 §2.3.7 — Degraded posture', () => {
  it('has at least 8 degraded scenarios (contract minimum)', () => {
    expect(P08_DEGRADED_SCENARIOS.length).toBeGreaterThanOrEqual(8);
  });

  it('has exactly 10 scenarios', () => {
    expect(P08_DEGRADED_SCENARIOS).toHaveLength(10);
  });

  it('every scenario has visible_state, safe_next_action, and no_silent_data_loss', () => {
    for (const s of P08_DEGRADED_SCENARIOS) {
      expect(s.visible_state).toBeTruthy();
      expect(s.safe_next_action).toBeTruthy();
      expect(s.no_silent_data_loss).toBe(true);
    }
  });

  it('includes voice unavailable scenario', () => {
    expect(
      P08_DEGRADED_SCENARIOS.some((s) => s.id === 'D01' && s.scenario.includes('Voice unavailable'))
    ).toBe(true);
  });

  it('includes audit unavailable scenario', () => {
    expect(P08_DEGRADED_SCENARIOS.some((s) => s.id === 'D08' && s.scenario.includes('Audit'))).toBe(
      true
    );
  });

  it('includes duplicate detected scenario', () => {
    expect(
      P08_DEGRADED_SCENARIOS.some((s) => s.id === 'D09' && s.scenario.includes('Duplicate'))
    ).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Acceptance checklist
// ────────────────────────────────────────────────────────────────

describe('P08 §2.3.8 — Acceptance checklist', () => {
  it('has exactly 12 acceptance items', () => {
    expect(P08_ACCEPTANCE_CHECKLIST).toHaveLength(12);
  });

  it('all items are testable', () => {
    for (const item of P08_ACCEPTANCE_CHECKLIST) {
      expect(item.testable).toBe(true);
    }
  });

  it('item 1 covers P0 targets frozen', () => {
    expect(P08_ACCEPTANCE_CHECKLIST[0].requirement).toContain('P0 targets');
    expect(P08_ACCEPTANCE_CHECKLIST[0].requirement).toContain('Radar');
  });

  it('item 4 covers approve(run) ≠ review(artifact)', () => {
    expect(P08_ACCEPTANCE_CHECKLIST[3].requirement).toContain('approve(run)');
  });

  it('item 12 covers evidence ledger', () => {
    expect(P08_ACCEPTANCE_CHECKLIST[11].requirement).toContain('Evidence ledger');
  });
});

// ────────────────────────────────────────────────────────────────
// Contract identity
// ────────────────────────────────────────────────────────────────

describe('P08 — Contract identity', () => {
  it('contract version is teresa_copilot_v1', () => {
    expect(P08_COPILOT_CONTRACT).toBe('teresa_copilot_v1');
  });
});
