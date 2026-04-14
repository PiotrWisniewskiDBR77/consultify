import cron from 'node-cron';

import logger from '../utils/Logger.js';
import { get as dbGet, all as dbAll } from '../utils/DbPromise.js';
import { SlackServiceClass } from '../services/slackService.js';

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

  const providers = await dbAll<{ provider: string; health_status?: string; is_active?: unknown }>(
    `SELECT provider, health_status, is_active
     FROM llm_providers
     ORDER BY priority DESC, provider ASC`,
    [],
    { fallback: true } as any
  );

  return {
    dbOk,
    providers: (providers || []).map((p) => ({
      provider: String((p as any).provider || ''),
      health: String((p as any).health_status || 'unknown'),
      active: (p as any).is_active,
    })),
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

  const lines = snapshot.providers
    .slice(0, 12)
    .map((p) => `- ${p.provider}: ${p.health}`)
    .join('\n');

  await slack.sendSystemAlert(
    'AI Ops hourly snapshot',
    `DB: ${snapshot.dbOk ? 'healthy' : 'degraded'}\nLLM providers: healthy=${healthy}, degraded=${degraded}, unhealthy=${unhealthy}\n\n${lines}`,
    snapshot.dbOk && unhealthy === 0 ? 'INFO' : 'WARNING'
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

