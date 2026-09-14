import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = new NodeURL('../../../../', import.meta.url);
const coverage = JSON.parse(
  readFileSync(new NodeURL('evidence/f2-2-realizacja/audit/coverage-29-initial.json', root), 'utf8')
) as {
  counts: { total: number; exists: number; partial: number; missing: number };
  items: Array<{ thought: number; status: string }>;
};
const flags = readFileSync(
  new NodeURL('src/components/Execution/executionFeatureFlags.ts', root),
  'utf8'
);
const bank = readFileSync(
  new NodeURL('src/components/Execution/executionBankModel.ts', root),
  'utf8'
);

describe('F2-2 initial RED contract', () => {
  it('keeps the complete 29/29 owner-thought denominator', () => {
    expect(coverage.counts.total).toBe(29);
    expect(coverage.items).toHaveLength(29);
    expect(new Set(coverage.items.map((item) => item.thought)).size).toBe(29);
  });

  it('is RED until every mapped thought is delivered', () => {
    expect(coverage.items.filter((item) => item.status !== 'COMPLETE')).toEqual([]);
  });

  it('requires the new stage flag to exist and stay explicit', () => {
    expect(flags).toContain('VITE_EXECUTION_FOUR_BUTTONS');
  });

  it('requires Bank filters for project, priority, time window and measured signal', () => {
    const filter = bank.slice(
      bank.indexOf('export interface ExecutionBankFilter'),
      bank.indexOf('export interface ExecutionCalendarBucket')
    );
    expect(filter).toContain('projectIds');
    expect(filter).toContain('priorities');
    expect(filter).toContain('timeWindow');
    expect(filter).toContain('riskSignalLevels');
  });
});
