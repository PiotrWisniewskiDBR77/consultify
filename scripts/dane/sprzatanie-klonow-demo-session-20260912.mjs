/** DRAFT: reviewed exact IDs only, never delete by name; local cx4_* default; operator mode requires explicit staging identity.
 * --target-manifest includes baseDemoOrganizationIds, protectedOrganizationIds, seedEmails (exact allowlist),
 * expiryCutoff ISO, organizationIds, and a verified full custom-format dump + restore receipt.
 * Manifest is evidence, NOT a complete backup of CASCADE children. No pretend JSON rollback.
 */
import { fail, DBR77, qi, parseArgs, connect, finish, writePrivate, isMain, reportFailure } from './codex4-ops-safety.mjs';
export function assertClone(org, target, members, legalHold) {
  const bases = target.baseDemoOrganizationIds;
  if (!Array.isArray(bases) || !bases.length || bases.some(x => typeof x !== 'string' || !x || x.includes('%'))) fail('TEMPLATE_IDENTITIES_REQUIRED');
  const protectedIds = new Set(['*', '__system__', '__global__', '', DBR77, 'demo-org', ...bases, ...(target.protectedOrganizationIds || [])]);
  if (protectedIds.has(org.id) || !bases.some(base => org.id.startsWith(base + '-session-') && org.id.length > base.length + 9)) fail('NOT_EXACT_EPHEMERAL_CLONE');
  if (org.organization_type !== 'DEMO' || ['paid','active','past_due'].includes(String(org.billing_status || '').toLowerCase())) fail('NOT_NONPAYING_DEMO');
  const cutoff = Date.parse(target.expiryCutoff); const created = Date.parse(org.created_at);
  if (!Number.isFinite(cutoff) || cutoff > Date.now() || !Number.isFinite(created) || created >= cutoff) fail('EXPIRY_NOT_PROVEN');
  if (legalHold) fail('LEGAL_HOLD');
  if (!Array.isArray(target.seedEmails)) fail('SEED_IDENTITIES_REQUIRED');
  const seeds = new Set(target.seedEmails.map(e => String(e).trim().toLowerCase()));
  // Explicit seed allowlist cannot relabel a real corporate identity as a fixture.
  if ([...seeds].some(e => !/^[^@]+@(demo\.ateliertoys\.com|ateliertoys-demo\.com|consultify\.local|dbr77-e2e\.test)$/.test(e))) fail('UNPROVEN_SEED_IDENTITY');
  for (const u of members) if (u.last_login != null || u.last_login_at != null || !u.email || !seeds.has(String(u.email).trim().toLowerCase())) fail('HUMAN_MEMBER_PRESENT');
  if (org.is_template === true || org.is_template === 1 || org.is_template === 'true') fail('TEMPLATE_PROTECTED');
}
export async function runCleanup(options) {
  const ctx = await connect(options, 'cleanup-demo-clones'); let ended = false;
  try {
    const { client: c, target } = ctx;
    // Cleanup qualifies every candidate only AFTER its table locks are held.
    // SERIALIZABLE would pin a snapshot at catalog discovery, hiding a legal
    // hold/member/session committed while discovery or LOCK was in flight.
    // READ COMMITTED gives the post-lock guards a fresh snapshot; the locks
    // then prevent every guarded table from changing through COMMIT/ROLLBACK.
    // This is cleanup-only: pilot account transactions keep SERIALIZABLE.
    if (options.apply) await c.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    const { tsImport } = await import('tsx/esm/api');
    const lifecycle = await tsImport('../../server/src/services/organizationLifecycleService.ts', import.meta.url);
    const scoped = await lifecycle.discoverOrganizationScopedColumns(c);
    if (options.apply) {
      // Includes membership/legal-policy tables: no human can join, enable hold or add source rows between guard and delete.
      const tables = new Set(['organizations','users','organization_members','org_policies','demo_sessions','demo_session_tenants', ...scoped.map(x => x.tabela)]);
      await c.query(`LOCK TABLE ${[...tables].sort().map(qi).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    }
    const plans = [];
    for (const id of target.organizationIds) {
      lifecycle.assertNotReservedOrganizationId(id);
      const rows = await c.query('SELECT * FROM organizations WHERE id=$1', [id]);
      if (!rows.rowCount) { plans.push({ id, absent: true }); continue; }
      const members = await c.query(`SELECT DISTINCT u.* FROM users u WHERE u.organization_id=$1 OR EXISTS (SELECT 1 FROM organization_members m WHERE m.user_id=u.id AND m.organization_id=$1)`, [id]);
      // A membership pointing at a missing user is UNKNOWN, never proof of no humans.
      const orphan = await c.query('SELECT m.id FROM organization_members m LEFT JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND u.id IS NULL', [id]);
      if (orphan.rowCount) fail('UNRESOLVED_MEMBER');
      const external = await c.query('SELECT m.id FROM organization_members m JOIN users u ON u.id=m.user_id WHERE u.organization_id=$1 AND m.organization_id<>$1', [id]);
      if (external.rowCount) fail('SEED_HAS_EXTERNAL_MEMBERSHIP');
      // Intentionally stricter than hasLegalHold(): missing table/query failure aborts, never returns false.
      const policy = await c.query('SELECT legal_hold_enabled FROM org_policies WHERE organization_id=$1', [id]);
      const held = policy.rows.some(p => ![false, 0, '0'].includes(p.legal_hold_enabled));
      assertClone(rows.rows[0], target, members.rows, held);
      const sessions = await c.query(`SELECT id FROM demo_sessions WHERE session_org_id=$1 AND expires_at>NOW() AND lower(coalesce(status,''))<>'ended'`, [id]);
      const tenants = await c.query('SELECT tenant_org_id FROM demo_session_tenants WHERE tenant_org_id=$1 AND ttl_expires_at>NOW()', [id]);
      if (sessions.rowCount || tenants.rowCount) fail('ACTIVE_DEMO_SESSION');
      const counts = {};
      for (const { tabela, kolumna } of scoped) {
        const n = await c.query(`SELECT count(*) AS n FROM ${qi(tabela)} WHERE ${qi(kolumna)}::text=$1`, [id]);
        counts[`${tabela}.${kolumna}`] = Number(n.rows[0].n);
      }
      plans.push({ id, organization: rows.rows[0], counts });
    }
    writePrivate(options.manifest, { version: 1, operation: 'cleanup-demo-clones', mode: options.apply ? 'before-apply' : 'dry-run', database: target.database, createdAt: new Date().toISOString(), plans, backup: target.backup || null, rollback: 'Restore the independently verified full database dump into a separate cx4_* database. This manifest cannot restore CASCADE children.' });
    if (!options.apply) { ended = true; await finish(ctx, false); return { mode: 'dry-run', candidates: plans.filter(p => !p.absent).length, writes: 0 }; }
    for (const p of plans) if (!p.absent) {
      await lifecycle.deleteOrganizationDataInTransaction(c, p.id);
      const after = await c.query('SELECT id FROM organizations WHERE id=$1', [p.id]);
      if (after.rowCount) fail('DELETE_NOT_PROVEN');
    }
    ended = true; const transaction = await finish(ctx, true);
    let receiptWritten = false;
    try {
      writePrivate(options.manifest + '.commit.json', { operation: 'cleanup-demo-clones', database: target.database, committedAt: new Date().toISOString(), deletedIds: plans.filter(p => !p.absent).map(p => p.id), verification: 'READBACK_REQUIRED' });
      receiptWritten = true;
    } catch { /* COMMIT acknowledged: do not report a rollback because writing a receipt failed. */ }
    return { mode: 'apply', committed: true, cleanupWarnings: transaction.cleanupWarnings, receiptWritten, deleted: plans.filter(p => !p.absent).length, backupRestoreRequiredForRollback: true };
  } catch (error) { if (!ended) await finish(ctx, false, error); throw error; }
}
if (isMain(import.meta.url)) runCleanup(parseArgs(process.argv.slice(2))).then(r => console.log(JSON.stringify(r))).catch(reportFailure);
