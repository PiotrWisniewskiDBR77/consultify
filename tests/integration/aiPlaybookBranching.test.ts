import { describe, expect, it } from 'vitest';

import { PlaybookExecutor } from '../../server/src/ai/actionExecutors/playbookExecutor.ts';

describe('AI Playbook Branching (PlaybookExecutor) - REAL_CODE', () => {
  it('execute returns completed result for empty steps', async () => {
    const res = await PlaybookExecutor.execute({ name: 'Empty', steps: [] });
    expect(res.success).toBe(true);
    expect(res.stepsTotal).toBe(0);
    expect((res.result as any)?.status).toBe('completed');
  });

  it('execute supports condition onSuccess jump', async () => {
    const res = await PlaybookExecutor.execute({
      name: 'Branch',
      steps: [
        { id: 'a', type: 'condition', name: 'Cond', config: { expression: 'x' }, onSuccess: 'c' },
        { id: 'b', type: 'create_entity', name: 'Skipped', config: { entityType: 'x', data: {} } },
        { id: 'c', type: 'create_entity', name: 'Taken', config: { entityType: 'y', data: {} } },
      ],
    });
    expect(res.success).toBe(true);
    const steps = (res.result as any).steps as any[];
    expect(steps.map((s) => s.stepId)).toEqual(['a', 'c']);
  });

  it('execute uses onFailure fallback and can still succeed', async () => {
    const res = await PlaybookExecutor.execute({
      name: 'Fallback',
      steps: [
        { id: 'bad', type: 'unknown' as any, name: 'Bad', config: {}, onFailure: 'cleanup' },
        { id: 'x', type: 'create_entity', name: 'Skipped', config: { entityType: 'x', data: {} } },
        {
          id: 'cleanup',
          type: 'create_entity',
          name: 'Cleanup',
          config: { entityType: 'c', data: {} },
        },
      ],
    });
    expect(res.success).toBe(true);
    const steps = (res.result as any).steps as any[];
    expect(steps.some((s) => s.stepId === 'bad' && s.success === false)).toBe(true);
    expect(steps.some((s) => s.stepId === 'cleanup' && s.success === true)).toBe(true);
  });

  it('execute stops on failure without onFailure fallback', async () => {
    const res = await PlaybookExecutor.execute({
      name: 'Stop',
      steps: [{ id: 'bad', type: 'unknown' as any, name: 'Bad', config: {} }],
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Unknown step type');
  });

  it('dryRun returns step summary without execution', async () => {
    const res = await PlaybookExecutor.dryRun({
      playbook_id: 'p1',
      name: 'Dry',
      steps: [{ id: 'n1', type: 'notify', name: 'N', config: {} }],
    });
    expect(res.success).toBe(true);
    expect((res.result as any).stepsCount).toBe(1);
    expect((res.result as any).steps[0]).toEqual(
      expect.objectContaining({ id: 'n1', type: 'notify', hasFailureFallback: false })
    );
  });
});
