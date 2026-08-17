import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import pg from 'pg';

import {
  getAuthHeader,
  readTestSupportState,
  STORAGE_STATE_PATH,
} from '../_helpers/testSupportState';
import { dismissOverlayIfPresent } from '../smoke/work-canvas-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

test.describe('SET-MVP-EXPORT receipt-backed mounted journey', () => {
  test.setTimeout(180_000);

  test('downloads exact immutable bytes, replays cold and fails closed after revocation', async ({
    browser,
    page,
    request,
  }) => {
    const databaseUrl = process.env.DATABASE_URL;
    const allowedPrefix = process.env.SET_EXPORT_DISPOSABLE_DB_PREFIX;
    expect(databaseUrl, 'DATABASE_URL is required').toBeTruthy();
    expect(allowedPrefix, 'SET_EXPORT_DISPOSABLE_DB_PREFIX is required').toBeTruthy();

    const state = readTestSupportState();
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
    const client = await pool.connect();
    const foreignRunId = `set-export-foreign-${randomUUID()}`;
    let foreignToken = '';
    let requestId = '';
    let exportRequestIds: string[] = [];
    let lockHeld = false;
    try {
      const databaseName = (
        await client.query<{ current_database: string }>('SELECT current_database()')
      ).rows[0]!.current_database;
      expect(databaseName.startsWith('set_export_')).toBe(true);
      expect(databaseName.startsWith(String(allowedPrefix))).toBe(true);
      await client.query(`SELECT pg_advisory_lock(hashtext('SET-MVP-EXPORT-001'))`);
      lockHeld = true;

      expect(
        (
          await client.query<{ n: number }>(
            `SELECT count(*)::int n FROM data_export_requests WHERE organization_id=$1 AND user_id=$2`,
            [state.organizationId, state.userId]
          )
        ).rows[0]!.n
      ).toBe(0);
      const membership = await client.query(
        `SELECT status FROM organization_members WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, state.userId]
      );
      expect(membership.rows).toHaveLength(1);
      expect(String(membership.rows[0].status).toUpperCase()).toBe('ACTIVE');

      const touchedRoutes: string[] = [];
      page.on('request', (entry) => {
        const pathname = new URL(entry.url()).pathname;
        if (pathname.includes('export')) touchedRoutes.push(pathname);
      });
      await page.goto('/settings/data-controls');
      await dismissOverlayIfPresent(page);
      const skipWelcome = page.getByRole('button', { name: /Skip for now|Pomiń na razie/i });
      await skipWelcome.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
      if (await skipWelcome.isVisible().catch(() => false)) await skipWelcome.click();
      await expect(
        page.getByRole('heading', { name: /Data Controls|Kontrola danych/i }).first()
      ).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /Request Export|Poproś o eksport/i }).click();
      const download = await downloadPromise;
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();
      const downloadedBytes = await readFile(downloadPath!);
      const downloadedHash = createHash('sha256').update(downloadedBytes).digest('hex');
      const parsed = JSON.parse(downloadedBytes.toString('utf8')) as { user?: { id?: string } };
      expect(parsed.user?.id).toBe(state.userId);
      expect(touchedRoutes).toContain('/api/gdpr/export-request');
      expect(touchedRoutes).toContain('/api/gdpr/export-status');
      expect(touchedRoutes.some((path) => path.startsWith('/api/gdpr/download-export/'))).toBe(
        true
      );
      expect(touchedRoutes).not.toContain('/api/user/data-export');

      const persisted = await client.query<{
        id: string;
        organization_id: string;
        user_id: string;
        status: string;
        artifact_json: string;
        artifact_sha256: string;
        artifact_bytes: string;
      }>(
        `SELECT r.id,r.organization_id,r.user_id,r.status,
                e.artifact_json,e.artifact_sha256,e.artifact_bytes
           FROM data_export_requests r
           JOIN user_data_export_receipts e ON e.request_id=r.id
          WHERE r.organization_id=$1 AND r.user_id=$2
          ORDER BY r.requested_at DESC LIMIT 1`,
        [state.organizationId, state.userId]
      );
      expect(persisted.rows).toHaveLength(1);
      requestId = persisted.rows[0]!.id;
      expect(persisted.rows[0]).toMatchObject({
        organization_id: state.organizationId,
        user_id: state.userId,
        status: 'ready',
        artifact_sha256: downloadedHash,
      });
      expect(Number(persisted.rows[0]!.artifact_bytes)).toBe(downloadedBytes.byteLength);
      expect(Buffer.from(persisted.rows[0]!.artifact_json, 'utf8')).toEqual(downloadedBytes);

      const cold = await browser.newContext({ storageState: STORAGE_STATE_PATH });
      try {
        const replay = await cold.request.get(
          `${API_BASE_URL}/api/gdpr/download-export/${requestId}`,
          {
            headers: getAuthHeader(),
          }
        );
        expect(replay.status()).toBe(200);
        expect(replay.headers()['x-export-receipt-sha256']).toBe(downloadedHash);
        expect(Buffer.from(await replay.body())).toEqual(downloadedBytes);
      } finally {
        await cold.close();
      }

      await expect(
        client.query(
          `UPDATE user_data_export_receipts SET artifact_sha256=$2 WHERE request_id=$1`,
          [requestId, '0'.repeat(64)]
        )
      ).rejects.toThrow(/immutable/i);

      await client.query(`UPDATE data_export_requests SET status='pending' WHERE id=$1`, [
        requestId,
      ]);
      expect(
        (
          await request.get(`${API_BASE_URL}/api/gdpr/download-export/${requestId}`, {
            headers: getAuthHeader(),
          })
        ).status()
      ).toBe(404);
      await client.query(
        `UPDATE data_export_requests SET status='ready',expires_at=NOW()-INTERVAL '1 second' WHERE id=$1`,
        [requestId]
      );
      expect(
        (
          await request.get(`${API_BASE_URL}/api/gdpr/download-export/${requestId}`, {
            headers: getAuthHeader(),
          })
        ).status()
      ).toBe(410);
      await client.query(
        `UPDATE data_export_requests SET expires_at=NOW()+INTERVAL '1 day' WHERE id=$1`,
        [requestId]
      );

      const foreignBootstrap = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
        data: { runId: foreignRunId, role: 'ADMIN' },
      });
      expect(foreignBootstrap.status()).toBe(200);
      foreignToken = String((await foreignBootstrap.json()).token || '');
      expect(foreignToken).toBeTruthy();
      const foreign = await request.get(`${API_BASE_URL}/api/gdpr/download-export/${requestId}`, {
        headers: { Authorization: `Bearer ${foreignToken}` },
      });
      expect(foreign.status()).toBe(404);

      await client.query(
        `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
        [state.organizationId, state.userId]
      );
      const beforeDenied = await client.query<{ requests: number; receipts: number }>(
        `SELECT
          (SELECT count(*)::int FROM data_export_requests WHERE user_id=$1) requests,
          (SELECT count(*)::int FROM user_data_export_receipts WHERE user_id=$1) receipts`,
        [state.userId]
      );
      for (const denied of [
        await request.post(`${API_BASE_URL}/api/gdpr/export-request`, {
          headers: getAuthHeader(),
          data: {},
        }),
        await request.get(`${API_BASE_URL}/api/gdpr/export-status`, { headers: getAuthHeader() }),
        await request.get(`${API_BASE_URL}/api/gdpr/download-export/${requestId}`, {
          headers: getAuthHeader(),
        }),
      ]) {
        expect(denied.status()).toBe(403);
        expect(await denied.json()).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      }
      const afterDenied = await client.query<{ requests: number; receipts: number }>(
        `SELECT
          (SELECT count(*)::int FROM data_export_requests WHERE user_id=$1) requests,
          (SELECT count(*)::int FROM user_data_export_receipts WHERE user_id=$1) receipts`,
        [state.userId]
      );
      expect(afterDenied.rows[0]).toEqual(beforeDenied.rows[0]);

      exportRequestIds = (
        await client.query<{ id: string }>(
          `SELECT id FROM data_export_requests WHERE organization_id=$1 AND user_id=$2 ORDER BY id`,
          [state.organizationId, state.userId]
        )
      ).rows.map((row) => row.id);
      expect(exportRequestIds).toContain(requestId);

      const trigger = await client.query<{ tgenabled: string }>(
        `SELECT tgenabled FROM pg_trigger WHERE tgname='trg_user_data_export_receipts_immutable'`
      );
      expect(trigger.rows).toEqual([{ tgenabled: 'O' }]);
    } finally {
      try {
        await client.query(
          `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
          [state.organizationId, state.userId]
        );
        if (exportRequestIds.length > 0) {
          await client.query('BEGIN');
          try {
            await client.query(
              `ALTER TABLE user_data_export_receipts DISABLE TRIGGER trg_user_data_export_receipts_immutable`
            );
            await client.query(
              `DELETE FROM user_data_export_receipts WHERE request_id = ANY($1::text[])`,
              [exportRequestIds]
            );
            await client.query(`SELECT * FROM set_export_forced_cleanup_failure`);
            throw new Error('forced cleanup failure did not fail');
          } catch {
            await client.query('ROLLBACK');
          }
          expect(
            (
              await client.query<{ n: number }>(
                `SELECT count(*)::int n FROM user_data_export_receipts WHERE request_id = ANY($1::text[])`,
                [exportRequestIds]
              )
            ).rows[0]!.n
          ).toBeGreaterThan(0);

          await client.query('BEGIN');
          try {
            await client.query(
              `ALTER TABLE user_data_export_receipts DISABLE TRIGGER trg_user_data_export_receipts_immutable`
            );
            await client.query(
              `DELETE FROM user_data_export_receipts WHERE request_id = ANY($1::text[])`,
              [exportRequestIds]
            );
            await client.query(`DELETE FROM data_export_requests WHERE id = ANY($1::text[])`, [
              exportRequestIds,
            ]);
            await client.query(
              `ALTER TABLE user_data_export_receipts ENABLE TRIGGER trg_user_data_export_receipts_immutable`
            );
            const enabled = await client.query<{ tgenabled: string }>(
              `SELECT tgenabled FROM pg_trigger WHERE tgname='trg_user_data_export_receipts_immutable'`
            );
            expect(enabled.rows).toEqual([{ tgenabled: 'O' }]);
            await client.query('COMMIT');
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          }
        }
        const residue = await client.query<{ requests: number; receipts: number }>(
          `SELECT
             (SELECT count(*)::int FROM data_export_requests WHERE id = ANY($1::text[])) requests,
             (SELECT count(*)::int FROM user_data_export_receipts WHERE request_id = ANY($1::text[])) receipts`,
          [exportRequestIds]
        );
        expect(residue.rows[0]).toEqual({ requests: 0, receipts: 0 });
      } finally {
        try {
          if (foreignToken) {
            await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
              headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
              data: { runId: foreignRunId },
            });
          }
        } finally {
          try {
            if (lockHeld) {
              expect(
                (
                  await client.query<{ unlocked: boolean }>(
                    `SELECT pg_advisory_unlock(hashtext('SET-MVP-EXPORT-001')) unlocked`
                  )
                ).rows[0]!.unlocked
              ).toBe(true);
            }
          } finally {
            client.release();
            await pool.end();
          }
        }
      }
    }
  });
});
