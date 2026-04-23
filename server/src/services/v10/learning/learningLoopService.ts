import crypto from 'crypto';
import { ZodError } from 'zod';

import { all as dbAll, get as dbGet, run as dbRun } from '../../../utils/DbPromise.js';
import type {
  LearningAdaptiveCoverageSummary,
  LearningFeedbackSubmitRequest,
  LearningFeedbackSubmitResponse,
  LearningIncidentsListResponse,
  LearningIncidentRecord,
  LearningIncidentReportRequest,
  LearningIncidentReportResponse,
  LearningQualityDashboard,
  LearningRetentionPreviewRequest,
  LearningRetentionPreviewResponse,
  LearningStewardshipListResponse,
  LearningStewardshipQueueItem,
  LearningStewardshipResolveRequest,
  LearningStewardshipResolveResponse,
} from '../../../types/v10/learning-loop.js';
import {
  LearningFeedbackSubmitRequestSchema,
  LearningIncidentReportRequestSchema,
  LearningRetentionPreviewRequestSchema,
  LearningStewardshipResolveRequestSchema,
} from '../../../types/v10/learning-loop.js';

class LearningLoopInputError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = 'LearningLoopInputError';
    this.code = code;
    this.status = status;
  }
}

function resolveNow(provided?: string): string {
  return provided?.trim() || new Date().toISOString();
}

type TenantKey = string;
function tenantKey(tenantId: string): TenantKey {
  return String(tenantId || '').trim();
}

type FeedbackRecord = {
  feedbackId: string;
  createdAt: string;
  rating: number;
  comment?: string;
  targetType: 'chat' | 'artifact' | 'tool' | 'unknown';
  targetId?: string;
  tags: readonly string[];
};

type RetentionPreviewRecord = {
  previewId: string;
  createdAt: string;
  retain: boolean;
  ttlDays: number;
  reasons: readonly string[];
};

function detectPiiReasons(text: string): string[] {
  const reasons: string[] = [];
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) reasons.push('contains_email');
  if (/\b(\+?\d[\d\s().-]{7,}\d)\b/.test(text)) reasons.push('contains_phone_like');
  if (/\b\d{11}\b/.test(text)) reasons.push('contains_sensitive_identifier_like');
  return reasons;
}

function redactForSample(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted_email]')
    .replace(/\b(\+?\d[\d\s().-]{7,}\d)\b/g, '[redacted_phone]')
    .slice(0, 500);
}

function safeJsonArray(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    return [];
  } catch {
    return [];
  }
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const asNum = Number(value);
  return Number.isFinite(asNum) ? asNum : fallback;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

export class LearningLoopService {
  async submitFeedback(input: LearningFeedbackSubmitRequest): Promise<LearningFeedbackSubmitResponse> {
    const parsed = LearningFeedbackSubmitRequestSchema.parse(input);
    const now = resolveNow(parsed.now);
    const tenantId = tenantKey(parsed.scope.tenantId);

    const feedbackId = crypto.randomUUID();
    const commentRedacted = parsed.comment ? redactForSample(parsed.comment) : null;

    await dbRun(
      `INSERT INTO v10_learning_feedback (
        feedback_id, organization_id, user_id, rating, target_type, target_id,
        comment_redacted, tags_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        feedbackId,
        tenantId,
        String(parsed.scope.userId || ''),
        parsed.rating,
        parsed.targetType,
        parsed.targetId ?? null,
        commentRedacted,
        JSON.stringify(parsed.tags ?? []),
        now,
      ]
    );

    const queuedForStewardship = parsed.rating <= 2;
    if (queuedForStewardship) {
      const itemId = crypto.randomUUID();
      await dbRun(
        `INSERT INTO v10_learning_stewardship_queue (
          item_id, organization_id, kind, summary, status, resolved_at, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          tenantId,
          'low_rating_feedback',
          `Low rating (${parsed.rating}) feedback`,
          'open',
          null,
          JSON.stringify({ feedbackId, rating: parsed.rating, targetType: parsed.targetType }),
          now,
        ]
      );
    }

    return { feedbackId, now, queuedForStewardship };
  }

  async retentionPreview(
    input: LearningRetentionPreviewRequest
  ): Promise<LearningRetentionPreviewResponse> {
    const parsed = LearningRetentionPreviewRequestSchema.parse(input);
    const now = resolveNow(parsed.now);
    const tenantId = tenantKey(parsed.scope.tenantId);

    const piiReasons = detectPiiReasons(parsed.text);
    const retain = piiReasons.length === 0;
    const ttlDays = retain ? 30 : 0;
    const reasons = retain ? ['no_pii_detected'] : piiReasons;
    const redactedSample = redactForSample(parsed.text);

    const previewId = crypto.randomUUID();
    await dbRun(
      `INSERT INTO v10_learning_retention_previews (
        preview_id, organization_id, user_id, retain, ttl_days, reasons_json,
        redacted_sample, context_hint, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        previewId,
        tenantId,
        String(parsed.scope.userId || ''),
        retain ? 1 : 0,
        ttlDays,
        JSON.stringify(reasons),
        redactedSample || null,
        parsed.contextHint ?? null,
        now,
      ]
    );

    if (!retain) {
      const itemId = crypto.randomUUID();
      await dbRun(
        `INSERT INTO v10_learning_stewardship_queue (
          item_id, organization_id, kind, summary, status, resolved_at, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          tenantId,
          'retention_blocked',
          `Retention blocked: ${reasons.join(', ')}`,
          'open',
          null,
          JSON.stringify({ previewId, reasons }),
          now,
        ]
      );
    }

    return { now, retain, ttlDays, reasons, redactedSample: redactedSample || null };
  }

  async listStewardship(scope: {
    tenantId: string;
    now?: string;
    limit?: number;
  }): Promise<LearningStewardshipListResponse> {
    const now = resolveNow(scope.now);
    const tenantId = tenantKey(scope.tenantId);
    const limit = Math.max(1, Math.min(500, toInt(scope.limit, 200)));

    const rows = await dbAll<{
      item_id: string;
      created_at: string;
      kind: LearningStewardshipQueueItem['kind'];
      summary: string;
      status: LearningStewardshipQueueItem['status'];
      resolved_at: string | null;
    }>(
      `SELECT item_id, created_at, kind, summary, status, resolved_at
       FROM v10_learning_stewardship_queue
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [tenantId, limit]
    );

    return {
      now,
      items: rows.map((row) => ({
        itemId: row.item_id,
        createdAt: row.created_at,
        kind: row.kind,
        summary: row.summary,
        status: row.status,
        resolvedAt: row.resolved_at,
      })),
    };
  }

  async resolveStewardship(
    itemIdRaw: string,
    input: LearningStewardshipResolveRequest
  ): Promise<LearningStewardshipResolveResponse> {
    const parsed = LearningStewardshipResolveRequestSchema.parse(input);
    const now = resolveNow(parsed.now);
    const tenantId = tenantKey(parsed.scope.tenantId);
    const itemId = String(itemIdRaw || '').trim();
    if (!itemId) {
      throw new LearningLoopInputError('LEARNING_LOOP_ITEM_ID_REQUIRED', 'itemId is required', 422);
    }

    const existing = await dbGet<{ item_id: string }>(
      `SELECT item_id
       FROM v10_learning_stewardship_queue
       WHERE item_id = ? AND organization_id = ?`,
      [itemId, tenantId]
    );
    if (!existing) {
      throw new LearningLoopInputError('LEARNING_LOOP_QUEUE_ITEM_NOT_FOUND', 'Queue item not found', 404);
    }

    await dbRun(
      `UPDATE v10_learning_stewardship_queue
       SET status = 'resolved',
           resolved_at = ?
       WHERE item_id = ? AND organization_id = ?`,
      [now, itemId, tenantId]
    );
    return { now, itemId, status: 'resolved' };
  }

  async reportIncident(
    input: LearningIncidentReportRequest
  ): Promise<LearningIncidentReportResponse> {
    const parsed = LearningIncidentReportRequestSchema.parse(input);
    const now = resolveNow(parsed.now);
    const tenantId = tenantKey(parsed.scope.tenantId);

    const incidentId = crypto.randomUUID();
    await dbRun(
      `INSERT INTO v10_learning_incidents (
        incident_id, organization_id, kind, severity, summary, detail, status, resolved_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incidentId,
        tenantId,
        parsed.kind,
        parsed.severity,
        parsed.summary,
        parsed.detail ?? null,
        'open',
        null,
        now,
      ]
    );

    const itemId = crypto.randomUUID();
    await dbRun(
      `INSERT INTO v10_learning_stewardship_queue (
        item_id, organization_id, kind, summary, status, resolved_at, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        tenantId,
        parsed.kind === 'drift' ? 'drift_detected' : 'incident_reported',
        `${parsed.kind}: ${parsed.summary}`,
        'open',
        null,
        JSON.stringify({ incidentId, kind: parsed.kind, severity: parsed.severity }),
        now,
      ]
    );

    return { now, incidentId, status: 'open' };
  }

  async listIncidents(scope: {
    tenantId: string;
    now?: string;
    limit?: number;
  }): Promise<LearningIncidentsListResponse> {
    const now = resolveNow(scope.now);
    const tenantId = tenantKey(scope.tenantId);
    const limit = Math.max(1, Math.min(500, toInt(scope.limit, 200)));

    const rows = await dbAll<{
      incident_id: string;
      created_at: string;
      kind: LearningIncidentRecord['kind'];
      severity: LearningIncidentRecord['severity'];
      summary: string;
      status: LearningIncidentRecord['status'];
    }>(
      `SELECT incident_id, created_at, kind, severity, summary, status
       FROM v10_learning_incidents
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [tenantId, limit]
    );

    return {
      now,
      incidents: rows.map((row) => ({
        incidentId: row.incident_id,
        createdAt: row.created_at,
        kind: row.kind,
        severity: row.severity,
        summary: row.summary,
        status: row.status,
      })),
    };
  }

  async coverage(scope: {
    tenantId: string;
    now?: string;
    limit?: number;
  }): Promise<LearningAdaptiveCoverageSummary> {
    const now = resolveNow(scope.now);
    const tenantId = tenantKey(scope.tenantId);
    const limit = Math.max(1, Math.min(2000, toInt(scope.limit, 500)));

    const rows = await dbAll<{ target_type: FeedbackRecord['targetType']; tags_json: string }>(
      `SELECT target_type, tags_json
       FROM v10_learning_feedback
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [tenantId, limit]
    );

    const byTargetType: Record<'chat' | 'artifact' | 'tool' | 'unknown', number> = {
      chat: 0,
      artifact: 0,
      tool: 0,
      unknown: 0,
    };
    const tagsCount = new Map<string, number>();

    for (const row of rows) {
      const targetType = row.target_type || 'unknown';
      byTargetType[targetType] = (byTargetType[targetType] || 0) + 1;
      for (const tag of safeJsonArray(row.tags_json)) {
        const t = String(tag || '').trim();
        if (!t) continue;
        tagsCount.set(t, (tagsCount.get(t) || 0) + 1);
      }
    }

    const gaps: string[] = [];
    if (byTargetType.chat === 0) gaps.push('no_chat_feedback');
    if (byTargetType.artifact === 0) gaps.push('no_artifact_feedback');
    if (byTargetType.tool === 0) gaps.push('no_tool_feedback');

    const tagsTop = Array.from(tagsCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));

    return { now, byTargetType, tagsTop, gaps };
  }

  async dashboard(scope: { tenantId: string; now?: string }): Promise<LearningQualityDashboard> {
    const now = resolveNow(scope.now);
    const tenantId = tenantKey(scope.tenantId);

    const feedbackAgg = await dbGet<{
      total: number;
      avg_rating: number | null;
      low_count: number;
    }>(
      `SELECT
         COUNT(*) as total,
         AVG(rating) as avg_rating,
         SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as low_count
       FROM v10_learning_feedback
       WHERE organization_id = ?`,
      [tenantId]
    );

    const retentionAgg = await dbGet<{ total: number; denied_count: number }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN retain = 0 THEN 1 ELSE 0 END) as denied_count
       FROM v10_learning_retention_previews
       WHERE organization_id = ?`,
      [tenantId]
    );

    const openItemsAgg = await dbGet<{ open_items: number }>(
      `SELECT COUNT(*) as open_items
       FROM v10_learning_stewardship_queue
       WHERE organization_id = ? AND status = 'open'`,
      [tenantId]
    );

    const incidentsAgg = await dbGet<{ total: number; open: number }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open
       FROM v10_learning_incidents
       WHERE organization_id = ?`,
      [tenantId]
    );

    const total = toInt(feedbackAgg?.total, 0);
    const avgRating = total === 0 ? 0 : Math.max(0, toNumber(feedbackAgg?.avg_rating, 0));
    const lowCount = toInt(feedbackAgg?.low_count, 0);
    const lowRatingRate = total === 0 ? 0 : Math.min(1, Math.max(0, lowCount / total));

    const previewTotal = toInt(retentionAgg?.total, 0);
    const deniedCount = toInt(retentionAgg?.denied_count, 0);
    const deniedRate = previewTotal === 0 ? 0 : Math.min(1, Math.max(0, deniedCount / previewTotal));

    const openItems = toInt(openItemsAgg?.open_items, 0);
    const openIncidents = toInt(incidentsAgg?.open, 0);
    const totalIncidents = toInt(incidentsAgg?.total, 0);

    return {
      now,
      feedback: { total, avgRating, lowRatingRate },
      retention: { previewTotal, deniedRate },
      stewardship: { openItems },
      incidents: { open: openIncidents, total: totalIncidents },
    };
  }
}

export function mapLearningLoopError(error: unknown): { status: number; body: unknown } {
  if (error instanceof ZodError) {
    return {
      status: 422,
      body: { error: 'Invalid learning loop request', code: 'LEARNING_LOOP_INVALID_REQUEST', issues: error.issues },
    };
  }
  if (error instanceof LearningLoopInputError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  if (error instanceof Error) {
    return { status: 422, body: { error: error.message, code: error.name } };
  }
  return { status: 500, body: { error: 'Unknown learning loop failure', code: 'LEARNING_LOOP_UNKNOWN_ERROR' } };
}

export const learningLoopService = new LearningLoopService();
export { LearningLoopInputError };

