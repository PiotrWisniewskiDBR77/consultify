import { aiInputHash } from '../../../domain/initiatives-execution/aiEvidenceGovernance.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SignalQuery } from '../../../types/workSignals.js';
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
