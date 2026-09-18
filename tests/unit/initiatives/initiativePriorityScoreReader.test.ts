import { describe, expect, it, vi } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';

describe('DEC-537 initiative priority score reader', () => {
  it('uses priorityScore in the keyset sort and exposes score/source on list rows', async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => ({
      rows: [
        {
          aggregate_id: 'initiative-high',
          version: 3,
          payload_json: {
            initiativeId: 'initiative-high',
            lifecycleState: 'ANALYZING',
            title: 'High score',
            problem: 'p',
            proposedOutcome: null,
            priority: 'high',
            projectId: 'project-a',
            initiativeOwnerId: 'owner-a',
            visibility: 'PROJECT',
            readiness: 'NOT_EVALUATED',
          },
          updated_at: '2026-09-18T10:00:00.000Z',
          priority_order: 1,
          priority_score: null,
          priority_source: null,
          priority_override_reason: null,
          sort_priority_score: 100,
        },
      ],
    }));
    const reader = new PostgresInitiativeReader({ query } as any);

    const page = await reader.listInitiativesPage(
      'org-a',
      10,
      { priorityScore: 75, updatedAt: '2026-09-18T09:00:00.000Z', aggregateId: 'cursor-a' }
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY sort_priority_score DESC, s.updated_at DESC, s.aggregate_id DESC'),
      ['org-a', 75, '2026-09-18T09:00:00.000Z', 'cursor-a', 11]
    );
    expect(page.initiatives[0].initiative.priority).toBe('HIGH');
    expect(page.initiatives[0].initiative.priorityScore).toBe(100);
    expect(page.initiatives[0].initiative.prioritySource).toBe('PRIORITY_ORDER');
  });
});
