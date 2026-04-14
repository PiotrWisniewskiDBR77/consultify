import WhatsAppService from './WhatsAppService.js';
import slackService from './slackService.js';
import { SlackServiceClass } from './slackService.js';
import logger from '../utils/Logger.js';

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
  const sourceKey = String(input.source || '').trim().toUpperCase();
  const slackTarget = (sourceKey === 'LLM' || sourceKey === 'AI') && aiSlack ? aiSlack : slackService;
  const results = await Promise.allSettled([
    slackTarget.sendSystemAlert(title, input.message, input.severity),
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
