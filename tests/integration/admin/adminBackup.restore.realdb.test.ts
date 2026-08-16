import fs from 'node:fs/promises';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.unmock('../../../server/src/services/backupService.js');

const run = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const describeReal = run ? describe : describe.skip;
const sourceUrl = process.env.DATABASE_URL || '';
const targetUrl = process.env.BACKUP_RESTORE_TARGET_DATABASE_URL || '';
const orgA = `backup-org-a-${Date.now()}`;
const orgB = `backup-org-b-${Date.now()}`;
const actorId = `backup-actor-${Date.now()}`;
let backupService: typeof import('../../../server/src/services/backupService.js').default;
let backup: Awaited<ReturnType<typeof backupService.createBackup>>;
let objectPath = '';

async function query(url: string, text: string, values: unknown[] = []) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try { return await client.query(text, values); } finally { await client.end(); }
}

describeReal('ADM-MVP-BACKUP-001 encrypted tenant backup and isolated restore', () => {
  beforeAll(async () => {
    if (!sourceUrl || !targetUrl) throw new Error('source and restore target URLs are required');
    await query(sourceUrl, `INSERT INTO organizations (id, name) VALUES ($1,$2),($3,$4)`, [orgA, 'Backup Tenant A', orgB, 'Backup Tenant B']);
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
    await query(sourceUrl, `DELETE FROM organizations WHERE id = ANY($1::text[])`, [[orgA, orgB]]).catch(() => undefined);
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
    const restored = await query(targetUrl, `SELECT id,name FROM organizations WHERE id = ANY($1::text[])`, [[orgA, orgB]]);
    expect(restored.rows).toEqual([{ id: orgA, name: 'Backup Tenant A' }]);
  });

  it('fails closed for wrong tenant and live/source target', async () => {
    await expect(backupService.restoreBackup(backup.id, {
      targetDatabaseUrl: targetUrl,
      actorId,
      expectedOrganizationId: orgB,
    })).rejects.toThrow('RESTORE_ORGANIZATION_MISMATCH');
    await expect(backupService.restoreBackup(backup.id, {
      targetDatabaseUrl: sourceUrl,
      actorId,
    })).rejects.toThrow('RESTORE_TARGET_NOT_ISOLATED');
  });

  it('rejects a corrupted encrypted object before target mutation', async () => {
    const raw = JSON.parse(await fs.readFile(objectPath, 'utf8'));
    raw.ciphertext = `${raw.ciphertext.slice(0, -2)}AA`;
    await fs.writeFile(objectPath, JSON.stringify(raw));
    await expect(backupService.restoreBackup(backup.id, {
      targetDatabaseUrl: targetUrl,
      actorId,
      expectedOrganizationId: orgA,
    })).rejects.toThrow(/BACKUP_CHECKSUM_MISMATCH|authenticate data/i);
  });

  it('records access outcomes in an append-only audit ledger', async () => {
    const audit = await query(sourceUrl,
      `SELECT action,outcome FROM backup_access_audit WHERE backup_id=$1 ORDER BY created_at`,
      [backup.id]);
    expect(audit.rows).toEqual(expect.arrayContaining([
      { action: 'BACKUP_CREATED', outcome: 'SUCCESS' },
      { action: 'RESTORE_COMPLETED', outcome: 'SUCCESS' },
      { action: 'RESTORE_FAILED', outcome: 'FAILED' },
      { action: 'RESTORE', outcome: 'ACCESS_DENIED' },
    ]));
    await expect(query(sourceUrl,
      `UPDATE backup_access_audit SET outcome='TAMPERED' WHERE backup_id=$1`,
      [backup.id])).rejects.toThrow(/append-only/i);
  });
});
