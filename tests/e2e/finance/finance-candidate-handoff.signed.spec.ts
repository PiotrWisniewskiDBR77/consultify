import { expect, test } from '@playwright/test';
import pg from 'pg';

import { getAuthHeader, readTestSupportState } from '../_helpers/testSupportState';
import {
  candidateResidue,
  cleanupFinanceCandidateFixture,
  seedFinanceCandidateFixture,
  type FinanceCandidateFixture,
} from './financeCandidateHandoffFixture';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const WEB_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const LOCK_KEY = 'FIN-MVP-CANDIDATE-001';

test.describe('FIN-MVP-CANDIDATE mounted signed three-family handoff', () => {
  test.setTimeout(180_000);

  test('preview then explicit confirm creates exactly one durable candidate per family', async ({
    browser,
    page,
    request,
  }) => {
    expect(process.env.FIN_CANDIDATE_FIXTURE_OPT_IN).toBe('1');
    const databaseUrl = process.env.DATABASE_URL;
    const expectedDatabase = process.env.FIN_CANDIDATE_DATABASE_NAME;
    expect(databaseUrl).toBeTruthy();
    expect(expectedDatabase).toMatch(/^fin_candidate_[a-z0-9_]+$/);
    const state = readTestSupportState();
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 });
    let client: pg.PoolClient | undefined;
    let fixture: FinanceCandidateFixture | undefined;
    let foreignRunId = '';
    let foreignToken = '';
    const deniedRunIds: string[] = [];
    const ownedOrganizationIds: string[] = [];
    const ownedUserIds: string[] = [];
    let lockHeld = false;
    try {
      client = await pool.connect();
      const database = (await client.query<{ name: string }>('SELECT current_database() name'))
        .rows[0]!.name;
      expect(database).toBe(expectedDatabase);
      await client.query(`SELECT pg_advisory_lock(hashtext($1))`, [LOCK_KEY]);
      lockHeld = true;
      fixture = await seedFinanceCandidateFixture(client, state.organizationId, state.userId);
      expect(await candidateResidue(client, state.organizationId, fixture.sourceIds)).toEqual({
        candidates: 0,
        receipts: 0,
      });
      const uiFamilies = [
        {
          family: 'investment-case',
          sourceId: fixture.modelId,
          path: `/finance/models/${fixture.modelId}`,
          open: /^Export$/i,
          select: /Initiatives.*Create draft initiatives/i,
          confirm: /^Send as Candidate$/i,
        },
        {
          family: 'statement-pack',
          sourceId: fixture.packId,
          path: `/finance/statements/${fixture.packId}`,
          open: /^Send as Candidate$/i,
          confirm: /^Send as Candidate$/i,
        },
      ] as const;
      for (const ui of uiFamilies) {
        const { family, sourceId } = ui;
        const root = `${API_BASE_URL}/api/finance/candidate-handoff/${family}/${sourceId}`;
        const before = await candidateResidue(client, state.organizationId, [sourceId]);
        expect(before).toEqual({ candidates: 0, receipts: 0 });

        await page.goto(`${WEB_BASE_URL}${ui.path}`);
        const skipOnboarding = page.getByRole('button', { name: /Skip for now|Pomiń/i });
        if (
          await skipOnboarding
            .waitFor({ state: 'visible', timeout: 5_000 })
            .then(() => true)
            .catch(() => false)
        ) {
          await skipOnboarding.click();
        }
        const previewPath = `/api/finance/candidate-handoff/${family}/${sourceId}/preview`;
        const previewResponse = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === previewPath &&
            response.request().method() === 'GET'
        );
        await page.getByRole('button', { name: ui.open }).first().click();
        if ('select' in ui) {
          const exportDialog = page
            .getByRole('heading', { name: /Export Financial Analysis/i })
            .locator('../..');
          await expect(exportDialog).toBeVisible();
          await exportDialog.getByRole('button', { name: ui.select }).click();
        }
        const preview = await previewResponse;
        expect(preview.status(), `${family} UI preview`).toBe(200);
        expect(await candidateResidue(client, state.organizationId, [sourceId])).toEqual(before);
        const confirmPath = `/api/finance/candidate-handoff/${family}/${sourceId}/confirm`;
        const confirmResponse = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === confirmPath &&
            response.request().method() === 'POST'
        );
        await page.getByRole('button', { name: ui.confirm }).last().click();
        const confirmed = await confirmResponse;
        expect(confirmed.status(), `${family} UI confirm`).toBe(201);
        const body = await confirmed.json();
        expect(body.data).toMatchObject({ created: true });
        expect(body.data.candidateId).toBeTruthy();

        const cold = await browser.newContext();
        try {
          const reopened = await cold.request.get(root, { headers: getAuthHeader() });
          expect(reopened.status()).toBe(200);
          expect(await reopened.json()).toMatchObject({
            data: { candidateId: body.data.candidateId },
          });
        } finally {
          await cold.close();
        }
        expect(await candidateResidue(client, state.organizationId, [sourceId])).toEqual({
          candidates: 1,
          receipts: 1,
        });
      }

      // Owner-gated denominator: the canonical V3 valuation workspace is deliberately
      // default-OFF pending Piotr's visual acceptance. The mounted production route must
      // therefore keep the legacy surface and produce zero candidate/receipt writes.
      await page.goto(`${WEB_BASE_URL}/finance/valuations/${fixture.valuationId}`);
      await expect(page.getByText(/Enterprise valuation/i).first()).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: /Wyślij jako kandydata na Initiative|Send as.*Candidate/i,
        })
      ).toHaveCount(0);
      expect(
        await candidateResidue(client, state.organizationId, [fixture.recommendationId])
      ).toEqual({ candidates: 0, receipts: 0 });

      const concurrentRoot = `${API_BASE_URL}/api/finance/candidate-handoff/investment-case/${fixture.concurrentModelId}`;
      const simultaneous = await Promise.all(
        Array.from({ length: 8 }, () =>
          request.post(`${concurrentRoot}/confirm`, { headers: getAuthHeader() })
        )
      );
      expect(simultaneous.every((response) => [200, 201].includes(response.status()))).toBe(true);
      const ids = await Promise.all(
        simultaneous.map(async (response) => String((await response.json()).data.candidateId))
      );
      expect(new Set(ids).size).toBe(1);
      expect(
        await candidateResidue(client, state.organizationId, [fixture.concurrentModelId])
      ).toEqual({ candidates: 1, receipts: 1 });

      const staleRoot = `${API_BASE_URL}/api/finance/candidate-handoff/statement-pack/${fixture.stalePackId}`;
      expect(
        (await request.get(`${staleRoot}/preview`, { headers: getAuthHeader() })).status()
      ).toBe(200);
      await client.query(
        `UPDATE financial_statement_packs SET pack_readiness_status='pending'
          WHERE organization_id=$1 AND id=$2`,
        [state.organizationId, fixture.stalePackId]
      );
      expect(
        (await request.post(`${staleRoot}/confirm`, { headers: getAuthHeader() })).status()
      ).toBe(409);
      expect(await candidateResidue(client, state.organizationId, [fixture.stalePackId])).toEqual({
        candidates: 0,
        receipts: 0,
      });

      foreignRunId = `fin-candidate-foreign-${fixture.runId}`;
      const foreign = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
        data: { runId: foreignRunId, role: 'OWNER' },
      });
      expect(foreign.status()).toBe(200);
      const foreignState = await foreign.json();
      foreignToken = String(foreignState.token);
      ownedOrganizationIds.push(String(foreignState.organizationId));
      ownedUserIds.push(String(foreignState.userId));
      const ownModelRoot = `${API_BASE_URL}/api/finance/candidate-handoff/investment-case/${fixture.modelId}`;
      const unauthenticated = await request.post(`${ownModelRoot}/confirm`, {
        headers: { Authorization: '' },
      });
      expect(unauthenticated.status()).toBe(401);

      for (const role of ['MEMBER', 'SUPERADMIN'] as const) {
        const deniedRunId = `fin-candidate-denied-${role.toLowerCase()}-${fixture.runId}`;
        deniedRunIds.push(deniedRunId);
        const deniedBootstrap = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
          headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
          data: { runId: deniedRunId, role },
        });
        expect(deniedBootstrap.status()).toBe(200);
        const deniedState = await deniedBootstrap.json();
        ownedOrganizationIds.push(String(deniedState.organizationId));
        ownedUserIds.push(String(deniedState.userId));
        await client.query(
          `DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2`,
          [String(deniedState.organizationId), String(deniedState.userId)]
        );
        const deniedBefore = await candidateResidue(
          client,
          state.organizationId,
          fixture.sourceIds
        );
        const denied = await request.post(`${ownModelRoot}/confirm`, {
          headers: { Authorization: `Bearer ${String(deniedState.token)}` },
        });
        expect(denied.status(), `${role} without ACTIVE membership`).toBe(403);
        expect(await candidateResidue(client, state.organizationId, fixture.sourceIds)).toEqual(
          deniedBefore
        );
      }
      const foreignPreview = await request.get(`${ownModelRoot}/preview`, {
        headers: { Authorization: `Bearer ${foreignToken}` },
      });
      expect(foreignPreview.status()).toBe(200);
      expect(await foreignPreview.json()).toMatchObject({
        data: { eligible: false, reason: 'NOT_FOUND' },
      });
      expect(await candidateResidue(client, state.organizationId, fixture.sourceIds)).toEqual({
        candidates: 3,
        receipts: 3,
      });

      await client.query(
        `UPDATE organization_members SET status='REVOKED'
          WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, state.userId]
      );
      const beforeDenied = await candidateResidue(client, state.organizationId, fixture.sourceIds);
      expect(
        (await request.post(`${ownModelRoot}/confirm`, { headers: getAuthHeader() })).status()
      ).toBe(403);
      expect(await candidateResidue(client, state.organizationId, fixture.sourceIds)).toEqual(
        beforeDenied
      );
      await client.query(
        `UPDATE organization_members SET status='ACTIVE'
          WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, state.userId]
      );

      const unknown = `${API_BASE_URL}/api/finance/candidate-handoff/valuation-recommendation/${fixture.runId}_unknown`;
      const invalidPreview = await request.get(`${unknown}/preview`, { headers: getAuthHeader() });
      expect(invalidPreview.status()).toBe(200);
      expect(await invalidPreview.json()).toMatchObject({ data: { eligible: false } });
      expect(
        (await request.post(`${unknown}/confirm`, { headers: getAuthHeader() })).status()
      ).toBe(409);
      expect(
        await candidateResidue(client, state.organizationId, [`${fixture.runId}_unknown`])
      ).toEqual({
        candidates: 0,
        receipts: 0,
      });
    } finally {
      let cleanupError: unknown;
      try {
        if (client && fixture) {
          await client.query(
            `UPDATE organization_members SET status='ACTIVE'
              WHERE organization_id=$1 AND user_id=$2`,
            [state.organizationId, state.userId]
          );
          await cleanupFinanceCandidateFixture(client, state.organizationId, fixture);
        }
        if (foreignToken) {
          const cleaned = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
            headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
            data: { runId: foreignRunId },
          });
          expect(cleaned.status()).toBe(200);
        }
        for (const deniedRunId of deniedRunIds) {
          const cleaned = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
            headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
            data: { runId: deniedRunId },
          });
          expect(cleaned.status()).toBe(200);
        }
        if (client && fixture) {
          expect(await candidateResidue(client, state.organizationId, fixture.sourceIds)).toEqual({
            candidates: 0,
            receipts: 0,
          });
          const exactResidue = await client.query<{
            organizations: number;
            users: number;
            members: number;
          }>(
            `SELECT
              (SELECT count(*)::int FROM organizations WHERE id = ANY($1::text[])) organizations,
              (SELECT count(*)::int FROM users WHERE id = ANY($2::text[])) users,
              (SELECT count(*)::int FROM organization_members
                 WHERE organization_id = ANY($1::text[]) OR user_id = ANY($2::text[])) members`,
            [ownedOrganizationIds, ownedUserIds]
          );
          expect(exactResidue.rows[0]).toEqual({ organizations: 0, users: 0, members: 0 });
        }
      } catch (error) {
        cleanupError = error;
      } finally {
        try {
          if (client && lockHeld) {
            expect(
              (
                await client.query<{ unlocked: boolean }>(
                  `SELECT pg_advisory_unlock(hashtext($1)) unlocked`,
                  [LOCK_KEY]
                )
              ).rows[0]!.unlocked
            ).toBe(true);
            const locks = await client.query<{ count: number }>(
              `SELECT count(*)::int count FROM pg_locks
                WHERE locktype='advisory' AND pid=pg_backend_pid()`
            );
            expect(locks.rows[0]!.count).toBe(0);
          }
        } finally {
          client?.release();
          await pool.end();
        }
      }
      if (cleanupError) throw cleanupError;
    }
  });
});
