import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

export type ReadinessTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'READY';

export interface DimensionScore {
  dimension: string;
  label: string;
  maxPoints: number;
  points: number;
  factors: { name: string; met: boolean; weight: number; evidence: string }[];
}

export interface ReadinessSnapshot {
  id: string;
  organizationId: string;
  score: number;
  tier: ReadinessTier;
  dimensions: DimensionScore[];
  penalties: { name: string; points: number; reason: string }[];
  blockers: string[];
  algorithmVersion: string;
  computedBy: string;
  computedAt: string;
}

export function tierFromScore(score: number): ReadinessTier {
  if (score >= 80) return 'READY';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export async function computeScore(orgId: string): Promise<ReadinessSnapshot> {
  const dimensions: DimensionScore[] = [];
  const penalties: ReadinessSnapshot['penalties'] = [];
  const blockers: string[] = [];
  const d1 = await computeD1(orgId);
  dimensions.push(d1);
  const d2 = await computeD2(orgId);
  dimensions.push(d2);
  const d3 = await computeD3(orgId);
  dimensions.push(d3);
  const d4 = await computeD4(orgId);
  dimensions.push(d4);
  if (d4.points < 5) blockers.push('BLOCKED_BY_BILLING');
  const d5 = await computeD5(orgId);
  dimensions.push(d5);
  if (d5.points < 5) blockers.push('BLOCKED_BY_COMPLIANCE');
  const pen = await computePenalties(orgId);
  penalties.push(...pen);
  const rawScore =
    dimensions.reduce((s, d) => s + d.points, 0) - penalties.reduce((s, p) => s + p.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  return {
    id: uuidv4(),
    organizationId: orgId,
    score,
    tier: tierFromScore(score),
    dimensions,
    penalties,
    blockers,
    algorithmVersion: 'v1',
    computedBy: 'system',
    computedAt: new Date().toISOString(),
  };
}

async function computeD1(orgId: string): Promise<DimensionScore> {
  const factors: DimensionScore['factors'] = [];
  const users: any[] = await dbAll(
    'SELECT email_verified, mfa_enabled FROM users WHERE organization_id = $1 LIMIT 50',
    [orgId]
  );
  factors.push({
    name: 'email_verified',
    met: users.some((u: any) => u.email_verified),
    weight: 6,
    evidence: `${users.filter((u: any) => u.email_verified).length}/${users.length} verified`,
  });
  factors.push({
    name: 'mfa_enabled',
    met: users.some((u: any) => u.mfa_enabled),
    weight: 5,
    evidence: users.some((u: any) => u.mfa_enabled) ? 'At least one user' : 'None',
  });
  const oauth: any = await dbGet(
    'SELECT COUNT(*) as cnt FROM oauth_links WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)',
    [orgId]
  );
  factors.push({
    name: 'connected_account',
    met: (oauth?.cnt || 0) > 0,
    weight: 4,
    evidence: `${oauth?.cnt || 0} linked`,
  });
  const fl: any = await dbGet(
    "SELECT COUNT(*) as cnt FROM login_history WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1) AND success = FALSE AND created_at > NOW() - INTERVAL '7 days'",
    [orgId]
  );
  factors.push({
    name: 'no_security_red_flags',
    met: (fl?.cnt || 0) < 10,
    weight: 5,
    evidence: `${fl?.cnt || 0} failed logins (7d)`,
  });
  const points = factors.filter((f) => f.met).reduce((s, f) => s + f.weight, 0);
  return {
    dimension: 'D1',
    label: 'Identity & Security',
    maxPoints: 20,
    points: Math.min(20, points),
    factors,
  };
}

async function computeD2(orgId: string): Promise<DimensionScore> {
  const factors: DimensionScore['factors'] = [];
  const ms: any = await dbGet(
    'SELECT COUNT(DISTINCT stage) as cnt FROM journey_events WHERE organization_id = $1',
    [orgId]
  );
  factors.push({
    name: 'journey_milestones',
    met: (ms?.cnt || 0) >= 2,
    weight: 8,
    evidence: `${ms?.cnt || 0} stages reached`,
  });
  const ad: any = await dbGet(
    'SELECT engagement_score FROM user_adoption_metrics WHERE organization_id = $1 ORDER BY measured_at DESC LIMIT 1',
    [orgId]
  );
  factors.push({
    name: 'engagement_score',
    met: (ad?.engagement_score || 0) >= 40,
    weight: 7,
    evidence: `Score: ${ad?.engagement_score || 0}`,
  });
  const ve: any = await dbGet(
    "SELECT COUNT(*) as cnt FROM journey_events WHERE organization_id = $1 AND event_name IN ('report_generated','initiative_created','assessment_completed') AND created_at > NOW() - INTERVAL '30 days'",
    [orgId]
  );
  factors.push({
    name: 'value_events',
    met: (ve?.cnt || 0) >= 3,
    weight: 10,
    evidence: `${ve?.cnt || 0} value events (30d)`,
  });
  const points = factors.filter((f) => f.met).reduce((s, f) => s + f.weight, 0);
  return {
    dimension: 'D2',
    label: 'Product Activation',
    maxPoints: 25,
    points: Math.min(25, points),
    factors,
  };
}

async function computeD3(orgId: string): Promise<DimensionScore> {
  const factors: DimensionScore['factors'] = [];
  const ini: any = await dbGet(
    'SELECT COUNT(*) as cnt FROM initiatives WHERE organization_id = $1 AND owner_id IS NOT NULL AND target_date IS NOT NULL',
    [orgId]
  );
  factors.push({
    name: 'initiative_with_owner',
    met: (ini?.cnt || 0) >= 1,
    weight: 10,
    evidence: `${ini?.cnt || 0} with owner+target`,
  });
  const dec: any = await dbGet(
    "SELECT COUNT(*) as cnt FROM decisions WHERE organization_id = $1 AND status = 'approved'",
    [orgId]
  );
  factors.push({
    name: 'approved_decisions',
    met: (dec?.cnt || 0) >= 1,
    weight: 10,
    evidence: `${dec?.cnt || 0} approved`,
  });
  const points = factors.filter((f) => f.met).reduce((s, f) => s + f.weight, 0);
  return {
    dimension: 'D3',
    label: 'Governance & Execution',
    maxPoints: 20,
    points: Math.min(20, points),
    factors,
  };
}

async function computeD4(orgId: string): Promise<DimensionScore> {
  const factors: DimensionScore['factors'] = [];
  const b: any = await dbGet(
    'SELECT plan, status, stripe_customer_id FROM organizations WHERE id = $1',
    [orgId]
  );
  factors.push({
    name: 'payment_method',
    met: !!b?.stripe_customer_id,
    weight: 10,
    evidence: b?.stripe_customer_id ? 'Stripe connected' : 'No payment method',
  });
  factors.push({
    name: 'no_overdue',
    met: b?.status !== 'past_due' && b?.status !== 'suspended',
    weight: 5,
    evidence: `Status: ${b?.status || 'unknown'}`,
  });
  factors.push({
    name: 'plan_intent',
    met: !!(b?.plan && b.plan !== 'free' && b.plan !== 'trial'),
    weight: 5,
    evidence: `Plan: ${b?.plan || 'none'}`,
  });
  const points = factors.filter((f) => f.met).reduce((s, f) => s + f.weight, 0);
  return {
    dimension: 'D4',
    label: 'Billing Readiness',
    maxPoints: 20,
    points: Math.min(20, points),
    factors,
  };
}

async function computeD5(orgId: string): Promise<DimensionScore> {
  const factors: DimensionScore['factors'] = [];
  const lg: any = await dbGet(
    'SELECT COUNT(*) as cnt FROM legal_acceptances WHERE organization_id = $1 AND accepted_at IS NOT NULL',
    [orgId]
  );
  factors.push({
    name: 'legal_acceptance',
    met: (lg?.cnt || 0) >= 1,
    weight: 10,
    evidence: `${lg?.cnt || 0} accepted`,
  });
  const sp: any = await dbGet(
    'SELECT session_timeout_minutes FROM organization_security_settings WHERE organization_id = $1',
    [orgId]
  );
  factors.push({
    name: 'security_settings',
    met: !!sp,
    weight: 5,
    evidence: sp ? 'Configured' : 'Default',
  });
  const points = factors.filter((f) => f.met).reduce((s, f) => s + f.weight, 0);
  return {
    dimension: 'D5',
    label: 'Compliance',
    maxPoints: 15,
    points: Math.min(15, points),
    factors,
  };
}

async function computePenalties(orgId: string): Promise<ReadinessSnapshot['penalties']> {
  const pens: ReadinessSnapshot['penalties'] = [];
  const ch: any = await dbGet(
    "SELECT severity FROM churn_warnings WHERE organization_id = $1 AND resolved_at IS NULL AND severity IN ('HIGH','CRITICAL') LIMIT 1",
    [orgId]
  );
  if (ch)
    pens.push({ name: 'churn_warning', points: 10, reason: `Active ${ch.severity} churn warning` });
  const ll: any = await dbGet(
    'SELECT MAX(created_at) as last FROM login_history WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1) AND success = TRUE',
    [orgId]
  );
  if (ll?.last) {
    const d = Math.floor((Date.now() - new Date(ll.last).getTime()) / 86400000);
    if (d > 14)
      pens.push({
        name: 'no_login',
        points: Math.min(10, d - 14),
        reason: `No login for ${d} days`,
      });
  }
  return pens;
}

export async function saveSnapshot(snapshot: ReadinessSnapshot): Promise<void> {
  await dbRun(
    'INSERT INTO transaction_readiness_scores (id, organization_id, score, tier, dimensions_json, penalties_json, blockers_json, algorithm_version, source_evidence_hash, computed_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [
      snapshot.id,
      snapshot.organizationId,
      snapshot.score,
      snapshot.tier,
      JSON.stringify(snapshot.dimensions),
      JSON.stringify(snapshot.penalties),
      JSON.stringify(snapshot.blockers),
      snapshot.algorithmVersion,
      crypto
        .createHash('sha256')
        .update(JSON.stringify(snapshot.dimensions))
        .digest('hex')
        .substring(0, 16),
      snapshot.computedBy,
    ]
  );
}

export async function logTierChange(
  orgId: string,
  oldTier: string | null,
  newTier: string,
  oldScore: number,
  newScore: number
): Promise<void> {
  await dbRun(
    'INSERT INTO transaction_readiness_events (id, organization_id, event_type, old_tier, new_tier, old_score, new_score) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [uuidv4(), orgId, 'tier_changed', oldTier, newTier, oldScore, newScore]
  );
}

export async function getLatestScore(orgId: string): Promise<ReadinessSnapshot | null> {
  const row: any = await dbGet(
    'SELECT * FROM transaction_readiness_scores WHERE organization_id = $1 ORDER BY computed_at DESC LIMIT 1',
    [orgId]
  );
  if (!row) return null;
  return mapRow(row);
}

export async function getRanking(limit = 50): Promise<ReadinessSnapshot[]> {
  const rows: any[] = await dbAll(
    'SELECT DISTINCT ON (organization_id) * FROM transaction_readiness_scores ORDER BY organization_id, computed_at DESC',
    []
  );
  return rows
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit)
    .map(mapRow);
}

export async function getHistory(orgId: string, days = 30): Promise<ReadinessSnapshot[]> {
  const rows: any[] = await dbAll(
    "SELECT * FROM transaction_readiness_scores WHERE organization_id = $1 AND computed_at > NOW() - INTERVAL '1 day' * $2 ORDER BY computed_at DESC",
    [orgId, days]
  );
  return rows.map(mapRow);
}

function mapRow(row: any): ReadinessSnapshot {
  return {
    id: row.id,
    organizationId: row.organization_id,
    score: row.score,
    tier: row.tier,
    dimensions:
      typeof row.dimensions_json === 'string'
        ? JSON.parse(row.dimensions_json)
        : row.dimensions_json,
    penalties:
      typeof row.penalties_json === 'string' ? JSON.parse(row.penalties_json) : row.penalties_json,
    blockers:
      typeof row.blockers_json === 'string' ? JSON.parse(row.blockers_json) : row.blockers_json,
    algorithmVersion: row.algorithm_version,
    computedBy: row.computed_by,
    computedAt: row.computed_at,
  };
}
