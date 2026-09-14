import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = new NodeURL('../../../../', import.meta.url);
const audit = readFileSync(
  new NodeURL('docs/program/FALA2/F2_2_E0_E1_AUDIT_20260913.md', root),
  'utf8'
);
const checkpoint = readFileSync(
  new NodeURL('docs/program/FALA2/F2_2_E0_E1_CHECKPOINT_20260913.md', root),
  'utf8'
);
const flags = readFileSync(
  new NodeURL('src/components/Execution/executionFeatureFlags.ts', root),
  'utf8'
);
const bank = readFileSync(
  new NodeURL('src/components/Execution/executionBankModel.ts', root),
  'utf8'
);

describe('F2-2 entry contract', () => {
  it('keeps the complete 29/29 owner-thought denominator and an honest checkpoint', () => {
    expect(audit).toContain('29/29 myśli sklasyfikowano');
    const counts = checkpoint.match(/(\d+) COMPLETE · (\d+) PARTIAL · (\d+) MISSING/);
    expect(counts).not.toBeNull();
    const [, complete, partial, missing] = counts!.map(Number);
    expect(complete + partial + missing).toBe(29);
    expect(partial + missing).toBeGreaterThan(0);
  });

  it('requires the new stage flag to exist and stay explicit', () => {
    expect(flags).toContain('VITE_EXECUTION_FOUR_BUTTONS');
  });

  it('requires Bank filters for project, priority, time window and measured health', () => {
    const filter = bank.slice(
      bank.indexOf('export interface ExecutionBankFilter'),
      bank.indexOf('export interface ExecutionCalendarBucket')
    );
    expect(filter).toContain('projectIds');
    expect(filter).toContain('priorities');
    expect(filter).toContain('timeWindow');
    expect(filter).toContain('health');
    expect(filter).toContain('dataIssues');
  });
});
