/**
 * Consultify Acceptance Harness — seed fixture.
 * Inserts ONE test organization + owner user (+ ACTIVE membership) with the
 * reversible `odbior--` prefix and known, stable ids. Idempotent.
 * Writes ONLY to the LOCAL Postgres. Never demo/prod.
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';

export const SEED = {
  ORG_ID: 'odbior--org-0001',
  USER_ID: 'odbior--user-0001',
  EMAIL: 'odbior--owner@acceptance.local',
  PASSWORD: 'Odbior!Harness123',
  ROLE: 'OWNER',
};

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || !/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
  console.error(`[seed] REFUSING: DATABASE_URL must be LOCAL. Got: ${DATABASE_URL || '(unset)'}`);
  process.exit(2);
}

export async function seed() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(SEED.PASSWORD, 10);

    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3)
       ON CONFLICT (id) DO NOTHING`,
      [SEED.ORG_ID, 'Odbior Harness Org', now]
    );

    // FIX (J1, znalezisko): `users` NIE MA kolumny `updated_at` w realnym schemacie
    // (server/migrations/000_initdb_core_tables.sql CREATE TABLE users — brak;
    // potwierdzone też w pełnym baseline dumpie migrations-v2/001_baseline_20260413.sql).
    // Poprzednia wersja tego INSERT-u (feat/acceptance-harness-p03) referencjonowała
    // users.updated_at, co na CZYSTEJ bazie/PARITY zawsze wywala INSERT z
    // `column "updated_at" of relation "users" does not exist` — PRZED sprawdzeniem
    // ON CONFLICT (Postgres waliduje listę kolumn niezależnie od ścieżki konfliktu).
    // Istniejący wiersz seed-usera (z wcześniejszych sesji) przetrwał tylko dlatego,
    // że insert nigdy się nie powiódł od nowa na czystej bazie z tą kolumną w SQL.
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, $4, 'ADMIN', 'active', 'Odbior', 'Harness', $5)
       ON CONFLICT (id) DO NOTHING`,
      [SEED.USER_ID, SEED.ORG_ID, SEED.EMAIL, passwordHash, now]
    );

    // Membership must be ACTIVE — auth.middleware resolves org via organization_members.
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role, status, created_at)
       SELECT $1, $2, $3, 'ACTIVE', $4
       WHERE NOT EXISTS (
         SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2
       )`,
      [SEED.ORG_ID, SEED.USER_ID, SEED.ROLE, now]
    );

    const check = await client.query(
      `SELECT u.id AS user_id, u.email, o.id AS org_id, m.status AS membership
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       LEFT JOIN organization_members m ON m.user_id = u.id AND m.organization_id = o.id
       WHERE u.id = $1`,
      [SEED.USER_ID]
    );
    console.log('[seed] OK', check.rows[0]);
    return check.rows[0];
  } finally {
    await client.end();
  }
}

// Allow running standalone: `node tests/acceptance/seed.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((e) => {
    console.error('[seed] FATAL', e);
    process.exit(1);
  });
}
