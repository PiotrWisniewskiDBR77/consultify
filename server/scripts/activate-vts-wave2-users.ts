#!/usr/bin/env tsx
/**
 * Activate VTS wave-2 users: set a fresh password + flip status to 'active'
 * so the whole cohort can log in (today most are status='pending' with no
 * password, which blocks login at AuthController password check).
 *
 * Login model (verified in server/src/controllers/AuthController.ts):
 *   - gated on bcrypt password match + ORG status === 'active'
 *   - user.status 'pending' does NOT block login, but we set 'active' for hygiene.
 *
 * SAFETY
 *   - DRY-RUN by default. Prints control counts, writes nothing.
 *   - Requires APPLY=1 AND SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION to write.
 *   - Scope is strictly organization_id = 'vts' AND status = 'pending'.
 *   - Existing passwords of already-active users are NOT touched (idempotent).
 *
 * Usage (prod, via injected DATABASE_URL):
 *   # dry-run (safe, read-only):
 *   railway run --environment production --service Postgres -- \
 *     bash -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" SEED_MODE=production \
 *       npx tsx server/scripts/activate-vts-wave2-users.ts'
 *   # apply:
 *   ... APPLY=1 SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION npx tsx ... activate-vts-wave2-users.ts
 *
 * Env knobs:
 *   INCLUDE_ADMINS=1   also activate pending ADMIN accounts (default: USER only)
 *   CRED_OUT=path      credentials CSV output (default ./vts-wave2-credentials.csv)
 *   PIOTR_TEST_EMAIL   test pilot account email (default piotr.wisniewski+vtstest@dbr77.com)
 */
import crypto from 'crypto';
import fs from 'fs';

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) dotenv.config({ path: process.env.ENV_FILE, override: true });

const VTS_ORG_ID = process.env.SEED_ORG_ID || 'vts';
const APPLY = process.env.APPLY === '1';
const INCLUDE_ADMINS = process.env.INCLUDE_ADMINS === '1';
const CRED_OUT = process.env.CRED_OUT || './vts-wave2-credentials.csv';
const PIOTR_TEST_EMAIL = (
  process.env.PIOTR_TEST_EMAIL || 'piotr.wisniewski+vtstest@dbr77.com'
).toLowerCase();

// Unambiguous alphabet (no 0/O/1/l/I) for human-typeable temp passwords.
const PWD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function generatePassword(len = 12): string {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += PWD_ALPHABET[bytes[i] % PWD_ALPHABET.length];
  // Guarantee readability and a separator so it never looks like one token.
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

type TargetUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
};

async function main() {
  const target = resolveScriptDatabaseTarget({
    label: 'activate-vts-wave2',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('activate-vts-wave2', target);
  process.env.DATABASE_URL = target.connectionString;

  if (APPLY) {
    // Hard production write guard.
    requireConfirmation('SEED_CONFIRM', 'YES_I_UNDERSTAND_PRODUCTION', 'activate-vts-wave2');
  }

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  // ── Control: organization status (login blocks unless org is active) ──
  const orgRow = await db.query<{ id: string; name: string; status: string }>(
    `SELECT id, name, status FROM organizations WHERE id = $1 LIMIT 1`,
    [VTS_ORG_ID]
  );
  const org = orgRow.rows?.[0];
  if (!org) throw new Error(`Organization '${VTS_ORG_ID}' not found — aborting.`);
  logger.info(`[activate-vts] org '${org.id}' (${org.name}) status=${org.status}`);

  // ── Control counts ──
  const counts = await db.query<{ role: string; status: string; n: string }>(
    `SELECT role, status, COUNT(*)::text AS n FROM users
     WHERE organization_id = $1 GROUP BY role, status ORDER BY role, status`,
    [VTS_ORG_ID]
  );
  logger.info('[activate-vts] users by role/status:');
  for (const r of counts.rows) logger.info(`   role=${r.role} status=${r.status} -> ${r.n}`);

  const roleFilter = INCLUDE_ADMINS ? `('USER','ADMIN')` : `('USER')`;
  const targets = await db.query<TargetUser>(
    `SELECT id, email, role, status, first_name, last_name FROM users
     WHERE organization_id = $1 AND status = 'pending' AND role IN ${roleFilter}
     ORDER BY role, email`,
    [VTS_ORG_ID]
  );
  const list = targets.rows || [];
  logger.info(
    `[activate-vts] target pending accounts to activate: ${list.length} (roles ${roleFilter}${INCLUDE_ADMINS ? '' : ', admins excluded'})`
  );

  if (!APPLY) {
    logger.warn(
      `[activate-vts] DRY-RUN — no writes. org.status=${org.status}` +
        (org.status !== 'active' ? ' (WILL be set to active on APPLY)' : '') +
        `. Would activate ${list.length} users + ensure test account ${PIOTR_TEST_EMAIL}.` +
        ` Re-run with APPLY=1 SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION to write.`
    );
    return;
  }

  // ── Ensure org active (login requires it) ──
  if (org.status !== 'active') {
    await db.run(`UPDATE organizations SET status = 'active' WHERE id = $1`, [VTS_ORG_ID]);
    logger.info(`[activate-vts] org '${VTS_ORG_ID}' status -> active`);
  }

  const credentials: Array<{ email: string; password: string; role: string }> = [];

  // ── Activate each pending user ──
  let done = 0;
  for (const u of list) {
    const pwd = generatePassword();
    const hash = bcrypt.hashSync(pwd, 10);
    await db.run(`UPDATE users SET password = $1, status = 'active' WHERE id = $2`, [hash, u.id]);
    credentials.push({ email: u.email, password: pwd, role: u.role });
    done++;
    if (done % 25 === 0) logger.info(`[activate-vts] activated ${done}/${list.length}`);
  }

  // ── Ensure Piotr test pilot account (role USER so it sees the VTS pilot view) ──
  const testPwd = generatePassword();
  const testHash = bcrypt.hashSync(testPwd, 10);
  const existingTest = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1`,
    [PIOTR_TEST_EMAIL]
  );
  if (existingTest.rows?.[0]?.id) {
    await db.run(
      `UPDATE users SET organization_id = $1, password = $2, role = 'USER', status = 'active' WHERE id = $3`,
      [VTS_ORG_ID, testHash, existingTest.rows[0].id]
    );
  } else {
    const id = `vts_test_${crypto.randomUUID()}`;
    await db.run(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, $4, 'Piotr', 'Test', 'USER', 'active', NOW())`,
      [id, VTS_ORG_ID, PIOTR_TEST_EMAIL, testHash]
    );
    await db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'USER', 'ACTIVE', NOW())
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'USER', status = 'ACTIVE'`,
      [`vtsmem_${crypto.randomUUID()}`, VTS_ORG_ID, id]
    );
  }
  credentials.push({ email: PIOTR_TEST_EMAIL, password: testPwd, role: 'USER (test)' });

  // ── Write credentials sheet (SENSITIVE — gitignored) ──
  const csv =
    'email,password,role\n' +
    credentials.map((c) => `${c.email},${c.password},${c.role}`).join('\n') +
    '\n';
  fs.writeFileSync(CRED_OUT, csv, { mode: 0o600 });

  logger.info(
    `[activate-vts] DONE. Activated ${done} cohort users + test account. ` +
      `Credentials written to ${CRED_OUT} (${credentials.length} rows). ` +
      `Distribute securely and delete after use.`
  );
}

main().catch((err) => {
  logger.error('[activate-vts] FAILED:', err?.message || err);
  process.exit(1);
});
