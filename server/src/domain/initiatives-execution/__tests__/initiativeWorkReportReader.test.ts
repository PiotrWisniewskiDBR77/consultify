/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { PostgresInitiativeReader } from '../postgresInitiativeReader.js';

describe('initiative work report reader', () => {
  it('uses tenant/project predicates and groups pending decision debt by authority', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            aggregate_id: 'initiative-1',
            version: 7,
            payload_json: {
              title: 'Plant rollout',
              status: 'IN_EXECUTION',
              projectId: 'project-1',
              ownerId: 'owner-1',
            },
            updated_at: '2026-09-14T10:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            aggregate_id: 'decision-1',
            version: 3,
            payload_json: {
              authorityId: 'manager-1',
              status: 'PENDING',
              dueAt: '2020-01-01T00:00:00.000Z',
              projectId: 'project-1',
            },
            authority_name: 'Manager One',
            updated_at: '2026-09-14T10:00:00.000Z',
          },
        ],
      });
    const reader = new PostgresInitiativeReader({ query } as never);

    const result = await reader.buildInitiativeWorkReport('org-1', {
      title: 'Weekly work',
      templateId: 'WEEKLY_TEAM_UPDATE',
      projectIds: ['project-1'],
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.every((call) => call[1][0] === 'org-1')).toBe(true);
    expect(query.mock.calls.every((call) => call[1][1][0] === 'project-1')).toBe(true);
    expect(result.content.summary).toMatchObject({
      initiatives: 1,
      pendingDecisions: 1,
      overdueDecisions: 1,
    });
    expect(result.content.decisionDebtors).toEqual([
      expect.objectContaining({ authorityId: 'manager-1', pending: 1, overdue: 1 }),
    ]);
    expect(result.sources).toHaveLength(2);
  });
});
