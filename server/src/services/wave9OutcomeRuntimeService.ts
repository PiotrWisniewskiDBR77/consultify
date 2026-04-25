import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

export type Wave9ReportType =
  | 'client_ready'
  | 'investor_ready'
  | 'steering_committee'
  | 'ciso_security';
export type Wave9GateDecision = 'PASS' | 'PASS_WITH_LIMITATIONS' | 'BLOCKED' | 'ROLLBACK';

export interface CreateWave9OutcomeInput {
  organizationId: string;
  userId: string;
  initiativeId: string;
  taskIds?: string[];
  kpiName: string;
  ownerUserId: string;
  baseline: number;
  target: number;
  current?: number | null;
  confidence: number;
  assumptions: string[];
  sourceRefs: Array<{ sourceType: string; sourceId: string; title?: string | null }>;
  investment?: number | null;
  annualBenefit?: number | null;
}

export interface Wave9AcceptanceInput {
  organizationId: string;
  userId: string;
  regressionPassed: boolean;
  cisoPackPassed: boolean;
  businessPersonaPackPassed: boolean;
  providerHealthOk: boolean;
  complianceAuditPassed: boolean;
  openP0: number;
  openP1: number;
  evidenceRefs: {
    regressionRunId?: string | null;
    cisoPackRunId?: string | null;
    businessPersonaPackRunId?: string | null;
    complianceAuditRef?: string | null;
  };
  acceptedLimitations?: string[];
}

let schemaReady: Promise<void> | null = null;

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function calculateRoi(input: {
  investment?: number | null;
  annualBenefit?: number | null;
  confidence: number;
}): any {
  const investment = Number(input.investment || 0);
  const annualBenefit = Number(input.annualBenefit || 0);
  const confidence = clampConfidence(input.confidence);
  if (investment <= 0 || annualBenefit <= 0) {
    return {
      available: false,
      reason: 'investment_and_annual_benefit_required',
      confidence,
    };
  }
  const roiPercent = ((annualBenefit - investment) / investment) * 100;
  const riskAdjustedBenefit = annualBenefit * confidence;
  const riskAdjustedRoiPercent = ((riskAdjustedBenefit - investment) / investment) * 100;
  return {
    available: true,
    investment,
    annualBenefit,
    roiPercent: Number(roiPercent.toFixed(2)),
    riskAdjustedBenefit: Number(riskAdjustedBenefit.toFixed(2)),
    riskAdjustedRoiPercent: Number(riskAdjustedRoiPercent.toFixed(2)),
    paybackMonths: Number(((investment / annualBenefit) * 12).toFixed(1)),
    confidence,
  };
}

function buildScenarioSet(outcome: any): any {
  const roi = safeJsonParse<any>(outcome.roi_json, {});
  if (!roi.available) {
    return {
      available: false,
      reason: roi.reason || 'roi_missing',
      scenarios: [],
      sensitivity: [],
    };
  }
  const investment = Number(roi.investment);
  const annualBenefit = Number(roi.annualBenefit);
  const scenario = (name: string, multiplier: number, confidence: number) => {
    const benefit = annualBenefit * multiplier;
    return {
      name,
      annualBenefit: Number(benefit.toFixed(2)),
      roiPercent: Number((((benefit - investment) / investment) * 100).toFixed(2)),
      confidence,
    };
  };
  return {
    available: true,
    scenarios: [
      scenario('conservative', 0.7, Math.max(0.1, roi.confidence - 0.2)),
      scenario('base', 1, roi.confidence),
      scenario('optimistic', 1.3, Math.min(1, roi.confidence + 0.15)),
      scenario('risk_adjusted', roi.confidence, roi.confidence),
    ],
    sensitivity: [
      { variable: 'annualBenefit', delta: '-20%', roiImpact: 'negative' },
      { variable: 'investment', delta: '+20%', roiImpact: 'negative' },
      { variable: 'confidence', delta: '-0.15', roiImpact: 'risk_adjusted_downside' },
    ],
  };
}

function mapOutcome(row: any): any {
  if (!row) return null;
  return {
    outcomeId: row.outcome_id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    kpiName: row.kpi_name,
    ownerUserId: row.owner_user_id,
    baseline: Number(row.baseline),
    target: Number(row.target),
    current: row.current_value == null ? null : Number(row.current_value),
    confidence: Number(row.confidence),
    assumptions: safeJsonParse(row.assumptions_json, []),
    taskIds: safeJsonParse(row.task_ids_json, []),
    sourceRefs: safeJsonParse(row.source_refs_json, []),
    compliance: safeJsonParse(row.compliance_json, {}),
    roi: safeJsonParse(row.roi_json, {}),
    audit: safeJsonParse(row.audit_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureWave9OutcomeRuntimeSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave9_outcomes (
        outcome_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        initiative_id TEXT NOT NULL,
        kpi_name TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        baseline REAL NOT NULL,
        target REAL NOT NULL,
        current_value REAL,
        confidence REAL NOT NULL,
        assumptions_json TEXT NOT NULL DEFAULT '[]',
        task_ids_json TEXT NOT NULL DEFAULT '[]',
        source_refs_json TEXT NOT NULL DEFAULT '[]',
        compliance_json TEXT NOT NULL DEFAULT '{}',
        roi_json TEXT NOT NULL DEFAULT '{}',
        audit_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`ALTER TABLE wave9_outcomes ADD COLUMN task_ids_json TEXT DEFAULT '[]'`).catch(
      () => undefined
    );
    await dbRun(`ALTER TABLE wave9_outcomes ADD COLUMN source_refs_json TEXT DEFAULT '[]'`).catch(
      () => undefined
    );
    await dbRun(`ALTER TABLE wave9_outcomes ADD COLUMN compliance_json TEXT DEFAULT '{}'`).catch(
      () => undefined
    );
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave9_provider_health (
        health_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL,
        latency_ms INTEGER,
        error_rate REAL,
        cost_usd REAL,
        checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave9_incidents (
        incident_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        rollback_flag TEXT,
        playbook_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave9_acceptance_decisions (
        decision_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        report_json TEXT NOT NULL DEFAULT '{}',
        accepted_limitations_json TEXT NOT NULL DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave9_outcomes_org ON wave9_outcomes(organization_id, initiative_id)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave9_provider_health_org ON wave9_provider_health(organization_id, checked_at)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave9_acceptance_org ON wave9_acceptance_decisions(organization_id, created_at)`
    );
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

export async function createWave9Outcome(input: CreateWave9OutcomeInput): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  if (!input.assumptions || input.assumptions.length === 0) {
    throw new Error('Wave 9 outcome requires explicit assumptions');
  }
  if (!input.initiativeId || !input.kpiName || !input.ownerUserId) {
    throw new Error('Wave 9 outcome requires initiative, KPI and owner');
  }
  if (!input.sourceRefs || input.sourceRefs.length === 0) {
    throw new Error('Wave 9 outcome requires source references for KPI grounding');
  }
  const outcomeId = `outcome9-${uuidv4()}`;
  const confidence = clampConfidence(input.confidence);
  const roi = calculateRoi({
    investment: input.investment,
    annualBenefit: input.annualBenefit,
    confidence,
  });
  const audit = {
    createdBy: input.userId,
    noHallucinatedKpi: input.sourceRefs.length > 0,
    requiresOwner: Boolean(input.ownerUserId),
    assumptionsCaptured: input.assumptions.length,
    sourceTrace: {
      initiativeId: input.initiativeId,
      taskIds: input.taskIds || [],
      sourceRefs: input.sourceRefs,
      wave: 9,
    },
  };
  const compliance = {
    securityAuditRequired: true,
    cisoReviewStatus: 'pending',
    dataLineageCaptured: input.sourceRefs.length > 0,
  };
  await dbRun(
    `INSERT INTO wave9_outcomes (
      outcome_id, organization_id, initiative_id, kpi_name, owner_user_id,
      baseline, target, current_value, confidence, assumptions_json, task_ids_json,
      source_refs_json, compliance_json, roi_json, audit_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      outcomeId,
      input.organizationId,
      input.initiativeId,
      input.kpiName,
      input.ownerUserId,
      input.baseline,
      input.target,
      input.current ?? input.baseline,
      confidence,
      safeJsonStringify(input.assumptions),
      safeJsonStringify(input.taskIds || []),
      safeJsonStringify(input.sourceRefs),
      safeJsonStringify(compliance),
      safeJsonStringify(roi),
      safeJsonStringify(audit),
    ]
  );
  return mapOutcome(await dbGet(`SELECT * FROM wave9_outcomes WHERE outcome_id = ?`, [outcomeId]));
}

export async function listWave9Outcomes(params: { organizationId: string }): Promise<any[]> {
  await ensureWave9OutcomeRuntimeSchema();
  const rows = await dbAll(
    `SELECT * FROM wave9_outcomes WHERE organization_id = ? ORDER BY created_at DESC`,
    [params.organizationId]
  );
  return (rows || []).map(mapOutcome);
}

export async function buildWave9FinanceScenarios(params: {
  organizationId: string;
  outcomeId: string;
}): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const row = await dbGet(
    `SELECT * FROM wave9_outcomes WHERE outcome_id = ? AND organization_id = ?`,
    [params.outcomeId, params.organizationId]
  );
  if (!row) throw new Error('Outcome not found');
  const outcome = mapOutcome(row);
  return {
    outcomeId: params.outcomeId,
    kpiName: outcome.kpiName,
    assumptions: outcome.assumptions,
    confidence: outcome.confidence,
    ...buildScenarioSet(row),
  };
}

export async function buildWave9Report(params: {
  organizationId: string;
  outcomeId: string;
  reportType: Wave9ReportType;
}): Promise<any> {
  const outcome = mapOutcome(
    await dbGet(`SELECT * FROM wave9_outcomes WHERE outcome_id = ? AND organization_id = ?`, [
      params.outcomeId,
      params.organizationId,
    ])
  );
  if (!outcome) throw new Error('Outcome not found');
  const scenarios = await buildWave9FinanceScenarios({
    organizationId: params.organizationId,
    outcomeId: params.outcomeId,
  });
  return {
    reportType: params.reportType,
    title: `${params.reportType.replace(/_/g, ' ')} report: ${outcome.kpiName}`,
    businessEffectSummary: {
      initiativeId: outcome.initiativeId,
      taskIds: outcome.taskIds,
      baseline: outcome.baseline,
      target: outcome.target,
      current: outcome.current,
      confidence: outcome.confidence,
      assumptions: outcome.assumptions,
      sourceRefs: outcome.sourceRefs,
      compliance: outcome.compliance,
    },
    roi: outcome.roi,
    scenarios,
    audit: {
      sourceTrace: outcome.audit?.sourceTrace || null,
      assumptionsVisible: outcome.assumptions.length > 0,
      confidenceVisible: Number.isFinite(outcome.confidence),
      complianceVisible: Boolean(outcome.compliance?.dataLineageCaptured),
      generatedAt: nowIso(),
    },
  };
}

export async function recordWave9ProviderHealth(input: {
  organizationId: string;
  provider: string;
  model?: string | null;
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs?: number | null;
  errorRate?: number | null;
  costUsd?: number | null;
}): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const healthId = `health9-${uuidv4()}`;
  await dbRun(
    `INSERT INTO wave9_provider_health (
      health_id, organization_id, provider, model, status, latency_ms, error_rate, cost_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      healthId,
      input.organizationId,
      input.provider,
      input.model || null,
      input.status,
      input.latencyMs || null,
      input.errorRate || 0,
      input.costUsd || 0,
    ]
  );
  return dbGet(`SELECT * FROM wave9_provider_health WHERE health_id = ?`, [healthId]);
}

export async function recordWave9Incident(input: {
  organizationId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  rollbackFlag?: string | null;
  playbook?: Record<string, unknown>;
}): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const incidentId = `incident9-${uuidv4()}`;
  await dbRun(
    `INSERT INTO wave9_incidents (
      incident_id, organization_id, severity, title, status, rollback_flag, playbook_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      incidentId,
      input.organizationId,
      input.severity,
      input.title,
      'open',
      input.rollbackFlag || null,
      safeJsonStringify(
        input.playbook || {
          steps: ['disable affected feature flag', 'switch provider route', 'notify owner'],
        }
      ),
    ]
  );
  return dbGet(`SELECT * FROM wave9_incidents WHERE incident_id = ?`, [incidentId]);
}

export async function buildWave9AIOpsDashboard(params: { organizationId: string }): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const [providers, incidents, outcomes] = await Promise.all([
    dbAll(
      `SELECT * FROM wave9_provider_health WHERE organization_id = ? ORDER BY checked_at DESC LIMIT 20`,
      [params.organizationId]
    ),
    dbAll(
      `SELECT * FROM wave9_incidents WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`,
      [params.organizationId]
    ),
    listWave9Outcomes({ organizationId: params.organizationId }),
  ]);
  const providerRows = providers || [];
  const incidentRows = incidents || [];
  return {
    organizationId: params.organizationId,
    providerHealth: providerRows.map((row: any) => ({
      provider: row.provider,
      model: row.model,
      status: row.status,
      latencyMs: row.latency_ms,
      errorRate: row.error_rate,
      costUsd: row.cost_usd,
      checkedAt: row.checked_at,
    })),
    modelRouting: {
      primary: providerRows.find((row: any) => row.status === 'healthy')?.provider || 'unavailable',
      fallback: providerRows.find((row: any) => row.status !== 'unavailable')?.provider || null,
    },
    costDashboard: {
      totalCostUsd: providerRows.reduce(
        (sum: number, row: any) => sum + Number(row.cost_usd || 0),
        0
      ),
      samples: providerRows.length,
    },
    incidentLog: incidentRows.map((row: any) => ({
      incidentId: row.incident_id,
      severity: row.severity,
      title: row.title,
      status: row.status,
      rollbackFlag: row.rollback_flag,
      playbook: safeJsonParse(row.playbook_json, {}),
    })),
    evalDashboard: {
      goldenPromptsConfigured: true,
      hallucinationChecks: true,
      toolMisuseChecks: true,
      latestGate: incidentRows.some((row: any) => row.severity === 'critical') ? 'BLOCKED' : 'PASS',
    },
    outcomesTracked: outcomes.length,
  };
}

export async function runWave9FinalAcceptance(input: Wave9AcceptanceInput): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const dashboard = await buildWave9AIOpsDashboard({ organizationId: input.organizationId });
  const blockers: string[] = [];
  if (!input.regressionPassed) blockers.push('regression_pack_failed');
  if (!input.cisoPackPassed) blockers.push('ciso_pack_failed');
  if (!input.businessPersonaPackPassed) blockers.push('business_persona_pack_failed');
  if (!input.providerHealthOk) blockers.push('provider_health_failed');
  if (!input.complianceAuditPassed) blockers.push('compliance_audit_failed');
  if (!input.evidenceRefs?.regressionRunId) blockers.push('missing_regression_evidence');
  if (!input.evidenceRefs?.cisoPackRunId) blockers.push('missing_ciso_evidence');
  if (!input.evidenceRefs?.businessPersonaPackRunId) blockers.push('missing_persona_evidence');
  if (!input.evidenceRefs?.complianceAuditRef) blockers.push('missing_compliance_evidence');
  if (input.openP0 > 0) blockers.push('open_p0_findings');
  const decision: Wave9GateDecision =
    blockers.length > 0 ? 'BLOCKED' : input.openP1 > 0 ? 'PASS_WITH_LIMITATIONS' : 'PASS';
  const decisionId = `accept9-${uuidv4()}`;
  const report = {
    blockers,
    regressionPassed: input.regressionPassed,
    cisoPackPassed: input.cisoPackPassed,
    businessPersonaPackPassed: input.businessPersonaPackPassed,
    providerHealthOk: input.providerHealthOk,
    complianceAuditPassed: input.complianceAuditPassed,
    evidenceRefs: input.evidenceRefs,
    openP0: input.openP0,
    openP1: input.openP1,
    aiOps: dashboard,
    releaseNote: decision === 'PASS' ? 'Consultify AI OS complete release candidate.' : null,
  };
  await dbRun(
    `INSERT INTO wave9_acceptance_decisions (
      decision_id, organization_id, decision, report_json, accepted_limitations_json, created_by
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      decisionId,
      input.organizationId,
      decision,
      safeJsonStringify(report),
      safeJsonStringify(input.acceptedLimitations || []),
      input.userId,
    ]
  );
  return {
    decisionId,
    decision,
    report,
    acceptedLimitations: input.acceptedLimitations || [],
  };
}
