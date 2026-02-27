#!/usr/bin/env tsx
/**
 * Dev helper: ensure DBR77 local logins exist.
 *
 * Usage:
 *   npx tsx server/scripts/dev-ensure-admin.ts
 *
 * Optional env:
 *   DEV_ORG_ID
 *   DEV_ORG_NAME
 *
 *   DEV_SUPERADMIN_EMAIL
 *   DEV_SUPERADMIN_PASSWORD
 *
 *   DEV_OWNER_EMAIL
 *   DEV_OWNER_PASSWORD
 *
 *   DEV_QUICK_ACCESS_CODE
 */

import crypto from 'crypto';

import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import logger from '../src/utils/Logger.js';

// Load env in layers:
// - base `.env`
// - local overrides `.env.local`
// - optional `ENV_FILE` (highest priority) e.g. `.env.staging.local`
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE, override: true });
}

const orgId = String(process.env.DEV_ORG_ID || 'dbr77').trim();
const orgName = String(process.env.DEV_ORG_NAME || 'DBR77').trim();

const superAdminEmail = String(process.env.DEV_SUPERADMIN_EMAIL || 'admin@dbr77.com')
  .trim()
  .toLowerCase();
const superAdminPassword = String(process.env.DEV_SUPERADMIN_PASSWORD || '123456').trim();

const ownerEmail = String(process.env.DEV_OWNER_EMAIL || 'piotr.wisniewski@dbr77.com')
  .trim()
  .toLowerCase();
const ownerPassword = String(process.env.DEV_OWNER_PASSWORD || '123456').trim();

const quickAccessCode = String(process.env.DEV_QUICK_ACCESS_CODE || '7777').trim();

// Default DBR77 roster (can be extended later or driven by env if needed).
const DEFAULT_DBR77_ADMINS: Array<{ firstName: string; lastName: string; email: string }> = [
  { firstName: 'Justyna', lastName: 'Laskowska', email: 'justyna.laskowska@dbr77.com' },
  { firstName: 'Konrad', lastName: 'Milewski', email: 'konrad.milewski@dbr77.com' },
  { firstName: 'Bartosz', lastName: 'Sołomski', email: 'bartosz.solomski@dbr77.com' },
  { firstName: 'Konrad', lastName: 'Stefanik', email: 'konrad.stefanik@dbr77.com' },
  { firstName: 'Wojciech', lastName: 'Wesołowski', email: 'wojciech.wesolowski@dbr77.com' },
  { firstName: 'Paweł', lastName: 'Mroczkowski', email: 'pawel.mroczkowski@dbr77.com' },
  { firstName: 'Bartłomiej', lastName: 'Straszka', email: 'bartlomiej.straszka@dbr77.com' },
  { firstName: 'Torian', lastName: 'Richardson', email: 'torian.richardson@dbr77.com' },
  { firstName: 'Tomasz', lastName: 'Jankowski', email: 'tomasz.jankowski@dbr77.com' },
  { firstName: 'Katarzyna', lastName: 'Marszałkiewicz', email: 'katarzyna.marszalkiewicz@dbr77.com' },
  { firstName: 'Katarzyna', lastName: 'Szwarocka', email: 'katarzyna.szwarocka@dbr77.com' },
  { firstName: 'Michał', lastName: 'Łomżyński', email: 'michal.lomzynski@dbr77.com' },
  { firstName: 'Jeremiasz', lastName: 'Kaźmierczak', email: 'jeremiasz.kazmierczak@dbr77.com' },
  { firstName: 'Anja', lastName: 'Nugmanowa', email: 'anja.nugmanowa@dbr77.com' },
  { firstName: 'Doreen', lastName: 'Mittelstaedt', email: 'doreen.mittelstaedt@dbr77.com' },
  { firstName: 'Paweł', lastName: 'Dera', email: 'pawel.dera@dbr77.com' },
  { firstName: 'Kamil', lastName: 'Kuczek', email: 'kamil.kuczek@dbr77.com' },
];

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  // Ensure org exists
  try {
    await db.run(
      `INSERT INTO organizations (id, name, status, plan)
       VALUES ($1, $2, 'active', 'free')
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         status = 'active'`,
      [orgId, orgName]
    );
  } catch (e: any) {
    logger.warn('[dev-ensure-admin] Failed to upsert organization (continuing):', e?.message || e);
  }

  const ensureUser = async (opts: {
    email: string;
    password: string;
    role: 'SUPERADMIN' | 'OWNER' | 'ADMIN' | string;
    firstName: string;
    lastName: string;
    stableIdPrefix: string;
  }): Promise<{ id: string }> => {
    const passwordHash = bcrypt.hashSync(opts.password, 10);
    // Staging DB can contain duplicate/dirty emails (case, spaces, old inactive rows).
    // Force-correct ALL rows matching by lower(trim(email)) so login can't hit a stale record.
    const normalizedEmail = String(opts.email || '').trim().toLowerCase();
    const updateRes = await db.query<{ id: string }>(
      `UPDATE users
       SET organization_id = $2,
           email = $1,
           password = $3,
           role = $4,
           status = 'active',
           first_name = $5,
           last_name = $6
       WHERE lower(trim(email)) = lower(trim($1))
       RETURNING id`,
      [normalizedEmail, orgId, passwordHash, opts.role, opts.firstName, opts.lastName]
    );

    const updatedId = updateRes.rows?.[0]?.id;
    if (updatedId) {
      logger.info('[dev-ensure-admin] Ensured user (updated)', {
        email: normalizedEmail,
        id: updatedId,
        role: opts.role,
      });
      return { id: updatedId };
    }

    // No existing row matched → insert new one.
    const id = `${opts.stableIdPrefix}_${crypto.randomUUID()}`;
    await db.run(
      `INSERT INTO users
       (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8)`,
      [id, orgId, normalizedEmail, passwordHash, opts.firstName, opts.lastName, opts.role, nowIso()]
    );

    logger.info('[dev-ensure-admin] Ensured user (inserted)', { email: normalizedEmail, id, role: opts.role });
    return { id };
  };

  // 1) SUPERADMIN for quick access 7776
  const superAdmin = await ensureUser({
    email: superAdminEmail,
    password: superAdminPassword,
    role: 'SUPERADMIN',
    firstName: 'Admin',
    lastName: 'DBR77',
    stableIdPrefix: 'dev_superadmin',
  });

  // 2) OWNER for quick access 7777
  const owner = await ensureUser({
    email: ownerEmail,
    password: ownerPassword,
    role: 'OWNER',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    stableIdPrefix: 'dev_owner',
  });

  // 3) Ensure default DBR77 admins (all password=123456 unless overridden)
  const adminPassword = String(process.env.DEV_ADMIN_PASSWORD || '123456').trim();
  for (const u of DEFAULT_DBR77_ADMINS) {
    // Do not accidentally overwrite the two special accounts if they appear in the roster.
    const normalized = String(u.email || '').trim().toLowerCase();
    if (normalized === superAdminEmail || normalized === ownerEmail) continue;
    await ensureUser({
      email: normalized,
      password: adminPassword,
      role: 'ADMIN',
      firstName: u.firstName,
      lastName: u.lastName,
      stableIdPrefix: 'dev_admin',
    });
  }

  // Optional: create legacy access_control access code (not required for the UI quick-access backdoor)
  try {
    const existingCode = await db.query<{ id: string }>(
      `SELECT id FROM access_codes WHERE code = $1 LIMIT 1`,
      [quickAccessCode]
    );

    if (existingCode.rows?.[0]?.id) {
      await db.run(
        `UPDATE access_codes
         SET organization_id = $1,
             created_by = $2,
             role = 'OWNER',
             max_uses = -1,
             is_active = 1
         WHERE id = $3`,
        [orgId, superAdmin.id, existingCode.rows[0].id]
      );
    } else {
      const accessCodeId = `dev_access_${crypto.randomUUID()}`;
      await db.run(
        `INSERT INTO access_codes
         (id, organization_id, code, created_by, role, max_uses, current_uses, expires_at, is_active, created_at)
         VALUES ($1,$2,$3,$4,'OWNER',-1,0,NULL,1,$5)`,
        [accessCodeId, orgId, quickAccessCode, superAdmin.id, nowIso()]
      );
    }
    logger.info('[dev-ensure-admin] Ensured access code', { code: quickAccessCode, orgId });
  } catch (e: any) {
    logger.warn('[dev-ensure-admin] Failed to ensure access code (continuing):', e?.message || e);
  }

  // Ensure a demo project exists (optional but helps UI)
  try {
    const proj = await db.query<{ id: string }>(
      `SELECT id FROM projects WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    );
    if (!proj.rows?.[0]?.id) {
      const projectId = `dev_project_${crypto.randomUUID()}`;
      await db.run(
        `INSERT INTO projects
         (id, organization_id, name, description, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'active',$5,$5)`,
        [projectId, orgId, 'Demo Project', 'Auto-created for local dev login.', nowIso()]
      );
      logger.info('[dev-ensure-admin] Created demo project', { projectId, orgId });
    }
  } catch (e: any) {
    logger.warn('[dev-ensure-admin] Failed to ensure demo project (continuing):', e?.message || e);
  }

  logger.info('[dev-ensure-admin] Done. Local login entries ensured:', {
    superAdmin: { email: superAdminEmail, password: superAdminPassword, quickCode: '7776' },
    owner: { email: ownerEmail, password: ownerPassword, quickCode: '7777' },
    adminsCount: DEFAULT_DBR77_ADMINS.length,
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[dev-ensure-admin] Failed:', e);
  process.exit(1);
});

