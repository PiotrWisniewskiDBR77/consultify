/**
 * P08-E2E — Teresa Copilot end-to-end lifecycle test
 *
 * Tests the full realistic pipeline:
 *   Voice transcript → LLM intent detection → proposal creation →
 *   approve → execute → handoff → audit trail verification
 *
 * Covers all 4 handoff targets with voice-originated messages in
 * both Polish and English, verifying that the LLM path is attempted
 * and the regex fallback works correctly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  HandoffTargetModule,
  TeresaHandoffContext,
} from '../../../services/v8/teresaCopilotCanon.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

const mockLlmCall = vi.fn();
vi.mock('../../../services/ai/llmService.js', () => ({
  llmService: { call: (...args: unknown[]) => mockLlmCall(...args) },
}));

// FIX M01-P07B (M01-005): owner-module doubles so §1's full voice -> proposal
// -> approve -> execute scenarios reach `completed` under the NEW
// fail-closed contract (every target now performs an independent,
// tenant-scoped read-back before completing — the stateless `mockDbGet`
// double above can never satisfy that on its own). See the identical
// comment in p08-teresa-service.test.ts for the full "why these tests used
// to pass" explanation: they used to exercise the exact fabrication bug
// this packet closes (`fallbackRef = randomUUID()`), not real success.
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

// Handoff target services are loaded via tryImport (dynamic import with @vite-ignore).
// In test, these may not resolve. The service handles null gracefully via fallback UUIDs.

const {
  createChatProposal,
  createProposal,
  approveProposal,
  executeProposal,
  getProposal,
  getAuditTrail,
  _resetTableCache,
} = await import('../../../services/v8/teresaCopilotService.js');

const { P08_HANDOFF_TARGET_MODULES, P08_ACTION_ENVELOPE_STATES } =
  await import('../../../services/v8/teresaCopilotCanon.js');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG = '00000000-e2e0-4000-8000-000000000001';
const USER = '00000000-e2e0-4000-8000-000000000002';
const SESSION = '00000000-e2e0-4000-8000-000000000003';

function defaultHandoffContext(): Record<string, unknown> {
  return {
    origin: 'teresa',
    user_intent: 'Voice command action',
    active_surface: 'chat/full',
    org_context_ref: `org:${ORG}`,
    bounded_context_pack: [],
    constraints: ['proposal_first'],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: [],
    proposed_next_action: {
      target_module: 'initiatives',
      handoff_intent: 'create',
      requires_approval: true,
    },
    audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
  };
}

function mockProposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id || 'e2e-prop-1',
    organization_id: ORG,
    user_id: USER,
    session_id: SESSION,
    state: 'proposal',
    handoff_context_json: overrides.handoff_context_json || JSON.stringify(defaultHandoffContext()),
    target_module: overrides.target_module || 'initiatives',
    target_payload_json:
      overrides.target_payload_json ||
      JSON.stringify({ initiative_seed: { problem_statement: 'test' }, proposal_only: true }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ changes: 1 });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
  mockLlmCall.mockReset();
  _resetTableCache();
});

// ────────────────────────────────────────────────────────────────
// §E2E-1 — Voice transcript → LLM intent → proposal → approve → execute
// ────────────────────────────────────────────────────────────────

describe('P08-E2E §1 — Full lifecycle: voice → proposal → approve → handoff', () => {
  const voiceScenarios: Array<{
    description: string;
    transcript: string;
    expectedModule: HandoffTargetModule;
    llmResponse: string | null;
  }> = [
    {
      description: 'Polish voice: initiative request (regex path)',
      transcript: 'Przygotuj inicjatywę dla planu transformacji cyfrowej',
      expectedModule: 'initiatives',
      llmResponse: null,
    },
    {
      description: 'Polish voice: radar signal (regex path)',
      transcript: 'Zgłoś problem związany z opóźnieniem dostawy — to incydent krytyczny',
      expectedModule: 'radar',
      llmResponse: null,
    },
    {
      description: 'Polish voice: calendar scheduling (regex path)',
      transcript: 'Zaplanuj spotkanie z zespołem na przyszły piątek',
      expectedModule: 'calendar',
      llmResponse: null,
    },
    {
      description: 'Polish voice: notebook draft (regex path)',
      transcript: 'Zapisz notatkę z ustaleń dzisiejszego spotkania',
      expectedModule: 'notebook',
      llmResponse: null,
    },
    {
      description: 'Ambiguous voice: LLM detects initiative intent',
      transcript: 'Musimy coś zrobić z tym problemem w łańcuchu dostaw na Q3',
      expectedModule: 'initiatives',
      llmResponse: '{"module":"initiatives","intent":"create initiative for supply chain Q3"}',
    },
    {
      description: 'English voice: LLM detects radar intent',
      transcript: 'There is a critical issue with vendor delivery that needs escalation',
      expectedModule: 'radar',
      llmResponse: '{"module":"radar","intent":"escalate vendor delivery issue"}',
    },
  ];

  for (const scenario of voiceScenarios) {
    it(`${scenario.description}: full create → approve → execute`, async () => {
      // Configure LLM mock if this scenario uses the LLM path
      if (scenario.llmResponse) {
        mockLlmCall.mockResolvedValueOnce({ text: scenario.llmResponse });
      }

      // Step 1: Voice transcript → createChatProposal (simulates SSE handler)
      const chatProposal = await createChatProposal({
        organizationId: ORG,
        userId: USER,
        sessionId: SESSION,
        userMessage: scenario.transcript,
        assistantMessage: 'Teresa przetworzyła Twoje polecenie głosowe.',
        context: {
          workspaceContext: { projectId: 'proj-e2e', type: 'project' },
          screenContext: { currentScreen: 'dashboard' },
        },
        citations: [],
      });

      expect(chatProposal).not.toBeNull();
      expect(chatProposal!.targetModule).toBe(scenario.expectedModule);
      expect(chatProposal!.state).toBe('proposal');
      expect(chatProposal!.allowedActions).toContain('approve');
      expect(chatProposal!.allowedActions).toContain('reject');

      // Step 2: User approves via voice command "zatwierdź" or button click
      const hcJson = JSON.stringify(chatProposal!.handoffContext || defaultHandoffContext());
      const tpJson = JSON.stringify(chatProposal!.targetPayload || { proposal_only: true });
      const approveRow = mockProposalRow({
        id: chatProposal!.proposalId,
        state: 'proposal',
        target_module: scenario.expectedModule,
        handoff_context_json: hcJson,
        target_payload_json: tpJson,
      });
      mockDbGet
        .mockResolvedValueOnce(approveRow)
        .mockResolvedValueOnce({ ...approveRow, state: 'approved' });
      mockDbAll.mockResolvedValue([]);

      const approved = await approveProposal({
        proposalId: chatProposal!.proposalId,
        organizationId: ORG,
        userId: USER,
      });

      expect(approved.state).toBe('approved');
      expect(approved.id).toBe(chatProposal!.proposalId);

      // Step 3: Execute → handoff to target module
      const execRow = {
        ...approveRow,
        state: 'approved',
      };
      mockDbGet.mockResolvedValueOnce(execRow);

      const handoffResult = await executeProposal({
        proposalId: chatProposal!.proposalId,
        organizationId: ORG,
        userId: USER,
      });

      expect(handoffResult.success).toBe(true);
      expect(handoffResult.state).toBe('completed');
      expect(handoffResult.target_module).toBe(scenario.expectedModule);
      expect(handoffResult.audit_entry_id).toBeTruthy();

      // Verify DB writes happened (CREATE TABLE + proposal insert + audit inserts + state updates)
      const insertCalls = mockDbRun.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO teresa_proposals')
      );
      expect(insertCalls.length).toBeGreaterThanOrEqual(1);

      const auditCalls = mockDbRun.mock.calls.filter(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO teresa_audit_log')
      );
      expect(auditCalls.length).toBeGreaterThanOrEqual(1);
    });
  }
});

// ────────────────────────────────────────────────────────────────
// §E2E-2 — Voice reject flow
// ────────────────────────────────────────────────────────────────

describe('P08-E2E §2 — Voice rejection: voice → proposal → reject', () => {
  it('creates proposal from voice, then user rejects via "odrzuć"', async () => {
    const chatProposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Utwórz inicjatywę na temat redukcji kosztów',
      assistantMessage: 'Proponuję utworzyć inicjatywę redukcji kosztów.',
      context: {},
      citations: [],
    });

    expect(chatProposal).not.toBeNull();
    expect(chatProposal!.targetModule).toBe('initiatives');

    // Import rejectProposal
    const { rejectProposal } = await import('../../../services/v8/teresaCopilotService.js');

    const rejectRow = mockProposalRow({
      id: chatProposal!.proposalId,
      state: 'proposal',
      target_module: 'initiatives',
    });
    mockDbGet
      .mockResolvedValueOnce(rejectRow)
      .mockResolvedValueOnce({ ...rejectRow, state: 'rejected' });
    mockDbAll.mockResolvedValue([]);

    const rejected = await rejectProposal({
      proposalId: chatProposal!.proposalId,
      organizationId: ORG,
      userId: USER,
      reason: 'Użytkownik powiedział: odrzuć propozycję',
    });

    expect(rejected.state).toBe('rejected');
  });
});

// ────────────────────────────────────────────────────────────────
// §E2E-3 — LLM fallback to regex when LLM fails
// ────────────────────────────────────────────────────────────────

describe('P08-E2E §3 — LLM failure graceful degradation', () => {
  it('falls back to regex when LLM throws an error', async () => {
    mockLlmCall.mockRejectedValueOnce(new Error('LLM service unavailable'));

    const chatProposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Utwórz notatkę z podsumowaniem kwartalnym',
      assistantMessage: 'Przygotowuję notatkę.',
      context: {},
      citations: [],
    });

    expect(chatProposal).not.toBeNull();
    expect(chatProposal!.targetModule).toBe('notebook');
  });

  it('falls back to regex when LLM returns invalid JSON', async () => {
    mockLlmCall.mockResolvedValueOnce({ text: 'I cannot determine intent' });

    const chatProposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Zaplanuj spotkanie z klientem',
      assistantMessage: 'Planuję spotkanie.',
      context: {},
      citations: [],
    });

    expect(chatProposal).not.toBeNull();
    expect(chatProposal!.targetModule).toBe('calendar');
  });
});

// ────────────────────────────────────────────────────────────────
// §E2E-4 — LLM detects intent where regex cannot
// ────────────────────────────────────────────────────────────────

describe('P08-E2E §4 — LLM captures ambiguous intents regex misses', () => {
  it('LLM identifies notebook intent from indirect phrasing', async () => {
    mockLlmCall.mockResolvedValueOnce({
      text: '{"module":"notebook","intent":"capture meeting summary as draft"}',
    });

    const chatProposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Chciałbym zachować najważniejsze wnioski z dzisiejszej dyskusji',
      assistantMessage: 'Rozumiem, zapiszę kluczowe wnioski.',
      context: {},
      citations: [],
    });

    expect(chatProposal).not.toBeNull();
    expect(chatProposal!.targetModule).toBe('notebook');
    expect(mockLlmCall).toHaveBeenCalledTimes(1);
  });

  it('LLM identifies calendar intent from conversational phrasing', async () => {
    mockLlmCall.mockResolvedValueOnce({
      text: '{"module":"calendar","intent":"schedule follow-up next week"}',
    });

    const chatProposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Powinniśmy się zobaczyć w przyszłym tygodniu żeby to omówić',
      assistantMessage: 'Mogę to zaplanować.',
      context: {},
      citations: [],
    });

    expect(chatProposal).not.toBeNull();
    expect(chatProposal!.targetModule).toBe('calendar');
  });

  it('returns null when both regex and LLM find no actionable intent', async () => {
    mockLlmCall.mockResolvedValueOnce({ text: '{"module":null,"intent":"none"}' });

    const chatProposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Dziękuję za informację, to wszystko jasne',
      assistantMessage: 'Cieszę się, że mogłam pomóc.',
      context: {},
      citations: [],
    });

    expect(chatProposal).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────
// §E2E-5 — DB table auto-creation verification
// ────────────────────────────────────────────────────────────────

describe('P08-E2E §5 — DB table auto-creation', () => {
  it('calls CREATE TABLE IF NOT EXISTS for all 3 Teresa tables on first operation', async () => {
    const chatProposal = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Mamy problem z dostawami — to bloker dla projektu',
      assistantMessage: 'Tworzę alert w radarze.',
      context: {},
      citations: [],
    });

    expect(chatProposal).not.toBeNull();

    const createTableCalls = mockDbRun.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('CREATE TABLE IF NOT EXISTS')
    );

    const tableNames = createTableCalls.map((c) => {
      const match = (c[0] as string).match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      return match?.[1];
    });

    expect(tableNames).toContain('teresa_proposals');
    expect(tableNames).toContain('teresa_audit_log');
    expect(tableNames).toContain('teresa_handoff_results');
  });

  it('creates indices for performance', async () => {
    await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Zaplanuj spotkanie na poniedziałek',
      assistantMessage: 'Planuję spotkanie.',
      context: {},
      citations: [],
    });

    const indexCalls = mockDbRun.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('CREATE INDEX IF NOT EXISTS')
    );

    expect(indexCalls.length).toBeGreaterThanOrEqual(2);
  });
});

// ────────────────────────────────────────────────────────────────
// §E2E-6 — Anti-duplicate during voice session
// ────────────────────────────────────────────────────────────────

describe('P08-E2E §6 — Anti-duplicate: second voice command cancels first', () => {
  it('auto-cancels previous active proposal when new voice command arrives', async () => {
    // First voice command creates a proposal
    const first = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Utwórz inicjatywę dla nowego produktu',
      assistantMessage: 'Tworzę inicjatywę.',
      context: {},
      citations: [],
    });
    expect(first).not.toBeNull();

    // Simulate that there is now an active proposal in the session
    mockDbGet.mockResolvedValueOnce(
      mockProposalRow({
        id: first!.proposalId,
        state: 'proposal',
        target_module: 'initiatives',
      })
    );

    // Second voice command — should cancel the first
    const second = await createChatProposal({
      organizationId: ORG,
      userId: USER,
      sessionId: SESSION,
      userMessage: 'Nie, jednak dodaj notatkę z pomysłem',
      assistantMessage: 'Zmieniam na notatkę.',
      context: {},
      citations: [],
    });
    expect(second).not.toBeNull();
    expect(second!.targetModule).toBe('notebook');

    // Verify the old proposal was rejected (UPDATE SET state = 'rejected')
    const rejectCalls = mockDbRun.mock.calls.filter(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('UPDATE teresa_proposals SET state') &&
        c[0].includes('rejected')
    );
    expect(rejectCalls.length).toBeGreaterThanOrEqual(1);
  });
});
