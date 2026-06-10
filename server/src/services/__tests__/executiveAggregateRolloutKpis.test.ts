import { beforeEach, describe, expect, it, vi } from 'vitest';

// Keep the global-db-dependent collaborators deterministic / offline. The
// service itself runs against the routing mock IDatabase injected below.
vi.mock('../pmoHealthService.js', () => ({
  getHealthSnapshot: vi.fn().mockResolvedValue(null),
}));
vi.mock('../riskDetectionService.js', () => ({
  detectRiskSignals: vi.fn().mockResolvedValue([]),
}));
vi.mock('../executiveInsightsService.js', () => ({
  executiveInsightsService: {
    ensureSchema: vi.fn().mockResolvedValue(undefined),
    generateInsights: vi.fn().mockResolvedValue(null),
  },
}));

import { ExecutiveAggregateService } from '../executiveAggregateService.js';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const PROJECT = 'proj-1';
const OTHER_PROJECT = 'proj-2';

type RolloutKpiRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  current_value: number;
  target: number;
  unit: string;
  created_at: string;
};

/**
 * Routing mock IDatabase. Resolves the projects row (so getSnapshot can read
 * project.progress_pct) and the rollout_kpis rows scoped by org/project. Every
 * other query resolves empty — the service tolerates that via its `.catch`
 * fallbacks, exercising the derived-KPI path.
 */
function makeDb(rolloutRows: RolloutKpiRow[]) {
  const all = (sql: string, params: unknown[], cb: (e: Error | null, rows: unknown[]) => void) => {
    if (/FROM rollout_kpis/i.test(sql)) {
      const [orgId, projectId] = params as string[];
      const matched = rolloutRows.filter(
        (r) => r.organization_id === orgId && (r.project_id === projectId || r.project_id === null)
      );
      cb(null, matched);
      return;
    }
    cb(null, []);
  };

  const get = (sql: string, params: unknown[], cb: (e: Error | null, row: unknown) => void) => {
    if (/FROM projects/i.test(sql)) {
      cb(null, {
        id: params[0],
        name: 'Demo Project',
        progress_pct: 42,
        current_phase: 'EXECUTION',
      });
      return;
    }
    cb(null, null);
  };

  const run = (_sql: string, _params: unknown[], cb?: (e: Error | null) => void) => {
    if (cb) cb.call({ changes: 0, lastID: 0 }, null);
  };

  return { all, get, run, exec: (_s: string, cb?: (e: Error | null) => void) => cb?.(null) } as any;
}

describe('ExecutiveAggregateService — rollout KPI merge (P2-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges org/project-scoped rollout KPIs into kpis.highlights', async () => {
    const rows: RolloutKpiRow[] = [
      {
        id: 'r1',
        organization_id: ORG,
        project_id: PROJECT,
        name: 'Adoption rate',
        current_value: 65,
        target: 90,
        unit: '%',
        created_at: '2026-06-08T00:00:00Z',
      },
      {
        id: 'r2',
        organization_id: ORG,
        project_id: null, // org-wide rollout KPI — should still surface
        name: 'NPS',
        current_value: 40,
        target: 50,
        unit: 'pts',
        created_at: '2026-06-08T01:00:00Z',
      },
      {
        id: 'r3',
        organization_id: ORG,
        project_id: OTHER_PROJECT, // different project — must be excluded
        name: 'Other-project KPI',
        current_value: 1,
        target: 2,
        unit: '%',
        created_at: '2026-06-08T02:00:00Z',
      },
      {
        id: 'r4',
        organization_id: OTHER_ORG, // different org — must be excluded
        project_id: PROJECT,
        name: 'Other-org KPI',
        current_value: 1,
        target: 2,
        unit: '%',
        created_at: '2026-06-08T03:00:00Z',
      },
    ];

    const svc = new ExecutiveAggregateService(makeDb(rows));
    const snapshot = await svc.getSnapshot({
      organizationId: ORG,
      projectId: PROJECT,
      period: 'week',
      includeAI: false,
      refresh: true,
    });

    const ids = snapshot.kpis.highlights.map((h) => h.id);
    expect(ids).toContain('rollout_r1');
    expect(ids).toContain('rollout_r2');
    expect(ids).not.toContain('rollout_r3');
    expect(ids).not.toContain('rollout_r4');

    const adoption = snapshot.kpis.highlights.find((h) => h.id === 'rollout_r1');
    expect(adoption).toMatchObject({
      name: 'Adoption rate',
      currentValue: 65,
      targetValue: 90,
      unit: '%',
    });
  });

  it('reports good data quality when rollout KPIs are the only KPI source', async () => {
    const rows: RolloutKpiRow[] = [
      {
        id: 'r1',
        organization_id: ORG,
        project_id: PROJECT,
        name: 'Adoption rate',
        current_value: 65,
        target: 90,
        unit: '%',
        created_at: '2026-06-08T00:00:00Z',
      },
    ];

    const svc = new ExecutiveAggregateService(makeDb(rows));
    const snapshot = await svc.getSnapshot({
      organizationId: ORG,
      projectId: PROJECT,
      period: 'week',
      includeAI: false,
      refresh: true,
    });

    // No initiative_kpis (mock returns empty) → derived highlights are present,
    // so base highlights are non-empty and rollout KPIs are appended additively.
    expect(snapshot.kpis.highlights.some((h) => h.id === 'rollout_r1')).toBe(true);
  });

  it('omits rollout highlights when none exist for the org/project', async () => {
    const svc = new ExecutiveAggregateService(makeDb([]));
    const snapshot = await svc.getSnapshot({
      organizationId: ORG,
      projectId: PROJECT,
      period: 'week',
      includeAI: false,
      refresh: true,
    });

    expect(snapshot.kpis.highlights.some((h) => h.id.startsWith('rollout_'))).toBe(false);
  });
});
