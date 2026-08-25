import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  executeManifest,
  manifestPayload,
  readConnectionParity,
  type OwnerBindingManifest,
  type OwnerBindingMapping,
} from '../../../server/scripts/partner-owner-organization-binding';

const DATABASE_URL = process.env.DATABASE_URL;
const describeReal = DATABASE_URL ? describe : describe.skip;
const KEY = {
  keyId: 'prt-owner-binding-test',
  secret: 'owner-binding-test-secret-at-least-32-bytes',
};
const suffix = randomUUID().slice(0, 8);
const actorId = `prt-bind-actor-${suffix}`;
const ordinaryId = `prt-bind-user-${suffix}`;
const orgA = `prt-bind-org-a-${suffix}`;
const orgB = `prt-bind-org-b-${suffix}`;
const foreignOrg = `prt-bind-foreign-org-${suffix}`;
const partnerA = randomUUID();
const partnerB = randomUUID();
const partnerC = randomUUID();
const foreignPartner = randomUUID();

// Connection-parity seed (FIX-2): five distinct legacy resolution states for
// one partner -> owner mapping, reproducing partnerOrgResolution.ts:11-98.
// `partner_users.user_id` is a UUID column, so these five users must carry
// UUID ids (unlike the prt-bind-* actor/ordinary ids above) — tracked in
// `parityUserIds` for explicit afterAll cleanup instead of the LIKE
// 'prt-bind-%' sweep used for the rest of this file.
const orgParity = `prt-bind-org-parity-${suffix}`;
const partnerParity = randomUUID();
// zwiazany (bound): direct active partner_users link + ACTIVE membership in
// the mapped owner org -> legacy-counted, eligible, strict-connected after APPLY.
const userZwiazany = randomUUID();
// wiazliwy / created-by-only (bindable): no partner_users row, but is
// partner_organizations.created_by, + ACTIVE membership in the owner org ->
// legacy-counted via the created_by branch, eligible, strict-connected after APPLY.
const userWiazliwy = randomUUID();
// niewiazliwy (not bindable): direct active partner_users link, but NO
// membership row in the mapped owner org -> legacy-counted, NOT eligible ->
// exception ACTIVE_OWNER_MEMBERSHIP_MISSING.
const userNiewiazliwy = randomUUID();
// po koledze (colleague-inherited, FIX-2 new branch): no partner_users row,
// not created_by, but shares ACTIVE membership in the owner org with
// userZwiazany (who has a direct link) -> the legacy resolver self-heals a
// partner_users row for this user at read time. Must be legacy-counted and
// surfaced as exception COLLEAGUE_INHERITED, never silently dropped and
// never auto-eligible.
const userPoKoledze = randomUUID();
const parityUserIds = [userZwiazany, userWiazliwy, userNiewiazliwy, userPoKoledze];
let pool: pg.Pool;
let appliedManifest: OwnerBindingManifest;

async function assertOwnedDisposableDatabase(): Promise<void> {
  const prefix = String(process.env.PRT_OWNER_BINDING_DB_PREFIX || '').trim();
  if (!prefix.startsWith('consultify_prt_owner_bind_test_')) {
    throw new Error('PRT_OWNER_BINDING_DB_PREFIX must use consultify_prt_owner_bind_test_');
  }
  const live = (await pool.query<{ database: string }>('SELECT current_database() database'))
    .rows[0].database;
  const urlDatabase = new URL(DATABASE_URL!).pathname.replace(/^\/+/, '');
  if (live !== urlDatabase || !live.startsWith(prefix)) {
    throw new Error(`Refusing cleanup outside owned disposable database prefix ${prefix}`);
  }
}

function signedManifest(params: {
  runId: string;
  operation?: 'APPLY' | 'ROLLBACK';
  mappings: OwnerBindingMapping[];
  actorUserId?: string;
  applyRunId?: string;
  expired?: boolean;
}): OwnerBindingManifest {
  const now = Date.now();
  const manifest: OwnerBindingManifest = {
    schemaVersion: 1,
    runId: params.runId,
    operation: params.operation || 'APPLY',
    ...(params.applyRunId ? { applyRunId: params.applyRunId } : {}),
    actorUserId: params.actorUserId || actorId,
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(params.expired ? now - 1 : now + 3_600_000).toISOString(),
    mappings: params.mappings.map((mapping) => ({ ...mapping })),
    signature: { algorithm: 'HMAC-SHA256', keyId: KEY.keyId, value: '' },
  };
  manifest.signature.value = createHmac('sha256', KEY.secret)
    .update(manifestPayload(manifest), 'utf8')
    .digest('hex');
  return manifest;
}

async function owner(partnerId: string): Promise<string | null> {
  return (
    await pool.query<{ owner_organization_id: string | null }>(
      `SELECT owner_organization_id FROM partner_organizations WHERE id=$1::uuid`,
      [partnerId]
    )
  ).rows[0].owner_organization_id;
}

describeReal.sequential('Partner historical owner binding', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL, max: 6 });
    await assertOwnedDisposableDatabase();
    const migration = fs.readFileSync(
      path.resolve('server/migrations/958_partner_owner_binding_receipts.sql'),
      'utf8'
    );
    await pool.query(migration);
    await pool.query(migration);
    await pool.query(
      `INSERT INTO organizations(id,name,status,is_active) VALUES
       ($1,'Owner A','active',1),($2,'Owner B','active',1),($3,'Foreign','active',1)`,
      [orgA, orgB, foreignOrg]
    );
    await pool.query(
      `INSERT INTO users(id,email,role,status) VALUES
       ($1,$2,'SUPERADMIN','active'),($3,$4,'ADMIN','active')`,
      [actorId, `${actorId}@test.local`, ordinaryId, `${ordinaryId}@test.local`]
    );
    for (const id of [partnerA, partnerB, partnerC, foreignPartner]) {
      await pool.query(
        `INSERT INTO partner_organizations
         (id,name,contact_email,status,referral_code,referral_link_slug,owner_organization_id)
         VALUES($1,$2,$3,'active',$4,$5,$6)`,
        [
          id,
          id,
          `${id}@test.local`,
          `CODE-${id}`,
          `slug-${id}`,
          id === foreignPartner ? foreignOrg : null,
        ]
      );
    }
  });

  afterAll(async () => {
    if (!pool) return;
    await assertOwnedDisposableDatabase();
    await pool.query('BEGIN');
    try {
      await pool.query(`SET LOCAL session_replication_role='replica'`);
      if (
        (await pool.query(`SELECT to_regclass('public.partner_owner_binding_receipts') present`))
          .rows[0].present
      ) {
        await pool.query(`DELETE FROM partner_owner_binding_receipts WHERE actor_user_id=$1`, [
          actorId,
        ]);
      }
      await pool.query(`DELETE FROM partner_organizations WHERE id=ANY($1::uuid[])`, [
        [partnerA, partnerB, partnerC, foreignPartner],
      ]);
      await pool.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [[actorId, ordinaryId]]);
      await pool.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [
        [orgA, orgB, foreignOrg],
      ]);
      await pool.query('COMMIT');
      expect(
        Number(
          (
            await pool.query(
              `SELECT (SELECT count(*) FROM partner_owner_binding_receipts) +
                      (SELECT count(*) FROM users WHERE id LIKE 'prt-bind-%') +
                      (SELECT count(*) FROM organizations WHERE id LIKE 'prt-bind-%') +
                      (SELECT count(*) FROM partner_organizations
                        WHERE id=ANY($1::uuid[])) n`,
              [[partnerA, partnerB, partnerC, foreignPartner]]
            )
          ).rows[0].n
        )
      ).toBe(0);
      expect(
        Number(
          (
            await pool.query(
              `SELECT count(*) n FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
                WHERE a.datname=current_database() AND l.locktype='advisory'`
            )
          ).rows[0].n
        )
      ).toBe(0);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    } finally {
      await pool.end();
    }
  });

  it('migration repeats and refuses a hostile pre-existing receipt table', async () => {
    const migration = fs.readFileSync(
      path.resolve('server/migrations/958_partner_owner_binding_receipts.sql'),
      'utf8'
    );
    await pool.query(
      `ALTER TABLE partner_owner_binding_receipts RENAME TO partner_owner_binding_receipts_good`
    );
    try {
      await pool.query(`CREATE TABLE partner_owner_binding_receipts(run_id integer)`);
      await expect(pool.query(migration)).rejects.toThrow(/incompatible columns/);
      await pool.query(`DROP TABLE partner_owner_binding_receipts`);
    } finally {
      await pool.query(
        `ALTER TABLE partner_owner_binding_receipts_good RENAME TO partner_owner_binding_receipts`
      );
    }
    await expect(pool.query(migration)).resolves.toBeDefined();

    await pool.query(
      `ALTER INDEX uq_partner_owner_binding_apply_input RENAME TO uq_partner_owner_binding_apply_input_good`
    );
    try {
      await pool.query(
        `CREATE UNIQUE INDEX uq_partner_owner_binding_apply_input
         ON partner_owner_binding_receipts(input_sha256)
         WHERE operation='APPLY' OR true`
      );
      await expect(pool.query(migration)).rejects.toThrow(/apply_input is incompatible/);
      await pool.query(`DROP INDEX uq_partner_owner_binding_apply_input`);
    } finally {
      await pool.query(
        `ALTER INDEX uq_partner_owner_binding_apply_input_good RENAME TO uq_partner_owner_binding_apply_input`
      );
    }

    await pool.query(
      `ALTER TABLE partner_owner_binding_receipts
       RENAME CONSTRAINT partner_owner_binding_receipts_mapping_count_check
       TO partner_owner_binding_receipts_mapping_count_check_good`
    );
    try {
      await pool.query(
        `ALTER TABLE partner_owner_binding_receipts
         ADD CONSTRAINT partner_owner_binding_receipts_mapping_count_check CHECK(true)`
      );
      await expect(pool.query(migration)).rejects.toThrow(/incompatible constraints/);
    } finally {
      await pool.query(
        `ALTER TABLE partner_owner_binding_receipts
         DROP CONSTRAINT IF EXISTS partner_owner_binding_receipts_mapping_count_check`
      );
      await pool.query(
        `ALTER TABLE partner_owner_binding_receipts
         RENAME CONSTRAINT partner_owner_binding_receipts_mapping_count_check_good
         TO partner_owner_binding_receipts_mapping_count_check`
      );
    }

    await pool.query(
      `ALTER FUNCTION protect_partner_owner_binding_receipts() RENAME TO protect_partner_owner_binding_receipts_good`
    );
    try {
      await pool.query(
        `CREATE FUNCTION protect_partner_owner_binding_receipts() RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN PERFORM 1; RAISE EXCEPTION 'partner_owner_binding_receipts are append-only'; END $$`
      );
      await expect(pool.query(migration)).rejects.toThrow(/incompatible/i);
    } finally {
      await pool.query(`DROP FUNCTION IF EXISTS protect_partner_owner_binding_receipts()`);
      await pool.query(
        `ALTER FUNCTION protect_partner_owner_binding_receipts_good() RENAME TO protect_partner_owner_binding_receipts`
      );
    }

    await pool.query(
      `ALTER TRIGGER trg_partner_owner_binding_receipts_append_only ON partner_owner_binding_receipts
       RENAME TO trg_partner_owner_binding_receipts_append_only_good`
    );
    try {
      await pool.query(
        `CREATE TRIGGER trg_partner_owner_binding_receipts_append_only BEFORE INSERT OR UPDATE OR DELETE
         ON partner_owner_binding_receipts FOR EACH ROW
         EXECUTE FUNCTION public.protect_partner_owner_binding_receipts()`
      );
      await expect(pool.query(migration)).rejects.toThrow(/append_only is incompatible/i);
    } finally {
      await pool.query(
        `DROP TRIGGER IF EXISTS trg_partner_owner_binding_receipts_append_only ON partner_owner_binding_receipts`
      );
    }

    await pool.query(`CREATE SCHEMA prt_binding_hostile`);
    await pool.query(
      `CREATE FUNCTION prt_binding_hostile.protect_partner_owner_binding_receipts()
       RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'partner_owner_binding_receipts are append-only'; END $$`
    );
    try {
      await pool.query(
        `CREATE TRIGGER trg_partner_owner_binding_receipts_append_only BEFORE UPDATE OR DELETE
         ON partner_owner_binding_receipts FOR EACH ROW
         EXECUTE FUNCTION prt_binding_hostile.protect_partner_owner_binding_receipts()`
      );
      await expect(pool.query(migration)).rejects.toThrow(/append_only is incompatible/i);
    } finally {
      await pool.query(
        `DROP TRIGGER IF EXISTS trg_partner_owner_binding_receipts_append_only ON partner_owner_binding_receipts`
      );
      await pool.query(`DROP SCHEMA prt_binding_hostile CASCADE`);
      await pool.query(
        `ALTER TRIGGER trg_partner_owner_binding_receipts_append_only_good ON partner_owner_binding_receipts
         RENAME TO trg_partner_owner_binding_receipts_append_only`
      );
    }
    await expect(pool.query(migration)).resolves.toBeDefined();

    const ownedPrefix = process.env.PRT_OWNER_BINDING_DB_PREFIX;
    process.env.PRT_OWNER_BINDING_DB_PREFIX = 'not-owned';
    try {
      await expect(assertOwnedDisposableDatabase()).rejects.toThrow(/must use/);
    } finally {
      process.env.PRT_OWNER_BINDING_DB_PREFIX = ownedPrefix;
    }
  });

  it('dry-runs a signed explicit mapping with zero writes', async () => {
    const manifest = signedManifest({
      runId: `dry-${suffix}`,
      mappings: [{ partnerOrganizationId: partnerA, ownerOrganizationId: orgA }],
    });
    const result = await executeManifest({
      pool,
      manifest,
      key: KEY,
      write: false,
    });
    expect(result).toMatchObject({
      dryRun: true,
      replay: false,
      mappingCount: 1,
    });
    expect(await owner(partnerA)).toBeNull();
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*) n FROM partner_owner_binding_receipts WHERE run_id=$1`,
            [manifest.runId]
          )
        ).rows[0].n
      )
    ).toBe(0);
  });

  it('counts a colleague-inherited legacy user in connection parity and blocks APPLY on the exceptions (FIX-2)', async () => {
    // Self-contained seed/teardown: this partner org is deliberately left
    // unbound (blocked by exceptions, by design) for the duration of the
    // test, so it must not leak into the shared beforeAll/afterAll fixture
    // — sibling tests (e.g. the legacy-cutover-report bound/unbound counts
    // in the final test of this file) assert exact counts over that fixture.
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO organizations(id,name,status,is_active) VALUES($1,'Owner Parity','active',1)`,
        [orgParity]
      );
      for (const id of parityUserIds) {
        await client.query(
          `INSERT INTO users(id,email,role,status) VALUES($1,$2,'CONSULTANT','active')`,
          [id, `${id}@test.local`]
        );
      }
      // Connection-parity seed (FIX-2): one dedicated partner org,
      // created_by set to userWiazliwy so the created_by legacy branch is
      // exercised distinctly from the direct partner_users link.
      await client.query(
        `INSERT INTO partner_organizations
         (id,name,contact_email,status,referral_code,referral_link_slug,owner_organization_id,created_by)
         VALUES($1,$2,$3,'active',$4,$5,NULL,$6::uuid)`,
        [
          partnerParity,
          partnerParity,
          `${partnerParity}@test.local`,
          `CODE-${partnerParity}`,
          `slug-${partnerParity}`,
          userWiazliwy,
        ]
      );
      // zwiazany: direct active partner_users link.
      await client.query(
        `INSERT INTO partner_users(partner_org_id,user_id,role,status)
         VALUES($1::uuid,$2::uuid,'member','active')`,
        [partnerParity, userZwiazany]
      );
      // niewiazliwy: also a direct active partner_users link, but
      // deliberately given NO organization_members row in orgParity below.
      await client.query(
        `INSERT INTO partner_users(partner_org_id,user_id,role,status)
         VALUES($1::uuid,$2::uuid,'member','active')`,
        [partnerParity, userNiewiazliwy]
      );
      // ACTIVE membership in orgParity for zwiazany, wiazliwy (created_by)
      // and poKoledze (the colleague candidate) — niewiazliwy is
      // deliberately excluded from organization_members entirely.
      for (const userId of [userZwiazany, userWiazliwy, userPoKoledze]) {
        await client.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status)
           VALUES($1,$2,$3,'MEMBER','ACTIVE')`,
          [randomUUID(), orgParity, userId]
        );
      }

      const mapping = [{ partnerOrganizationId: partnerParity, ownerOrganizationId: orgParity }];

      const parity = await readConnectionParity(pool, mapping);

      // All four seeded users resolve under the legacy resolver — none of
      // them silently disappear, including the colleague-inherited one.
      expect(parity.legacyConnectedUsers).toBe(4);
      // Only the direct link (zwiazany) and the created_by link (wiazliwy)
      // carry an ACTIVE membership in the mapped owner org.
      expect(parity.strictEligibleUsers).toBe(2);
      // Nothing is bound yet (owner_organization_id is still NULL).
      expect(parity.strictConnectedUsers).toBe(0);
      expect(parity.exceptions).toHaveLength(2);
      expect(parity.exceptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: userNiewiazliwy,
            reason: 'ACTIVE_OWNER_MEMBERSHIP_MISSING',
          }),
          expect.objectContaining({
            userId: userPoKoledze,
            reason: 'COLLEAGUE_INHERITED',
          }),
        ])
      );

      // The exception set blocks APPLY end-to-end, dry-run included — a
      // colleague-inherited or membership-missing user is never silently
      // auto-connected by this script.
      const manifest = signedManifest({
        runId: `parity-${suffix}`,
        mappings: mapping,
      });
      await expect(executeManifest({ pool, manifest, key: KEY, write: false })).rejects.toThrow(
        /Connection parity exception/
      );
      await expect(executeManifest({ pool, manifest, key: KEY, write: false })).rejects.toThrow(
        /COLLEAGUE_INHERITED/
      );
      expect(await owner(partnerParity)).toBeNull();
    } finally {
      await client.query(`DELETE FROM partner_organizations WHERE id=$1::uuid`, [partnerParity]);
      await client.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [parityUserIds]);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [orgParity]);
      client.release();
    }
  });

  it('rejects tampering, expiry, duplicate targets and an unauthorized actor before writes', async () => {
    const mapping = [{ partnerOrganizationId: partnerA, ownerOrganizationId: orgA }];
    const tampered = signedManifest({
      runId: `tamper-${suffix}`,
      mappings: mapping,
    });
    tampered.mappings[0].ownerOrganizationId = orgB;
    await expect(
      executeManifest({ pool, manifest: tampered, key: KEY, write: true })
    ).rejects.toThrow(/signature verification failed/);
    const expired = signedManifest({
      runId: `expired-${suffix}`,
      mappings: mapping,
      expired: true,
    });
    await expect(
      executeManifest({ pool, manifest: expired, key: KEY, write: true })
    ).rejects.toThrow(/expired/);
    const duplicate = signedManifest({
      runId: `duplicate-${suffix}`,
      mappings: [...mapping, { partnerOrganizationId: partnerB, ownerOrganizationId: orgA }],
    });
    await expect(
      executeManifest({ pool, manifest: duplicate, key: KEY, write: true })
    ).rejects.toThrow(/Duplicate active owner tenant/);
    const unauthorized = signedManifest({
      runId: `unauthorized-${suffix}`,
      mappings: mapping,
      actorUserId: ordinaryId,
    });
    await expect(
      executeManifest({ pool, manifest: unauthorized, key: KEY, write: true })
    ).rejects.toThrow(/active SUPERADMIN/);
    expect(await owner(partnerA)).toBeNull();
  });

  it('rolls back every row and the receipt on an injected mid-batch failure', async () => {
    const manifest = signedManifest({
      runId: `fault-${suffix}`,
      mappings: [
        { partnerOrganizationId: partnerA, ownerOrganizationId: orgA },
        { partnerOrganizationId: partnerB, ownerOrganizationId: orgB },
      ],
    });
    await expect(
      executeManifest({
        pool,
        manifest,
        key: KEY,
        write: true,
        injectFailureAfter: 1,
      })
    ).rejects.toThrow(/Injected owner-binding failure/);
    expect([await owner(partnerA), await owner(partnerB)]).toEqual([null, null]);
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*) n FROM partner_owner_binding_receipts WHERE run_id=$1`,
            [manifest.runId]
          )
        ).rows[0].n
      )
    ).toBe(0);
  });

  it('applies atomically, cold-reads the receipt and replays without another effect', async () => {
    const manifest = signedManifest({
      runId: `apply-${suffix}`,
      mappings: [
        { partnerOrganizationId: partnerA, ownerOrganizationId: orgA },
        { partnerOrganizationId: partnerB, ownerOrganizationId: orgB },
      ],
    });
    appliedManifest = manifest;
    const created = await executeManifest({
      pool,
      manifest,
      key: KEY,
      write: true,
    });
    const replay = await executeManifest({
      pool,
      manifest,
      key: KEY,
      write: true,
    });
    expect(created.replay).toBe(false);
    expect(replay).toMatchObject({
      replay: true,
      resultSha256: created.resultSha256,
    });
    expect([await owner(partnerA), await owner(partnerB)]).toEqual([orgA, orgB]);
    const receipt = await pool.query(
      `SELECT operation,input_sha256,result_sha256,mapping_count,actor_user_id
         FROM partner_owner_binding_receipts WHERE run_id=$1`,
      [manifest.runId]
    );
    expect(receipt.rows).toEqual([
      expect.objectContaining({
        operation: 'APPLY',
        input_sha256: created.inputSha256,
        result_sha256: created.resultSha256,
        mapping_count: 2,
        actor_user_id: actorId,
      }),
    ]);
  });

  it('rejects collision and leaves an unrelated foreign tenant binding unchanged', async () => {
    const occupied = signedManifest({
      runId: `occupied-${suffix}`,
      mappings: [{ partnerOrganizationId: partnerC, ownerOrganizationId: foreignOrg }],
    });
    await expect(
      executeManifest({ pool, manifest: occupied, key: KEY, write: true })
    ).rejects.toThrow(/Owner tenant collision/);
    const colliding = signedManifest({
      runId: `apply-${suffix}`,
      mappings: [{ partnerOrganizationId: partnerC, ownerOrganizationId: orgA }],
    });
    await expect(
      executeManifest({ pool, manifest: colliding, key: KEY, write: true })
    ).rejects.toThrow(/Run id collision/);
    expect(await owner(partnerC)).toBeNull();
    expect(await owner(foreignPartner)).toBe(foreignOrg);
    await pool.query(`UPDATE partner_organizations SET owner_organization_id=NULL WHERE id=$1`, [
      partnerB,
    ]);
    try {
      await expect(
        executeManifest({
          pool,
          manifest: appliedManifest,
          key: KEY,
          write: true,
        })
      ).rejects.toThrow(/Receipt state drift/);
    } finally {
      await pool.query(`UPDATE partner_organizations SET owner_organization_id=$2 WHERE id=$1`, [
        partnerB,
        orgB,
      ]);
    }
  });

  it('serializes concurrent identical apply attempts into one effect and one receipt', async () => {
    const manifest = signedManifest({
      runId: `concurrent-${suffix}`,
      mappings: [{ partnerOrganizationId: partnerC, ownerOrganizationId: orgA }],
    });
    // orgA is occupied by partnerA, so first release that deliberately-owned row.
    await pool.query(`UPDATE partner_organizations SET status='inactive' WHERE id=$1`, [partnerA]);
    const results = await Promise.all([
      executeManifest({ pool, manifest, key: KEY, write: true }),
      executeManifest({ pool, manifest, key: KEY, write: true }),
    ]);
    expect(results.filter((result) => result.replay)).toHaveLength(1);
    expect(await owner(partnerC)).toBe(orgA);
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*) n FROM partner_owner_binding_receipts WHERE run_id=$1`,
            [manifest.runId]
          )
        ).rows[0].n
      )
    ).toBe(1);
  });

  it('rolls back only the exact signed apply receipt to NULL and records an immutable receipt', async () => {
    const applyRunId = `apply-${suffix}`;
    const rollback = signedManifest({
      runId: `rollback-${suffix}`,
      operation: 'ROLLBACK',
      applyRunId,
      mappings: [
        { partnerOrganizationId: partnerA, ownerOrganizationId: orgA },
        { partnerOrganizationId: partnerB, ownerOrganizationId: orgB },
      ],
    });
    await pool.query(`UPDATE organizations SET status='inactive',is_active=0 WHERE id=$1`, [orgB]);
    const result = await executeManifest({
      pool,
      manifest: rollback,
      key: KEY,
      write: true,
    });
    expect(result).toMatchObject({ operation: 'ROLLBACK', replay: false });
    expect([await owner(partnerA), await owner(partnerB)]).toEqual([null, null]);
    expect(await owner(partnerC)).toBe(orgA);
    expect(await owner(foreignPartner)).toBe(foreignOrg);
    await expect(
      pool.query(`UPDATE partner_owner_binding_receipts SET mapping_count=99 WHERE run_id=$1`, [
        rollback.runId,
      ])
    ).rejects.toThrow(/append-only/);
    await expect(
      pool.query(`DELETE FROM partner_owner_binding_receipts WHERE run_id=$1`, [rollback.runId])
    ).rejects.toThrow(/append-only/);

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'prt-owner-binding-report-'));
    execFileSync(path.resolve('node_modules/.bin/tsx'), [
      'server/scripts/legacy-cutover-report.ts',
      '--database-url',
      DATABASE_URL!,
      '--out',
      out,
    ]);
    const generated = JSON.parse(
      fs.readFileSync(path.join(out, 'ZERO_WRITER_PARITY_REPORT.json'), 'utf8')
    );
    expect(generated.telemetryWindowRead).toBe(true);
    expect(generated.partnerBinding).toMatchObject({
      receiptTablePresent: true,
      activeBound: 2,
      activeUnbound: 1,
    });
    expect(generated.partnerBinding.receipts).toHaveLength(3);
    const markdown = fs.readFileSync(path.join(out, 'ZERO_WRITER_PARITY_REPORT.md'), 'utf8');
    expect(markdown).toContain(`| ${rollback.runId} | ROLLBACK | ${applyRunId} |`);

    await pool.query(`UPDATE partner_organizations SET owner_organization_id=NULL WHERE id=$1`, [
      partnerC,
    ]);
    try {
      expect(() =>
        execFileSync(path.resolve('node_modules/.bin/tsx'), [
          'server/scripts/legacy-cutover-report.ts',
          '--database-url',
          DATABASE_URL!,
          '--out',
          out,
        ])
      ).toThrow();
    } finally {
      await pool.query(`UPDATE partner_organizations SET owner_organization_id=$2 WHERE id=$1`, [
        partnerC,
        orgA,
      ]);
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
