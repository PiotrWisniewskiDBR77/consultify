/**
 * Wave 12 — PM sync baseline & operator recovery surface tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getOperatorDashboard,
  getPausedConnectors,
  getRecentIncidents,
} from '../operatorAdminService.js';
import { getActiveEscalations, getCredentialHealth } from '../pmSyncAuthService.js';
import {
  getConnectorHealth as getConnectorSyncHealthSummary,
  getUnresolvedConflicts,
  resolveConflict,
} from '../pmSyncTruthService.js';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const CONNECTOR_ID = 'jira-connector-1';
const USER_ID = '00000000-0000-4000-8000-0000000000aa';
const SYNC_STATE_ID = '00000000-0000-4000-8000-000000000010';
const CONFLICT_ID = '00000000-0000-4000-8000-0000000000cc';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Wave 12 — pmSyncTruthService', () => {
  it('getConnectorHealth returns rollup summary', async () => {
    mockDbGet
      .mockResolvedValueOnce({
        record_id: 'r1',
        connector_id: CONNECTOR_ID,
        organization_id: ORG_ID,
        auth_state: 'healthy',
        previous_state: null,
        transitioned_at: '2026-03-23T10:00:00.000Z',
        transitioned_by: USER_ID,
        reason: null,
        created_at: '2026-03-23T10:00:00.000Z',
      })
      .mockResolvedValueOnce({ n: 0 });

    mockDbAll.mockResolvedValueOnce([
      {
        sync_state_id: SYNC_STATE_ID,
        object_type: 'Task',
        object_id: 't1',
        connector_id: CONNECTOR_ID,
        organization_id: ORG_ID,
        sync_status: 'synced',
        last_synced_at: '2026-03-23T12:00:00.000Z',
        stale_since: null,
        error_class: null,
        created_at: '2026-03-23T09:00:00.000Z',
        updated_at: '2026-03-23T12:00:00.000Z',
      },
    ]);

    const s = await getConnectorSyncHealthSummary(CONNECTOR_ID, ORG_ID);

    expect(s.healthy).toBe(true);
    expect(s.syncStatus).toBe('synced');
    expect(s.conflictCount).toBe(0);
    expect(s.lastSyncAt).toBe('2026-03-23T12:00:00.000Z');
    expect(s.authState).toBe('healthy');
  });

  it('getUnresolvedConflicts respects org and limit', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        conflict_id: CONFLICT_ID,
        object_sync_state_id: SYNC_STATE_ID,
        organization_id: ORG_ID,
        conflict_class: 'field_authority_conflict',
        severity: 'blocking',
        resolution_path: null,
        resolution_strategy: null,
        resolved_at: null,
        resolved_by: null,
        created_at: '2026-03-23T10:00:00.000Z',
      },
    ]);

    const list = await getUnresolvedConflicts(ORG_ID, 25);

    expect(list).toHaveLength(1);
    expect(list[0].conflictId).toBe(CONFLICT_ID);
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID, 25]);
  });

  it('resolveConflict persists path and strategy', async () => {
    mockDbGet.mockResolvedValueOnce({
      conflict_id: CONFLICT_ID,
      object_sync_state_id: SYNC_STATE_ID,
      organization_id: ORG_ID,
      conflict_class: 'field_authority_conflict',
      severity: 'degraded',
      resolution_path: null,
      resolution_strategy: null,
      resolved_at: null,
      resolved_by: null,
      created_at: '2026-03-23T10:00:00.000Z',
    });

    const updated = await resolveConflict(CONFLICT_ID, 'dismiss', USER_ID);

    expect(updated.resolutionPath).toBe('dismiss');
    expect(updated.resolutionStrategy).toBe('dismiss');
    expect(updated.resolvedBy).toBe(USER_ID);
    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('resolution_strategy');
  });
});

describe('Wave 12 — pmSyncAuthService', () => {
  it('getCredentialHealth counts rows and escalations', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        credential_id: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        connector_id: CONNECTOR_ID,
        organization_id: ORG_ID,
        provider_account_id: 'a',
        workspace_or_tenant_id: 'w',
        scopes_granted: '[]',
        token_expires_at: null,
        last_verification_at: null,
        last_refresh_at: null,
        last_refresh_result: 'success',
        created_at: '2026-03-23T09:00:00.000Z',
        updated_at: '2026-03-23T09:00:00.000Z',
      },
      {
        credential_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
        connector_id: 'c2',
        organization_id: ORG_ID,
        provider_account_id: 'b',
        workspace_or_tenant_id: 'w',
        scopes_granted: '[]',
        token_expires_at: null,
        last_verification_at: null,
        last_refresh_at: null,
        last_refresh_result: 'credential_expired',
        created_at: '2026-03-23T09:00:00.000Z',
        updated_at: '2026-03-23T09:00:00.000Z',
      },
    ]);
    mockDbGet.mockResolvedValueOnce({ n: 3 });

    const h = await getCredentialHealth(ORG_ID);

    expect(h.total).toBe(2);
    expect(h.healthy).toBe(1);
    expect(h.failing).toBe(1);
    expect(h.escalated).toBe(3);
  });

  it('getActiveEscalations returns unresolved rows', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        escalation_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
        organization_id: ORG_ID,
        connector_id: CONNECTOR_ID,
        reason: 'auth_break',
        escalated_at: '2026-03-23T08:00:00.000Z',
        resolved_at: null,
        resolved_by: null,
      },
    ]);

    const esc = await getActiveEscalations(ORG_ID);

    expect(esc).toHaveLength(1);
    expect(esc[0].escalationId).toBe('00000000-0000-4000-8000-eeeeeeeeeeee');
    expect(esc[0].resolvedAt).toBeNull();
  });
});

describe('Wave 12 — operatorAdminService', () => {
  it('getOperatorDashboard merges fleet, pauses, escalations, notes', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          entry_id: '00000000-0000-4000-8000-111111111111',
          connector_id: CONNECTOR_ID,
          organization_id: ORG_ID,
          provider_key: 'jira',
          auth_state: 'healthy',
          provider_tier: 'A',
          last_sync_success: '2026-03-23T10:00:00.000Z',
          last_sync_failure: null,
          staleness_indicator: 0,
          drift_state: 'none',
          dead_letter_count: 0,
          conflict_count: 0,
          created_at: '2026-03-23T09:00:00.000Z',
          updated_at: '2026-03-23T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          pause_id: '00000000-0000-4000-8000-222222222222',
          organization_id: ORG_ID,
          pause_scope: 'all_connectors',
          provider_key: null,
          paused_by: USER_ID,
          reason: 'incident',
          blast_radius: 1,
          paused_at: '2026-03-23T11:00:00.000Z',
          resumed_at: null,
          resumed_by: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          escalation_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
          organization_id: ORG_ID,
          connector_id: CONNECTOR_ID,
          reason: 'x',
          escalated_at: '2026-03-23T08:00:00.000Z',
          resolved_at: null,
          resolved_by: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          note_id: '00000000-0000-4000-8000-333333333333',
          incident_ref: 'INC-1',
          connector_id: CONNECTOR_ID,
          organization_id: ORG_ID,
          author_id: USER_ID,
          author_role: 'operator',
          content: 'note',
          created_at: '2026-03-23T12:00:00.000Z',
        },
      ]);

    const dash = await getOperatorDashboard(ORG_ID);

    expect(dash.fleetHealth).toHaveLength(1);
    expect(dash.activePauses).toHaveLength(1);
    expect(dash.unresolvedAuthEscalations).toHaveLength(1);
    expect(dash.recentSupportNotes).toHaveLength(1);
    expect(dash.recentSupportNotes[0].incidentRef).toBe('INC-1');
  });

  it('getPausedConnectors maps fleet entries under active pauses', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        {
          pause_id: '00000000-0000-4000-8000-222222222222',
          organization_id: ORG_ID,
          pause_scope: 'all_connectors',
          provider_key: null,
          paused_by: USER_ID,
          reason: 'stop',
          blast_radius: 1,
          paused_at: '2026-03-23T11:00:00.000Z',
          resumed_at: null,
          resumed_by: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          entry_id: '00000000-0000-4000-8000-111111111111',
          connector_id: CONNECTOR_ID,
          organization_id: ORG_ID,
          provider_key: 'jira',
          auth_state: 'healthy',
          provider_tier: 'A',
          last_sync_success: null,
          last_sync_failure: null,
          staleness_indicator: 0,
          drift_state: 'none',
          dead_letter_count: 0,
          conflict_count: 0,
          created_at: '2026-03-23T09:00:00.000Z',
          updated_at: '2026-03-23T10:00:00.000Z',
        },
      ]);

    const paused = await getPausedConnectors(ORG_ID);

    expect(paused).toHaveLength(1);
    expect(paused[0].connectorId).toBe(CONNECTOR_ID);
    expect(paused[0].pauseScope).toBe('all_connectors');
  });

  it('getRecentIncidents filters by incident_ref and time window', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        note_id: '00000000-0000-4000-8000-333333333333',
        incident_ref: 'INC-42',
        connector_id: CONNECTOR_ID,
        organization_id: ORG_ID,
        author_id: USER_ID,
        author_role: 'support',
        content: 'outage',
        created_at: '2026-03-23T15:00:00.000Z',
      },
    ]);

    const incidents = await getRecentIncidents(ORG_ID, 14);

    expect(incidents).toHaveLength(1);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('incident_ref');
    expect((mockDbAll.mock.calls[0][1] as string[])[0]).toBe(ORG_ID);
  });
});
