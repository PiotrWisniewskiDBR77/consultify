/**
 * M13 Organization — real PostgreSQL persistence and tenant-isolation checks.
 *
 * This intentionally uses a throwaway database because setup drops the two
 * module tables before recreating the contract under test.
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adaptQuery } from '../../server/src/database/PostgresDatabase';

const PG_URL = process.env.M13_PG_URL || 'postgres://postgres:m13@localhost:55433/m13test';
const ORG_A = 'org-m13-alpha';
const ORG_B = 'org-m13-beta';

let client: Client;

function toPg(sql: string): string {
  let i = 0;
  return adaptQuery(sql).replace(/\?/g, () => `$${++i}`);
}

beforeAll(async () => {
  client = new Client({ connectionString: PG_URL });
  await client.connect();

  await client.query(`DROP TABLE IF EXISTS organization_profiles, organizations CASCADE`);
  await client.query(`
    CREATE TABLE organizations (
      id TEXT PRIMARY KEY,
      name TEXT,
      default_timezone TEXT,
      default_language TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await client.query(`
    CREATE TABLE organization_profiles (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
      industry TEXT,
      company_size TEXT,
      employee_count INTEGER,
      preferred_language TEXT DEFAULT 'pl',
      organization_type TEXT DEFAULT 'OTHER',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`);
  await client.query(
    `INSERT INTO organizations (id, name, default_timezone, default_language)
     VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)`,
    [ORG_A, 'Alfa Sp. z o.o.', 'Europe/Warsaw', 'pl', ORG_B, 'Beta GmbH', 'Europe/Berlin', 'de']
  );
});

afterAll(async () => {
  await client.query(`DROP TABLE IF EXISTS organization_profiles, organizations CASCADE`);
  await client.end();
});

const describeWithDisposableM13Pg = process.env.M13_PG_URL ? describe : describe.skip;

describeWithDisposableM13Pg('M13 — organization profile persistence on real PostgreSQL', () => {
  it("translates the SQLite-style datetime('now') expression used by the route", async () => {
    const sql = `UPDATE organizations SET
                    default_timezone = COALESCE(?, default_timezone),
                    default_language = COALESCE(?, default_language),
                    updated_at = datetime('now')
                 WHERE id = ?`;

    await expect(client.query(toPg(sql), ['Europe/London', 'en', ORG_A])).resolves.toBeDefined();

    const { rows } = await client.query(
      `SELECT default_timezone, default_language FROM organizations WHERE id = $1`,
      [ORG_A]
    );
    expect(rows[0].default_timezone).toBe('Europe/London');
    expect(rows[0].default_language).toBe('en');
  });

  it('writes a profile and verifies it with a fresh database read', async () => {
    await client.query(
      toPg(
        `INSERT INTO organization_profiles
           (id, organization_id, industry, company_size, employee_count, organization_type, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ),
      ['prof-alpha', ORG_A, 'Manufacturing', '51-200', 87, 'PRIVATE_COMPANY']
    );

    const { rows } = await client.query(
      `SELECT industry, company_size, employee_count, organization_type, updated_at
       FROM organization_profiles WHERE organization_id = $1`,
      [ORG_A]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].industry).toBe('Manufacturing');
    expect(rows[0].employee_count).toBe(87);
    expect(rows[0].organization_type).toBe('PRIVATE_COMPANY');
    expect(rows[0].updated_at).toBeInstanceOf(Date);
  });

  it('keeps organization profiles tenant-scoped and unique per organization', async () => {
    const { rows } = await client.query(
      `SELECT organization_id FROM organization_profiles WHERE organization_id = $1`,
      [ORG_B]
    );
    expect(rows).toHaveLength(0);

    await expect(
      client.query(
        `INSERT INTO organization_profiles (id, organization_id, industry) VALUES ($1,$2,$3)`,
        ['prof-alpha-dup', ORG_A, 'Duplicate']
      )
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('negative control rejects the untranslated SQLite expression on PostgreSQL', async () => {
    const rawSqliteSql = `UPDATE organizations SET updated_at = datetime('now') WHERE id = $1`;

    await expect(client.query(rawSqliteSql, [ORG_A])).rejects.toThrow(
      /function datetime\(unknown\) does not exist|does not exist/i
    );
    await expect(
      client.query(toPg(`UPDATE organizations SET updated_at = datetime('now') WHERE id = ?`), [
        ORG_A,
      ])
    ).resolves.toBeDefined();
  });
});
