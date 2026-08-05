/**
 * P08-B — Teresa Copilot Service integration tests.
 *
 * Tests the full proposal lifecycle (create → approve → execute → complete),
 * cross-surface handoff to all 4 P0 targets, audit trail, anti-duplicate gate,
 * voice posture, degraded scenarios, and rejection flows.
 *
 * All tests exercise real production code from teresaCopilotService.ts
 * and teresaCopilotCanon.ts with mocked DB layer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  HandoffTargetModule,
  TeresaHandoffContext,
} from '../../../services/v8/teresaCopilotCanon.js';
import type { HandoffResult, ProposalRecord } from '../../../services/v8/teresaCopilotService.js';

// Mock DB layer
const mockDbRun = vi.fn().mockResolvedValue({ changes: 1 });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// FIX M01-P07B (M01-005): the 4 owner-module doubles below make §3's
// "full lifecycle: create -> approve -> execute" cases reach `completed`
// under the NEW fail-closed contract. Before M01-P07B, `handleXHandoff`
// minted `fallbackRef = randomUUID()` whenever `tryImport` resolved these
// (real, on-disk) service modules against the STATELESS `mockDbGet` double
// above (which always resolves `null`) — the create call would still
// "succeed" with a self-generated id from the real service, so §3 passed by
// exercising the exact fabrication bug this packet closes, not real success.
// Now every target performs an independent, tenant-scoped READ-BACK before
// completing, which the stateless DB mock can never satisfy on its own —
// these doubles are what a real owner write + read-back would return.
vi.mock('../../../services/v8/radarTriageService.js', () => ({
  createSignal: vi.fn(async () => ({ id: 'mock-radar-signal-1' })),
  getTriageSignal: vi.fn(async () => ({ id: 'mock-radar-signal-1' })),
}));
vi.mock('../../../services/initiativeGenerationService.js', () => ({
  createInitiative: vi.fn(async () => ({ id: 'mock-initiative-1' })),
}));
vi.mock('../../../services/v8/planningPortfolioReadService.js', () => ({
  getInitiativeDetailRead: vi.fn(async () => ({ id: 'mock-initiative-1' })),
}));
vi.mock('../../../services/meetingService.js', () => ({
  createMeeting: vi.fn(async () => ({ id: 'mock-meeting-1' })),
  getMeeting: vi.fn(async () => ({ id: 'mock-meeting-1' })),
}));
vi.mock('../../../services/notebookService.js', () => ({
  createNote: vi.fn(async () => ({ id: 'mock-note-1' })),
  default: { resolveEmbedChip: vi.fn(async () => ({ permissionOk: true })) },
}));

const {
  createProposal,
  approveProposal,
  rejectProposal,
  executeProposal,
  getProposal,
  getProposalHistory,
  getAuditTrail,
  resolveVoicePosture,
  getDegradedScenario,
  getAllDegradedScenarios,
  getContractMetadata,
  createChatProposal,
  toChatProposalEnvelope,
  TeresaCopilotError,
} = await import('../../../services/v8/teresaCopilotService.js');

const {
  P08_HANDOFF_TARGET_MODULES,
  P08_ACTION_ENVELOPE_STATES,
  P08_DEGRADED_SCENARIOS,
  P08_COPILOT_CONTRACT,
  validateHandoffContext,
  validateTargetPayload,
  isValidEnvelopeTransition,
  validateWriteOwnership,
} = await import('../../../services/v8/teresaCopilotCanon.js');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG = '00000000-0000-4000-8000-000000000c01';
const USER = '00000000-0000-4000-8000-000000000c02';
const SESSION = '00000000-0000-4000-8000-000000000c03';

function buildHandoffContext(overrides?: Partial<TeresaHandoffContext>): TeresaHandoffContext {
  return {
    origin: 'teresa',
    user_intent: 'Create a new initiative for Q3 planning',
    active_surface: 'radar/triage',
    org_context_ref: `org:${ORG}`,
    bounded_context_pack: [{ ref: 'init-001', type: 'initiative' }],
    constraints: ['do not change dates without approval'],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: ['signal:sig-001'],
    proposed_next_action: {
      target_module: 'initiatives',
      handoff_intent: 'create',
      requires_approval: true,
    },
    audit_stub: {
      actor: 'teresa:copilot',
      timestamp: new Date().toISOString(),
    },
    ...overrides,
  };
}

function buildRadarPayload() {
  return {
    why_now: 'Q3 deadline approaching',
    time_window: '2026-Q3',
    triggered_rules: ['deadline_proximity'],
    evidence_pointers: ['signal:sig-001'],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    next_action_safe_fallback: 'Capture in notebook',
  };
}

function buildInitiativesPayload() {
  return {
    initiative_seed: {
      problem_statement: 'Q3 planning gap',
      proposed_outcome: 'Aligned Q3 roadmap',
      assumptions: ['Budget approved'],
      risks: ['Timeline slip'],
      next_steps: ['Stakeholder review'],
      time_window: '2026-Q3',
    },
    proposal_only: true,
  };
}

function buildCalendarPayload() {
  return {
    calendar_intent: {
      what: 'Q3 planning meeting',
      when: '2026-07-01T10:00:00Z',
      timezone: 'Europe/Warsaw',
    },
    permission_gradient_expectation: 'write' as const,
    conflict_safe_write_posture: 'if_match_etag' as const,
    recovery_steps: ['Check for conflicts', 'Retry with updated etag'],
  };
}

function buildNotebookPayload() {
  return {
    notebook_handoff_context: {
      title: 'Q3 Planning Notes',
      body_preview: 'Key decisions from the planning session...',
      source: 'teresa' as const,
    },
    provenance_markers: { source: 'teresa', user_edit: false, ai_transform: true },
    evidence_pointers: ['session:sess-001'],
  };
}

function buildInterviewPayload() {
  return {
    interview_handoff_context: {
      action: 'generate_insight' as const,
      session_ids: ['session-1'],
      title: 'Discovery Summary',
    },
    evidence_pointers: ['session:session-1'],
  };
}

function buildExcelePayload() {
  return {
    prompt: 'Build a Q3 finance workbook with P&L and cash-flow tabs.',
  };
}

function buildIdeasPayload() {
  return {
    ideas_context: 'Map out the project launch strategy',
    canvas_type: 'mind_map',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let proposalCounter = 0;

function mockProposalRow(overrides?: Record<string, unknown>) {
  proposalCounter++;
  return {
    id: `prop-${proposalCounter}`,
    organization_id: ORG,
    user_id: USER,
    session_id: SESSION,
    state: 'proposal',
    handoff_context_json: JSON.stringify(buildHandoffContext()),
    target_module: 'initiatives',
    target_payload_json: JSON.stringify(buildInitiativesPayload()),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  proposalCounter = 0;
  mockDbRun.mockResolvedValue({ changes: 1 });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

// ────────────────────────────────────────────────────────────────
// §1 — Proposal creation
// ────────────────────────────────────────────────────────────────

describe('P08-B §1 — Proposal creation', () => {
  it('creates a proposal with valid handoff context and target payload', async () => {
    const context = buildHandoffContext({
      proposed_next_action: {
        target_module: 'radar',
        handoff_intent: 'open',
        requires_approval: true,
      },
    });
    const proposal = await createProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      handoffContext: context,
      targetModule: 'radar',
      targetPayload: buildRadarPayload(),
    });

    expect(proposal.state).toBe('proposal');
    expect(proposal.target_module).toBe('radar');
    expect(proposal.organization_id).toBe(ORG);
    expect(proposal.user_id).toBe(USER);
    expect(proposal.audit_trail).toHaveLength(1);
    expect(proposal.audit_trail[0].action).toBe('proposal_created');
  });

  it('rejects proposal with missing handoff context fields', async () => {
    const badContext = { origin: 'teresa' } as unknown as TeresaHandoffContext;
    await expect(
      createProposal({
        organizationId: ORG,
        userId: USER,
        sessionId: SESSION,
        handoffContext: badContext,
        targetModule: 'radar',
        targetPayload: buildRadarPayload(),
      })
    ).rejects.toThrow('Missing handoff context fields');
  });

  it('rejects proposal with invalid target module', async () => {
    await expect(
      createProposal({
        organizationId: ORG,
        userId: USER,
        sessionId: SESSION,
        handoffContext: buildHandoffContext(),
        targetModule: 'invalid_module' as HandoffTargetModule,
        targetPayload: {},
      })
    ).rejects.toThrow('Invalid target module');
  });

  it('rejects proposal with missing target payload fields', async () => {
    const context = buildHandoffContext({
      proposed_next_action: {
        target_module: 'radar',
        handoff_intent: 'open',
        requires_approval: true,
      },
    });
    await expect(
      createProposal({
        organizationId: ORG,
        userId: USER,
        sessionId: SESSION,
        handoffContext: context,
        targetModule: 'radar',
        targetPayload: { why_now: 'test' },
      })
    ).rejects.toThrow('Missing target payload fields');
  });

  it('auto-cancels existing active proposal in same session (anti-duplicate)', async () => {
    const existingRow = mockProposalRow({ state: 'proposal' });
    mockDbGet.mockResolvedValueOnce(existingRow);

    const context = buildHandoffContext();
    const proposal = await createProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      handoffContext: context,
      targetModule: 'initiatives',
      targetPayload: buildInitiativesPayload(),
    });

    expect(proposal.state).toBe('proposal');
    // DB should have been called to reject the old proposal
    const updateCalls = mockDbRun.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE teresa_proposals SET state')
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('P08-B §1A — Chat proposal synthesis', () => {
  it('creates a Teresa chat proposal envelope for initiative intents', async () => {
    const proposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Przygotuj inicjatywę dla planu Q3',
      assistantMessage: 'Mogę przygotować draft inicjatywy i przekazać go do modułu Initiatives.',
      context: {
        workspaceContext: { projectId: 'proj-1', type: 'project' },
        screenContext: { currentScreen: 'initiatives' },
      },
      citations: [{ id: 'cit-1' }],
    });

    expect(proposal).not.toBeNull();
    expect(proposal!.targetModule).toBe('initiatives');
    expect(proposal!.allowedActions).toContain('approve');
    expect(proposal!.previewLines.length).toBeGreaterThan(0);
  });

  it('creates a Teresa chat proposal envelope for table intents in Canvas', async () => {
    const proposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Utwórz tabelę w Canvas do ryzyk projektu',
      assistantMessage: 'Mogę przygotować propozycję tabeli i przekazać ją do Table Studio.',
      context: {
        workspaceContext: { projectId: 'proj-1', type: 'work-canvas' },
        screenContext: { currentScreen: 'work-canvas' },
      },
      citations: [{ id: 'cit-2' }],
    });

    expect(proposal).not.toBeNull();
    expect(proposal!.targetModule).toBe('excele');
    expect(proposal!.allowedActions).toContain('approve');
    expect(proposal!.previewLines.length).toBeGreaterThan(0);
  });

  it('returns null when the chat turn does not imply a safe Teresa handoff', async () => {
    const proposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Czym różni się roadmapa od backlogu?',
      assistantMessage: 'Roadmapa pokazuje kierunek, a backlog listę prac.',
      context: {},
      citations: [],
    });

    expect(proposal).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────
// §2 — Proposal lifecycle (approve → execute → complete)
// ────────────────────────────────────────────────────────────────

describe('P08-B §2 — Proposal lifecycle', () => {
  it('approves a proposal: proposal → pending_approval → approved', async () => {
    const row = mockProposalRow({ id: 'prop-approve-1', state: 'proposal' });
    mockDbGet
      .mockResolvedValueOnce(row) // first get (approve check)
      .mockResolvedValueOnce({ ...row, state: 'approved' }); // second get (return updated)
    mockDbAll.mockResolvedValue([]); // audit entries

    const result = await approveProposal({
      proposalId: 'prop-approve-1',
      organizationId: ORG,
      userId: USER,
    });

    expect(result.state).toBe('approved');
  });

  it('rejects a proposal from proposal state', async () => {
    const row = mockProposalRow({ id: 'prop-reject-1', state: 'proposal' });
    mockDbGet.mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, state: 'rejected' });
    mockDbAll.mockResolvedValue([]);

    const result = await rejectProposal({
      proposalId: 'prop-reject-1',
      organizationId: ORG,
      userId: USER,
      reason: 'Not needed',
    });

    expect(result.state).toBe('rejected');
  });

  it('executes an approved proposal to completion', async () => {
    const row = mockProposalRow({ id: 'prop-exec-1', state: 'approved' });
    mockDbGet.mockResolvedValueOnce(row);

    const result = await executeProposal({
      proposalId: 'prop-exec-1',
      organizationId: ORG,
      userId: USER,
    });

    expect(result.success).toBe(true);
    expect(result.state).toBe('completed');
    expect(result.target_module).toBe('initiatives');
    expect(result.audit_entry_id).toBeTruthy();
  });

  it('rejects execution if proposal is not approved', async () => {
    const row = mockProposalRow({ id: 'prop-exec-bad', state: 'proposal' });
    mockDbGet.mockResolvedValueOnce(row);

    await expect(
      executeProposal({
        proposalId: 'prop-exec-bad',
        organizationId: ORG,
        userId: USER,
      })
    ).rejects.toThrow('Must be approved first');
  });

  it('returns 404 for non-existent proposal', async () => {
    mockDbGet.mockResolvedValue(null);
    await expect(
      approveProposal({
        proposalId: 'nonexistent',
        organizationId: ORG,
        userId: USER,
      })
    ).rejects.toThrow('Proposal not found');
  });
});

// ────────────────────────────────────────────────────────────────
// §3 — Cross-surface handoff to all 4 P0 targets
// ────────────────────────────────────────────────────────────────

describe('P08-B §3 — Cross-surface handoff (4 P0 targets)', () => {
  const targets: Array<{
    module: HandoffTargetModule;
    payloadBuilder: () => Record<string, unknown>;
    expectedHandoffKey: string;
  }> = [
    { module: 'radar', payloadBuilder: buildRadarPayload, expectedHandoffKey: 'signal_id' },
    {
      module: 'initiatives',
      payloadBuilder: buildInitiativesPayload,
      expectedHandoffKey: 'initiative_ref',
    },
    {
      module: 'calendar',
      payloadBuilder: buildCalendarPayload,
      expectedHandoffKey: 'calendar_ref',
    },
    { module: 'notebook', payloadBuilder: buildNotebookPayload, expectedHandoffKey: 'note_ref' },
  ];

  for (const { module, payloadBuilder, expectedHandoffKey } of targets) {
    it(`full lifecycle: create → approve → execute for ${module}`, async () => {
      // Step 1: Create proposal
      const context = buildHandoffContext({
        proposed_next_action: {
          target_module: module,
          handoff_intent: 'create',
          requires_approval: true,
        },
      });
      const proposal = await createProposal({
        organizationId: ORG,
        userId: USER,
        sessionId: SESSION,
        handoffContext: context,
        targetModule: module,
        targetPayload: payloadBuilder(),
      });
      expect(proposal.state).toBe('proposal');
      expect(proposal.target_module).toBe(module);

      // Step 2: Approve
      const approveRow = {
        ...mockProposalRow({
          id: proposal.id,
          state: 'proposal',
          target_module: module,
          handoff_context_json: JSON.stringify(context),
          target_payload_json: JSON.stringify(payloadBuilder()),
        }),
      };
      mockDbGet
        .mockResolvedValueOnce(approveRow)
        .mockResolvedValueOnce({ ...approveRow, state: 'approved' });
      mockDbAll.mockResolvedValue([]);

      const approved = await approveProposal({
        proposalId: proposal.id,
        organizationId: ORG,
        userId: USER,
      });
      expect(approved.state).toBe('approved');

      // Step 3: Execute
      const execRow = {
        ...approveRow,
        id: proposal.id,
        state: 'approved',
      };
      mockDbGet.mockResolvedValueOnce(execRow);

      const result = await executeProposal({
        proposalId: proposal.id,
        organizationId: ORG,
        userId: USER,
      });
      expect(result.success).toBe(true);
      expect(result.state).toBe('completed');
      expect(result.target_module).toBe(module);
    });
  }
});

// ────────────────────────────────────────────────────────────────
// §4 — Audit trail
// ────────────────────────────────────────────────────────────────

describe('P08-B §4 — Audit trail', () => {
  it('proposal creation writes audit entry', async () => {
    const context = buildHandoffContext();
    const proposal = await createProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      handoffContext: context,
      targetModule: 'initiatives',
      targetPayload: buildInitiativesPayload(),
    });

    expect(proposal.audit_trail).toHaveLength(1);
    expect(proposal.audit_trail[0].action).toBe('proposal_created');
    expect(proposal.audit_trail[0].to_state).toBe('proposal');
    expect(proposal.audit_trail[0].actor).toBe('teresa:copilot');
  });

  it('getAuditTrail returns entries for existing proposal', async () => {
    mockDbGet.mockResolvedValueOnce(mockProposalRow({ id: 'prop-audit-1' }));
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'audit-1',
        proposal_id: 'prop-audit-1',
        action: 'proposal_created',
        actor: 'teresa:copilot',
        timestamp: new Date().toISOString(),
        from_state: null,
        to_state: 'proposal',
        detail_json: null,
      },
    ]);

    const trail = await getAuditTrail('prop-audit-1', ORG);
    expect(trail).toHaveLength(1);
    expect(trail[0].action).toBe('proposal_created');
  });

  it('getAuditTrail throws for non-existent proposal', async () => {
    mockDbGet.mockResolvedValue(null);
    await expect(getAuditTrail('nonexistent', ORG)).rejects.toThrow('Proposal not found');
  });
});

// ────────────────────────────────────────────────────────────────
// §5 — Voice posture
// ────────────────────────────────────────────────────────────────

describe('P08-B §5 — Voice posture', () => {
  it('returns available when all conditions met', () => {
    const posture = resolveVoicePosture({
      micPermission: true,
      networkStable: true,
      runtimeReady: true,
    });
    expect(posture.availability).toBe('available');
    expect(posture.fallback_active).toBe(false);
    expect(posture.recovery_phrase).toBeNull();
  });

  it('returns unavailable with fallback when mic denied', () => {
    const posture = resolveVoicePosture({
      micPermission: false,
      networkStable: true,
      runtimeReady: true,
    });
    expect(posture.availability).toBe('unavailable');
    expect(posture.fallback_active).toBe(true);
    expect(posture.recovery_phrase).toContain('tekst');
  });

  it('returns degraded with recovery phrase when network unstable', () => {
    const posture = resolveVoicePosture({
      micPermission: true,
      networkStable: false,
      runtimeReady: true,
    });
    expect(posture.availability).toBe('degraded');
    expect(posture.fallback_active).toBe(true);
    expect(posture.recovery_phrase).toBeTruthy();
  });

  it('returns degraded when runtime not ready', () => {
    const posture = resolveVoicePosture({
      micPermission: true,
      networkStable: true,
      runtimeReady: false,
    });
    expect(posture.availability).toBe('degraded');
    expect(posture.fallback_active).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────
// §6 — Degraded scenarios
// ────────────────────────────────────────────────────────────────

describe('P08-B §6 — Degraded scenarios', () => {
  it('getAllDegradedScenarios returns all 10', () => {
    const scenarios = getAllDegradedScenarios();
    expect(scenarios).toHaveLength(10);
  });

  it('getDegradedScenario returns correct scenario by ID', () => {
    const d01 = getDegradedScenario('D01');
    expect(d01).not.toBeNull();
    expect(d01!.scenario).toContain('Voice unavailable');
    expect(d01!.no_silent_data_loss).toBe(true);
  });

  it('getDegradedScenario returns null for unknown ID', () => {
    expect(getDegradedScenario('D99')).toBeNull();
  });

  it('every scenario has visible_state and safe_next_action', () => {
    for (const s of getAllDegradedScenarios()) {
      expect(s.visible_state).toBeTruthy();
      expect(s.safe_next_action).toBeTruthy();
      expect(s.no_silent_data_loss).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// §7 — Write ownership enforcement
// ────────────────────────────────────────────────────────────────

describe('P08-B §7 — Write ownership', () => {
  it('canon: validateWriteOwnership rejects Teresa as both initiator and writer', () => {
    const result = validateWriteOwnership('teresa:copilot', 'teresa:copilot');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('cannot be both');
  });

  it('canon: validateWriteOwnership allows Teresa initiator + module writer', () => {
    const result = validateWriteOwnership('teresa:copilot', 'radar_service');
    expect(result.valid).toBe(true);
  });

  it('service: createProposal enforces write ownership (Teresa initiator, module writer)', async () => {
    const context = buildHandoffContext({
      audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
    });
    const proposal = await createProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      handoffContext: context,
      targetModule: 'radar',
      targetPayload: buildRadarPayload(),
    });
    expect(proposal.state).toBe('proposal');

    const auditActor = proposal.audit_trail[0].actor;
    expect(auditActor).toBe('teresa:copilot');
    expect(proposal.target_module).toBe('radar');
  });
});

// ────────────────────────────────────────────────────────────────
// §8 — Proposal retrieval
// ────────────────────────────────────────────────────────────────

describe('P08-B §8 — Proposal retrieval', () => {
  it('getProposal returns null for non-existent proposal', async () => {
    mockDbGet.mockResolvedValue(null);
    const result = await getProposal('nonexistent', ORG);
    expect(result).toBeNull();
  });

  it('getProposal returns proposal with audit trail', async () => {
    const row = mockProposalRow({ id: 'prop-get-1' });
    mockDbGet.mockResolvedValueOnce(row);
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'audit-1',
        proposal_id: 'prop-get-1',
        action: 'proposal_created',
        actor: 'teresa:copilot',
        timestamp: new Date().toISOString(),
        from_state: null,
        to_state: 'proposal',
        detail_json: null,
      },
    ]);

    const result = await getProposal('prop-get-1', ORG);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('prop-get-1');
    expect(result!.audit_trail).toHaveLength(1);
  });

  it('getProposalHistory returns proposals for user', async () => {
    mockDbAll.mockResolvedValueOnce([
      mockProposalRow({ id: 'prop-hist-1' }),
      mockProposalRow({ id: 'prop-hist-2' }),
    ]);
    // Audit entries for each proposal
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const results = await getProposalHistory(ORG, USER, 10);
    expect(results).toHaveLength(2);
  });
});

// ────────────────────────────────────────────────────────────────
// §9 — Contract metadata
// ────────────────────────────────────────────────────────────────

describe('P08-B §9 — Contract metadata', () => {
  it('returns correct contract metadata', () => {
    const meta = getContractMetadata();
    expect(meta.contract_id).toBe(P08_COPILOT_CONTRACT);
    expect(meta.handoff_targets).toEqual(P08_HANDOFF_TARGET_MODULES);
    expect(meta.envelope_states).toHaveLength(P08_ACTION_ENVELOPE_STATES.length);
    expect(meta.degraded_scenarios_count).toBe(P08_DEGRADED_SCENARIOS.length);
  });

  it('maps proposal records to chat envelopes', () => {
    const envelope = toChatProposalEnvelope({
      id: 'prop-envelope-1',
      organization_id: ORG,
      user_id: USER,
      session_id: SESSION,
      state: 'approved',
      handoff_context: buildHandoffContext(),
      target_module: 'initiatives',
      target_payload: buildInitiativesPayload(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      audit_trail: [],
    });

    expect(envelope.approvalState).toBe('approved');
    expect(envelope.allowedActions).toContain('execute');
    expect(envelope.targetLabel).toBe('Initiatives');
  });
});

// ────────────────────────────────────────────────────────────────
// §10 — Envelope state machine (canon integration)
// ────────────────────────────────────────────────────────────────

describe('P08-B §10 — Envelope state machine integration', () => {
  it('full valid chain: proposal → pending_approval → approved → executing → completed', () => {
    expect(isValidEnvelopeTransition('proposal', 'pending_approval')).toBe(true);
    expect(isValidEnvelopeTransition('pending_approval', 'approved')).toBe(true);
    expect(isValidEnvelopeTransition('approved', 'executing')).toBe(true);
    expect(isValidEnvelopeTransition('executing', 'completed')).toBe(true);
  });

  it('rejection is valid from proposal, pending_approval, and executing', () => {
    expect(isValidEnvelopeTransition('proposal', 'rejected')).toBe(true);
    expect(isValidEnvelopeTransition('pending_approval', 'rejected')).toBe(true);
    expect(isValidEnvelopeTransition('executing', 'rejected')).toBe(true);
  });

  it('cannot skip approval: proposal → executing is invalid', () => {
    expect(isValidEnvelopeTransition('proposal', 'executing')).toBe(false);
  });

  it('completed and rejected are terminal states', () => {
    expect(isValidEnvelopeTransition('completed', 'proposal')).toBe(false);
    expect(isValidEnvelopeTransition('rejected', 'proposal')).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────
// §11 — Handoff context validation (canon integration)
// ────────────────────────────────────────────────────────────────

describe('P08-B §11 — Handoff context validation', () => {
  it('validates complete context as valid', () => {
    const ctx = buildHandoffContext();
    const result = validateHandoffContext(ctx as unknown as Record<string, unknown>);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('detects all missing fields', () => {
    const result = validateHandoffContext({});
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBeGreaterThan(5);
  });

  for (const target of P08_HANDOFF_TARGET_MODULES) {
    it(`validates ${target} target payload correctly`, () => {
      const payloadMap: Partial<Record<HandoffTargetModule, () => Record<string, unknown>>> = {
        radar: buildRadarPayload,
        initiatives: buildInitiativesPayload,
        calendar: buildCalendarPayload,
        notebook: buildNotebookPayload,
        interview: buildInterviewPayload,
        excele: buildExcelePayload,
        ideas: buildIdeasPayload,
      };
      const result = validateTargetPayload(target, payloadMap[target]());
      expect(result.valid).toBe(true);
    });
  }
});

// ────────────────────────────────────────────────────────────────
// §12 — Error handling
// ────────────────────────────────────────────────────────────────

describe('P08-B §12 — Error handling', () => {
  it('TeresaCopilotError has correct properties', () => {
    const err = new TeresaCopilotError('test error', 'P08_TEST', 422);
    expect(err.message).toBe('test error');
    expect(err.code).toBe('P08_TEST');
    expect(err.statusCode).toBe(422);
    expect(err.name).toBe('TeresaCopilotError');
  });

  it('execution failure returns degraded(tool_unavailable) result', async () => {
    const row = mockProposalRow({
      id: 'prop-fail-1',
      state: 'approved',
      target_module: 'unknown_target',
    });
    mockDbGet.mockResolvedValueOnce(row);
    mockDbRun
      .mockResolvedValueOnce({ changes: 1 }) // state transition to executing
      .mockResolvedValueOnce({ changes: 1 }) // audit entry for execution_started
      .mockResolvedValueOnce({ changes: 1 }) // state transition to rejected
      .mockResolvedValueOnce({ changes: 1 }); // audit entry for execution_failed

    const result = await executeProposal({
      proposalId: 'prop-fail-1',
      organizationId: ORG,
      userId: USER,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown target module');
    expect(result.degraded).toBe('tool_unavailable');
    expect(result.state).toBe('rejected');
  });

  it('execution failure with audit write failure returns degraded(audit_unavailable)', async () => {
    const row = mockProposalRow({ id: 'prop-fail-2', state: 'approved' });
    mockDbGet.mockResolvedValueOnce(row);
    mockDbRun
      .mockResolvedValueOnce({ changes: 1 }) // state transition to executing
      .mockResolvedValueOnce({ changes: 1 }) // audit entry for execution_started
      .mockRejectedValueOnce(new Error('Target module error')) // handoff fails
      .mockRejectedValueOnce(new Error('Audit DB down')) // state transition to rejected fails
      .mockRejectedValueOnce(new Error('Audit DB down')); // audit entry write also fails

    const result = await executeProposal({
      proposalId: 'prop-fail-2',
      organizationId: ORG,
      userId: USER,
    });

    expect(result.success).toBe(false);
    expect(result.degraded).toBe('audit_unavailable');
    expect(result.state).toBe('executing');
  });
});

// ────────────────────────────────────────────────────────────────
// §13 — Idempotency posture
// ────────────────────────────────────────────────────────────────

describe('P08-B §13 — Idempotency posture', () => {
  it('idempotencyKey returns existing proposal instead of creating duplicate', async () => {
    const existingRow = mockProposalRow({ id: 'idem-key-1', state: 'proposal' });
    // First call: idempotency check finds existing
    mockDbGet.mockResolvedValueOnce(existingRow);
    mockDbAll.mockResolvedValueOnce([]); // audit entries

    const context = buildHandoffContext();
    const proposal = await createProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      handoffContext: context,
      targetModule: 'initiatives',
      targetPayload: buildInitiativesPayload(),
      idempotencyKey: 'idem-key-1',
    });

    expect(proposal.id).toBe('idem-key-1');
    // Should NOT have called INSERT (no new proposal created)
    const insertCalls = mockDbRun.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO teresa_proposals')
    );
    expect(insertCalls).toHaveLength(0);
  });

  it('idempotencyKey creates new proposal when no existing match', async () => {
    // Idempotency check returns null (no existing)
    mockDbGet.mockResolvedValueOnce(null);
    // Anti-duplicate check returns null (no active)
    mockDbGet.mockResolvedValueOnce(null);

    const context = buildHandoffContext();
    const proposal = await createProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      handoffContext: context,
      targetModule: 'initiatives',
      targetPayload: buildInitiativesPayload(),
      idempotencyKey: 'idem-key-new',
    });

    expect(proposal.id).toBe('idem-key-new');
    expect(proposal.state).toBe('proposal');
  });
});

// ────────────────────────────────────────────────────────────────
// §14 — bounded_context_pack max 5 enforcement
// ────────────────────────────────────────────────────────────────

describe('P08-B §14 — bounded_context_pack max 5', () => {
  it('validateHandoffContext warns when bounded_context_pack exceeds max 5', () => {
    const ctx = buildHandoffContext({
      bounded_context_pack: [
        { ref: 'a', type: 'x' },
        { ref: 'b', type: 'x' },
        { ref: 'c', type: 'x' },
        { ref: 'd', type: 'x' },
        { ref: 'e', type: 'x' },
        { ref: 'f', type: 'x' },
      ],
    });
    const result = validateHandoffContext(ctx as unknown as Record<string, unknown>);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('exceeds max 5');
  });

  it('validateHandoffContext has no warnings when bounded_context_pack is within limit', () => {
    const ctx = buildHandoffContext();
    const result = validateHandoffContext(ctx as unknown as Record<string, unknown>);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
