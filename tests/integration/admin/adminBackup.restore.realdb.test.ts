import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.unmock('../../../server/src/services/backupService.js');

const run = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const describeReal = run ? describe : describe.skip;
const sourceUrl = process.env.DATABASE_URL || '';
const targetUrl = process.env.BACKUP_RESTORE_TARGET_DATABASE_URL || '';
const fixtureRunId = randomUUID();
const orgA = `backup-org-a-${fixtureRunId}`;
const orgB = `backup-org-b-${fixtureRunId}`;
const actorId = `backup-actor-${fixtureRunId}`;
const fixtureLockKey = 7_401_001;
let backupService: typeof import('../../../server/src/services/backupService.js').default;
let backup: Awaited<ReturnType<typeof backupService.createBackup>>;
let objectPath = '';
let sourceClient: Client | undefined;
let targetClient: Client | undefined;

async function query(url: string, text: string, values: unknown[] = []) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await client.query(text, values);
  } finally {
    await client.end();
  }
}

async function assertDisposableDatabase(client: Client, url: string, label: string) {
  if (process.env.ADM_BACKUP_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1') {
    throw new Error('ADM_BACKUP_ALLOW_IMMUTABLE_FIXTURE_CLEANUP=1 is required');
  }
  const callerDatabase = new URL(url).pathname.replace(/^\//, '');
  const serverDatabase = String(
    (await client.query(`SELECT current_database() AS name`)).rows[0]?.name || ''
  );
  if (!/^consultify_adm_backup_(source|restore)_[a-z0-9_]+$/.test(callerDatabase)) {
    throw new Error(`${label} caller database is outside the disposable ADM backup namespace`);
  }
  if (serverDatabase !== callerDatabase) {
    throw new Error(`${label} caller/server database mismatch`);
  }
}

async function triggerState(client: Client) {
  const result = await client.query(`
    SELECT t.tgenabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname='backup_access_audit'
      AND t.tgname='backup_access_audit_no_update'
  `);
  return result.rows.map((row) => row.tgenabled);
}

describeReal('ADM-MVP-BACKUP-001 encrypted tenant backup and isolated restore', () => {
  beforeAll(async () => {
    if (!sourceUrl || !targetUrl) throw new Error('source and restore target URLs are required');
    if (sourceUrl === targetUrl) throw new Error('source and restore target databases must differ');
    sourceClient = new Client({ connectionString: sourceUrl });
    targetClient = new Client({ connectionString: targetUrl });
    await sourceClient.connect();
    await targetClient.connect();
    await assertDisposableDatabase(sourceClient, sourceUrl, 'source');
    await assertDisposableDatabase(targetClient, targetUrl, 'target');
    expect(await triggerState(sourceClient)).toEqual(['O']);
    expect(
      (await sourceClient.query(`SELECT pg_advisory_lock($1)`, [fixtureLockKey])).rowCount
    ).toBe(1);
    const baseline = await sourceClient.query(
      `
      SELECT
        (SELECT count(*)::int FROM organizations WHERE id = ANY($1::text[])) AS organizations,
        (SELECT count(*)::int FROM backup_manifests WHERE organization_id = $2) AS manifests
    `,
      [[orgA, orgB], orgA]
    );
    expect(baseline.rows[0]).toEqual({ organizations: 0, manifests: 0 });
    await sourceClient.query(`INSERT INTO organizations (id, name) VALUES ($1,$2),($3,$4)`, [
      orgA,
      'Backup Tenant A',
      orgB,
      'Backup Tenant B',
    ]);
    backupService = (await import('../../../server/src/services/backupService.js')).default;
    backup = await backupService.createBackup('full', 'ADM-MVP-BACKUP-001 realDB', {
      organizationId: orgA,
      actorId,
      tables: ['organizations'],
    });
    const { getStorage } = await import('../../../server/src/services/storage/index.js');
    objectPath = (getStorage() as any).resolvePath(backup.storageKey);
  }, 120_000);

  afterAll(async () => {
    let cleanupError: unknown;
    try {
      if (sourceClient) {
        await sourceClient.query('BEGIN');
        try {
          await sourceClient.query(`SET LOCAL session_replication_role = 'replica'`);
          if (backup?.id) {
            await sourceClient.query(`DELETE FROM backup_access_audit WHERE backup_id=$1`, [
              backup.id,
            ]);
            await sourceClient.query(`DELETE FROM backup_manifests WHERE id=$1`, [backup.id]);
          }
          await sourceClient.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [
            [orgA, orgB],
          ]);
          await sourceClient.query('COMMIT');
        } catch (error) {
          await sourceClient.query('ROLLBACK');
          throw error;
        }
        expect(await triggerState(sourceClient)).toEqual(['O']);
        const sourceResidue = await sourceClient.query(
          `
          SELECT
            (SELECT count(*)::int FROM organizations WHERE id = ANY($1::text[])) AS organizations,
            (SELECT count(*)::int FROM backup_manifests WHERE id=$2) AS manifests,
            (SELECT count(*)::int FROM backup_access_audit WHERE backup_id=$2) AS audit
        `,
          [[orgA, orgB], backup?.id || '']
        );
        expect(sourceResidue.rows[0]).toEqual({ organizations: 0, manifests: 0, audit: 0 });
      }
      if (targetClient) {
        await targetClient.query('BEGIN');
        try {
          await targetClient.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [
            [orgA, orgB],
          ]);
          await targetClient.query('COMMIT');
        } catch (error) {
          await targetClient.query('ROLLBACK');
          throw error;
        }
        const targetResidue = await targetClient.query(
          `SELECT count(*)::int AS organizations FROM organizations WHERE id = ANY($1::text[])`,
          [[orgA, orgB]]
        );
        expect(targetResidue.rows[0]).toEqual({ organizations: 0 });
      }
      if (objectPath) {
        await fs.rm(objectPath, { force: true });
        await expect(fs.stat(objectPath)).rejects.toMatchObject({ code: 'ENOENT' });
      }
    } catch (error) {
      cleanupError = error;
    } finally {
      if (sourceClient) {
        try {
          expect(
            (
              await sourceClient.query(`SELECT pg_advisory_unlock($1) AS unlocked`, [
                fixtureLockKey,
              ])
            ).rows[0]
          ).toEqual({ unlocked: true });
        } catch (error) {
          cleanupError ||= error;
        }
        await sourceClient.end().catch((error) => {
          cleanupError ||= error;
        });
      }
      await targetClient?.end().catch((error) => {
        cleanupError ||= error;
      });
    }
    if (cleanupError) throw cleanupError;
  });

  it('stores ciphertext, checksum and no tenant plaintext', async () => {
    expect(backup.encrypted).toBe(true);
    expect(backup.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    const raw = await fs.readFile(objectPath, 'utf8');
    expect(raw).toContain('consultify-encrypted-json-v1');
    expect(raw).not.toContain('Backup Tenant A');
    expect(raw).not.toContain(orgA);
  });

  it('restores into an isolated migrated database with checksum and tenant integrity', async () => {
    const result = await backupService.restoreBackup(backup.id, {
      targetDatabaseUrl: targetUrl,
      actorId,
      expectedOrganizationId: orgA,
    });
    expect(result.checksumVerified).toBe(true);
    expect(result.restoredTables).toBe(1);
    expect(result.restoredRows).toBe(1);
    const restored = await query(
      targetUrl,
      `SELECT id,name FROM organizations WHERE id = ANY($1::text[])`,
      [[orgA, orgB]]
    );
    expect(restored.rows).toEqual([{ id: orgA, name: 'Backup Tenant A' }]);
  });

  it('fails closed for wrong tenant and live/source target', async () => {
    await expect(
      backupService.restoreBackup(backup.id, {
        targetDatabaseUrl: targetUrl,
        actorId,
        expectedOrganizationId: orgB,
      })
    ).rejects.toThrow('RESTORE_ORGANIZATION_MISMATCH');
    await expect(
      backupService.restoreBackup(backup.id, {
        targetDatabaseUrl: sourceUrl,
        actorId,
      })
    ).rejects.toThrow('RESTORE_TARGET_NOT_ISOLATED');
  });

  it('rejects a corrupted encrypted object before target mutation', async () => {
    const raw = JSON.parse(await fs.readFile(objectPath, 'utf8'));
    raw.ciphertext = `${raw.ciphertext.slice(0, -2)}AA`;
    await fs.writeFile(objectPath, JSON.stringify(raw));
    await expect(
      backupService.restoreBackup(backup.id, {
        targetDatabaseUrl: targetUrl,
        actorId,
        expectedOrganizationId: orgA,
      })
    ).rejects.toThrow(/BACKUP_CHECKSUM_MISMATCH|authenticate data/i);
  });

  it('records access outcomes in an append-only audit ledger', async () => {
    const audit = await query(
      sourceUrl,
      `SELECT action,outcome FROM backup_access_audit WHERE backup_id=$1 ORDER BY created_at`,
      [backup.id]
    );
    expect(audit.rows).toEqual(
      expect.arrayContaining([
        { action: 'BACKUP_CREATED', outcome: 'SUCCESS' },
        { action: 'RESTORE_COMPLETED', outcome: 'SUCCESS' },
        { action: 'RESTORE_FAILED', outcome: 'FAILED' },
        { action: 'RESTORE', outcome: 'ACCESS_DENIED' },
      ])
    );
    await expect(
      query(sourceUrl, `UPDATE backup_access_audit SET outcome='TAMPERED' WHERE backup_id=$1`, [
        backup.id,
      ])
    ).rejects.toThrow(/append-only/i);
  });
});
