import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendSlackAlert = vi.fn().mockResolvedValue(undefined);
const sendWhatsAppAlert = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../server/src/services/slackService.js', () => ({
  SlackServiceClass: class {},
  default: {
    sendSystemAlert: (...args: any[]) => sendSlackAlert(...args),
  },
}));

vi.mock('../../../../server/src/services/slack/slackRouter.js', () => ({
  routeToSlack: (...args: any[]) => sendSlackAlert(...args),
}));

vi.mock('../../../../server/src/services/WhatsAppService.js', () => ({
  default: {
    sendSystemAlert: (...args: any[]) => sendWhatsAppAlert(...args),
  },
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('systemAlertNotifier', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('dispatches a system alert to Slack and WhatsApp', async () => {
    const { sendSystemAlert } = await import(
      '../../../../server/src/services/systemAlertNotifier.js'
    );

    await sendSystemAlert({
      title: 'Database unreachable',
      message: 'Timed out while connecting to postgres',
      severity: 'CRITICAL',
      source: 'Database',
    });

    expect(sendSlackAlert).toHaveBeenCalledWith({
      channel: 'alerts',
      category: 'Awaria',
      severity: 'CRITICAL',
      title: 'Database: Database unreachable',
      text: 'Timed out while connecting to postgres',
      dedupeKey: 'CRITICAL:Database:Database unreachable',
    });
    expect(sendWhatsAppAlert).toHaveBeenCalledWith({
      title: 'Database: Database unreachable',
      message: 'Timed out while connecting to postgres',
      severity: 'CRITICAL',
      source: 'Database',
    });
  });

  it('throttles repeated alerts for the same key', async () => {
    const { sendSystemAlert } = await import(
      '../../../../server/src/services/systemAlertNotifier.js'
    );

    const alert = {
      title: 'LLM startup validation failed',
      message: 'No healthy providers available',
      severity: 'CRITICAL' as const,
      source: 'LLM',
      throttleKey: 'llm_startup_validation_failed',
      throttleMs: 60_000,
    };

    await sendSystemAlert(alert);
    await sendSystemAlert(alert);

    expect(sendSlackAlert).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppAlert).toHaveBeenCalledTimes(1);
  });
});
