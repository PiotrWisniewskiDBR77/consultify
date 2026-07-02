/**
 * Health Panel — probe runner + probe unit tests (HARVARD D-J ETAP 2).
 *
 * Covers:
 *  - runProbe: pass / fail / never-throws + duration
 *  - runAllProbes: runs the whole registry
 *  - summarizeResults: rollup + overall status
 *  - isHealthPanelAllowedEnv: production gate
 *  - probe (a) M15 KPI round-trip (mocked service): asserts create→read + cleanup
 *  - probe (d) M24 add-member validate + audit round-trip (mocked audit + DB)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock all downstream services the probes call ──
vi.mock('../../../server/src/services/v8/resultsROIService.js', () => ({
  createKPI: vi.fn(),
  getKPI: vi.fn(),
  recordROIRealization: vi.fn(),
  getROIByInitiative: vi.fn(),
}));
vi.mock('../../../server/src/services/AuditLogger.js', () => ({
  getAuditLogger: vi.fn(),
}));
vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  listArtifactsForUser: vi.fn(),
  getRecentArtifactRefsForOrg: vi.fn(),
}));
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// The M16 grounding probe dynamically imports the financial-modeling route for
// its createModelSchema. Stub it with a schema that accepts sourceStatementId so
// runAllProbes stays hermetic (no heavy route graph loaded).
vi.mock('../../../server/src/routes/financial-modeling.routes.js', () => ({
  createModelSchema: { safeParse: () => ({ success: true }) },
  default: {},
}));
// The DRD golden-path probe dynamically imports the assessment-reports route to
// assert the endpoint module still loads. Stub it so runAllProbes stays hermetic.
vi.mock('../../../server/src/routes/assessment-reports.routes.js', () => ({
  default: {},
}));

import * as resultsROIService from '../../../server/src/services/v8/resultsROIService.js';
import { getRecentArtifactRefsForOrg } from '../../../server/src/services/v8/artifactRegistryService.js';
import { getAuditLogger } from '../../../server/src/services/AuditLogger.js';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';
import {
  HEALTH_PROBES,
  HEALTH_PROBE_PREFIX,
  getProbeById,
  isHealthPanelAllowedEnv,
  runAllProbes,
  runProbe,
  summarizeResults,
  type HealthProbe,
} from '../../../server/src/services/health/healthProbeService.js';

const CTX = { organizationId: 'org-1', userId: 'user-1' };

beforeEach(() => {
  vi.clearAllMocks();
  (DbPromise.run as any).mockResolvedValue({ changes: 1 });
  (DbPromise.get as any).mockResolvedValue(null);
  (DbPromise.all as any).mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runProbe', () => {
  it('returns pass with duration + detail on success', async () => {
    const probe: HealthProbe = {
      id: 'ok',
      module: 'M0',
      title: 'ok',
      description: 'd',
      run: async () => ({ marker: 42 }),
    };
    const result = await runProbe(probe, CTX);
    expect(result.status).toBe('pass');
    expect(result.errorMessage).toBeNull();
    expect(result.detail).toEqual({ marker: 42 });
    expect(typeof result.durationMs).toBe('number');
  });

  it('captures the error message and never throws on failure', async () => {
    const probe: HealthProbe = {
      id: 'boom',
      module: 'M0',
      title: 'boom',
      description: 'd',
      run: async () => {
        throw new Error('contract violated');
      },
    };
    const result = await runProbe(probe, CTX);
    expect(result.status).toBe('fail');
    expect(result.errorMessage).toBe('contract violated');
    expect(result.detail).toBeNull();
  });
});

describe('summarizeResults', () => {
  it('rolls up pass/fail/unknown and derives overall', () => {
    const s = summarizeResults([
      { status: 'pass' } as any,
      { status: 'fail' } as any,
      { status: 'unknown' } as any,
    ]);
    expect(s).toMatchObject({ total: 3, passed: 1, failed: 1, unknown: 1, overall: 'fail' });
  });

  it('overall is unknown only when every probe is unknown', () => {
    const s = summarizeResults([{ status: 'unknown' } as any, { status: 'unknown' } as any]);
    expect(s.overall).toBe('unknown');
  });

  it('overall is pass when there are passes and no failures', () => {
    const s = summarizeResults([{ status: 'pass' } as any, { status: 'unknown' } as any]);
    expect(s.overall).toBe('pass');
  });
});

describe('isHealthPanelAllowedEnv', () => {
  const original = process.env.NODE_ENV;
  const originalKill = process.env.HEALTH_PANEL_DISABLED;
  afterEach(() => {
    process.env.NODE_ENV = original;
    process.env.HEALTH_PANEL_DISABLED = originalKill;
  });

  it('is false on production', () => {
    process.env.NODE_ENV = 'production';
    expect(isHealthPanelAllowedEnv()).toBe(false);
  });

  it('is true on non-production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.HEALTH_PANEL_DISABLED;
    expect(isHealthPanelAllowedEnv()).toBe(true);
  });

  it('honors the HEALTH_PANEL_DISABLED kill-switch', () => {
    process.env.NODE_ENV = 'test';
    process.env.HEALTH_PANEL_DISABLED = 'true';
    expect(isHealthPanelAllowedEnv()).toBe(false);
  });
});

describe('registry', () => {
  it('exposes every probe with unique ids (original + golden-path)', () => {
    const ids = HEALTH_PROBES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        // original six
        'm15_kpi_round_trip',
        'm15_roi_round_trip',
        'm16_statements_grounding',
        'm24_member_validate_audit',
        'm17_artifacts_draft_filter',
        'm14_m15_handoff',
        // golden-path liveness probes (Runda3 #6)
        'gp_interview_insights_live',
        'gp_initiatives_list_live',
        'gp_assessment_to_initiatives_live',
        'gp_tools_to_initiatives_live',
        'gp_initiatives_to_execution_live',
        'gp_execution_to_results_live',
        'gp_assessments_list_live',
        'gp_drd_report_live',
        'gp_m17_register_read_live',
      ])
    );
  });

  it('every probe has the required shape (id/module/title/description/run)', () => {
    for (const p of HEALTH_PROBES) {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.module).toBe('string');
      expect(typeof p.title).toBe('string');
      expect(typeof p.description).toBe('string');
      expect(typeof p.run).toBe('function');
    }
  });

  it('getProbeById resolves and rejects unknown', () => {
    expect(getProbeById('m15_kpi_round_trip')).toBeDefined();
    expect(getProbeById('gp_interview_insights_live')).toBeDefined();
    expect(getProbeById('nope')).toBeUndefined();
  });
});

describe('golden-path probes — read-only liveness', () => {
  it('interview-insights probe runs the org-scoped query and returns a count (empty allowed)', async () => {
    (DbPromise.all as any).mockResolvedValue([]);
    const result = await runProbe(getProbeById('gp_interview_insights_live')!, CTX);
    expect(result.status).toBe('pass');
    expect(result.detail).toEqual({ insightCount: 0 });
    // Assert the query was org-scoped against interview_insights.
    expect(DbPromise.all).toHaveBeenCalledWith(
      expect.stringContaining('FROM interview_insights'),
      [CTX.organizationId],
      { fallback: true }
    );
  });

  it('initiatives→execution probe reports task + initiative-link counts', async () => {
    (DbPromise.all as any).mockResolvedValue([
      { id: 't1', initiative_id: 'i1' },
      { id: 't2', initiative_id: null },
    ]);
    const result = await runProbe(getProbeById('gp_initiatives_to_execution_live')!, CTX);
    expect(result.status).toBe('pass');
    expect(result.detail).toEqual({ taskCount: 2, linkedToInitiative: 1 });
    expect(DbPromise.all).toHaveBeenCalledWith(
      expect.stringContaining('FROM tasks'),
      [CTX.organizationId],
      { fallback: true }
    );
  });

  it('M17 register-read probe passes when the service returns an array', async () => {
    (getRecentArtifactRefsForOrg as any).mockResolvedValue([{ artifactId: 'a1' }]);
    const result = await runProbe(getProbeById('gp_m17_register_read_live')!, CTX);
    expect(result.status).toBe('pass');
    expect(result.detail).toEqual({ refCount: 1 });
    expect(getRecentArtifactRefsForOrg).toHaveBeenCalledWith(CTX.organizationId, 10);
  });

  it('M17 register-read probe FAILS (fail-soft) when the service returns a non-array', async () => {
    (getRecentArtifactRefsForOrg as any).mockResolvedValue(null);
    const result = await runProbe(getProbeById('gp_m17_register_read_live')!, CTX);
    expect(result.status).toBe('fail');
    expect(result.errorMessage).toMatch(/did not return an array/i);
  });

  it('DRD probe passes when the report route module imports and the query runs', async () => {
    (DbPromise.all as any).mockResolvedValue([]);
    const result = await runProbe(getProbeById('gp_drd_report_live')!, CTX);
    expect(result.status).toBe('pass');
    expect(result.detail).toMatchObject({ reportCount: 0, routeLoaded: true });
  });
});

describe('probe (a) — M15 KPI round-trip', () => {
  const probe = getProbeById('m15_kpi_round_trip')!;

  it('passes when create→read succeeds and hard-deletes afterwards', async () => {
    (resultsROIService.createKPI as any).mockResolvedValue({
      kpiId: 'kpi-9',
      organizationId: CTX.organizationId,
      name: `${HEALTH_PROBE_PREFIX}KPI-x`,
    });
    (resultsROIService.getKPI as any).mockResolvedValue({
      kpiId: 'kpi-9',
      organizationId: CTX.organizationId,
    });

    const result = await runProbe(probe, CTX);

    expect(result.status).toBe('pass');
    expect(resultsROIService.createKPI).toHaveBeenCalledOnce();
    // Object name carries the probe prefix.
    const createArg = (resultsROIService.createKPI as any).mock.calls[0][0];
    expect(createArg.name).toContain(HEALTH_PROBE_PREFIX);
    // Hard cleanup ran against v8_kpi_definitions, org-scoped.
    expect(DbPromise.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM v8_kpi_definitions'),
      ['kpi-9', CTX.organizationId]
    );
  });

  it('fails (and still cleans up) when read leaks across orgs', async () => {
    (resultsROIService.createKPI as any).mockResolvedValue({
      kpiId: 'kpi-leak',
      organizationId: CTX.organizationId,
    });
    (resultsROIService.getKPI as any).mockResolvedValue({
      kpiId: 'kpi-leak',
      organizationId: 'SOME-OTHER-ORG',
    });

    const result = await runProbe(probe, CTX);

    expect(result.status).toBe('fail');
    expect(result.errorMessage).toMatch(/organization boundary/i);
    // finally still deleted the seeded row.
    expect(DbPromise.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM v8_kpi_definitions'),
      ['kpi-leak', CTX.organizationId]
    );
  });
});

describe('probe (d) — M24 add-member validate + audit', () => {
  const probe = getProbeById('m24_member_validate_audit')!;

  it('emits an audit entry, reads it back, and cleans up', async () => {
    const log = vi.fn().mockResolvedValue(undefined);
    (getAuditLogger as any).mockReturnValue({ log });
    // Audit read-back returns a row → probe passes.
    (DbPromise.get as any).mockResolvedValue({ resource_id: 'HEALTH-PROBE-AUDIT-x' });

    const result = await runProbe(probe, CTX);

    expect(result.status).toBe('pass');
    expect(log).toHaveBeenCalledOnce();
    const logArg = log.mock.calls[0][0];
    expect(logArg.resourceType).toBe('health_probe');
    expect(String(logArg.resourceId)).toContain(HEALTH_PROBE_PREFIX);
    // Cleanup deletes the probe audit row.
    expect(DbPromise.run).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM audit_logs'),
      expect.arrayContaining([CTX.organizationId])
    );
  });

  it('fails when the audit entry is not readable after emission', async () => {
    (getAuditLogger as any).mockReturnValue({ log: vi.fn().mockResolvedValue(undefined) });
    (DbPromise.get as any).mockResolvedValue(null); // not readable

    const result = await runProbe(probe, CTX);

    expect(result.status).toBe('fail');
    expect(result.errorMessage).toMatch(/not readable/i);
  });
});

describe('runAllProbes', () => {
  it('runs every registered probe and returns one result each', async () => {
    (resultsROIService.createKPI as any).mockResolvedValue({
      kpiId: 'k',
      organizationId: CTX.organizationId,
    });
    (resultsROIService.getKPI as any).mockResolvedValue({
      kpiId: 'k',
      organizationId: CTX.organizationId,
    });
    (resultsROIService.recordROIRealization as any).mockResolvedValue({ entryId: 'e', realizedValue: 4242 });
    (resultsROIService.getROIByInitiative as any).mockResolvedValue([{ entryId: 'e', realizedValue: 4242 }]);
    (getAuditLogger as any).mockReturnValue({ log: vi.fn().mockResolvedValue(undefined) });

    const results = await runAllProbes(CTX);
    expect(results).toHaveLength(HEALTH_PROBES.length);
    expect(results.map((r) => r.probeId).sort()).toEqual(HEALTH_PROBES.map((p) => p.id).sort());
  });
});
