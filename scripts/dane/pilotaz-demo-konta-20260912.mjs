/** Historical filename retained; DEC-472 pilot target is STAGING, local cx4_* default; explicit operator mode is never run by this preparation.
 * node scripts/dane/pilotaz-demo-konta-20260912.mjs --target-manifest=/absolute/target.json
 *   --manifest=/absolute/private/before.json [--apply --backup=/absolute/full.dump --out=/absolute/private/passwords.json]
 * Output contains credentials: never print, commit or attach it to reports.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { DBR77, fail, parseArgs, connect, finish, writePrivate, outsideRepo, isMain, reportFailure } from './codex4-ops-safety.mjs';
export const PILOTS = [
  ['tomasz.jankowski@dbr77.com', 'Tomasz', 'Jankowski'],
  ['justyna.laskowska@dbr77.com', 'Justyna', 'Laskowska'],
  ['katarzyna.marszalkiewicz@dbr77.com', 'Katarzyna', 'Marszałkiewicz'],
  ['irina.lebedjuk@dbr77.com', 'Irina', 'Lebedjuk'],
];
export function password14() {
  // All classes, unbiased selections, cryptographic shuffle; no modulo bias.
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*-_'];
  const all = groups.join('');
  const chars = groups.map(g => g[crypto.randomInt(g.length)]);
  while (chars.length < 14) chars.push(all[crypto.randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}
export function assertExistingUser(rows) {
  if (rows.length > 1) fail('AMBIGUOUS_EMAIL');
  if (rows[0] && (rows[0].organization_id !== DBR77 || String(rows[0].status || 'active').toLowerCase() !== 'active')) fail('EXISTING_ACCOUNT_REQUIRES_REVIEW');
}
export function assertPilotMembership(existingUser, memberships) {
  if (existingUser && !memberships.length) fail('EXISTING_MEMBERSHIP_REQUIRES_REVIEW');
  if (memberships.length > 1 || (memberships[0] && memberships[0].status !== 'ACTIVE')) fail('MEMBERSHIP_REQUIRES_REVIEW');
}
export async function runPilot(options) {
  if (options.apply && !options.out) fail('PRIVATE_PASSWORD_OUTPUT_REQUIRED');
  if (options.out && outsideRepo(options.out) === outsideRepo(options.manifest)) fail('OUTPUT_PATH_COLLISION');
  if (options.apply && fs.existsSync(outsideRepo(options.out + '.commit.json'))) fail('COMMIT_RECEIPT_ALREADY_EXISTS');
  const ctx = await connect(options, 'pilot-accounts');
  let ended = false;
  try {
    const { client: c, target } = ctx;
    if (target.organizationIds.length !== 1 || target.organizationIds[0] !== DBR77) fail('PILOT_ORGANIZATION_MISMATCH');
    // Prevent signup/membership/password/reset races across preflight and apply.
    if (options.apply) await c.query('LOCK TABLE users, organization_members, password_resets, refresh_tokens IN SHARE ROW EXCLUSIVE MODE');
    const verifiedColumn = await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email_verified_at'");
    const org = await c.query('SELECT id FROM organizations WHERE id=$1', [DBR77]);
    if (org.rowCount !== 1) fail('PILOT_ORGANIZATION_NOT_FOUND');
    const plans = [];
    for (const [email, firstName, lastName] of PILOTS) {
      const u = await c.query('SELECT * FROM users WHERE lower(trim(email))=$1', [email]);
      assertExistingUser(u.rows);
      const before = u.rows[0] || null;
      const id = before?.id || crypto.randomUUID();
      const membership = await c.query('SELECT * FROM organization_members WHERE user_id=$1 AND organization_id=$2', [id, DBR77]);
      assertPilotMembership(before, membership.rows);
      const resets = await c.query('SELECT * FROM password_resets WHERE user_id=$1', [id]);
      const refresh = await c.query('SELECT * FROM refresh_tokens WHERE user_id=$1 AND revoked_at IS NULL', [id]);
      plans.push({ id, email, firstName, lastName, before, membership: membership.rows, resets: resets.rows, refresh: refresh.rows });
    }
    // Manifest is sensitive (old password hashes and reset tokens), same protection as passwords.
    writePrivate(options.manifest, { version: 1, operation: 'pilot-accounts', mode: options.apply ? 'before-apply' : 'dry-run', intendedEnvironment: 'staging', database: target.database, createdAt: new Date().toISOString(), plans, backup: target.backup || null,
      limitations: ['Forced password change is not implemented in the product.', 'Existing access JWTs remain valid until expiry.', 'Do not reactivate revoked sessions during restoration; restore reviewed user fields only.'] });
    if (!options.apply) { ended = true; await finish(ctx, false); return { mode: 'dry-run', users: plans.length, writes: 0 }; }
    const { default: bcrypt } = await import('bcryptjs');
    const credentials = [];
    for (const p of plans) {
      const password = password14();
      const hash = await bcrypt.hash(password, 10); // existing password reset contract
      if (!p.before) {
        await c.query(`INSERT INTO users (id,organization_id,email,password,first_name,last_name,role,status,email_verified,onboarding_completed)
          VALUES ($1,$2,$3,$4,$5,$6,'MEMBER','active',1,true)`, [p.id, DBR77, p.email, hash, p.firstName, p.lastName]);
      } else {
        await c.query('UPDATE users SET password=$1,email_verified=1,onboarding_completed=true WHERE id=$2 AND organization_id=$3', [hash, p.id, DBR77]);
      }
      if (verifiedColumn.rowCount) await c.query('UPDATE users SET email_verified_at=COALESCE(email_verified_at,NOW()) WHERE id=$1 AND organization_id=$2', [p.id, DBR77]);
      if (!p.before) await c.query(`INSERT INTO organization_members (id,organization_id,user_id,role,status,created_at) VALUES ($1,$2,$3,'MEMBER','ACTIVE',NOW())`, [crypto.randomUUID(), DBR77, p.id]);
      // /onboarding/skip marks the user complete. Never forge terms/privacy acceptance or modify shared org setup.
      await c.query('DELETE FROM password_resets WHERE user_id=$1', [p.id]);
      await c.query("UPDATE refresh_tokens SET revoked_at=NOW(),revoked_reason='password_reset' WHERE user_id=$1 AND revoked_at IS NULL", [p.id]);
      credentials.push({ email: p.email, temporaryPassword: password, forcedPasswordChange: false });
    }
    // Durable credentials precede COMMIT. A lost ACK may leave ACTIVE credentials; reconcile before distribution or retry.
    writePrivate(options.out, { status: 'PRECOMMIT_VERIFY_BEFORE_DISTRIBUTION', database: target.database, credentials });
    ended = true; const transaction = await finish(ctx, true);
    let receiptWritten = false;
    try {
      writePrivate(options.out + '.commit.json', { operation: 'pilot-accounts', database: target.database, committedAt: new Date().toISOString(), credentialFile: options.out, userIds: plans.map(p => p.id), verification: 'LOGIN_READBACK_REQUIRED' });
      receiptWritten = true;
    } catch { /* COMMIT was acknowledged; never claim rollback after a receipt write failure. */ }
    return { mode: 'apply', committed: true, cleanupWarnings: transaction.cleanupWarnings, receiptWritten, users: plans.length, forcedPasswordChange: false, needsLocalLoginVerification: true };
  } catch (error) { if (!ended) await finish(ctx, false, error); throw error; }
}
if (isMain(import.meta.url)) runPilot(parseArgs(process.argv.slice(2))).then(r => console.log(JSON.stringify(r))).catch(reportFailure);
