import { aiInputHash } from '../../../domain/initiatives-execution/aiEvidenceGovernance.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SignalQuery } from '../../../types/workSignals.js';

// FIX-1 (day18 layer-1 acceptance): every test in this file used to inject
// its own `dependencies.generate`, so the PRODUCTION wiring
// (`defaultDependencies` inside signalInterpreter.ts, which calls the real
// `llmService.generateResponse` and parses `output.content` as JSON) was
// never exercised by any test. That is exactly how the bug shipped: the code
// read a field (`output.proposals`) that llmService never returns, and
// `Array.isArray(undefined)` silently produced `[]` every time. These three
// mocks let a dedicated describe block below call
// `runInterpretationForOrganization` WITHOUT a `dependencies` override, so
// the real `defaultDependencies.generate` (and therefore the new
// `parseInterpretedProposals`) actually runs.
const { mockGenerateResponse, mockGetDefaultProvider, mockCheckBudget } = vi.hoisted(() => ({
  mockGenerateResponse: vi.fn(),
  mockGetDefaultProvider: vi.fn(),
  mockCheckBudget: vi.fn(),
}));

vi.mock('../../ai/llmService.js', () => ({
  llmService: { generateResponse: mockGenerateResponse },
}));
vi.mock('../../ai/llmConfigService.js', () => ({
  llmConfigService: { getDefaultProvider: mockGetDefaultProvider },
}));
vi.mock('../../aiBudgetService.js', () => ({
  default: { checkBudget: mockCheckBudget },
}));

import {
  runInterpretationForOrganization,
  type InterpretedProposal,
  type InterpreterInputSignal,
  validateInterpretedProvenance,
} from '../signalInterpreter.js';

const inputRows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    signal_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    signal_type: 'task_overdue',
    severity: 'warning',
    subject_type: 'task',
    subject_id: `task-${index}`,
    evidence: [{ observedValue: index }],
    first_observed_at: '2026-08-26T00:00:00Z',
  }));

const proposal = (input: InterpreterInputSignal[], index = 0): InterpretedProposal => ({
  dedupeKey: `interpreted:${index}`,
  severity: 'warning',
  titleKey: 'signals.ai.pattern.title',
  bodyKey: 'signals.ai.pattern.body',
  subjectType: 'task',
  subjectId: input[0].subjectId,
  evidenceRefs: [input[0].signalId, input[1].signalId],
  confidence: 'MEDIUM',
  inputHash: aiInputHash(input),
  model: { provider: 'mock', model: 'budget-model', version: '1' },
  prompt: { promptId: 'signal-pattern', version: '1' },
  template: { templateId: 'signal-pattern', version: '1' },
  action: { kind: 'OPEN_TASK', route: '/tasks/x', params: {}, permission: 'tasks.read' },
});

function harness(rowCount: number) {
  let interpretedInserts = 0;
  const db: SignalQuery = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("origin='DETERMINISTIC'") && sql.includes('ORDER BY'))
        return inputRows(rowCount);
      if (sql.includes("origin = 'DETERMINISTIC'")) {
        return (params.slice(1) as string[]).map((signal_id) => ({ signal_id }));
      }
      if (sql.includes('dedupe_key=?')) return [];
      if (sql.includes('INSERT INTO work_signals')) interpretedInserts += 1;
      return [];
    }),
  };
  return {
    db,
    get inserts() {
      return interpretedInserts;
    },
  };
}

describe('INTERPRETED signal layer', () => {
  afterEach(() => {
    delete process.env.ENABLE_SIGNAL_INTERPRETER;
  });

  it('is fail-closed when the flag is OFF', async () => {
    const h = harness(6);
    const generate = vi.fn();
    const result = await runInterpretationForOrganization({
      organizationId: 'org-a',
      db: h.db,
      dependencies: {
        db: h.db,
        providerAvailable: async () => true,
        budgetAllowed: async () => true,
        generate,
      },
    });
    expect(result.status).toBe('SKIPPED_DISABLED');
    expect(generate).not.toHaveBeenCalled();
    expect(h.inserts).toBe(0);
  });

  it('records SKIPPED_NO_PROVIDER without a substitute signal', async () => {
    process.env.ENABLE_SIGNAL_INTERPRETER = 'true';
    const h = harness(6);
    const generate = vi.fn();
    const result = await runInterpretationForOrganization({
      organizationId: 'org-a',
      db: h.db,
      dependencies: {
        db: h.db,
        providerAvailable: async () => false,
        budgetAllowed: async () => true,
        generate,
      },
    });
    expect(result.status).toBe('SKIPPED_NO_PROVIDER');
    expect(generate).not.toHaveBeenCalled();
    expect(h.inserts).toBe(0);
  });

  it('does not spend for four deterministic signals', async () => {
    process.env.ENABLE_SIGNAL_INTERPRETER = 'true';
    const h = harness(4);
    const generate = vi.fn();
    await runInterpretationForOrganization({
      organizationId: 'org-a',
      db: h.db,
      dependencies: {
        db: h.db,
        providerAvailable: async () => true,
        budgetAllowed: async () => true,
        generate,
      },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('passes only the seven-field privacy contract and caps five proposals at three', async () => {
    process.env.ENABLE_SIGNAL_INTERPRETER = 'true';
    const h = harness(6);
    const generate = vi.fn(async (input: InterpreterInputSignal[]) => {
      expect(Object.keys(input[0]).sort()).toEqual([
        'firstObservedAt',
        'observedValue',
        'severity',
        'signalId',
        'subjectId',
        'subjectType',
        'type',
      ]);
      return Array.from({ length: 5 }, (_, index) => proposal(input, index));
    });
    const result = await runInterpretationForOrganization({
      organizationId: 'org-a',
      db: h.db,
      dependencies: {
        db: h.db,
        providerAvailable: async () => true,
        budgetAllowed: async () => true,
        generate,
      },
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.signalsOpened).toBe(3);
    expect(h.inserts).toBe(3);
  });

  it('does not call the provider when the budget is exhausted', async () => {
    process.env.ENABLE_SIGNAL_INTERPRETER = 'true';
    const h = harness(6);
    const generate = vi.fn();
    const result = await runInterpretationForOrganization({
      organizationId: 'org-a',
      db: h.db,
      dependencies: {
        db: h.db,
        providerAvailable: async () => true,
        budgetAllowed: async () => false,
        generate,
      },
    });
    expect(result.status).toBe('PARTIAL');
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects fewer than two evidence references', async () => {
    const input = inputRows(2).map((row) => ({
      signalId: row.signal_id,
      type: row.signal_type,
      severity: row.severity,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      observedValue: 1,
      firstObservedAt: row.first_observed_at,
    }));
    const h = harness(0);
    await expect(
      validateInterpretedProvenance({
        db: h.db,
        organizationId: 'org-a',
        input,
        proposal: { ...proposal(input), evidenceRefs: [input[0].signalId] },
      })
    ).rejects.toThrow(/provenance/);
  });

  it('rejects UNKNOWN confidence', async () => {
    const input = inputRows(2).map((row) => ({
      signalId: row.signal_id,
      type: row.signal_type,
      severity: row.severity,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      observedValue: 1,
      firstObservedAt: row.first_observed_at,
    }));
    const h = harness(0);
    await expect(
      validateInterpretedProvenance({
        db: h.db,
        organizationId: 'org-a',
        input,
        proposal: { ...proposal(input), confidence: 'UNKNOWN' },
      })
    ).rejects.toThrow(/provenance/);
  });

  it('rejects a cross-org or interpreted evidence reference', async () => {
    const input = inputRows(2).map((row) => ({
      signalId: row.signal_id,
      type: row.signal_type,
      severity: row.severity,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      observedValue: 1,
      firstObservedAt: row.first_observed_at,
    }));
    const db: SignalQuery = { query: vi.fn(async () => [{ signal_id: input[0].signalId }]) };
    await expect(
      validateInterpretedProvenance({
        db,
        organizationId: 'org-a',
        input,
        proposal: proposal(input),
      })
    ).rejects.toThrow(/one tenant/);
  });
});

describe('INTERPRETED signal layer — default production wiring (FIX-1)', () => {
  afterEach(() => {
    delete process.env.ENABLE_SIGNAL_INTERPRETER;
    mockGenerateResponse.mockReset();
    mockGetDefaultProvider.mockReset();
    mockCheckBudget.mockReset();
  });

  it('a valid-JSON model response in `content` produces real proposals with NO injected dependencies', async () => {
    process.env.ENABLE_SIGNAL_INTERPRETER = 'true';
    mockGetDefaultProvider.mockResolvedValue({ id: 'mock-provider' });
    mockCheckBudget.mockResolvedValue({ allowed: true });
    mockGenerateResponse.mockImplementation(async ({ prompt }: { prompt: string }) => {
      // The real defaultDependencies.generate sends
      // `JSON.stringify({ input, inputHash })` as the prompt — read it back
      // out so the returned proposal's evidenceRefs/inputHash are honest,
      // exactly like a real model would echo the supplied signals.
      const { input, inputHash } = JSON.parse(prompt) as {
        input: InterpreterInputSignal[];
        inputHash: string;
      };
      return {
        content: JSON.stringify({
          proposals: [
            {
              dedupeKey: 'interpreted:default-wiring',
              severity: 'warning',
              titleKey: 'signals.ai.pattern.title',
              bodyKey: 'signals.ai.pattern.body',
              subjectType: 'task',
              subjectId: input[0].subjectId,
              evidenceRefs: [input[0].signalId, input[1].signalId],
              confidence: 'MEDIUM',
              inputHash,
              model: { provider: 'mock', model: 'budget-model', version: '1' },
              prompt: { promptId: 'signal-pattern', version: '1' },
              template: { templateId: 'signal-pattern', version: '1' },
              action: { kind: 'OPEN_TASK', route: '/tasks/x', params: {}, permission: 'tasks.read' },
            },
          ],
        }),
        usage: { totalTokens: 42 },
      };
    });
    const h = harness(6);
    const result = await runInterpretationForOrganization({ organizationId: 'org-a', db: h.db });
    expect(mockGenerateResponse).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('OK');
    expect(result.signalsOpened).toBe(1);
    expect(h.inserts).toBe(1);
  });

  it('a non-JSON model response yields PARTIAL with a real error entry, never a silent empty result', async () => {
    process.env.ENABLE_SIGNAL_INTERPRETER = 'true';
    mockGetDefaultProvider.mockResolvedValue({ id: 'mock-provider' });
    mockCheckBudget.mockResolvedValue({ allowed: true });
    mockGenerateResponse.mockResolvedValue({ content: 'this is not json at all' });
    const h = harness(6);
    const result = await runInterpretationForOrganization({ organizationId: 'org-a', db: h.db });
    expect(mockGenerateResponse).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('PARTIAL');
    expect(result.signalsOpened).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(String((result.errors[0] as { message: string }).message)).toMatch(/not valid JSON/i);
    expect(h.inserts).toBe(0);
  });

  it('valid JSON missing the "proposals" array yields PARTIAL, reproducing and closing the original bug (Array.isArray(undefined) -> [])', async () => {
    process.env.ENABLE_SIGNAL_INTERPRETER = 'true';
    mockGetDefaultProvider.mockResolvedValue({ id: 'mock-provider' });
    mockCheckBudget.mockResolvedValue({ allowed: true });
    mockGenerateResponse.mockResolvedValue({
      content: JSON.stringify({ notes: 'model ignored the contract, no proposals key here' }),
    });
    const h = harness(6);
    const result = await runInterpretationForOrganization({ organizationId: 'org-a', db: h.db });
    expect(result.status).toBe('PARTIAL');
    expect(result.errors).toHaveLength(1);
    expect(String((result.errors[0] as { message: string }).message)).toMatch(/proposals/i);
    expect(h.inserts).toBe(0);
  });
});
