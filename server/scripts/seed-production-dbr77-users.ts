#!/usr/bin/env tsx
/**
 * Production-safe seed: DBR77 users (PostgreSQL)
 *
 * What it does:
 * - Ensures the target organization exists (default: id "dbr77")
 * - Creates/updates a fixed list of DBR77 internal users
 * - Sets initial password to "<HASLO>" (bcrypt hash) and role to ADMIN (per request)
 *
 * Safety:
 * - PostgreSQL only
 * - Requires explicit confirmation env var to avoid accidental production writes
 * - Refuses to change an existing user's organization_id (email is globally unique)
 *
 * Usage (repo root):
 *   SEED_MODE=production \
 *   SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION \
 *   DB_TYPE=postgres \
 *   npx tsx server/scripts/seed-production-dbr77-users.ts
 *
 * Optional:
 *   SEED_ORG_ID=dbr77
 *   SEED_ORG_NAME="Consultinity / DBR77"
 */

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

type SeedUser = {
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'OWNER';
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function requireProductionConfirmation() {
  const mode = String(process.env.SEED_MODE || '').toLowerCase();
  const confirm = String(process.env.SEED_CONFIRM || '');
  if (mode !== 'production') {
    throw new Error(`Refusing to run: set SEED_MODE=production (current: "${mode || '(empty)'}")`);
  }
  if (confirm !== 'YES_I_UNDERSTAND_PRODUCTION') {
    throw new Error(
      `Refusing to run without explicit confirmation. Set SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION`
    );
  }
}

async function ensureOrganization(client: any, input: { id: string; name: string }) {
  const existing = await client.query(`SELECT id, name FROM organizations WHERE id = $1`, [
    input.id,
  ]);
  if (existing.rows.length > 0) return;

  // Minimal insert: keep columns conservative for schema compatibility.
  // (organizations table is expected to have at least id + name)
  await client.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
    input.id,
    input.name,
  ]);
}

async function main() {
  // Load env (gitignored) if present
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const seedUserPassword = requireEnv('SEED_USER_PASSWORD');

  // Safety checks
  requireProductionConfirmation();

  const dbType = String(process.env.DB_TYPE || '').toLowerCase();
  if (dbType && dbType !== 'postgres') {
    throw new Error(`This seed targets PostgreSQL only. Current DB_TYPE="${dbType}"`);
  }

  const databaseUrl = requireEnv('DATABASE_URL');
  if (!databaseUrl.startsWith('postgres')) {
    throw new Error(`DATABASE_URL must be a PostgreSQL connection string`);
  }

  const orgId = String(process.env.SEED_ORG_ID || 'dbr77');
  const orgName = String(process.env.SEED_ORG_NAME || 'Consultinity / DBR77');

  // Requested users (password: <HASLO> for all)
  const users: SeedUser[] = [
    {
      email: 'piotr.wisniewski@dbr77.com',
      firstName: 'Piotr',
      lastName: 'Wiśniewski',
      role: 'OWNER',
    },
    {
      email: 'justyna.laskowska@dbr77.com',
      firstName: 'Justyna',
      lastName: 'Laskowska',
      role: 'ADMIN',
    },
    {
      email: 'konrad.milewski@dbr77.com',
      firstName: 'Konrad',
      lastName: 'Milewski',
      role: 'ADMIN',
    },
    {
      email: 'bartosz.solomski@dbr77.com',
      firstName: 'Bartosz',
      lastName: 'Sołomski',
      role: 'ADMIN',
    },
    {
      email: 'konrad.stefanik@dbr77.com',
      firstName: 'Konrad',
      lastName: 'Stefanik',
      role: 'ADMIN',
    },
    {
      email: 'wojciech.wesolowski@dbr77.com',
      firstName: 'Wojciech',
      lastName: 'Wesołowski',
      role: 'ADMIN',
    },
    {
      email: 'pawel.mroczkowski@dbr77.com',
      firstName: 'Paweł',
      lastName: 'Mroczkowski',
      role: 'ADMIN',
    },
    {
      email: 'bartlomiej.straszka@dbr77.com',
      firstName: 'Bartłomiej',
      lastName: 'Straszka',
      role: 'ADMIN',
    },
    {
      email: 'torian.richardson@dbr77.com',
      firstName: 'Torian',
      lastName: 'Richardson',
      role: 'ADMIN',
    },
    {
      email: 'tomasz.jankowski@dbr77.com',
      firstName: 'Tomasz',
      lastName: 'Jankowski',
      role: 'ADMIN',
    },
    {
      email: 'katarzyna.marszalkiewicz@dbr77.com',
      firstName: 'Katarzyna',
      lastName: 'Marszałkiewicz',
      role: 'ADMIN',
    },
    {
      email: 'katarzyna.szwarocka@dbr77.com',
      firstName: 'Katarzyna',
      lastName: 'Szwarocka',
      role: 'ADMIN',
    },
    {
      email: 'michal.lomzynski@dbr77.com',
      firstName: 'Michał',
      lastName: 'Łomżyński',
      role: 'ADMIN',
    },
    {
      email: 'jeremiasz.kazmierczak@dbr77.com',
      firstName: 'Jeremiasz',
      lastName: 'Kaźmierczak',
      role: 'ADMIN',
    },
    { email: 'anja.nugmanowa@dbr77.com', firstName: 'Anja', lastName: 'Nugmanowa', role: 'ADMIN' },
    {
      email: 'doreen.mittelstaedt@dbr77.com',
      firstName: 'Doreen',
      lastName: 'Mittelstaedt',
      role: 'ADMIN',
    },
    { email: 'pawel.dera@dbr77.com', firstName: 'Paweł', lastName: 'Dera', role: 'ADMIN' },
    { email: 'kamil.kuczek@dbr77.com', firstName: 'Kamil', lastName: 'Kuczek', role: 'ADMIN' },
  ];

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await ensureOrganization(client, { id: orgId, name: orgName });

    const passwordHash = await bcrypt.hash(seedUserPassword, 10);

    let created = 0;
    let updated = 0;

    for (const u of users) {
      const existing = await client.query(
        `SELECT id, organization_id FROM users WHERE email = $1 LIMIT 1`,
        [u.email]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const existingOrgId = String(row.organization_id || '');
        if (existingOrgId !== orgId) {
          throw new Error(
            `Refusing to move user "${u.email}" between organizations: existing organization_id="${existingOrgId}", target="${orgId}".`
          );
        }

        await client.query(
          `UPDATE users
           SET password = $1,
               first_name = $2,
               last_name = $3,
               role = $4,
               status = 'active'
           WHERE email = $5`,
          [passwordHash, u.firstName, u.lastName, u.role, u.email]
        );
        updated++;
        continue;
      }

      await client.query(
        `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())`,
        [uuidv4(), orgId, u.email, passwordHash, u.firstName, u.lastName, u.role]
      );
      created++;
    }

    await client.query('COMMIT');

    // eslint-disable-next-line no-console
    console.log('✅ DBR77 users seed completed');
    // eslint-disable-next-line no-console
    console.log(`- Organization: ${orgId} (${orgName})`);
    // eslint-disable-next-line no-console
    console.log(`- Created: ${created}`);
    // eslint-disable-next-line no-console
    console.log(`- Updated: ${updated}`);
    // eslint-disable-next-line no-console
    console.log('- Initial password for all accounts: supplied through SEED_USER_PASSWORD');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Seed failed:', e?.message || e);
  process.exit(1);
});
