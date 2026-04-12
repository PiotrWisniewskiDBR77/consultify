import WhatsAppService from './WhatsAppService.js';
import slackService from './slackService.js';
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
  const results = await Promise.allSettled([
    slackService.sendSystemAlert(title, input.message, input.severity),
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
