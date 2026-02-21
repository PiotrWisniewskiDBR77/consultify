/**
 * Transaction Readiness (T114)
 * Explainable, deterministic org-level score (0–100) + tier + blockers.
 *
 * NOTE: Implemented to be resilient across SQLite/Postgres and schema drift.
 */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';

export type ReadinessTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'READY';

export type ReadinessBlockFlag = 'BLOCKED_BY_BILLING' | 'BLOCKED_BY_COMPLIANCE';

export interface ReadinessDimension {
  id: 'D1' | 'D2' | 'D3' | 'D4' | 'D5';
  name: string;
  max: number;
  score: number;
  status: 'met' | 'partial' | 'missing' | 'unknown';
  evidence: Array<{ label: string; value: string | number | boolean }>;
}

export interface ReadinessPenalty {
  id: string;
  points: number; // negative number
  reason: string;
  evidence?: Array<{ label: string; value: string | number | boolean }>;
}

export interface TransactionReadinessSnapshot {
  organizationId: string;
  score: number;
  tier: ReadinessTier;
  flags: ReadinessBlockFlag[];
  dimensions: ReadinessDimension[];
  penalties: ReadinessPenalty[];
  blockers: string[];
  computedAt: string;
  algorithmVersion: string;
  sourceEvidenceHash: string;
}

const VERSION = 'v1';

const RecomputeInputSchema = z.object({
  reason: z.string().trim().min(2).max(500).optional(),
});

let tablesEnsured = false;
async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;

  // Compatible with SQLite/Postgres.
  await dbRun(`
    CREATE TABLE IF NOT EXISTS transaction_readiness_scores (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      tier TEXT NOT NULL,
      flags_json JSON,
      dimensions_json JSON,
      penalties_json JSON,
      blockers_json JSON,
      computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      computed_by TEXT,
      algorithm_version TEXT,
      source_evidence_hash TEXT
    )
  `);
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_trs_org_computed_at ON transaction_readiness_scores(organization_id, computed_at)`
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_trs_tier_score ON transaction_readiness_scores(tier, score)`
  );
  tablesEnsured = true;
}

function tierFromScore(score: number): ReadinessTier {
  if (score >= 80) return 'READY';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function hashEvidence(evidence: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

async function safeHasTable(table: string): Promise<boolean> {
  try {
    const cols = await getTableColumns(table);
    return cols.size > 0;
  } catch {
    return false;
  }
}

async function getOrgBillingSignals(organizationId: string): Promise<{
  paymentStatus?: string | null;
  dunningStage?: number | null;
  organizationType?: string | null;
  hasPaymentMethod?: boolean | null;
}> {
  const orgCols = await getTableColumns('organizations');
  const hasOrgs = orgCols.size > 0;
  let paymentStatus: string | null = null;
  let dunningStage: number | null = null;
  let organizationType: string | null = null;

  if (hasOrgs) {
    try {
      const row = await dbGet<Record<string, unknown>>(
        `SELECT * FROM organizations WHERE id = ? LIMIT 1`,
        [organizationId]
      );
      if (row) {
        if (orgCols.has('payment_status') && row.payment_status != null)
          paymentStatus = String(row.payment_status);
        if (orgCols.has('dunning_stage') && row.dunning_stage != null)
          dunningStage = Number(row.dunning_stage);
        if (orgCols.has('organization_type') && row.organization_type != null)
          organizationType = String(row.organization_type);
      }
    } catch {
      // ignore
    }
  }

  let hasPaymentMethod: boolean | null = null;
  // Prefer payment_methods table if present.
  if (await safeHasTable('payment_methods')) {
    const pmCols = await getTableColumns('payment_methods');
    if (pmCols.has('organization_id')) {
      try {
        const row = await dbGet<{ count?: number }>(
          `SELECT COUNT(*) as count FROM payment_methods WHERE organization_id = ?`,
          [organizationId]
        );
        hasPaymentMethod = (row?.count || 0) > 0;
      } catch {
        hasPaymentMethod = null;
      }
    }
  }

  // Fallback to organization_billing (stripe default payment method).
  if (hasPaymentMethod == null && (await safeHasTable('organization_billing'))) {
    const obCols = await getTableColumns('organization_billing');
    if (obCols.has('organization_id')) {
      const field =
        (obCols.has('default_payment_method') && 'default_payment_method') ||
        (obCols.has('stripe_default_payment_method') && 'stripe_default_payment_method') ||
        null;
      if (field) {
        try {
          const row = await dbGet<Record<string, unknown>>(
            `SELECT ${field} as pm FROM organization_billing WHERE organization_id = ? LIMIT 1`,
            [organizationId]
          );
          hasPaymentMethod = Boolean(row?.pm);
        } catch {
          hasPaymentMethod = null;
        }
      }
    }
  }

  return { paymentStatus, dunningStage, organizationType, hasPaymentMethod };
}

async function getOrgAdminUserId(organizationId: string): Promise<string | null> {
  try {
    const row = await dbGet<{ id: string }>(
      `SELECT id FROM users
       WHERE organization_id = ?
         AND LOWER(role) IN ('admin','owner','superadmin','administrator')
       ORDER BY CASE WHEN LOWER(role) = 'owner' THEN 0 WHEN LOWER(role) = 'admin' THEN 1 ELSE 2 END
       LIMIT 1`,
      [organizationId]
    );
    return row?.id || null;
  } catch {
    return null;
  }
}

async function computeDimensions(organizationId: string): Promise<{
  dimensions: ReadinessDimension[];
  flags: ReadinessBlockFlag[];
  penalties: ReadinessPenalty[];
}> {
  const flags: ReadinessBlockFlag[] = [];
  const penalties: ReadinessPenalty[] = [];
  const since30dIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since30dDate = since30dIso.slice(0, 10);

  // ======================
  // D1: Identity & Security (max 20)
  // ======================
  let linkedAccounts = 0;
  try {
    if ((await safeHasTable('oauth_links')) && (await safeHasTable('users'))) {
      const row = await dbGet<{ count?: number }>(
        `SELECT COUNT(*) as count
         FROM oauth_links l
         JOIN users u ON u.id = l.user_id
         WHERE u.organization_id = ?`,
        [organizationId]
      );
      linkedAccounts = row?.count || 0;
    }
  } catch {
    // ignore
  }
  const d1Score = Math.min(20, linkedAccounts > 0 ? 12 + Math.min(8, linkedAccounts * 2) : 6);
  const d1: ReadinessDimension = {
    id: 'D1',
    name: 'Identity & Security',
    max: 20,
    score: d1Score,
    status: linkedAccounts > 0 ? 'met' : 'partial',
    evidence: [{ label: 'linked_accounts', value: linkedAccounts }],
  };

  // ======================
  // D2: Activation & Adoption (max 25)
  // ======================
  let milestoneCount30d = 0;
  try {
    if (await safeHasTable('journey_events')) {
      const row = await dbGet<{ count?: number }>(
        `SELECT COUNT(DISTINCT event_name) as count
         FROM journey_events
         WHERE organization_id = ?
           AND created_at >= ?`,
        [organizationId, since30dIso]
      );
      milestoneCount30d = row?.count || 0;
    }
  } catch {
    // ignore
  }

  let engagementScore = 0;
  try {
    if (await safeHasTable('user_adoption_metrics')) {
      const row = await dbGet<{ avg?: number }>(
        `SELECT AVG(engagement_score) as avg
         FROM user_adoption_metrics
         WHERE organization_id = ?
           AND metric_date >= ?`,
        [organizationId, since30dDate]
      );
      engagementScore = Math.round(Number(row?.avg || 0));
    }
  } catch {
    // ignore
  }

  const d2Score = Math.max(
    0,
    Math.min(
      25,
      Math.round(Math.min(15, milestoneCount30d * 2) + Math.min(10, engagementScore / 10))
    )
  );
  const d2: ReadinessDimension = {
    id: 'D2',
    name: 'Activation & Adoption',
    max: 25,
    score: d2Score,
    status: milestoneCount30d >= 3 ? 'met' : milestoneCount30d > 0 ? 'partial' : 'missing',
    evidence: [
      { label: 'journey_milestones_30d', value: milestoneCount30d },
      { label: 'avg_engagement_score_30d', value: engagementScore },
    ],
  };

  // ======================
  // D3: Governance & Execution (max 20)
  // ======================
  let initiatives = 0;
  let initiativesWithOwner = 0;
  try {
    if (await safeHasTable('initiatives')) {
      const cols = await getTableColumns('initiatives');
      const rows = await dbAll<Record<string, unknown>>(
        `SELECT * FROM initiatives WHERE organization_id = ? LIMIT 200`,
        [organizationId]
      );
      initiatives = rows?.length || 0;
      if (cols.has('owner_id')) {
        initiativesWithOwner = (rows || []).filter((r) => Boolean(r.owner_id)).length;
      } else if (cols.has('owner')) {
        initiativesWithOwner = (rows || []).filter((r) => Boolean(r.owner)).length;
      }
    }
  } catch {
    // ignore
  }

  const ownerRatio = initiatives > 0 ? initiativesWithOwner / initiatives : 0;
  const d3Score =
    initiatives === 0 ? 6 : Math.max(0, Math.min(20, Math.round(6 + ownerRatio * 14)));
  const d3: ReadinessDimension = {
    id: 'D3',
    name: 'Governance & Execution',
    max: 20,
    score: d3Score,
    status: initiatives === 0 ? 'unknown' : ownerRatio >= 0.7 ? 'met' : 'partial',
    evidence: [
      { label: 'initiatives', value: initiatives },
      { label: 'initiatives_with_owner', value: initiativesWithOwner },
    ],
  };

  // ======================
  // D4: Billing readiness (max 20)
  // ======================
  const billing = await getOrgBillingSignals(organizationId);
  const isBlockedByBilling =
    (billing.paymentStatus &&
      ['past_due', 'unpaid', 'suspended'].includes(billing.paymentStatus.toLowerCase())) ||
    (billing.dunningStage != null && billing.dunningStage > 0);
  if (isBlockedByBilling) flags.push('BLOCKED_BY_BILLING');

  const hasPM = billing.hasPaymentMethod === true;
  const d4Score = isBlockedByBilling ? 0 : hasPM ? 18 : 8;
  const d4: ReadinessDimension = {
    id: 'D4',
    name: 'Billing readiness',
    max: 20,
    score: Math.min(20, d4Score),
    status: isBlockedByBilling ? 'missing' : hasPM ? 'met' : 'partial',
    evidence: [
      { label: 'payment_status', value: billing.paymentStatus || 'unknown' },
      { label: 'dunning_stage', value: billing.dunningStage ?? 0 },
      { label: 'has_payment_method', value: billing.hasPaymentMethod ?? false },
    ],
  };

  // ======================
  // D5: Compliance readiness (max 15)
  // ======================
  let complianceOk: boolean | null = null;
  try {
    const adminUserId = await getOrgAdminUserId(organizationId);
    if (adminUserId) {
      const legalService = (await import('../services/legalService.js')).default;
      const pending = await legalService.getPendingDocuments(adminUserId, organizationId, 'ADMIN');
      complianceOk = !pending?.hasAnyPending;
      if (!complianceOk) flags.push('BLOCKED_BY_COMPLIANCE');
    }
  } catch {
    complianceOk = null;
  }
  const d5Score = complianceOk === true ? 15 : complianceOk === false ? 0 : 8;
  const d5: ReadinessDimension = {
    id: 'D5',
    name: 'Compliance readiness',
    max: 15,
    score: Math.min(15, d5Score),
    status: complianceOk === true ? 'met' : complianceOk === false ? 'missing' : 'unknown',
    evidence: [{ label: 'legal_acceptance_current', value: complianceOk ?? 'unknown' }],
  };

  // ======================
  // Penalties (max -20)
  // ======================
  try {
    if (await safeHasTable('churn_warnings')) {
      const row = await dbGet<{ count?: number }>(
        `SELECT COUNT(*) as count
         FROM churn_warnings
         WHERE organization_id = ?
           AND (status = 'ACTIVE' OR status = 'active')`,
        [organizationId]
      );
      const activeWarnings = row?.count || 0;
      if (activeWarnings > 0) {
        penalties.push({
          id: 'CHURN_WARNINGS_ACTIVE',
          points: -Math.min(20, 5 + activeWarnings * 2),
          reason: 'Active churn warnings',
          evidence: [{ label: 'active_warnings', value: activeWarnings }],
        });
      }
    }
  } catch {
    // ignore
  }

  if (isBlockedByBilling) {
    penalties.push({
      id: 'BILLING_BLOCK',
      points: -15,
      reason: 'Billing risk (past due / dunning)',
    });
  }

  return { dimensions: [d1, d2, d3, d4, d5], flags, penalties };
}

function buildBlockers(dimensions: ReadinessDimension[], flags: ReadinessBlockFlag[]): string[] {
  const blockers: string[] = [];
  if (flags.includes('BLOCKED_BY_BILLING'))
    blockers.push('Billing: resolve past_due/dunning before upgrade.');
  if (flags.includes('BLOCKED_BY_COMPLIANCE'))
    blockers.push('Compliance: accept required legal documents.');

  const d2 = dimensions.find((d) => d.id === 'D2');
  if (d2 && d2.status !== 'met')
    blockers.push('Activation: complete key milestones to reach READY.');

  const d4 = dimensions.find((d) => d.id === 'D4');
  if (d4 && d4.status !== 'met') blockers.push('Billing: add a valid payment method.');

  return blockers.slice(0, 5);
}

async function clampWithSmoothing(
  organizationId: string,
  rawScore: number
): Promise<{ score: number; smoothed: boolean }> {
  try {
    await ensureTables();
    const last = await dbGet<{ score?: number }>(
      `SELECT score FROM transaction_readiness_scores
       WHERE organization_id = ?
       ORDER BY computed_at DESC
       LIMIT 1`,
      [organizationId]
    );
    const prev = Number(last?.score ?? rawScore);
    const delta = rawScore - prev;
    const maxDelta = 20;
    if (Math.abs(delta) > maxDelta) {
      return { score: prev + Math.sign(delta) * maxDelta, smoothed: true };
    }
  } catch {
    // ignore
  }
  return { score: rawScore, smoothed: false };
}

export async function computeAndStoreTransactionReadiness(opts: {
  organizationId: string;
  computedBy?: string;
  reason?: string;
}): Promise<TransactionReadinessSnapshot> {
  await ensureTables();

  const { dimensions, flags, penalties } = await computeDimensions(opts.organizationId);

  const dimensionSum = dimensions.reduce((acc, d) => acc + d.score, 0);
  const penaltySum = penalties.reduce((acc, p) => acc + p.points, 0); // negative
  const raw = Math.max(0, Math.min(100, dimensionSum + penaltySum));
  const sm = await clampWithSmoothing(opts.organizationId, raw);

  const score = sm.score;
  const tier = tierFromScore(score);
  const blockers = buildBlockers(dimensions, flags);

  const evidence = {
    dimensions,
    flags,
    penalties,
  };
  const sourceEvidenceHash = hashEvidence(evidence);
  const now = new Date().toISOString();

  const snapshot: TransactionReadinessSnapshot = {
    organizationId: opts.organizationId,
    score,
    tier,
    flags,
    dimensions,
    penalties,
    blockers,
    computedAt: now,
    algorithmVersion: VERSION,
    sourceEvidenceHash,
  };

  const id = uuidv4();
  try {
    await dbRun(
      `INSERT INTO transaction_readiness_scores
       (id, organization_id, score, tier, flags_json, dimensions_json, penalties_json, blockers_json, computed_at, computed_by, algorithm_version, source_evidence_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        opts.organizationId,
        score,
        tier,
        JSON.stringify(flags),
        JSON.stringify(dimensions),
        JSON.stringify(penalties),
        JSON.stringify(blockers),
        now,
        opts.computedBy || 'system',
        VERSION,
        sourceEvidenceHash,
      ]
    );
  } catch (err: any) {
    logger.warn('[TransactionReadiness] Failed to persist snapshot:', err?.message || err);
  }

  // T115 hook: emit Sellix signals on READY (best-effort, opt-in).
  try {
    const { maybeEmitSellixSignalsForSnapshot } = await import('./sellixIntegrationService.js');
    await maybeEmitSellixSignalsForSnapshot(snapshot);
  } catch {
    // ignore (integration optional)
  }

  return snapshot;
}

export async function getLatestTransactionReadiness(
  organizationId: string
): Promise<TransactionReadinessSnapshot | null> {
  await ensureTables();
  const row = await dbGet<Record<string, unknown>>(
    `SELECT * FROM transaction_readiness_scores WHERE organization_id = ? ORDER BY computed_at DESC LIMIT 1`,
    [organizationId]
  );
  if (!row) return null;
  return {
    organizationId,
    score: Number(row.score || 0),
    tier: String(row.tier || 'LOW') as ReadinessTier,
    flags: row.flags_json ? (JSON.parse(String(row.flags_json)) as ReadinessBlockFlag[]) : [],
    dimensions: row.dimensions_json
      ? (JSON.parse(String(row.dimensions_json)) as ReadinessDimension[])
      : [],
    penalties: row.penalties_json
      ? (JSON.parse(String(row.penalties_json)) as ReadinessPenalty[])
      : [],
    blockers: row.blockers_json ? (JSON.parse(String(row.blockers_json)) as string[]) : [],
    computedAt: String(row.computed_at || ''),
    algorithmVersion: String(row.algorithm_version || VERSION),
    sourceEvidenceHash: String(row.source_evidence_hash || ''),
  };
}

export async function getTransactionReadinessRanking(opts: {
  days?: number;
  limit?: number;
}): Promise<
  Array<{ organizationId: string; score: number; tier: ReadinessTier; computedAt: string }>
> {
  await ensureTables();
  const days = Math.max(1, Math.min(365, Number(opts.days || 30)));
  const limit = Math.max(1, Math.min(200, Number(opts.limit || 50)));
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Pick latest snapshot per org within window.
  const rows = await dbAll<Record<string, unknown>>(
    `
    SELECT t.organization_id, t.score, t.tier, t.computed_at
    FROM transaction_readiness_scores t
    JOIN (
      SELECT organization_id, MAX(computed_at) AS max_ts
      FROM transaction_readiness_scores
      WHERE computed_at >= ?
      GROUP BY organization_id
    ) latest
      ON latest.organization_id = t.organization_id AND latest.max_ts = t.computed_at
    ORDER BY t.score DESC
    LIMIT ?
    `,
    [sinceIso, limit]
  );

  return (rows || []).map((r) => ({
    organizationId: String(r.organization_id),
    score: Number(r.score || 0),
    tier: String(r.tier || 'LOW') as ReadinessTier,
    computedAt: String(r.computed_at || ''),
  }));
}

export function parseRecomputeInput(body: unknown): { reason?: string } {
  const parsed = RecomputeInputSchema.safeParse(body || {});
  if (!parsed.success) return {};
  return parsed.data;
}
