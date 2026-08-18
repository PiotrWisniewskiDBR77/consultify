/**
 * AMD-FLOW-ROI-VISIBILITY-002 — governed ROI visibility policy, against a
 * REAL Postgres.
 *
 * Owner decision (docs/cleanup/agents/OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md
 * row 42): ROI visibility is restricted to same-tenant OWNER, ADMIN and
 * users holding the canonical Finance authority/grant; OPEN_ORG is not an
 * approved production policy.
 *
 * Tests, against a real database, exactly the new
 * `server/src/services/resultsVnext/platform/visibilityResolver.ts` surface
 * introduced by this packet: `publishRoiGovernedVisibilityPolicy`,
 * `resolveRoiGovernedVisibility`, and the migration
 * `20261020_roi_governed_visibility_policy.sql` (append-only trigger,
 * idempotent-receipt/version/collision semantics).
 *
 * NEVER hard-deletes its test organization. `rvn_roi_visibility_governance`
 * (this migration) and `rvn_finance_reconciliation_grant_events` (ROI-E007,
 * reused unmodified here) are both append-only — a `BEFORE DELETE` trigger
 * rejects any DELETE, and per this codebase's own hard-won lesson, a
 * `DELETE FROM organizations` for an org with such a row fails on the
 * child's FK, full stop, with no workaround short of dropping the whole
 * database. `afterAll` below measures that exact, permanent, BY-DESIGN
 * residue rather than asserting a zero it cannot reach — never writing a
 * zero it did not measure.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-gov20-org-${tag}`;
const FOREIGN_ORG_ID = `roi-gov20-foreign-org-${tag}`;
const USER_OWNER = `roi-gov20-owner-${tag}`;
const USER_ADMIN = `roi-gov20-admin-${tag}`;
const USER_MEMBER = `roi-gov20-member-${tag}`;
const USER_REVOKED = `roi-gov20-revoked-${tag}`;
const USER_GHOST = `roi-gov20-ghost-${tag}`; // never a member of ORG_ID at all — the
// SUPERADMIN-without-membership equivalent for this gate: see the dedicated
// test below for why this is the right analog without touching
// effectiveAccessService.ts.
const RACE_ADMINS = Array.from({ length: 7 }, (_, i) => `roi-gov20-race-admin-${i}-${tag}`);

type VisibilityResolverModule =
  typeof import('../../../../services/resultsVnext/platform/visibilityResolver.js');

let publishRoiGovernedVisibilityPolicy: VisibilityResolverModule['publishRoiGovernedVisibilityPolicy'];
let resolveRoiGovernedVisibility: VisibilityResolverModule['resolveRoiGovernedVisibility'];
let hasActiveRoiFinanceAuthorityGrant: VisibilityResolverModule['hasActiveRoiFinanceAuthorityGrant'];
let ROI_GOVERNED_VISIBILITY_POLICY: VisibilityResolverModule['ROI_GOVERNED_VISIBILITY_POLICY'];
let ROI_FINANCE_AUTHORITY_CAPABILITY: VisibilityResolverModule['ROI_FINANCE_AUTHORITY_CAPABILITY'];
let RoiGovernedVisibilityPolicyMismatchError: VisibilityResolverModule['RoiGovernedVisibilityPolicyMismatchError'];
let RoiVisibilityGovernanceActorNotAuthorizedError: VisibilityResolverModule['RoiVisibilityGovernanceActorNotAuthorizedError'];
let RoiGovernedVisibilityPolicyCollisionError: VisibilityResolverModule['RoiGovernedVisibilityPolicyCollisionError'];

let client: Client;
let reachable = false;

async function insertUserAndMembership(userId: string, organizationId: string, role: string, status = 'ACTIVE'): Promise<void> {
  await client.query(
    `INSERT INTO users (id, email, organization_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@roi-gov20.local`, organizationId]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
    [`${userId}-membership`, organizationId, userId, role, status]
  );
}

describe('AMD-FLOW-ROI-VISIBILITY-002 governed ROI visibility (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — roiGovernedVisibility20 realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_visibility_governance LIMIT 0');
      await client.query('SELECT 1 FROM rvn_finance_reconciliation_grant_events LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable, or is missing 20261020_roi_governed_visibility_policy.sql / ' +
          '20260928_fin_results_reconciliation_decision.sql; refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const mod: VisibilityResolverModule = await import(
      '../../../../services/resultsVnext/platform/visibilityResolver.js'
    );
    publishRoiGovernedVisibilityPolicy = mod.publishRoiGovernedVisibilityPolicy;
    resolveRoiGovernedVisibility = mod.resolveRoiGovernedVisibility;
    hasActiveRoiFinanceAuthorityGrant = mod.hasActiveRoiFinanceAuthorityGrant;
    ROI_GOVERNED_VISIBILITY_POLICY = mod.ROI_GOVERNED_VISIBILITY_POLICY;
    ROI_FINANCE_AUTHORITY_CAPABILITY = mod.ROI_FINANCE_AUTHORITY_CAPABILITY;
    RoiGovernedVisibilityPolicyMismatchError = mod.RoiGovernedVisibilityPolicyMismatchError;
    RoiVisibilityGovernanceActorNotAuthorizedError = mod.RoiVisibilityGovernanceActorNotAuthorizedError;
    RoiGovernedVisibilityPolicyCollisionError = mod.RoiGovernedVisibilityPolicyCollisionError;

    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'ROI-GOV20 RealDB Org', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID]
    );
    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'ROI-GOV20 Foreign RealDB Org', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID]
    );
    await insertUserAndMembership(USER_OWNER, ORG_ID, 'OWNER');
    await insertUserAndMembership(USER_ADMIN, ORG_ID, 'ADMIN');
    await insertUserAndMembership(USER_MEMBER, ORG_ID, 'MEMBER');
    await insertUserAndMembership(USER_REVOKED, ORG_ID, 'ADMIN', 'REVOKED');
    for (const admin of RACE_ADMINS) {
      await insertUserAndMembership(admin, ORG_ID, 'ADMIN');
    }
    // USER_GHOST deliberately gets NO organization_members row anywhere —
    // the fixture for "a token with no membership row for this org", the
    // same structural shape a SUPERADMIN-without-membership token has here
    // (see the dedicated test below).
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;

    // Deletable children — no append-only trigger on any of these.
    await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
      [ORG_ID, FOREIGN_ORG_ID],
    ]);
    await client.query(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [[ORG_ID, FOREIGN_ORG_ID]]);

    // NOT deleted, on purpose: rvn_roi_visibility_governance and
    // rvn_finance_reconciliation_grant_events rows for ORG_ID — both
    // append-only (BEFORE DELETE triggers reject it), and consequently
    // `organizations` for ORG_ID can never be hard-deleted either (its own
    // DELETE would fail on the child FK the instant a governed-visibility
    // or finance-grant row exists for it). This is the exact, permanent,
    // BY-DESIGN residue this migration's header comment predicts — measured
    // below, never assumed to be zero.
    const residue = await client.query<{
      governance_rows: string;
      finance_grant_rows: string;
      organizations_rows: string;
    }>(
      `SELECT
         (SELECT count(*)::text FROM rvn_roi_visibility_governance WHERE organization_id = $1) governance_rows,
         (SELECT count(*)::text FROM rvn_finance_reconciliation_grant_events WHERE organization_id = $1) finance_grant_rows,
         (SELECT count(*)::text FROM organizations WHERE id = ANY($2::text[])) organizations_rows`,
      [ORG_ID, [ORG_ID, FOREIGN_ORG_ID]]
    );
    // eslint-disable-next-line no-console
    console.warn(
      '[roiGovernedVisibility20] measured permanent-by-design residue (append-only, never reachable-zero without ' +
        'dropping the database):',
      residue.rows[0]
    );
    expect(residue.rows[0].governance_rows).toBe('1'); // exactly the one org-level publish below
    expect(Number(residue.rows[0].finance_grant_rows)).toBeGreaterThanOrEqual(2); // grant + revoke events
    expect(residue.rows[0].organizations_rows).toBe('2'); // both orgs — cannot be deleted, measured not assumed

    const advisory = await client.query<{ count: string }>(
      `SELECT count(*)::text FROM pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()`
    );
    expect(advisory.rows[0].count).toBe('0');

    const triggers = await client.query<{ tgname: string; tgenabled: string }>(
      `SELECT tgname, tgenabled FROM pg_trigger
        WHERE tgrelid = 'rvn_roi_visibility_governance'::regclass AND NOT tgisinternal`
    );
    expect(triggers.rows).toEqual([
      { tgname: 'trg_rvn_roi_visibility_governance_append_only', tgenabled: 'O' },
    ]);

    await client.end();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB('migration is idempotent on repeat application (repeat 0: no error, no duplicate side effects)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20261020_roi_governed_visibility_policy.sql'),
      'utf8'
    );
    await client.query(sql);
    await client.query(sql);
    const table = await client.query<{ tbl: string }>(`SELECT to_regclass('rvn_roi_visibility_governance') AS tbl`);
    expect(table.rows[0].tbl).toBe('rvn_roi_visibility_governance');
  });

  itDB('resolves DENY with NO_GOVERNED_POLICY before any org has published — never falls back to a default', async () => {
    const result = await resolveRoiGovernedVisibility({ userId: USER_OWNER, organizationId: ORG_ID });
    expect(result).toEqual({ allow: false, reason: 'NO_GOVERNED_POLICY' });
  });

  itDB('FAILS BEFORE MUTATION on a wrong policyKey — zero rows written', async () => {
    await expect(
      publishRoiGovernedVisibilityPolicy({
        organizationId: ORG_ID,
        actorUserId: USER_OWNER,
        policyKey: 'WRONG_POLICY_KEY',
        policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
        idempotencyKey: `gov20-wrong-key-${randomUUID()}`,
      })
    ).rejects.toBeInstanceOf(RoiGovernedVisibilityPolicyMismatchError);
    const rows = await client.query(`SELECT 1 FROM rvn_roi_visibility_governance WHERE organization_id = $1`, [ORG_ID]);
    expect(rows.rowCount).toBe(0);
  });

  itDB('FAILS BEFORE MUTATION on a partial/superset digest — zero rows written', async () => {
    await expect(
      publishRoiGovernedVisibilityPolicy({
        organizationId: ORG_ID,
        actorUserId: USER_OWNER,
        policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
        policyDigest: `${ROI_GOVERNED_VISIBILITY_POLICY.digest}-superset-or-true`,
        idempotencyKey: `gov20-wrong-digest-${randomUUID()}`,
      })
    ).rejects.toBeInstanceOf(RoiGovernedVisibilityPolicyMismatchError);
    const rows = await client.query(`SELECT 1 FROM rvn_roi_visibility_governance WHERE organization_id = $1`, [ORG_ID]);
    expect(rows.rowCount).toBe(0);
  });

  itDB('denies an ordinary member attempting to publish — zero rows written', async () => {
    await expect(
      publishRoiGovernedVisibilityPolicy({
        organizationId: ORG_ID,
        actorUserId: USER_MEMBER,
        policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
        policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
        idempotencyKey: `gov20-member-attempt-${randomUUID()}`,
      })
    ).rejects.toBeInstanceOf(RoiVisibilityGovernanceActorNotAuthorizedError);
    const rows = await client.query(`SELECT 1 FROM rvn_roi_visibility_governance WHERE organization_id = $1`, [ORG_ID]);
    expect(rows.rowCount).toBe(0);
  });

  itDB('denies a revoked (non-ACTIVE) former ADMIN attempting to publish — zero rows written', async () => {
    await expect(
      publishRoiGovernedVisibilityPolicy({
        organizationId: ORG_ID,
        actorUserId: USER_REVOKED,
        policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
        policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
        idempotencyKey: `gov20-revoked-attempt-${randomUUID()}`,
      })
    ).rejects.toBeInstanceOf(RoiVisibilityGovernanceActorNotAuthorizedError);
    const rows = await client.query(`SELECT 1 FROM rvn_roi_visibility_governance WHERE organization_id = $1`, [ORG_ID]);
    expect(rows.rowCount).toBe(0);
  });

  itDB('denies an ADMIN of a DIFFERENT org attempting to publish for this org (foreign tenant) — zero rows written', async () => {
    await insertUserAndMembership(`${USER_ADMIN}-foreign`, FOREIGN_ORG_ID, 'ADMIN');
    await expect(
      publishRoiGovernedVisibilityPolicy({
        organizationId: ORG_ID,
        actorUserId: `${USER_ADMIN}-foreign`,
        policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
        policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
        idempotencyKey: `gov20-foreign-attempt-${randomUUID()}`,
      })
    ).rejects.toBeInstanceOf(RoiVisibilityGovernanceActorNotAuthorizedError);
    const rows = await client.query(`SELECT 1 FROM rvn_roi_visibility_governance WHERE organization_id = $1`, [ORG_ID]);
    expect(rows.rowCount).toBe(0);
  });

  itDB(
    '8-way concurrency, SAME actor AND SAME idempotency key (a true client retry storm): exactly one applied, ' +
      'the other seven replayed with zero additional writes — and the org-level publish that survives every ' +
      'other negative test above',
    async () => {
      // CORRECTED (Variant B idempotency redesign): all 8 calls share ONE
      // idempotencyKey now, not 8 distinct ones. Under the fingerprint-based
      // replay contract (organization + idempotency key + the pinned policy
      // fingerprint), a replay requires an EXACT match on the idempotency
      // key too — 8 distinct keys from the same actor would now each
      // legitimately collide (see the next test), not replay. This test's
      // OWN name says "SAME actor" — the realistic scenario that name
      // describes is a client retrying the SAME logical request, which
      // means the SAME idempotency key, not a fresh one per attempt.
      const sharedIdempotencyKey = `gov20-owner-race-${randomUUID()}`;
      const attempts = Array.from({ length: 8 }, () =>
        publishRoiGovernedVisibilityPolicy({
          organizationId: ORG_ID,
          actorUserId: USER_OWNER,
          policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
          policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
          idempotencyKey: sharedIdempotencyKey,
        })
      );
      const results = await Promise.all(attempts);
      const applied = results.filter((r) => r.outcome === 'applied');
      const replayed = results.filter((r) => r.outcome === 'replayed');
      expect(applied.length).toBe(1);
      expect(replayed.length).toBe(7);
      const rows = await client.query(`SELECT count(*)::text AS c FROM rvn_roi_visibility_governance WHERE organization_id = $1`, [ORG_ID]);
      expect(rows.rows[0].c).toBe('1');
    }
  );

  itDB(
    'NEW property (Variant B): the SAME actor reusing a FRESH idempotency key, once the org is already ' +
      'published, COLLIDES rather than replays — this is the "altered identity OR altered payload" contract, ' +
      'not merely "different actor"; the weaker, superseded version of this function treated any retry from the ' +
      'recorded actor as a benign replay regardless of idempotencyKey',
    async () => {
      await expect(
        publishRoiGovernedVisibilityPolicy({
          organizationId: ORG_ID,
          actorUserId: USER_OWNER,
          policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
          policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
          idempotencyKey: `gov20-owner-fresh-key-${randomUUID()}`,
        })
      ).rejects.toBeInstanceOf(RoiGovernedVisibilityPolicyCollisionError);
      const rows = await client.query(`SELECT count(*)::text AS c FROM rvn_roi_visibility_governance WHERE organization_id = $1`, [ORG_ID]);
      expect(rows.rows[0].c).toBe('1');
    }
  );

  itDB(
    '8-way concurrency, DIFFERENT actors racing AFTER the org is already published: every one of the 8 collides — ' +
      'zero winners, zero additional writes, table still has exactly one row',
    async () => {
      const attempts = RACE_ADMINS.map((admin, i) =>
        publishRoiGovernedVisibilityPolicy({
          organizationId: ORG_ID,
          actorUserId: admin,
          policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
          policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
          idempotencyKey: `gov20-collide-${i}-${randomUUID()}`,
        }).then(
          () => ({ ok: true }),
          (err) => ({ ok: false, err })
        )
      );
      const results = await Promise.all(attempts);
      expect(results.every((r) => r.ok === false)).toBe(true);
      for (const r of results) {
        if (!r.ok) expect((r as { err: unknown }).err).toBeInstanceOf(RoiGovernedVisibilityPolicyCollisionError);
      }
      const rows = await client.query(`SELECT count(*)::text AS c, min(published_by) AS pub FROM rvn_roi_visibility_governance WHERE organization_id = $1`, [ORG_ID]);
      expect(rows.rows[0].c).toBe('1');
      expect(rows.rows[0].pub).toBe(USER_OWNER);
    }
  );

  itDB('append-only trigger rejects a direct UPDATE and a direct DELETE on the published row', async () => {
    await expect(
      client.query(`UPDATE rvn_roi_visibility_governance SET published_by = 'tampered' WHERE organization_id = $1`, [ORG_ID])
    ).rejects.toThrow(/append-only/);
    await expect(
      client.query(`DELETE FROM rvn_roi_visibility_governance WHERE organization_id = $1`, [ORG_ID])
    ).rejects.toThrow(/append-only/);
  });

  itDB('cold readback: a BRAND NEW pg.Client (never touched by any write above) sees the published row', async () => {
    const cold = new Client(buildClientConfig() as ClientConfig);
    await cold.connect();
    try {
      const row = await cold.query<{ organization_id: string; published_by: string; policy_key: string }>(
        `SELECT organization_id, published_by, policy_key FROM rvn_roi_visibility_governance WHERE organization_id = $1`,
        [ORG_ID]
      );
      expect(row.rows[0]).toEqual({
        organization_id: ORG_ID,
        published_by: USER_OWNER,
        policy_key: ROI_GOVERNED_VISIBILITY_POLICY.key,
      });
    } finally {
      await cold.end();
    }
  });

  itDB('resolver ALLOWs the publishing OWNER and a same-tenant ACTIVE ADMIN, once the policy is published', async () => {
    const owner = await resolveRoiGovernedVisibility({ userId: USER_OWNER, organizationId: ORG_ID });
    expect(owner).toEqual({ allow: true, reason: 'OWNER' });
    const admin = await resolveRoiGovernedVisibility({ userId: USER_ADMIN, organizationId: ORG_ID });
    expect(admin).toEqual({ allow: true, reason: 'ADMIN' });
  });

  itDB('resolver DENIES an ordinary member with no Finance-authority grant', async () => {
    const result = await resolveRoiGovernedVisibility({ userId: USER_MEMBER, organizationId: ORG_ID });
    expect(result).toEqual({ allow: false, reason: 'ORDINARY_MEMBER_DENIED' });
  });

  itDB('resolver DENIES a revoked (non-ACTIVE) member', async () => {
    const result = await resolveRoiGovernedVisibility({ userId: USER_REVOKED, organizationId: ORG_ID });
    expect(result).toEqual({ allow: false, reason: 'NOT_ACTIVE_MEMBER' });
  });

  itDB('resolver DENIES a foreign-tenant caller with no membership row in this org — zero existence leakage', async () => {
    const foreignAdminId = `${USER_ADMIN}-foreign`;
    const result = await resolveRoiGovernedVisibility({ userId: foreignAdminId, organizationId: ORG_ID });
    expect(result).toEqual({ allow: false, reason: 'NOT_ACTIVE_MEMBER' });
  });

  itDB(
    'resolver DENIES a token with NO organization_members row at all for this org — the SUPERADMIN-without-' +
      'membership equivalent at THIS gate. Both are true at once, on purpose: this gate denies USER_GHOST here; ' +
      "owner decision 15A (effectiveAccessService.ts) separately and UNCHANGED still grants a real SUPERADMIN " +
      'token org-level OWNER + \'*\' globally, everywhere hasEffectiveCapability/resolveEffectiveAccess ARE ' +
      'consulted — this gate simply never consults them (structural proof below).',
    async () => {
      const result = await resolveRoiGovernedVisibility({ userId: USER_GHOST, organizationId: ORG_ID });
      expect(result).toEqual({ allow: false, reason: 'NOT_ACTIVE_MEMBER' });
    }
  );

  itDB(
    'resolver DENIES on the foreign organization entirely — that org never published a governed policy of its own',
    async () => {
      const result = await resolveRoiGovernedVisibility({ userId: `${USER_ADMIN}-foreign`, organizationId: FOREIGN_ORG_ID });
      expect(result).toEqual({ allow: false, reason: 'NO_GOVERNED_POLICY' });
    }
  );

  itDB(
    'structural guard: the AMD-FLOW-ROI-VISIBILITY-002 section of visibilityResolver.ts never references ' +
      "hasEffectiveCapability, resolveEffectiveAccess, or effectiveAccessService.js — a durable regression guard " +
      "against ever reintroducing the '*' wildcard into this narrower gate",
    async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const source = fs.readFileSync(
        path.resolve(process.cwd(), 'server/src/services/resultsVnext/platform/visibilityResolver.ts'),
        'utf8'
      );
      const marker = '// AMD-FLOW-ROI-VISIBILITY-002 — governed ROI visibility policy';
      const sectionStart = source.indexOf(marker);
      expect(sectionStart).toBeGreaterThan(-1);
      const section = source.slice(sectionStart);
      // Strip comments first: the section's OWN doc comments deliberately
      // mention `hasEffectiveCapability(access, '*')` BY NAME to explain why
      // it is NOT consulted here — a naive substring search over raw source
      // would always "find" that explanatory prose. Only CODE (import
      // statements, actual calls) proves the real guarantee.
      const codeOnly = section
        .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
        .replace(/\/\/.*$/gm, ''); // line comments
      expect(codeOnly).not.toContain('hasEffectiveCapability');
      expect(codeOnly).not.toContain('resolveEffectiveAccess(');
      expect(codeOnly).not.toContain("effectiveAccessService.js'");
    }
  );

  itDB(
    'Finance-authority grant (rvn_finance_reconciliation_grant_events, REUSED UNMODIFIED — no new capability, no ' +
      "ALTER): granting allows the ordinary member; revoking denies on the VERY NEXT resolve call, no caching",
    async () => {
      const before = await resolveRoiGovernedVisibility({ userId: USER_MEMBER, organizationId: ORG_ID });
      expect(before).toEqual({ allow: false, reason: 'ORDINARY_MEMBER_DENIED' });

      await client.query(
        `INSERT INTO rvn_finance_reconciliation_grant_events
           (organization_id, user_id, capability, grant_version, action, acted_by, policy_version, policy_digest)
         VALUES ($1,$2,$3,1,'granted',$4,'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
                 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d')`,
        [ORG_ID, USER_MEMBER, ROI_FINANCE_AUTHORITY_CAPABILITY, USER_OWNER]
      );
      const directCheck = await hasActiveRoiFinanceAuthorityGrant(client, ORG_ID, USER_MEMBER);
      expect(directCheck).toBe(true);

      const afterGrant = await resolveRoiGovernedVisibility({ userId: USER_MEMBER, organizationId: ORG_ID });
      expect(afterGrant).toEqual({ allow: true, reason: 'FINANCE_AUTHORITY_GRANT' });

      await client.query(
        `INSERT INTO rvn_finance_reconciliation_grant_events
           (organization_id, user_id, capability, grant_version, action, acted_by, policy_version, policy_digest)
         VALUES ($1,$2,$3,2,'revoked',$4,'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
                 'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d')`,
        [ORG_ID, USER_MEMBER, ROI_FINANCE_AUTHORITY_CAPABILITY, USER_OWNER]
      );
      const afterRevoke = await resolveRoiGovernedVisibility({ userId: USER_MEMBER, organizationId: ORG_ID });
      expect(afterRevoke).toEqual({ allow: false, reason: 'ORDINARY_MEMBER_DENIED' });
    }
  );
});
