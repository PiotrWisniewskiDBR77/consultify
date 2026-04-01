#!/usr/bin/env tsx
/**
 * clone-dbr77-to-atelier.ts
 *
 * Clones all meaningful data from DBR77 org to Atelier org.
 *
 * Strategy:
 * - New UUIDs for all copied rows (to avoid PK conflicts)
 * - Maintains an id-mapping across all tables so FK references stay consistent
 * - Remaps organization_id to 'atelier'
 * - Remaps user references to atelier team members
 *
 * Usage:
 *   npx tsx server/scripts/clone-dbr77-to-atelier.ts              # dry-run
 *   npx tsx server/scripts/clone-dbr77-to-atelier.ts --write      # execute
 */

import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

import {
  logSelectedDatabaseTarget,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

const SOURCE_ORG_ID = process.env.CLONE_SOURCE_ORG_ID?.trim() || 'dbr77';
/** Production tenant for Anna — slug in DB is `atelier` (not always equal to DEMO_ORG_ID). */
const TARGET_ORG_ID = process.env.CLONE_TARGET_ORG_ID?.trim() || 'atelier';

const SKIP_TABLES = new Set([
  'api_logs', 'users', 'organization_members',
  'digitization_comparisons', 'initiative_financials', 'initiative_quality_assessment',
  'tp_scim_tokens', 'tp_service_accounts', 'tp_sso_configs', 'partner_client_organizations',
  'access_codes', 'sso_configs', 'sso_login_attempts', 'scim_configurations', 'scim_sync_log',
  'ip_whitelist', 'mobile_devices', 'integration_api_keys',
  'usage_counters', 'usage_alerts_sent', 'org_security_settings',
  'organization_limits', 'organization_discounts', 'consent_records',
  'customer_contracts', 'customer_health_scores', 'churn_warnings',
  'tier_round_robin_state', 'enterprise_feature_flags',
  'dbr77_benchmarks', 'dbr77_insights', 'dbr77_assessments',
]);

const LOG_TABLES = new Set(['activity_logs', 'audit_log', 'ai_usage_logs']);
const LOG_LIMIT = 300;

const USER_REF_COLUMNS = new Set([
  'user_id', 'created_by', 'owner_id', 'assigned_to', 'decision_owner_id',
  'author_user_id', 'owner_user_id', 'performed_by', 'sender_id',
  'updated_by', 'approved_by', 'reviewer_id', 'assignee_id', 'reporter_id',
  'escalated_to_id', 'facilitator_id', 'moderator_id',
]);

// Columns that reference other table IDs (FK columns to remap)
const FK_REF_COLUMNS = new Set([
  'project_id', 'initiative_id', 'task_id', 'decision_id', 'conversation_id',
  'assessment_id', 'team_id', 'parent_id', 'parent_task_id',
  'interview_template_id', 'template_id', 'session_id', 'tool_session_id',
  'notebook_id', 'collection_id', 'report_id', 'deck_id',
  'budget_id', 'model_id', 'statement_id', 'pack_id',
  'workflow_id', 'kpi_id', 'source_id', 'target_id',
  'base_id', 'table_id', 'view_id', 'field_id',
]);

// Global ID mapping: old ID → new ID (shared across all tables)
const idMap = new Map<string, string>();

function mapId(oldId: string): string {
  if (!oldId) return oldId;
  let newId = idMap.get(oldId);
  if (!newId) {
    newId = uuidv4();
    idMap.set(oldId, newId);
  }
  return newId;
}

async function main() {
  const isWrite = process.argv.includes('--write');
  const dryRun = !isWrite;

  console.log(
    `\n🔄 Clone ${SOURCE_ORG_ID} → ${TARGET_ORG_ID} (${dryRun ? 'DRY-RUN' : 'WRITE MODE'})\n`
  );

  const dbTarget = resolveScriptDatabaseTarget({
    label: 'clone-dbr77-to-atelier',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  logSelectedDatabaseTarget('clone-dbr77-to-atelier', dbTarget);

  const pool = new pg.Pool({ connectionString: dbTarget.connectionString });

  try {
    // ── Step 1: User mapping ──
    console.log('\n📋 Step 1: Building user mapping...');

    let annaId: string;
    const annaCheck = await pool.query(`SELECT id FROM users WHERE email = $1`, ['anna.zielinska@ateliertoys-demo.com']);
    if (annaCheck.rows.length > 0) {
      annaId = annaCheck.rows[0].id;
      console.log(`  ✓ anna.zielinska@ateliertoys-demo.com exists (${annaId})`);
    } else if (dryRun) {
      annaId = uuidv4();
      console.log('  → Would create: anna.zielinska@ateliertoys-demo.com');
    } else {
      annaId = uuidv4();
      await pool.query(
        `INSERT INTO users (id, email, first_name, last_name, role, organization_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW()) ON CONFLICT (email) DO NOTHING`,
        [annaId, 'anna.zielinska@ateliertoys-demo.com', 'Anna', 'Zielińska', 'OWNER', TARGET_ORG_ID]
      );
      console.log(`  ✓ Created anna.zielinska@ateliertoys-demo.com (${annaId})`);
    }

    // Get atelier team
    const atelierTeam = await pool.query(
      `SELECT id FROM users WHERE organization_id = $1
       AND email NOT LIKE '%test%' AND email NOT LIKE '%demo%'
       AND email NOT LIKE '%seed%' AND email NOT LIKE '%debug%'
       AND email NOT LIKE '%smoke%' AND email NOT LIKE '%cursor%'
       AND email NOT LIKE '%mindmap%' AND email NOT LIKE '%import%'
       AND email NOT LIKE '%verify%'`,
      [TARGET_ORG_ID]
    );
    const targetUserIds: string[] = atelierTeam.rows.map((r: { id: string }) => r.id);
    if (!targetUserIds.includes(annaId)) targetUserIds.unshift(annaId);

    // Get all dbr77 users
    const dbr77Users = await pool.query(`SELECT id FROM users WHERE organization_id = $1`, [SOURCE_ORG_ID]);
    const sourceUserIds: string[] = dbr77Users.rows.map((r: { id: string }) => r.id);

    // Build user map
    const userMap = new Map<string, string>();
    // Owner → Anna
    userMap.set('bf0f01a2-9ada-4cb8-a331-4dce1930e4f3', annaId);
    let uidx = 0;
    for (const srcId of sourceUserIds) {
      if (!userMap.has(srcId)) {
        userMap.set(srcId, targetUserIds[uidx % targetUserIds.length]!);
        uidx++;
      }
    }
    console.log(`  Mapped ${userMap.size} source → ${targetUserIds.length} target users`);

    function remapUser(value: unknown): unknown {
      if (typeof value !== 'string') return value;
      return userMap.get(value) ?? annaId;
    }

    // ── Step 2: Discover tables ──
    console.log('\n📋 Step 2: Discovering tables...');

    const tablesResult = await pool.query(`
      SELECT table_name,
        (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count
      FROM (
        SELECT table_name,
          query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I WHERE organization_id = %L', table_name, '${SOURCE_ORG_ID}'), false, true, '') AS xml_count
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'organization_id'
          AND data_type IN ('text', 'character varying')
        GROUP BY table_name
      ) sub
      WHERE (xpath('/row/cnt/text()', xml_count))[1]::text::int > 0
      ORDER BY (xpath('/row/cnt/text()', xml_count))[1]::text::int DESC
    `);

    const tablesToCopy = tablesResult.rows.filter(
      (r: { table_name: string }) => !SKIP_TABLES.has(r.table_name)
    );
    console.log(`  Found ${tablesToCopy.length} tables\n`);

    // ── Step 3: First pass — read all source data and build ID map ──
    console.log('📋 Step 3: Reading source data and building ID map...');

    type TableData = {
      name: string;
      columns: string[];
      pkColumns: string[];
      rows: Record<string, unknown>[];
    };

    const allTableData: TableData[] = [];

    for (const tableInfo of tablesToCopy) {
      const tableName = tableInfo.table_name as string;
      const sourceCount = tableInfo.row_count as number;
      const isLog = LOG_TABLES.has(tableName);
      const limit = isLog ? LOG_LIMIT : 10000;

      const colResult = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [tableName]
      );
      const columns: string[] = colResult.rows.map((r: { column_name: string }) => r.column_name);

      const pkResult = await pool.query(
        `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = $1::regclass AND i.indisprimary`,
        [tableName]
      );
      const pkColumns: string[] = pkResult.rows.map((r: { attname: string }) => r.attname);

      let sourceRows;
      try {
        sourceRows = await pool.query(
          `SELECT * FROM "${tableName}" WHERE organization_id = $1 LIMIT $2`,
          [SOURCE_ORG_ID, limit]
        );
      } catch {
        continue;
      }

      if (sourceRows.rows.length === 0) continue;

      // Register all PKs in the ID map
      for (const row of sourceRows.rows) {
        for (const pk of pkColumns) {
          const val = String(row[pk] || '');
          if (val) mapId(val);
        }
      }

      allTableData.push({
        name: tableName,
        columns,
        pkColumns,
        rows: sourceRows.rows,
      });

      if (dryRun) {
        const suffix = isLog && sourceCount > limit ? ` (sampling ${limit}/${sourceCount})` : '';
        console.log(`  📊 ${tableName}: ${sourceRows.rows.length} rows${suffix}`);
      }
    }

    // Also read conversation_messages
    const convCheck = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_messages') AS exists`
    );
    let convMsgsData: TableData | null = null;
    if (convCheck.rows[0]?.exists) {
      const srcConvs = await pool.query(`SELECT id FROM conversations WHERE organization_id = $1`, [SOURCE_ORG_ID]);
      const srcConvIds = srcConvs.rows.map((r: { id: string }) => r.id);
      if (srcConvIds.length > 0) {
        const msgs = await pool.query(
          `SELECT * FROM conversation_messages WHERE conversation_id = ANY($1) LIMIT 3000`,
          [srcConvIds]
        );
        if (msgs.rows.length > 0) {
          const colResult = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_messages' ORDER BY ordinal_position`
          );
          const columns: string[] = colResult.rows.map((r: { column_name: string }) => r.column_name);
          const pkResult = await pool.query(
            `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = 'conversation_messages'::regclass AND i.indisprimary`
          );
          const pkColumns: string[] = pkResult.rows.map((r: { attname: string }) => r.attname);

          for (const row of msgs.rows) {
            for (const pk of pkColumns) {
              const val = String(row[pk] || '');
              if (val) mapId(val);
            }
          }

          convMsgsData = { name: 'conversation_messages', columns, pkColumns, rows: msgs.rows };
          if (dryRun) console.log(`  📊 conversation_messages: ${msgs.rows.length} rows`);
        }
      }
    }

    console.log(`  ID map size: ${idMap.size} entries`);

    if (dryRun) {
      const total = allTableData.reduce((sum, t) => sum + t.rows.length, 0) + (convMsgsData?.rows.length || 0);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 DRY-RUN SUMMARY: ~${total} rows would be copied`);
      console.log('   Run with --write to execute.');
      console.log(`${'='.repeat(60)}\n`);
      return;
    }

    // ── Step 4: Insert all data with remapped IDs ──
    console.log('\n📋 Step 4: Inserting data with remapped IDs...\n');

    let totalCopied = 0;
    let totalSkipped = 0;

    for (const tableData of allTableData) {
      const { name: tableName, columns, pkColumns, rows } = tableData;
      const userRefCols = columns.filter((c) => USER_REF_COLUMNS.has(c));
      const fkRefCols = columns.filter((c) => FK_REF_COLUMNS.has(c));

      let copied = 0;
      let skipped = 0;

      for (const row of rows) {
        const newRow: Record<string, unknown> = { ...row };

        // Remap org
        newRow['organization_id'] = TARGET_ORG_ID;

        // Remap PK
        for (const pk of pkColumns) {
          const oldVal = String(row[pk] || '');
          if (oldVal && idMap.has(oldVal)) {
            newRow[pk] = idMap.get(oldVal);
          }
        }

        // Remap user references
        for (const col of userRefCols) {
          if (newRow[col] != null) {
            newRow[col] = remapUser(newRow[col]);
          }
        }

        // Remap FK references using the global ID map
        for (const col of fkRefCols) {
          if (newRow[col] != null && typeof newRow[col] === 'string') {
            const mapped = idMap.get(newRow[col] as string);
            if (mapped) newRow[col] = mapped;
          }
        }

        const cols = columns.filter((c) => newRow[c] !== undefined);
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const values = cols.map((c) => newRow[c]);

        try {
          const ins = await pool.query(
            `INSERT INTO "${tableName}" (${cols.map((c) => `"${c}"`).join(', ')})
             VALUES (${placeholders.join(', ')})
             ON CONFLICT DO NOTHING`,
            values
          );
          if ((ins.rowCount ?? 0) > 0) copied++;
          else skipped++;
        } catch (err: unknown) {
          skipped++;
          const msg = err instanceof Error ? err.message : String(err);
          if (skipped <= 2 && !msg.includes('duplicate') && !msg.includes('unique')) {
            console.warn(`    ⚠ ${tableName}: ${msg.slice(0, 150)}`);
          }
        }
      }

      if (copied > 0 || skipped > 0) {
        const suffix = skipped > 0 ? ` (${skipped} skipped)` : '';
        console.log(`  ✓ ${tableName}: ${copied}/${rows.length}${suffix}`);
      }
      totalCopied += copied;
      totalSkipped += skipped;
    }

    // Insert conversation messages
    if (convMsgsData) {
      const { columns, pkColumns, rows } = convMsgsData;
      const userRefCols = columns.filter((c) => USER_REF_COLUMNS.has(c));
      const fkRefCols = columns.filter((c) => FK_REF_COLUMNS.has(c));
      let copied = 0;

      for (const row of rows) {
        const newRow: Record<string, unknown> = { ...row };

        for (const pk of pkColumns) {
          const oldVal = String(row[pk] || '');
          if (oldVal && idMap.has(oldVal)) newRow[pk] = idMap.get(oldVal);
        }
        for (const col of userRefCols) {
          if (newRow[col] != null) newRow[col] = remapUser(newRow[col]);
        }
        for (const col of fkRefCols) {
          if (newRow[col] != null && typeof newRow[col] === 'string') {
            const mapped = idMap.get(newRow[col] as string);
            if (mapped) newRow[col] = mapped;
          }
        }

        const cols = columns.filter((c) => newRow[c] !== undefined);
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const values = cols.map((c) => newRow[c]);

        try {
          const ins = await pool.query(
            `INSERT INTO conversation_messages (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING`,
            values
          );
          if ((ins.rowCount ?? 0) > 0) copied++;
        } catch { /* skip */ }
      }
      console.log(`  ✓ conversation_messages: ${copied}/${rows.length}`);
      totalCopied += copied;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Clone complete. ${SOURCE_ORG_ID} → ${TARGET_ORG_ID}`);
    console.log(`   Owner: anna.zielinska@ateliertoys-demo.com (${annaId})`);
    console.log(`   Rows copied: ${totalCopied}`);
    if (totalSkipped > 0) console.log(`   Rows skipped: ${totalSkipped}`);
    console.log(`${'='.repeat(60)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Clone failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
