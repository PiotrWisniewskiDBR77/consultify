import cron from 'node-cron';

import { routeToSlack } from '../services/slack/slackRouter.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const STATE_KEY = 'ai_ops_hourly';

/**
 * Lazy-ensure a tiny single-row state table used to suppress duplicate Slack
 * reports. We only want to ping Slack when the *alert-relevant* state actually
 * changes (a provider flips health, DB goes down/up) — NOT every hour on the
 * dot. Persisting the last signature in the DB (not memory) means a Railway
 * restart/redeploy won't re-spam an unchanged state. Additive + fail-safe.
 */
async function ensureStateTable(): Promise<boolean> {
  try {
    await dbRun(
      `CREATE TABLE IF NOT EXISTS ai_ops_report_state (
         key       TEXT PRIMARY KEY,
         signature TEXT,
         severity  TEXT,
         sent_at   TEXT
       )`,
      [],
      { fallback: false } as any
    );
    return true;
  } catch (e: any) {
    logger.warn('[AIOpsReportCron] ensureStateTable failed', { error: e?.message || e });
    return false;
  }
}

/**
 * Stable, severity-relevant fingerprint of a snapshot: DB reachability + each
 * active provider's health. Ordering/priority/cosmetic changes are ignored so
 * they never trigger a report.
 */
function computeSignature(snapshot: {
  dbOk: boolean;
  providers: Array<{ provider: string; health: string }>;
}): string {
  const providers = [...snapshot.providers]
    .sort((a, b) => a.provider.localeCompare(b.provider))
    .map((p) => `${p.provider}=${p.health}`)
    .join(',');
  return `db:${snapshot.dbOk ? 'ok' : 'down'}|${providers}`;
}

async function buildSnapshot(): Promise<{
  dbOk: boolean;
  providers: Array<{ provider: string; health: string; active: unknown }>;
}> {
  let dbOk = false;
  try {
    const row = await dbGet<{ ok?: number }>('SELECT 1 as ok', [], { fallback: false } as any);
    dbOk = Number((row as any)?.ok) === 1;
  } catch {
    dbOk = false;
  }

  const activeSql = (expr: string) =>
    `COALESCE(NULLIF(LOWER(TRIM(CAST(${expr} AS TEXT))), ''), 'false') IN ('1','t','true','y','yes','on')`;

  // Only include active providers and dedupe by provider name (there may be multiple rows per provider).
  const rows = await dbAll<{
    provider: string;
    health_status?: string | null;
    is_active?: unknown;
    is_default?: unknown;
    priority?: number | null;
    updated_at?: string | null;
  }>(
    `SELECT provider, health_status, is_active, is_default, priority, updated_at
     FROM llm_providers
     WHERE ${activeSql('is_active')}
     ORDER BY provider ASC, is_default DESC, priority DESC, updated_at DESC`,
    [],
    { fallback: true } as any
  );

  const byProvider = new Map<string, { provider: string; health: string; active: unknown }>();
  for (const r of rows || []) {
    const provider = String((r as any).provider || '')
      .trim()
      .toLowerCase();
    if (!provider) continue;
    if (byProvider.has(provider)) continue;
    const rawHealth = String((r as any).health_status || 'unknown').trim();
    const health = ['healthy', 'degraded', 'unhealthy', 'unknown'].includes(rawHealth)
      ? rawHealth
      : 'unknown';
    byProvider.set(provider, { provider, health, active: (r as any).is_active });
  }

  return {
    dbOk,
    providers: Array.from(byProvider.values()).sort((a, b) => a.provider.localeCompare(b.provider)),
  };
}

export async function sendOpsSnapshotToSlack(): Promise<void> {
  const snapshot = await buildSnapshot();
  const healthy = snapshot.providers.filter((p) => p.health === 'healthy').length;
  const degraded = snapshot.providers.filter((p) => p.health === 'degraded').length;
  const unhealthy = snapshot.providers.filter((p) => p.health === 'unhealthy').length;
  const unknown = snapshot.providers.filter((p) => p.health === 'unknown').length;
  const severity = snapshot.dbOk && unhealthy === 0 && degraded === 0 ? 'INFO' : 'WARNING';

  // Only report when the alert-relevant state CHANGED since last time. This is
  // the whole point of the fix: previously this fired every hour regardless,
  // flooding Slack with the same INFO/WARNING. Set AI_OPS_REPORT_ALWAYS_SEND=1
  // to restore the old always-send behaviour.
  const signature = computeSignature(snapshot);
  const alwaysSend = /^(1|true|yes|on)$/i.test(
    String(process.env.AI_OPS_REPORT_ALWAYS_SEND || '').trim()
  );
  if (!alwaysSend && (await ensureStateTable())) {
    try {
      const prev = await dbGet<{ signature?: string }>(
        'SELECT signature FROM ai_ops_report_state WHERE key = ?',
        [STATE_KEY],
        { fallback: true } as any
      );
      if (prev && String((prev as any).signature || '') === signature) {
        logger.debug?.('[AIOpsReportCron] state unchanged — skipping Slack report');
        return;
      }
    } catch (e: any) {
      // If the dedup read fails, fall through and send (fail-loud beats silence).
      logger.warn('[AIOpsReportCron] dedup read failed, sending anyway', {
        error: e?.message || e,
      });
    }
  }

  const lines = snapshot.providers
    .slice(0, 12)
    .map((p) => `- ${p.provider}: ${p.health}`)
    .join('\n');

  // Slack Command Center: route through the central router to the #cf-ai-ops
  // channel (bot + channel id, or its dedicated webhook fallback) instead of
  // the old bespoke webhook-only path — which silently sent nothing when
  // AI_OPS_SLACK_WEBHOOK_URL / AI_SLACK_WEBHOOK_URL / SLACK_WEBHOOK_URL were
  // all unset, and this cron never reported that as an error (`if (!url) return;`).
  // That's why #cf-ai-ops had zero messages since its creation.
  await routeToSlack({
    channel: 'ai_ops',
    severity: severity as 'INFO' | 'WARNING',
    category: 'AI Ops',
    title: 'AI Ops snapshot (zmiana stanu)',
    text: `DB: ${snapshot.dbOk ? 'healthy' : 'degraded'}\nDostawcy LLM: healthy=${healthy}, degraded=${degraded}, unhealthy=${unhealthy}, unknown=${unknown}\n\n${lines}`,
  });

  // Record the new state so the next hour stays quiet unless something moves.
  if (!alwaysSend) {
    try {
      const nowIso = new Date().toISOString();
      const updated = await dbRun(
        'UPDATE ai_ops_report_state SET signature = ?, severity = ?, sent_at = ? WHERE key = ?',
        [signature, severity, nowIso, STATE_KEY],
        { fallback: true } as any
      );
      if (!updated || Number((updated as any).changes ?? 0) === 0) {
        await dbRun(
          'INSERT INTO ai_ops_report_state (key, signature, severity, sent_at) VALUES (?, ?, ?, ?)',
          [STATE_KEY, signature, severity, nowIso],
          { fallback: true } as any
        );
      }
    } catch (e: any) {
      logger.warn('[AIOpsReportCron] failed to persist report state', {
        error: e?.message || e,
      });
    }
  }
}

let started = false;

export function startAIOpsReportCron(): void {
  if (started) return;
  started = true;

  const disabled = String(process.env.DISABLE_AI_OPS_REPORT || '').toLowerCase();
  if (disabled === '1' || disabled === 'true' || disabled === 'yes' || disabled === 'on') {
    logger.info('[AIOpsReportCron] Disabled via DISABLE_AI_OPS_REPORT');
    return;
  }

  // Run hourly at minute 10 to avoid stacking with other cron bursts.
  cron.schedule('10 * * * *', () => {
    void sendOpsSnapshotToSlack().catch((err: any) => {
      logger.warn('[AIOpsReportCron] failed', { error: err?.message || err });
    });
  });

  logger.info('[AIOpsReportCron] Started (hourly @ minute 10)');
}

export default { startAIOpsReportCron };
