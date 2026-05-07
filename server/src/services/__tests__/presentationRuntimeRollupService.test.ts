import { describe, expect, it } from 'vitest';

import {
  buildPresentationRuntimeRollup,
  type PresentationRuntimeEventRow,
} from '../presentationRuntimeRollupService.js';

function row(overrides: Partial<PresentationRuntimeEventRow>): PresentationRuntimeEventRow {
  return {
    id: 'evt_' + Math.random().toString(36).slice(2),
    organization_id: 'org_1',
    deck_id: 'deck_1',
    user_id: 'usr_1',
    event_type: 'agent_edit_proposal_created',
    status: 'proposal',
    scope: 'global',
    metadata_json: '{}',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('presentationRuntimeRollupService', () => {
  it('aggregates totals by type within the window', () => {
    const now = new Date('2026-05-10T12:00:00.000Z');
    const dayMs = 86_400_000;
    const rows: PresentationRuntimeEventRow[] = [
      row({ event_type: 'agent_edit_proposal_created', created_at: new Date(now.getTime() - 1 * dayMs).toISOString() }),
      row({ event_type: 'agent_edit_applied', created_at: new Date(now.getTime() - 2 * dayMs).toISOString() }),
      row({ event_type: 'agent_edit_rejected', created_at: new Date(now.getTime() - 3 * dayMs).toISOString() }),
      row({ event_type: 'agent_edit_noop', created_at: new Date(now.getTime() - 4 * dayMs).toISOString() }),
      row({ event_type: 'export_blocked', created_at: new Date(now.getTime() - 5 * dayMs).toISOString() }),
      row({ event_type: 'agent_edit_proposal_created', created_at: new Date(now.getTime() - 6 * dayMs).toISOString() }),
    ];

    const rollup = buildPresentationRuntimeRollup({ rows, windowDays: 7, now });

    expect(rollup.totals.proposalsCreated).toBe(2);
    expect(rollup.totals.editsApplied).toBe(1);
    expect(rollup.totals.editsRejected).toBe(1);
    expect(rollup.totals.noops).toBe(1);
    expect(rollup.totals.exportsBlocked).toBe(1);
    expect(rollup.totals.total).toBe(6);
    expect(rollup.windowDays).toBe(7);
    expect(rollup.lastActivityAt).toBe(new Date(now.getTime() - 1 * dayMs).toISOString());
    const proposals = rollup.byEventType.find((x) => x.eventType === 'agent_edit_proposal_created');
    expect(proposals?.count).toBe(2);
  });

  it('excludes events outside the window and ignores invalid rows', () => {
    const now = new Date('2026-05-10T12:00:00.000Z');
    const dayMs = 86_400_000;
    const rows: PresentationRuntimeEventRow[] = [
      row({ event_type: 'agent_edit_applied', created_at: new Date(now.getTime() - 30 * dayMs).toISOString() }),
      row({ event_type: 'agent_edit_proposal_created', created_at: 'not-a-date' as any }),
      row({ event_type: 'agent_edit_applied', created_at: new Date(now.getTime() - 1 * dayMs).toISOString() }),
    ];

    const rollup = buildPresentationRuntimeRollup({ rows, windowDays: 7, now });

    expect(rollup.totals.editsApplied).toBe(1);
    expect(rollup.totals.proposalsCreated).toBe(0);
    expect(rollup.totals.total).toBe(1);
    expect(rollup.byEventType[0]?.eventType).toBe('agent_edit_applied');
  });

  it('returns empty rollup with defaults when rows are empty', () => {
    const rollup = buildPresentationRuntimeRollup({ rows: [] });

    expect(rollup.totals.total).toBe(0);
    expect(rollup.byEventType).toEqual([]);
    expect(rollup.lastActivityAt).toBeNull();
    expect(rollup.windowDays).toBe(7);
    expect(typeof rollup.generatedAt).toBe('string');
  });
});
