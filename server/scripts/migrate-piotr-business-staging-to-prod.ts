#!/usr/bin/env tsx
/**
 * Migrate "Piotr business data" from STAGING → PRODUCTION (Postgres → Postgres).
 *
 * Scope:
 * - ONLY rows connected to the given user (default: piotr.wisniewski@dbr77.com)
 * - NO logs (we don't touch api_logs / activity_logs / audit_log / ai_* etc.)
 * - Append-only: INSERT ... ON CONFLICT DO NOTHING (no overwrites)
 *
 * Why this script exists:
 * - staging uses org id "dbr77"
 * - production uses a UUID-like org id for "DBR77"
 * - user ids differ between envs; we must remap user/org identifiers.
 *
 * Usage:
 *   # Dry run (recommended first)
 *   STAGING_DATABASE_URL="postgresql://..." PRODUCTION_DATABASE_URL="postgresql://..." npx tsx server/scripts/migrate-piotr-business-staging-to-prod.ts
 *
 *   # Write mode
 *   STAGING_DATABASE_URL="postgresql://..." PRODUCTION_DATABASE_URL="postgresql://..." npx tsx server/scripts/migrate-piotr-business-staging-to-prod.ts --write
 *
 * Optional:
 *   MIGRATE_USER_EMAIL="piotr.wisniewski@dbr77.com"
 *   STAGING_ORG_ID="dbr77"
 *   STAGING_PIOTR_ALIASES="piotr-dbr77" (comma-separated user-id aliases to treat as Piotr)
 */
import pg from 'pg';
import crypto from 'crypto';
import process from 'process';
import { fileURLToPath } from 'url';

type Db = pg.Pool;
type Row = Record<string, any>;

const DEFAULT_USER_EMAIL = 'piotr.wisniewski@dbr77.com';
const DEFAULT_STAGING_ORG_ID = 'dbr77';

const USER_REF_COLUMNS = new Set([
  'user_id',
  'created_by',
  'owner_id',
  'assigned_to',
  'decision_owner_id',
  'author_user_id',
  'owner_user_id',
  'performed_by',
  'sender_id',
  'updated_by',
  'approved_by',
  'reviewer_id',
  'assignee_id',
  'reporter_id',
  'escalated_to_id',
  'facilitator_id',
  'moderator_id',
  'backup_assignee_id',
  'acceptor_id',
  'sponsor_id',
  'owner_business_id',
  'owner_execution_id',
]);

function maskConn(s: string): string {
  return String(s || '').replace(/:[^:@]+@/g, ':****@');
}

function splitCsv(v: string | undefined): string[] {
  return (v || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function sha1Json(obj: unknown): string {
  const s = JSON.stringify(obj);
  return crypto.createHash('sha1').update(s).digest('hex');
}

function isFkViolation(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('foreign key') || m.includes('violates foreign key');
}

function isNotNullViolation(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('null value') && m.includes('violates not-null constraint');
}

async function getTableColumns(db: Db, tableName: string): Promise<string[]> {
  const r = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return (r.rows || []).map((x: any) => String(x.column_name));
}

async function getForeignKeyColumnsToUsers(db: Db, tableName: string): Promise<string[]> {
  const r = await db.query(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
     WHERE tc.constraint_type='FOREIGN KEY'
       AND tc.table_schema='public'
       AND tc.table_name=$1
       AND ccu.table_name='users'
       AND ccu.column_name='id'
     ORDER BY kcu.column_name`,
    [tableName]
  );
  return (r.rows || []).map((x: any) => String(x.column_name));
}

async function selectExistingIds(db: Db, tableName: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const r = await db.query(`SELECT id FROM "${tableName}" WHERE id = ANY($1)`, [ids]);
  return new Set((r.rows || []).map((x: any) => String(x.id)));
}

async function insertRowAppendOnly(
  db: Db,
  tableName: string,
  columns: string[],
  row: Row,
  dryRun: boolean
): Promise<{ inserted: boolean; error?: string }> {
  const cols = columns.filter((c) => row[c] !== undefined);
  if (cols.length === 0) return { inserted: false };
  if (dryRun) return { inserted: true };

  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const values = cols.map((c) => row[c]);
  const sql = `INSERT INTO "${tableName}" (${cols.map((c) => `"${c}"`).join(', ')})
               VALUES (${placeholders})
               ON CONFLICT DO NOTHING`;
  try {
    const res = await db.query(sql, values);
    return { inserted: (res.rowCount ?? 0) > 0 };
  } catch (e: any) {
    return { inserted: false, error: String(e?.message || e) };
  }
}

async function main() {
  const isWrite = process.argv.includes('--write');
  const dryRun = !isWrite;

  const userEmail = (process.env.MIGRATE_USER_EMAIL || DEFAULT_USER_EMAIL).trim();
  const stagingOrgId = (process.env.STAGING_ORG_ID || DEFAULT_STAGING_ORG_ID).trim();
  const aliases = splitCsv(process.env.STAGING_PIOTR_ALIASES || 'piotr-dbr77');

  const stagingUrl = process.env.STAGING_DATABASE_URL?.trim();
  const prodUrl = process.env.PRODUCTION_DATABASE_URL?.trim();
  if (!stagingUrl || !prodUrl) {
    throw new Error(
      'Missing STAGING_DATABASE_URL or PRODUCTION_DATABASE_URL. Provide both (public/reachable URLs).'
    );
  }

  console.log(
    `\n🔁 Migrate Piotr business data STAGING → PRODUCTION (${dryRun ? 'DRY-RUN' : 'WRITE'})\n`
  );
  console.log(`- user: ${userEmail}`);
  console.log(`- staging org id: ${stagingOrgId}`);
  console.log(`- aliases treated as Piotr user-id: ${aliases.length ? aliases.join(', ') : '(none)'}`);
  console.log(`- STAGING: ${maskConn(stagingUrl)}`);
  console.log(`- PROD:    ${maskConn(prodUrl)}\n`);

  // NOTE: Railway public TCP proxies commonly run without SSL on the proxy layer.
  // If you need SSL, run with a direct Postgres URL that supports it.
  const staging = new pg.Pool({ connectionString: stagingUrl, ssl: false });
  const prod = new pg.Pool({ connectionString: prodUrl, ssl: false });

  const stats: Record<string, { selected: number; inserted: number; skipped: number }> = {};
  function stat(table: string) {
    stats[table] ||= { selected: 0, inserted: 0, skipped: 0 };
    return stats[table]!;
  }

  try {
    // ── Resolve identities
    const stUserRes = await staging.query(
      `SELECT id,email,organization_id,role,first_name,last_name FROM users WHERE email=$1`,
      [userEmail]
    );
    if (stUserRes.rows.length === 0) throw new Error(`Staging user not found: ${userEmail}`);
    const stUser = stUserRes.rows[0] as Row;
    const stUserId = String(stUser.id);
    const stOrgId = String(stUser.organization_id || '');
    if (stOrgId !== stagingOrgId) {
      console.warn(
        `⚠ staging user org mismatch: expected ${stagingOrgId}, got ${stOrgId} (continuing with ${stOrgId})`
      );
    }

    const prodUserRes = await prod.query(
      `SELECT id,email,organization_id,role,first_name,last_name FROM users WHERE email=$1`,
      [userEmail]
    );
    if (prodUserRes.rows.length === 0) {
      throw new Error(
        `Production user not found: ${userEmail}. Create the prod user first (we won't auto-create in this script).`
      );
    }
    const prUser = prodUserRes.rows[0] as Row;
    const prUserId = String(prUser.id);
    const prOrgId = String(prUser.organization_id || '');
    if (!prOrgId) throw new Error('Production user has empty organization_id (unexpected).');

    console.log('✅ Identity mapping');
    console.log(`- staging user id: ${stUserId}`);
    console.log(`- staging org id:  ${stOrgId}`);
    console.log(`- prod user id:    ${prUserId}`);
    console.log(`- prod org id:     ${prOrgId}\n`);

    // userId remap (staging user ids -> prod user ids)
    const userIdMap = new Map<string, string>();
    const prodUserIds = new Set<string>([prUserId]);
    userIdMap.set(stUserId, prUserId);
    for (const a of aliases) userIdMap.set(a, prUserId);
    for (const v of userIdMap.values()) prodUserIds.add(v);

    async function resolveProdUserIdFromStagingUserId(stagingId: string): Promise<string | null> {
      if (userIdMap.has(stagingId)) return userIdMap.get(stagingId)!;

      const st = await staging.query(`SELECT email FROM users WHERE id=$1`, [stagingId]);
      const email = String(st.rows?.[0]?.email || '');
      if (!email) return null;

      const pr = await prod.query(`SELECT id FROM users WHERE email=$1 AND organization_id=$2`, [
        email,
        prOrgId,
      ]);
      const id = String(pr.rows?.[0]?.id || '');
      if (!id) return null;
      userIdMap.set(stagingId, id);
      prodUserIds.add(id);
      return id;
    }

    function remapUserLikeValue(v: any): any {
      if (typeof v !== 'string') return v;
      const mapped = userIdMap.get(v);
      return mapped ?? v;
    }

    function remapOrg(v: any): any {
      if (typeof v !== 'string') return v;
      if (v === stOrgId || v === stagingOrgId) return prOrgId;
      return v;
    }

    async function migrateSimpleTableByWhere(opts: {
      table: string;
      whereSql: string;
      params: any[];
      rowTransform?: (r: Row) => Promise<Row> | Row;
    }): Promise<Row[]> {
      const { table, whereSql, params, rowTransform } = opts;
      // Insert into production schema; use PROD columns (staging can have extra columns).
      const cols = await getTableColumns(prod, table);
      const res = await staging.query(`SELECT * FROM "${table}" WHERE ${whereSql}`, params);
      const rows = res.rows || [];
      stat(table).selected += rows.length;
      if (rows.length === 0) return [];

      let inserted = 0;
      let skipped = 0;
      for (const r of rows) {
        let out: Row = { ...r };
        if (rowTransform) out = await rowTransform(out);

        if ('organization_id' in out) out.organization_id = prOrgId;
        for (const c of cols) {
          if (USER_REF_COLUMNS.has(c) && out[c] != null) out[c] = remapUserLikeValue(out[c]);
        }
        const ir = await insertRowAppendOnly(prod, table, cols, out, dryRun);
        if (ir.inserted) inserted += 1;
        else skipped += 1;
      }
      stat(table).inserted += inserted;
      stat(table).skipped += skipped;
      return rows;
    }

    // ── 1) my_ideas (+ maps) — strictly Piotr's own
    const myIdeas = await migrateSimpleTableByWhere({
      table: 'my_ideas',
      whereSql: `organization_id=$1 AND user_id=$2`,
      params: [stOrgId, stUserId],
      rowTransform: (r) => {
        r.organization_id = prOrgId;
        r.user_id = prUserId;
        return r;
      },
    });
    const myIdeaIds = myIdeas.map((x) => String(x.id)).filter(Boolean);

    if (myIdeaIds.length) {
      await migrateSimpleTableByWhere({
        table: 'my_idea_maps',
        whereSql: `idea_id = ANY($1)`,
        params: [myIdeaIds],
        rowTransform: (r) => {
          r.organization_id = prOrgId;
          if (String(r.user_id || '') === stUserId) r.user_id = prUserId;
          return r;
        },
      });
    }

    // ── 2) tasks — Piotr assigned or Piotr reporter (plus aliases treated as Piotr)
    // Read all candidate tasks
    const tasksCols = await getTableColumns(prod, 'tasks');
    const taskRes = await staging.query(
      `SELECT * FROM tasks
       WHERE organization_id=$1 AND (
         assignee_id=$2 OR reporter_id=$2 OR reporter_id = ANY($3)
       )`,
      [stOrgId, stUserId, aliases]
    );
    const tasks = taskRes.rows || [];
    stat('tasks').selected += tasks.length;
    console.log(`📦 Candidate tasks: ${tasks.length}`);

    // Resolve user ids referenced by tasks (FK columns only)
    const taskUserFkCols = await getForeignKeyColumnsToUsers(prod, 'tasks');
    const referencedUserIds = new Set<string>();
    for (const t of tasks) {
      for (const c of taskUserFkCols) {
        const v = t[c];
        if (typeof v === 'string' && v) referencedUserIds.add(v);
      }
    }
    for (const id of referencedUserIds) {
      if (userIdMap.has(id)) continue;
      const mapped = await resolveProdUserIdFromStagingUserId(id);
      if (mapped) {
        // mapped
      }
    }

    // Keep only tasks where all FK-to-users are mappable (or null)
    const tasksFiltered: Row[] = [];
    const tasksSkippedUnmappedUsers: string[] = [];
    for (const t of tasks) {
      let ok = true;
      for (const c of taskUserFkCols) {
        const v = t[c];
        if (v == null || v === '') continue;
        // Raw staging rows: accept either an already-known staging mapping key, or a prod user id.
        if (typeof v === 'string' && (userIdMap.has(v) || prodUserIds.has(v))) continue;
        ok = false;
        break;
      }
      if (!ok) {
        tasksSkippedUnmappedUsers.push(String(t.id));
        continue;
      }
      tasksFiltered.push(t);
    }
    if (tasksSkippedUnmappedUsers.length) {
      console.log(
        `⚠ Skipping tasks due to unmapped user FK columns: ${tasksSkippedUnmappedUsers.length}`
      );
    }

    // Collect dependencies from tasks
    const projectIds = new Set<string>();
    const workstreamIds = new Set<string>();
    const facilityIds = new Set<string>();
    const initiativeIds = new Set<string>();
    for (const t of tasksFiltered) {
      if (t.project_id) projectIds.add(String(t.project_id));
      if (t.workstream_id) workstreamIds.add(String(t.workstream_id));
      if (t.facility_id) facilityIds.add(String(t.facility_id));
      if (t.initiative_id) initiativeIds.add(String(t.initiative_id));
    }

    async function migrateByIds(table: string, ids: string[]) {
      if (ids.length === 0) return;
      // Insert into production schema; use PROD columns (staging can have extra columns).
      const cols = await getTableColumns(prod, table);

      // If some rows already exist on prod, we can skip reading/inserting them.
      const existing = await selectExistingIds(prod, table, ids);
      const missing = ids.filter((id) => !existing.has(id));

      const res = await staging.query(`SELECT * FROM "${table}" WHERE id = ANY($1)`, [missing]);
      const rows = res.rows || [];
      stat(table).selected += rows.length;
      if (rows.length === 0) return;

      const fkToUsersCols = await getForeignKeyColumnsToUsers(prod, table);
      const allowUserFkFallbackToPiotr = new Set(['projects', 'workstreams', 'initiatives']);
      let fallbackApplied = 0;

      // Ensure all user ids referenced (FK) can be mapped to prod user ids
      for (const r of rows) {
        for (const c of fkToUsersCols) {
          const v = r[c];
          if (typeof v === 'string' && v && !userIdMap.has(v)) {
            await resolveProdUserIdFromStagingUserId(v);
          }
        }
      }

      let inserted = 0;
      let skipped = 0;
      const wouldExist = new Set<string>(existing);
      for (const r of rows) {
        const out: Row = { ...r };
        if ('organization_id' in out) out.organization_id = prOrgId;
        for (const c of cols) {
          if (USER_REF_COLUMNS.has(c) && out[c] != null) out[c] = remapUserLikeValue(out[c]);
          if (c === 'organization_id') out[c] = remapOrg(out[c]);
        }

        // For dependency tables, if FK-to-users is unmapped, fallback to Piotr (do not migrate other users).
        if (allowUserFkFallbackToPiotr.has(table)) {
          for (const c of fkToUsersCols) {
            const v = out[c];
            if (v == null || v === '') continue;
            if (typeof v === 'string' && prodUserIds.has(v)) continue;
            out[c] = prUserId;
            fallbackApplied += 1;
          }
        }

        // If FK-to-users column is present but unmapped, skip the row (don't create users).
        let ok = true;
        for (const c of fkToUsersCols) {
          const v = out[c];
          if (v == null || v === '') continue;
          if (typeof v === 'string' && prodUserIds.has(v)) continue;
          ok = false;
          break;
        }
        if (!ok) {
          skipped += 1;
          continue;
        }

        const ir = await insertRowAppendOnly(prod, table, cols, out, dryRun);
        if (ir.inserted) inserted += 1;
        else skipped += 1;
        if (ir.inserted && out.id) wouldExist.add(String(out.id));
      }
      stat(table).inserted += inserted;
      stat(table).skipped += skipped;
      if (fallbackApplied > 0) {
        console.log(`  ↪ ${table}: applied ${fallbackApplied} user-FK fallbacks → Piotr`);
      }
      // Return would-exist set so task checks can use it in dry-run too.
      ensuredIdsByTable.set(table, wouldExist);
    }

    // Dependencies first (FK-safe)
    const ensuredIdsByTable = new Map<string, Set<string>>();
    await migrateByIds('projects', [...projectIds]);
    await migrateByIds('workstreams', [...workstreamIds]);
    await migrateByIds('organization_facilities', [...facilityIds]);
    await migrateByIds('initiatives', [...initiativeIds]);

    // Finally insert tasks themselves
    // After dependencies run, refresh ensured sets from prod (WRITE) or use dry-run approximation.
    async function ensureTableIds(table: string, ids: string[]) {
      if (ids.length === 0) return;
      if (dryRun) return;
      const existing = await selectExistingIds(prod, table, ids);
      const prev = ensuredIdsByTable.get(table) || new Set<string>();
      for (const id of existing) prev.add(id);
      ensuredIdsByTable.set(table, prev);
    }
    await ensureTableIds('projects', [...projectIds]);
    await ensureTableIds('workstreams', [...workstreamIds]);
    await ensureTableIds('organization_facilities', [...facilityIds]);
    await ensureTableIds('initiatives', [...initiativeIds]);

    const existingTasks = await selectExistingIds(
      prod,
      'tasks',
      tasksFiltered.map((t) => String(t.id))
    );
    let tasksInserted = 0;
    let tasksSkipped = 0;
    for (const t of tasksFiltered) {
      const id = String(t.id);
      if (existingTasks.has(id)) {
        tasksSkipped += 1;
        continue;
      }
      const out: Row = { ...t };
      out.organization_id = prOrgId;

      // Remap all user-like columns (FK + non-FK)
      for (const c of tasksCols) {
        if (USER_REF_COLUMNS.has(c) && out[c] != null) out[c] = remapUserLikeValue(out[c]);
      }
      // Force Piotr aliases to prod user id
      for (const a of aliases) {
        if (out.assignee_id === a) out.assignee_id = prUserId;
        if (out.reporter_id === a) out.reporter_id = prUserId;
        if (out.escalated_to_id === a) out.escalated_to_id = prUserId;
      }

      // Ensure FK parents exist in prod, otherwise skip task (append-only, no partial FK breaks)
      const ensuredProjects = ensuredIdsByTable.get('projects') || new Set<string>();
      const ensuredWorkstreams = ensuredIdsByTable.get('workstreams') || new Set<string>();
      const ensuredFacilities = ensuredIdsByTable.get('organization_facilities') || new Set<string>();
      const ensuredInitiatives = ensuredIdsByTable.get('initiatives') || new Set<string>();

      if (out.project_id && !ensuredProjects.has(String(out.project_id))) {
        tasksSkipped += 1;
        continue;
      }
      if (out.workstream_id && !ensuredWorkstreams.has(String(out.workstream_id))) {
        tasksSkipped += 1;
        continue;
      }
      if (out.facility_id && !ensuredFacilities.has(String(out.facility_id))) {
        tasksSkipped += 1;
        continue;
      }
      if (out.initiative_id && !ensuredInitiatives.has(String(out.initiative_id))) {
        tasksSkipped += 1;
        continue;
      }

      // Ensure FK-to-users columns are mapped
      let ok = true;
      for (const c of taskUserFkCols) {
        const v = out[c];
        if (v == null || v === '') continue;
        if (typeof v === 'string' && prodUserIds.has(v)) continue;
        ok = false;
        break;
      }
      if (!ok) {
        tasksSkipped += 1;
        continue;
      }

      const ir = await insertRowAppendOnly(prod, 'tasks', tasksCols, out, dryRun);
      if (ir.inserted) tasksInserted += 1;
      else tasksSkipped += 1;
    }
    stat('tasks').inserted += tasksInserted;
    stat('tasks').skipped += tasksSkipped;

    // ── Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Done (${dryRun ? 'DRY-RUN' : 'WRITE'})`);
    const ordered = Object.keys(stats).sort();
    for (const t of ordered) {
      const s = stats[t]!;
      console.log(`- ${t}: selected=${s.selected} inserted=${s.inserted} skipped=${s.skipped}`);
    }
    console.log(`- fingerprint: ${sha1Json(stats)}\n`);
    if (dryRun) {
      console.log('Next: rerun with `--write` to execute the inserts.\n');
    }
  } finally {
    await staging.end();
    await prod.end();
  }
}

// Keep Node/tsx happy on macOS when invoked directly
if (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1]?.endsWith('migrate-piotr-business-staging-to-prod.ts')) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌ Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

