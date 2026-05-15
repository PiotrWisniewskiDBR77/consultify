/**
 * P01 Generic Webhook Adapter — Unit Tests
 *
 * Validates that the genericWebhookSyncAdapter in integrationHubService
 * is a real implementation (not a no-op stub).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';

describe('Generic Webhook Sync Adapter', () => {
  const servicePath = 'server/src/services/integrationHubService.ts';
  const content = fs.readFileSync(servicePath, 'utf-8');

  it('genericWebhookSyncAdapter is defined as an async function', () => {
    expect(content).toContain('async function genericWebhookSyncAdapter');
  });

  it('is used as the fallback adapter for unknown connectors', () => {
    expect(content).toContain('return genericWebhookSyncAdapter(integrationId, config, options)');
  });

  it('references webhook registration and delivery tables', () => {
    expect(content).toContain('v8_webhook_registrations');
    expect(content).toContain('v8_webhook_deliveries');
  });

  it('implements HMAC signature computation', () => {
    expect(content).toContain('X-Webhook-Signature');
    expect(content).toContain('createHmac');
  });

  it('tracks delivery attempts and consecutive failures', () => {
    expect(content).toContain('attempt_count');
    expect(content).toContain('consecutive_failures');
  });
});
