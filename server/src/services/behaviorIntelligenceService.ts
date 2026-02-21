/**
 * Behavior Intelligence Service — T113
 * Journey event ingest, activation tracking, adoption metrics, churn signals
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

interface JourneyEvent {
  eventType: 'phase_entry' | 'milestone' | 'feature_use' | 'tour_event';
  eventName: string;
  phase?: string;
  metadata?: Record<string, unknown>;
}

interface ChurnWarning {
  id: string;
  organization_id: string;
  user_id?: string;
  warning_type: string;
  severity: string;
  status: string;
  details_json: string;
  created_at: string;
}

// OPT-OUT CHECK
export async function checkOptOut(userId: string): Promise<boolean> {
  try {
    const row = await dbGet<{ behavior_analytics_enabled?: number }>(
      `SELECT behavior_analytics_enabled FROM users WHERE id = ?`, [userId]
    );
    return row?.behavior_analytics_enabled === 0;
  } catch { return false; }
}

// JOURNEY EVENT INGEST
export async function ingestJourneyEvent(
  userId: string, organizationId: string | null, event: JourneyEvent
): Promise<{ id: string }> {
  if (await checkOptOut(userId)) return { id: 'opt-out' };

  const sanitized = sanitizeMetadata(event.metadata || {});
  const id = uuidv4();
  await dbRun(
    `INSERT INTO journey_events (id, user_id, organization_id, event_type, event_name, phase, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, userId, organizationId, event.eventType, event.eventName, event.phase || null, JSON.stringify(sanitized)]
  );
  await updateActivationStatus(userId, event);
  return { id };
}

export async function ingestJourneyBatch(
  userId: string, organizationId: string | null, events: JourneyEvent[]
): Promise<{ ingested: number }> {
  if (await checkOptOut(userId)) return { ingested: 0 };
  let ingested = 0;
  for (const event of events) {
    try { await ingestJourneyEvent(userId, organizationId, event); ingested++; }
    catch (err) { logger.warn('Failed to ingest journey event:', err); }
  }
  return { ingested };
}

// ACTIVATION STATUS
const ACTIVATION_RULES: Record<string, (name: string) => boolean> = {
  A: (n) => n.includes('login') || n.includes('signup') || n.includes('register'),
  B: (n) => n.includes('onboarding') || n.includes('first_project') || n.includes('tour_completed'),
  C: (n) => n.includes('report_generated') || n.includes('initiative_created') || n.includes('assessment_completed'),
};

async function updateActivationStatus(userId: string, event: JourneyEvent): Promise<void> {
  try {
    const existing = await dbGet<{ user_id?: string; current_phase?: string; first_event_at?: string }>(
      `SELECT * FROM user_activation_status WHERE user_id = ?`, [userId]
    );
    if (!existing?.user_id) {
      await dbRun(
        `INSERT OR IGNORE INTO user_activation_status (user_id, current_phase, first_event_at, last_event_at, updated_at)
         VALUES (?, 'A', datetime('now'), datetime('now'), datetime('now'))`, [userId]
      );
    }
    const updates: string[] = [`last_event_at = datetime('now')`, `updated_at = datetime('now')`];
    for (const [phase, checker] of Object.entries(ACTIVATION_RULES)) {
      if (checker(event.eventName)) updates.push(`phase_${phase.toLowerCase()}_activated = 1`);
    }
    const currentPhase = existing?.current_phase || 'A';
    let newPhase = currentPhase;
    if (ACTIVATION_RULES.A?.(event.eventName) && currentPhase === 'A') newPhase = 'B';
    if (ACTIVATION_RULES.B?.(event.eventName) && (currentPhase === 'A' || currentPhase === 'B')) newPhase = 'C';
    if (ACTIVATION_RULES.C?.(event.eventName) && currentPhase !== 'D') newPhase = 'D';
    if (newPhase !== currentPhase) {
      updates.push(`current_phase = '${newPhase}'`);
      if (newPhase === 'D' && existing?.first_event_at) {
        updates.push(`total_ttv_ms = CAST((julianday('now') - julianday(first_event_at)) * 86400000 AS INTEGER)`);
      }
    }
    await dbRun(`UPDATE user_activation_status SET ${updates.join(', ')} WHERE user_id = ?`, [userId]);
  } catch (err) { logger.warn('Failed to update activation status:', err); }
}

// ADOPTION METRICS (REAL)
export async function getAdoptionMetrics(userId: string, organizationId?: string) {
  const [eventCounts, featureTop, activation, logins7d, logins30d, aiUsage] = await Promise.all([
    dbGet<{ total: number; features: number; milestones: number; last_at: string | null }>(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN event_type='feature_use' THEN 1 ELSE 0 END) as features,
              SUM(CASE WHEN event_type='milestone' THEN 1 ELSE 0 END) as milestones,
              MAX(created_at) as last_at
       FROM journey_events WHERE user_id = ?`, [userId]),
    dbAll<{ event_name: string; cnt: number }>(
      `SELECT event_name, COUNT(*) as cnt FROM journey_events
       WHERE user_id = ? AND event_type = 'feature_use'
       GROUP BY event_name ORDER BY cnt DESC LIMIT 5`, [userId]),
    dbGet<{ current_phase: string }>(`SELECT current_phase FROM user_activation_status WHERE user_id = ?`, [userId]),
    dbGet<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM login_history WHERE user_id = ? AND login_at >= datetime('now', '-7 days')`, [userId]),
    dbGet<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM login_history WHERE user_id = ? AND login_at >= datetime('now', '-30 days')`, [userId]),
    dbGet<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ai_usage_logs WHERE user_id = ? AND created_at >= datetime('now', '-30 days')`, [userId]),
  ]);
  const totalEvents = eventCounts?.total || 0;
  const featureUseCount = eventCounts?.features || 0;
  const milestoneCount = eventCounts?.milestones || 0;
  const loginCount7d = logins7d?.cnt || 0;
  const loginCount30d = logins30d?.cnt || 0;
  const aiUsageCount = aiUsage?.cnt || 0;
  const engagementScore = Math.min(100, Math.round(featureUseCount * 2 + milestoneCount * 10 + loginCount7d * 5 + aiUsageCount * 1.5));
  return {
    userId, totalEvents, featureUseCount, milestoneCount,
    lastEventAt: eventCounts?.last_at || null,
    activationPhase: activation?.current_phase || 'A',
    loginCount7d, loginCount30d, aiUsageCount, engagementScore,
    topFeatures: featureTop.map(f => f.event_name),
  };
}

// CHURN WARNING GENERATION
export async function generateChurnWarnings(organizationId: string): Promise<ChurnWarning[]> {
  const warnings: ChurnWarning[] = [];

  const noLoginUsers = await dbAll<{ id: string; last_login: string }>(
    `SELECT u.id, u.last_login FROM users u
     WHERE u.organization_id = ? AND u.status = 'active'
     AND (u.last_login IS NULL OR u.last_login < datetime('now', '-14 days'))`, [organizationId]
  );
  for (const user of noLoginUsers) {
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM churn_warnings WHERE organization_id = ? AND user_id = ? AND warning_type = 'NO_LOGIN' AND status = 'ACTIVE'`,
      [organizationId, user.id]
    );
    if (!existing) {
      const id = uuidv4();
      const daysSince = user.last_login ? Math.floor((Date.now() - new Date(user.last_login).getTime()) / 86400000) : 999;
      await dbRun(
        `INSERT INTO churn_warnings (id, organization_id, user_id, warning_type, severity, message, metrics, status, created_at)
         VALUES (?, ?, ?, 'NO_LOGIN', ?, ?, ?, 'ACTIVE', datetime('now'))`,
        [id, organizationId, user.id, daysSince > 30 ? 'HIGH' : 'MEDIUM',
         `User has not logged in for ${daysSince} days`, JSON.stringify({ daysSinceLogin: daysSince })]
      );
      warnings.push({ id, organization_id: organizationId, user_id: user.id,
        warning_type: 'NO_LOGIN', severity: daysSince > 30 ? 'HIGH' : 'MEDIUM',
        status: 'ACTIVE', details_json: JSON.stringify({ daysSinceLogin: daysSince }),
        created_at: new Date().toISOString() });
    }
  }

  const usageDrop = await dbGet<{ events_7d: number; events_30d: number }>(
    `SELECT
       (SELECT COUNT(*) FROM journey_events WHERE organization_id = ? AND created_at >= datetime('now', '-7 days')) as events_7d,
       (SELECT COUNT(*) FROM journey_events WHERE organization_id = ? AND created_at >= datetime('now', '-30 days')) as events_30d`,
    [organizationId, organizationId]
  );
  if (usageDrop && usageDrop.events_30d > 10) {
    const ratio = usageDrop.events_7d / (usageDrop.events_30d / 4.28);
    if (ratio < 0.5) {
      const existing = await dbGet<{ id: string }>(
        `SELECT id FROM churn_warnings WHERE organization_id = ? AND warning_type = 'USAGE_DROP' AND status = 'ACTIVE' AND created_at >= datetime('now', '-7 days')`,
        [organizationId]
      );
      if (!existing) {
        const id = uuidv4();
        await dbRun(
          `INSERT INTO churn_warnings (id, organization_id, warning_type, severity, message, metrics, status, created_at)
           VALUES (?, ?, 'USAGE_DROP', 'HIGH', ?, ?, 'ACTIVE', datetime('now'))`,
          [id, organizationId, `Activity dropped ${Math.round((1 - ratio) * 100)}% (7d vs 30d avg)`,
           JSON.stringify({ events7d: usageDrop.events_7d, events30d: usageDrop.events_30d, ratio: Math.round(ratio * 100) / 100 })]
        );
        warnings.push({ id, organization_id: organizationId, warning_type: 'USAGE_DROP', severity: 'HIGH',
          status: 'ACTIVE', details_json: JSON.stringify({ ratio }), created_at: new Date().toISOString() });
      }
    }
  }
  return warnings;
}

// CHURN PREDICTION (EXPLAINABLE)
export async function getChurnPrediction(organizationId: string) {
  const [activeWarnings, loginActivity, eventActivity, orgUsers] = await Promise.all([
    dbAll<ChurnWarning>(`SELECT * FROM churn_warnings WHERE organization_id = ? AND status = 'ACTIVE'`, [organizationId]),
    dbGet<{ cnt: number }>(`SELECT COUNT(DISTINCT user_id) as cnt FROM login_history WHERE organization_id = ? AND login_at >= datetime('now', '-7 days')`, [organizationId]),
    dbGet<{ recent: number; older: number }>(
      `SELECT (SELECT COUNT(*) FROM journey_events WHERE organization_id = ? AND created_at >= datetime('now', '-7 days')) as recent,
              (SELECT COUNT(*) FROM journey_events WHERE organization_id = ? AND created_at >= datetime('now', '-30 days') AND created_at < datetime('now', '-7 days')) as older`,
      [organizationId, organizationId]),
    dbGet<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM users WHERE organization_id = ? AND status = 'active'`, [organizationId]),
  ]);

  const factors: Array<{ factor: string; weight: number; signal: string }> = [];
  let riskScore = 0;

  const warningCount = activeWarnings?.length || 0;
  if (warningCount > 0) {
    const highW = activeWarnings.filter(w => w.severity === 'HIGH' || w.severity === 'CRITICAL').length;
    const w = Math.min(40, warningCount * 10 + highW * 15);
    riskScore += w;
    factors.push({ factor: 'Active warnings', weight: w, signal: `${warningCount} active (${highW} high/critical)` });
  }
  const totalUsers = orgUsers?.cnt || 1;
  const activeLogins = loginActivity?.cnt || 0;
  const loginRatio = activeLogins / totalUsers;
  if (loginRatio < 0.3) {
    const w = Math.round((1 - loginRatio) * 30);
    riskScore += w;
    factors.push({ factor: 'Low login activity', weight: w, signal: `${activeLogins}/${totalUsers} users active in 7d` });
  }
  const recentEvents = eventActivity?.recent || 0;
  const olderEvents = eventActivity?.older || 0;
  if (olderEvents > 5 && recentEvents < olderEvents * 0.25) {
    riskScore += 20;
    factors.push({ factor: 'Usage decline', weight: 20, signal: `${recentEvents} events (7d) vs ${olderEvents} (prev 23d)` });
  }

  const overallScore = Math.max(0, 100 - riskScore);
  let churnRisk: string = 'LOW';
  if (riskScore >= 70) churnRisk = 'CRITICAL';
  else if (riskScore >= 50) churnRisk = 'HIGH';
  else if (riskScore >= 25) churnRisk = 'MEDIUM';
  const healthTrend = recentEvents > olderEvents * 0.3 ? 'stable' : recentEvents > 0 ? 'declining' : 'inactive';

  return { churnRisk, overallScore, healthTrend, factors, activeWarnings: warningCount };
}

// ORGANIZATION HEALTH SCORE
export async function calculateHealthScore(organizationId: string) {
  const prediction = await getChurnPrediction(organizationId);
  const [activationRate, featureAdoption] = await Promise.all([
    dbGet<{ activated: number; total: number }>(
      `SELECT
         (SELECT COUNT(*) FROM user_activation_status uas JOIN users u ON u.id = uas.user_id WHERE u.organization_id = ? AND uas.current_phase >= 'C') as activated,
         (SELECT COUNT(*) FROM users WHERE organization_id = ? AND status = 'active') as total`,
      [organizationId, organizationId]),
    dbGet<{ cnt: number }>(
      `SELECT COUNT(DISTINCT event_name) as cnt FROM journey_events
       WHERE organization_id = ? AND event_type = 'feature_use' AND created_at >= datetime('now', '-30 days')`,
      [organizationId]),
  ]);
  const total = activationRate?.total || 1;
  const activatedPct = Math.round(((activationRate?.activated || 0) / total) * 100);
  const featureCount = featureAdoption?.cnt || 0;
  return {
    overallScore: prediction.overallScore,
    churnRisk: prediction.churnRisk,
    healthTrend: prediction.healthTrend,
    dimensions: { activation: activatedPct, featureAdoption: Math.min(100, featureCount * 10), engagement: prediction.overallScore, retention: prediction.churnRisk === 'LOW' ? 90 : prediction.churnRisk === 'MEDIUM' ? 60 : 30 },
  };
}

// ORG BEHAVIOR SUMMARY
export async function getOrgBehaviorSummary(organizationId: string) {
  const [funnel, dau, wau, mau, topFeatures, warnings] = await Promise.all([
    dbAll<{ current_phase: string; cnt: number }>(
      `SELECT uas.current_phase, COUNT(*) as cnt FROM user_activation_status uas JOIN users u ON u.id = uas.user_id WHERE u.organization_id = ? GROUP BY uas.current_phase`, [organizationId]),
    dbGet<{ cnt: number }>(`SELECT COUNT(DISTINCT user_id) as cnt FROM login_history WHERE organization_id = ? AND login_at >= datetime('now', '-1 day')`, [organizationId]),
    dbGet<{ cnt: number }>(`SELECT COUNT(DISTINCT user_id) as cnt FROM login_history WHERE organization_id = ? AND login_at >= datetime('now', '-7 days')`, [organizationId]),
    dbGet<{ cnt: number }>(`SELECT COUNT(DISTINCT user_id) as cnt FROM login_history WHERE organization_id = ? AND login_at >= datetime('now', '-30 days')`, [organizationId]),
    dbAll<{ event_name: string; cnt: number }>(
      `SELECT event_name, COUNT(*) as cnt FROM journey_events WHERE organization_id = ? AND event_type = 'feature_use' AND created_at >= datetime('now', '-30 days') GROUP BY event_name ORDER BY cnt DESC LIMIT 10`, [organizationId]),
    dbAll<ChurnWarning>(`SELECT * FROM churn_warnings WHERE organization_id = ? AND status = 'ACTIVE' ORDER BY created_at DESC`, [organizationId]),
  ]);
  const activationFunnel: Record<string, number> = {};
  for (const row of funnel) activationFunnel[row.current_phase] = row.cnt;
  return {
    activationFunnel,
    retentionSnapshot: { dau: dau?.cnt || 0, wau: wau?.cnt || 0, mau: mau?.cnt || 0 },
    topFeatures: topFeatures.map(f => ({ name: f.event_name, count: f.cnt })),
    churnWarnings: warnings,
  };
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const piiPatterns = /email|password|phone|ssn|credit.?card|token|secret/i;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (piiPatterns.test(key)) continue;
    if (typeof value === 'string' && value.includes('@') && value.includes('.')) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export default {
  checkOptOut, ingestJourneyEvent, ingestJourneyBatch, getAdoptionMetrics,
  generateChurnWarnings, getChurnPrediction, calculateHealthScore, getOrgBehaviorSummary,
};
