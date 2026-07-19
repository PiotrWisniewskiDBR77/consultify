/**
 * Acceptance E2E — InvoiceService line_items JSON routing (forward-port of
 * db74b4dd66, "InvoiceService written against dead migration 030" fix).
 *
 * Regression covered: InvoiceService used to be written against the
 * SQLite-era 030_multi_currency.sql.sql schema, which never applies to
 * Postgres (double .sql.sql extension — the migration runner glob
 * /^(7\d{2}|\d{8})_.*\.sql$/ never matches it). On the live schema this
 * silently broke every Stripe-webhook invoice sync:
 *   - createFromStripe() SELECTed organizations.billing_currency (phantom
 *     column) -> 42703 -> DbPromise fail-soft null -> "Organization not
 *     found" -> webhook returns 200 with nothing persisted.
 *   - createInvoice() INSERTed phantom invoices columns then
 *     `INSERT INTO invoice_items` -> 42P01 (table does not exist).
 *   - getInvoice() SELECTed FROM invoice_items -> 42P01.
 *
 * This test drives the REAL InvoiceService (real DB, real SQL) against the
 * LOCAL Postgres schema and proves createFromStripe() + getInvoice() persist
 * to invoices.line_items (JSON) and round-trip correctly — no 42703/42P01.
 *
 * Connects to a LOCAL Postgres only (guarded by requireLocalDbUrl()).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const ORG_ID = 'odbior--invoice-org-0001';
const STRIPE_CUSTOMER_ID = 'odbior--cus_invoice_test';

describe('InvoiceService — line_items JSON (db74b4dd66 forward-port)', () => {
  let client: import('pg').Client;
  let createdInvoiceId: string | null = null;

  beforeAll(async () => {
    client = pgClient();
    await client.connect();

    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, stripe_customer_id, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3, now())
       ON CONFLICT (id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id`,
      [ORG_ID, 'Odbior Invoice Harness Org', STRIPE_CUSTOMER_ID]
    );
  });

  afterAll(async () => {
    // Probes clean up after themselves — zero test records left behind.
    if (createdInvoiceId) {
      await client.query(`DELETE FROM invoices WHERE id = $1`, [createdInvoiceId]);
    }
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    await client.end();
  });

  it('createFromStripe() persists a real invoice row (no 42703/42P01) and getInvoice() round-trips line_items', async () => {
    const { createFromStripe, getInvoice } = await import(
      '../../server/src/services/InvoiceService.js'
    );

    const stripeInvoice = {
      id: `in_odbior_${Date.now()}`,
      customer: STRIPE_CUSTOMER_ID,
      amount_due: 15000,
      amount_paid: 15000,
      currency: 'usd',
      status: 'paid',
      lines: {
        data: [
          {
            description: 'Consultify — Enterprise plan (monthly)',
            quantity: 1,
            amount: 15000,
            plan: { nickname: 'Enterprise' },
          },
        ],
      },
      tax: 0,
      period_start: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
      period_end: Math.floor(Date.now() / 1000),
    };

    // Pre-fix this threw/short-circuited to null because organizations.billing_currency
    // does not exist on the live schema (42703 -> fail-soft -> "org not found").
    const created = await createFromStripe(stripeInvoice as any);

    expect(created).not.toBeNull();
    expect(created?.id).toBeTruthy();
    createdInvoiceId = created!.id as string;

    // Confirm the raw row landed with line_items JSON (not an invoice_items table,
    // which does not exist on the live schema).
    const raw = await client.query(
      `SELECT stripe_invoice_id, status, currency, line_items, metadata, subtotal, total
       FROM invoices WHERE id = $1`,
      [createdInvoiceId]
    );
    expect(raw.rows).toHaveLength(1);
    const row = raw.rows[0];
    expect(row.stripe_invoice_id).toBe(stripeInvoice.id);
    expect(row.status).toBe('paid');
    expect(row.line_items).toBeTruthy();

    const persistedItems = JSON.parse(row.line_items);
    expect(persistedItems).toEqual([
      {
        description: 'Consultify — Enterprise plan (monthly)',
        quantity: 1,
        unitPrice: 15000,
        amount: 15000,
      },
    ]);

    // Pre-fix this threw 42P01 (relation "invoice_items" does not exist).
    const fetched = await getInvoice(createdInvoiceId);
    expect(fetched).not.toBeNull();
    expect(fetched?.items).toEqual([
      {
        description: 'Consultify — Enterprise plan (monthly)',
        quantity: 1,
        unitPrice: 15000,
        amount: 15000,
      },
    ]);
    expect(fetched?.total).toBe(15000);
  });
});
