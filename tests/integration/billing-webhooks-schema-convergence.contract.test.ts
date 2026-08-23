import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('billing and webhooks schema convergence migration', () => {
  const migration = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'server/migrations/20260823_billing_webhooks_schema_convergence.sql'
    ),
    'utf8'
  );

  it.each([
    'description',
    'price_yearly',
    'currency',
    'features',
    'limits',
    'is_active',
    'is_public',
    'trial_days',
    'sort_order',
    'stripe_price_id_monthly',
    'stripe_price_id_yearly',
    'updated_at',
  ])('adds subscription_plans.%s for baseline-first databases', (column) => {
    expect(migration).toContain(
      `ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS ${column} `
    );
  });

  it.each([
    'description',
    'events',
    'secret',
    'retry_policy',
    'headers',
    'payload_template',
    'created_by',
  ])('adds webhooks.%s for the live WebhookService contract', (column) => {
    expect(migration).toContain(`ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS ${column} `);
  });

  it('creates the creator index only after created_by converges', () => {
    expect(migration.indexOf('ADD COLUMN IF NOT EXISTS created_by')).toBeLessThan(
      migration.indexOf('idx_webhooks_creator')
    );
  });
});
