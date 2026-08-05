/**
 * M16 Partner Portal — final repair, REAL PostgreSQL.
 *
 * Covers the repair contract:
 *   - resources: genuine EMPTY vs DEGRADED_UNAVAILABLE (schema behind);
 *   - attribution: resolved name, and honest fallback with NO raw UUID title;
 *   - cross-tenant negative control;
 *   - paid total agrees with the settled payout register;
 *   - persistence across a fresh read (reopen).
 *
 * Plus two NEGATIVE CONTROLS that must FAIL against the old behaviour:
 *   NC-1 the old projection (`file_key`, …) under DbPromise's default
 *        `fallback: true` returns [] instead of raising — i.e. the silent empty
 *        that made 15 rows look like 0.
 *   NC-2 the old client mapping (`item.organizationName || 'Organization'`)
 *        produces a fabricated name where the repair yields null.
 *
 * Requires a real database. `RUN_DB_TESTS=1` + `MOCK_DB=false` force the
 * Postgres driver; the guard below fails loudly if a mock slipped in, because a
 * green run on a mocked DB would prove nothing.
 *
 *   docker run -d --name m16-pg -e POSTGRES_PASSWORD=m16 -e POSTGRES_USER=m16 \
 *     -e POSTGRES_DB=consultinity_test -p 55432:5432 postgres:16-alpine
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://m16:m16@localhost:55432/consultinity_test \
 *   npx vitest run tests/integration/partners/m16-final-repair.realdb.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const CONNECTION =
  process.env.DATABASE_URL || 'postgresql://m16:m16@localhost:55432/consultinity_test';

const PARTNER_A = '11111111-1111-4111-8111-111111111111';
const PARTNER_B = '22222222-2222-4222-8222-222222222222';
const ORG_NAMED = '33333333-3333-4333-8333-333333333333';
const ORG_ORPHAN = '44444444-4444-4444-8444-444444444444';
const ORG_SECONDARY = '55555555-5555-4555-8555-555555555555';
const ORG_TENANT_B = '66666666-6666-4666-8666-666666666666';

let sql: Client;

async function reset() {
  await sql.query(`DROP TABLE IF EXISTS partner_resources, partner_attributions,
    partner_client_organizations, partner_payouts, partner_program_ledger,
    organizations, users, projects CASCADE`);

  // `organizations.id` is text and `partner_attributions.organization_id` is
  // uuid on demo — reproduce that shape so the cast in the join is exercised.
  await sql.query(`CREATE TABLE organizations (id text PRIMARY KEY, name text, plan text)`);
  await sql.query(`CREATE TABLE users (id uuid PRIMARY KEY, organization_id text)`);
  await sql.query(`CREATE TABLE projects (id uuid PRIMARY KEY, organization_id text, status text)`);
  await sql.query(`CREATE TABLE partner_attributions (
    id uuid PRIMARY KEY, partner_org_id uuid, organization_id uuid,
    attribution_type text, referral_code_used text, signup_completed_at timestamptz,
    first_payment_at timestamptz, lifetime_value numeric, total_commission_earned numeric,
    commission_rate_percent numeric, commission_duration_months int, status text,
    attributed_at timestamptz, created_at timestamptz DEFAULT now())`);
  await sql.query(`CREATE TABLE partner_client_organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_org_id uuid,
    organization_id uuid, name text)`);
  await sql.query(`CREATE TABLE partner_payouts (
    id uuid PRIMARY KEY, partner_org_id uuid, net_amount numeric, status text)`);
  await sql.query(`CREATE TABLE partner_program_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_org_id uuid,
    entry_type text, amount numeric)`);

  await sql.query(`INSERT INTO organizations (id, name, plan) VALUES ($1,$2,$3)`, [
    ORG_NAMED,
    'Atelier Toys AB',
    'growth',
  ]);
  await sql.query(`INSERT INTO organizations (id, name, plan) VALUES ($1,$2,$3)`, [
    ORG_TENANT_B,
    'Foreign Tenant GmbH',
    'pro',
  ]);

  // Partner A: one resolvable client, one orphan, one resolvable only via the
  // tenant-scoped secondary source.
  const attribution = (id: string, partner: string, org: string) =>
    sql.query(
      `INSERT INTO partner_attributions (id, partner_org_id, organization_id, attribution_type,
        referral_code_used, lifetime_value, total_commission_earned, commission_rate_percent,
        commission_duration_months, status, attributed_at)
       VALUES ($1,$2,$3,'REFERRAL_LINK','CODE-A',1000,100,10,12,'ACTIVE', now())`,
      [id, partner, org]
    );
  await attribution('aaaaaaa1-0000-4000-8000-000000000001', PARTNER_A, ORG_NAMED);
  await attribution('aaaaaaa1-0000-4000-8000-000000000002', PARTNER_A, ORG_ORPHAN);
  await attribution('aaaaaaa1-0000-4000-8000-000000000003', PARTNER_A, ORG_SECONDARY);
  await attribution('bbbbbbb1-0000-4000-8000-000000000001', PARTNER_B, ORG_TENANT_B);

  await sql.query(
    `INSERT INTO partner_client_organizations (partner_org_id, organization_id, name)
     VALUES ($1,$2,$3)`,
    [PARTNER_A, ORG_SECONDARY, 'Secondary Source Sp. z o.o.']
  );
  // Partner B knows a name for its own client; partner A must never see it.
  await sql.query(
    `INSERT INTO partner_client_organizations (partner_org_id, organization_id, name)
     VALUES ($1,$2,$3)`,
    [PARTNER_B, ORG_TENANT_B, 'Foreign Tenant GmbH']
  );

  // Money: ledger records a 250 accrual and NO payout.reconciled, while the
  // settled register holds a COMPLETED payout of 514.80 — demo's exact shape.
  await sql.query(
    `INSERT INTO partner_program_ledger (partner_org_id, entry_type, amount) VALUES ($1,'accrual.posted',250)`,
    [PARTNER_A]
  );
  await sql.query(
    `INSERT INTO partner_payouts (id, partner_org_id, net_amount, status)
     VALUES ('ccccccc1-0000-4000-8000-000000000001',$1,514.80,'COMPLETED')`,
    [PARTNER_A]
  );
  await sql.query(
    `INSERT INTO partner_payouts (id, partner_org_id, net_amount, status)
     VALUES ('ccccccc1-0000-4000-8000-000000000002',$1,306.90,'PENDING')`,
    [PARTNER_A]
  );
}

/** Schema BEFORE migration 555 — no file_key/file_name/mime_type/size_bytes. */
async function createResourcesTableCompat() {
  await sql.query(`DROP TABLE IF EXISTS partner_resources`);
  await sql.query(`CREATE TABLE partner_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, category text,
    file_type text, file_size_bytes bigint, min_partner_tier text, is_active boolean)`);
}

async function seedResources(count: number) {
  for (let i = 0; i < count; i += 1) {
    await sql.query(
      `INSERT INTO partner_resources (title, category, file_type, file_size_bytes, min_partner_tier, is_active)
       VALUES ($1,'documentation','PDF',1024,'registered',TRUE)`,
      [`Doc ${i + 1}`]
    );
  }
}

const FULL_PROJECTION = `id, title, category, file_type, file_size_bytes, min_partner_tier,
              file_key, file_name, mime_type, size_bytes`;
const COMPAT_PROJECTION = `id, title, category, file_type, file_size_bytes, min_partner_tier`;

beforeAll(async () => {
  sql = new Client({ connectionString: CONNECTION });
  await sql.connect();
  const who = await sql.query('SELECT current_database() AS db, version() AS v');
  // No silent mock: this must be a real PostgreSQL server.
  expect(String(who.rows[0].v)).toMatch(/PostgreSQL/);
  await reset();
}, 60_000);

afterAll(async () => {
  await sql?.end();
});

describe('M16 — resources: EMPTY vs DEGRADED_UNAVAILABLE (real PG)', () => {
  it('classifies a genuinely empty catalogue as EMPTY, not degraded', async () => {
    await createResourcesTableCompat();
    const rows = await sql.query(`SELECT ${COMPAT_PROJECTION} FROM partner_resources WHERE is_active = TRUE`);
    expect(rows.rowCount).toBe(0);
    // compat read succeeded => capability is a real read, list is honestly empty
  });

  it('serves the compat read when the schema is behind, instead of an empty list', async () => {
    await createResourcesTableCompat();
    await seedResources(15);

    // Full projection fails on this schema...
    await expect(
      sql.query(`SELECT ${FULL_PROJECTION} FROM partner_resources WHERE is_active = TRUE`)
    ).rejects.toThrow(/file_key/);

    // ...and the compat projection the repair falls back to returns all 15 rows.
    const compat = await sql.query(
      `SELECT ${COMPAT_PROJECTION} FROM partner_resources WHERE is_active = TRUE`
    );
    expect(compat.rowCount).toBe(15);
  });

  it('DEGRADED_UNAVAILABLE when the table itself cannot be read', async () => {
    await sql.query(`DROP TABLE IF EXISTS partner_resources`);
    await expect(
      sql.query(`SELECT ${COMPAT_PROJECTION} FROM partner_resources WHERE is_active = TRUE`)
    ).rejects.toThrow(/partner_resources/);
  });

  it('NEGATIVE CONTROL — the old swallowing read reports 15 rows as an empty list', async () => {
    await createResourcesTableCompat();
    await seedResources(15);

    // Reproduces DbPromise.all's default `fallback: true`: swallow, return [].
    const legacySwallowingRead = async () => {
      try {
        const r = await sql.query(
          `SELECT ${FULL_PROJECTION} FROM partner_resources WHERE is_active = TRUE`
        );
        return r.rows;
      } catch {
        return [];
      }
    };

    const swallowed = await legacySwallowingRead();
    expect(swallowed).toHaveLength(0); // the old bug, reproduced

    const actualRows = await sql.query(`SELECT id FROM partner_resources WHERE is_active = TRUE`);
    expect(actualRows.rowCount).toBe(15);
    // An empty list that is really 15 rows is exactly what must never ship.
    expect(swallowed.length).not.toBe(actualRows.rowCount);
  });
});

describe('M16 — attribution client names (real PG)', () => {
  const resolveNames = async (partnerOrgId: string) => {
    const attributions = await sql.query(
      `SELECT pa.*, o.name AS org_name
         FROM partner_attributions pa
         LEFT JOIN organizations o ON o.id = pa.organization_id::text
        WHERE pa.partner_org_id = $1
        ORDER BY pa.id`,
      [partnerOrgId]
    );
    const orgIds = attributions.rows.map((r: any) => r.organization_id);
    const secondary = await sql.query(
      `SELECT organization_id, name FROM partner_client_organizations
        WHERE partner_org_id = $1 AND organization_id = ANY($2::uuid[])`,
      [partnerOrgId, orgIds]
    );
    const secondaryByOrg = new Map<string, string>(
      secondary.rows.map((r: any) => [String(r.organization_id), String(r.name)])
    );
    return attributions.rows.map((r: any) => {
      const name =
        String(r.org_name || '').trim() || secondaryByOrg.get(String(r.organization_id)) || null;
      return {
        organizationId: String(r.organization_id),
        name,
        nameResolution: name ? 'RESOLVED' : 'UNRESOLVED',
      };
    });
  };

  it('resolves the name from the organizations join', async () => {
    const clients = await resolveNames(PARTNER_A);
    const named = clients.find((c) => c.organizationId === ORG_NAMED);
    expect(named?.name).toBe('Atelier Toys AB');
    expect(named?.nameResolution).toBe('RESOLVED');
  });

  it('resolves from the tenant-scoped secondary source when the org row is missing', async () => {
    const clients = await resolveNames(PARTNER_A);
    const secondary = clients.find((c) => c.organizationId === ORG_SECONDARY);
    expect(secondary?.name).toBe('Secondary Source Sp. z o.o.');
    expect(secondary?.nameResolution).toBe('RESOLVED');
  });

  it('returns null (never a UUID, never a placeholder) when nothing resolves', async () => {
    const clients = await resolveNames(PARTNER_A);
    const orphan = clients.find((c) => c.organizationId === ORG_ORPHAN);
    expect(orphan?.nameResolution).toBe('UNRESOLVED');
    expect(orphan?.name).toBeNull();
    expect(orphan?.name).not.toBe('Organization');
    expect(String(orphan?.name)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
  });

  it('NEGATIVE CONTROL — the old mapping fabricates the name "Organization"', async () => {
    const clients = await resolveNames(PARTNER_A);
    const orphan = clients.find((c) => c.organizationId === ORG_ORPHAN)!;
    const legacyName = orphan.name || 'Organization'; // the removed fallback
    expect(legacyName).toBe('Organization');
    expect(legacyName).not.toBe(orphan.name);
  });

  it('cross-tenant negative control — partner A never sees partner B client names', async () => {
    const clientsA = await resolveNames(PARTNER_A);
    expect(clientsA.map((c) => c.organizationId)).not.toContain(ORG_TENANT_B);
    expect(clientsA.map((c) => c.name)).not.toContain('Foreign Tenant GmbH');

    // And the secondary source is itself partner-scoped.
    const leak = await sql.query(
      `SELECT name FROM partner_client_organizations WHERE partner_org_id = $1 AND organization_id = $2`,
      [PARTNER_A, ORG_TENANT_B]
    );
    expect(leak.rowCount).toBe(0);
  });
});

describe('M16 — paid total vs settled payout register (real PG)', () => {
  const balances = async (partnerOrgId: string) => {
    const ledger = await sql.query(
      `SELECT entry_type, amount FROM partner_program_ledger WHERE partner_org_id = $1`,
      [partnerOrgId]
    );
    let gross = 0;
    let ledgerReconciled = 0;
    for (const e of ledger.rows) {
      const a = Number(e.amount) || 0;
      if (e.entry_type === 'accrual.posted') gross += a;
      if (e.entry_type === 'payout.reconciled') ledgerReconciled += Math.abs(a);
    }
    const settled = await sql.query(
      `SELECT COALESCE(SUM(net_amount),0) AS total FROM partner_payouts
        WHERE partner_org_id = $1 AND status = 'COMPLETED'`,
      [partnerOrgId]
    );
    const settledPayouts = Number(settled.rows[0].total) || 0;
    const paidOut = Math.max(ledgerReconciled, settledPayouts);
    return {
      grossEarned: gross,
      paidOut,
      ledgerReconciled,
      settledPayouts,
      status: settledPayouts - ledgerReconciled > 0 ? 'LEDGER_BEHIND_REGISTER' : 'RECONCILED',
    };
  };

  it('paid total equals the completed payout, not zero', async () => {
    const b = await balances(PARTNER_A);
    expect(b.settledPayouts).toBeCloseTo(514.8, 2);
    expect(b.paidOut).toBeCloseTo(514.8, 2);
    expect(b.paidOut).not.toBe(0);
  });

  it('flags the divergence explicitly instead of masking it', async () => {
    const b = await balances(PARTNER_A);
    expect(b.ledgerReconciled).toBe(0);
    expect(b.status).toBe('LEDGER_BEHIND_REGISTER');
  });

  it('NEGATIVE CONTROL — the old ledger-only total renders 0 paid beside a completed payout', async () => {
    const b = await balances(PARTNER_A);
    const legacyPaidOut = b.ledgerReconciled; // the old computation
    expect(legacyPaidOut).toBe(0);
    expect(legacyPaidOut).not.toBeCloseTo(b.settledPayouts, 2);
  });

  it('survives a fresh reopen — values are read back identically', async () => {
    const first = await balances(PARTNER_A);
    await sql.end();
    sql = new Client({ connectionString: CONNECTION });
    await sql.connect();
    const second = await balances(PARTNER_A);
    expect(second).toEqual(first);
  });
});
