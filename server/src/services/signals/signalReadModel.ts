import type { SignalDTO, SignalQuery, WorkSignalRow } from '../../types/workSignals.js';
import { translateSignal } from './i18n/dictionary.js';

interface FeedRow extends WorkSignalRow {
  project_name: string | null;
  run_at: string;
}

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value && typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

const normalizeRole = (role: string) =>
  role
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

export async function readSignalFeed(params: {
  db: SignalQuery;
  organizationId: string;
  userId: string;
  roles: string[];
  locale: string;
  limit?: number;
  projectId?: string;
  domain?: string;
  origin?: string;
  severityMin?: string;
  cursor?: string;
  can?: (permission: string) => boolean;
}): Promise<{ signals: SignalDTO[]; nextCursor: string | null }> {
  const roles = [...new Set(params.roles.map(normalizeRole).filter(Boolean))];
  const limit = Math.max(1, Math.min(200, params.limit ?? 50));
  const conditions = [
    'w.organization_id = ?',
    "w.status = 'OPEN'",
    '(w.audience_user_id IS NULL OR w.audience_user_id = ?)',
  ];
  const values: unknown[] = [params.organizationId, params.userId];
  if (roles.length) {
    conditions.push(
      `(w.audience_role IS NULL OR UPPER(w.audience_role) IN (${roles.map(() => '?').join(',')}))`
    );
    values.push(...roles);
  } else conditions.push('w.audience_role IS NULL');
  if (params.projectId) {
    conditions.push('w.project_id = ?');
    values.push(params.projectId);
  }
  if (params.domain) {
    conditions.push('w.domain = ?');
    values.push(params.domain.toUpperCase());
  }
  if (params.origin) {
    conditions.push('w.origin = ?');
    values.push(params.origin.toUpperCase());
  }
  const ranks: Record<string, number> = { info: 0, warning: 1, critical: 2, blocker: 3 };
  if (params.severityMin && ranks[params.severityMin.toLowerCase()] !== undefined) {
    conditions.push(
      "CASE w.severity WHEN 'info' THEN 0 WHEN 'warning' THEN 1 WHEN 'critical' THEN 2 ELSE 3 END >= ?"
    );
    values.push(ranks[params.severityMin.toLowerCase()]);
  }
  if (params.cursor) {
    const [lastObservedAt, signalId] = Buffer.from(params.cursor, 'base64url')
      .toString()
      .split('|');
    if (lastObservedAt && signalId) {
      conditions.push('(w.last_observed_at, w.signal_id) < (?, ?::uuid)');
      values.push(lastObservedAt, signalId);
    }
  }
  values.push(
    params.userId,
    params.userId,
    params.userId,
    new Date().toISOString(),
    params.userId,
    limit + 1
  );
  const rows = await params.db.query<FeedRow>(
    `SELECT w.*, p.name AS project_name, r.started_at AS run_at
       FROM work_signals w
       LEFT JOIN projects p ON p.organization_id = w.organization_id AND p.id = w.project_id
       LEFT JOIN work_signal_runs r ON r.organization_id = w.organization_id AND r.run_id = w.run_id
      WHERE ${conditions.join(' AND ')}
        AND w.signal_type NOT IN (
          SELECT jsonb_array_elements_text(coalesce(nullif(pref.muted_types_json, '')::jsonb, '[]'::jsonb))
            FROM my_work_signal_prefs pref WHERE pref.user_id = ? AND pref.organization_id = w.organization_id
        )
        AND w.domain NOT IN (
          SELECT jsonb_array_elements_text(coalesce(nullif(pref.muted_domains_json, '')::jsonb, '[]'::jsonb))
            FROM my_work_signal_prefs pref WHERE pref.user_id = ? AND pref.organization_id = w.organization_id
        )
        AND NOT EXISTS (SELECT 1 FROM my_work_signal_snoozes s WHERE s.user_id = ? AND s.signal_key = w.signal_id::text AND s.snoozed_until::timestamptz > ?)
        AND NOT EXISTS (SELECT 1 FROM my_work_signal_dismissals d WHERE d.user_id = ? AND d.signal_key = w.signal_id::text)
      ORDER BY w.last_observed_at DESC, w.signal_id DESC LIMIT ?`,
    values
  );
  const page = rows.slice(0, limit);
  const signals = page.map((row): SignalDTO => {
    const titleParams = parseJson(row.title_params, {});
    const bodyParams = {
      value: parseJson(row.evidence, [{}])[0]?.observedValue,
      ...parseJson(row.body_params, {}),
    };
    const action = parseJson(row.action, { kind: '', route: '', params: {}, permission: '' });
    return {
      key: row.signal_id,
      type: row.signal_type,
      title: translateSignal(row.title_key, titleParams, params.locale),
      body: translateSignal(row.body_key, bodyParams, params.locale),
      severity:
        row.severity === 'blocker'
          ? 'CRITICAL'
          : (row.severity.toUpperCase() as SignalDTO['severity']),
      createdAt: row.created_at,
      projectId: row.project_id,
      projectName: row.project_name,
      entityType: row.subject_type,
      entityId: row.subject_id,
      domain: row.domain,
      origin: row.origin,
      severityRaw: row.severity,
      source: {
        evidence: parseJson(row.evidence, []),
        ruleId: row.rule_id,
        ruleVersion: row.rule_version,
      },
      freshness: { lastObservedAt: row.last_observed_at, runAt: row.run_at, nextRunAt: null },
      destination: { ...action, allowed: params.can ? params.can(action.permission) : null },
      ...(row.provenance ? { provenance: parseJson(row.provenance, {}) } : {}),
      isMine: row.audience_user_id === params.userId,
      titleKey: row.title_key,
      titleParams,
      bodyKey: row.body_key,
      bodyParams: parseJson(row.body_params, {}),
      firstObservedAt: row.first_observed_at,
      status: row.status,
    };
  });
  const last = page.at(-1);
  return {
    signals,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(
            `${new Date(last.last_observed_at).toISOString()}|${last.signal_id}`
          ).toString('base64url')
        : null,
  };
}
