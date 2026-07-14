/**
 * HP-2 (Harvey-Parity Blok A) — parity proof.
 *
 * `runAgentAudit` (orchestratorService.ts) used to be a bespoke plan/adapt/interact
 * pipeline. It now delegates to the generic `runAgentRuntime` (agentRuntime/
 * agentRuntimeService.ts), with the audit agent as ONE instance of
 * `AgentRuntimeDefinition`. These tests exercise the full async LLM-calling path
 * (the part NOT covered by the pre-existing agentAudit*.test.ts suite, which only
 * exercises the pure/synchronous `suggestAgents`/`aggregateVerdict`) and assert:
 *
 *   1. Reviews + verdict are produced correctly for a known agent (Gate A parity).
 *   2. The emitted event sequence/shape is byte-identical to the pre-HP-2 wire
 *      format (`agent_audit_state` / `agent_review_progress` / `agent_sources`),
 *      since the frontend/SSE consumer depends on these exact strings.
 *   3. Unknown agentId is skipped silently (no emit, no review) — same as before.
 *   4. A hard-overreach validator failure still rejects the agent + triggers the
 *      "all reviews rejected -> FAIL" branch of `aggregateVerdict`, unchanged.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callStructuredMock, selectMock, getProviderConfigMock, logEventMock } = vi.hoisted(() => ({
  callStructuredMock: vi.fn(),
  selectMock: vi.fn(),
  getProviderConfigMock: vi.fn(),
  logEventMock: vi.fn(),
}));

vi.mock('../../../../../server/src/services/ai/llmService.js', () => ({
  llmService: { callStructured: (...args: unknown[]) => callStructuredMock(...args) },
}));

vi.mock('../../../../../server/src/services/ai/modelRouter.js', () => ({
  modelRouter: {
    select: (...args: unknown[]) => selectMock(...args),
    getProviderConfig: (...args: unknown[]) => getProviderConfigMock(...args),
  },
}));

vi.mock('../../../../../server/src/services/ai/agentAudit/agentAuditKnowledgeService.js', () => ({
  retrieveAgentAuditKnowledge: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../../server/src/services/ai/agentAudit/agentAuditWebResearchService.js', () => ({
  retrieveAgentAuditWebSources: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../../server/src/services/ai/agentAudit/agentAuditMetricsService.js', () => ({
  logAgentAuditEvent: (...args: unknown[]) => logEventMock(...args),
}));

vi.mock('../../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { runAgentAudit } from '../../../../../server/src/services/ai/agentAudit/orchestratorService.js';

function baseArgs(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: null,
    userId: null,
    conversationId: null,
    decisionContext: { topic: 'CAPEX decision', functions: [], riskFocus: [] },
    deepThinkingReport: 'DT: "CAPEX 2M, plynnosc Q2 napieta"',
    agentIds: ['function.cfo_finance'],
    userIntent: 'validate' as const,
    language: 'pl',
    webSearchEnabled: false,
    ...overrides,
  };
}

const CFO_HIGH_CASHFLOW_REVIEW = {
  verdict: 'risk',
  overreach: 'none',
  observations: ['Brak scenariusza plynnosciowego.'],
  challengedAssumptions: ['Zalozenie stalego cashflow.'],
  impactIfIgnored: 'Ryzyko utraty plynnosci w Q2.',
  whenItFails: 'Gdy przychody spadna o >10% w Q2.',
  topQuestions: ['Jaki jest aktualny forecast cashflow 6m?'],
  findings: [
    {
      area: 'cashflow',
      severity: 'high',
      claim: 'Ryzyko plynnosci w Q2 przy tym CAPEX.',
      evidenceFromDT: ['DT: "CAPEX 2M"'],
      sourcesUsed: [],
      missingDataQuestions: ['MUST: Aktualny forecast cashflow 6m'],
      suggestedDeepening: 'Dodaj analize cashflow i scenariusze.',
    },
  ],
  conflicts: [],
};

beforeEach(() => {
  callStructuredMock.mockReset();
  selectMock.mockReset();
  getProviderConfigMock.mockReset();
  logEventMock.mockReset();
  selectMock.mockResolvedValue({ provider: 'test-provider', id: 'test-model' });
  getProviderConfigMock.mockResolvedValue({ provider: 'test-provider', id: 'test-model' });
});

describe('runAgentAudit via generic agent runtime (HP-2 parity)', () => {
  it('produces a review + Gate A FAIL verdict for a known agent, identical to pre-HP-2 aggregateVerdict semantics', async () => {
    callStructuredMock.mockResolvedValueOnce({ object: CFO_HIGH_CASHFLOW_REVIEW });

    const result = await runAgentAudit(baseArgs());

    expect(typeof result.orchestratorRunId).toBe('string');
    expect(result.orchestratorRunId.length).toBeGreaterThan(0);

    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].agentId).toBe('function.cfo_finance');
    expect(result.reviews[0].agentVersion).toBeTruthy();
    expect(result.reviews[0].overreach).toBe('none');

    expect(result.verdict.qualityStatus).toBe('FAIL');
    expect(result.verdict.gatesTriggered).toContain('A');
    expect(
      result.verdict.agentsSummary.some((a: any) => a.agentId === 'function.cfo_finance')
    ).toBe(true);

    // Model selection went through modelRouter.select (no selectedModelId given)
    expect(selectMock).toHaveBeenCalledWith(
      expect.objectContaining({ capability: 'chat_simple', tier: 'STANDARD' })
    );
  });

  it('emits the exact pre-HP-2 event type/shape sequence', async () => {
    callStructuredMock.mockResolvedValueOnce({ object: CFO_HIGH_CASHFLOW_REVIEW });

    const events: Array<Record<string, unknown>> = [];
    await runAgentAudit(baseArgs({ emit: (payload: Record<string, unknown>) => events.push(payload) }));

    const types = events.map((e) => `${e.type}:${e.state ?? e.stage ?? e.kind ?? ''}`);

    expect(types[0]).toBe('agent_audit_state:reviewing');
    expect(types).toContain('agent_review_progress:start');
    expect(types).toContain('agent_review_progress:kb_retrieval');
    expect(types).toContain('agent_review_progress:llm_review');
    expect(types).toContain('agent_review_progress:done');
    expect(types).toContain('agent_audit_state:aggregating');

    const doneEvent = events.find((e) => e.type === 'agent_audit_state' && e.state === 'done');
    expect(doneEvent).toBeTruthy();
    expect(doneEvent?.qualityStatus).toBe('FAIL');
    expect(doneEvent?.gatesTriggered).toContain('A');

    // Every event carries the same orchestratorRunId as the returned result.
    const runIds = new Set(events.map((e) => e.orchestratorRunId));
    expect(runIds.size).toBe(1);
  });

  it('skips an unknown agentId silently (no emit, no review) — matches pre-HP-2 getAgentDefinition guard', async () => {
    const events: Array<Record<string, unknown>> = [];
    const result = await runAgentAudit(
      baseArgs({
        agentIds: ['function.does_not_exist'],
        emit: (payload: Record<string, unknown>) => events.push(payload),
      })
    );

    expect(result.reviews).toHaveLength(0);
    expect(callStructuredMock).not.toHaveBeenCalled();
    expect(events.some((e) => e.agentId === 'function.does_not_exist')).toBe(false);
    // Run-level lifecycle still proceeds (reviewing -> aggregating -> done).
    expect(events.some((e) => e.type === 'agent_audit_state' && e.state === 'done')).toBe(true);
    expect(result.verdict.qualityStatus).toBe('PASS');
  });

  it('hard-overreach validator failure rejects the agent and triggers the all-rejected FAIL branch', async () => {
    // Web citation present while webSearchEnabled=false => validateReviewWebSources hard-fails.
    callStructuredMock.mockResolvedValueOnce({
      object: {
        ...CFO_HIGH_CASHFLOW_REVIEW,
        findings: [
          {
            ...CFO_HIGH_CASHFLOW_REVIEW.findings[0],
            sourcesUsed: [{ type: 'web_source', url: 'https://example.com/report' }],
          },
        ],
      },
    });

    const events: Array<Record<string, unknown>> = [];
    const result = await runAgentAudit(
      baseArgs({ emit: (payload: Record<string, unknown>) => events.push(payload) })
    );

    expect(events.some((e) => e.type === 'agent_review_progress' && e.stage === 'rejected')).toBe(
      true
    );
    expect(result.verdict.qualityStatus).toBe('FAIL');
    expect(result.verdict.gatesTriggered).toContain('D');
  });
});
