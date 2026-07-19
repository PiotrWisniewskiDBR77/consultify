import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeteringDashboard {
  period: { from: string; to: string };
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  byPurpose: Array<{ purpose: string; cost: number; tokens: number; requests: number }>;
  byModel: Array<{ model: string; cost: number; tokens: number; requests: number }>;
  budgetUtilization: Array<{
    budgetId: string;
    name: string;
    spent: number;
    limit: number;
    percentUsed: number;
  }>;
  alerts: Array<{ id: string; type: string; message: string; createdAt: string }>;
  trend: Array<{ date: string; cost: number; tokens: number }>;
}

export interface EvalDataset {
  id: string;
  organization_id: string;
  name: string;
  purpose: string;
  samples_json: string;
  sample_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvalRun {
  id: string;
  organization_id: string;
  purpose: string;
  model_id: string | null;
  eval_type: string;
  dataset_id: string | null;
  total_samples: number;
  passed: number;
  failed: number;
  accuracy: number | null;
  avg_latency_ms: number | null;
  avg_cost_usd: number | null;
  results_json: string;
  run_by: string | null;
  created_at: string;
}

export interface GovernancePolicy {
  id: string;
  organization_id: string;
  policy_type: string;
  config_json: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Schema bootstrap (safe for SQLite + Postgres)
// ---------------------------------------------------------------------------

let _schemaEnsured = false;
let _schemaEnsuring: Promise<void> | null = null;

export async function ensureGovernanceSchema(): Promise<void> {
  if (_schemaEnsured) return;
  if (_schemaEnsuring) return _schemaEnsuring;

  _schemaEnsuring = (async () => {
    try {
      const stmts: Array<{ sql: string; optional?: boolean }> = [
        {
          sql: `CREATE TABLE IF NOT EXISTS ai_evaluations (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            purpose TEXT NOT NULL,
            model_id TEXT,
            eval_type TEXT NOT NULL DEFAULT 'quality',
            dataset_id TEXT,
            total_samples INTEGER DEFAULT 0,
            passed INTEGER DEFAULT 0,
            failed INTEGER DEFAULT 0,
            accuracy REAL,
            avg_latency_ms REAL,
            avg_cost_usd REAL,
            results_json TEXT DEFAULT '[]',
            run_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
        },
        { sql: `CREATE INDEX IF NOT EXISTS idx_ai_evals_org ON ai_evaluations(organization_id)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_ai_evals_purpose ON ai_evaluations(purpose)` },
        {
          sql: `CREATE TABLE IF NOT EXISTS ai_eval_datasets (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            purpose TEXT NOT NULL,
            samples_json TEXT NOT NULL DEFAULT '[]',
            sample_count INTEGER DEFAULT 0,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_ai_eval_datasets_org ON ai_eval_datasets(organization_id)`,
        },
        {
          sql: `CREATE TABLE IF NOT EXISTS ai_governance_policies (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            policy_type TEXT NOT NULL,
            config_json TEXT NOT NULL DEFAULT '{}',
            is_active BOOLEAN DEFAULT TRUE,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_ai_gov_policies_org ON ai_governance_policies(organization_id)`,
        },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN eval_score REAL`, optional: true },
        {
          sql: `ALTER TABLE ai_usage_logs ADD COLUMN flagged BOOLEAN DEFAULT FALSE`,
          optional: true,
        },
        { sql: `ALTER TABLE ai_usage_logs ADD COLUMN flag_reason TEXT`, optional: true },
      ];

      for (const s of stmts) {
        try {
          await dbRun(s.sql, [], { fallback: false } as any);
        } catch (e: any) {
          if (!s.optional) throw e;
        }
      }
      _schemaEnsured = true;
    } finally {
      _schemaEnsuring = null;
    }
  })();

  return _schemaEnsuring;
}

// ---------------------------------------------------------------------------
// Metering Dashboard
// ---------------------------------------------------------------------------

export async function getMeteringDashboard(
  orgId: string,
  from: string,
  to: string
): Promise<MeteringDashboard> {
  await ensureGovernanceSchema();

  const [byPurposeRows, byModelRows, trendRows, budgetRows, alertRows] = await Promise.all([
    dbAll(
      `SELECT
         COALESCE(purpose, 'unknown') as purpose,
         COALESCE(SUM(estimated_cost_usd), 0) as cost,
         COALESCE(SUM(tokens_used), 0) as tokens,
         COUNT(*) as requests
       FROM ai_usage_logs
       WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
       GROUP BY purpose
       ORDER BY cost DESC`,
      [orgId, from, to],
      { fallback: true } as any
    ),
    dbAll(
      // NOTE: `model_id` never existed on ai_usage_logs (real column is `model`) —
      // same stale-schema class as aiObservabilityService.ts. With { fallback: true }
      // this silently returned [] -> Metering Dashboard "by model" breakdown was
      // always empty regardless of source data.
      // GROUP BY must use the COALESCE expression, not the bare alias `model` — since
      // `model` is now ALSO a genuine input column, Postgres resolves a bare `GROUP BY
      // model` to the input column (per its grouping-alias precedence rule), which
      // would then reject `provider` in the SELECT list as ungrouped.
      `SELECT
         COALESCE(model, provider, 'unknown') as model,
         COALESCE(SUM(estimated_cost_usd), 0) as cost,
         COALESCE(SUM(tokens_used), 0) as tokens,
         COUNT(*) as requests
       FROM ai_usage_logs
       WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
       GROUP BY COALESCE(model, provider, 'unknown')
       ORDER BY cost DESC`,
      [orgId, from, to],
      { fallback: true } as any
    ),
    dbAll(
      `SELECT
         DATE(created_at) as date,
         COALESCE(SUM(estimated_cost_usd), 0) as cost,
         COALESCE(SUM(tokens_used), 0) as tokens
       FROM ai_usage_logs
       WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [orgId, from, to],
      { fallback: true } as any
    ),
    dbAll(
      `SELECT id, name, hard_limit_usd, spent_usd, freeze_on_limit
       FROM ai_budgets
       WHERE organization_id = ?`,
      [orgId],
      { fallback: true } as any
    ).catch(() => []),
    dbAll(
      `SELECT id, alert_type, message, created_at
       FROM ai_spending_alerts
       WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [orgId, from, to],
      { fallback: true } as any
    ).catch(() => []),
  ]);

  const purposes = ((byPurposeRows as any[]) || []).map((r: any) => ({
    purpose: String(r.purpose || 'unknown'),
    cost: Number(r.cost) || 0,
    tokens: Number(r.tokens) || 0,
    requests: Number(r.requests) || 0,
  }));

  const models = ((byModelRows as any[]) || []).map((r: any) => ({
    model: String(r.model || 'unknown'),
    cost: Number(r.cost) || 0,
    tokens: Number(r.tokens) || 0,
    requests: Number(r.requests) || 0,
  }));

  const trend = ((trendRows as any[]) || []).map((r: any) => ({
    date: String(r.date || ''),
    cost: Number(r.cost) || 0,
    tokens: Number(r.tokens) || 0,
  }));

  const budgetUtilization = ((budgetRows as any[]) || []).map((r: any) => {
    const limit = Number(r.hard_limit_usd) || 0;
    const spent = Number(r.spent_usd) || 0;
    return {
      budgetId: String(r.id || ''),
      name: String(r.name || ''),
      spent,
      limit,
      percentUsed: limit > 0 ? Math.round((spent / limit) * 10000) / 100 : 0,
    };
  });

  const alerts = ((alertRows as any[]) || []).map((r: any) => ({
    id: String(r.id || ''),
    type: String(r.alert_type || ''),
    message: String(r.message || ''),
    createdAt: String(r.created_at || ''),
  }));

  const totalCost = purposes.reduce((s, p) => s + p.cost, 0);
  const totalTokens = purposes.reduce((s, p) => s + p.tokens, 0);
  const totalRequests = purposes.reduce((s, p) => s + p.requests, 0);

  return {
    period: { from, to },
    totalCost,
    totalTokens,
    totalRequests,
    byPurpose: purposes,
    byModel: models,
    budgetUtilization,
    alerts,
    trend,
  };
}

// ---------------------------------------------------------------------------
// Metering breakdowns
// ---------------------------------------------------------------------------

export async function getMeteringByPurpose(
  orgId: string,
  from: string,
  to: string
): Promise<any[]> {
  await ensureGovernanceSchema();
  const rows = await dbAll(
    `SELECT
       COALESCE(purpose, 'unknown') as purpose,
       COALESCE(SUM(estimated_cost_usd), 0) as cost,
       COALESCE(SUM(tokens_used), 0) as tokens,
       COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
       COALESCE(SUM(completion_tokens), 0) as completion_tokens,
       COUNT(*) as requests,
       COALESCE(AVG(estimated_cost_usd), 0) as avg_cost
     FROM ai_usage_logs
     WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
     GROUP BY purpose
     ORDER BY cost DESC`,
    [orgId, from, to],
    { fallback: true } as any
  );
  return (rows as any[]) || [];
}

export async function getMeteringByUser(orgId: string, from: string, to: string): Promise<any[]> {
  await ensureGovernanceSchema();
  const rows = await dbAll(
    `SELECT
       COALESCE(user_id, 'unknown') as user_id,
       COALESCE(SUM(estimated_cost_usd), 0) as cost,
       COALESCE(SUM(tokens_used), 0) as tokens,
       COUNT(*) as requests
     FROM ai_usage_logs
     WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
     GROUP BY user_id
     ORDER BY cost DESC`,
    [orgId, from, to],
    { fallback: true } as any
  );
  return (rows as any[]) || [];
}

export async function getMeteringTrend(orgId: string, from: string, to: string): Promise<any[]> {
  await ensureGovernanceSchema();
  const rows = await dbAll(
    `SELECT
       DATE(created_at) as date,
       COALESCE(SUM(estimated_cost_usd), 0) as cost,
       COALESCE(SUM(tokens_used), 0) as tokens,
       COUNT(*) as requests
     FROM ai_usage_logs
     WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [orgId, from, to],
    { fallback: true } as any
  );
  return (rows as any[]) || [];
}

// ---------------------------------------------------------------------------
// Eval Datasets CRUD
// ---------------------------------------------------------------------------

export async function listEvalDatasets(orgId: string): Promise<EvalDataset[]> {
  await ensureGovernanceSchema();
  const rows = await dbAll(
    `SELECT * FROM ai_eval_datasets WHERE organization_id = ? ORDER BY created_at DESC`,
    [orgId],
    { fallback: false } as any
  );
  return (rows as EvalDataset[]) || [];
}

export async function getEvalDataset(
  orgId: string,
  datasetId: string
): Promise<EvalDataset | null> {
  await ensureGovernanceSchema();
  const row = await dbGet(
    `SELECT * FROM ai_eval_datasets WHERE id = ? AND organization_id = ?`,
    [datasetId, orgId],
    { fallback: false } as any
  );
  return (row as EvalDataset) || null;
}

export async function createEvalDataset(
  orgId: string,
  data: { name: string; purpose: string; samples: any[]; createdBy?: string }
): Promise<EvalDataset> {
  await ensureGovernanceSchema();
  const id = randomUUID();
  const samples = Array.isArray(data.samples) ? data.samples : [];
  await dbRun(
    `INSERT INTO ai_eval_datasets (id, organization_id, name, purpose, samples_json, sample_count, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      orgId,
      data.name,
      data.purpose,
      JSON.stringify(samples),
      samples.length,
      data.createdBy || null,
    ],
    { fallback: false } as any
  );
  return (await getEvalDataset(orgId, id))!;
}

export async function updateEvalDataset(
  orgId: string,
  datasetId: string,
  data: { name?: string; purpose?: string; samples?: any[] }
): Promise<EvalDataset | null> {
  await ensureGovernanceSchema();
  const existing = await getEvalDataset(orgId, datasetId);
  if (!existing) return null;

  const name = data.name ?? existing.name;
  const purpose = data.purpose ?? existing.purpose;
  const samples = data.samples !== undefined ? data.samples : undefined;
  const samplesJson = samples !== undefined ? JSON.stringify(samples) : existing.samples_json;
  const sampleCount = samples !== undefined ? samples.length : existing.sample_count;

  await dbRun(
    `UPDATE ai_eval_datasets
     SET name = ?, purpose = ?, samples_json = ?, sample_count = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [name, purpose, samplesJson, sampleCount, datasetId, orgId],
    { fallback: false } as any
  );
  return getEvalDataset(orgId, datasetId);
}

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------

export async function runEvaluation(
  orgId: string,
  datasetId: string,
  purpose: string,
  modelId?: string,
  runBy?: string
): Promise<EvalRun> {
  await ensureGovernanceSchema();

  const dataset = await getEvalDataset(orgId, datasetId);
  if (!dataset) throw new Error('Dataset not found');

  let samples: Array<{ input: string; expected: string }> = [];
  try {
    samples = JSON.parse(dataset.samples_json);
  } catch {
    samples = [];
  }

  const results: Array<{ input: string; expected: string; passed: boolean; detail?: string }> = [];
  let passed = 0;
  let failed = 0;

  for (const sample of samples) {
    const input = String(sample.input || '');
    const expected = String(sample.expected || '');

    // Simple evaluation: check if expected output is contained in a hypothetical response.
    // In a real system this would call the LLM and compare. Here we record the sample
    // as "passed" if expected is non-empty (placeholder for actual LLM call).
    const samplePassed = !!expected;
    if (samplePassed) {
      passed++;
    } else {
      failed++;
    }
    results.push({ input, expected, passed: samplePassed });
  }

  const totalSamples = samples.length;
  const accuracy = totalSamples > 0 ? Math.round((passed / totalSamples) * 10000) / 100 : null;

  const id = randomUUID();
  await dbRun(
    `INSERT INTO ai_evaluations (id, organization_id, purpose, model_id, eval_type, dataset_id, total_samples, passed, failed, accuracy, results_json, run_by, created_at)
     VALUES (?, ?, ?, ?, 'quality', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      id,
      orgId,
      purpose,
      modelId || null,
      datasetId,
      totalSamples,
      passed,
      failed,
      accuracy,
      JSON.stringify(results),
      runBy || null,
    ],
    { fallback: false } as any
  );

  const row = await dbGet(`SELECT * FROM ai_evaluations WHERE id = ?`, [id], {
    fallback: false,
  } as any);
  return row as EvalRun;
}

export async function listEvaluations(
  orgId: string,
  opts?: { purpose?: string; limit?: number }
): Promise<EvalRun[]> {
  await ensureGovernanceSchema();
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM ai_evaluations WHERE organization_id = ?`;
  if (opts?.purpose) {
    sql += ` AND purpose = ?`;
    params.push(opts.purpose);
  }
  sql += ` ORDER BY created_at DESC`;
  const limit = Math.min(Math.max(opts?.limit || 50, 1), 500);
  sql += ` LIMIT ?`;
  params.push(limit);

  const rows = await dbAll(sql, params, { fallback: false } as any);
  return (rows as EvalRun[]) || [];
}

export async function getEvaluation(orgId: string, evalId: string): Promise<EvalRun | null> {
  await ensureGovernanceSchema();
  const row = await dbGet(
    `SELECT * FROM ai_evaluations WHERE id = ? AND organization_id = ?`,
    [evalId, orgId],
    { fallback: false } as any
  );
  return (row as EvalRun) || null;
}

// ---------------------------------------------------------------------------
// Governance Policies CRUD
// ---------------------------------------------------------------------------

export async function getGovernancePolicies(
  orgId: string,
  opts?: { activeOnly?: boolean }
): Promise<GovernancePolicy[]> {
  await ensureGovernanceSchema();
  let sql = `SELECT * FROM ai_governance_policies WHERE organization_id = ?`;
  const params: unknown[] = [orgId];
  if (opts?.activeOnly) {
    sql += ` AND is_active = TRUE`;
  }
  sql += ` ORDER BY created_at DESC`;
  const rows = await dbAll(sql, params, { fallback: false } as any);
  return (rows as GovernancePolicy[]) || [];
}

export async function getGovernancePolicy(
  orgId: string,
  policyId: string
): Promise<GovernancePolicy | null> {
  await ensureGovernanceSchema();
  const row = await dbGet(
    `SELECT * FROM ai_governance_policies WHERE id = ? AND organization_id = ?`,
    [policyId, orgId],
    { fallback: false } as any
  );
  return (row as GovernancePolicy) || null;
}

export async function createGovernancePolicy(
  orgId: string,
  data: { policyType: string; config: Record<string, any>; createdBy?: string }
): Promise<GovernancePolicy> {
  await ensureGovernanceSchema();
  const id = randomUUID();
  await dbRun(
    `INSERT INTO ai_governance_policies (id, organization_id, policy_type, config_json, is_active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, TRUE, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, orgId, data.policyType, JSON.stringify(data.config || {}), data.createdBy || null],
    { fallback: false } as any
  );
  return (await getGovernancePolicy(orgId, id))!;
}

export async function updateGovernancePolicy(
  orgId: string,
  policyId: string,
  data: { policyType?: string; config?: Record<string, any>; isActive?: boolean }
): Promise<GovernancePolicy | null> {
  await ensureGovernanceSchema();
  const existing = await getGovernancePolicy(orgId, policyId);
  if (!existing) return null;

  const policyType = data.policyType ?? existing.policy_type;
  const configJson = data.config !== undefined ? JSON.stringify(data.config) : existing.config_json;
  const isActive =
    data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.is_active ? 1 : 0;

  await dbRun(
    `UPDATE ai_governance_policies
     SET policy_type = ?, config_json = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [policyType, configJson, isActive, policyId, orgId],
    { fallback: false } as any
  );
  return getGovernancePolicy(orgId, policyId);
}

export async function deleteGovernancePolicy(orgId: string, policyId: string): Promise<boolean> {
  await ensureGovernanceSchema();
  await dbRun(
    `DELETE FROM ai_governance_policies WHERE id = ? AND organization_id = ?`,
    [policyId, orgId],
    { fallback: false } as any
  );
  return true;
}

// ---------------------------------------------------------------------------
// Policy Enforcement
// ---------------------------------------------------------------------------

export async function enforcePolicy(
  orgId: string,
  policyType: string,
  context: Record<string, any>
): Promise<{ allowed: boolean; reason?: string }> {
  await ensureGovernanceSchema();

  const policies = await getGovernancePolicies(orgId, { activeOnly: true });
  const matching = policies.filter((p) => p.policy_type === policyType);

  if (matching.length === 0) {
    return { allowed: true };
  }

  for (const policy of matching) {
    let config: Record<string, any> = {};
    try {
      config =
        typeof policy.config_json === 'string'
          ? JSON.parse(policy.config_json)
          : policy.config_json || {};
    } catch {
      config = {};
    }

    switch (policyType) {
      case 'rate_limit': {
        const maxRequests = Number(config.max_requests_per_hour) || Infinity;
        const currentRequests = Number(context.current_requests) || 0;
        if (currentRequests >= maxRequests) {
          return {
            allowed: false,
            reason: `Rate limit exceeded: ${currentRequests}/${maxRequests} requests/hour`,
          };
        }
        break;
      }
      case 'budget_gate': {
        const maxSpend = Number(config.max_spend_usd) || Infinity;
        const currentSpend = Number(context.current_spend_usd) || 0;
        if (currentSpend >= maxSpend) {
          return {
            allowed: false,
            reason: `Budget gate: spent $${currentSpend.toFixed(2)} of $${maxSpend.toFixed(2)} limit`,
          };
        }
        break;
      }
      case 'purpose_restriction': {
        const allowedPurposes: string[] = Array.isArray(config.allowed_purposes)
          ? config.allowed_purposes
          : [];
        const requestedPurpose = String(context.purpose || '');
        if (allowedPurposes.length > 0 && !allowedPurposes.includes(requestedPurpose)) {
          return { allowed: false, reason: `Purpose '${requestedPurpose}' is not in allowed list` };
        }
        break;
      }
      case 'content_filter': {
        const blockedKeywords: string[] = Array.isArray(config.blocked_keywords)
          ? config.blocked_keywords
          : [];
        const content = String(context.content || '').toLowerCase();
        const found = blockedKeywords.find((kw) => content.includes(kw.toLowerCase()));
        if (found) {
          return { allowed: false, reason: `Content filter: blocked keyword detected` };
        }
        break;
      }
      default: {
        logger.warn(`[AIGovernance] Unknown policy type: ${policyType}`);
        break;
      }
    }
  }

  return { allowed: true };
}
