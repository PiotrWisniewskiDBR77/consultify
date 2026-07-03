import logger from '../utils/Logger.js';
import { routeToSlack } from './slack/slackRouter.js';
import { SlackServiceClass } from './slackService.js';
import WhatsAppService from './WhatsAppService.js';

export type SystemAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

type SystemAlertInput = {
  title: string;
  message: string;
  severity: SystemAlertSeverity;
  source?: string;
  throttleKey?: string;
  throttleMs?: number;
};

const alertThrottle = new Map<string, number>();

const aiSlackWebhookUrl = String(process.env.AI_SLACK_WEBHOOK_URL || '').trim();
const aiSlack =
  aiSlackWebhookUrl.length > 0 ? new SlackServiceClass({ webhookUrl: aiSlackWebhookUrl }) : null;

function shouldThrottle(input: SystemAlertInput): boolean {
  if (!input.throttleMs || input.throttleMs <= 0) {
    return false;
  }

  const key = input.throttleKey || `${input.severity}:${input.source || 'system'}:${input.title}`;
  const now = Date.now();
  const lastSentAt = alertThrottle.get(key);

  if (lastSentAt && now - lastSentAt < input.throttleMs) {
    return true;
  }

  alertThrottle.set(key, now);
  return false;
}

export async function sendSystemAlert(input: SystemAlertInput): Promise<void> {
  if (shouldThrottle(input)) {
    logger.debug('[SystemAlertNotifier] Alert throttled', {
      source: input.source,
      severity: input.severity,
      title: input.title,
    });
    return;
  }

  const title = input.source ? `${input.source}: ${input.title}` : input.title;
  const sourceKey = String(input.source || '')
    .trim()
    .toUpperCase();
  const isAiSource = sourceKey === 'LLM' || sourceKey === 'AI';

  // Slack egress now goes through the central slackRouter (Filar 1). AI/LLM
  // alerts keep their dedicated ai_ops webhook (unchanged behaviour); everything
  // else routes to the #alerts channel. Throttle above + WhatsApp below stay.
  const slackSend = isAiSource && aiSlack
    ? aiSlack.sendSystemAlert(title, input.message, input.severity)
    : routeToSlack({
        channel: 'alerts',
        // Headline (watch/phone): `🚨 Awaria · <źródło: tytuł>` for CRITICAL,
        // `⚠️ Ostrzeżenie · …` for WARNING — instantly recognisable.
        category: input.severity === 'CRITICAL' ? 'Awaria' : 'Ostrzeżenie',
        severity: input.severity,
        title,
        text: input.message,
        dedupeKey: input.throttleKey || `${input.severity}:${input.source || 'system'}:${input.title}`,
      }).then(() => undefined);

  const results = await Promise.allSettled([
    slackSend,
    WhatsAppService.sendSystemAlert({
      title,
      message: input.message,
      severity: input.severity,
      source: input.source,
    }),
  ]);

  const rejected = results.filter((result) => result.status === 'rejected');
  if (rejected.length > 0) {
    logger.warn('[SystemAlertNotifier] Some channels failed', {
      title,
      failedChannels: rejected.length,
    });
  }
}

export default {
  sendSystemAlert,
};
