/**
 * Signals sub-router — extracted from my-work.routes.ts
 *
 * T012 (V2) — Contextual Intelligence Feed (Signals)
 * Backend-driven feed derived from notifications + persisted user prefs (mute/snooze/dismiss).
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import NotificationService from '../../services/notificationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { requireTables, requireUser } from './_helpers.js';

const router = Router();

const parseTagsArray = (input: unknown): string[] => {
  if (Array.isArray(input)) return input.map((x) => String(x).trim()).filter(Boolean);
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      // ignore
    }
    if (s.includes(','))
      return s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
  }
  return [];
};

const isAiSignalNotification = (nType?: string | null) => {
  const t = String(nType || '').toUpperCase();
  return (
    t.includes('AI') || t.includes('RECOMMENDATION') || t.includes('INSIGHT') || t.includes('RISK')
  );
};

const snoozePresetToUntil = (preset: string): string => {
  const now = Date.now();
  const p = String(preset || '').toLowerCase();
  if (p === '1h') return new Date(now + 60 * 60 * 1000).toISOString();
  if (p === '4h') return new Date(now + 4 * 60 * 60 * 1000).toISOString();
  if (p === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  if (p === 'week' || p === 'next_week')
    return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(now + 24 * 60 * 60 * 1000).toISOString();
};

router.get(
  '/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (
      !(await requireTables(res, [
        'my_work_signal_prefs',
        'my_work_signal_snoozes',
        'my_work_signal_dismissals',
        'notifications',
      ]))
    )
      return;

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const nowIso = new Date().toISOString();

    const prefs = await queryHelpers.queryOne<{ muted_types_json?: string }>(
      `SELECT muted_types_json FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ? LIMIT 1`,
      [userId, orgId]
    );
    const mutedTypes = parseTagsArray((prefs as any)?.muted_types_json).map((x) => x.toUpperCase());
    const mutedSet = new Set(mutedTypes);

    const snoozedRows =
      (await queryHelpers.queryAll<{ signal_key: string }>(
        `SELECT signal_key FROM my_work_signal_snoozes WHERE user_id = ? AND snoozed_until > ?`,
        [userId, nowIso]
      )) || [];
    const snoozedSet = new Set(snoozedRows.map((r) => String(r.signal_key)));

    const dismissedRows =
      (await queryHelpers.queryAll<{ signal_key: string }>(
        `SELECT signal_key FROM my_work_signal_dismissals WHERE user_id = ?`,
        [userId]
      )) || [];
    const dismissedSet = new Set(dismissedRows.map((r) => String(r.signal_key)));

    const notifCols = await getTableColumns('notifications');
    const notifHasRead = notifCols.has('read');
    const notifReadExpr = notifHasRead ? 'COALESCE(read, 0)' : '0';
    const notifMessageSelect = notifCols.has('message')
      ? 'message as body'
      : notifCols.has('body')
        ? 'body as body'
        : `'' as body`;
    const notifEntityTypeSelect = notifCols.has('entity_type')
      ? 'entity_type as "entityType"'
      : notifCols.has('entityType')
        ? 'entityType as "entityType"'
        : 'NULL as "entityType"';
    const notifEntityIdSelect = notifCols.has('entity_id')
      ? 'entity_id as "entityId"'
      : notifCols.has('entityId')
        ? 'entityId as "entityId"'
        : 'NULL as "entityId"';
    const notifProjectIdSelect = notifCols.has('project_id')
      ? 'project_id as "projectId"'
      : notifCols.has('projectId')
        ? 'projectId as "projectId"'
        : 'NULL as "projectId"';
    const notifProjectNameSelect = notifCols.has('project_name')
      ? 'project_name as "projectName"'
      : notifCols.has('projectName')
        ? 'projectName as "projectName"'
        : 'NULL as "projectName"';
    const notifSeveritySelect = notifCols.has('severity') ? 'severity' : `'INFO' as severity`;
    // Isolation: notifications carries organization_id (migrations-v2/001_baseline).
    // A user who belongs to multiple orgs must only see signals for the org
    // active in their token — never notifications generated in another org.
    const notifHasOrgId = notifCols.has('organization_id');
    const notifOrgFilter = notifHasOrgId ? 'AND organization_id = ?' : '';

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          type,
          title,
          ${notifMessageSelect},
          ${notifSeveritySelect},
          ${notifEntityTypeSelect},
          ${notifEntityIdSelect},
          ${notifProjectIdSelect},
          ${notifProjectNameSelect},
          created_at as "createdAt"
        FROM notifications
        WHERE user_id = ?
          AND ${notifReadExpr} = 0
          ${notifOrgFilter}
        ORDER BY created_at DESC
        LIMIT 200
      `,
        notifHasOrgId ? [userId, orgId] : [userId]
      )) || [];

    // Aggregate + filter
    const byKey = new Map<string, any>();
    for (const n of rows) {
      if (!isAiSignalNotification(n.type)) continue;
      const typeUp = String(n.type || '').toUpperCase();
      if (mutedSet.has(typeUp)) continue;

      const key = `notification:${String(n.id)}`;
      if (snoozedSet.has(key) || dismissedSet.has(key)) continue;
      if (projectId && n.projectId && String(n.projectId) !== String(projectId)) continue;

      const aggKey =
        n.entityType && n.entityId
          ? `${typeUp}:${String(n.entityType)}:${String(n.entityId)}`
          : key;
      const existing = byKey.get(aggKey);
      if (!existing) {
        byKey.set(aggKey, { ...n, key });
        continue;
      }
      const exTs = new Date(existing.createdAt || 0).getTime();
      const nTs = new Date(n.createdAt || 0).getTime();
      if (nTs > exTs) byKey.set(aggKey, { ...n, key });
    }

    const signals: any[] = Array.from(byKey.values())
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit)
      .map((n) => ({
        key: String(n.key),
        type: String(n.type || ''),
        title: String(n.title || 'Signal'),
        body: String(n.body || ''),
        severity: String(n.severity || 'INFO'),
        createdAt: n.createdAt || nowIso,
        projectId: n.projectId || null,
        projectName: n.projectName || null,
        entityType: n.entityType || null,
        entityId: n.entityId || null,
      }));

    // M6: Predictive signals — velocity-based predictions
    try {
      const taskCols = await getTableColumns('tasks');
      if (taskCols.has('due_date') && taskCols.has('assignee_id')) {
        const atRisk = await queryHelpers.queryAll<any>(
          `SELECT id, title, due_date FROM tasks
           WHERE assignee_id = ? AND organization_id = ?
           AND status IN ('todo', 'blocked')
           AND due_date IS NOT NULL AND due_date BETWEEN datetime('now') AND datetime('now', '+3 days')
           LIMIT 3`,
          [userId, orgId]
        );
        for (const task of atRisk || []) {
          const key = `predict_overdue_${task.id}`;
          if (!snoozedSet.has(key) && !dismissedSet.has(key)) {
            signals.push({
              key,
              type: 'prediction',
              severity: 'warning',
              title: `At risk: ${task.title}`,
              message: `Due ${task.due_date} but status is not in progress. Consider starting or rescheduling.`,
              source: 'ai_prediction',
              createdAt: new Date().toISOString(),
            });
          }
        }

        const decCols = await getTableColumns('decisions');
        if (decCols.has('decision_maker_id')) {
          const staleDecisions = await queryHelpers.queryAll<any>(
            `SELECT id, title, created_at FROM decisions
             WHERE (decision_maker_id = ? OR created_by = ?) AND organization_id = ?
             AND status = 'pending' AND created_at < datetime('now', '-5 days')
             LIMIT 3`,
            [userId, userId, orgId]
          );
          for (const dec of staleDecisions || []) {
            const key = `bottleneck_decision_${dec.id}`;
            if (!snoozedSet.has(key) && !dismissedSet.has(key)) {
              signals.push({
                key,
                type: 'bottleneck',
                severity: 'warning',
                title: `Decision bottleneck: ${dec.title}`,
                message: `Pending for ${Math.round((Date.now() - new Date(dec.created_at).getTime()) / 86400000)} days. May be blocking dependent work.`,
                source: 'ai_prediction',
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (err) {
      logger.error('[signals:predictions]', err);
    }

    res.json({ signals, mutedTypes });
  })
);

router.post(
  '/signals/mute-type',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_signal_prefs']))) return;

    const type = String(req.body?.type || '')
      .trim()
      .toUpperCase();
    if (!type) return res.status(400).json({ error: 'type is required' });

    const existing = await queryHelpers.queryOne<any>(
      `SELECT muted_types_json FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ? LIMIT 1`,
      [userId, orgId]
    );
    const current = parseTagsArray(existing?.muted_types_json).map((x) => x.toUpperCase());
    const next = Array.from(new Set([...current, type]));

    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_signal_prefs (user_id, organization_id, muted_types_json, quiet_hours_json, updated_at)
       VALUES (?, ?, ?, COALESCE((SELECT quiet_hours_json FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ?), '{}'), ?)`,
      [userId, orgId, JSON.stringify(next), userId, orgId, new Date().toISOString()]
    );

    res.json({ success: true, mutedTypes: next });
  })
);

/**
 * A signal key of the form `notification:<id>` is backed by a real row in
 * `notifications`. Before letting a mutation (snooze/dismiss) touch it,
 * confirm the row belongs to this user AND to their currently active
 * organization — otherwise a user who is a member of multiple orgs could
 * snooze/dismiss (and, via dismiss, mark-as-read) another org's record by
 * guessing/replaying its id. Non-notification keys (predictions, etc.) are
 * pure per-user preference rows and are not subject to this check.
 */
const verifyNotificationOwnership = async (
  key: string,
  userId: string,
  orgId: string
): Promise<boolean> => {
  if (!key.startsWith('notification:')) return true;
  const notifId = key.replace(/^notification:/, '');
  if (!notifId) return false;
  const notifCols = await getTableColumns('notifications');
  const notifHasOrgId = notifCols.has('organization_id');
  const row = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM notifications WHERE id = ? AND user_id = ? ${
      notifHasOrgId ? 'AND organization_id = ?' : ''
    } LIMIT 1`,
    notifHasOrgId ? [notifId, userId, orgId] : [notifId, userId]
  );
  return Boolean(row);
};

router.post(
  '/signals/:key/snooze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_signal_snoozes']))) return;

    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ error: 'key is required' });
    if (!(await verifyNotificationOwnership(key, userId, orgId))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const until =
      typeof req.body?.until === 'string' && req.body.until.trim()
        ? String(req.body.until).trim()
        : snoozePresetToUntil(String(req.body?.preset || 'tomorrow'));

    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_signal_snoozes (user_id, signal_key, snoozed_until, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, key, until]
    );
    res.json({ success: true, snoozedUntil: until });
  })
);

router.post(
  '/signals/:key/dismiss',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_signal_dismissals']))) return;

    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ error: 'key is required' });
    if (!(await verifyNotificationOwnership(key, userId, orgId))) {
      return res.status(404).json({ error: 'Not found' });
    }

    const dismissedAt = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_signal_dismissals (user_id, signal_key, dismissed_at)
       VALUES (?, ?, ?)`,
      [userId, key, dismissedAt]
    );

    // If this is a notification-backed signal, mark as read as well.
    if (key.startsWith('notification:')) {
      const notifId = key.replace(/^notification:/, '');
      try {
        await NotificationService.markAsRead(notifId, userId);
      } catch {
        // ignore
      }
    }

    res.json({ success: true, dismissedAt });
  })
);

export default router;
