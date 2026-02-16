/**
 * L1: Webhooks validators (honest unit tests).
 */

import { describe, expect, it } from 'vitest';

import {
  CreateWebhookBodySchema,
  GetDeliveriesQuerySchema,
  GetWebhooksQuerySchema,
  RetryDeliveryBodySchema,
  StripeWebhookBodySchema,
  TestWebhookBodySchema,
  WebhookIdParamSchema,
} from '../../../server/src/validators/webhooks.validators.js';

describe('webhooks.validators', () => {
  it('WebhookIdParamSchema: requires uuid', () => {
    const parsed = WebhookIdParamSchema.safeParse({ id: 'not-a-uuid' });
    expect(parsed.success).toBe(false);
  });

  it('CreateWebhookBodySchema: requires url + at least one event', () => {
    const parsed = CreateWebhookBodySchema.safeParse({ url: 'https://x.y' });
    expect(parsed.success).toBe(false);
  });

  it('GetWebhooksQuerySchema: accepts enabled true/false', () => {
    const parsed = GetWebhooksQuerySchema.parse({ enabled: 'false' });
    expect(parsed.enabled).toBe('false');
  });

  it('GetDeliveriesQuerySchema: defaults page=1 and pageSize=50', () => {
    const parsed = GetDeliveriesQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
  });

  it('TestWebhookBodySchema: allows optional payload record', () => {
    const parsed = TestWebhookBodySchema.parse({ payload: { a: 1 } });
    expect(parsed.payload?.a).toBe(1);
  });

  it('RetryDeliveryBodySchema: requires deliveryId uuid', () => {
    const parsed = RetryDeliveryBodySchema.safeParse({ deliveryId: 'x' });
    expect(parsed.success).toBe(false);
  });

  it('StripeWebhookBodySchema: validates minimal shape', () => {
    const parsed = StripeWebhookBodySchema.parse({ type: 'evt', data: { object: { id: '1' } } });
    expect(parsed.type).toBe('evt');
  });
});
