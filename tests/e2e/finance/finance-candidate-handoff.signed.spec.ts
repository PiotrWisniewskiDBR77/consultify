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
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const LOCK_KEY = 'FIN-MVP-CANDIDATE-001';

test.describe('FIN-MVP-CANDIDATE mounted signed three-family handoff', () => {
  test.setTimeout(180_000);

  test('preview then explicit confirm creates exactly one durable candidate per family', async ({
    browser,
    request,
  }) => {
    expect(process.env.FIN_CANDIDATE_FIXTURE_OPT_IN).toBe('1');
    const databaseUrl = process.env.DATABASE_URL;
    const callerPrefix = process.env.FIN_CANDIDATE_DB_PREFIX;
    expect(databaseUrl).toBeTruthy();
    expect(callerPrefix).toMatch(/^fin_candidate_/);
    const state = readTestSupportState();
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 });
    const client = await pool.connect();
    let fixture: FinanceCandidateFixture | undefined;
    let foreignRunId = '';
    let foreignToken = '';
    let lockHeld = false;
    try {
      const database = (await client.query<{ name: string }>('SELECT current_database() name'))
        .rows[0]!.name;
      expect(database.startsWith('fin_candidate_')).toBe(true);
      expect(database.startsWith(String(callerPrefix))).toBe(true);
      await client.query(`SELECT pg_advisory_lock(hashtext($1))`, [LOCK_KEY]);
      lockHeld = true;
      fixture = await seedFinanceCandidateFixture(client, state.organizationId, state.userId);
      expect(await candidateResidue(client, state.organizationId, fixture.sourceIds)).toEqual({
        candidates: 0,
        receipts: 0,
      });

      const families = [
        ['investment-case', fixture.modelId],
        ['statement-pack', fixture.packId],
        ['valuation-recommendation', fixture.recommendationId],
      ] as const;
      for (const [family, sourceId] of families) {
        const root = `${API_BASE_URL}/api/finance/candidate-handoff/${family}/${sourceId}`;
        const preview = await request.get(`${root}/preview`, { headers: getAuthHeader() });
        expect(preview.status(), `${family} preview`).toBe(200);
        expect(await preview.json()).toMatchObject({ data: { eligible: true } });
        const before = await candidateResidue(client, state.organizationId, [sourceId]);
        expect(before).toEqual({ candidates: 0, receipts: 0 });
        const confirmed = await request.post(`${root}/confirm`, { headers: getAuthHeader() });
        expect(confirmed.status(), `${family} confirm`).toBe(201);
        const body = await confirmed.json();
        expect(body.data.created).toBe(true);
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
      foreignToken = String((await foreign.json()).token);
      const ownModelRoot = `${API_BASE_URL}/api/finance/candidate-handoff/investment-case/${fixture.modelId}`;
      const foreignPreview = await request.get(`${ownModelRoot}/preview`, {
        headers: { Authorization: `Bearer ${foreignToken}` },
      });
      expect(foreignPreview.status()).toBe(200);
      expect(await foreignPreview.json()).toMatchObject({
        data: { eligible: false, reason: 'NOT_FOUND' },
      });
      expect(await candidateResidue(client, state.organizationId, fixture.sourceIds)).toEqual({
        candidates: 4,
        receipts: 4,
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
      if (fixture) {
        await client.query(
          `UPDATE organization_members SET status='ACTIVE'
            WHERE organization_id=$1 AND user_id=$2`,
          [state.organizationId, state.userId]
        );
        await cleanupFinanceCandidateFixture(client, state.organizationId, fixture);
        expect(await candidateResidue(client, state.organizationId, fixture.sourceIds)).toEqual({
          candidates: 0,
          receipts: 0,
        });
      }
      if (foreignToken) {
        await request
          .post(`${API_BASE_URL}/api/test-support/cleanup`, {
            headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
            data: { runId: foreignRunId },
          })
          .catch(() => undefined);
      }
      if (lockHeld) {
        expect(
          (
            await client.query<{ unlocked: boolean }>(
              `SELECT pg_advisory_unlock(hashtext($1)) unlocked`,
              [LOCK_KEY]
            )
          ).rows[0]!.unlocked
        ).toBe(true);
      }
      client.release();
      await pool.end();
    }
  });
});
