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
 *
 * Optional:
 *   CLONE_PURGE_TARGET=1  — before insert, delete existing rows for TARGET org in copied
 *                           tables (use when refreshing a demo tenant).
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

/**
 * Lower = inserted earlier. Previously rows were inserted in COUNT DESC order so `tasks`
 * ran before `projects`/`initiatives`, causing FK failures and almost no data for Anna.
 */
const TABLE_INSERT_PRIORITY: Record<string, number> = {
  // Foundation
  teams: 20,
  locations: 22,
  custom_roles: 24,
  custom_statuses: 26,
  kpi_definitions: 28,
  help_progress: 29,
  my_work_session_context: 30,
  // Containers
  projects: 40,
  chat_projects: 42,
  knowledge_collections: 44,
  notebook_pages: 160,
  presentation_decks: 162,
  // Initiatives & finance parents
  initiatives: 60,
  initiative_templates: 62,
  initiative_benefits: 64,
  initiative_kpis: 66,
  benefit_targets: 68,
  financial_statement_packs: 70,
  financial_statements: 72,
  financial_statement_line_aliases: 74,
  budgets: 76,
  financial_models: 78,
  valuations: 80,
  financial_analyses: 82,
  // Planning / workflows
  approval_workflows: 90,
  approval_requests: 92,
  assessments: 94,
  assessment_reports: 96,
  management_reports: 98,
  // Primary work objects (depend on projects/initiatives)
  decisions: 110,
  tasks: 120,
  task_dependencies: 125,
  raid_items: 130,
  canonical_inbox_items: 135,
  // Comms & sessions
  conversations: 150,
  collab_sessions: 152,
  tool_sessions: 154,
  tool_session_presence: 156,
  link_graph_edges: 158,
  // Interview graph
  interview_templates: 170,
  interview_library_templates: 172,
  interview_sessions: 180,
  interview_assignments: 185,
  interview_questions: 188,
  interview_evidence: 190,
  interview_insights: 192,
  ai_conversations: 200,
  ai_chat_runs: 205,
  // Radar / signals
  radar_ranked_signals: 210,
  radar_actions: 212,
  user_radar_profiles: 214,
  threat_intelligence: 216,
  // Notifications & misc mid-tier
  notifications: 230,
  usage_counters: 232,
  system_feedback: 234,
  feedback_items: 236,
  support_tickets: 238,
  dlp_policies: 240,
  dlp_violations: 242,
  conversion_events: 244,
  journey_events: 246,
  knowledge_graph_entities: 250,
  my_ideas: 252,
  my_idea_maps: 254,
  tool_works: 256,
  tool_feedback: 258,
  ai_actions: 260,
  ai_actions_log: 262,
  ai_actions_config: 264,
  ai_budgets: 266,
  ai_instructions_org: 268,
  ai_org_memory: 270,
  ai_learning_patterns: 272,
  ai_cost_usage: 274,
  ai_usage_logs: 276,
  executive_insights_cache: 280,
  executive_aggregate_cache: 282,
  analytics_snapshots: 284,
  status_reports: 286,
  custom_dashboards: 288,
  custom_reports: 290,
  report_builder_reports: 292,
  report_public_links: 294,
  report_schedules: 296,
  saved_reports: 298,
  session_configurations: 300,
  enterprise_feature_flags: 302,
  organization_branding: 304,
  organization_context: 306,
  organization_context_claims: 308,
  organization_context_items: 310,
  organization_context_snapshots: 312,
  organization_style_profiles: 314,
  public_mini_assessments: 316,
  assessment_pdf_imports: 318,
  assessment_initiative_generation_runs: 320,
  lessons_learned: 322,
  prompt_usage_log: 324,
  user_activity: 326,
  audit_statistics: 328,
  audit_alerts: 330,
  // Logs — late (high volume)
  activity_logs: 900,
  audit_log: 902,
};

function sortTablesForInsert(a: { name: string }, b: { name: string }): number {
  const pa = TABLE_INSERT_PRIORITY[a.name] ?? 500;
  const pb = TABLE_INSERT_PRIORITY[b.name] ?? 500;
  if (pa !== pb) return pa - pb;
  return a.name.localeCompare(b.name);
}

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
  idMap.clear();
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

    allTableData.sort(sortTablesForInsert);
    console.log(`  ID map size: ${idMap.size} entries (insert order: FK-safe)`);

    if (dryRun) {
      const total = allTableData.reduce((sum, t) => sum + t.rows.length, 0) + (convMsgsData?.rows.length || 0);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 DRY-RUN SUMMARY: ~${total} rows would be copied`);
      console.log('   Run with --write to execute.');
      console.log(`${'='.repeat(60)}\n`);
      return;
    }

    // ── Step 4: Insert all data with remapped IDs (multi-pass for residual FKs) ──
    console.log('\n📋 Step 4: Inserting data with remapped IDs...\n');

    if (process.env.CLONE_PURGE_TARGET === '1') {
      console.log('  🗑 CLONE_PURGE_TARGET=1 — deleting existing target-org rows first...');
      try {
        const cm = await pool.query(
          `DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE organization_id = $1)`,
          [TARGET_ORG_ID]
        );
        console.log(`    conversation_messages removed: ${cm.rowCount ?? 0}`);
      } catch (e) {
        console.warn('    conversation_messages purge skipped:', e instanceof Error ? e.message : e);
      }
      for (const t of [...allTableData].reverse()) {
        try {
          const del = await pool.query(`DELETE FROM "${t.name}" WHERE organization_id = $1`, [
            TARGET_ORG_ID,
          ]);
          if ((del.rowCount ?? 0) > 0) {
            console.log(`    purged ${t.name}: ${del.rowCount}`);
          }
        } catch (e) {
          console.warn(`    purge skip ${t.name}:`, e instanceof Error ? e.message.slice(0, 120) : e);
        }
      }
    }

    let totalCopied = 0;
    let totalSkipped = 0;

    type RowJob = { tableData: TableData; row: Record<string, unknown> };
    const insertQueue: RowJob[] = [];
    for (const tableData of allTableData) {
      for (const row of tableData.rows) {
        insertQueue.push({ tableData, row });
      }
    }

    function isFkViolation(msg: string): boolean {
      const m = msg.toLowerCase();
      return m.includes('foreign key') || m.includes('violates foreign key');
    }

    let pass = 0;
    let queue = insertQueue;
    const perTableStats = new Map<string, { ok: number; skip: number }>();

    while (queue.length > 0 && pass < 60) {
      const nextRound: RowJob[] = [];
      let insertedThisPass = 0;

      for (const { tableData, row } of queue) {
        const { name: tableName, columns, pkColumns } = tableData;
        const userRefCols = columns.filter((c) => USER_REF_COLUMNS.has(c));
        const fkRefCols = columns.filter((c) => FK_REF_COLUMNS.has(c));

        const newRow: Record<string, unknown> = { ...row };
        newRow['organization_id'] = TARGET_ORG_ID;

        for (const pk of pkColumns) {
          const oldVal = String(row[pk] || '');
          if (oldVal && idMap.has(oldVal)) {
            newRow[pk] = idMap.get(oldVal);
          }
        }

        for (const col of userRefCols) {
          if (newRow[col] != null) {
            newRow[col] = remapUser(newRow[col]);
          }
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
            `INSERT INTO "${tableName}" (${cols.map((c) => `"${c}"`).join(', ')})
             VALUES (${placeholders.join(', ')})
             ON CONFLICT DO NOTHING`,
            values
          );
          const st = perTableStats.get(tableName) || { ok: 0, skip: 0 };
          if ((ins.rowCount ?? 0) > 0) {
            st.ok++;
            insertedThisPass++;
            totalCopied++;
          } else {
            st.skip++;
            totalSkipped++;
          }
          perTableStats.set(tableName, st);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          const st = perTableStats.get(tableName) || { ok: 0, skip: 0 };
          if (isFkViolation(msg)) {
            nextRound.push({ tableData, row });
          } else {
            st.skip++;
            totalSkipped++;
            if (pass === 0 && st.skip <= 3 && !msg.includes('duplicate') && !msg.includes('unique')) {
              console.warn(`    ⚠ ${tableName}: ${msg.slice(0, 150)}`);
            }
          }
          perTableStats.set(tableName, st);
        }
      }

      queue = nextRound;
      pass++;
      if (insertedThisPass > 0 || queue.length > 0) {
        console.log(`  pass ${pass}: +${insertedThisPass} rows, FK backlog: ${queue.length}`);
      }
      if (queue.length === 0) break;
      if (insertedThisPass === 0) {
        console.error(
          `  ⚠ No progress with ${queue.length} rows left — check FK gaps / purge target org (CLONE_PURGE_TARGET=1).`
        );
        break;
      }
    }

    for (const tableData of allTableData) {
      const st = perTableStats.get(tableData.name);
      if (!st || (st.ok === 0 && st.skip === 0)) continue;
      console.log(
        `  ✓ ${tableData.name}: ${st.ok}/${tableData.rows.length} inserted (${st.skip} skip/conflict)`
      );
    }

    // Insert conversation messages (after conversations exist; retry FK)
    if (convMsgsData) {
      const { columns, pkColumns, rows } = convMsgsData;
      const userRefCols = columns.filter((c) => USER_REF_COLUMNS.has(c));
      const fkRefCols = columns.filter((c) => FK_REF_COLUMNS.has(c));
      let msgQueue: Record<string, unknown>[] = [...rows];
      let msgCopied = 0;
      let msgPass = 0;
      while (msgQueue.length > 0 && msgPass < 25) {
        const nextMsgs: Record<string, unknown>[] = [];
        let insThis = 0;
        for (const row of msgQueue) {
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
            if ((ins.rowCount ?? 0) > 0) {
              msgCopied++;
              insThis++;
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (isFkViolation(msg)) nextMsgs.push(row);
          }
        }
        msgQueue = nextMsgs;
        msgPass++;
        if (insThis === 0 && msgQueue.length > 0) break;
      }
      console.log(`  ✓ conversation_messages: ${msgCopied}/${rows.length} (${msgQueue.length} remaining)`);
      totalCopied += msgCopied;
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
