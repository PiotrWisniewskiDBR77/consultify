import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL ?? '';
const real = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && url.startsWith('postgres');

describe.skipIf(!real)('20261038 Settings MFA legacy upgrade — real PostgreSQL', () => {
  let pool: import('pg').Pool;
  const schemas: string[] = [];
  let migration = '';

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: url });
    migration = await fs.readFile(
      path.resolve(process.cwd(), 'server/migrations/20261038_settings_mfa_challenges.sql'),
      'utf8'
    );
  });

  afterAll(async () => {
    if (!pool) return;
    for (const schema of schemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
  });

  async function exerciseLegacyVariant(kind: 'fingerprint' | 'device_fingerprint') {
    const schema = `mfa_upgrade_${randomUUID().replaceAll('-', '')}`;
    schemas.push(schema);
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}", public`);
      await client.query(`CREATE TABLE organizations (id text PRIMARY KEY)`);
      await client.query(
        `CREATE TABLE users (id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organizations(id))`
      );
      await client.query(
        `CREATE TABLE user_mfa (user_id text PRIMARY KEY REFERENCES users(id), enabled boolean, factor_generation integer DEFAULT 1)`
      );
      await client.query(`
        CREATE TABLE trusted_devices (
          id text PRIMARY KEY,
          user_id text NOT NULL REFERENCES users(id),
          ${kind} text NOT NULL,
          last_used text,
          expires_at text
        )
      `);
      await client.query(`INSERT INTO organizations(id) VALUES ('org-a'), ('org-b')`);
      await client.query(`INSERT INTO users(id, organization_id) VALUES ('user-a', 'org-a')`);
      await client.query(
        `INSERT INTO user_mfa(user_id, enabled, factor_generation) VALUES ('user-a', true, 4)`
      );
      await client.query(
        `INSERT INTO trusted_devices(id, user_id, ${kind}, last_used, expires_at)
         VALUES ('old-1', 'user-a', 'raw-secret', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'),
                ('old-2', 'user-a', 'raw-secret', '', '')`
      );

      await client.query(migration);
      const upgraded = await client.query(
        `SELECT organization_id, factor_generation, credential_hash, ${kind} raw,
                pg_typeof(expires_at)::text expires_type,
                pg_typeof(created_at)::text created_type
           FROM trusted_devices`
      );
      expect(upgraded.rows).toHaveLength(1);
      expect(upgraded.rows[0]).toMatchObject({
        organization_id: 'org-a',
        factor_generation: 4,
        raw: null,
        expires_type: 'timestamp with time zone',
        created_type: 'timestamp with time zone',
      });
      expect(upgraded.rows[0].credential_hash).toMatch(/^[a-f0-9]{64}$/);

      await client.query(`UPDATE users SET organization_id='org-b' WHERE id='user-a'`);
      await client.query(`ALTER TABLE user_mfa DISABLE TRIGGER trg_user_mfa_revoke_generation`);
      await client.query(`UPDATE user_mfa SET factor_generation=5 WHERE user_id='user-a'`);
      await client.query(migration);
      const replayed = await client.query(
        `SELECT organization_id, factor_generation FROM trusted_devices`
      );
      expect(replayed.rows).toHaveLength(0);
    } finally {
      client.release();
    }
  }

  it('upgrades fingerprint/last_used/no-created_at without raw credential retention', async () => {
    await exerciseLegacyVariant('fingerprint');
  });

  it('upgrades device_fingerprint variant idempotently without tenant rebinding', async () => {
    await exerciseLegacyVariant('device_fingerprint');
  });
});
