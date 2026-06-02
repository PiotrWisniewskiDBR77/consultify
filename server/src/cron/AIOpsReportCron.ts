import cron from 'node-cron';

import { SlackServiceClass } from '../services/slackService.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

function resolveOpsWebhookUrl(): string {
  const direct = String(process.env.AI_OPS_SLACK_WEBHOOK_URL || '').trim();
  if (direct) return direct;
  const ai = String(process.env.AI_SLACK_WEBHOOK_URL || '').trim();
  if (ai) return ai;
  const envName = String(process.env.APP_ENV || process.env.NODE_ENV || 'development')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  return (
    String(process.env[`SLACK_WEBHOOK_URL_${envName}`] || '').trim() ||
    String(process.env.SLACK_WEBHOOK_URL || '').trim()
  );
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

async function sendOpsSnapshotToSlack(): Promise<void> {
  const url = resolveOpsWebhookUrl();
  if (!url) return;
  const slack = new SlackServiceClass({ webhookUrl: url });

  const snapshot = await buildSnapshot();
  const healthy = snapshot.providers.filter((p) => p.health === 'healthy').length;
  const degraded = snapshot.providers.filter((p) => p.health === 'degraded').length;
  const unhealthy = snapshot.providers.filter((p) => p.health === 'unhealthy').length;
  const unknown = snapshot.providers.filter((p) => p.health === 'unknown').length;

  const lines = snapshot.providers
    .slice(0, 12)
    .map((p) => `- ${p.provider}: ${p.health}`)
    .join('\n');

  await slack.sendSystemAlert(
    'AI Ops hourly snapshot',
    `DB: ${snapshot.dbOk ? 'healthy' : 'degraded'}\nLLM providers: healthy=${healthy}, degraded=${degraded}, unhealthy=${unhealthy}, unknown=${unknown}\n\n${lines}`,
    snapshot.dbOk && unhealthy === 0 && degraded === 0 ? 'INFO' : 'WARNING'
  );
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
