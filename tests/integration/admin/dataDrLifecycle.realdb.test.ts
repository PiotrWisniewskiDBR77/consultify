import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.unmock('../../../server/src/services/backupService.js');
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const describeReal = enabled ? describe : describe.skip;
const databaseUrl = process.env.DATABASE_URL || '';
const runId = randomUUID();
const org = `data-dr-org-${runId}`;
const user = `data-dr-user-${runId}`;
const foreignUser = `data-dr-foreign-${runId}`;
const superUser = `data-dr-super-${runId}`;
const slot = '2026-08-19T12:00:00.000Z';
let client: Client;
let service: typeof import('../../../server/src/services/backupService.js').default;
const backupIds: string[] = [];
const priorAuthBypass = process.env.ENABLE_TEST_AUTH_BYPASS;

describeReal('DATA-DR durable lifecycle and compensation', () => {
  beforeAll(async () => {
    const name = new URL(databaseUrl).pathname.replace(/^\//, '');
    if (!/^consultify_adm_backup_source_[a-z0-9_]+$/.test(name)) throw new Error('DATA_DR_DISPOSABLE_DB_REQUIRED');
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    expect((await client.query(`SELECT current_database() name`)).rows[0]?.name).toBe(name);
    await client.query(`SELECT pg_advisory_lock(hashtext('DATA-DR-001'))`);
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,'DATA DR')`, [org]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,password,role)
       VALUES($1,$2,$3,'Data','Owner','!','ADMIN'),($4,$2,$5,'Foreign','Spoof','!','ADMIN'),
             ($6,$2,$7,'Data','Super','!','SUPERADMIN')`,
      [user, org, `${user}@test.local`, foreignUser, `${foreignUser}@test.local`, superUser, `${superUser}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'ADMIN','ACTIVE')`,
      [`membership-${user}`, org, user]
    );
    service = (await import('../../../server/src/services/backupService.js')).default;
  });

  afterAll(async () => {
    if (!client) return;
    let cleanupError: unknown;
    try {
      const storageRows = await client.query(`SELECT storage_key FROM backup_manifests WHERE id=ANY($1::text[])`, [backupIds]);
      const { getStorage } = await import('../../../server/src/services/storage/index.js');
      for (const row of storageRows.rows) {
        await getStorage().delete(row.storage_key);
        const localPath = (getStorage() as any).resolvePath?.(row.storage_key);
        if (localPath) await expect(fs.stat(localPath)).rejects.toMatchObject({ code: 'ENOENT' });
      }
      await client.query('BEGIN');
      await client.query(`ALTER TABLE backup_run_receipts DISABLE TRIGGER backup_run_receipts_terminal_immutable`);
      await client.query(`ALTER TABLE backup_access_audit DISABLE TRIGGER backup_access_audit_no_update`);
      await client.query(`DELETE FROM backup_access_audit WHERE backup_id=ANY($1::text[])`, [backupIds]);
      await client.query(`DELETE FROM backup_run_receipts WHERE schedule_name IN ('data-dr-concurrency','data-dr-reclaim') OR backup_id=ANY($1::text[])`, [backupIds]);
      await client.query(`DELETE FROM backup_manifests WHERE id=ANY($1::text[])`, [backupIds]);
      await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
      await client.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [[user, foreignUser, superUser]]);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [org]);
      await client.query(`ALTER TABLE backup_access_audit ENABLE TRIGGER backup_access_audit_no_update`);
      await client.query(`ALTER TABLE backup_run_receipts ENABLE TRIGGER backup_run_receipts_terminal_immutable`);
      await client.query('COMMIT');
      const residue = await client.query(
        `SELECT
          (SELECT count(*)::int FROM organizations WHERE id=$1) organizations,
          (SELECT count(*)::int FROM users WHERE id=ANY($3::text[])) users,
          (SELECT count(*)::int FROM organization_members WHERE organization_id=$1) memberships,
          (SELECT count(*)::int FROM backup_manifests WHERE id=ANY($2::text[])) manifests,
          (SELECT count(*)::int FROM backup_access_audit WHERE backup_id=ANY($2::text[])) audits,
          (SELECT count(*)::int FROM backup_restore_receipts WHERE backup_id=ANY($2::text[])) restore_receipts,
          (SELECT count(*)::int FROM backup_run_receipts WHERE schedule_name IN ('data-dr-concurrency','data-dr-reclaim') OR backup_id=ANY($2::text[])) receipts`,
        [org, backupIds, [user, foreignUser, superUser]]
      );
      expect(residue.rows[0]).toEqual({ organizations: 0, users: 0, memberships: 0, manifests: 0, audits: 0, restore_receipts: 0, receipts: 0 });
      const disabledTriggers = await client.query(
        `SELECT count(*)::int n FROM pg_trigger WHERE tgname IN (
          'backup_run_receipts_terminal_immutable','backup_restore_receipts_terminal_immutable','backup_access_audit_no_update',
          'backup_source_clock_organizations','backup_source_clock_users','backup_source_clock_organization_members')
          AND (tgenabled<>'O' OR tgisinternal)`
      );
      expect(disabledTriggers.rows[0].n).toBe(0);
    } catch (error) {
      cleanupError = error;
      await client.query('ROLLBACK').catch(() => undefined);
    } finally {
      await client.query(`SELECT pg_advisory_unlock(hashtext('DATA-DR-001'))`).catch(() => undefined);
      const locks = await client.query(`SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()`);
      expect(locks.rows[0].n).toBe(0);
      if (priorAuthBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
      else process.env.ENABLE_TEST_AUTH_BYPASS = priorAuthBypass;
      await client.end();
    }
    if (cleanupError) throw cleanupError;
  });

  it('migration repeats and rejects a hostile occupied receipt shape', async () => {
    const sql = await fs.readFile(path.resolve('server/migrations/20260909_data_dr_backup_health.sql'), 'utf8');
    await expect(client.query(sql)).resolves.toBeDefined();
    await client.query('BEGIN');
    try {
      await client.query(`ALTER TABLE backup_run_receipts RENAME TO backup_run_receipts_valid`);
      await client.query(`CREATE TABLE backup_run_receipts(id text primary key)`);
      await expect(client.query(sql)).rejects.toThrow(/incompatible columns/);
    } finally {
      await client.query('ROLLBACK');
    }
    await client.query('BEGIN');
    try {
      await client.query(`ALTER TABLE backup_run_receipts DISABLE TRIGGER backup_run_receipts_terminal_immutable`);
      await expect(client.query(sql)).rejects.toThrow(/immutable trigger is incompatible/);
    } finally {
      await client.query('ROLLBACK');
    }
    await client.query('BEGIN');
    try {
      await client.query(`ALTER INDEX backup_run_receipts_schedule_slot_uidx RENAME TO backup_run_receipts_schedule_slot_valid`);
      await client.query(`CREATE UNIQUE INDEX backup_run_receipts_schedule_slot_uidx ON backup_run_receipts(schedule_name,scheduled_for) WHERE true`);
      await expect(client.query(sql)).rejects.toThrow(/slot index is incompatible|has extra indexes/);
    } finally {
      await client.query('ROLLBACK');
    }
    await client.query('BEGIN');
    try {
      await client.query(`CREATE OR REPLACE FUNCTION protect_backup_run_receipt_terminal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM 1; RETURN NEW; END $$`);
      await expect(client.query(sql)).rejects.toThrow(/incompatible definition/);
    } finally {
      await client.query('ROLLBACK');
    }
    await client.query('BEGIN');
    try {
      await client.query(`ALTER TABLE backup_run_receipts RENAME CONSTRAINT backup_run_receipts_status_check TO backup_run_receipts_status_valid`);
      await client.query(`ALTER TABLE backup_run_receipts ADD CONSTRAINT backup_run_receipts_status_check CHECK (true)`);
      await expect(client.query(sql)).rejects.toThrow(/checks are incompatible/);
    } finally {
      await client.query('ROLLBACK');
    }
    await client.query('BEGIN');
    try {
      await client.query(`ALTER TABLE backup_restore_receipts DISABLE TRIGGER backup_restore_receipts_terminal_immutable`);
      await expect(client.query(sql)).rejects.toThrow(/immutable trigger is incompatible/);
    } finally {
      await client.query('ROLLBACK');
    }
    await client.query('BEGIN');
    try {
      await client.query(`CREATE OR REPLACE FUNCTION prevent_backup_access_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$`);
      await expect(client.query(sql)).rejects.toThrow(/backup_access_audit function is incompatible/);
    } finally {
      await client.query('ROLLBACK');
    }
    await client.query('BEGIN');
    try {
      await client.query(`ALTER TABLE organization_members DISABLE TRIGGER backup_source_clock_organization_members`);
      await expect(client.query(sql)).rejects.toThrow(/backup source clock trigger is incompatible/);
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('claims one durable slot under concurrency and makes terminal receipt immutable', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () => service.claimBackupRun({ scheduleName: 'data-dr-concurrency', scheduledFor: slot }))
    );
    expect(attempts.filter((attempt) => attempt.claimed)).toHaveLength(1);
    const winner = attempts.find((attempt) => attempt.claimed)!;
    await service.finishBackupRun({ receiptId: winner.receiptId!, leaseToken: winner.leaseToken!, fence: winner.fence!, status: 'FAILED', error: 'positive-control' });
    await expect(client.query(`DELETE FROM backup_run_receipts WHERE id=$1`, [winner.receiptId])).rejects.toThrow(/append-only|immutable/i);
  });

  it('reclaims an expired slot with a higher fence and rejects the stale owner', async () => {
    const first = await service.claimBackupRun({ scheduleName: 'data-dr-reclaim', scheduledFor: slot });
    expect(first).toMatchObject({ claimed: true, fence: 1 });
    await client.query(`UPDATE backup_run_receipts SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1`, [first.receiptId]);
    const second = await service.claimBackupRun({ scheduleName: 'data-dr-reclaim', scheduledFor: slot });
    expect(second).toMatchObject({ claimed: true, receiptId: first.receiptId, fence: 2 });
    await expect(service.finishBackupRun({ receiptId: first.receiptId!, leaseToken: first.leaseToken!, fence: first.fence!, status: 'FAILED', error: 'stale' }))
      .rejects.toThrow('BACKUP_RUN_FENCE_LOST');
    await service.finishBackupRun({ receiptId: second.receiptId!, leaseToken: second.leaseToken!, fence: second.fence!, status: 'FAILED', error: 'owner-finished' });
  });

  it('selects users through membership and emits canonical v2 only', async () => {
    const backup = await service.createBackup('full', 'data-dr-tier-a', {
      organizationId: org,
      actorId: user,
      tables: ['organizations', 'users', 'organization_members'],
    });
    backupIds.push(backup.id);
    expect(backup.tables.find((table) => table.name === 'users')?.rowCount).toBe(1);
    expect(backup.rowCount).toBe(3);
    const row = await client.query(`SELECT manifest_json FROM backup_manifests WHERE id=$1`, [backup.id]);
    const manifest = JSON.parse(row.rows[0].manifest_json);
    expect(manifest).toMatchObject({ format: 'consultify-logical-backup-v2', schemaVersion: 2 });
    expect(manifest.tables.map((table: any) => table.name)).toEqual(['organizations', 'users', 'organization_members']);
    expect(manifest.tables.every((table: any) => /^[0-9a-f]{64}$/.test(table.sha256))).toBe(true);
    expect(manifest.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(service.createBackup('incremental', 'not-supported', { organizationId: org, actorId: user }))
      .rejects.toThrow('BACKUP_INCREMENTAL_NOT_IMPLEMENTED');
    await expect(service.createBackup('full', 'unsafe-extra', { organizationId: org, actorId: user, tables: ['organizations', 'audit_logs'] }))
      .rejects.toThrow('BACKUP_OPTIONAL_TABLE_NOT_APPROVED:audit_logs');
  });

  it('advances the consistent source fact for a membership-only change', async () => {
    const before = await service.createBackup('full', 'data-dr-membership-before', { organizationId: org, actorId: user });
    backupIds.push(before.id);
    const beforeManifest = JSON.parse((await client.query(`SELECT manifest_json FROM backup_manifests WHERE id=$1`, [before.id])).rows[0].manifest_json);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await client.query(`UPDATE organization_members SET role='MEMBER' WHERE organization_id=$1 AND user_id=$2`, [org, user]);
    const after = await service.createBackup('full', 'data-dr-membership-after', { organizationId: org, actorId: user });
    backupIds.push(after.id);
    const afterManifest = JSON.parse((await client.query(`SELECT manifest_json FROM backup_manifests WHERE id=$1`, [after.id])).rows[0].manifest_json);
    expect(afterManifest.sourceChangeVersion).toBeGreaterThan(beforeManifest.sourceChangeVersion);
    expect(new Date(afterManifest.sourceWatermark).getTime()).toBeGreaterThan(new Date(beforeManifest.sourceWatermark).getTime());
    await client.query(`UPDATE organization_members SET role='ADMIN' WHERE organization_id=$1 AND user_id=$2`, [org, user]);
  });

  it('persists raw RPO facts through the shared coordinator', async () => {
    const { default: BackupCron } = await import('../../../server/src/cron/BackupCron.js');
    const coordinator = new BackupCron({ backupService: service } as any);
    const result = await coordinator.runBackupTick({
      scheduleName: 'manual', scheduledFor: new Date().toISOString(), reason: 'data-dr-rpo',
      type: 'full', options: { organizationId: org, actorId: user },
    });
    expect(result.claimed).toBe(true);
    backupIds.push(result.backupId!);
    const receipt = await client.query(
      `SELECT status,source_watermark,source_observed_at,rpo_seconds,rpo_threshold_seconds,artifact_sha256,source_sha256,key_id
       FROM backup_run_receipts WHERE backup_id=$1`,
      [result.backupId]
    );
    expect(receipt.rows).toHaveLength(1);
    expect(receipt.rows[0].status).toMatch(/COMPLETED|MISSED/);
    expect(Number(receipt.rows[0].rpo_seconds)).toBeGreaterThanOrEqual(0);
    expect(Number(receipt.rows[0].rpo_threshold_seconds)).toBe(900);
    expect(receipt.rows[0].artifact_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.rows[0].source_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.rows[0].key_id).not.toContain(process.env.BACKUP_ENCRYPTION_KEY || '__secret__');
  });

  it('mounts both authorized manual entrypoints on the shared durable coordinator', async () => {
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    const gatewayApp = express();
    gatewayApp.use(express.json());
    gatewayApp.use((req, _res, next) => {
      const actor = req.header('x-data-dr-actor');
      if (actor === 'tenant') (req as any).user = { id: user, organizationId: org, role: 'ADMIN' };
      if (actor === 'ordinary') (req as any).user = { id: user, organizationId: org, role: 'USER' };
      if (actor === 'foreign') (req as any).user = { id: foreignUser, organizationId: `foreign-${org}`, role: 'ADMIN' };
      if (actor === 'super') (req as any).user = { id: superUser, organizationId: org, role: 'SUPERADMIN', superadminCapabilities: ['platform_ops'] };
      next();
    });
    const { apiGateway } = await import('../../../server/src/Gateway.js');
    apiGateway.initializeRoutes(gatewayApp);
    expect((await request(gatewayApp).post('/api/admin/backups/organization/manual').send({ type: 'full' })).status).toBe(403);
    await client.query(`UPDATE users SET role='USER' WHERE id=$1`, [user]);
    await client.query(`UPDATE organization_members SET role='USER' WHERE organization_id=$1 AND user_id=$2`, [org,user]);
    try {
      expect((await request(gatewayApp).post('/api/admin/backups/organization/manual').set('x-data-dr-actor','ordinary').send({ type: 'full' })).status).toBe(403);
    } finally {
      await client.query(`UPDATE users SET role='ADMIN' WHERE id=$1`, [user]);
      await client.query(`UPDATE organization_members SET role='ADMIN' WHERE organization_id=$1 AND user_id=$2`, [org,user]);
    }
    expect((await request(gatewayApp).post('/api/admin/backups/organization/manual').set('x-data-dr-actor','foreign').send({ type: 'full' })).status).toBe(403);
    await client.query(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`, [org,user]);
    try {
      expect((await request(gatewayApp).post('/api/admin/backups/organization/manual').set('x-data-dr-actor','tenant').send({ type: 'full' })).status).toBe(403);
    } finally {
      await client.query(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`, [org,user]);
    }
    const tenantResponse = await request(gatewayApp)
      .post('/api/admin/backups/organization/manual')
      .set('x-data-dr-actor','tenant')
      .send({ type: 'full', reason: 'data-dr-mounted-tenant' });
    expect(tenantResponse.status).toBe(200);
    expect(tenantResponse.body.backup).toMatchObject({ scope: 'organization', organizationId: org });
    backupIds.push(tenantResponse.body.backup.id);

    const systemResponse = await request(gatewayApp)
      .post('/api/superadmin/system/backup')
      .set('authorization', `Bearer ${(await import('jsonwebtoken')).default.sign({
        id: superUser,
        organizationId: org,
        role: 'SUPERADMIN',
        superadminCapabilities: ['platform_ops'],
      }, (await import('../../../server/src/config/Config.js')).default.JWT_SECRET)}`)
      .set('x-data-dr-actor','super')
      .send({ type: 'full', reason: 'data-dr-mounted-super' });
    expect(systemResponse.status).toBe(200);
    expect(systemResponse.body.backup).toMatchObject({ scope: 'system' });
    backupIds.push(systemResponse.body.backup.id);
  });

  it('compensates the storage object and manifest when the audit write fails', async () => {
    const { getStorage } = await import('../../../server/src/services/storage/index.js');
    const objectDir = (getStorage() as any).resolvePath(`backups/${org}`);
    const listObjects = async () => (await fs.readdir(objectDir).catch(() => [] as string[])).sort();
    const beforeObjects = await listObjects();
    await client.query(`CREATE OR REPLACE FUNCTION data_dr_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='BACKUP_CREATED' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`);
    await client.query(`CREATE TRIGGER data_dr_fail_audit BEFORE INSERT ON backup_access_audit FOR EACH ROW EXECUTE FUNCTION data_dr_fail_audit()`);
    const before = Number((await client.query(`SELECT count(*) n FROM backup_manifests`)).rows[0].n);
    try {
      await expect(service.createBackup('full', 'data-dr-compensation', { organizationId: org, actorId: user, tables: ['organizations'] }))
        .rejects.toThrow(/injected audit failure/);
      const failed = await client.query(`SELECT id,status,error FROM backup_manifests WHERE reason='data-dr-compensation'`);
      expect(failed.rows).toHaveLength(1);
      expect(failed.rows[0]).toMatchObject({ status: 'failed' });
      expect(failed.rows[0].error).toContain('object_compensated=true');
      backupIds.push(failed.rows[0].id);
      expect(Number((await client.query(`SELECT count(*) n FROM backup_manifests`)).rows[0].n)).toBe(before + 1);
      expect(await listObjects()).toEqual(beforeObjects);
    } finally {
      await client.query(`DROP TRIGGER data_dr_fail_audit ON backup_access_audit`);
      await client.query(`DROP FUNCTION data_dr_fail_audit()`);
    }
    await client.query(`CREATE OR REPLACE FUNCTION data_dr_fail_manifest() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected manifest failure'; END $$`);
    await client.query(`CREATE TRIGGER data_dr_fail_manifest BEFORE INSERT ON backup_manifests FOR EACH ROW EXECUTE FUNCTION data_dr_fail_manifest()`);
    try {
      await expect(service.createBackup('full', 'data-dr-manifest-compensation', { organizationId: org, actorId: user, tables: ['organizations'] }))
        .rejects.toThrow(/injected manifest failure/);
      expect(Number((await client.query(`SELECT count(*) n FROM backup_manifests`)).rows[0].n)).toBe(before + 1);
      expect(await listObjects()).toEqual(beforeObjects);
    } finally {
      await client.query(`DROP TRIGGER data_dr_fail_manifest ON backup_manifests`);
      await client.query(`DROP FUNCTION data_dr_fail_manifest()`);
    }
  });

  it('fails closed for missing key, required export failure and storage put failure', async () => {
    const originalKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (!originalKey) throw new Error('BACKUP_ENCRYPTION_KEY required by DATA-DR RealPG');
    delete process.env.BACKUP_ENCRYPTION_KEY;
    await expect(service.createBackup('full', 'data-dr-missing-key', { organizationId: org, actorId: user }))
      .rejects.toThrow(/BACKUP_ENCRYPTION_KEY/);
    process.env.BACKUP_ENCRYPTION_KEY = originalKey;

    await client.query(`ALTER TABLE organization_members RENAME TO organization_members_data_dr_hidden`);
    try {
      await expect(service.createBackup('full', 'data-dr-critical-export', { organizationId: org, actorId: user }))
        .rejects.toThrow(/BACKUP_REQUIRED_TABLE/);
    } finally {
      await client.query(`ALTER TABLE organization_members_data_dr_hidden RENAME TO organization_members`);
    }

    const { getStorage } = await import('../../../server/src/services/storage/index.js');
    const storage = getStorage() as any;
    const originalPut = storage.putObject.bind(storage);
    storage.putObject = async () => { throw new Error('injected storage put failure'); };
    try {
      await expect(service.createBackup('full', 'data-dr-storage-put', { organizationId: org, actorId: user }))
        .rejects.toThrow('injected storage put failure');
      const failed = await client.query(`SELECT id,status,error FROM backup_manifests WHERE reason='data-dr-storage-put'`);
      expect(failed.rows).toHaveLength(1);
      expect(failed.rows[0]).toMatchObject({ status: 'failed' });
      backupIds.push(failed.rows[0].id);
    } finally {
      storage.putObject = originalPut;
    }
  });
});
