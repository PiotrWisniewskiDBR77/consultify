import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

export type Wave9ReportType =
  | 'client_ready'
  | 'investor_ready'
  | 'steering_committee'
  | 'ciso_security';
export type Wave9GateDecision = 'PASS' | 'PASS_WITH_LIMITATIONS' | 'BLOCKED' | 'ROLLBACK';
export type Wave9EvidenceType =
  | 'initiative'
  | 'task'
  | 'kpi'
  | 'regression_pack'
  | 'ciso_pack'
  | 'business_persona_pack'
  | 'compliance_audit';
export type Wave9EvidenceStatus = 'pass' | 'fail' | 'pending';
export type Wave9ProviderStatus = 'healthy' | 'degraded' | 'unavailable';
export type Wave9EvalStatus = 'pass' | 'fail';
export type Wave9AcceptanceRunType =
  | 'regression_pack'
  | 'ciso_pack'
  | 'business_persona_pack'
  | 'compliance_audit'
  | 'ai_ops_eval_pack';
export type Wave9AcceptanceRunStatus = 'pass' | 'fail';

const WAVE9_REPORT_TYPES: Wave9ReportType[] = [
  'client_ready',
  'investor_ready',
  'steering_committee',
  'ciso_security',
];
const WAVE9_EVIDENCE_TYPES: Wave9EvidenceType[] = [
  'initiative',
  'task',
  'kpi',
  'regression_pack',
  'ciso_pack',
  'business_persona_pack',
  'compliance_audit',
  'ai_ops_eval_pack',
];
const WAVE9_EVIDENCE_STATUSES: Wave9EvidenceStatus[] = ['pass', 'fail', 'pending'];
const WAVE9_PROVIDER_STATUSES: Wave9ProviderStatus[] = ['healthy', 'degraded', 'unavailable'];
const WAVE9_ACCEPTANCE_RUN_TYPES: Wave9AcceptanceRunType[] = [
  'regression_pack',
  'ciso_pack',
  'business_persona_pack',
  'compliance_audit',
  'ai_ops_eval_pack',
];
const WAVE9_ACCEPTANCE_RUN_STATUSES: Wave9AcceptanceRunStatus[] = ['pass', 'fail'];

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

export interface RegisterWave9EvidenceInput {
  organizationId: string;
  evidenceType: Wave9EvidenceType;
  sourceType: string;
  sourceId: string;
  title?: string | null;
  status: Wave9EvidenceStatus;
  verifiedBy?: string | null;
  verificationMethod?: string | null;
  payload?: Record<string, unknown>;
}

export interface Wave9EvalRunInput {
  organizationId: string;
  promptKey: string;
  promptVersion?: string | null;
  category?: 'golden_prompt' | 'hallucination_check' | 'tool_misuse_check' | 'regression_gate';
  status: Wave9EvalStatus;
  score?: number | null;
  hallucinationCheckPassed?: boolean | null;
  toolMisuseCheckPassed?: boolean | null;
  runRef?: string | null;
  details?: Record<string, unknown>;
}

export interface Wave9AcceptanceRunInput {
  organizationId: string;
  runType: Wave9AcceptanceRunType;
  status: Wave9AcceptanceRunStatus;
  runRef?: string | null;
  buildId?: string | null;
  commitSha?: string | null;
  verifiedBy?: string | null;
  verificationMethod?: string | null;
  payload?: Record<string, unknown>;
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
    aiOpsEvalRunId?: string | null;
    aiOpsEvalPackRunId?: string | null;
  };
  acceptanceRunRefs?: {
    regressionRunId?: string | null;
    cisoPackRunId?: string | null;
    businessPersonaPackRunId?: string | null;
    complianceAuditRunId?: string | null;
    aiOpsEvalPackRunId?: string | null;
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

function clampScore(value?: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function normalizeRequiredText(value: unknown, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`Wave 9 ${label} is required`);
  return normalized;
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const normalized = normalizeRequiredText(value, label);
  if (!allowed.includes(normalized as T)) {
    throw new Error(`Invalid Wave 9 ${label}: ${normalized}`);
  }
  return normalized as T;
}

function mapEvalRun(row: any): any {
  if (!row) return null;
  return {
    evalId: row.eval_id,
    organizationId: row.organization_id,
    promptKey: row.prompt_key,
    promptVersion: row.prompt_version,
    category: row.category,
    status: row.status,
    score: row.score == null ? null : Number(row.score),
    hallucinationCheckPassed:
      row.hallucination_check_passed == null ? null : Boolean(row.hallucination_check_passed),
    toolMisuseCheckPassed:
      row.tool_misuse_check_passed == null ? null : Boolean(row.tool_misuse_check_passed),
    runRef: row.run_ref,
    details: safeJsonParse(row.details_json, {}),
    evaluatedAt: row.evaluated_at,
  };
}

function mapAcceptanceRun(row: any): any {
  if (!row) return null;
  return {
    runId: row.run_id,
    organizationId: row.organization_id,
    runType: row.run_type,
    status: row.status,
    runRef: row.run_ref,
    buildId: row.build_id,
    commitSha: row.commit_sha,
    verifiedBy: row.verified_by,
    verificationMethod: row.verification_method,
    payload: safeJsonParse(row.payload_json, {}),
    verifiedAt: row.verified_at,
  };
}

function buildProviderHealthSummary(providerRows: any[]): any {
  const latestByProvider = new Map<string, any>();
  for (const row of providerRows) {
    const existing = latestByProvider.get(row.provider);
    if (!existing || String(row.checked_at || '') > String(existing.checked_at || '')) {
      latestByProvider.set(row.provider, row);
    }
  }
  const latestRows = Array.from(latestByProvider.values());
  const byStatus = {
    healthy: latestRows.filter((row) => row.status === 'healthy').length,
    degraded: latestRows.filter((row) => row.status === 'degraded').length,
    unavailable: latestRows.filter((row) => row.status === 'unavailable').length,
  };
  const latestRoute =
    latestRows.find((row) => row.status === 'healthy') ||
    latestRows.find((row) => row.status === 'degraded') ||
    latestRows[0] ||
    null;
  return {
    byStatus,
    providersTracked: latestRows.length,
    latestProviderModelRoute: latestRoute
      ? {
          provider: latestRoute.provider,
          model: latestRoute.model,
          status: latestRoute.status,
          checkedAt: latestRoute.checked_at,
        }
      : null,
  };
}

function buildEvalDashboard(evalRows: any[], incidentRows: any[]): any {
  const runs = evalRows.map(mapEvalRun);
  const passed = runs.filter((run) => run.status === 'pass').length;
  const failed = runs.filter((run) => run.status === 'fail').length;
  const latestRun = runs[0] || null;
  const criticalIncidentOpen = incidentRows.some(
    (row: any) => row.severity === 'critical' && row.status !== 'closed'
  );
  const checkedCount = (key: 'hallucinationCheckPassed' | 'toolMisuseCheckPassed') =>
    runs.filter((run) => run[key] != null).length;
  const passedCount = (key: 'hallucinationCheckPassed' | 'toolMisuseCheckPassed') =>
    runs.filter((run) => run[key] === true).length;
  const gateBlocked = failed > 0 || latestRun?.status === 'fail' || criticalIncidentOpen;
  return {
    totalRuns: runs.length,
    goldenPromptsConfigured: new Set(
      runs.filter((run) => run.category === 'golden_prompt').map((run) => run.promptKey)
    ).size,
    passed,
    failed,
    hallucinationChecks: {
      total: checkedCount('hallucinationCheckPassed'),
      passed: passedCount('hallucinationCheckPassed'),
      failed: checkedCount('hallucinationCheckPassed') - passedCount('hallucinationCheckPassed'),
    },
    toolMisuseChecks: {
      total: checkedCount('toolMisuseCheckPassed'),
      passed: passedCount('toolMisuseCheckPassed'),
      failed: checkedCount('toolMisuseCheckPassed') - passedCount('toolMisuseCheckPassed'),
    },
    latestRun,
    latestGate: gateBlocked ? 'BLOCKED' : runs.length > 0 ? 'PASS' : 'BLOCKED',
  };
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

const WAVE9_REPORT_AUDIENCES: Record<
  Wave9ReportType,
  { label: string; description: string; templateId: string }
> = {
  client_ready: {
    label: 'Client delivery leadership',
    description: 'External-ready narrative focused on achieved business effect and adoption path.',
    templateId: 'wave9-client-ready',
  },
  investor_ready: {
    label: 'Investors and board sponsors',
    description: 'Capital-focused view of ROI, risk-adjusted scenarios and durable value signals.',
    templateId: 'wave9-investor-ready',
  },
  steering_committee: {
    label: 'Steering committee',
    description: 'Governance view for decisions, dependencies, owners and next checkpoints.',
    templateId: 'wave9-steering-committee',
  },
  ciso_security: {
    label: 'CISO and security governance',
    description: 'Security, compliance and evidence-lineage view for release approval.',
    templateId: 'wave9-ciso-security',
  },
};

function buildWave9ComplianceAudit(outcome: any): any {
  return {
    status: outcome.compliance?.cisoReviewStatus || 'pending',
    securityAuditRequired: Boolean(outcome.compliance?.securityAuditRequired),
    dataLineageCaptured: Boolean(outcome.compliance?.dataLineageCaptured),
    noHallucinatedKpi: Boolean(outcome.audit?.noHallucinatedKpi),
    assumptionsCaptured: outcome.audit?.assumptionsCaptured || outcome.assumptions.length,
    sourceTrace: outcome.audit?.sourceTrace || null,
  };
}

function buildWave9AudienceSections(params: {
  reportType: Wave9ReportType;
  outcome: any;
  scenarios: any;
  complianceAudit: any;
}): any[] {
  const { reportType, outcome, scenarios, complianceAudit } = params;
  const sharedEvidence = {
    assumptions: outcome.assumptions,
    confidence: outcome.confidence,
    roi: outcome.roi,
    scenarios,
    sourceTrace: outcome.audit?.sourceTrace || null,
    complianceAudit,
  };

  switch (reportType) {
    case 'client_ready':
      return [
        {
          id: 'client-outcome-narrative',
          title: 'Client Outcome Narrative',
          purpose: 'Explain the business effect in language suitable for client stakeholders.',
          content: {
            kpiName: outcome.kpiName,
            baseline: outcome.baseline,
            current: outcome.current,
            target: outcome.target,
            confidence: outcome.confidence,
          },
          evidence: sharedEvidence,
        },
        {
          id: 'client-adoption-and-proof',
          title: 'Adoption And Proof Points',
          purpose:
            'Tie delivery proof, source references and assumptions to the client-ready story.',
          content: {
            initiativeId: outcome.initiativeId,
            taskIds: outcome.taskIds,
            sourceRefs: outcome.sourceRefs,
            assumptions: outcome.assumptions,
          },
          evidence: sharedEvidence,
        },
      ];
    case 'investor_ready':
      return [
        {
          id: 'investor-value-thesis',
          title: 'Investment Value Thesis',
          purpose: 'Summarize durable value creation and confidence for capital stakeholders.',
          content: {
            kpiName: outcome.kpiName,
            confidence: outcome.confidence,
            roi: outcome.roi,
          },
          evidence: sharedEvidence,
        },
        {
          id: 'investor-scenario-sensitivity',
          title: 'Scenario And Sensitivity Analysis',
          purpose: 'Show upside, downside and risk-adjusted economics with explicit assumptions.',
          content: {
            scenarios: scenarios.scenarios,
            sensitivity: scenarios.sensitivity,
            assumptions: outcome.assumptions,
          },
          evidence: sharedEvidence,
        },
      ];
    case 'steering_committee':
      return [
        {
          id: 'steerco-governance-decision',
          title: 'Governance Decision Brief',
          purpose: 'Frame the decision, KPI status and confidence for committee approval.',
          content: {
            initiativeId: outcome.initiativeId,
            kpiName: outcome.kpiName,
            baseline: outcome.baseline,
            current: outcome.current,
            target: outcome.target,
            confidence: outcome.confidence,
          },
          evidence: sharedEvidence,
        },
        {
          id: 'steerco-actions-owners',
          title: 'Actions, Owners And Dependencies',
          purpose:
            'Keep accountability visible through owners, tasks, assumptions and source trace.',
          content: {
            ownerUserId: outcome.ownerUserId,
            taskIds: outcome.taskIds,
            assumptions: outcome.assumptions,
            sourceTrace: outcome.audit?.sourceTrace || null,
          },
          evidence: sharedEvidence,
        },
      ];
    case 'ciso_security':
      return [
        {
          id: 'ciso-security-posture',
          title: 'Security Posture And Release Guardrails',
          purpose: 'Show security review status, required audits and release guardrails.',
          content: {
            compliance: outcome.compliance,
            complianceAudit,
            confidence: outcome.confidence,
          },
          evidence: sharedEvidence,
        },
        {
          id: 'ciso-source-lineage',
          title: 'Compliance And Source Lineage',
          purpose: 'Expose KPI grounding, source references and lineage for CISO approval.',
          content: {
            sourceRefs: outcome.sourceRefs,
            sourceTrace: outcome.audit?.sourceTrace || null,
            assumptions: outcome.assumptions,
            noHallucinatedKpi: outcome.audit?.noHallucinatedKpi || false,
          },
          evidence: sharedEvidence,
        },
      ];
  }
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
      CREATE TABLE IF NOT EXISTS wave9_evidence_registry (
        evidence_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        evidence_type TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL,
        verified_by TEXT,
        verification_method TEXT,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wave9_evidence_unique_source
      ON wave9_evidence_registry(organization_id, source_type, source_id, evidence_type)
    `);
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
      CREATE TABLE IF NOT EXISTS wave9_eval_runs (
        eval_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        prompt_key TEXT NOT NULL,
        prompt_version TEXT,
        category TEXT NOT NULL DEFAULT 'golden_prompt',
        status TEXT NOT NULL,
        score REAL,
        hallucination_check_passed INTEGER,
        tool_misuse_check_passed INTEGER,
        run_ref TEXT,
        details_json TEXT NOT NULL DEFAULT '{}',
        evaluated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`
      CREATE TABLE IF NOT EXISTS wave9_acceptance_runs (
        run_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        run_type TEXT NOT NULL,
        status TEXT NOT NULL,
        run_ref TEXT,
        build_id TEXT,
        commit_sha TEXT,
        verified_by TEXT NOT NULL,
        verification_method TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      `CREATE INDEX IF NOT EXISTS idx_wave9_evidence_org_source ON wave9_evidence_registry(organization_id, source_type, source_id)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave9_provider_health_org ON wave9_provider_health(organization_id, checked_at)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave9_eval_runs_org ON wave9_eval_runs(organization_id, evaluated_at)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_wave9_acceptance_runs_org ON wave9_acceptance_runs(organization_id, run_type, verified_at)`
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

export async function registerWave9Evidence(input: RegisterWave9EvidenceInput): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const evidenceType = requireEnum(input.evidenceType, WAVE9_EVIDENCE_TYPES, 'evidence type');
  const status = requireEnum(input.status, WAVE9_EVIDENCE_STATUSES, 'evidence status');
  const sourceType = normalizeRequiredText(input.sourceType, 'evidence source type');
  const sourceId = normalizeRequiredText(input.sourceId, 'evidence source id');
  if (status === 'pass' && (!input.verifiedBy || !input.verificationMethod)) {
    throw new Error('Wave 9 pass evidence requires verifier and verification method');
  }
  const evidenceId = `evidence9-${uuidv4()}`;
  await dbRun(
    `INSERT INTO wave9_evidence_registry (
      evidence_id, organization_id, evidence_type, source_type, source_id, title, status,
      verified_by, verification_method, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evidenceId,
      input.organizationId,
      evidenceType,
      sourceType,
      sourceId,
      input.title || null,
      status,
      input.verifiedBy || null,
      input.verificationMethod || null,
      safeJsonStringify(input.payload || {}),
    ]
  );
  return dbGet(`SELECT * FROM wave9_evidence_registry WHERE evidence_id = ?`, [evidenceId]);
}

async function requireRegisteredSourceRefs(
  organizationId: string,
  sourceRefs: Array<{ sourceType: string; sourceId: string }>
): Promise<void> {
  for (const sourceRef of sourceRefs) {
    if (!sourceRef.sourceType || !sourceRef.sourceId?.trim()) {
      throw new Error('Wave 9 source references require sourceType and sourceId');
    }
    const row = await dbGet(
      `SELECT * FROM wave9_evidence_registry
       WHERE organization_id = ? AND source_type = ? AND source_id = ? AND status = 'pass'`,
      [organizationId, sourceRef.sourceType, sourceRef.sourceId]
    );
    if (!row || String((row as any).evidence_type) !== String(sourceRef.sourceType)) {
      throw new Error(
        `Wave 9 source reference is not verified: ${sourceRef.sourceType}:${sourceRef.sourceId}`
      );
    }
  }
}

async function requireRegisteredTaskEvidence(
  organizationId: string,
  taskIds: string[]
): Promise<void> {
  for (const taskId of taskIds) {
    const row = await dbGet(
      `SELECT * FROM wave9_evidence_registry
       WHERE organization_id = ? AND evidence_type = 'task' AND source_type = 'task'
         AND source_id = ? AND status = 'pass'`,
      [organizationId, taskId]
    );
    if (!row) throw new Error(`Wave 9 task is not verified: ${taskId}`);
  }
}

async function requireAcceptanceEvidence(
  organizationId: string,
  evidenceId: string | null | undefined,
  evidenceType: RegisterWave9EvidenceInput['evidenceType']
): Promise<boolean> {
  if (!evidenceId) return false;
  const row = await dbGet(
    `SELECT * FROM wave9_evidence_registry
     WHERE organization_id = ? AND evidence_id = ? AND evidence_type = ? AND status = 'pass'`,
    [organizationId, evidenceId, evidenceType]
  );
  return Boolean(row);
}

async function resolveAcceptanceRunEvidence(params: {
  organizationId: string;
  runId: string | null | undefined;
  runType: Wave9AcceptanceRunType;
  legacyBoolean: boolean;
  legacyEvidenceType?: RegisterWave9EvidenceInput['evidenceType'];
}): Promise<any> {
  const { organizationId, runId, runType, legacyBoolean, legacyEvidenceType } = params;
  if (runId) {
    const row = await dbGet(
      `SELECT * FROM wave9_acceptance_runs
       WHERE organization_id = ? AND run_id = ? AND run_type = ?`,
      [organizationId, runId, runType]
    );
    if (row) {
      const acceptanceRun = mapAcceptanceRun(row);
      return {
        source: 'acceptance_run',
        passed: acceptanceRun.status === 'pass',
        run: acceptanceRun,
      };
    }
    if (legacyEvidenceType) {
      const legacyPassed = await requireAcceptanceEvidence(
        organizationId,
        runId,
        legacyEvidenceType
      );
      if (legacyPassed) {
        return {
          source: 'legacy_evidence',
          passed: true,
          run: null,
          evidenceId: runId,
        };
      }
    }
    return {
      source: 'acceptance_run',
      passed: false,
      run: null,
      missingRunId: runId,
    };
  }
  return {
    source: 'raw_boolean',
    passed: legacyBoolean,
    run: null,
  };
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
  if (!input.taskIds || input.taskIds.length === 0) {
    throw new Error('Wave 9 outcome requires task linkage');
  }
  await requireRegisteredSourceRefs(input.organizationId, input.sourceRefs);
  await requireRegisteredTaskEvidence(input.organizationId, input.taskIds);
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
  const reportType = requireEnum(params.reportType, WAVE9_REPORT_TYPES, 'report type');
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
  const audience = WAVE9_REPORT_AUDIENCES[reportType];
  const complianceAudit = buildWave9ComplianceAudit(outcome);
  const sections = buildWave9AudienceSections({
    reportType,
    outcome,
    scenarios,
    complianceAudit,
  });
  return {
    reportType,
    title: `${reportType.replace(/_/g, ' ')} report: ${outcome.kpiName}`,
    audience: {
      reportType,
      label: audience.label,
      description: audience.description,
    },
    template: {
      id: audience.templateId,
      sectionIds: sections.map((section) => section.id),
    },
    sections,
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
    sourceTrace: outcome.audit?.sourceTrace || null,
    complianceAudit,
    audit: {
      sourceTrace: outcome.audit?.sourceTrace || null,
      complianceAudit,
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
  status: Wave9ProviderStatus;
  latencyMs?: number | null;
  errorRate?: number | null;
  costUsd?: number | null;
}): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const status = requireEnum(input.status, WAVE9_PROVIDER_STATUSES, 'provider status');
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
      status,
      input.latencyMs || null,
      input.errorRate || 0,
      input.costUsd || 0,
    ]
  );
  return dbGet(`SELECT * FROM wave9_provider_health WHERE health_id = ?`, [healthId]);
}

export async function recordWave9EvalRun(input: Wave9EvalRunInput): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const promptKey = normalizeRequiredText(input.promptKey, 'eval prompt key');
  const status = requireEnum(input.status, ['pass', 'fail'], 'eval status');
  const evalId = `eval9-${uuidv4()}`;
  await dbRun(
    `INSERT INTO wave9_eval_runs (
      eval_id, organization_id, prompt_key, prompt_version, category, status, score,
      hallucination_check_passed, tool_misuse_check_passed, run_ref, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evalId,
      input.organizationId,
      promptKey,
      input.promptVersion || null,
      input.category || 'golden_prompt',
      status,
      clampScore(input.score),
      input.hallucinationCheckPassed == null ? null : Number(input.hallucinationCheckPassed),
      input.toolMisuseCheckPassed == null ? null : Number(input.toolMisuseCheckPassed),
      input.runRef || null,
      safeJsonStringify(input.details || {}),
    ]
  );
  return mapEvalRun(await dbGet(`SELECT * FROM wave9_eval_runs WHERE eval_id = ?`, [evalId]));
}

export async function registerWave9AcceptanceRun(input: Wave9AcceptanceRunInput): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const runType = requireEnum(input.runType, WAVE9_ACCEPTANCE_RUN_TYPES, 'acceptance run type');
  const status = requireEnum(input.status, WAVE9_ACCEPTANCE_RUN_STATUSES, 'acceptance run status');
  const verifiedBy = normalizeRequiredText(input.verifiedBy, 'acceptance run verifier');
  const verificationMethod = normalizeRequiredText(
    input.verificationMethod,
    'acceptance run verification method'
  );
  const runId = `acc-run9-${uuidv4()}`;
  await dbRun(
    `INSERT INTO wave9_acceptance_runs (
      run_id, organization_id, run_type, status, run_ref, build_id, commit_sha,
      verified_by, verification_method, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      input.organizationId,
      runType,
      status,
      input.runRef || null,
      input.buildId || null,
      input.commitSha || null,
      verifiedBy,
      verificationMethod,
      safeJsonStringify(input.payload || {}),
    ]
  );
  return mapAcceptanceRun(
    await dbGet(`SELECT * FROM wave9_acceptance_runs WHERE run_id = ?`, [runId])
  );
}

export async function listWave9AcceptanceRuns(params: { organizationId: string }): Promise<any[]> {
  await ensureWave9OutcomeRuntimeSchema();
  const rows = await dbAll(
    `SELECT * FROM wave9_acceptance_runs
     WHERE organization_id = ? ORDER BY verified_at DESC LIMIT 100`,
    [params.organizationId]
  );
  return (rows || []).map(mapAcceptanceRun);
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
  const [providers, incidents, outcomes, evalRuns, acceptanceRuns] = await Promise.all([
    dbAll(
      `SELECT * FROM wave9_provider_health WHERE organization_id = ? ORDER BY checked_at DESC LIMIT 20`,
      [params.organizationId]
    ),
    dbAll(
      `SELECT * FROM wave9_incidents WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`,
      [params.organizationId]
    ),
    listWave9Outcomes({ organizationId: params.organizationId }),
    dbAll(
      `SELECT * FROM wave9_eval_runs WHERE organization_id = ? ORDER BY evaluated_at DESC LIMIT 50`,
      [params.organizationId]
    ),
    listWave9AcceptanceRuns({ organizationId: params.organizationId }),
  ]);
  const providerRows = providers || [];
  const incidentRows = incidents || [];
  const evalRows = evalRuns || [];
  const providerHealthSummary = buildProviderHealthSummary(providerRows);
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
    providerHealthSummary,
    modelRouting: {
      primary: providerHealthSummary.latestProviderModelRoute?.provider || 'unavailable',
      fallback: providerRows.find((row: any) => row.status !== 'unavailable')?.provider || null,
      latestProviderModelRoute: providerHealthSummary.latestProviderModelRoute,
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
    evalDashboard: buildEvalDashboard(evalRows, incidentRows),
    acceptanceRuns: acceptanceRuns || [],
    outcomesTracked: outcomes.length,
  };
}

export async function runWave9FinalAcceptance(input: Wave9AcceptanceInput): Promise<any> {
  await ensureWave9OutcomeRuntimeSchema();
  const dashboard = await buildWave9AIOpsDashboard({ organizationId: input.organizationId });
  const acceptanceRunRefs = input.acceptanceRunRefs || {};
  const acceptanceRunChecks = {
    regression: await resolveAcceptanceRunEvidence({
      organizationId: input.organizationId,
      runId: acceptanceRunRefs.regressionRunId || input.evidenceRefs?.regressionRunId,
      runType: 'regression_pack',
      legacyBoolean: input.regressionPassed,
      legacyEvidenceType: 'regression_pack',
    }),
    ciso: await resolveAcceptanceRunEvidence({
      organizationId: input.organizationId,
      runId: acceptanceRunRefs.cisoPackRunId || input.evidenceRefs?.cisoPackRunId,
      runType: 'ciso_pack',
      legacyBoolean: input.cisoPackPassed,
      legacyEvidenceType: 'ciso_pack',
    }),
    businessPersona: await resolveAcceptanceRunEvidence({
      organizationId: input.organizationId,
      runId:
        acceptanceRunRefs.businessPersonaPackRunId || input.evidenceRefs?.businessPersonaPackRunId,
      runType: 'business_persona_pack',
      legacyBoolean: input.businessPersonaPackPassed,
      legacyEvidenceType: 'business_persona_pack',
    }),
    compliance: await resolveAcceptanceRunEvidence({
      organizationId: input.organizationId,
      runId: acceptanceRunRefs.complianceAuditRunId || input.evidenceRefs?.complianceAuditRef,
      runType: 'compliance_audit',
      legacyBoolean: input.complianceAuditPassed,
      legacyEvidenceType: 'compliance_audit',
    }),
    aiOpsEval: await resolveAcceptanceRunEvidence({
      organizationId: input.organizationId,
      runId:
        acceptanceRunRefs.aiOpsEvalPackRunId ||
        input.evidenceRefs?.aiOpsEvalPackRunId ||
        input.evidenceRefs?.aiOpsEvalRunId,
      runType: 'ai_ops_eval_pack',
      legacyBoolean: dashboard.evalDashboard?.latestGate === 'PASS',
    }),
  };
  const resolvedChecks = {
    regressionPassed: acceptanceRunChecks.regression.passed,
    cisoPackPassed: acceptanceRunChecks.ciso.passed,
    businessPersonaPackPassed: acceptanceRunChecks.businessPersona.passed,
    providerHealthOk: input.providerHealthOk,
    complianceAuditPassed: acceptanceRunChecks.compliance.passed,
    aiOpsEvalPackPassed: acceptanceRunChecks.aiOpsEval.passed,
  };
  const blockers: string[] = [];
  if (!resolvedChecks.regressionPassed) blockers.push('regression_pack_failed');
  if (!resolvedChecks.cisoPackPassed) blockers.push('ciso_pack_failed');
  if (!resolvedChecks.businessPersonaPackPassed) blockers.push('business_persona_pack_failed');
  if (!input.providerHealthOk) blockers.push('provider_health_failed');
  if (!resolvedChecks.complianceAuditPassed) blockers.push('compliance_audit_failed');
  if (!resolvedChecks.aiOpsEvalPackPassed) blockers.push('ai_ops_eval_gate_failed');
  if (input.openP0 > 0) blockers.push('open_p0_findings');
  const decision: Wave9GateDecision =
    blockers.length > 0 ? 'BLOCKED' : input.openP1 > 0 ? 'PASS_WITH_LIMITATIONS' : 'PASS';
  const decisionId = `accept9-${uuidv4()}`;
  const report = {
    blockers,
    ...resolvedChecks,
    rawFlags: {
      regressionPassed: input.regressionPassed,
      cisoPackPassed: input.cisoPackPassed,
      businessPersonaPackPassed: input.businessPersonaPackPassed,
      providerHealthOk: input.providerHealthOk,
      complianceAuditPassed: input.complianceAuditPassed,
    },
    evidenceRefs: input.evidenceRefs,
    acceptanceRunRefs,
    acceptanceRunChecks,
    acceptanceRunEvidence: Object.fromEntries(
      Object.entries(acceptanceRunChecks).map(([key, check]: [string, any]) => [key, check.run])
    ),
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
