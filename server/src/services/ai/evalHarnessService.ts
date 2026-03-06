import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { citationVerifier } from './citationVerifier.js';
import { citationExtractor } from './citationExtractor.js';
import { classifyIntent } from './intentRouter.js';
import { enforcePolicy, getGovernancePolicies } from '../aiGovernanceService.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const GoldenSetSampleSchema = z.object({
  id: z.string(),
  input: z.string(),
  expectedIntent: z.string().optional(),
  expectedOutput: z.string().optional(),
  expectedCitations: z
    .array(
      z.object({
        artifactType: z.string(),
        artifactId: z.string(),
      })
    )
    .optional(),
  expectedActions: z.array(z.string()).optional(),
  tags: z.array(z.string()).default([]),
});

export type GoldenSetSample = z.infer<typeof GoldenSetSampleSchema>;

export const EvalRunConfigSchema = z.object({
  datasetId: z.string(),
  evalTypes: z.array(
    z.enum([
      'intent_accuracy',
      'citation_coverage',
      'action_accuracy',
      'policy_compliance',
      'response_quality',
      'latency',
    ])
  ),
  modelId: z.string().optional(),
  purpose: z.string().optional(),
  regressionBaseline: z.string().optional(),
});

export type EvalRunConfig = z.infer<typeof EvalRunConfigSchema>;

export interface EvalMetrics {
  intentAccuracy?: number;
  citationCoverage?: number;
  citationPrecision?: number;
  actionAccuracy?: number;
  policyComplianceRate?: number;
  avgResponseQuality?: number;
  avgLatencyMs?: number;
  p95LatencyMs?: number;
}

export interface SampleResult {
  sampleId: string;
  input: string;
  output?: string;
  intentMatch?: boolean;
  citationCoverage?: number;
  actionMatch?: boolean;
  policyPassed?: boolean;
  latencyMs?: number;
  score?: number;
  notes?: string;
}

export interface RegressionComparison {
  baselineRunId: string;
  improved: string[];
  degraded: string[];
  unchanged: string[];
  overallDelta: number;
}

export interface EvalRunResult {
  id: string;
  datasetId: string;
  organizationId: string;
  evalTypes: string[];
  metrics: EvalMetrics;
  sampleResults: SampleResult[];
  regression?: RegressionComparison;
  passesGate: boolean;
  gateViolations: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

let _harnessSchemaEnsured = false;
let _harnessSchemaEnsuring: Promise<void> | null = null;

export async function ensureHarnessSchema(): Promise<void> {
  if (_harnessSchemaEnsured) return;
  if (_harnessSchemaEnsuring) return _harnessSchemaEnsuring;

  _harnessSchemaEnsuring = (async () => {
    try {
      const stmts: Array<{ sql: string; optional?: boolean }> = [
        {
          sql: `CREATE TABLE IF NOT EXISTS ai_eval_regression_gates (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            purpose TEXT,
            metric_name TEXT NOT NULL,
            min_threshold REAL,
            max_degradation REAL DEFAULT 0.05,
            is_blocking BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_eval_gates_org ON ai_eval_regression_gates(organization_id)`,
        },
        { sql: `ALTER TABLE ai_evaluations ADD COLUMN eval_types_json TEXT DEFAULT '[]'`, optional: true },
        { sql: `ALTER TABLE ai_evaluations ADD COLUMN regression_baseline_id TEXT`, optional: true },
        { sql: `ALTER TABLE ai_evaluations ADD COLUMN regression_delta_json TEXT`, optional: true },
        { sql: `ALTER TABLE ai_evaluations ADD COLUMN passes_gate BOOLEAN`, optional: true },
        { sql: `ALTER TABLE ai_evaluations ADD COLUMN gate_violations_json TEXT DEFAULT '[]'`, optional: true },
      ];

      for (const s of stmts) {
        try {
          await dbRun(s.sql, [], { fallback: false } as any);
        } catch (e: any) {
          if (!s.optional) throw e;
        }
      }
      _harnessSchemaEnsured = true;
    } finally {
      _harnessSchemaEnsuring = null;
    }
  })();

  return _harnessSchemaEnsuring;
}

// ---------------------------------------------------------------------------
// Core: run eval harness
// ---------------------------------------------------------------------------

export async function runEvalHarness(
  orgId: string,
  config: EvalRunConfig,
  runBy?: string
): Promise<EvalRunResult> {
  await ensureHarnessSchema();

  const dataset = await dbGet(
    `SELECT * FROM ai_eval_datasets WHERE id = ? AND organization_id = ?`,
    [config.datasetId, orgId],
    { fallback: false } as any
  );
  if (!dataset) throw new Error('Dataset not found');

  let samples: GoldenSetSample[] = [];
  try {
    const raw = JSON.parse((dataset as any).samples_json || '[]');
    samples = raw.map((s: any, idx: number) => ({
      id: s.id || `sample-${idx}`,
      input: s.input || '',
      expectedIntent: s.expectedIntent || s.expected_intent,
      expectedOutput: s.expectedOutput || s.expected_output || s.expected,
      expectedCitations: s.expectedCitations || s.expected_citations,
      expectedActions: s.expectedActions || s.expected_actions,
      tags: s.tags || [],
    }));
  } catch {
    samples = [];
  }

  const evalTypes = config.evalTypes;
  const sampleResults: SampleResult[] = [];
  const latencies: number[] = [];

  let intentMatches = 0;
  let intentTotal = 0;
  let citCoverageSum = 0;
  let citCoverageCount = 0;
  let citPrecisionSum = 0;
  let citPrecisionCount = 0;
  let actionMatches = 0;
  let actionTotal = 0;
  let policyPassed = 0;
  let policyTotal = 0;
  let qualitySum = 0;
  let qualityCount = 0;

  for (const sample of samples) {
    const result: SampleResult = { sampleId: sample.id, input: sample.input };
    const startMs = Date.now();

    if (evalTypes.includes('intent_accuracy') && sample.expectedIntent) {
      try {
        const routing = await classifyIntent(sample.input);
        const match = routing.intent === sample.expectedIntent;
        result.intentMatch = match;
        intentTotal++;
        if (match) intentMatches++;
        if (!match) result.notes = `Expected intent '${sample.expectedIntent}', got '${routing.intent}'`;
      } catch (e: any) {
        result.intentMatch = false;
        result.notes = `Intent classification error: ${e?.message}`;
        intentTotal++;
      }
    }

    if (evalTypes.includes('citation_coverage') && sample.expectedCitations?.length) {
      try {
        const mockResponse = sample.expectedOutput || sample.input;
        const extraction = citationExtractor.extract(mockResponse);
        const verification = await citationVerifier.verify(extraction.citations);

        const expectedIds = new Set(
          sample.expectedCitations.map((c) => `${c.artifactType}:${c.artifactId}`)
        );
        const foundIds = new Set(
          extraction.citations
            .filter((c) => c.sourceId)
            .map((c) => `${c.sourceType}:${c.sourceId}`)
        );

        const covered = [...expectedIds].filter((id) => foundIds.has(id)).length;
        const coverage = expectedIds.size > 0 ? covered / expectedIds.size : 1;
        const precision = foundIds.size > 0 ? covered / foundIds.size : 1;

        result.citationCoverage = Math.round(coverage * 100) / 100;
        citCoverageSum += coverage;
        citCoverageCount++;
        citPrecisionSum += precision;
        citPrecisionCount++;

        result.score = verification.overallScore;
      } catch (e: any) {
        result.citationCoverage = 0;
        result.notes = (result.notes ? result.notes + '; ' : '') + `Citation error: ${e?.message}`;
        citCoverageCount++;
      }
    }

    if (evalTypes.includes('action_accuracy') && sample.expectedActions?.length) {
      const mockActions = extractActionsFromOutput(sample.expectedOutput || '');
      const expectedSet = new Set(sample.expectedActions.map((a) => a.toLowerCase()));
      const foundSet = new Set(mockActions.map((a) => a.toLowerCase()));
      const match = [...expectedSet].every((a) => foundSet.has(a));
      result.actionMatch = match;
      actionTotal++;
      if (match) actionMatches++;
    }

    if (evalTypes.includes('policy_compliance')) {
      try {
        const policies = await getGovernancePolicies(orgId, { activeOnly: true });
        let allPassed = true;
        for (const policy of policies) {
          const enforcement = await enforcePolicy(orgId, policy.policy_type, {
            content: sample.input,
            purpose: config.purpose || 'eval',
          });
          if (!enforcement.allowed) {
            allPassed = false;
            result.notes =
              (result.notes ? result.notes + '; ' : '') +
              `Policy violation (${policy.policy_type}): ${enforcement.reason}`;
            break;
          }
        }
        result.policyPassed = allPassed;
        policyTotal++;
        if (allPassed) policyPassed++;
      } catch (e: any) {
        result.policyPassed = false;
        policyTotal++;
      }
    }

    if (evalTypes.includes('response_quality') && sample.expectedOutput) {
      const quality = computeResponseQuality(sample.expectedOutput, sample.input);
      result.score = quality;
      qualitySum += quality;
      qualityCount++;
    }

    const elapsed = Date.now() - startMs;
    if (evalTypes.includes('latency')) {
      result.latencyMs = elapsed;
      latencies.push(elapsed);
    }

    sampleResults.push(result);
  }

  const metrics: EvalMetrics = {};
  if (intentTotal > 0) metrics.intentAccuracy = Math.round((intentMatches / intentTotal) * 10000) / 10000;
  if (citCoverageCount > 0) metrics.citationCoverage = Math.round((citCoverageSum / citCoverageCount) * 10000) / 10000;
  if (citPrecisionCount > 0) metrics.citationPrecision = Math.round((citPrecisionSum / citPrecisionCount) * 10000) / 10000;
  if (actionTotal > 0) metrics.actionAccuracy = Math.round((actionMatches / actionTotal) * 10000) / 10000;
  if (policyTotal > 0) metrics.policyComplianceRate = Math.round((policyPassed / policyTotal) * 10000) / 10000;
  if (qualityCount > 0) metrics.avgResponseQuality = Math.round((qualitySum / qualityCount) * 10000) / 10000;
  if (latencies.length > 0) {
    metrics.avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const sorted = [...latencies].sort((a, b) => a - b);
    metrics.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
  }

  let regression: RegressionComparison | undefined;
  let passesGate = true;
  let gateViolations: string[] = [];

  if (config.regressionBaseline) {
    const baselineRow = await dbGet(
      `SELECT * FROM ai_evaluations WHERE id = ? AND organization_id = ?`,
      [config.regressionBaseline, orgId],
      { fallback: false } as any
    );
    if (baselineRow) {
      const baselineMetrics = parseStoredMetrics(baselineRow);
      regression = computeRegression(metrics, baselineMetrics, config.regressionBaseline);
    }
  }

  const gates = await loadRegressionGates(orgId, config.purpose);
  if (gates.length > 0 && config.regressionBaseline && regression) {
    const baselineRow = await dbGet(
      `SELECT * FROM ai_evaluations WHERE id = ?`,
      [config.regressionBaseline],
      { fallback: false } as any
    );
    if (baselineRow) {
      const baselineMetrics = parseStoredMetrics(baselineRow);
      const gateResult = checkRegressionGate(metrics, baselineMetrics, {
        maxDegradation: Math.min(...gates.map((g) => g.max_degradation ?? 0.05)),
        requiredMetrics: gates.map((g) => g.metric_name),
      });
      passesGate = gateResult.passes;
      gateViolations = gateResult.violations;
    }
  }

  for (const gate of gates) {
    if (gate.min_threshold != null) {
      const val = (metrics as any)[gate.metric_name];
      if (val !== undefined && val < gate.min_threshold) {
        passesGate = false;
        const violation = `${gate.metric_name} = ${(val * 100).toFixed(1)}% below min threshold ${(gate.min_threshold * 100).toFixed(1)}%`;
        if (!gateViolations.includes(violation)) gateViolations.push(violation);
      }
    }
  }

  const evalId = randomUUID();
  const createdAt = new Date().toISOString();

  const totalSamples = samples.length;
  const passed = sampleResults.filter(
    (r) => (r.intentMatch !== false) && (r.policyPassed !== false) && (r.actionMatch !== false)
  ).length;
  const failed = totalSamples - passed;
  const accuracy = totalSamples > 0 ? Math.round((passed / totalSamples) * 10000) / 100 : null;

  try {
    await dbRun(
      `INSERT INTO ai_evaluations
       (id, organization_id, purpose, model_id, eval_type, dataset_id,
        total_samples, passed, failed, accuracy, avg_latency_ms, results_json,
        run_by, eval_types_json, regression_baseline_id, regression_delta_json,
        passes_gate, gate_violations_json, created_at)
       VALUES (?, ?, ?, ?, 'harness', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evalId,
        orgId,
        config.purpose || 'eval',
        config.modelId || null,
        config.datasetId,
        totalSamples,
        passed,
        failed,
        accuracy,
        metrics.avgLatencyMs || null,
        JSON.stringify(sampleResults),
        runBy || null,
        JSON.stringify(config.evalTypes),
        config.regressionBaseline || null,
        regression ? JSON.stringify(regression) : null,
        passesGate ? 1 : 0,
        JSON.stringify(gateViolations),
        createdAt,
      ],
      { fallback: false } as any
    );
  } catch (e: any) {
    logger.warn(`[EvalHarness] Failed to persist eval run: ${e?.message}`);
  }

  return {
    id: evalId,
    datasetId: config.datasetId,
    organizationId: orgId,
    evalTypes: config.evalTypes,
    metrics,
    sampleResults,
    regression,
    passesGate,
    gateViolations,
    createdAt,
  };
}

// ---------------------------------------------------------------------------
// Regression gate check (pure function)
// ---------------------------------------------------------------------------

export function checkRegressionGate(
  current: EvalMetrics,
  baseline: EvalMetrics,
  thresholds: { maxDegradation: number; requiredMetrics: string[] }
): { passes: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const metric of thresholds.requiredMetrics) {
    const currentVal = (current as any)[metric];
    const baselineVal = (baseline as any)[metric];
    if (currentVal !== undefined && baselineVal !== undefined) {
      const delta = currentVal - baselineVal;
      if (delta < -thresholds.maxDegradation) {
        violations.push(
          `${metric} degraded by ${(-delta * 100).toFixed(1)}% (threshold: ${(thresholds.maxDegradation * 100).toFixed(1)}%)`
        );
      }
    }
  }
  return { passes: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// Citation coverage report
// ---------------------------------------------------------------------------

export async function getCitationCoverageReport(
  orgId: string,
  from: string,
  to: string
): Promise<{
  totalResponses: number;
  avgCoverage: number;
  belowThreshold: number;
  byIntent: Array<{ intent: string; avgCoverage: number; count: number }>;
  trend: Array<{ date: string; avgCoverage: number }>;
}> {
  await ensureHarnessSchema();

  const coverageThreshold = 0.7;

  const totalRow = await dbGet(
    `SELECT COUNT(*) as cnt, AVG(overall_score) as avg_score
     FROM citation_verification_logs
     WHERE created_at >= ? AND created_at <= ?`,
    [from, to],
    { fallback: true } as any
  );

  const belowRow = await dbGet(
    `SELECT COUNT(*) as cnt
     FROM citation_verification_logs
     WHERE overall_score < ? AND created_at >= ? AND created_at <= ?`,
    [coverageThreshold, from, to],
    { fallback: true } as any
  );

  const intentRows = await dbAll(
    `SELECT
       COALESCE(l.purpose, 'unknown') as intent,
       AVG(c.overall_score) as avg_coverage,
       COUNT(*) as cnt
     FROM citation_verification_logs c
     LEFT JOIN ai_usage_logs l ON l.conversation_id = c.conversation_id
     WHERE c.created_at >= ? AND c.created_at <= ?
     GROUP BY intent
     ORDER BY avg_coverage ASC`,
    [from, to],
    { fallback: true } as any
  ).catch(() => []);

  const trendRows = await dbAll(
    `SELECT
       DATE(created_at) as date,
       AVG(overall_score) as avg_coverage
     FROM citation_verification_logs
     WHERE created_at >= ? AND created_at <= ?
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [from, to],
    { fallback: true } as any
  ).catch(() => []);

  return {
    totalResponses: Number((totalRow as any)?.cnt) || 0,
    avgCoverage: Math.round((Number((totalRow as any)?.avg_score) || 0) * 10000) / 10000,
    belowThreshold: Number((belowRow as any)?.cnt) || 0,
    byIntent: ((intentRows as any[]) || []).map((r: any) => ({
      intent: String(r.intent || 'unknown'),
      avgCoverage: Math.round((Number(r.avg_coverage) || 0) * 10000) / 10000,
      count: Number(r.cnt) || 0,
    })),
    trend: ((trendRows as any[]) || []).map((r: any) => ({
      date: String(r.date || ''),
      avgCoverage: Math.round((Number(r.avg_coverage) || 0) * 10000) / 10000,
    })),
  };
}

// ---------------------------------------------------------------------------
// Compare two eval runs
// ---------------------------------------------------------------------------

export async function compareEvalRuns(
  orgId: string,
  runId1: string,
  runId2: string
): Promise<{
  run1: { id: string; createdAt: string; metrics: EvalMetrics };
  run2: { id: string; createdAt: string; metrics: EvalMetrics };
  deltas: Record<string, number>;
  improved: string[];
  degraded: string[];
  unchanged: string[];
}> {
  await ensureHarnessSchema();

  const [row1, row2] = await Promise.all([
    dbGet(
      `SELECT * FROM ai_evaluations WHERE id = ? AND organization_id = ?`,
      [runId1, orgId],
      { fallback: false } as any
    ),
    dbGet(
      `SELECT * FROM ai_evaluations WHERE id = ? AND organization_id = ?`,
      [runId2, orgId],
      { fallback: false } as any
    ),
  ]);

  if (!row1) throw new Error(`Eval run ${runId1} not found`);
  if (!row2) throw new Error(`Eval run ${runId2} not found`);

  const m1 = parseStoredMetrics(row1);
  const m2 = parseStoredMetrics(row2);

  const allKeys = new Set([...Object.keys(m1), ...Object.keys(m2)]);
  const deltas: Record<string, number> = {};
  const improved: string[] = [];
  const degraded: string[] = [];
  const unchanged: string[] = [];

  for (const key of allKeys) {
    const v1 = (m1 as any)[key];
    const v2 = (m2 as any)[key];
    if (v1 !== undefined && v2 !== undefined) {
      const delta = v2 - v1;
      deltas[key] = Math.round(delta * 10000) / 10000;
      if (Math.abs(delta) < 0.001) unchanged.push(key);
      else if (isHigherBetter(key) ? delta > 0 : delta < 0) improved.push(key);
      else degraded.push(key);
    }
  }

  return {
    run1: { id: runId1, createdAt: String((row1 as any).created_at || ''), metrics: m1 },
    run2: { id: runId2, createdAt: String((row2 as any).created_at || ''), metrics: m2 },
    deltas,
    improved,
    degraded,
    unchanged,
  };
}

// ---------------------------------------------------------------------------
// Regression gates CRUD
// ---------------------------------------------------------------------------

export interface RegressionGate {
  id: string;
  organization_id: string;
  purpose: string | null;
  metric_name: string;
  min_threshold: number | null;
  max_degradation: number;
  is_blocking: boolean;
  created_at: string;
}

export async function listRegressionGates(orgId: string): Promise<RegressionGate[]> {
  await ensureHarnessSchema();
  const rows = await dbAll(
    `SELECT * FROM ai_eval_regression_gates WHERE organization_id = ? ORDER BY created_at DESC`,
    [orgId],
    { fallback: false } as any
  );
  return (rows as RegressionGate[]) || [];
}

export async function createRegressionGate(
  orgId: string,
  data: {
    purpose?: string;
    metricName: string;
    minThreshold?: number;
    maxDegradation?: number;
    isBlocking?: boolean;
  }
): Promise<RegressionGate> {
  await ensureHarnessSchema();
  const id = randomUUID();
  await dbRun(
    `INSERT INTO ai_eval_regression_gates (id, organization_id, purpose, metric_name, min_threshold, max_degradation, is_blocking, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      id,
      orgId,
      data.purpose || null,
      data.metricName,
      data.minThreshold ?? null,
      data.maxDegradation ?? 0.05,
      data.isBlocking !== false ? 1 : 0,
    ],
    { fallback: false } as any
  );
  const row = await dbGet(
    `SELECT * FROM ai_eval_regression_gates WHERE id = ?`,
    [id],
    { fallback: false } as any
  );
  return row as RegressionGate;
}

export async function updateRegressionGate(
  orgId: string,
  gateId: string,
  data: {
    purpose?: string;
    metricName?: string;
    minThreshold?: number | null;
    maxDegradation?: number;
    isBlocking?: boolean;
  }
): Promise<RegressionGate | null> {
  await ensureHarnessSchema();
  const existing = await dbGet(
    `SELECT * FROM ai_eval_regression_gates WHERE id = ? AND organization_id = ?`,
    [gateId, orgId],
    { fallback: false } as any
  );
  if (!existing) return null;

  const ex = existing as any;
  const purpose = data.purpose !== undefined ? data.purpose : ex.purpose;
  const metricName = data.metricName ?? ex.metric_name;
  const minThreshold = data.minThreshold !== undefined ? data.minThreshold : ex.min_threshold;
  const maxDegradation = data.maxDegradation ?? ex.max_degradation;
  const isBlocking = data.isBlocking !== undefined ? (data.isBlocking ? 1 : 0) : ex.is_blocking ? 1 : 0;

  await dbRun(
    `UPDATE ai_eval_regression_gates
     SET purpose = ?, metric_name = ?, min_threshold = ?, max_degradation = ?, is_blocking = ?
     WHERE id = ? AND organization_id = ?`,
    [purpose, metricName, minThreshold, maxDegradation, isBlocking, gateId, orgId],
    { fallback: false } as any
  );

  const row = await dbGet(
    `SELECT * FROM ai_eval_regression_gates WHERE id = ?`,
    [gateId],
    { fallback: false } as any
  );
  return row as RegressionGate;
}

export async function deleteRegressionGate(orgId: string, gateId: string): Promise<boolean> {
  await ensureHarnessSchema();
  await dbRun(
    `DELETE FROM ai_eval_regression_gates WHERE id = ? AND organization_id = ?`,
    [gateId, orgId],
    { fallback: false } as any
  );
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadRegressionGates(
  orgId: string,
  purpose?: string
): Promise<Array<{ metric_name: string; min_threshold: number | null; max_degradation: number; is_blocking: boolean }>> {
  try {
    let sql = `SELECT * FROM ai_eval_regression_gates WHERE organization_id = ? AND is_blocking = TRUE`;
    const params: unknown[] = [orgId];
    if (purpose) {
      sql += ` AND (purpose IS NULL OR purpose = ?)`;
      params.push(purpose);
    } else {
      sql += ` AND purpose IS NULL`;
    }
    const rows = await dbAll(sql, params, { fallback: false } as any);
    return ((rows as any[]) || []).map((r: any) => ({
      metric_name: String(r.metric_name),
      min_threshold: r.min_threshold != null ? Number(r.min_threshold) : null,
      max_degradation: Number(r.max_degradation) || 0.05,
      is_blocking: Boolean(r.is_blocking),
    }));
  } catch {
    return [];
  }
}

function parseStoredMetrics(row: any): EvalMetrics {
  const metrics: EvalMetrics = {};
  if (row.accuracy != null) metrics.intentAccuracy = Number(row.accuracy) / 100;
  if (row.avg_latency_ms != null) metrics.avgLatencyMs = Number(row.avg_latency_ms);

  try {
    const results = typeof row.results_json === 'string' ? JSON.parse(row.results_json) : row.results_json;
    if (Array.isArray(results) && results.length > 0) {
      const withCoverage = results.filter((r: any) => r.citationCoverage !== undefined);
      if (withCoverage.length > 0) {
        metrics.citationCoverage =
          withCoverage.reduce((s: number, r: any) => s + Number(r.citationCoverage || 0), 0) / withCoverage.length;
      }
      const withAction = results.filter((r: any) => r.actionMatch !== undefined);
      if (withAction.length > 0) {
        metrics.actionAccuracy = withAction.filter((r: any) => r.actionMatch).length / withAction.length;
      }
      const withPolicy = results.filter((r: any) => r.policyPassed !== undefined);
      if (withPolicy.length > 0) {
        metrics.policyComplianceRate = withPolicy.filter((r: any) => r.policyPassed).length / withPolicy.length;
      }
      const withScore = results.filter((r: any) => r.score !== undefined);
      if (withScore.length > 0) {
        metrics.avgResponseQuality =
          withScore.reduce((s: number, r: any) => s + Number(r.score || 0), 0) / withScore.length;
      }
      const withLatency = results.filter((r: any) => r.latencyMs !== undefined);
      if (withLatency.length > 0) {
        const lats = withLatency.map((r: any) => Number(r.latencyMs));
        metrics.avgLatencyMs = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
        const sorted = [...lats].sort((a, b) => a - b);
        metrics.p95LatencyMs = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
      }
    }
  } catch {
    // best-effort
  }

  return metrics;
}

function computeRegression(
  current: EvalMetrics,
  baseline: EvalMetrics,
  baselineRunId: string
): RegressionComparison {
  const improved: string[] = [];
  const degraded: string[] = [];
  const unchanged: string[] = [];
  let deltaSum = 0;
  let deltaCount = 0;

  const allKeys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const key of allKeys) {
    const cv = (current as any)[key];
    const bv = (baseline as any)[key];
    if (cv !== undefined && bv !== undefined) {
      const delta = cv - bv;
      deltaSum += delta;
      deltaCount++;
      if (Math.abs(delta) < 0.001) unchanged.push(key);
      else if (isHigherBetter(key) ? delta > 0 : delta < 0) improved.push(key);
      else degraded.push(key);
    }
  }

  return {
    baselineRunId,
    improved,
    degraded,
    unchanged,
    overallDelta: deltaCount > 0 ? Math.round((deltaSum / deltaCount) * 10000) / 10000 : 0,
  };
}

function isHigherBetter(metric: string): boolean {
  const lowerIsBetter = ['avgLatencyMs', 'p95LatencyMs'];
  return !lowerIsBetter.includes(metric);
}

function extractActionsFromOutput(output: string): string[] {
  const actions: string[] = [];
  const actionPatterns = [
    /\b(create|update|delete|assign|schedule|approve|reject|escalate|notify|archive)\b/gi,
  ];
  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      const action = match[1].toLowerCase();
      if (!actions.includes(action)) actions.push(action);
    }
  }
  return actions;
}

function computeResponseQuality(expectedOutput: string, actualInput: string): number {
  if (!expectedOutput) return 0;
  const expectedWords = new Set(expectedOutput.toLowerCase().split(/\s+/).filter(Boolean));
  const inputWords = new Set(actualInput.toLowerCase().split(/\s+/).filter(Boolean));
  if (expectedWords.size === 0) return 0;
  const overlap = [...expectedWords].filter((w) => inputWords.has(w)).length;
  return Math.round((overlap / expectedWords.size) * 10000) / 10000;
}
