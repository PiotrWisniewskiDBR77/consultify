/**
 * Webhooks Validators
 * Zod schemas for webhook-related endpoints
 */

import { z } from 'zod';

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const WebhookIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const DeliveryIdParamSchema = z.object({
    deliveryId: z.string().uuid(),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const GetWebhooksQuerySchema = z.object({
    organizationId: z.string().uuid().optional(),
    enabled: z.enum(['true', 'false']).optional(),
});

export const GetDeliveriesQuerySchema = z.object({
    status: z.enum(['pending', 'success', 'failed']).optional(),
    eventType: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const CreateWebhookBodySchema = z.object({
    url: z.string().url(),
    events: z.array(z.string()).min(1),
    secret: z.string().optional(),
    enabled: z.boolean().optional().default(true),
    organization_id: z.string().uuid().optional(),
});

export const UpdateWebhookBodySchema = CreateWebhookBodySchema.partial();

export const TestWebhookBodySchema = z.object({
    payload: z.record(z.unknown()).optional(),
});

export const RetryDeliveryBodySchema = z.object({
    deliveryId: z.string().uuid(),
});

export const StripeWebhookBodySchema = z.object({
    type: z.string(),
    data: z.object({
        object: z.record(z.unknown()),
    }),
});

// ==========================================
// TYPES
// ==========================================

export type WebhookIdParam = z.infer<typeof WebhookIdParamSchema>;
export type DeliveryIdParam = z.infer<typeof DeliveryIdParamSchema>;
export type GetWebhooksQuery = z.infer<typeof GetWebhooksQuerySchema>;
export type GetDeliveriesQuery = z.infer<typeof GetDeliveriesQuerySchema>;
export type CreateWebhookBody = z.infer<typeof CreateWebhookBodySchema>;
export type UpdateWebhookBody = z.infer<typeof UpdateWebhookBodySchema>;
export type TestWebhookBody = z.infer<typeof TestWebhookBodySchema>;
export type RetryDeliveryBody = z.infer<typeof RetryDeliveryBodySchema>;
export type StripeWebhookBody = z.infer<typeof StripeWebhookBodySchema>;




