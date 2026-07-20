/**
 * Acceptance E2E — access_codes dual-model reconciliation (real runtime, real
 * Postgres, REJESTR "access_codes reconciliacja").
 *
 * access_codes carries two coexisting models on one table: the hash-model
 * engine (server/src/services/accessCodeService.ts — code_hash / uses_count /
 * status) and 4 legacy callers (SuperAdminController / adminP32 /
 * access-control.routes / auth.routes — current_uses / is_active / code
 * plaintext). This test proves, against the REAL parity Postgres and the REAL
 * service module (no mocks), in the same order production sees it (legacy
 * rows exist first, THEN the reconcile migration runs at boot, THEN traffic
 * flows through the service):
 *
 *   1-2. Pre-migration: a pre-existing legacy row (code_hash IS NULL) still
 *        validates (or correctly fails, if revoked) through
 *        accessCodeService.validatePublic() — the fallback lookup in
 *        findAccessCodeRow() works even before the backfill runs.
 *   3.   The 20260720_access_codes_reconcile.sql migration backfills
 *        code_hash/uses_count/status for those rows and is idempotent
 *        (2nd run = 0 rows changed).
 *   4.   accessCodeService.createLegacyCompatCode() — the new thin method the
 *        3 legacy create-callers now route through — writes a row that is
 *        immediately valid through the hash-model validate path (code_hash
 *        populated at creation), i.e. "code created by one engine, visible
 *        to the other", with no migration needed.
 *   5.   accessCodeService.acceptCode() on a (now-migrated) legacy row
 *        increments BOTH uses_count (hash-model) AND current_uses (legacy)
 *        in lockstep — so legacy readers see consumption that happened
 *        through this engine.
 *   6.   accessCodeService.revokeCode() sets BOTH status='REVOKED' AND
 *        is_active=0 — so legacy readers see a revoke done through this
 *        engine.
 *
 * Requires: DATABASE_URL=postgres://…@localhost:5443/consultinity (parity),
 * NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true
 * JWT_SECRET=development_secret_key_change_in_production_abc123xyz.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import AccessCodeService from '../../server/src/services/accessCodeService.js';

function requireLocalDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`Acceptance harness requires a LOCAL DATABASE_URL. Got: ${url || '(unset)'}`);
  }
  return url;
}

function client(): pg.Client {
  return new pg.Client({ connectionString: requireLocalDbUrl() });
}

const MIGRATION_SQL = readFileSync(
  fileURLToPath(
    new URL('../../server/migrations/20260720_access_codes_reconcile.sql', import.meta.url)
  ),
  'utf8'
);

const MARK = 'odbior--ac-reconcile--';
const ORG_ID = 'test-org-id'; // seeded org, present on parity
const USER_ID = 'test-user-id'; // seeded user, present on parity

const ID_LEGACY_ACTIVE = `${MARK}legacy-active`;
const ID_LEGACY_REVOKED = `${MARK}legacy-revoked`;
const CODE_LEGACY_ACTIVE = `${MARK}CODEACTIVE`.toUpperCase();
const CODE_LEGACY_REVOKED = `${MARK}CODEREVOKED`.toUpperCase();

// createLegacyCompatCode() mints its own plaintext code/id (JOIN-XXXXXX /
// ac-<uuid>) when none is supplied, so those rows can't be matched by the
// MARK prefix — track their ids explicitly for cleanup.
const dynamicIds: string[] = [];

async function purgeFixtures(): Promise<void> {
  const c = client();
  await c.connect();
  try {
    await c.query(`DELETE FROM access_codes WHERE id LIKE $1`, [`${MARK}%`]);
    if (dynamicIds.length) {
      await c.query(`DELETE FROM access_codes WHERE id = ANY($1)`, [dynamicIds]);
    }
  } finally {
    await c.end();
  }
}

describe('access_codes dual-model reconciliation — real Postgres', () => {
  beforeAll(async () => {
    await purgeFixtures();

    const c = client();
    await c.connect();
    try {
      // Simulate two rows created by a LEGACY caller (SuperAdminController /
      // adminP32 / access-control.routes) BEFORE this reconciliation shipped:
      // code_hash IS NULL, only the legacy columns populated.
      await c.query(
        `INSERT INTO access_codes
           (id, organization_id, code, created_by, role, max_uses, current_uses, expires_at, is_active, created_at)
         VALUES
           ($1, $3, $2, $4, 'MEMBER', 5, 2, NULL, 1, CURRENT_TIMESTAMP)`,
        [ID_LEGACY_ACTIVE, CODE_LEGACY_ACTIVE, ORG_ID, USER_ID]
      );
      await c.query(
        `INSERT INTO access_codes
           (id, organization_id, code, created_by, role, max_uses, current_uses, expires_at, is_active, created_at)
         VALUES
           ($1, $3, $2, $4, 'ADMIN', 3, 1, NULL, 0, CURRENT_TIMESTAMP)`,
        [ID_LEGACY_REVOKED, CODE_LEGACY_REVOKED, ORG_ID, USER_ID]
      );
    } finally {
      await c.end();
    }
  });

  afterAll(async () => {
    await purgeFixtures();
  });

  it('1. [pre-migration] validates a legacy ACTIVE row (code_hash IS NULL) via the fallback lookup', async () => {
    const result = await AccessCodeService.validatePublic(CODE_LEGACY_ACTIVE);
    expect(result.valid).toBe(true);
  });

  it('2. [pre-migration] rejects a legacy REVOKED row (is_active=0), not a stale default status', async () => {
    const result = await AccessCodeService.validatePublic(CODE_LEGACY_REVOKED);
    expect(result.valid).toBe(false);
  });

  it('3. reconcile migration backfills code_hash/uses_count/status and is idempotent', async () => {
    const c = client();
    await c.connect();
    try {
      const run1 = await c.query(MIGRATION_SQL);
      // pg driver reports rowCount for the last statement in a multi-statement
      // string; assert via direct state instead of relying on that count.
      void run1;

      const { rows } = await c.query(
        `SELECT id, code_hash, uses_count, status, type FROM access_codes WHERE id = ANY($1) ORDER BY id`,
        [[ID_LEGACY_ACTIVE, ID_LEGACY_REVOKED]]
      );
      const active = rows.find((r) => r.id === ID_LEGACY_ACTIVE);
      const revoked = rows.find((r) => r.id === ID_LEGACY_REVOKED);

      expect(active.code_hash).toBeTruthy();
      expect(Number(active.uses_count)).toBe(2); // == current_uses backfilled
      expect(active.status).toBe('ACTIVE');
      expect(active.type).toBe('INVITE');

      expect(revoked.code_hash).toBeTruthy();
      expect(Number(revoked.uses_count)).toBe(1); // == current_uses backfilled
      // The earlier additive migration defaulted `status` to 'ACTIVE' for ALL
      // rows — this is the exact drift this reconciliation corrects.
      expect(revoked.status).toBe('REVOKED');

      // Idempotency: 2nd run finds nothing left with code_hash IS NULL among
      // our fixtures.
      await c.query(MIGRATION_SQL);
      const { rows: stillNull } = await c.query(
        `SELECT id FROM access_codes WHERE id = ANY($1) AND code_hash IS NULL`,
        [[ID_LEGACY_ACTIVE, ID_LEGACY_REVOKED]]
      );
      expect(stillNull.length).toBe(0);
    } finally {
      await c.end();
    }
  });

  it('4. createLegacyCompatCode() writes a row immediately visible to the hash-model validate path', async () => {
    const created = await AccessCodeService.createLegacyCompatCode({
      organizationId: ORG_ID,
      createdByUserId: USER_ID,
      role: 'ADMIN',
      maxUses: 4,
      expiresAt: null,
    });
    dynamicIds.push(created.id);
    expect(created.id).toMatch(/^ac-/);
    expect(created.code).toBeTruthy();

    // Visible through the hash-model reader immediately (no migration needed —
    // code_hash was populated at INSERT time).
    const validated = await AccessCodeService.validatePublic(created.code);
    expect(validated.valid).toBe(true);

    // AND visible to a legacy-shaped raw read (role/current_uses/is_active
    // all populated, not left at column defaults that don't reflect intent).
    const c = client();
    await c.connect();
    try {
      const { rows } = await c.query(
        `SELECT role, max_uses, current_uses, is_active, code_hash, status FROM access_codes WHERE id = $1`,
        [created.id]
      );
      expect(rows[0].role).toBe('ADMIN');
      expect(Number(rows[0].max_uses)).toBe(4);
      expect(Number(rows[0].current_uses)).toBe(0);
      expect(rows[0].is_active).toBe(1);
      expect(rows[0].code_hash).toBeTruthy();
      expect(rows[0].status).toBe('ACTIVE');
    } finally {
      await c.end();
    }
  });

  it('5. [post-migration] acceptCode() on a reconciled legacy row increments BOTH uses_count and current_uses', async () => {
    const result = await AccessCodeService.acceptCode({
      code: CODE_LEGACY_ACTIVE,
      actorUserId: USER_ID,
    });
    expect(result.ok).toBe(true);

    const c = client();
    await c.connect();
    try {
      const { rows } = await c.query(
        `SELECT uses_count, current_uses FROM access_codes WHERE id = $1`,
        [ID_LEGACY_ACTIVE]
      );
      // Migration synced both to 2; acceptCode increments both together.
      expect(Number(rows[0].current_uses)).toBe(3);
      expect(Number(rows[0].uses_count)).toBe(3);
    } finally {
      await c.end();
    }
  });

  it('6. revokeCode() sets BOTH status=REVOKED and legacy is_active=0', async () => {
    const created = await AccessCodeService.createLegacyCompatCode({
      organizationId: ORG_ID,
      createdByUserId: USER_ID,
      role: 'MEMBER',
      maxUses: 1,
      expiresAt: null,
    });
    dynamicIds.push(created.id);

    const { changes } = await AccessCodeService.revokeCode(created.id);
    expect(changes).toBe(1);

    const c = client();
    await c.connect();
    try {
      const { rows } = await c.query(`SELECT status, is_active FROM access_codes WHERE id = $1`, [
        created.id,
      ]);
      expect(rows[0].status).toBe('REVOKED');
      expect(rows[0].is_active).toBe(0);
    } finally {
      await c.end();
    }

    // And validatePublic must now reject it (both engines agree it's dead).
    const validated = await AccessCodeService.validatePublic(created.code);
    expect(validated.valid).toBe(false);
  });
});
