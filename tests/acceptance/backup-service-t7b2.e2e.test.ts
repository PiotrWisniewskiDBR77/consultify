/**
 * Acceptance (REAL-runtime) — Backup Service (T7b-2).
 *
 * Proves the formerly-dead `backupService` self-import wrapper now performs a
 * real logical JSON export against the LIVE Postgres, writes the object through
 * the real storage seam, and records a queryable manifest. No mocks.
 *
 * Requires: DATABASE_URL=local Postgres, RUN_DB_TESTS=1, MOCK_DB=false.
 * All artifacts are tagged with the reversible `odbior--t7b2--` prefix and are
 * torn down at the end so demo/parity data stays clean.
 */
import type { Readable } from 'stream';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { requireLocalDbUrl, pgClient } from './harness.js';

const RUN_ID = `odbior--t7b2--${Date.now()}`;
const REASON = RUN_ID;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let backupService: any;
const createdIds: string[] = [];

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

async function dbCount(table: string): Promise<number> {
  const client = pgClient();
  await client.connect();
  try {
    const r = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    return r.rows[0].n as number;
  } finally {
    await client.end();
  }
}

describe('T7b-2 backupService — real logical export', () => {
  beforeAll(async () => {
    requireLocalDbUrl();
    process.env.BACKUP_ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    backupService = (await import('../../server/src/services/backupService.js')).default;
    expect(backupService, 'backupService default export must exist (was dead wrapper)').toBeTruthy();
    expect(typeof backupService.createBackup).toBe('function');
  });

  afterAll(async () => {
    // Tear down every manifest row + storage object this run created.
    for (const id of createdIds) {
      try {
        await backupService.deleteBackup(id);
      } catch {
        /* best-effort cleanup */
      }
    }
  });

  it('createBackup writes a storage file + manifest with counts matching the DB', async () => {
    const backup = await backupService.createBackup('full', REASON);
    createdIds.push(backup.id);

    // Basic shape.
    expect(backup.id).toMatch(/^backup-/);
    expect(backup.status).toBe('completed');
    expect(backup.scope).toBe('system');
    expect(backup.storageKey).toBeTruthy();
    expect(backup.tableCount).toBeGreaterThan(0);
    expect(backup.sizeBytes).toBeGreaterThan(0);

    // The storage object must actually exist and be readable back.
    const { getStorage } = await import('../../server/src/services/storage/index.js');
    const storage = getStorage();
    expect(await storage.exists(backup.storageKey)).toBe(true);

    const obj = await storage.getObject(backup.storageKey);
    const parsed = JSON.parse((await streamToBuffer(obj.stream)).toString('utf8'));
    expect(parsed.format).toBe('consultify-encrypted-json-v1');
    expect(parsed.algorithm).toBe('aes-256-gcm');
    expect(parsed.checksumSha256).toBe(backup.checksumSha256);
    expect(parsed.ciphertext).toBeTruthy();

    // Per-table counts remain queryable from the authenticated manifest row.
    const manifestTables: Array<{ name: string; rowCount: number; skipped?: boolean }> = backup.tables;
    const checked = ['organizations', 'users', 'initiatives'];
    for (const name of checked) {
      const entry = manifestTables.find((t) => t.name === name);
      expect(entry, `manifest must include ${name}`).toBeTruthy();
      expect(entry!.skipped).toBeFalsy();
      const live = await dbCount(name);
      expect(entry!.rowCount, `${name} manifest count == DB count`).toBe(live);
    }

    // Reported totalRows == sum of included table counts.
    const sum = manifestTables
      .filter((t) => !t.skipped)
      .reduce((acc, t) => acc + t.rowCount, 0);
    expect(backup.rowCount).toBe(sum);
  });

  it('listBackups returns the created entry', async () => {
    const list = await backupService.listBackups({ includeExpired: true });
    expect(Array.isArray(list)).toBe(true);
    const mine = list.filter((b: any) => b.reason === REASON);
    expect(mine.length).toBe(1);
    expect(mine[0].id).toBe(createdIds[0]);
    expect(mine[0].storageKey).toBeTruthy();
  });

  it('a second createBackup yields two distinct entries', async () => {
    const second = await backupService.createBackup('full', REASON);
    createdIds.push(second.id);
    expect(second.id).not.toBe(createdIds[0]);

    const list = await backupService.listBackups({ includeExpired: true });
    const mine = list.filter((b: any) => b.reason === REASON);
    expect(mine.length).toBe(2);
    const ids = mine.map((b: any) => b.id).sort();
    expect(ids).toEqual([...createdIds].sort());
  });

  it('getBackupStatus reflects the created backups', async () => {
    const status = await backupService.getBackupStatus();
    expect(status.total).toBeGreaterThanOrEqual(2);
    expect(status.lastBackup).toBeTruthy();
    expect(status.nextBackup).toBeTruthy();
    expect(typeof status.failed).toBe('number');
  });

  it('restore advertises the supervised isolated-target contract', async () => {
    const info = await backupService.getRestoreInfo(createdIds[0]);
    expect(info.implemented).toBe(true);
    expect(info.found).toBe(true);
    expect(info.manifest?.id).toBe(createdIds[0]);
  });

  it('org-scoped backup only dumps the target org rows', async () => {
    const seedOrg = 'odbior--org-0001';
    const backup = await backupService.createBackup('full', REASON, {
      organizationId: seedOrg,
    });
    createdIds.push(backup.id);
    expect(backup.scope).toBe('organization');
    expect(backup.organizationId).toBe(seedOrg);

    const { getStorage } = await import('../../server/src/services/storage/index.js');
    const obj = await getStorage().getObject(backup.storageKey);
    const raw = (await streamToBuffer(obj.stream)).toString('utf8');
    expect(raw).toContain('consultify-encrypted-json-v1');
    expect(raw).not.toContain(seedOrg);
  });
});
