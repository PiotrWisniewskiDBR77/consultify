/**
 * Billing Webhook Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles triggering and recording of billing-related webhook events
 * 
 * Note: This is a TypeScript wrapper around the existing JS implementation
 * to maintain backward compatibility during migration.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import the JS implementation for now (will be fully migrated later)
const billingWebhookServiceJS = require('../../services/billingWebhookService.js');

// Export event types
export const BILLING_EVENT_TYPES = billingWebhookServiceJS.BILLING_EVENT_TYPES;

// Re-export the class and methods
export const BillingWebhookService = billingWebhookServiceJS.BillingWebhookService || billingWebhookServiceJS;

// Default export for backward compatibility
const billingWebhookService = billingWebhookServiceJS.default || billingWebhookServiceJS;

export default billingWebhookService;

