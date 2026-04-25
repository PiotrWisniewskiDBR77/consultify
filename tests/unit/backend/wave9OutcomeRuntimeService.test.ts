import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  outcomes: new Map<string, Row>(),
  health: new Map<string, Row>(),
  incidents: new Map<string, Row>(),
  acceptances: new Map<string, Row>(),
  uuidCounter: 0,
}));

function nextUuid() {
  db.uuidCounter += 1;
  return `wave9-id-${db.uuidCounter}`;
}

vi.mock('uuid', () => ({ v4: () => nextUuid() }));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX')) {
      return { changes: 0 };
    }
    if (normalized.startsWith('INSERT INTO wave9_outcomes')) {
      const [
        outcomeId,
        organizationId,
        initiativeId,
        kpiName,
        ownerUserId,
        baseline,
        target,
        currentValue,
        confidence,
        assumptionsJson,
        taskIdsJson,
        sourceRefsJson,
        complianceJson,
        roiJson,
        auditJson,
      ] = params;
      db.outcomes.set(outcomeId, {
        outcome_id: outcomeId,
        organization_id: organizationId,
        initiative_id: initiativeId,
        kpi_name: kpiName,
        owner_user_id: ownerUserId,
        baseline,
        target,
        current_value: currentValue,
        confidence,
        assumptions_json: assumptionsJson,
        task_ids_json: taskIdsJson,
        source_refs_json: sourceRefsJson,
        compliance_json: complianceJson,
        roi_json: roiJson,
        audit_json: auditJson,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave9_provider_health')) {
      const [healthId, organizationId, provider, model, status, latencyMs, errorRate, costUsd] =
        params;
      db.health.set(healthId, {
        health_id: healthId,
        organization_id: organizationId,
        provider,
        model,
        status,
        latency_ms: latencyMs,
        error_rate: errorRate,
        cost_usd: costUsd,
        checked_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave9_incidents')) {
      const [incidentId, organizationId, severity, title, status, rollbackFlag, playbookJson] =
        params;
      db.incidents.set(incidentId, {
        incident_id: incidentId,
        organization_id: organizationId,
        severity,
        title,
        status,
        rollback_flag: rollbackFlag,
        playbook_json: playbookJson,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave9_acceptance_decisions')) {
      const [decisionId, organizationId, decision, reportJson, limitationsJson, createdBy] = params;
      db.acceptances.set(decisionId, {
        decision_id: decisionId,
        organization_id: organizationId,
        decision,
        report_json: reportJson,
        accepted_limitations_json: limitationsJson,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    throw new Error(`Unhandled dbRun SQL: ${normalized}`);
  },
  get: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM wave9_outcomes')) {
      const row = db.outcomes.get(params[0]);
      return row && (!params[1] || row.organization_id === params[1]) ? row : null;
    }
    if (normalized.includes('FROM wave9_provider_health')) return db.health.get(params[0]) || null;
    if (normalized.includes('FROM wave9_incidents')) return db.incidents.get(params[0]) || null;
    throw new Error(`Unhandled dbGet SQL: ${normalized}`);
  },
  all: async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM wave9_outcomes')) {
      return Array.from(db.outcomes.values()).filter((row) => row.organization_id === params[0]);
    }
    if (normalized.includes('FROM wave9_provider_health')) {
      return Array.from(db.health.values()).filter((row) => row.organization_id === params[0]);
    }
    if (normalized.includes('FROM wave9_incidents')) {
      return Array.from(db.incidents.values()).filter((row) => row.organization_id === params[0]);
    }
    throw new Error(`Unhandled dbAll SQL: ${normalized}`);
  },
}));

describe('Wave 9 outcome, AI Ops and final acceptance runtime', () => {
  beforeEach(() => {
    db.outcomes.clear();
    db.health.clear();
    db.incidents.clear();
    db.acceptances.clear();
    db.uuidCounter = 0;
    vi.resetModules();
  });

  it('requires explicit assumptions and creates KPI/ROI linkage with confidence', async () => {
    const { createWave9Outcome } = await import(
      '../../../server/src/services/wave9OutcomeRuntimeService.js'
    );

    await expect(
      createWave9Outcome({
        organizationId: 'org-1',
        userId: 'user-1',
        initiativeId: 'initiative-1',
        kpiName: 'Savings',
        ownerUserId: 'owner-1',
        baseline: 10,
        target: 30,
        confidence: 0.8,
        assumptions: [],
      })
    ).rejects.toThrow('requires explicit assumptions');

    await expect(
      createWave9Outcome({
        organizationId: 'org-1',
        userId: 'user-1',
        initiativeId: 'initiative-1',
        kpiName: 'Savings',
        ownerUserId: 'owner-1',
        baseline: 10,
        target: 30,
        confidence: 0.8,
        assumptions: ['Assumption exists'],
        sourceRefs: [],
      })
    ).rejects.toThrow('requires source references');

    const outcome = await createWave9Outcome({
      organizationId: 'org-1',
      userId: 'user-1',
      initiativeId: 'initiative-1',
      kpiName: 'Savings',
      ownerUserId: 'owner-1',
      baseline: 10,
      target: 30,
      confidence: 0.8,
      assumptions: ['Savings measured against baseline', 'Adoption reaches 70%'],
      taskIds: ['task-1', 'task-2'],
      sourceRefs: [{ sourceType: 'initiative', sourceId: 'initiative-1', title: 'PMO evidence' }],
      investment: 100000,
      annualBenefit: 180000,
    });

    expect(outcome.initiativeId).toBe('initiative-1');
    expect(outcome.roi.available).toBe(true);
    expect(outcome.roi.riskAdjustedRoiPercent).toBeGreaterThan(0);
    expect(outcome.audit.noHallucinatedKpi).toBe(true);
    expect(outcome.taskIds).toEqual(['task-1', 'task-2']);
    expect(outcome.compliance.dataLineageCaptured).toBe(true);
  });

  it('builds CFO scenarios and reports with assumptions, confidence and audit', async () => {
    const { buildWave9FinanceScenarios, buildWave9Report, createWave9Outcome } = await import(
      '../../../server/src/services/wave9OutcomeRuntimeService.js'
    );
    const outcome = await createWave9Outcome({
      organizationId: 'org-1',
      userId: 'user-1',
      initiativeId: 'initiative-1',
      kpiName: 'Revenue uplift',
      ownerUserId: 'owner-1',
      baseline: 100,
      target: 150,
      confidence: 0.7,
      assumptions: ['Pipeline conversion improves'],
      sourceRefs: [{ sourceType: 'kpi', sourceId: 'kpi-1' }],
      investment: 50000,
      annualBenefit: 120000,
    });

    const scenarios = await buildWave9FinanceScenarios({
      organizationId: 'org-1',
      outcomeId: outcome.outcomeId,
    });
    expect(scenarios.scenarios.map((scenario: any) => scenario.name)).toEqual(
      expect.arrayContaining(['conservative', 'base', 'optimistic', 'risk_adjusted'])
    );

    const report = await buildWave9Report({
      organizationId: 'org-1',
      outcomeId: outcome.outcomeId,
      reportType: 'investor_ready',
    });
    expect(report.businessEffectSummary.assumptions).toContain('Pipeline conversion improves');
    expect(report.audit.assumptionsVisible).toBe(true);
    expect(report.audit.confidenceVisible).toBe(true);
    expect(report.audit.complianceVisible).toBe(true);
  });

  it('tracks provider health, incidents, rollback flags and final acceptance decisions', async () => {
    const {
      buildWave9AIOpsDashboard,
      recordWave9Incident,
      recordWave9ProviderHealth,
      runWave9FinalAcceptance,
    } = await import('../../../server/src/services/wave9OutcomeRuntimeService.js');

    await recordWave9ProviderHealth({
      organizationId: 'org-1',
      provider: 'primary',
      model: 'gpt',
      status: 'healthy',
      latencyMs: 500,
      errorRate: 0.01,
      costUsd: 12,
    });
    await recordWave9Incident({
      organizationId: 'org-1',
      severity: 'critical',
      title: 'Provider unavailable',
      rollbackFlag: 'ai.provider.primary.disabled',
    });

    const dashboard = await buildWave9AIOpsDashboard({ organizationId: 'org-1' });
    expect(dashboard.providerHealth[0].status).toBe('healthy');
    expect(dashboard.incidentLog[0].rollbackFlag).toBe('ai.provider.primary.disabled');
    expect(dashboard.evalDashboard.latestGate).toBe('BLOCKED');

    const blocked = await runWave9FinalAcceptance({
      organizationId: 'org-1',
      userId: 'user-1',
      regressionPassed: true,
      cisoPackPassed: true,
      businessPersonaPackPassed: true,
      providerHealthOk: false,
      complianceAuditPassed: true,
      openP0: 0,
      openP1: 0,
      evidenceRefs: {
        regressionRunId: 'reg-1',
        cisoPackRunId: 'ciso-1',
        businessPersonaPackRunId: 'persona-1',
        complianceAuditRef: 'audit-1',
      },
    });
    expect(blocked.decision).toBe('BLOCKED');

    const pass = await runWave9FinalAcceptance({
      organizationId: 'org-1',
      userId: 'user-1',
      regressionPassed: true,
      cisoPackPassed: true,
      businessPersonaPackPassed: true,
      providerHealthOk: true,
      complianceAuditPassed: true,
      openP0: 0,
      openP1: 0,
      evidenceRefs: {
        regressionRunId: 'reg-1',
        cisoPackRunId: 'ciso-1',
        businessPersonaPackRunId: 'persona-1',
        complianceAuditRef: 'audit-1',
      },
    });
    expect(pass.decision).toBe('PASS');
    expect(pass.report.releaseNote).toContain('Consultify AI OS');
  });

  it('exposes Wave 9 API, UI, migration and route contract', () => {
    const gateway = readFileSync('server/src/Gateway.ts', 'utf8');
    const routes = readFileSync('server/src/routes/wave9-outcomes.routes.ts', 'utf8');
    const api = readFileSync('src/services/api.ts', 'utf8');
    const panel = readFileSync('src/components/AIChat/Wave9OutcomeAIOpsPanel.tsx', 'utf8');
    const appRoutes = readFileSync('src/routes/AppRoutes.tsx', 'utf8');
    const migration = readFileSync('server/migrations/20260425_wave9_outcome_runtime.sql', 'utf8');

    expect(gateway).toContain('/api/ai-outcomes');
    expect(routes).toContain('/acceptance');
    expect(routes).toContain('/aiops');
    expect(api).toContain('runWave9FinalAcceptance');
    expect(panel).toContain('Wave 9 Outcome & AI Ops');
    expect(panel).toContain('Simulate provider unavailable');
    expect(appRoutes).toContain('/ai/outcomes');
    expect(migration).toContain('wave9_acceptance_decisions');
  });
});
