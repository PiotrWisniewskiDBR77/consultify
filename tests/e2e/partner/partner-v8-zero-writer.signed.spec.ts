import { randomUUID } from 'node:crypto';

import { expect, request as playwrightRequest, test } from '@playwright/test';
import { Pool } from 'pg';

import { getAuthHeader, readTestSupportState } from '../_helpers/testSupportState';
import {
  getPrivilegedSession,
  makeRunId,
  privilegedAuthUser,
} from '../_helpers/privilegedSession';
import { injectSession } from '../m06/_m06';
import { dismissOverlayIfPresent } from '../smoke/work-canvas-helpers';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

test.describe('Partner V8 zero-writer — mounted signed session', () => {
  test.setTimeout(180_000);

  test('uses governed company/campaign writers and keeps approved-out economics read-only without legacy mutation fallback', async ({ page }, testInfo) => {
    const state = readTestSupportState();
    const run = `prt-v8-${randomUUID().slice(0, 8)}`;
    const headers = { ...getAuthHeader(), 'content-type': 'application/json' };
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    const cleanupClient = await pool.connect();
    const fixtureApi = await playwrightRequest.newContext({ baseURL: API });
    let partnerOrgId = '';
    const forbiddenEconomicsMutations: string[] = [];
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
      const path = new URL(req.url()).pathname;
      const methodAndPath = `${req.method()} ${path}`;
      if (
        /^(?:POST \/api\/(?:v8\/partner|partners)\/payouts\/request|PUT \/api\/(?:v8\/partner|partners)\/payout-settings)\/?$/.test(
          methodAndPath
        )
      ) {
        forbiddenEconomicsMutations.push(methodAndPath);
      }
    });

    try {
      const connected = await fixtureApi.post('/api/v8/partner/connect', {
        headers: { ...headers, 'idempotency-key': `prt-connect-${run}` },
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
      // Historical economics fixture only. AMD-PRT-ECONOMICS-002 forbids using
      // a product mutation API to manufacture payout readiness; direct writes
      // here are disposable test setup for the read-only signed UI proof.
      const historicalPayoutAccount = {
        accountHolderName: 'PRT V8 Owner',
        iban: 'DE89370400440532013000',
        bicSwift: 'COBADEFFXXX',
        bankName: 'Test Bank',
      };
      await pool.query(
        `UPDATE partner_organizations
            SET payout_threshold=100, payout_method='BANK_TRANSFER', auto_payout_enabled=FALSE,
                updated_at=CURRENT_TIMESTAMP
          WHERE id=$1`,
        [partnerOrgId]
      );
      await pool.query(
        `INSERT INTO partner_payout_accounts
          (id,partner_org_id,payout_method,account_details_encrypted,account_name,
           account_last_four,currency,is_primary,is_verified,created_at,updated_at)
         VALUES($1,$2,'BANK_TRANSFER',$3,$4,'0000','EUR',TRUE,FALSE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        [randomUUID(), partnerOrgId, JSON.stringify(historicalPayoutAccount), 'Test Bank']
      );
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
      await expect(page.getByTestId('partner-economics-approved-out')).toBeVisible();
      await expect(page.getByText(/Payout operations are unavailable/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Zażądaj wypłaty|Request payout/i })
      ).toHaveCount(0);
      expect(forbiddenEconomicsMutations).toEqual([]);

      await page.reload();
      await dismissOverlayIfPresent(page);
      await expect(page.getByTestId('partner-economics-approved-out')).toBeVisible();
      await expect(page.getByText(/Payout operations are unavailable/i)).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Zażądaj wypłaty|Request payout/i })
      ).toHaveCount(0);
      const tenantEarningsShot = testInfo.outputPath(
        'partner-tenant-earnings-approved-out-cold.png'
      );
      await page.screenshot({ path: tenantEarningsShot, fullPage: true });
      await testInfo.attach('partner-tenant-earnings-approved-out-cold', {
        path: tenantEarningsShot,
        contentType: 'image/png',
      });
      expect(forbiddenEconomicsMutations).toEqual([]);

      await page.goto('/partner?tab=payout-settings');
      await dismissOverlayIfPresent(page);
      await expect(page.getByText('Payout operations unavailable', { exact: true })).toBeVisible();
      await expect(page.getByText(/AMD-PRT-ECONOMICS-002/)).toBeVisible();
      await expect(page.getByTestId('historical-payout-method')).toHaveText(/BANK TRANSFER/i);
      await expect(page.getByText('PRT V8 Owner', { exact: true })).toBeVisible();
      await expect(page.getByText('DE89370400440532013000', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(0);
      await expect(page.getByDisplayValue('PRT V8 Owner')).toHaveCount(0);
      await expect(page.getByDisplayValue('DE89370400440532013000')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Bank Transfer/i })).toHaveCount(0);

      await page.reload();
      await dismissOverlayIfPresent(page);
      await expect(page.getByText('Payout operations unavailable', { exact: true })).toBeVisible();
      await expect(page.getByText(/AMD-PRT-ECONOMICS-002/)).toBeVisible();
      await expect(page.getByTestId('historical-payout-method')).toHaveText(/BANK TRANSFER/i);
      await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(0);
      const tenantPayoutSettingsShot = testInfo.outputPath(
        'partner-tenant-payout-settings-approved-out-cold.png'
      );
      await page.screenshot({ path: tenantPayoutSettingsShot, fullPage: true });
      await testInfo.attach('partner-tenant-payout-settings-approved-out-cold', {
        path: tenantPayoutSettingsShot,
        contentType: 'image/png',
      });

      expect(forbiddenEconomicsMutations).toEqual([]);

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
            await cleanupClient.query(`DELETE FROM partner_payout_accounts WHERE partner_org_id=$1`, [partnerOrgId]);
            await cleanupClient.query(`DELETE FROM partner_commission_transactions WHERE partner_org_id=$1`, [partnerOrgId]);
            await cleanupClient.query(`DELETE FROM partner_campaign_links WHERE partner_org_id=$1`, [partnerOrgId]);
            await cleanupClient.query(`ALTER TABLE partner_program_ledger DISABLE TRIGGER trg_partner_program_ledger_guard`);
            await cleanupClient.query(`DELETE FROM partner_program_ledger WHERE partner_org_id=$1`, [partnerOrgId]);
            await cleanupClient.query(`ALTER TABLE partner_program_ledger ENABLE TRIGGER trg_partner_program_ledger_guard`);
            await cleanupClient.query(`DELETE FROM partner_program_runtime WHERE partner_org_id=$1`, [partnerOrgId]);
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
              (SELECT count(*) FROM partner_program_runtime WHERE partner_org_id::text=$1::text)::int +
              (SELECT count(*) FROM partner_program_ledger WHERE partner_org_id::text=$1::text)::int +
              (SELECT count(*) FROM partner_commission_transactions WHERE partner_org_id::text=$1::text)::int +
              (SELECT count(*) FROM partner_payouts WHERE partner_org_id::text=$1::text)::int +
              (SELECT count(*) FROM partner_payout_accounts WHERE partner_org_id::text=$1::text)::int AS n`,
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

  test('keeps signed SUPERADMIN Partner Config and Settlements economics controls absent after cold reload', async ({
    page,
    request,
  }, testInfo) => {
    const runId = makeRunId('prt-approved-out-superadmin');
    const superadmin = await getPrivilegedSession(request, {
      runId,
      role: 'SUPERADMIN',
      apiBaseUrl: API,
    });
    expect(superadmin.isSuperAdmin).toBe(true);
    await injectSession(page, {
      token: superadmin.token,
      user: privilegedAuthUser(superadmin),
    });

    const economicsMutations: string[] = [];
    page.on('request', (req) => {
      const path = new URL(req.url()).pathname;
      if (
        /^\/api\/superadmin\/partner-(?:settlements|config)(?:\/|$)/.test(path) &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method())
      ) {
        economicsMutations.push(`${req.method()} ${path}`);
      }
    });

    try {
      await page.goto('/superadmin/customers/commercial');
      await dismissOverlayIfPresent(page);

      await page.getByRole('button', { name: 'Partner Config' }).click();
      await expect(page.getByText('Partner economics are read-only', { exact: true })).toBeVisible();
      await expect(page.getByText(/AMD-PRT-ECONOMICS-002/)).toBeVisible();
      await expect(page.getByText('Commission Rates by Tier', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Save Discount Settings/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Save Payout Settings/i })).toHaveCount(0);

      await page.reload();
      await dismissOverlayIfPresent(page);
      await page.getByRole('button', { name: 'Partner Config' }).click();
      await expect(page.getByText('Partner economics are read-only', { exact: true })).toBeVisible();
      await expect(page.getByText('Commission Rates by Tier', { exact: true })).toHaveCount(0);
      const superadminConfigShot = testInfo.outputPath(
        'partner-superadmin-config-approved-out-cold.png'
      );
      await page.screenshot({ path: superadminConfigShot, fullPage: true });
      await testInfo.attach('partner-superadmin-config-approved-out-cold', {
        path: superadminConfigShot,
        contentType: 'image/png',
      });

      await page.getByRole('button', { name: 'Partner Settlements' }).click();
      await expect(page.getByText('Partner economics are read-only', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Approve selected/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Process$/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Complete$/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Remove attribution/i })).toHaveCount(0);
      // W21/W23/W24 have no reachable mounted controls in this surface. Keep
      // their product-action vocabulary under an explicit absence contract in
      // addition to the namespace-wide passive request listener above.
      await expect(page.getByRole('button', { name: /fail (?:the )?payout/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /(?:advance|change).*lifecycle/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /(?:add|append|record).*ledger/i })).toHaveCount(0);

      await page.reload();
      await dismissOverlayIfPresent(page);
      await page.getByRole('button', { name: 'Partner Settlements' }).click();
      await expect(page.getByText('Partner economics are read-only', { exact: true })).toBeVisible();
      const superadminSettlementsShot = testInfo.outputPath(
        'partner-superadmin-settlements-approved-out-cold.png'
      );
      await page.screenshot({ path: superadminSettlementsShot, fullPage: true });
      await testInfo.attach('partner-superadmin-settlements-approved-out-cold', {
        path: superadminSettlementsShot,
        contentType: 'image/png',
      });
      expect(economicsMutations).toEqual([]);
    } finally {
      const cleanup = await request.post(`${API}/api/test-support/cleanup`, {
        headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
        data: { runId },
      });
      expect(cleanup.ok(), await cleanup.text()).toBe(true);
    }
  });
});
