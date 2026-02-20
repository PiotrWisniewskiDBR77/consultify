import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PulseCheckin {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  projectId: string | null;
  userId: string | null;
  isAnonymous: boolean;
  rating: number;
  comment: string | null;
  questionsJson: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ChangeFeedback {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  projectId: string | null;
  userId: string | null;
  isAnonymous: boolean;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
  sentimentScore: number | null;
  categories: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SentimentSnapshot {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  projectId: string | null;
  periodStart: string;
  periodEnd: string;
  avgRating: number | null;
  totalResponses: number;
  trend: 'improving' | 'stable' | 'declining' | null;
  topConcerns: string[];
  distribution: Record<string, number>;
  createdAt: string;
}

export interface ResistanceAlert {
  id: string;
  organizationId: string;
  initiativeId: string | null;
  projectId: string | null;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendations: string[];
  isAcknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface CoachingAction {
  id: string;
  organizationId: string | null;
  title: string;
  description: string | null;
  category: string | null;
  triggerSignal: string | null;
  isGlobal: boolean;
  createdAt: string;
}

export interface PulseSummary {
  avgRating: number | null;
  totalResponses: number;
  trend: 'improving' | 'stable' | 'declining' | null;
  distribution: Record<string, number>;
  recentComments: string[];
}

/* ------------------------------------------------------------------ */
/*  Row mappers                                                        */
/* ------------------------------------------------------------------ */

const ANONYMITY_THRESHOLD = 5;

function mapPulse(row: any): PulseCheckin {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    projectId: row.project_id,
    userId: row.is_anonymous ? null : row.user_id,
    isAnonymous: Boolean(row.is_anonymous),
    rating: row.rating,
    comment: row.comment,
    questionsJson: typeof row.questions_json === 'string' ? JSON.parse(row.questions_json) : row.questions_json ?? [],
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function mapFeedback(row: any): ChangeFeedback {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    projectId: row.project_id,
    userId: row.is_anonymous ? null : row.user_id,
    isAnonymous: Boolean(row.is_anonymous),
    content: row.content,
    sentiment: row.sentiment,
    sentimentScore: row.sentiment_score != null ? Number(row.sentiment_score) : null,
    categories: typeof row.categories === 'string' ? JSON.parse(row.categories) : row.categories ?? [],
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function mapSnapshot(row: any): SentimentSnapshot {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    projectId: row.project_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
    totalResponses: row.total_responses,
    trend: row.trend,
    topConcerns: typeof row.top_concerns === 'string' ? JSON.parse(row.top_concerns) : row.top_concerns ?? [],
    distribution: typeof row.distribution === 'string' ? JSON.parse(row.distribution) : row.distribution ?? {},
    createdAt: row.created_at,
  };
}

function mapAlert(row: any): ResistanceAlert {
  return {
    id: row.id,
    organizationId: row.organization_id,
    initiativeId: row.initiative_id,
    projectId: row.project_id,
    alertType: row.alert_type,
    severity: row.severity,
    message: row.message,
    recommendations: typeof row.recommendations === 'string' ? JSON.parse(row.recommendations) : row.recommendations ?? [],
    isAcknowledged: Boolean(row.is_acknowledged),
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    createdAt: row.created_at,
  };
}

function mapCoaching(row: any): CoachingAction {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description,
    category: row.category,
    triggerSignal: row.trigger_signal,
    isGlobal: Boolean(row.is_global),
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/*  Simple keyword-based sentiment analysis                            */
/* ------------------------------------------------------------------ */

const POSITIVE_WORDS = ['great', 'good', 'excellent', 'happy', 'love', 'amazing', 'fantastic', 'positive', 'wonderful', 'helpful', 'excited', 'confident', 'progress'];
const NEGATIVE_WORDS = ['bad', 'terrible', 'awful', 'hate', 'frustrated', 'confused', 'worried', 'unclear', 'slow', 'difficult', 'problem', 'issue', 'concern', 'fear', 'resist'];

function analyzeSentiment(text: string): { sentiment: ChangeFeedback['sentiment']; score: number } {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/);
  let pos = 0;
  let neg = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.includes(w)) pos++;
    if (NEGATIVE_WORDS.includes(w)) neg++;
  }
  const total = pos + neg;
  if (total === 0) return { sentiment: 'neutral', score: 0.5 };
  const score = pos / total;
  if (score > 0.6) return { sentiment: 'positive', score };
  if (score < 0.4) return { sentiment: 'negative', score };
  if (pos > 0 && neg > 0) return { sentiment: 'mixed', score: 0.5 };
  return { sentiment: 'neutral', score: 0.5 };
}

/* ------------------------------------------------------------------ */
/*  Pulse Check-ins                                                    */
/* ------------------------------------------------------------------ */

export async function submitPulse(
  orgId: string,
  data: {
    initiativeId?: string; projectId?: string; userId?: string;
    isAnonymous?: boolean; rating: number; comment?: string;
    questionsJson?: unknown[]; metadata?: Record<string, unknown>;
  }
): Promise<PulseCheckin> {
  const id = uuidv4();
  const anonymous = data.isAnonymous ?? false;
  await dbRun(
    `INSERT INTO change_pulse_checkins (id, organization_id, initiative_id, project_id, user_id, is_anonymous, rating, comment, questions_json, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id, orgId, data.initiativeId ?? null, data.projectId ?? null,
      anonymous ? null : (data.userId ?? null),
      anonymous, data.rating, data.comment ?? null,
      JSON.stringify(data.questionsJson ?? []),
      JSON.stringify(data.metadata ?? {}),
    ]
  );
  const row = await dbGet(`SELECT * FROM change_pulse_checkins WHERE id = $1`, [id]);
  return mapPulse(row);
}

export async function getPulseSummary(
  orgId: string,
  filters?: { initiativeId?: string; projectId?: string; days?: number }
): Promise<PulseSummary> {
  const days = filters?.days ?? 30;
  const params: unknown[] = [orgId, days];
  let where = `organization_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval`;
  let idx = 3;
  if (filters?.initiativeId) { where += ` AND initiative_id = $${idx++}`; params.push(filters.initiativeId); }
  if (filters?.projectId) { where += ` AND project_id = $${idx++}`; params.push(filters.projectId); }

  const aggRow: any = await dbGet(
    `SELECT AVG(rating) AS avg_rating, COUNT(*) AS total FROM change_pulse_checkins WHERE ${where}`,
    params
  );

  const distRows: any[] = await dbAll(
    `SELECT rating, COUNT(*) AS cnt FROM change_pulse_checkins WHERE ${where} GROUP BY rating ORDER BY rating`,
    params
  );
  const distribution: Record<string, number> = {};
  for (const dr of distRows) distribution[String(dr.rating)] = Number(dr.cnt);

  const total = Number(aggRow?.total ?? 0);
  let recentComments: string[] = [];
  if (total >= ANONYMITY_THRESHOLD) {
    const commentRows: any[] = await dbAll(
      `SELECT comment FROM change_pulse_checkins WHERE ${where} AND comment IS NOT NULL ORDER BY created_at DESC LIMIT 10`,
      params
    );
    recentComments = commentRows.map((r) => r.comment);
  }

  const trend = await computeTrend(orgId, filters);

  return {
    avgRating: aggRow?.avg_rating != null ? Number(Number(aggRow.avg_rating).toFixed(2)) : null,
    totalResponses: total,
    trend,
    distribution,
    recentComments,
  };
}

/* ------------------------------------------------------------------ */
/*  Feedback                                                           */
/* ------------------------------------------------------------------ */

export async function submitFeedback(
  orgId: string,
  data: {
    initiativeId?: string; projectId?: string; userId?: string;
    isAnonymous?: boolean; content: string; categories?: string[];
    metadata?: Record<string, unknown>;
  }
): Promise<ChangeFeedback> {
  const id = uuidv4();
  const anonymous = data.isAnonymous ?? false;
  const { sentiment, score } = analyzeSentiment(data.content);
  await dbRun(
    `INSERT INTO change_feedback (id, organization_id, initiative_id, project_id, user_id, is_anonymous, content, sentiment, sentiment_score, categories, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id, orgId, data.initiativeId ?? null, data.projectId ?? null,
      anonymous ? null : (data.userId ?? null),
      anonymous, data.content, sentiment, score,
      JSON.stringify(data.categories ?? []),
      JSON.stringify(data.metadata ?? {}),
    ]
  );
  const row = await dbGet(`SELECT * FROM change_feedback WHERE id = $1`, [id]);
  return mapFeedback(row);
}

export async function getFeedbackList(
  orgId: string,
  filters?: { initiativeId?: string; projectId?: string; limit?: number; offset?: number }
): Promise<ChangeFeedback[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM change_feedback WHERE organization_id = $1`;
  let idx = 2;
  if (filters?.initiativeId) { sql += ` AND initiative_id = $${idx++}`; params.push(filters.initiativeId); }
  if (filters?.projectId) { sql += ` AND project_id = $${idx++}`; params.push(filters.projectId); }
  sql += ` ORDER BY created_at DESC`;
  if (filters?.limit) { sql += ` LIMIT $${idx++}`; params.push(filters.limit); }
  if (filters?.offset) { sql += ` OFFSET $${idx++}`; params.push(filters.offset); }
  const rows = await dbAll(sql, params);
  return rows.map(mapFeedback);
}

/* ------------------------------------------------------------------ */
/*  Trend Computation                                                  */
/* ------------------------------------------------------------------ */

async function computeTrend(
  orgId: string,
  filters?: { initiativeId?: string; projectId?: string }
): Promise<'improving' | 'stable' | 'declining' | null> {
  const params: unknown[] = [orgId];
  let where = `organization_id = $1`;
  let idx = 2;
  if (filters?.initiativeId) { where += ` AND initiative_id = $${idx++}`; params.push(filters.initiativeId); }
  if (filters?.projectId) { where += ` AND project_id = $${idx++}`; params.push(filters.projectId); }

  const recentRow: any = await dbGet(
    `SELECT AVG(rating) AS avg FROM change_pulse_checkins WHERE ${where} AND created_at >= NOW() - INTERVAL '7 days'`,
    params
  );
  const previousRow: any = await dbGet(
    `SELECT AVG(rating) AS avg FROM change_pulse_checkins WHERE ${where} AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'`,
    params
  );

  if (recentRow?.avg == null || previousRow?.avg == null) return null;
  const diff = Number(recentRow.avg) - Number(previousRow.avg);
  if (diff > 0.3) return 'improving';
  if (diff < -0.3) return 'declining';
  return 'stable';
}

/* ------------------------------------------------------------------ */
/*  Resistance Alerts                                                  */
/* ------------------------------------------------------------------ */

export async function checkAndCreateAlerts(
  orgId: string,
  filters?: { initiativeId?: string; projectId?: string }
): Promise<ResistanceAlert[]> {
  const trend = await computeTrend(orgId, filters);
  if (trend !== 'declining') return [];

  const recentAlert: any = await dbGet(
    `SELECT id FROM change_resistance_alerts
     WHERE organization_id = $1 AND alert_type = 'declining_trend'
       AND created_at >= NOW() - INTERVAL '7 days'
       ${filters?.initiativeId ? 'AND initiative_id = $2' : ''}
     LIMIT 1`,
    filters?.initiativeId ? [orgId, filters.initiativeId] : [orgId]
  );
  if (recentAlert) return [];

  const id = uuidv4();
  await dbRun(
    `INSERT INTO change_resistance_alerts (id, organization_id, initiative_id, project_id, alert_type, severity, message, recommendations)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id, orgId, filters?.initiativeId ?? null, filters?.projectId ?? null,
      'declining_trend', 'high',
      'Sentiment trend is declining over the past 7 days compared to the prior week.',
      JSON.stringify([
        'Schedule a team retrospective to surface concerns',
        'Increase communication frequency about upcoming changes',
        'Consider a pulse survey to gather more specific feedback',
      ]),
    ]
  );
  const row = await dbGet(`SELECT * FROM change_resistance_alerts WHERE id = $1`, [id]);
  return [mapAlert(row)];
}

export async function getAlerts(
  orgId: string,
  filters?: { initiativeId?: string; acknowledged?: boolean }
): Promise<ResistanceAlert[]> {
  const params: unknown[] = [orgId];
  let sql = `SELECT * FROM change_resistance_alerts WHERE organization_id = $1`;
  let idx = 2;
  if (filters?.initiativeId) { sql += ` AND initiative_id = $${idx++}`; params.push(filters.initiativeId); }
  if (filters?.acknowledged !== undefined) { sql += ` AND is_acknowledged = $${idx++}`; params.push(filters.acknowledged); }
  sql += ` ORDER BY created_at DESC`;
  const rows = await dbAll(sql, params);
  return rows.map(mapAlert);
}

export async function acknowledgeAlert(orgId: string, alertId: string, userId: string): Promise<ResistanceAlert | null> {
  await dbRun(
    `UPDATE change_resistance_alerts SET is_acknowledged = TRUE, acknowledged_by = $1, acknowledged_at = NOW()
     WHERE id = $2 AND organization_id = $3`,
    [userId, alertId, orgId]
  );
  const row = await dbGet(`SELECT * FROM change_resistance_alerts WHERE id = $1`, [alertId]);
  return row ? mapAlert(row) : null;
}

/* ------------------------------------------------------------------ */
/*  Coaching Actions Library                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_COACHING_ACTIONS: Omit<CoachingAction, 'id' | 'createdAt'>[] = [
  { organizationId: null, title: 'Hold a listening session', description: 'Create a safe space for team members to share concerns about the change.', category: 'engagement', triggerSignal: 'declining_trend', isGlobal: true },
  { organizationId: null, title: 'Increase 1:1 check-ins', description: 'Schedule more frequent one-on-one meetings to address individual concerns.', category: 'support', triggerSignal: 'low_rating', isGlobal: true },
  { organizationId: null, title: 'Share quick wins', description: 'Communicate early successes to build momentum and confidence.', category: 'communication', triggerSignal: 'low_morale', isGlobal: true },
  { organizationId: null, title: 'Clarify the "why"', description: 'Revisit and communicate the reasons behind the change initiative.', category: 'communication', triggerSignal: 'confusion', isGlobal: true },
  { organizationId: null, title: 'Provide training resources', description: 'Offer additional training or resources to help people adapt.', category: 'enablement', triggerSignal: 'skill_gap', isGlobal: true },
];

export async function getCoachingActions(orgId: string): Promise<CoachingAction[]> {
  const rows = await dbAll(
    `SELECT * FROM change_coaching_actions WHERE organization_id = $1 OR is_global = TRUE ORDER BY title`,
    [orgId]
  );
  if (rows.length > 0) return rows.map(mapCoaching);

  const actions: CoachingAction[] = DEFAULT_COACHING_ACTIONS.map((a) => ({
    ...a,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  }));
  return actions;
}
