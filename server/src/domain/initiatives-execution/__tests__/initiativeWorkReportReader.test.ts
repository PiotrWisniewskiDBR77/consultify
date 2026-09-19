/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { PostgresInitiativeReader } from '../postgresInitiativeReader.js';

// Wpis 50 part D (DEC-605): the work-report reader must count decisions from the
// RELATIONAL `decisions` table (the source E4 uses), not `ie_aggregate_state`.
// Restoring the aggregate query turns these red: the SQL assertion below and the
// `decision_maker_id` grouping both only hold for the relational source.
const DECISION_SQL_MARKERS = [
  'FROM decisions',
  'd.organization_id=$1',
  'd.project_id=ANY($2::text[])',
  'NOT IN',
  'returned_for_clarification',
];

describe('initiative work report reader', () => {
  it('reads decisions from the relational table and groups open debt by decision maker', async () => {
    // D-45: the reader now issues TWO extra batched, tenant-scoped name lookups
    // (projects, users) after the aggregate/decisions pair, so a positional stub
    // stops answering. Route by SQL instead of by call order.
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM projects')) {
        return { rows: (params[1] as string[]).map((id) => ({ id, name: 'Plant Program' })) };
      }
      if (sql.includes('FROM users')) {
        return { rows: (params[1] as string[]).map((id) => ({ id, name: 'Lena Meyer' })) };
      }
      if (sql.includes('FROM decisions')) {
        return {
          rows: [
            {
              id: 'decision-1',
              deadline: new Date('2020-01-01T00:00:00.000Z'),
              decision_maker_id: 'manager-1',
              authority_name: 'Manager One',
            },
          ],
        };
      }
      return {
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
      };
    });
    const reader = new PostgresInitiativeReader({ query } as never);

    const result = await reader.buildInitiativeWorkReport('org-1', {
      title: 'Weekly work',
      templateId: 'WEEKLY_TEAM_UPDATE',
      projectIds: ['project-1'],
    });

    expect(query).toHaveBeenCalledTimes(4);
    // Every single query stays tenant-scoped — including the two name lookups.
    expect(query.mock.calls.every((call) => call[1][0] === 'org-1')).toBe(true);
    const scopedCalls = query.mock.calls.filter(
      (call) => !(call[0] as string).includes('FROM projects') && !(call[0] as string).includes('FROM users')
    );
    expect(scopedCalls.every((call) => call[1][1][0] === 'project-1')).toBe(true);
    // Initiatives still come from the aggregate store; decisions from `decisions`.
    expect(query.mock.calls[0][0]).toContain("aggregate_type='initiative'");
    const decisionSql = query.mock.calls[1][0] as string;
    for (const marker of DECISION_SQL_MARKERS) expect(decisionSql).toContain(marker);
    expect(decisionSql).not.toContain('ie_aggregate_state');
    // D-45: names resolved once per batch, keyed by id list, tenant-scoped.
    const projectCall = query.mock.calls.find((call) => (call[0] as string).includes('FROM projects'))!;
    const ownerCall = query.mock.calls.find((call) => (call[0] as string).includes('FROM users'))!;
    expect(projectCall[1][1]).toEqual(['project-1']);
    expect(ownerCall[1][1]).toEqual(['owner-1']);
    expect(result.content.initiatives[0]).toMatchObject({
      status: 'IN_EXECUTION',
      projectName: 'Plant Program',
      ownerName: 'Lena Meyer',
    });

    expect(result.content.summary).toMatchObject({
      initiatives: 1,
      pendingDecisions: 1,
      overdueDecisions: 1,
    });
    expect(result.content.decisionDebtors).toEqual([
      {
        authorityId: 'manager-1',
        authorityName: 'Manager One',
        pending: 1,
        overdue: 1,
        oldestDueAt: '2020-01-01T00:00:00.000Z',
      },
    ]);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[1]).toMatchObject({
      sourceType: 'decision',
      sourceId: 'decision-1',
      version: 1,
    });
  });

  it('groups multiple decisions per maker, counts only past deadlines overdue, keeps the oldest', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'd-1',
            deadline: new Date('2020-01-01T00:00:00.000Z'),
            decision_maker_id: 'manager-1',
            authority_name: 'Manager One',
          },
          {
            id: 'd-2',
            deadline: new Date('2999-01-01T00:00:00.000Z'),
            decision_maker_id: 'manager-1',
            authority_name: 'Manager One',
          },
          {
            id: 'd-3',
            deadline: new Date('2021-01-01T00:00:00.000Z'),
            decision_maker_id: 'manager-2',
            authority_name: 'Manager Two',
          },
        ],
      });
    const reader = new PostgresInitiativeReader({ query } as never);

    const result = await reader.buildInitiativeWorkReport('org-1', {
      title: 'Backlog',
      templateId: 'DECISION_BACKLOG',
      projectIds: [],
    });

    expect(result.content.summary.pendingDecisions).toBe(3);
    expect(result.content.summary.overdueDecisions).toBe(2);
    // Sorted by overdue desc, then pending desc → manager-1 (2 pending) first.
    expect(result.content.decisionDebtors).toEqual([
      {
        authorityId: 'manager-1',
        authorityName: 'Manager One',
        pending: 2,
        overdue: 1,
        oldestDueAt: '2020-01-01T00:00:00.000Z',
      },
      {
        authorityId: 'manager-2',
        authorityName: 'Manager Two',
        pending: 1,
        overdue: 1,
        oldestDueAt: '2021-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('falls back to UNASSIGNED and treats a null deadline as not overdue', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 'd-x', deadline: null, decision_maker_id: null, authority_name: null }],
      });
    const reader = new PostgresInitiativeReader({ query } as never);

    const result = await reader.buildInitiativeWorkReport('org-1', {
      title: 'Backlog',
      templateId: 'DECISION_BACKLOG',
      projectIds: [],
    });

    expect(result.content.summary).toMatchObject({ pendingDecisions: 1, overdueDecisions: 0 });
    expect(result.content.decisionDebtors).toEqual([
      {
        authorityId: 'UNASSIGNED',
        authorityName: 'UNASSIGNED',
        pending: 1,
        overdue: 0,
        oldestDueAt: null,
      },
    ]);
  });
});
