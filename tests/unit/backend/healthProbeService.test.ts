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
vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  withPinnedPostgresTransaction: vi.fn(),
}));
// Round-trip probe dependencies (Paczka1 #3).
vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative: vi.fn(),
}));
vi.mock('../../../server/src/services/executionResultsBridge.js', () => ({
  handoffFromClosure: vi.fn(),
  CLOSURE_HANDOFF_SOURCE: 'M14_CLOSURE_HANDOFF',
}));
vi.mock('../../../server/src/services/v8/resultsFinanceReconciliationService.js', () => ({
  pullAndReconcileInitiative: vi.fn(),
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
import { createInitiative as createInitiativeViaFunnel } from '../../../server/src/services/initiative/createInitiativeService.js';
import { handoffFromClosure } from '../../../server/src/services/executionResultsBridge.js';
import { pullAndReconcileInitiative } from '../../../server/src/services/v8/resultsFinanceReconciliationService.js';
import { getRecentArtifactRefsForOrg } from '../../../server/src/services/v8/artifactRegistryService.js';
import { getAuditLogger } from '../../../server/src/services/AuditLogger.js';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';
import { withPinnedPostgresTransaction } from '../../../server/src/database/PostgresDatabase.js';
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
        // golden-path ROUND-TRIP probes (Paczka1 #3)
        'gp4_tools_to_initiative_round_trip',
        'gp5_ideas_convert_to_initiative_round_trip',
        'gp6_initiative_to_execution_round_trip',
        'gp7_execution_closure_to_results_round_trip',
        'gp8_results_finance_reconciliation_round_trip',
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

describe('probe (b) — M15 ROI realization round-trip', () => {
  const probe = getProbeById('m15_roi_round_trip')!;

  it('writes and reads on one pinned transaction, then rolls it back without DELETE', async () => {
    const queryRun = vi.fn().mockResolvedValue({ changes: 1 });
    const queryOne = vi.fn().mockResolvedValue({ entry_id: 'entry-roi-1', realized_value: 4242 });
    (withPinnedPostgresTransaction as any).mockImplementation(async (work: any) => {
      try {
        return await work({ queryRun, queryOne, queryAll: vi.fn() });
      } catch (error) {
        throw error;
      }
    });

    const result = await runProbe(probe, CTX);

    expect(result.status).toBe('pass');
    expect(result.detail).toMatchObject({ rolledBack: true });
    expect(withPinnedPostgresTransaction).toHaveBeenCalledOnce();
    expect(queryRun).toHaveBeenCalledTimes(3);
    expect(queryRun.mock.calls[0][0]).toContain('INSERT INTO initiatives');
    expect(queryRun.mock.calls[1][0]).toContain('INSERT INTO v8_kpi_definitions');
    expect(queryRun.mock.calls[2][0]).toContain('INSERT INTO v8_roi_realization_entries');
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('FROM v8_roi_realization_entries'),
      expect.arrayContaining([CTX.organizationId])
    );
    expect(DbPromise.run).not.toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM'),
      expect.anything()
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

describe('golden-path ROUND-TRIP probes (Paczka1 #3)', () => {
  describe('gp4 — Tools → initiative with back-ref', () => {
    const probe = getProbeById('gp4_tools_to_initiative_round_trip')!;

    it('creates via the funnel with sourceType=tool, verifies the persisted back-ref, and cleans up', async () => {
      (createInitiativeViaFunnel as any).mockImplementation(async (_org: string, input: any) => ({
        id: 'init-tool-1',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      }));
      (DbPromise.get as any).mockImplementation(async () => {
        const input = (createInitiativeViaFunnel as any).mock.calls[0][1];
        return { id: 'init-tool-1', source_type: 'tool', source_id: input.sourceId };
      });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('pass');
      const [orgArg, inputArg, optionsArg] = (createInitiativeViaFunnel as any).mock.calls[0];
      expect(orgArg).toBe(CTX.organizationId);
      expect(inputArg.sourceType).toBe('tool');
      expect(String(inputArg.title)).toContain(HEALTH_PROBE_PREFIX);
      expect(String(inputArg.sourceId)).toContain(HEALTH_PROBE_PREFIX);
      expect(optionsArg).toMatchObject({ emitAudit: false });
      // Hard cleanup deleted the seeded initiative, org-scoped.
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM initiatives'),
        ['init-tool-1', CTX.organizationId]
      );
    });

    it('FAILS when the back-ref does not survive (source_type falls back to manual) — and still cleans up', async () => {
      (createInitiativeViaFunnel as any).mockResolvedValue({ id: 'init-tool-2' });
      (DbPromise.get as any).mockResolvedValue({
        id: 'init-tool-2',
        source_type: 'manual',
        source_id: null,
      });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('fail');
      expect(result.errorMessage).toMatch(/provenance lost/i);
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM initiatives'),
        ['init-tool-2', CTX.organizationId]
      );
    });
  });

  describe('gp5 — Ideas convert → initiative with back-ref', () => {
    const probe = getProbeById('gp5_ideas_convert_to_initiative_round_trip')!;

    it('round-trips the ConvertTo provenance (sourceType=tool_session)', async () => {
      (createInitiativeViaFunnel as any).mockImplementation(async (_org: string, input: any) => ({
        id: 'init-conv-1',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      }));
      (DbPromise.get as any).mockImplementation(async () => {
        const input = (createInitiativeViaFunnel as any).mock.calls[0][1];
        return { source_type: 'tool_session', source_id: input.sourceId };
      });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('pass');
      const inputArg = (createInitiativeViaFunnel as any).mock.calls[0][1];
      expect(inputArg.sourceType).toBe('tool_session');
    });

    it('FAILS when source_id does not match the session id', async () => {
      (createInitiativeViaFunnel as any).mockResolvedValue({ id: 'init-conv-2' });
      (DbPromise.get as any).mockResolvedValue({
        source_type: 'tool_session',
        source_id: 'SOMETHING-ELSE',
      });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('fail');
      expect(result.errorMessage).toMatch(/back-reference lost/i);
    });
  });

  describe('gp6 — Initiative → execution task linkage', () => {
    const probe = getProbeById('gp6_initiative_to_execution_round_trip')!;

    it('seeds initiative + linked task, reads the task back through initiative_id, cleans both', async () => {
      (DbPromise.get as any).mockResolvedValue({ id: 'task-1' });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('pass');
      // Seeded both rows.
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO initiatives'),
        expect.arrayContaining([CTX.organizationId, 'IN_PROGRESS'])
      );
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks'),
        expect.arrayContaining([CTX.organizationId])
      );
      // Read back org-scoped through the linkage.
      expect(DbPromise.get).toHaveBeenCalledWith(
        expect.stringContaining('initiative_id = ?'),
        expect.arrayContaining([CTX.organizationId]),
        { fallback: true }
      );
      // Cleanup deleted the task AND the initiative.
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tasks'),
        expect.arrayContaining([CTX.organizationId])
      );
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM initiatives'),
        expect.arrayContaining([CTX.organizationId])
      );
    });

    it('FAILS when the task is not readable through the linkage', async () => {
      (DbPromise.get as any).mockResolvedValue(null);
      const result = await runProbe(probe, CTX);
      expect(result.status).toBe('fail');
      expect(result.errorMessage).toMatch(/linkage/i);
    });
  });

  describe('gp7 — Execution closure → benefit (idempotent)', () => {
    const probe = getProbeById('gp7_execution_closure_to_results_round_trip')!;

    it('runs the real closure handoff, verifies the tagged benefit, and asserts idempotency on re-run', async () => {
      (handoffFromClosure as any)
        .mockResolvedValueOnce({ created: 1, skipped: 0, considered: 1 })
        .mockResolvedValueOnce({ created: 0, skipped: 1, considered: 1 });
      (DbPromise.get as any).mockResolvedValue({ id: 'benefit-1' });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('pass');
      expect(handoffFromClosure).toHaveBeenCalledTimes(2);
      expect((handoffFromClosure as any).mock.calls[0][0]).toBe(CTX.organizationId);
      // Benefit read-back is tagged with the closure source.
      expect(DbPromise.get).toHaveBeenCalledWith(
        expect.stringContaining('FROM initiative_benefits'),
        expect.arrayContaining(['M14_CLOSURE_HANDOFF']),
        { fallback: true }
      );
      // Cleanup removes benefits, planned KPI and the initiative.
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM initiative_benefits'),
        expect.arrayContaining(['M14_CLOSURE_HANDOFF'])
      );
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM initiative_kpis'),
        expect.any(Array)
      );
    });

    it('FAILS when the re-run is not idempotent (duplicate benefit created)', async () => {
      (handoffFromClosure as any)
        .mockResolvedValueOnce({ created: 1, skipped: 0, considered: 1 })
        .mockResolvedValueOnce({ created: 1, skipped: 0, considered: 1 });
      (DbPromise.get as any).mockResolvedValue({ id: 'benefit-2' });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('fail');
      expect(result.errorMessage).toMatch(/idempotent/i);
    });
  });

  describe('gp8 — Results ↔ Finance reconciliation (units)', () => {
    const probe = getProbeById('gp8_results_finance_reconciliation_round_trip')!;

    const goodItem = {
      kpiId: 'kpi-recon-1',
      realizedValue: 72000,
      projectedValue: 90000,
      deviationAbsolute: -18000,
      deviationPercent: -20,
      unitMultiplier: 1000,
    };

    it('reconciles a %-KPI on the finance basis and verifies the persisted row', async () => {
      (resultsROIService.createKPI as any).mockResolvedValue({ kpiId: 'kpi-recon-1' });
      (pullAndReconcileInitiative as any).mockResolvedValue({
        reconciledCount: 1,
        offTrackCount: 1,
        items: [goodItem],
      });
      (DbPromise.get as any).mockResolvedValue({
        unit_multiplier: 1000,
        deviation_absolute: -18000,
      });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('pass');
      // The KPI is deliberately NON-monetary (percentage) — the unit-bug guard.
      const kpiArg = (resultsROIService.createKPI as any).mock.calls[0][0];
      expect(kpiArg.metricType).toBe('percentage');
      // Mapping carried an explicit unit multiplier.
      const mappingArg = (pullAndReconcileInitiative as any).mock.calls[0][2];
      expect(mappingArg[0]).toMatchObject({ kpiId: 'kpi-recon-1', unitMultiplier: 1000 });
      // Cleanup removed the reconciliation row and the KPI.
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM v8_kpi_finance_reconciliations'),
        [CTX.organizationId, 'kpi-recon-1']
      );
      expect(DbPromise.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM v8_kpi_definitions'),
        ['kpi-recon-1', CTX.organizationId]
      );
    });

    it('FAILS when the engine mixes bases (raw % vs currency — the OEE bug class)', async () => {
      (resultsROIService.createKPI as any).mockResolvedValue({ kpiId: 'kpi-recon-2' });
      (pullAndReconcileInitiative as any).mockResolvedValue({
        reconciledCount: 1,
        offTrackCount: 0,
        // Realized left in raw % (72) while projected is on the finance basis.
        items: [
          { ...goodItem, kpiId: 'kpi-recon-2', realizedValue: 72, deviationAbsolute: -89928 },
        ],
      });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('fail');
      expect(result.errorMessage).toMatch(/unit conversion broken/i);
    });

    it('FAILS when the persisted reconciliation row drifted from the engine result', async () => {
      (resultsROIService.createKPI as any).mockResolvedValue({ kpiId: 'kpi-recon-3' });
      (pullAndReconcileInitiative as any).mockResolvedValue({
        reconciledCount: 1,
        offTrackCount: 1,
        items: [{ ...goodItem, kpiId: 'kpi-recon-3' }],
      });
      (DbPromise.get as any).mockResolvedValue({ unit_multiplier: 1, deviation_absolute: -18 });

      const result = await runProbe(probe, CTX);

      expect(result.status).toBe('fail');
      expect(result.errorMessage).toMatch(/drifted/i);
    });
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
    (resultsROIService.recordROIRealization as any).mockResolvedValue({
      entryId: 'e',
      realizedValue: 4242,
    });
    (resultsROIService.getROIByInitiative as any).mockResolvedValue([
      { entryId: 'e', realizedValue: 4242 },
    ]);
    (getAuditLogger as any).mockReturnValue({ log: vi.fn().mockResolvedValue(undefined) });

    const results = await runAllProbes(CTX);
    expect(results).toHaveLength(HEALTH_PROBES.length);
    expect(results.map((r) => r.probeId).sort()).toEqual(HEALTH_PROBES.map((p) => p.id).sort());
  });
});
