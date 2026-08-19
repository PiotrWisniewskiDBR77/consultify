import fs from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, randomUUID } from 'node:crypto';

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
const userA = `backup-user-a-${fixtureRunId}`;
const userB = `backup-user-b-${fixtureRunId}`;
const fixedV1Org = 'backup-v1-org-5e752a41';
const fixedV1User = 'backup-v1-user-5e752a41';
const fixedV1Membership = 'backup-v1-membership-5e752a41';
const fixtureLockKey = 7_401_001;
const appendOnlyTriggerName = 'backup_access_audit_no_update';
const fixedV1Key = '11'.repeat(32);
const fixedV1BodySha256 = 'a388560bd68296243fd0330ceb13e567dcbe90c09abb0210434297d21bdf0039';
const fixedV1CiphertextSha256 = '95e852c25b08e619ccd2bf846a653610656152f40e2f5e2b9b0819fc721ab389';
// Immutable bytes generated from the exact v1 AES-GCM writer contract at
// 5e752a41cc604ae5fc8d929d7c6392d65bc41da8 using the fixed test key above.
const fixedV1BodyBase64 = 'eyJmb3JtYXQiOiJjb25zdWx0aWZ5LWVuY3J5cHRlZC1qc29uLXYxIiwiYWxnb3JpdGhtIjoiYWVzLTI1Ni1nY20iLCJpdiI6IkFCRWlNMFJWWm5lSW1hcTciLCJhdXRoVGFnIjoibWJRcFk2eDhIUmN0dTd3RmkzVXNyUT09IiwiY2lwaGVydGV4dCI6InBrTE8rT29kNnlENU9WUkRBWURSWlRWV3VHSUd5ZUE1d0xia2hJWmRha3Qza0I2SXcwV1FuZjJqdTk2dDY3R0RVakxJT3dQWEZ2M1d2bXYxWVRRMUpkZCtaZGpaMHhGdkt6R3kydjc3WkR6bEJWc3pHQ2Q4NDNtZWowalhnVmZ1Uzkxckp1MEtRMnZUZXFkZXVkRitwWUozNmY3bUluRGpubWR0Ly9BWWY5a1NJL1Vhek1TQ0JubFJ1Mi9jekY1akRCcWVIeGIybmJlMU1jYkxTNDNHWVpETHJQYStQMmVqMHg5TEpVVFJGelNZWWVYQXdGa0dVRktMcHZobnZCcWhwY29IamZDMG02ay9XTjBmclBYMmI1Z1BWdlhIcFNFbCtkN0pCVkRSRnA5a2ZhaVdnNWtPVytyVVBDdjFockFwVEE2dERNcHFOWTFCQUZFOXFkREZFQkp4ZDUzMUgwVDZneU1jVXlLVFhGYWFUOTAwUVI3N3dFNEQ0d3k0RVYwY2cyZlV4WE9ZbDJ6VWxUQ3ljNlBNdDU5b1VPajNnNHJDd1ZveUNySnVDaUhIVFVuNFFvcEJidkxWdFQ0aVFIbWgvbGkyMEhnR2YyMW5KMmpTTlhIY1AyNDRZRFRIbTdIRmZGc0piWTRpaktWaHJOOUM0Mm9WVUsza2FoN3VkRjlZbnppaXVEeGkzdmEzU2VDcXl5WDdsWENIQ1o1bG9UQnlXNUM5TW1laGdzY2hKNEhwd0c0REJDcFJWOGZXYWpabXZickxmMFlEQXg5Y3NDbXAwYjg1YWRmK2VwVUZhbFhic0tsV043MVBUQmhtQ29FczBXUnVJSk1SRXdGalV2cXFWeGREdnB1czBFdGJ1UWRVVWtGbDVRaENEOEVGaFpKaDJDblNxNHBoL005cDlzb2JicmxPL0ZiYnVaaWYvUU5XTFpWTkFncUFpZ1h4RmpNUWtqSHBHVWhmMkpOamE3Z3NLTG1CQnRYd1V5dk5hdEhhMnlteUdzMmoyNFBrNmhSVnkrdVpJSzBGVTBSOFRYWHNCbW9RM0F3cjVQRzdLUnIraGFWNG5mOFhtYjU3bW5LRnVDVk5yem5RSENTajZWMXdGOGxiU1N0SUpMUlF5UVpUa2d4TnBJSFFjaC93dzRhT1BhRlIwa3MxRXFzQTRoa1JIVVNKYVlTcytGQTdVMlhLOS91L3orN3NXMlZxV3N1OFRaeVdXcVRQb1NzVjJCVjBvcUxQSEQwYTJmdTZ4dlNHRWJva3pyWm05eXUzZFAxRjNSSnd6dTlacU1tZ1dEVDVrNHRnMDRtdHIxOFJZM295aGVianhkMExBL0pjM2x4cEpVWnc2TFp5a3lQNGxFaVdiSGRYUmxqVlNoU08xVXQxWExYV1ZRM3VXSUpMQjF0TW95T0dsbm1qdFovWGU0anBjbXZPQXhlNGxtZ2hrbXMrUW5PaUxIK3IzNTVBNFhlNk1kWW41eFlyOHpNMGRFd0xNQUhIc3dhM25Jc3RpVzNXaVdQd29JT3YrSFRSS0lOc0I3bEZOVXdnVTh2SUxsUmVmaG5Cb3hQdVgrZ04wajhtUUJkaThrc0xHdjlVWXhaZzhlTlNKYW1MdlFTMjhrVTJLR0FpY0QrZ2RJYjVRYnpMSDFTN1hFZjhMVEF1cjhlSjIwem94SUdPS2NXeUJHaUNadExSVEtObEkwaC9ybTU5MzFlRlRMQ2hJaE1LY0d1cG9ldUM3R0g0TFhuREg2bTRzcGZsRzdDVCIsImNoZWNrc3VtU2hhMjU2IjoiOTVlODUyYzI1YjA4ZTYxOWNjZDJiZjg0NmE2NTM2MTA2NTYxNTJmNDBlMmY1ZTJiOWIwODE5ZmM3MjFhYjM4OSJ9';
let backupService: typeof import('../../../server/src/services/backupService.js').default;
let backup: Awaited<ReturnType<typeof backupService.createBackup>>;
let objectPath = '';
const ownedBackupIds: string[] = [];
const ownedObjectPaths: string[] = [];
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

async function appendOnlyTriggerState(client: Client) {
  const result = await client.query(
    `
      SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public'
        AND c.relname='backup_access_audit'
        AND NOT t.tgisinternal
        AND t.tgname=$1
    `,
    [appendOnlyTriggerName]
  );
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({ tgname: appendOnlyTriggerName, tgenabled: 'O' });
  expect(result.rows[0].definition).toMatch(/BEFORE (UPDATE OR DELETE|DELETE OR UPDATE)/);
}

async function dataDrTriggerState(client: Client) {
  const result = await client.query(
    `SELECT tgname,tgenabled,tgisinternal FROM pg_trigger WHERE tgname=ANY($1::text[]) ORDER BY tgname`,
    [[
      'backup_access_audit_no_update','backup_run_receipts_terminal_immutable','backup_restore_receipts_terminal_immutable',
      'backup_source_clock_organizations','backup_source_clock_users','backup_source_clock_organization_members',
    ]]
  );
  expect(result.rows).toHaveLength(6);
  expect(result.rows.every((row) => row.tgenabled === 'O' && row.tgisinternal === false)).toBe(true);
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
    const bootstrapOwners = await targetClient.query(
      `SELECT
        (SELECT coalesce(json_agg(id ORDER BY id),'[]'::json) FROM organizations) organizations,
        (SELECT coalesce(json_agg(id ORDER BY id),'[]'::json) FROM users) users,
        (SELECT coalesce(json_agg(json_build_object('organization_id',organization_id,'user_id',user_id) ORDER BY id),'[]'::json) FROM organization_members) memberships`
    );
    expect(bootstrapOwners.rows[0]).toEqual({
      organizations: ['system'],
      users: ['system'],
      memberships: [{ organization_id: 'system', user_id: 'system' }],
    });
    await targetClient.query('BEGIN');
    try {
      await targetClient.query(`SET LOCAL session_replication_role=replica`);
      await targetClient.query(`DELETE FROM organization_members WHERE organization_id='system' AND user_id='system'`);
      await targetClient.query(`DELETE FROM users WHERE id='system' AND organization_id='system'`);
      await targetClient.query(`DELETE FROM organizations WHERE id='system'`);
      await targetClient.query('COMMIT');
    } catch (error) {
      await targetClient.query('ROLLBACK');
      throw error;
    }
    await appendOnlyTriggerState(sourceClient);
    await dataDrTriggerState(sourceClient);
    await dataDrTriggerState(targetClient);
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
    await sourceClient.query(
      `INSERT INTO users (id,organization_id,email,first_name,last_name,password,role)
       VALUES ($1,$2,$3,'Backup','A','!', 'ADMIN'),($4,$5,$6,'Backup','B','!', 'ADMIN')`,
      [userA, orgA, `${userA}@test.local`, userB, orgB, `${userB}@test.local`]
    );
    await sourceClient.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$6,'ADMIN','ACTIVE')`,
      [`membership-${userA}`, orgA, userA, `membership-${userB}`, orgB, userB]
    );
    backupService = (await import('../../../server/src/services/backupService.js')).default;
    backup = await backupService.createBackup('full', 'ADM-MVP-BACKUP-001 realDB', {
      organizationId: orgA,
      actorId,
      tables: ['organizations', 'users', 'organization_members'],
    });
    ownedBackupIds.push(backup.id);
    const { getStorage } = await import('../../../server/src/services/storage/index.js');
    objectPath = (getStorage() as any).resolvePath(backup.storageKey);
    ownedObjectPaths.push(objectPath);
  }, 120_000);

  afterAll(async () => {
    let cleanupError: unknown;
    try {
      if (sourceClient) {
        await sourceClient.query('BEGIN');
        try {
          await sourceClient.query(
            `ALTER TABLE public.backup_access_audit DISABLE TRIGGER backup_access_audit_no_update`
          );
          await sourceClient.query(
            `ALTER TABLE public.backup_restore_receipts DISABLE TRIGGER backup_restore_receipts_terminal_immutable`
          );
          await sourceClient.query(`DELETE FROM backup_restore_receipts WHERE backup_id=ANY($1::text[])`, [ownedBackupIds]);
          await sourceClient.query(`DELETE FROM backup_access_audit WHERE backup_id=ANY($1::text[])`, [ownedBackupIds]);
          await sourceClient.query(`DELETE FROM backup_manifests WHERE id=ANY($1::text[])`, [ownedBackupIds]);
          await sourceClient.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [[orgA, orgB]]);
          await sourceClient.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[userA, userB]]);
          await sourceClient.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [
            [orgA, orgB],
          ]);
          await sourceClient.query(
            `ALTER TABLE public.backup_access_audit ENABLE TRIGGER backup_access_audit_no_update`
          );
          await sourceClient.query(
            `ALTER TABLE public.backup_restore_receipts ENABLE TRIGGER backup_restore_receipts_terminal_immutable`
          );
          await appendOnlyTriggerState(sourceClient);
          await sourceClient.query('COMMIT');
        } catch (error) {
          try {
            await sourceClient.query(
              `ALTER TABLE public.backup_access_audit ENABLE TRIGGER backup_access_audit_no_update`
            );
            await sourceClient.query(
              `ALTER TABLE public.backup_restore_receipts ENABLE TRIGGER backup_restore_receipts_terminal_immutable`
            );
          } catch {
            // ROLLBACK below restores the transaction's initial trigger state.
          }
          await sourceClient.query('ROLLBACK');
          await appendOnlyTriggerState(sourceClient);
          throw error;
        }
        await appendOnlyTriggerState(sourceClient);
        const sourceResidue = await sourceClient.query(
          `
          SELECT
            (SELECT count(*)::int FROM organizations WHERE id = ANY($1::text[])) AS organizations,
            (SELECT count(*)::int FROM users WHERE id=ANY($2::text[])) AS users,
            (SELECT count(*)::int FROM organization_members WHERE organization_id=ANY($1::text[])) AS memberships,
            (SELECT count(*)::int FROM backup_manifests WHERE id=ANY($3::text[])) AS manifests,
            (SELECT count(*)::int FROM backup_access_audit WHERE backup_id=ANY($3::text[])) AS audit,
            (SELECT count(*)::int FROM backup_restore_receipts WHERE backup_id=ANY($3::text[])) AS restore_receipts
        `,
          [[orgA, orgB], [userA, userB], ownedBackupIds]
        );
        expect(sourceResidue.rows[0]).toEqual({ organizations: 0, users: 0, memberships: 0, manifests: 0, audit: 0, restore_receipts: 0 });
        await dataDrTriggerState(sourceClient);
      }
      if (targetClient) {
        await targetClient.query('BEGIN');
        try {
          await targetClient.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [[orgA, orgB, fixedV1Org]]);
          await targetClient.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[userA, userB, fixedV1User]]);
          await targetClient.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [
            [orgA, orgB, fixedV1Org],
          ]);
          await targetClient.query('COMMIT');
        } catch (error) {
          await targetClient.query('ROLLBACK');
          throw error;
        }
        const targetResidue = await targetClient.query(
          `SELECT
            (SELECT count(*)::int FROM organizations WHERE id=ANY($1::text[])) organizations,
            (SELECT count(*)::int FROM users WHERE id=ANY($2::text[])) users,
            (SELECT count(*)::int FROM organization_members WHERE organization_id=ANY($1::text[])) memberships`,
          [[orgA, orgB, fixedV1Org], [userA, userB, fixedV1User]]
        );
        expect(targetResidue.rows[0]).toEqual({ organizations: 0, users: 0, memberships: 0 });
        await dataDrTriggerState(targetClient);
      }
      for (const ownedPath of ownedObjectPaths) {
        await fs.rm(ownedPath, { force: true });
        await expect(fs.stat(ownedPath)).rejects.toMatchObject({ code: 'ENOENT' });
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
          expect((await sourceClient.query(`SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()`)).rows[0].n).toBe(0);
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
    const envelope = JSON.parse(raw);
    expect(envelope).toMatchObject({ format: 'consultify-logical-backup-v2', algorithm: 'aes-256-gcm' });
    expect(Buffer.from(envelope.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(envelope.authTag, 'base64')).toHaveLength(16);
    expect(Buffer.from(envelope.ciphertext, 'base64').length).toBeGreaterThan(0);
    expect(createHash('sha256').update(Buffer.from(envelope.ciphertext, 'base64')).digest('hex'))
      .toBe(envelope.checksumSha256);
    expect(envelope.checksumSha256).toBe(backup.checksumSha256);
    expect(raw).not.toContain('Backup Tenant A');
    expect(raw).not.toContain(orgA);
    expect(raw).not.toContain(userA);
    expect(raw).not.toContain(`${userA}@test.local`);
    expect(raw).not.toContain(`membership-${userA}`);
  });

  it('rejects a wrong key before target mutation', async () => {
    const originalKey = process.env.BACKUP_ENCRYPTION_KEY;
    process.env.BACKUP_ENCRYPTION_KEY = '22'.repeat(32);
    try {
      await expect(backupService.restoreBackup(backup.id, {
        targetDatabaseUrl: targetUrl, actorId, expectedOrganizationId: orgA,
      })).rejects.toThrow();
    } finally {
      if (originalKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
      else process.env.BACKUP_ENCRYPTION_KEY = originalKey;
    }
    const counts = await targetClient!.query(
      `SELECT (SELECT count(*)::int FROM organizations) organizations,
              (SELECT count(*)::int FROM users) users,
              (SELECT count(*)::int FROM organization_members) memberships`
    );
    expect(counts.rows[0]).toEqual({ organizations: 0, users: 0, memberships: 0 });
  });

  it('rolls back every owner table on a mid-restore write failure', async () => {
    await targetClient!.query(`CREATE FUNCTION data_dr_reject_user() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'mid restore failure'; END $$`);
    await targetClient!.query(`CREATE TRIGGER data_dr_reject_user BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION data_dr_reject_user()`);
    try {
      await expect(backupService.restoreBackup(backup.id, {
        targetDatabaseUrl: targetUrl, actorId, expectedOrganizationId: orgA,
      })).rejects.toThrow(/mid restore failure/);
      const counts = await targetClient!.query(
        `SELECT (SELECT count(*)::int FROM organizations) organizations,
                (SELECT count(*)::int FROM users) users,
                (SELECT count(*)::int FROM organization_members) memberships`
      );
      expect(counts.rows[0]).toEqual({ organizations: 0, users: 0, memberships: 0 });
    } finally {
      await targetClient!.query(`DROP TRIGGER data_dr_reject_user ON users`);
      await targetClient!.query(`DROP FUNCTION data_dr_reject_user()`);
    }
  });

  it('checks every canonical target table for pristine state independently', async () => {
    const occupiedOrg = `occupied-org-${fixtureRunId}`;
    const occupiedUser = `occupied-user-${fixtureRunId}`;
    const occupiedMembership = `occupied-membership-${fixtureRunId}`;
    const clear = async () => {
      await targetClient!.query(`SET session_replication_role=replica`);
      try {
        await targetClient!.query(`DELETE FROM organization_members WHERE id=$1`, [occupiedMembership]);
        await targetClient!.query(`DELETE FROM users WHERE id=$1`, [occupiedUser]);
        await targetClient!.query(`DELETE FROM organizations WHERE id=$1`, [occupiedOrg]);
      } finally {
        await targetClient!.query(`SET session_replication_role=origin`);
      }
    };
    for (const ownerTable of ['organizations','users','organization_members'] as const) {
      await clear();
      await targetClient!.query(`SET session_replication_role=replica`);
      try {
        if (ownerTable === 'organizations') {
          await targetClient!.query(`INSERT INTO organizations(id,name) VALUES($1,'Occupied')`, [occupiedOrg]);
        } else if (ownerTable === 'users') {
          await targetClient!.query(`INSERT INTO organizations(id,name) VALUES($1,'Transient')`, [occupiedOrg]);
          await targetClient!.query(`INSERT INTO users(id,organization_id,email,first_name,last_name,password,role) VALUES($1,$2,$3,'Occupied','User','!','ADMIN')`, [occupiedUser, occupiedOrg, `${occupiedUser}@test.local`]);
          await targetClient!.query(`DELETE FROM organizations WHERE id=$1`, [occupiedOrg]);
        } else {
          await targetClient!.query(`INSERT INTO organizations(id,name) VALUES($1,'Transient')`, [occupiedOrg]);
          await targetClient!.query(`INSERT INTO users(id,organization_id,email,first_name,last_name,password,role) VALUES($1,$2,$3,'Occupied','User','!','ADMIN')`, [occupiedUser, occupiedOrg, `${occupiedUser}@test.local`]);
          await targetClient!.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE')`, [occupiedMembership, occupiedOrg, occupiedUser]);
          await targetClient!.query(`DELETE FROM users WHERE id=$1`, [occupiedUser]);
          await targetClient!.query(`DELETE FROM organizations WHERE id=$1`, [occupiedOrg]);
        }
      } finally {
        await targetClient!.query(`SET session_replication_role=origin`);
      }
      await expect(backupService.restoreBackup(backup.id, {
        targetDatabaseUrl: targetUrl, actorId, expectedOrganizationId: orgA,
      })).rejects.toThrow(`RESTORE_TARGET_NOT_PRISTINE:${ownerTable}`);
    }
    await clear();
  });

  it('checks membership-table pristine state even when a historical v1 payload omits that table', async () => {
    const key = Buffer.from(fixedV1Key, 'hex');
    const originalEnvelope = JSON.parse(Buffer.from(fixedV1BodyBase64, 'base64').toString('utf8'));
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(originalEnvelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(originalEnvelope.authTag, 'base64'));
    const originalPlaintext = Buffer.concat([
      decipher.update(Buffer.from(originalEnvelope.ciphertext, 'base64')), decipher.final(),
    ]);
    const payload = JSON.parse(originalPlaintext.toString('utf8'));
    delete payload.data.organization_members;
    payload.manifest.id = `backup-v1-omitted-${fixtureRunId}`;
    payload.manifest.storageKey = `backups/${fixedV1Org}/${payload.manifest.id}.json`;
    payload.manifest.tables = payload.manifest.tables.filter((entry: any) => entry.name !== 'organization_members');
    payload.manifest.tableCount = 2;
    payload.manifest.totalRows = 2;
    const iv = Buffer.from('ffeeddccbbaa998877665544', 'hex');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload))), cipher.final()]);
    const checksum = createHash('sha256').update(ciphertext).digest('hex');
    const body = Buffer.from(JSON.stringify({
      format: 'consultify-encrypted-json-v1', algorithm: 'aes-256-gcm', iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64'), checksumSha256: checksum,
    }));
    const { getStorage } = await import('../../../server/src/services/storage/index.js');
    await getStorage().putObject({ key: payload.manifest.storageKey, body, contentType: 'application/json' });
    ownedObjectPaths.push((getStorage() as any).resolvePath(payload.manifest.storageKey));
    ownedBackupIds.push(payload.manifest.id);
    await sourceClient!.query(
      `INSERT INTO backup_manifests(id,type,scope,organization_id,reason,status,storage_key,provider,table_count,row_count,size_bytes,manifest_json,checksum_sha256,encrypted)
       VALUES($1,'full','organization',$2,'v1-omitted-membership','completed',$3,'local',2,2,$4,$5,$6,true)`,
      [payload.manifest.id, fixedV1Org, payload.manifest.storageKey, body.length, JSON.stringify(payload.manifest), checksum]
    );
    const occupiedOrg = `v1-omitted-org-${fixtureRunId}`;
    const occupiedUser = `v1-omitted-user-${fixtureRunId}`;
    const occupiedMembership = `v1-omitted-membership-${fixtureRunId}`;
    await targetClient!.query(`SET session_replication_role=replica`);
    try {
      await targetClient!.query(`INSERT INTO organizations(id,name) VALUES($1,'Transient')`, [occupiedOrg]);
      await targetClient!.query(`INSERT INTO users(id,organization_id,email,first_name,last_name,password,role) VALUES($1,$2,$3,'Transient','User','!','ADMIN')`, [occupiedUser, occupiedOrg, `${occupiedUser}@test.local`]);
      await targetClient!.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE')`, [occupiedMembership, occupiedOrg, occupiedUser]);
      await targetClient!.query(`DELETE FROM users WHERE id=$1`, [occupiedUser]);
      await targetClient!.query(`DELETE FROM organizations WHERE id=$1`, [occupiedOrg]);
    } finally {
      await targetClient!.query(`SET session_replication_role=origin`);
    }
    const priorKey = process.env.BACKUP_ENCRYPTION_KEY;
    process.env.BACKUP_ENCRYPTION_KEY = fixedV1Key;
    try {
      await expect(backupService.restoreBackup(payload.manifest.id, {
        targetDatabaseUrl: targetUrl, actorId, expectedOrganizationId: fixedV1Org,
      })).rejects.toThrow('RESTORE_TARGET_NOT_PRISTINE:organization_members');
    } finally {
      if (priorKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
      else process.env.BACKUP_ENCRYPTION_KEY = priorKey;
      await targetClient!.query(`SET session_replication_role=replica`);
      await targetClient!.query(`DELETE FROM organization_members WHERE id=$1`, [occupiedMembership]);
      await targetClient!.query(`SET session_replication_role=origin`);
    }
  });

  it('restores into an isolated migrated database with checksum and tenant integrity', async () => {
    const result = await backupService.restoreBackup(backup.id, {
      targetDatabaseUrl: targetUrl,
      actorId,
      expectedOrganizationId: orgA,
    });
    expect(result.checksumVerified).toBe(true);
    expect(result.restoredTables).toBe(3);
    expect(result.restoredRows).toBe(3);
    const restored = await query(
      targetUrl,
      `SELECT id,name FROM organizations WHERE id = ANY($1::text[])`,
      [[orgA, orgB]]
    );
    expect(restored.rows).toEqual([{ id: orgA, name: 'Backup Tenant A' }]);
    expect((await query(targetUrl, `SELECT id,email,role FROM users WHERE id=ANY($1::text[]) ORDER BY id`, [[userA,userB]])).rows)
      .toEqual([{ id: userA, email: `${userA}@test.local`, role: 'ADMIN' }]);
    expect((await query(targetUrl, `SELECT id,organization_id,user_id,role,status FROM organization_members WHERE organization_id=ANY($1::text[])`, [[orgA,orgB]])).rows)
      .toEqual([{ id: `membership-${userA}`, organization_id: orgA, user_id: userA, role: 'ADMIN', status: 'ACTIVE' }]);
  });

  it('reads the fixed previous-sha v1 contract from 5e752a41cc604ae5fc8d929d7c6392d65bc41da8', async () => {
    await targetClient!.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgA]);
    await targetClient!.query(`DELETE FROM users WHERE id=$1`, [userA]);
    await targetClient!.query(`DELETE FROM organizations WHERE id=$1`, [orgA]);
    const historicalId = 'backup-v1-fixed-5e752a41';
    const storageKey = `backups/${fixedV1Org}/${historicalId}.json`;
    const manifest = {
      id: historicalId, type: 'full', scope: 'organization', organizationId: fixedV1Org,
      reason: 'fixed-sha-v1-reader', createdAt: '2026-08-19T00:00:00.000Z', format: 'consultify-json-v1',
      tables: ['organizations','users','organization_members'].map((name) => ({ name, rowCount: 1 })), tableCount: 3,
      totalRows: 3, storageKey,
      provider: 'local', encrypted: true, encryptionAlgorithm: 'aes-256-gcm',
    };
    const body = Buffer.from(fixedV1BodyBase64, 'base64');
    expect(createHash('sha256').update(body).digest('hex')).toBe(fixedV1BodySha256);
    const envelope = JSON.parse(body.toString('utf8'));
    expect(envelope).toMatchObject({ format: 'consultify-encrypted-json-v1', algorithm: 'aes-256-gcm' });
    expect(Buffer.from(envelope.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(envelope.authTag, 'base64')).toHaveLength(16);
    expect(createHash('sha256').update(Buffer.from(envelope.ciphertext, 'base64')).digest('hex')).toBe(fixedV1CiphertextSha256);
    expect(envelope.checksumSha256).toBe(fixedV1CiphertextSha256);
    const { getStorage } = await import('../../../server/src/services/storage/index.js');
    await getStorage().putObject({ key: storageKey, body, contentType: 'application/json' });
    ownedObjectPaths.push((getStorage() as any).resolvePath(storageKey));
    ownedBackupIds.push(historicalId);
    await sourceClient!.query(
      `INSERT INTO backup_manifests(id,type,scope,organization_id,reason,status,storage_key,provider,table_count,row_count,size_bytes,manifest_json,checksum_sha256,encrypted)
       VALUES($1,'full','organization',$2,'fixed-sha-v1-reader','completed',$3,'local',3,$4,$5,$6,$7,true)`,
      [historicalId, fixedV1Org, storageKey, manifest.totalRows, body.length, JSON.stringify(manifest), fixedV1CiphertextSha256]
    );
    const priorKey = process.env.BACKUP_ENCRYPTION_KEY;
    process.env.BACKUP_ENCRYPTION_KEY = fixedV1Key;
    try {
      await expect(backupService.restoreBackup(historicalId, {
        targetDatabaseUrl: targetUrl, actorId, expectedOrganizationId: fixedV1Org,
      })).resolves.toMatchObject({ backupId: historicalId, restoredRows: 3 });
    } finally {
      if (priorKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
      else process.env.BACKUP_ENCRYPTION_KEY = priorKey;
    }
    expect((await query(targetUrl, `SELECT id,name FROM organizations WHERE id=$1`, [fixedV1Org])).rows)
      .toEqual([{ id: fixedV1Org, name: 'Fixed previous SHA tenant' }]);
    expect((await query(targetUrl, `SELECT id,email FROM users WHERE id=$1`, [fixedV1User])).rows)
      .toEqual([{ id: fixedV1User, email: 'fixed-v1@fixture.invalid' }]);
    expect((await query(targetUrl, `SELECT id,role,status FROM organization_members WHERE id=$1`, [fixedV1Membership])).rows)
      .toEqual([{ id: fixedV1Membership, role: 'ADMIN', status: 'ACTIVE' }]);
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
    const aliasedTarget = new URL(targetUrl);
    aliasedTarget.pathname = `/${encodeURIComponent(aliasedTarget.pathname.replace(/^\//, '')).replace(/^c/, '%63')}`;
    await expect(
      backupService.restoreBackup(backup.id, { targetDatabaseUrl: aliasedTarget.toString(), actorId })
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
