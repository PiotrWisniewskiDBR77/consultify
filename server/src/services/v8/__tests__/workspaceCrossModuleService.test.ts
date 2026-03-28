import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import {
  CrossModuleActivitySchema,
  LinkModuleParamsSchema,
  SessionModuleLinkSchema,
} from '../../../types/workspaceCrossModule.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

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
  computeEngagementScore,
  findSessionsByModule,
  getCrossModuleActivity,
  getModuleImpact,
  getModuleLinks,
  getRecentCrossModuleActivity,
  getSessionAnalytics,
  getWorkspaceAnalytics,
  linkModule,
  recordCrossModuleActivity,
  unlinkModule,
} from '../workspaceCrossModuleService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const SESSION_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const SESSION_ID_2 = '00000000-0000-4000-8000-bbbbbbbbbbbb';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const WORKSPACE_ID = 'ws-cross-module-001';
const LINK_ID = '00000000-0000-4000-8000-cccccccccccc';
const INITIATIVE_ID = 'init-42';
const MODULE_RESOURCE_ID = '00000000-0000-4000-8000-dddddddddddd';

/** Minimal row for assertSessionInOrg / analytics duration */
function makeSessionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    session_id: SESSION_ID,
    workspace_id: WORKSPACE_ID,
    organization_id: ORG_ID,
    created_at: '2026-03-23T10:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}

/** Full DB row for getSessionsByWorkspace → rowToSession */
function makeFullWorkspaceSessionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    session_id: SESSION_ID,
    workspace_id: WORKSPACE_ID,
    organization_id: ORG_ID,
    title: 'Collaboration',
    state: 'active',
    created_by: USER_ID,
    linked_room_ids: '[]',
    shared_context: '{}',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}

function makeLinkRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    link_id: LINK_ID,
    session_id: SESSION_ID,
    organization_id: ORG_ID,
    module_type: 'initiative',
    module_resource_id: INITIATIVE_ID,
    linked_by: USER_ID,
    linked_at: '2026-03-23T10:00:00.000Z',
    unlinked_at: null,
    ...overrides,
  };
}

function makeActivityRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    activity_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    session_id: SESSION_ID,
    organization_id: ORG_ID,
    module_type: 'initiative',
    module_resource_id: INITIATIVE_ID,
    activity_type: 'context.opened',
    actor_id: USER_ID,
    summary: 'Opened initiative context',
    created_at: '2026-03-23T11:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockReset();
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockReset();
  mockDbAll.mockResolvedValue([]);
});

describe('Zod schemas', () => {
  it('validates SessionModuleLink', () => {
    const parsed = SessionModuleLinkSchema.parse({
      linkId: LINK_ID,
      sessionId: SESSION_ID,
      organizationId: ORG_ID,
      moduleType: 'report',
      moduleResourceId: MODULE_RESOURCE_ID,
      linkedBy: USER_ID,
      linkedAt: '2026-03-23T10:00:00.000Z',
      unlinkedAt: null,
    });
    expect(parsed.moduleType).toBe('report');
  });

  it('rejects invalid module type in LinkModuleParams', () => {
    expect(() =>
      LinkModuleParamsSchema.parse({
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        moduleType: 'invalid',
        moduleResourceId: 'x',
        linkedBy: USER_ID,
      })
    ).toThrow(ZodError);
  });
});

describe('computeEngagementScore', () => {
  it('returns 0 for empty signals', () => {
    expect(
      computeEngagementScore({
        totalActivities: 0,
        totalSuggestions: 0,
        totalDecisions: 0,
        totalModuleLinks: 0,
        totalParticipants: 0,
        durationMs: null,
      })
    ).toBe(0);
  });

  it('caps at 100', () => {
    const score = computeEngagementScore({
      totalActivities: 500,
      totalSuggestions: 500,
      totalDecisions: 500,
      totalModuleLinks: 500,
      totalParticipants: 500,
      durationMs: null,
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('linkModule', () => {
  it('inserts a new module link when session exists and no duplicate active link', async () => {
    mockDbGet.mockResolvedValueOnce(makeSessionRow()).mockResolvedValueOnce(null);

    const result = await linkModule({
      sessionId: SESSION_ID,
      organizationId: ORG_ID,
      moduleType: 'initiative',
      moduleResourceId: INITIATIVE_ID,
      linkedBy: USER_ID,
    });

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result.moduleType).toBe('initiative');
    expect(result.unlinkedAt).toBeNull();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const insertSql = String(mockDbRun.mock.calls[0][0]);
    expect(insertSql).toContain('INSERT INTO v8_session_module_links');
  });

  it('returns existing active link without inserting', async () => {
    const existing = makeLinkRow();
    mockDbGet.mockResolvedValueOnce(makeSessionRow()).mockResolvedValueOnce(existing);

    const result = await linkModule({
      sessionId: SESSION_ID,
      organizationId: ORG_ID,
      moduleType: 'initiative',
      moduleResourceId: INITIATIVE_ID,
      linkedBy: USER_ID,
    });

    expect(result.linkId).toBe(LINK_ID);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('throws when session is missing', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      linkModule({
        sessionId: SESSION_ID,
        organizationId: ORG_ID,
        moduleType: 'initiative',
        moduleResourceId: INITIATIVE_ID,
        linkedBy: USER_ID,
      })
    ).rejects.toThrow(/not found/);
  });
});

describe('unlinkModule', () => {
  it('sets unlinkedAt on an active link', async () => {
    mockDbGet.mockResolvedValueOnce(makeLinkRow());

    const result = await unlinkModule(LINK_ID, ORG_ID);

    expect(result.unlinkedAt).not.toBeNull();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const sql = String(mockDbRun.mock.calls[0][0]);
    expect(sql).toContain('UPDATE v8_session_module_links');
  });

  it('is idempotent when already unlinked', async () => {
    mockDbGet.mockResolvedValueOnce(makeLinkRow({ unlinked_at: '2026-03-23T12:00:00.000Z' }));

    await unlinkModule(LINK_ID, ORG_ID);

    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('throws when link missing', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await expect(unlinkModule(LINK_ID, ORG_ID)).rejects.toThrow(/not found/);
  });
});

describe('getModuleLinks', () => {
  it('lists active links for a session', async () => {
    mockDbGet.mockResolvedValueOnce(makeSessionRow());
    mockDbAll.mockResolvedValueOnce([makeLinkRow()]);

    const links = await getModuleLinks(SESSION_ID, ORG_ID);

    expect(links).toHaveLength(1);
    expect(links[0].linkId).toBe(LINK_ID);
    expect(mockDbAll).toHaveBeenCalled();
    const sql = String(mockDbAll.mock.calls[0][0]);
    expect(sql).toContain('unlinked_at IS NULL');
  });

  it('filters by module type when provided', async () => {
    mockDbGet.mockResolvedValueOnce(makeSessionRow());
    mockDbAll.mockResolvedValueOnce([makeLinkRow()]);

    await getModuleLinks(SESSION_ID, ORG_ID, 'initiative');

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain('initiative');
  });
});

describe('recordCrossModuleActivity', () => {
  it('inserts activity row', async () => {
    mockDbGet.mockResolvedValueOnce(makeSessionRow());

    const activity = await recordCrossModuleActivity({
      sessionId: SESSION_ID,
      organizationId: ORG_ID,
      moduleType: 'initiative',
      moduleResourceId: INITIATIVE_ID,
      activityType: 'view',
      actorId: USER_ID,
      summary: 'Viewed linked initiative',
    });

    CrossModuleActivitySchema.parse(activity);
    expect(mockDbRun).toHaveBeenCalled();
    expect(String(mockDbRun.mock.calls[0][0])).toContain('v8_cross_module_activity');
  });

  it('validates params with Zod', async () => {
    mockDbGet.mockResolvedValueOnce(makeSessionRow());
    await expect(
      recordCrossModuleActivity({
        sessionId: 'not-a-uuid',
        organizationId: ORG_ID,
        moduleType: 'initiative',
        moduleResourceId: INITIATIVE_ID,
        activityType: 'x',
        actorId: USER_ID,
        summary: 'y',
      } as Parameters<typeof recordCrossModuleActivity>[0])
    ).rejects.toThrow(ZodError);
  });
});

describe('getCrossModuleActivity', () => {
  it('returns rows for session ordered query', async () => {
    mockDbGet.mockResolvedValueOnce(makeSessionRow());
    mockDbAll.mockResolvedValueOnce([makeActivityRow()]);

    const rows = await getCrossModuleActivity(SESSION_ID, ORG_ID, undefined, 25);

    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toContain('Opened');
    const sql = String(mockDbAll.mock.calls[0][0]);
    expect(sql).toContain('ORDER BY created_at DESC');
    expect((mockDbAll.mock.calls[0][1] as unknown[]).includes(25)).toBe(true);
  });

  it('filters by module type', async () => {
    mockDbGet.mockResolvedValueOnce(makeSessionRow());
    mockDbAll.mockResolvedValueOnce([]);

    await getCrossModuleActivity(SESSION_ID, ORG_ID, 'presentation', 10);

    const sql = String(mockDbAll.mock.calls[0][0]);
    expect(sql).toContain('module_type = ?');
  });
});

describe('getSessionAnalytics', () => {
  it('aggregates counts and engagement', async () => {
    mockDbGet.mockImplementation((sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s.includes('FROM v8_workspace_sessions')) {
        return Promise.resolve(
          makeSessionRow({
            session_id: params?.[0],
            completed_at: '2026-03-23T12:00:00.000Z',
          })
        );
      }
      if (s.includes('FROM v8_activity_feed') && s.includes('COUNT(DISTINCT actor_id)')) {
        return Promise.resolve({ cnt: 2 });
      }
      if (s.includes('FROM v8_activity_feed') && s.includes('COUNT(*)')) {
        return Promise.resolve({ cnt: 8 });
      }
      if (s.includes('FROM v8_ai_suggestions')) {
        return Promise.resolve({ cnt: 3 });
      }
      if (s.includes('FROM v8_collaborative_decisions')) {
        return Promise.resolve({ cnt: 1 });
      }
      if (s.includes('FROM v8_session_module_links')) {
        return Promise.resolve({ cnt: 2 });
      }
      return Promise.resolve(null);
    });

    const analytics = await getSessionAnalytics(SESSION_ID, ORG_ID);

    expect(analytics.sessionId).toBe(SESSION_ID);
    expect(analytics.totalActivities).toBe(8);
    expect(analytics.totalParticipants).toBe(2);
    expect(analytics.totalSuggestions).toBe(3);
    expect(analytics.totalDecisions).toBe(1);
    expect(analytics.totalModuleLinks).toBe(2);
    expect(analytics.durationMs).not.toBeNull();
    expect(analytics.engagementScore).toBeGreaterThanOrEqual(0);
    expect(analytics.engagementScore).toBeLessThanOrEqual(100);
  });

  it('throws when session missing', async () => {
    mockDbGet.mockResolvedValue(null);
    await expect(getSessionAnalytics(SESSION_ID, ORG_ID)).rejects.toThrow(/not found/);
  });
});

describe('getWorkspaceAnalytics', () => {
  it('sums per-session analytics for workspace', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFullWorkspaceSessionRow({ session_id: SESSION_ID }),
      makeFullWorkspaceSessionRow({ session_id: SESSION_ID_2 }),
    ]);

    mockDbGet.mockImplementation((sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s.includes('FROM v8_workspace_sessions')) {
        const sid = params?.[0];
        return Promise.resolve(
          makeSessionRow({
            session_id: sid,
            completed_at: null,
          })
        );
      }
      if (s.includes('COUNT(DISTINCT actor_id)')) {
        return Promise.resolve({ cnt: 1 });
      }
      if (s.includes('FROM v8_activity_feed') && s.includes('COUNT(*)')) {
        return Promise.resolve({ cnt: 5 });
      }
      if (s.includes('FROM v8_ai_suggestions')) {
        return Promise.resolve({ cnt: 2 });
      }
      if (s.includes('FROM v8_collaborative_decisions')) {
        return Promise.resolve({ cnt: 1 });
      }
      if (s.includes('FROM v8_session_module_links')) {
        return Promise.resolve({ cnt: 1 });
      }
      return Promise.resolve(null);
    });

    const wa = await getWorkspaceAnalytics(WORKSPACE_ID, ORG_ID);

    expect(wa.sessionCount).toBe(2);
    expect(wa.totalActivities).toBe(10);
    expect(wa.totalSuggestions).toBe(4);
    expect(wa.totalDecisions).toBe(2);
    expect(wa.totalModuleLinks).toBe(2);
    expect(wa.cumulativeDurationMs).toBeNull();
    expect(wa.avgEngagementScore).toBeGreaterThanOrEqual(0);
  });

  it('returns zeros when no sessions', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const wa = await getWorkspaceAnalytics(WORKSPACE_ID, ORG_ID);

    expect(wa.sessionCount).toBe(0);
    expect(wa.totalActivities).toBe(0);
    expect(wa.avgEngagementScore).toBe(0);
  });
});

describe('findSessionsByModule', () => {
  it('returns distinct session ids', async () => {
    mockDbAll.mockResolvedValueOnce([{ session_id: SESSION_ID }, { session_id: SESSION_ID_2 }]);

    const ids = await findSessionsByModule('initiative', INITIATIVE_ID, ORG_ID);

    expect(ids).toEqual([SESSION_ID, SESSION_ID_2]);
    const sql = String(mockDbAll.mock.calls[0][0]);
    expect(sql).toContain('unlinked_at IS NULL');
  });
});

describe('getModuleImpact', () => {
  it('returns linked session count, activity count, and decisions in linked sessions', async () => {
    mockDbGet
      .mockResolvedValueOnce({ cnt: 3 })
      .mockResolvedValueOnce({ cnt: 12 })
      .mockResolvedValueOnce({ cnt: 4 });

    const impact = await getModuleImpact('report', MODULE_RESOURCE_ID, ORG_ID);

    expect(impact.linkedSessionCount).toBe(3);
    expect(impact.crossModuleActivityCount).toBe(12);
    expect(impact.referencedDecisionsCount).toBe(4);
    expect(mockDbGet).toHaveBeenCalledTimes(3);
  });
});

describe('getRecentCrossModuleActivity', () => {
  it('queries by organization and time window', async () => {
    mockDbAll.mockResolvedValueOnce([makeActivityRow()]);

    const rows = await getRecentCrossModuleActivity(ORG_ID, 14, 20);

    expect(rows).toHaveLength(1);
    const sql = String(mockDbAll.mock.calls[0][0]);
    expect(sql).toContain('v8_cross_module_activity');
    expect(sql).toContain('created_at >=');
    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(ORG_ID);
    expect(params[2]).toBe(20);
  });
});
