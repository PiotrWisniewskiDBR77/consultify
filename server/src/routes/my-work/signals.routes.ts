import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { readSignalFeed } from '../../services/signals/signalReadModel.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { requireTables, requireUser } from './_helpers.js';

const router = Router();
const db = { query: queryHelpers.queryAll };

const parseList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};
const rolesFor = (req: AuthRequest) => [String(req.userRole || req.user?.role || '')];
const normalizedRoles = (req: AuthRequest) =>
  rolesFor(req)
    .map((role) =>
      role
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
    )
    .filter(Boolean);

async function ownedSignal(req: AuthRequest, userId: string, orgId: string, signalId: string) {
  if (signalId.startsWith('notification:')) return null;
  const roles = normalizedRoles(req);
  const roleClause = roles.length
    ? `AND (audience_role IS NULL OR UPPER(audience_role) IN (${roles.map(() => '?').join(',')}))`
    : 'AND audience_role IS NULL';
  return queryHelpers.queryOne<{ signal_id: string }>(
    `SELECT signal_id FROM work_signals
      WHERE organization_id = ? AND signal_id::text = ?
        AND (audience_user_id IS NULL OR audience_user_id = ?) ${roleClause} LIMIT 1`,
    [orgId, signalId, userId, ...roles]
  );
}

router.get(
  '/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (
      !(await requireTables(res, [
        'work_signals',
        'work_signal_runs',
        'my_work_signal_prefs',
        'my_work_signal_snoozes',
        'my_work_signal_dismissals',
      ]))
    )
      return;
    res.status(200).json(
      await readSignalFeed({
        db,
        organizationId: identity.orgId,
        userId: identity.userId,
        roles: rolesFor(req),
        locale: String(req.headers['accept-language'] || 'pl'),
        limit: Number(req.query.limit) || 50,
        projectId: req.query.projectId ? String(req.query.projectId) : undefined,
        domain: req.query.domain ? String(req.query.domain) : undefined,
        origin: req.query.origin ? String(req.query.origin) : undefined,
        severityMin: req.query.severityMin ? String(req.query.severityMin) : undefined,
        cursor: req.query.cursor ? String(req.query.cursor) : undefined,
        can: req.can,
      })
    );
  })
);

async function updatePreference(params: {
  userId: string;
  orgId: string;
  column: 'muted_types_json' | 'muted_domains_json';
  value: string;
}) {
  const current = await queryHelpers.queryOne<Record<string, string>>(
    `SELECT ${params.column} FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ?`,
    [params.userId, params.orgId]
  );
  const next = [...new Set([...parseList(current?.[params.column]), params.value])];
  await queryHelpers.queryRun(
    `INSERT INTO my_work_signal_prefs(user_id,organization_id,${params.column},updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET
       organization_id=EXCLUDED.organization_id, ${params.column}=EXCLUDED.${params.column},
       updated_at=CURRENT_TIMESTAMP`,
    [params.userId, params.orgId, JSON.stringify(next)]
  );
  const readback = await queryHelpers.queryOne<Record<string, string>>(
    `SELECT ${params.column} FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ?`,
    [params.userId, params.orgId]
  );
  return parseList(readback?.[params.column]);
}

router.post(
  '/signals/mute-type',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const value = String(req.body?.type || '').trim();
    if (!value) return res.status(400).json({ error: 'TYPE_REQUIRED' });
    res.status(200).json({
      mutedTypes: await updatePreference({
        ...identity,
        userId: identity.userId,
        orgId: identity.orgId,
        column: 'muted_types_json',
        value,
      }),
    });
  })
);

router.post(
  '/signals/mute-domain',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const value = String(req.body?.domain || '')
      .trim()
      .toUpperCase();
    if (!value) return res.status(400).json({ error: 'DOMAIN_REQUIRED' });
    res.status(200).json({
      mutedDomains: await updatePreference({
        ...identity,
        userId: identity.userId,
        orgId: identity.orgId,
        column: 'muted_domains_json',
        value,
      }),
    });
  })
);

router.post(
  '/signals/:key/snooze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await ownedSignal(req, identity.userId, identity.orgId, req.params.key)))
      return res.status(404).json({ error: 'SIGNAL_NOT_FOUND' });
    const preset = String(req.body?.preset || 'tomorrow');
    const duration =
      preset === '1h'
        ? 3_600_000
        : preset === '4h'
          ? 14_400_000
          : preset === 'week'
            ? 604_800_000
            : 86_400_000;
    await queryHelpers.queryRun(
      `INSERT INTO my_work_signal_snoozes(user_id,signal_key,snoozed_until) VALUES (?, ?, ?)
       ON CONFLICT (user_id,signal_key) DO UPDATE SET snoozed_until=EXCLUDED.snoozed_until`,
      [identity.userId, req.params.key, new Date(Date.now() + duration).toISOString()]
    );
    const row = await queryHelpers.queryOne<{ snoozed_until: string }>(
      'SELECT snoozed_until FROM my_work_signal_snoozes WHERE user_id = ? AND signal_key = ?',
      [identity.userId, req.params.key]
    );
    res.status(200).json({ snoozedUntil: row?.snoozed_until });
  })
);

router.post(
  '/signals/:key/dismiss',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    if (!(await ownedSignal(req, identity.userId, identity.orgId, req.params.key)))
      return res.status(404).json({ error: 'SIGNAL_NOT_FOUND' });
    await queryHelpers.queryRun(
      `INSERT INTO my_work_signal_dismissals(user_id,signal_key,dismissed_at)
       VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT (user_id,signal_key)
       DO UPDATE SET dismissed_at=EXCLUDED.dismissed_at`,
      [identity.userId, req.params.key]
    );
    const row = await queryHelpers.queryOne<{ dismissed_at: string }>(
      'SELECT dismissed_at FROM my_work_signal_dismissals WHERE user_id = ? AND signal_key = ?',
      [identity.userId, req.params.key]
    );
    res.status(200).json({ dismissedAt: row?.dismissed_at });
  })
);

export default router;
