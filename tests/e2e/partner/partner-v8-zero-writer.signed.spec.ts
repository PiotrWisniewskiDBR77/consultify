import { randomUUID } from 'node:crypto';

import { expect, request as playwrightRequest, test } from '@playwright/test';
import { Pool } from 'pg';

import { getAuthHeader, readTestSupportState } from '../_helpers/testSupportState';
import { dismissOverlayIfPresent } from '../smoke/work-canvas-helpers';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

test.describe('Partner V8 zero-writer — mounted signed session', () => {
  test.setTimeout(180_000);

  test('uses governed company/campaign/payout writers and never retries a failed mutation through legacy', async ({ page }) => {
    const state = readTestSupportState();
    const run = `prt-v8-${randomUUID().slice(0, 8)}`;
    const headers = { ...getAuthHeader(), 'content-type': 'application/json' };
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    const cleanupClient = await pool.connect();
    const fixtureApi = await playwrightRequest.newContext({ baseURL: API });
    let partnerOrgId = '';
    const legacyMutations: string[] = [];
    let suiteLockHeld = false;

    const databasePrefix = String(process.env.PRT_ZERO_WRITER_DB_PREFIX || '').trim();
    expect(databasePrefix, 'explicit disposable database prefix').toMatch(/^prt_zero_writer(?:_|$)/);
    const databaseName = String(
      (await cleanupClient.query<{ current_database: string }>(`SELECT current_database()`)).rows[0]
        ?.current_database || ''
    );
    expect(databaseName.startsWith(databasePrefix)).toBe(true);
    await cleanupClient.query(`SELECT pg_advisory_lock(hashtext($1))`, [
      'prt-v8-zero-writer-mounted-suite',
    ]);
    suiteLockHeld = true;

    page.on('request', (req) => {
      if (/\/api\/partners\//.test(req.url()) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method())) {
        legacyMutations.push(`${req.method()} ${new URL(req.url()).pathname}`);
      }
    });

    try {
      const connected = await fixtureApi.post('/api/partners/connect', {
        headers,
        data: { name: `PRT V8 ${run}`, contactEmail: `${run}@example.test` },
      });
      expect([200, 201]).toContain(connected.status());
      const connection = await fixtureApi.get('/api/partners/connection', { headers });
      expect(connection.status()).toBe(200);
      partnerOrgId = String((await connection.json()).data.organization.id);

      await pool.query(
        `INSERT INTO partner_commission_transactions
          (id,partner_org_id,organization_id,transaction_type,transaction_date,gross_amount,
           commission_rate,commission_amount,currency,status,approved_at,approved_by,notes)
         VALUES($1,$2,$3,'BONUS',CURRENT_TIMESTAMP,1000,20,200,'EUR','APPROVED',CURRENT_TIMESTAMP,$4,$5)`,
        [randomUUID(), partnerOrgId, state.organizationId, state.userId, run]
      );
      const settledBefore = await pool.query<{ total: string }>(
        `SELECT COALESCE(SUM(net_amount),0)::text AS total
           FROM partner_payouts WHERE partner_org_id=$1`,
        [partnerOrgId]
      );
      const accrualAmount = Number(settledBefore.rows[0]?.total || 0) + 200;
      await pool.query(
        `INSERT INTO partner_program_ledger
          (id,partner_org_id,entry_type,amount,currency,occurred_at,recorded_at,source_ref,
           actor,actor_id,idempotency_key,rule_version)
         VALUES($1,$2,'accrual.posted',$3,'EUR',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$4::jsonb,
                'operator',$5,$6,'prt-mounted-v1')`,
        [randomUUID(), partnerOrgId, accrualAmount, JSON.stringify({ fixture: run }), state.userId, `${run}:accrual`]
      );
      await pool.query(
        `UPDATE partner_program_runtime SET lifecycle_phase='earn',updated_at=CURRENT_TIMESTAMP
          WHERE partner_org_id=$1`,
        [partnerOrgId]
      );
      const payoutSettings = await fixtureApi.put('/api/v8/partner/payout-settings', {
        headers,
        data: {
          payoutMethod: 'BANK_TRANSFER',
          payoutAccount: {
            accountHolderName: 'PRT V8 Owner',
            iban: 'DE89370400440532013000',
            bicSwift: 'COBADEFFXXX',
            bankName: 'Test Bank',
          },
        },
      });
      expect(payoutSettings.status(), await payoutSettings.text()).toBe(200);
      const earningsRead = await fixtureApi.get('/api/v8/partner/earnings-summary', { headers });
      expect(earningsRead.status(), await earningsRead.text()).toBe(200);
      const earnings = (await earningsRead.json()).data.earnings;
      expect(earnings.lifecyclePhase).toBe('earn');
      expect(earnings.readyForPayout).toBeGreaterThanOrEqual(200);
      const programRead = await fixtureApi.get('/api/v8/partner/program/status', { headers });
      expect(programRead.status(), await programRead.text()).toBe(200);
      expect((await programRead.json()).data).toMatchObject({
        lifecyclePhase: 'earn',
        payoutSettingsComplete: true,
      });

      await page.goto('/partner?tab=company-info');
      await dismissOverlayIfPresent(page);
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
      const name = page.getByText('Company Name', { exact: true }).locator('..').locator('input');
      await expect(name, 'company input must be bound to the connected organization').toHaveCount(1);
      await expect(name).toBeVisible();
      await expect(name).toHaveValue(`PRT V8 ${run}`);
      await name.fill(`PRT V8 Updated ${run}`);
      const companyResponse = page.waitForResponse(
        (res) => res.url().includes('/api/v8/partner/organization') && res.request().method() === 'PUT'
      );
      await page.getByRole('button', { name: 'Save Changes' }).evaluate((button: HTMLButtonElement) => button.click());
      expect((await companyResponse).status()).toBe(200);

      await page.goto('/partner?tab=referral-tools');
      await dismissOverlayIfPresent(page);
      await page.getByRole('button', { name: /New Campaign/i }).evaluate((button: HTMLButtonElement) => button.click());
      await page.getByPlaceholder('e.g., LinkedIn Q1').fill(`Campaign ${run}`);
      const campaignResponse = page.waitForResponse(
        (res) => res.url().includes('/api/v8/partner/campaign-links') && res.request().method() === 'POST'
      );
      await page.getByRole('button', { name: /^Create$/i }).evaluate((button: HTMLButtonElement) => button.click());
      expect((await campaignResponse).status()).toBe(201);
      await expect(page.getByText(`Campaign ${run}`)).toBeVisible();

      await page.goto('/partner?tab=earnings');
      await dismissOverlayIfPresent(page);
      const requestPayoutButton = page.getByRole('button', {
        name: /Zażądaj wypłaty|Request payout/i,
      });
      await expect(requestPayoutButton).toBeEnabled();
      const payoutResponse = page.waitForResponse(
        (res) => res.url().includes('/api/v8/partner/payouts/request') && res.request().method() === 'POST'
      );
      await requestPayoutButton.evaluate((button: HTMLButtonElement) => button.click());
      expect((await payoutResponse).status()).toBe(201);

      await page.route('**/api/v8/partner/organization', async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'forced governed failure' }) });
          return;
        }
        await route.continue();
      });
      await page.goto('/partner?tab=company-info');
      await dismissOverlayIfPresent(page);
      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
      await page.getByRole('button', { name: 'Save Changes' }).evaluate((button: HTMLButtonElement) => button.click());
      await expect(page.getByText(/Failed to save changes/i)).toBeVisible();
      expect(legacyMutations).toEqual([]);

      const revoked = await fixtureApi.post('/api/test-support/member', {
        headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
        data: { runId: state.runId, role: 'USER' },
      });
      expect(revoked.status()).toBe(201);
      const revokedPersona = await revoked.json();
      await pool.query(
        `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, revokedPersona.userId]
      );
      const revokedWrite = await fixtureApi.put('/api/v8/partner/organization', {
        headers: { Authorization: `Bearer ${revokedPersona.token}` },
        data: { name: 'denied' },
      });
      expect(revokedWrite.status()).toBe(403);

      const foreign = await fixtureApi.post('/api/test-support/bootstrap', {
        headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
        data: { runId: `${run}-foreign`, role: 'OWNER' },
      });
      expect([200, 201]).toContain(foreign.status());
      const foreignPersona = await foreign.json();
      const foreignWrite = await fixtureApi.put('/api/v8/partner/organization', {
        headers: { Authorization: `Bearer ${foreignPersona.token}` },
        data: { name: 'foreign denied' },
      });
      expect(foreignWrite.status()).toBe(403);
    } finally {
      try {
        if (partnerOrgId) {
          await cleanupClient.query('BEGIN');
          try {
            expect(
              (await cleanupClient.query<{ tgenabled: string }>(
                `SELECT tgenabled FROM pg_trigger WHERE tgrelid='partner_program_ledger'::regclass
                  AND tgname='trg_partner_program_ledger_guard' AND NOT tgisinternal`
              )).rows
            ).toEqual([{ tgenabled: 'O' }]);
            await cleanupClient.query(`DELETE FROM partner_payouts WHERE partner_org_id=$1`, [partnerOrgId]);
            await cleanupClient.query(`DELETE FROM partner_commission_transactions WHERE partner_org_id=$1`, [partnerOrgId]);
            await cleanupClient.query(`DELETE FROM partner_campaign_links WHERE partner_org_id=$1`, [partnerOrgId]);
            await cleanupClient.query(`ALTER TABLE partner_program_ledger DISABLE TRIGGER trg_partner_program_ledger_guard`);
            await cleanupClient.query(`DELETE FROM partner_program_ledger WHERE partner_org_id=$1`, [partnerOrgId]);
            await cleanupClient.query(`ALTER TABLE partner_program_ledger ENABLE TRIGGER trg_partner_program_ledger_guard`);
            await cleanupClient.query(`DELETE FROM partner_users WHERE partner_org_id=$1`, [partnerOrgId]);
            await cleanupClient.query(`DELETE FROM partner_organizations WHERE id=$1`, [partnerOrgId]);
            await cleanupClient.query('COMMIT');
          } catch (error) {
            try {
              await cleanupClient.query(`ALTER TABLE partner_program_ledger ENABLE TRIGGER trg_partner_program_ledger_guard`);
            } catch {
              // ROLLBACK below restores any transaction-local trigger state.
            }
            await cleanupClient.query('ROLLBACK');
            throw error;
          }
          expect(
            (await cleanupClient.query<{ tgenabled: string }>(
              `SELECT tgenabled FROM pg_trigger WHERE tgrelid='partner_program_ledger'::regclass
                AND tgname='trg_partner_program_ledger_guard' AND NOT tgisinternal`
            )).rows
          ).toEqual([{ tgenabled: 'O' }]);
          const residue = await cleanupClient.query<{ n: number }>(
            `SELECT
              (SELECT count(*) FROM partner_organizations WHERE id::text=$1::text)::int +
              (SELECT count(*) FROM partner_users WHERE partner_org_id::text=$1::text)::int +
              (SELECT count(*) FROM partner_campaign_links WHERE partner_org_id::text=$1::text)::int +
              (SELECT count(*) FROM partner_program_ledger WHERE partner_org_id::text=$1::text)::int +
              (SELECT count(*) FROM partner_commission_transactions WHERE partner_org_id::text=$1::text)::int +
              (SELECT count(*) FROM partner_payouts WHERE partner_org_id::text=$1::text)::int AS n`,
            [partnerOrgId]
          );
          expect(residue.rows[0]?.n).toBe(0);
        }
        await fixtureApi.post('/api/test-support/cleanup', {
          headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
          data: { runId: state.runId },
        });
        await fixtureApi.post('/api/test-support/cleanup', {
          headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
          data: { runId: `${run}-foreign` },
        });
      } finally {
        try {
          if (suiteLockHeld) {
            const unlocked = await cleanupClient.query<{ unlocked: boolean }>(
              `SELECT pg_advisory_unlock(hashtext($1)) AS unlocked`,
              ['prt-v8-zero-writer-mounted-suite']
            );
            expect(unlocked.rows[0]?.unlocked).toBe(true);
            suiteLockHeld = false;
          }
          expect(
            (await cleanupClient.query<{ n: number }>(
              `SELECT count(*)::int AS n FROM pg_locks
                WHERE locktype='advisory' AND pid=pg_backend_pid()`
            )).rows[0]?.n
          ).toBe(0);
        } finally {
          cleanupClient.release();
          await pool.end();
          await fixtureApi.dispose();
        }
      }
    }
  });
});
