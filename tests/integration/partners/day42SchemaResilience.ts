/**
 * Day 42 FIX-7 — make the day 42 suites reproducible in a WHOLE-DIRECTORY run.
 *
 * `tests/integration/partners` shares one disposable database, and several
 * neighbours are destructive: `m16-final-repair.realdb.test.ts:43-66` drops
 * `organizations, users, projects, partner_payouts, partner_program_ledger, ...`
 * CASCADE and recreates them in a REDUCED shape (`organizations` becomes
 * `(id text, name text, plan text)` — no `status`), and
 * `partner-accrual-payout-atomic.realdb.test.ts:21-22` recreates
 * `partner_organizations` as `(id uuid, payout_method text)`. Running the day 42
 * files alone was green; running the directory reddened them in `beforeAll` with
 * `column "status" of relation "organizations" does not exist` and, in teardown,
 * `operator does not exist: uuid = text`.
 *
 * That is a fixture problem, not a product problem — and an unexplained red is
 * exactly what gets a security suite "simplified" later. So:
 *
 * 1. `restoreDay42FixtureColumns` re-adds, additively and idempotently, only the
 *    columns the day 42 fixtures write. `ADD COLUMN IF NOT EXISTS` never drops
 *    or retypes anything, and the suites already refuse to run against any
 *    database not named `cx_day42`, so this cannot touch anything real.
 * 2. `assertDay42Preconditions` then fails with a NAMED error that points at the
 *    destructive neighbour, instead of a bare Postgres message.
 *
 * Teardown brittleness is handled at the call sites by comparing
 * `partner_org_id::text`, which works whether a neighbour left the column as
 * `uuid` or as `text`.
 */
import type { Client } from 'pg';

/** table -> column -> type used ONLY when the column is missing entirely. */
const REQUIRED_FIXTURE_COLUMNS: Record<string, Record<string, string>> = {
  organizations: { name: 'text', plan: 'text', status: 'text' },
  users: {
    organization_id: 'text',
    email: 'text',
    password: 'text',
    role: 'text',
    status: 'text',
  },
  organization_members: {
    organization_id: 'text',
    user_id: 'text',
    role: 'text',
    status: 'text',
  },
  partner_organizations: {
    name: 'text',
    contact_email: 'text',
    contact_phone: 'text',
    website: 'text',
    status: 'text',
    owner_organization_id: 'text',
    referral_code: 'text',
    referral_link_slug: 'text',
  },
  partner_users: { partner_org_id: 'uuid', user_id: 'uuid', role: 'text', status: 'text' },
  partner_campaign_links: {
    partner_org_id: 'uuid',
    name: 'text',
    slug: 'text',
    destination_url: 'text',
  },
  partner_commission_transactions: {
    partner_org_id: 'uuid',
    organization_id: 'text',
    transaction_type: 'text',
    transaction_date: 'timestamptz',
    gross_amount: 'numeric',
    commission_rate: 'numeric',
    commission_amount: 'numeric',
    currency: 'text',
    status: 'text',
    notes: 'text',
  },
  partner_payouts: {
    partner_org_id: 'uuid',
    payout_period_start: 'date',
    payout_period_end: 'date',
    gross_amount: 'numeric',
    fees: 'numeric',
    net_amount: 'numeric',
    currency: 'text',
    status: 'text',
    notes: 'text',
  },
};

const tableExists = async (sql: Client, table: string): Promise<boolean> => {
  const res = await sql.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [
    `public.${table}`,
  ]);
  return Boolean(res.rows[0]?.ok);
};

const existingColumns = async (sql: Client, table: string): Promise<Set<string>> => {
  const res = await sql.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(res.rows.map((r) => r.column_name));
};

/** Additive, idempotent repair of the fixture columns a neighbour may have dropped. */
export async function restoreDay42FixtureColumns(sql: Client): Promise<string[]> {
  const repaired: string[] = [];
  for (const [table, columns] of Object.entries(REQUIRED_FIXTURE_COLUMNS)) {
    if (!(await tableExists(sql, table))) continue;
    const present = await existingColumns(sql, table);
    for (const [column, type] of Object.entries(columns)) {
      if (present.has(column)) continue;
      await sql.query(`ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
      repaired.push(`${table}.${column}`);
    }
  }
  return repaired;
}

/**
 * Fails with a named, diagnosable error rather than a bare Postgres message when
 * a neighbour has removed a table outright (repair can only add columns).
 */
export async function assertDay42Preconditions(sql: Client): Promise<void> {
  const missingTables: string[] = [];
  for (const table of Object.keys(REQUIRED_FIXTURE_COLUMNS)) {
    if (!(await tableExists(sql, table))) missingTables.push(table);
  }
  if (missingTables.length > 0) {
    throw new Error(
      `DAY42_PRECONDITION_SCHEMA_DAMAGED: missing table(s) ${missingTables.join(', ')} — ` +
        'a destructive neighbour in tests/integration/partners dropped them ' +
        '(see m16-final-repair.realdb.test.ts:43 and partner-accrual-payout-atomic.realdb.test.ts:21). ' +
        'This is a shared-fixture problem, NOT a Partner isolation regression: ' +
        'do not weaken the day 42 assertions to make it green.'
    );
  }
}
