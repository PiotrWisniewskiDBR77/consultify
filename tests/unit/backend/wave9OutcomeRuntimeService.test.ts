import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const db = vi.hoisted(() => ({
  outcomes: new Map<string, Row>(),
  health: new Map<string, Row>(),
  incidents: new Map<string, Row>(),
  acceptances: new Map<string, Row>(),
  acceptanceRuns: new Map<string, Row>(),
  evidence: new Map<string, Row>(),
  evalRuns: new Map<string, Row>(),
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
    if (
      normalized.startsWith('CREATE TABLE') ||
      normalized.startsWith('CREATE INDEX') ||
      normalized.startsWith('CREATE UNIQUE INDEX')
    ) {
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
    if (normalized.startsWith('INSERT INTO wave9_evidence_registry')) {
      const [
        evidenceId,
        organizationId,
        evidenceType,
        sourceType,
        sourceId,
        title,
        status,
        verifiedBy,
        verificationMethod,
        payloadJson,
      ] = params;
      db.evidence.set(evidenceId, {
        evidence_id: evidenceId,
        organization_id: organizationId,
        evidence_type: evidenceType,
        source_type: sourceType,
        source_id: sourceId,
        title,
        status,
        verified_by: verifiedBy,
        verification_method: verificationMethod,
        payload_json: payloadJson,
        created_at: new Date().toISOString(),
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
    if (normalized.startsWith('INSERT INTO wave9_acceptance_runs')) {
      const [
        runId,
        organizationId,
        runType,
        status,
        runRef,
        buildId,
        commitSha,
        verifiedBy,
        verificationMethod,
        payloadJson,
      ] = params;
      db.acceptanceRuns.set(runId, {
        run_id: runId,
        organization_id: organizationId,
        run_type: runType,
        status,
        run_ref: runRef,
        build_id: buildId,
        commit_sha: commitSha,
        verified_by: verifiedBy,
        verification_method: verificationMethod,
        payload_json: payloadJson,
        verified_at: new Date().toISOString(),
      });
      return { changes: 1 };
    }
    if (normalized.startsWith('INSERT INTO wave9_eval_runs')) {
      const [
        evalId,
        organizationId,
        promptKey,
        promptVersion,
        category,
        status,
        score,
        hallucinationCheckPassed,
        toolMisuseCheckPassed,
        runRef,
        detailsJson,
      ] = params;
      db.evalRuns.set(evalId, {
        eval_id: evalId,
        organization_id: organizationId,
        prompt_key: promptKey,
        prompt_version: promptVersion,
        category,
        status,
        score,
        hallucination_check_passed: hallucinationCheckPassed,
        tool_misuse_check_passed: toolMisuseCheckPassed,
        run_ref: runRef,
        details_json: detailsJson,
        evaluated_at: new Date().toISOString(),
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
    if (normalized.includes('FROM wave9_eval_runs')) return db.evalRuns.get(params[0]) || null;
    if (normalized.includes('FROM wave9_acceptance_runs')) {
      if (params.length === 1) return db.acceptanceRuns.get(params[0]) || null;
      return (
        Array.from(db.acceptanceRuns.values()).find(
          (row) =>
            row.organization_id === params[0] &&
            row.run_id === params[1] &&
            row.run_type === params[2]
        ) || null
      );
    }
    if (normalized.includes('FROM wave9_evidence_registry')) {
      if (normalized.includes('evidence_id')) {
        if (params.length === 1) return db.evidence.get(params[0]) || null;
        return (
          Array.from(db.evidence.values()).find(
            (row) =>
              row.organization_id === params[0] &&
              row.evidence_id === params[1] &&
              row.evidence_type === params[2] &&
              row.status === 'pass'
          ) || null
        );
      }
      if (normalized.includes("evidence_type = 'task'")) {
        return (
          Array.from(db.evidence.values()).find(
            (row) =>
              row.organization_id === params[0] &&
              row.evidence_type === 'task' &&
              row.source_type === 'task' &&
              row.source_id === params[1] &&
              row.status === 'pass'
          ) || null
        );
      }
      return (
        Array.from(db.evidence.values()).find(
          (row) =>
            row.organization_id === params[0] &&
            row.source_type === params[1] &&
            row.source_id === params[2] &&
            row.status === 'pass'
        ) || null
      );
    }
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
    if (normalized.includes('FROM wave9_eval_runs')) {
      return Array.from(db.evalRuns.values()).filter((row) => row.organization_id === params[0]);
    }
    if (normalized.includes('FROM wave9_acceptance_runs')) {
      return Array.from(db.acceptanceRuns.values()).filter(
        (row) => row.organization_id === params[0]
      );
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
    db.acceptanceRuns.clear();
    db.evidence.clear();
    db.evalRuns.clear();
    db.uuidCounter = 0;
    vi.resetModules();
  });

  it('requires explicit assumptions and creates KPI/ROI linkage with confidence', async () => {
    const { createWave9Outcome, registerWave9Evidence } =
      await import('../../../server/src/services/wave9OutcomeRuntimeService.js');

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

    await registerWave9Evidence({
      organizationId: 'org-1',
      evidenceType: 'initiative',
      sourceType: 'initiative',
      sourceId: 'initiative-1',
      title: 'PMO evidence',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
    await registerWave9Evidence({
      organizationId: 'org-1',
      evidenceType: 'task',
      sourceType: 'task',
      sourceId: 'task-1',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
    await registerWave9Evidence({
      organizationId: 'org-1',
      evidenceType: 'task',
      sourceType: 'task',
      sourceId: 'task-2',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
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
    const {
      buildWave9FinanceScenarios,
      buildWave9Report,
      createWave9Outcome,
      registerWave9Evidence,
    } = await import('../../../server/src/services/wave9OutcomeRuntimeService.js');
    await registerWave9Evidence({
      organizationId: 'org-1',
      evidenceType: 'kpi',
      sourceType: 'kpi',
      sourceId: 'kpi-1',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
    await registerWave9Evidence({
      organizationId: 'org-1',
      evidenceType: 'task',
      sourceType: 'task',
      sourceId: 'task-1',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
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
      taskIds: ['task-1'],
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
    expect(report.audience.label).toContain('Investors');
    expect(report.sections.map((section: any) => section.id)).toEqual(
      expect.arrayContaining(['investor-value-thesis', 'investor-scenario-sensitivity'])
    );

    const cisoReport = await buildWave9Report({
      organizationId: 'org-1',
      outcomeId: outcome.outcomeId,
      reportType: 'ciso_security',
    });
    expect(cisoReport.sections.map((section: any) => section.id)).toContain('ciso-source-lineage');
    expect(cisoReport.complianceAudit.dataLineageCaptured).toBe(true);
  });

  it('validates evidence, provider status and eval-backed AI Ops gates', async () => {
    const {
      buildWave9AIOpsDashboard,
      recordWave9EvalRun,
      recordWave9ProviderHealth,
      registerWave9Evidence,
    } = await import('../../../server/src/services/wave9OutcomeRuntimeService.js');

    await expect(
      registerWave9Evidence({
        organizationId: 'org-1',
        evidenceType: 'kpi',
        sourceType: 'kpi',
        sourceId: '',
        status: 'pass',
        verifiedBy: 'qa',
        verificationMethod: 'unit_test',
      })
    ).rejects.toThrow('evidence source id is required');

    await expect(
      registerWave9Evidence({
        organizationId: 'org-1',
        evidenceType: 'kpi',
        sourceType: 'kpi',
        sourceId: 'kpi-1',
        status: 'pass',
      })
    ).rejects.toThrow('requires verifier');

    await expect(
      recordWave9ProviderHealth({
        organizationId: 'org-1',
        provider: 'primary',
        status: 'broken' as any,
      })
    ).rejects.toThrow('Invalid Wave 9 provider status');

    await recordWave9ProviderHealth({
      organizationId: 'org-1',
      provider: 'primary',
      model: 'gpt',
      status: 'healthy',
      costUsd: 3,
    });
    await recordWave9EvalRun({
      organizationId: 'org-1',
      promptKey: 'golden-ai-os',
      status: 'pass',
      score: 0.91,
      hallucinationCheckPassed: true,
      toolMisuseCheckPassed: true,
    });
    const passingDashboard = await buildWave9AIOpsDashboard({ organizationId: 'org-1' });
    expect(passingDashboard.providerHealthSummary.byStatus.healthy).toBe(1);
    expect(passingDashboard.evalDashboard.latestGate).toBe('PASS');

    await recordWave9EvalRun({
      organizationId: 'org-1',
      promptKey: 'golden-ai-os',
      status: 'fail',
      score: 0.2,
      hallucinationCheckPassed: false,
      toolMisuseCheckPassed: true,
    });
    const blockedDashboard = await buildWave9AIOpsDashboard({ organizationId: 'org-1' });
    expect(blockedDashboard.evalDashboard.latestGate).toBe('BLOCKED');
    expect(blockedDashboard.evalDashboard.failed).toBe(1);
  });

  it('prefers acceptance-run registry status over raw final-acceptance flags', async () => {
    const {
      recordWave9EvalRun,
      registerWave9AcceptanceRun,
      runWave9FinalAcceptance,
    } = await import('../../../server/src/services/wave9OutcomeRuntimeService.js');

    await recordWave9EvalRun({
      organizationId: 'org-1',
      promptKey: 'golden-ai-os-release',
      status: 'pass',
      hallucinationCheckPassed: true,
      toolMisuseCheckPassed: true,
    });

    const regressionRun = await registerWave9AcceptanceRun({
      organizationId: 'org-1',
      runType: 'regression_pack',
      status: 'pass',
      runRef: 'regression-123',
      buildId: 'build-abc',
      commitSha: 'abc123',
      verifiedBy: 'qa',
      verificationMethod: 'ci_registry',
      payload: { suite: 'regression' },
    });
    const cisoRun = await registerWave9AcceptanceRun({
      organizationId: 'org-1',
      runType: 'ciso_pack',
      status: 'fail',
      runRef: 'ciso-123',
      verifiedBy: 'security',
      verificationMethod: 'security_pack',
    });
    const personaRun = await registerWave9AcceptanceRun({
      organizationId: 'org-1',
      runType: 'business_persona_pack',
      status: 'pass',
      runRef: 'persona-123',
      verifiedBy: 'product',
      verificationMethod: 'persona_pack',
    });
    const auditRun = await registerWave9AcceptanceRun({
      organizationId: 'org-1',
      runType: 'compliance_audit',
      status: 'pass',
      runRef: 'audit-123',
      verifiedBy: 'compliance',
      verificationMethod: 'audit_pack',
    });
    const aiOpsRun = await registerWave9AcceptanceRun({
      organizationId: 'org-1',
      runType: 'ai_ops_eval_pack',
      status: 'pass',
      runRef: 'eval-123',
      verifiedBy: 'ai-ops',
      verificationMethod: 'eval_pack',
    });

    const decision = await runWave9FinalAcceptance({
      organizationId: 'org-1',
      userId: 'user-1',
      regressionPassed: false,
      cisoPackPassed: true,
      businessPersonaPackPassed: false,
      providerHealthOk: true,
      complianceAuditPassed: false,
      openP0: 0,
      openP1: 0,
      evidenceRefs: {
        regressionRunId: regressionRun.runId,
        cisoPackRunId: cisoRun.runId,
        businessPersonaPackRunId: personaRun.runId,
        complianceAuditRef: auditRun.runId,
        aiOpsEvalRunId: aiOpsRun.runId,
      },
    });

    expect(decision.decision).toBe('BLOCKED');
    expect(decision.report.blockers).toEqual(['ciso_pack_failed']);
    expect(decision.report.regressionPassed).toBe(true);
    expect(decision.report.businessPersonaPackPassed).toBe(true);
    expect(decision.report.complianceAuditPassed).toBe(true);
    expect(decision.report.acceptanceRunEvidence.regression.runRef).toBe('regression-123');
    expect(decision.report.acceptanceRunEvidence.regression.buildId).toBe('build-abc');
  });

  it('tracks provider health, incidents, rollback flags and final acceptance decisions', async () => {
    const {
      buildWave9AIOpsDashboard,
      recordWave9EvalRun,
      recordWave9Incident,
      recordWave9ProviderHealth,
      registerWave9Evidence,
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
    const regressionEvidence = await registerWave9Evidence({
      organizationId: 'org-1',
      evidenceType: 'regression_pack',
      sourceType: 'regression_pack',
      sourceId: 'reg-1',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
    const cisoEvidence = await registerWave9Evidence({
      organizationId: 'org-1',
      evidenceType: 'ciso_pack',
      sourceType: 'ciso_pack',
      sourceId: 'ciso-1',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
    const personaEvidence = await registerWave9Evidence({
      organizationId: 'org-1',
      evidenceType: 'business_persona_pack',
      sourceType: 'business_persona_pack',
      sourceId: 'persona-1',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
    const auditEvidence = await registerWave9Evidence({
      organizationId: 'org-1',
      evidenceType: 'compliance_audit',
      sourceType: 'compliance_audit',
      sourceId: 'audit-1',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });

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
        regressionRunId: regressionEvidence.evidence_id,
        cisoPackRunId: cisoEvidence.evidence_id,
        businessPersonaPackRunId: personaEvidence.evidence_id,
        complianceAuditRef: auditEvidence.evidence_id,
      },
    });
    expect(blocked.decision).toBe('BLOCKED');
    expect(blocked.report.blockers).toContain('ai_ops_eval_gate_failed');

    await recordWave9EvalRun({
      organizationId: 'org-2',
      promptKey: 'golden-ai-os-release',
      status: 'pass',
      score: 0.94,
      hallucinationCheckPassed: true,
      toolMisuseCheckPassed: true,
    });
    const passRegressionEvidence = await registerWave9Evidence({
      organizationId: 'org-2',
      evidenceType: 'regression_pack',
      sourceType: 'regression_pack',
      sourceId: 'reg-2',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
    const passCisoEvidence = await registerWave9Evidence({
      organizationId: 'org-2',
      evidenceType: 'ciso_pack',
      sourceType: 'ciso_pack',
      sourceId: 'ciso-2',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
    const passPersonaEvidence = await registerWave9Evidence({
      organizationId: 'org-2',
      evidenceType: 'business_persona_pack',
      sourceType: 'business_persona_pack',
      sourceId: 'persona-2',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });
    const passAuditEvidence = await registerWave9Evidence({
      organizationId: 'org-2',
      evidenceType: 'compliance_audit',
      sourceType: 'compliance_audit',
      sourceId: 'audit-2',
      status: 'pass',
      verifiedBy: 'qa',
      verificationMethod: 'unit_test',
    });

    const pass = await runWave9FinalAcceptance({
      organizationId: 'org-2',
      userId: 'user-1',
      regressionPassed: true,
      cisoPackPassed: true,
      businessPersonaPackPassed: true,
      providerHealthOk: true,
      complianceAuditPassed: true,
      openP0: 0,
      openP1: 0,
      evidenceRefs: {
        regressionRunId: passRegressionEvidence.evidence_id,
        cisoPackRunId: passCisoEvidence.evidence_id,
        businessPersonaPackRunId: passPersonaEvidence.evidence_id,
        complianceAuditRef: passAuditEvidence.evidence_id,
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
    const hub = readFileSync('src/components/AIChat/AIOSHub.tsx', 'utf8');
    const gateReport = readFileSync('src/components/AIChat/AIOSWave0GateReport.tsx', 'utf8');
    const v10Workspace = readFileSync('src/components/v10/V10TeresaRuntimeWorkspace.tsx', 'utf8');
    const v10Hook = readFileSync('src/hooks/v10/useV10TeresaRuntime.ts', 'utf8');

    expect(gateway).toContain('/api/ai-outcomes');
    expect(routes).toContain('/acceptance');
    expect(routes).toContain('/acceptance-runs');
    expect(routes).toContain('/evidence');
    expect(routes).toContain('/aiops');
    expect(api).toContain('runWave9FinalAcceptance');
    expect(api).toContain('registerWave9AcceptanceRun');
    expect(api).toContain('registerWave9Evidence');
    expect(api).toContain('recordWave9EvalRun');
    expect(panel).toContain('wave9OutcomeAiOps');
    expect(panel).toContain('recordGoldenEvalPass');
    expect(panel).toContain('simulateProviderUnavailable');
    expect(hub).toContain('AIOSWave0GateReport');
    expect(hub).toContain('V10TeresaRuntimeWorkspace');
    expect(gateReport).toContain('AI OS Build Milestones');
    expect(gateReport).toContain('Runtime truth');
    expect(v10Workspace).toContain('V10 Frontend Runtime');
    expect(v10Hook).toContain('/api/v10/teresa/voice-config');
    expect(appRoutes).toContain('path={ROUTES.AI_OS.OUTCOMES}');
    expect(migration).toContain('wave9_acceptance_decisions');
    expect(migration).toContain('wave9_acceptance_runs');
    expect(migration).toContain('wave9_evidence_registry');
    expect(migration).toContain('wave9_eval_runs');
  });
});
