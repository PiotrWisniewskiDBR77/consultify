import { describe, expect, it } from 'vitest';
import { deriveExecutionHealth } from '../../../server/src/domain/initiatives-execution/executionHealth';

describe('canonical Execution health', () => {
  it('uses explicit blocked reasons before risk and healthy states', () => {
    expect(
      deriveExecutionHealth({
        state: 'ACTIVE',
        handoffPackageId: 'h',
        handoffPackageVersion: 1,
        rollup: { tasksBlocked: 1 },
      })
    ).toEqual({ status: 'BLOCKED', reasons: ['TASKS_BLOCKED'] });
    expect(
      deriveExecutionHealth({
        state: 'ACTIVE',
        handoffPackageId: 'h',
        handoffPackageVersion: 1,
        gaps: [{ status: 'OPEN' }],
      })
    ).toEqual({ status: 'BLOCKED', reasons: ['HANDOFF_GAPS_OPEN'] });
  });
  it('distinguishes missing baseline, healthy and unknown', () => {
    expect(deriveExecutionHealth({ state: 'ACTIVE' }).status).toBe('AT_RISK');
    expect(
      deriveExecutionHealth({ state: 'ACTIVE', handoffPackageId: 'h', handoffPackageVersion: 1 })
        .status
    ).toBe('HEALTHY');
    expect(deriveExecutionHealth({}).status).toBe('UNKNOWN');
  });
});
