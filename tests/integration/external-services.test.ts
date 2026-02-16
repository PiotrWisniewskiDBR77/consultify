import { describe, expect, it } from 'vitest';

import integrationService, {
  processWebhook,
} from '../../server/src/services/integrationService.ts';

describe('External services (webhook processing) - REAL_CODE', () => {
  it('processWebhook returns success payload', async () => {
    const res = await integrationService.processWebhook('stripe', { ok: true });
    expect(res).toEqual({ success: true, message: 'Webhook processed' });
  });

  it('named export processWebhook delegates to singleton', async () => {
    const res = await processWebhook('partner', { ok: true });
    expect(res.success).toBe(true);
  });
});
