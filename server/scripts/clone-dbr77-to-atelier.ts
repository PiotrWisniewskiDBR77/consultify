#!/usr/bin/env tsx
/**
 * clone-dbr77-to-atelier.ts
 *
 * Clones meaningful data from DBR77 → tenant `atelier`, remapping `organization_id`
 * and user FKs so Piotr’s production snapshot is owned in Atelier by
 * anna.zielinska@ateliertoys-demo.com.
 *
 * Includes a deferred pass for initiative economics (financials, quality, benefit
 * tracking, assumptions history) so initiative_id / analysis_id / financial_id line up.
 *
 * From a laptop against Railway Postgres use DATABASE_PUBLIC_URL (see databaseTargetResolver).
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

// ─── Constants ───────────────────────────────────────────────────────

const SOURCE_ORG_ID = 'dbr77';
const TARGET_ORG_ID = 'atelier';

// DBR77 real users (from production)
const SOURCE_USERS: Record<string, string> = {
  'bf0f01a2-9ada-4cb8-a331-4dce1930e4f3': 'piotr.wisniewski@dbr77.com',
  'a56a9c4c-ece3-41f8-add3-d8408e87455e': 'tomasz.jankowski@dbr77.com',
  '58266f8d-c9ee-4c0f-beda-29e15c5d7f29': 'bartek.straszak@dbr77.com',
  'b7c8d75a-66b0-455e-b78b-869a3d5dd1b8': 'konrad.milewski@dbr77.com',
  '2587cff3-73b4-427a-8393-0c1bcccde603': 'justyna.laskowska@dbr77.com',
  'cf852e23-2fed-4e57-be15-707ac38f3ad9': 'katarzyna.szreniawska@dbr77.com',
  'f5f2ed84-57bf-4688-ad2f-c84006e459a9': 'katarzyna.szwarocka@dbr77.com',
  'cc134dda-e387-442b-9e36-6866e880c6fe': 'pawel.dera@dbr77.com',
  '49762b4f-035d-4716-9401-ea8417549a6f': 'pawel.mroczkowski@dbr77.com',
  'a87ad39d-e0f4-4cd0-a518-4575cd1d8e9a': 'admin@dbr77.com',
};

// Atelier target team
const ATELIER_USERS = [
  { email: 'anna.zielinska@ateliertoys-demo.com', first_name: 'Anna', last_name: 'Zielińska', role: 'OWNER' },
  { email: 'marc.dubois@atelier.com', first_name: 'Marc', last_name: 'Dubois', role: 'ADMIN' },
  { email: 'claire.laurent@atelier.com', first_name: 'Claire', last_name: 'Laurent', role: 'ADMIN' },
  { email: 'julien.moreau@atelier.com', first_name: 'Julien', last_name: 'Moreau', role: 'ADMIN' },
  { email: 'isabelle.leroy@atelier.com', first_name: 'Isabelle', last_name: 'Leroy', role: 'ADMIN' },
  { email: 'antoine.laurent@atelier.com', first_name: 'Antoine', last_name: 'Laurent', role: 'ADMIN' },
];

// Tables to skip entirely (logs, system, or non-text org_id)
const SKIP_TABLES = new Set([
  'api_logs',
  'users',
  'digitization_comparisons',
  'tp_scim_tokens',
  'tp_service_accounts',
  'tp_sso_configs',
  'partner_client_organizations',
]);

// Copied after main pass using initiative / analysis id maps (FKs to initiatives & analyses)
const DEFERRED_ECONOMICS_TABLES = new Set([
  'initiative_financials',
  'initiative_quality_assessment',
  'benefit_tracking',
  'financial_assumptions_history',
]);

// Tables that are high-volume logs — copy limited sample
const LOG_TABLES = new Set(['activity_logs', 'audit_log', 'ai_usage_logs']);
const LOG_SAMPLE_LIMIT = 200;

// ─── Helpers ─────────────────────────────────────────────────────────

function newId(): string {
  return uuidv4();
}

async function copyDeferredEconomics(
  pool: pg.Pool,
  params: {
    dryRun: boolean;
    sourceOrgId: string;
    targetOrgId: string;
    initiativeIdMap: Map<string, string>;
    analysisIdMap: Map<string, string>;
    userMap: Map<string, string>;
    annaId: string;
  }
): Promise<{ copied: number; skipped: number }> {
  const { dryRun, sourceOrgId, targetOrgId, initiativeIdMap, analysisIdMap, userMap, annaId } =
    params;
  let copied = 0;
  let skipped = 0;

  const tableExists = async (name: string): Promise<boolean> => {
    const r = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS e`,
      [name]
    );
    return Boolean(r.rows[0]?.e);
  };

  if (!(await tableExists('initiative_financials'))) {
    console.log('  (no initiative_financials — skip economics defer pass)');
    return { copied: 0, skipped: 0 };
  }

  async function selectForOrg(table: string): Promise<{ rows: Record<string, unknown>[] }> {
    try {
      return await pool.query(`SELECT * FROM "${table}" WHERE organization_id::text = $1`, [
        sourceOrgId,
      ]);
    } catch {
      return await pool.query(`SELECT * FROM "${table}" WHERE organization_id = $1`, [
        sourceOrgId,
      ]);
    }
  }

  const financialRowsRaw = await selectForOrg('initiative_financials');
  const financialRows = financialRowsRaw.rows;

  if (dryRun) {
    const qCount = await selectForOrg('initiative_quality_assessment');
    const btCount = await selectForOrg('benefit_tracking');
    console.log(`  📊 initiative_financials: ${financialRows.length} rows`);
    console.log(`  📊 initiative_quality_assessment: ${qCount.rows.length} rows`);
    console.log(`  📊 benefit_tracking: ${btCount.rows.length} rows`);
    if (await tableExists('financial_assumptions_history')) {
      const oldFinIds = financialRows.map((r) => String(r['id'] ?? '')).filter(Boolean);
      let histN = 0;
      if (oldFinIds.length > 0) {
        const h = await pool.query(
          `SELECT COUNT(*)::int AS c FROM financial_assumptions_history WHERE financial_id = ANY($1::text[])`,
          [oldFinIds]
        );
        histN = h.rows[0]?.c ?? 0;
      }
      console.log(`  📊 financial_assumptions_history: ${histN} rows`);
    }
    return {
      copied: financialRows.length + qCount.rows.length + btCount.rows.length,
      skipped: 0,
    };
  }

  const financialIdMap = new Map<string, string>();

  const insertDynamic = async (table: string, newRow: Record<string, unknown>) => {
    const cols = Object.keys(newRow).filter((c) => newRow[c] !== undefined);
    if (cols.length === 0) return;
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const values = cols.map((c) => newRow[c]);
    await pool.query(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING`,
      values
    );
  };

  const colNames = async (table: string): Promise<string[]> => {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    return r.rows.map((x: { column_name: string }) => x.column_name);
  };

  const finCols = await colNames('initiative_financials');

  for (const row of financialRows) {
    const oldFinId = String(row['id'] ?? '');
    const oldInitId = String(row['initiative_id'] ?? '');
    const newInitId = initiativeIdMap.get(oldInitId);
    if (!oldFinId || !newInitId) {
      skipped++;
      continue;
    }
    const newFinId = newId();
    financialIdMap.set(oldFinId, newFinId);

    const newRow: Record<string, unknown> = {};
    for (const c of finCols) {
      newRow[c] = row[c];
    }
    newRow['id'] = newFinId;
    newRow['initiative_id'] = newInitId;
    newRow['organization_id'] = targetOrgId;

    if (finCols.includes('analysis_id')) {
      const aId = row['analysis_id'];
      if (aId != null && typeof aId === 'string') {
        newRow['analysis_id'] = analysisIdMap.get(aId) ?? null;
      }
    }

    if (finCols.includes('created_by')) {
      const cr = row['created_by'];
      if (cr != null && typeof cr === 'string') {
        newRow['created_by'] = userMap.get(cr) ?? annaId;
      }
    }

    try {
      await insertDynamic('initiative_financials', newRow);
      copied++;
    } catch {
      skipped++;
    }
  }

  if (await tableExists('initiative_quality_assessment')) {
    const qaRaw = await selectForOrg('initiative_quality_assessment');
    const qaCols = await colNames('initiative_quality_assessment');
    for (const row of qaRaw.rows) {
      const oldInitId = String(row['initiative_id'] ?? '');
      const oldFinId = row['financial_id'] != null ? String(row['financial_id']) : '';
      const newInitId = initiativeIdMap.get(oldInitId);
      const newFinId = oldFinId ? financialIdMap.get(oldFinId) : undefined;
      if (!newInitId) {
        skipped++;
        continue;
      }
      const newRow: Record<string, unknown> = {};
      for (const c of qaCols) {
        newRow[c] = row[c];
      }
      newRow['id'] = newId();
      newRow['initiative_id'] = newInitId;
      newRow['organization_id'] = targetOrgId;
      newRow['financial_id'] = newFinId ?? null;
      if (qaCols.includes('assessed_by')) {
        const ab = row['assessed_by'];
        if (ab != null && typeof ab === 'string') {
          newRow['assessed_by'] = userMap.get(ab) ?? annaId;
        }
      }
      try {
        await insertDynamic('initiative_quality_assessment', newRow);
        copied++;
      } catch {
        skipped++;
      }
    }
  }

  if (await tableExists('benefit_tracking')) {
    const btRaw = await selectForOrg('benefit_tracking');
    const btCols = await colNames('benefit_tracking');
    for (const row of btRaw.rows) {
      const oldFinId = String(row['financial_id'] ?? '');
      const oldInitId = String(row['initiative_id'] ?? '');
      const newFinId = financialIdMap.get(oldFinId);
      const newInitId = initiativeIdMap.get(oldInitId);
      if (!newFinId || !newInitId) {
        skipped++;
        continue;
      }
      const newRow: Record<string, unknown> = {};
      for (const c of btCols) {
        newRow[c] = row[c];
      }
      newRow['id'] = newId();
      newRow['financial_id'] = newFinId;
      newRow['initiative_id'] = newInitId;
      newRow['organization_id'] = targetOrgId;
      if (btCols.includes('verified_by')) {
        const vb = row['verified_by'];
        if (vb != null && typeof vb === 'string') {
          newRow['verified_by'] = userMap.get(vb) ?? annaId;
        }
      }
      if (btCols.includes('created_by')) {
        const cb = row['created_by'];
        if (cb != null && typeof cb === 'string') {
          newRow['created_by'] = userMap.get(cb) ?? annaId;
        }
      }
      try {
        await insertDynamic('benefit_tracking', newRow);
        copied++;
      } catch {
        skipped++;
      }
    }
  }

  if (await tableExists('financial_assumptions_history')) {
    const oldFinIds = [...financialIdMap.keys()];
    if (oldFinIds.length > 0) {
      const hist = await pool.query(`SELECT * FROM financial_assumptions_history WHERE financial_id = ANY($1::text[])`, [
        oldFinIds,
      ]);
      const hCols = await colNames('financial_assumptions_history');
      for (const row of hist.rows) {
        const oldF = String(row['financial_id'] ?? '');
        const newF = financialIdMap.get(oldF);
        if (!newF) {
          skipped++;
          continue;
        }
        const newRow: Record<string, unknown> = {};
        for (const c of hCols) {
          newRow[c] = row[c];
        }
        newRow['id'] = newId();
        newRow['financial_id'] = newF;
        if (hCols.includes('changed_by')) {
          const ch = row['changed_by'];
          if (ch != null && typeof ch === 'string') {
            newRow['changed_by'] = userMap.get(ch) ?? annaId;
          }
        }
        try {
          await insertDynamic('financial_assumptions_history', newRow);
          copied++;
        } catch {
          skipped++;
        }
      }
    }
  }

  console.log(
    `  ✓ economics defer pass: ${copied} rows inserted (${skipped} skipped / unmapped)`
  );
  return { copied, skipped };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const dryRun = !process.argv.includes('--write');

  console.log(`\n🔄 Clone DBR77 → Atelier (${dryRun ? 'DRY-RUN' : 'WRITE MODE'})\n`);

  const dbTarget = resolveScriptDatabaseTarget({
    label: 'clone-dbr77-to-atelier',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  logSelectedDatabaseTarget('clone-dbr77-to-atelier', dbTarget);

  const pool = new pg.Pool({ connectionString: dbTarget.connectionString });

  try {
    // ── Step 1: Build user mapping ──
    console.log('\n📋 Step 1: Building user mapping...');

    // Ensure anna.zielinska exists
    const annaCheck = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      ['anna.zielinska@ateliertoys-demo.com']
    );
    let annaId: string;
    if (annaCheck.rows.length > 0) {
      annaId = annaCheck.rows[0].id;
      console.log(`  ✓ anna.zielinska@ateliertoys-demo.com exists (${annaId})`);
    } else if (dryRun) {
      annaId = 'anna-placeholder-id';
      console.log('  → Would create: anna.zielinska@ateliertoys-demo.com (Anna Zielińska)');
    } else {
      annaId = newId();
      await pool.query(
        `INSERT INTO users (id, email, first_name, last_name, role, organization_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
         ON CONFLICT (email) DO NOTHING`,
        [annaId, 'anna.zielinska@ateliertoys-demo.com', 'Anna', 'Zielińska', 'OWNER', TARGET_ORG_ID]
      );
      console.log(`  ✓ Created anna.zielinska@ateliertoys-demo.com (${annaId})`);
    }

    // Get existing atelier users
    const atelierUsers = await pool.query(
      `SELECT id, email FROM users WHERE organization_id = $1 AND email NOT LIKE '%test%' AND email NOT LIKE '%demo%' AND email NOT LIKE '%seed%' AND email NOT LIKE '%debug%' AND email NOT LIKE '%smoke%' AND email NOT LIKE '%cursor%' AND email NOT LIKE '%mindmap%'`,
      [TARGET_ORG_ID]
    );
    const targetUserIds = atelierUsers.rows.map((r: { id: string }) => r.id);
    targetUserIds.push(annaId);

    // Build mapping: source user → target user (round-robin)
    const userMap = new Map<string, string>();
    const sourceUserIds = Object.keys(SOURCE_USERS);
    // Owner maps to Anna
    userMap.set('bf0f01a2-9ada-4cb8-a331-4dce1930e4f3', annaId);
    // Others map round-robin to atelier users
    let idx = 0;
    for (const srcId of sourceUserIds) {
      if (srcId === 'bf0f01a2-9ada-4cb8-a331-4dce1930e4f3') continue;
      if (!userMap.has(srcId)) {
        userMap.set(srcId, targetUserIds[idx % targetUserIds.length]!);
        idx++;
      }
    }

    console.log(`  User mapping: ${userMap.size} source users → ${targetUserIds.length} target users`);
    for (const [src, tgt] of userMap) {
      console.log(`    ${SOURCE_USERS[src] || src} → ${tgt}`);
    }

    function remapUser(value: unknown): unknown {
      if (typeof value !== 'string') return value;
      return userMap.get(value) ?? annaId;
    }

    // ── Step 2: Discover tables with org data ──
    console.log('\n📋 Step 2: Discovering tables with DBR77 data...');

    const tablesWithData = await pool.query(`
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

    const tablesToCopy = tablesWithData.rows.filter(
      (r: { table_name: string }) =>
        !SKIP_TABLES.has(r.table_name) && !DEFERRED_ECONOMICS_TABLES.has(r.table_name)
    );

    console.log(`  Found ${tablesToCopy.length} tables with data to copy\n`);

    // ── Step 3: Copy table by table ──
    console.log('📋 Step 3: Copying data...\n');

    let totalCopied = 0;
    let totalSkipped = 0;
    const initiativeIdMap = new Map<string, string>();
    const analysisIdMap = new Map<string, string>();

    for (const tableInfo of tablesToCopy) {
      const tableName = tableInfo.table_name as string;
      const sourceCount = tableInfo.row_count as number;

      // Get column info
      const colResult = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [tableName]
      );
      const allColumns: string[] = colResult.rows.map((r: { column_name: string }) => r.column_name);

      // Get primary key columns
      const pkResult = await pool.query(
        `SELECT a.attname FROM pg_index i 
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) 
         WHERE i.indrelid = $1::regclass AND i.indisprimary`,
        [tableName]
      );
      const pkColumns: string[] = pkResult.rows.map((r: { attname: string }) => r.attname);

      // Detect user-reference columns
      const userRefCols = allColumns.filter(
        (c) =>
          c === 'user_id' ||
          c === 'created_by' ||
          c === 'owner_id' ||
          c === 'assigned_to' ||
          c === 'decision_owner_id' ||
          c === 'author_user_id' ||
          c === 'owner_user_id' ||
          c === 'performed_by' ||
          c === 'sender_id' ||
          c === 'updated_by' ||
          c === 'approved_by' ||
          c === 'reviewer_id' ||
          c === 'assignee_id' ||
          c === 'reporter_id'
      );

      // For log tables, limit rows
      const isLogTable = LOG_TABLES.has(tableName);
      const limit = isLogTable ? LOG_SAMPLE_LIMIT : 10000;
      const effectiveCount = Math.min(sourceCount, limit);

      if (dryRun) {
        const suffix = isLogTable ? ` (sampling ${limit} of ${sourceCount})` : '';
        console.log(`  📊 ${tableName}: ${effectiveCount} rows${suffix}`);
        totalCopied += effectiveCount;
        continue;
      }

      // Fetch source rows
      let sourceRows;
      try {
        sourceRows = await pool.query(
          `SELECT * FROM "${tableName}" WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
          [SOURCE_ORG_ID, limit]
        );
      } catch {
        // Some tables may not have created_at
        try {
          sourceRows = await pool.query(
            `SELECT * FROM "${tableName}" WHERE organization_id = $1 LIMIT $2`,
            [SOURCE_ORG_ID, limit]
          );
        } catch (err2: unknown) {
          console.warn(`  ⚠ ${tableName}: query failed — ${err2 instanceof Error ? err2.message : err2}`);
          continue;
        }
      }

      let copied = 0;
      let skipped = 0;

      for (const row of sourceRows.rows) {
        const newRow: Record<string, unknown> = { ...row };

        // Remap organization_id
        newRow['organization_id'] = TARGET_ORG_ID;

        // Remap user columns
        for (const col of userRefCols) {
          if (newRow[col] != null && typeof newRow[col] === 'string') {
            const mapped = userMap.get(newRow[col] as string);
            if (mapped) {
              newRow[col] = mapped;
            }
            // If not in map, keep original (might be a system user or already atelier user)
          }
        }

        // Generate new primary key(s) for UUID PKs
        for (const pk of pkColumns) {
          const oldVal = String(row[pk] || '');
          if (oldVal.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            newRow[pk] = newId();
          } else if (pk === 'id' && oldVal.startsWith('dbr77-')) {
            newRow[pk] = oldVal.replace('dbr77-', 'atelier-');
          } else if (pk === 'id' && oldVal.startsWith('user-dbr77-')) {
            newRow[pk] = oldVal.replace('user-dbr77-', 'user-atelier-');
          }
        }

        if (pkColumns.length === 1) {
          const pk0 = pkColumns[0]!;
          const oldPk = String(row[pk0] ?? '');
          const newPk = String(newRow[pk0] ?? '');
          if (oldPk && newPk) {
            if (tableName === 'initiatives') {
              initiativeIdMap.set(oldPk, newPk);
            }
            if (tableName === 'digitization_analyses') {
              analysisIdMap.set(oldPk, newPk);
            }
          }
        }

        // Build INSERT
        const cols = allColumns.filter((c) => newRow[c] !== undefined);
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const values = cols.map((c) => newRow[c]);

        try {
          await pool.query(
            `INSERT INTO "${tableName}" (${cols.map((c) => `"${c}"`).join(', ')})
             VALUES (${placeholders.join(', ')})
             ON CONFLICT DO NOTHING`,
            values
          );
          copied++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('violates foreign key')) {
            skipped++;
          } else if (!msg.includes('duplicate') && !msg.includes('conflict')) {
            if (skipped === 0) {
              console.warn(`    ⚠ ${tableName}: ${msg.slice(0, 120)}`);
            }
            skipped++;
          } else {
            skipped++;
          }
        }
      }

      const suffix = skipped > 0 ? ` (${skipped} skipped)` : '';
      console.log(`  ✓ ${tableName}: ${copied}/${sourceRows.rows.length} rows copied${suffix}`);
      totalCopied += copied;
      totalSkipped += skipped;
    }

    // ── Step 4: Copy conversation_messages (child of conversations) ──
    console.log('\n📋 Step 4: Copying conversation_messages...');

    const convCheck = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_messages') AS exists`
    );
    if (convCheck.rows[0]?.exists) {
      // Get source conversation IDs
      const srcConvs = await pool.query(
        `SELECT id FROM conversations WHERE organization_id = $1`,
        [SOURCE_ORG_ID]
      );
      const srcConvIds = srcConvs.rows.map((r: { id: string }) => r.id);

      // Get target conversation IDs (just copied)
      const tgtConvs = await pool.query(
        `SELECT id FROM conversations WHERE organization_id = $1`,
        [TARGET_ORG_ID]
      );

      if (srcConvIds.length > 0) {
        const msgResult = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM conversation_messages WHERE conversation_id = ANY($1)`,
          [srcConvIds]
        );
        const msgCount = msgResult.rows[0]?.cnt || 0;

        if (dryRun) {
          console.log(`  📊 conversation_messages: ${msgCount} rows`);
        } else if (msgCount > 0) {
          const msgs = await pool.query(
            `SELECT * FROM conversation_messages WHERE conversation_id = ANY($1) ORDER BY created_at LIMIT 2000`,
            [srcConvIds]
          );

          const colResult = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation_messages' ORDER BY ordinal_position`
          );
          const allCols: string[] = colResult.rows.map((r: { column_name: string }) => r.column_name);
          const msgUserCols = allCols.filter((c) => c === 'user_id' || c === 'sender_id');

          let copied = 0;
          for (const row of msgs.rows) {
            const newRow: Record<string, unknown> = { ...row };

            if (newRow['id'] && String(newRow['id']).match(/^[0-9a-f]{8}-/i)) {
              newRow['id'] = newId();
            }

            for (const col of msgUserCols) {
              if (newRow[col] != null && typeof newRow[col] === 'string') {
                const mapped = userMap.get(newRow[col] as string);
                if (mapped) newRow[col] = mapped;
              }
            }

            const cols = allCols.filter((c) => newRow[c] !== undefined);
            const placeholders = cols.map((_, i) => `$${i + 1}`);
            const values = cols.map((c) => newRow[c]);

            try {
              await pool.query(
                `INSERT INTO conversation_messages (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING`,
                values
              );
              copied++;
            } catch {
              // skip FK violations
            }
          }
          console.log(`  ✓ conversation_messages: ${copied}/${msgs.rows.length} rows copied`);
        }
      }
    }

    // ── Step 5: Copy tp_* child tables ──
    console.log('\n📋 Step 5: Copying Table Platform child data...');

    const tpChildTables = [
      'tp_tables', 'tp_fields', 'tp_rows', 'tp_cells', 'tp_views', 'tp_view_configs',
      'tp_filters', 'tp_sorts', 'tp_groupings', 'tp_automations',
    ];

    const tpBaseIds = await pool.query(
      `SELECT id FROM tp_bases WHERE organization_id = $1`,
      [SOURCE_ORG_ID]
    );
    const sourceBaseIds = tpBaseIds.rows.map((r: { id: string }) => r.id);

    if (sourceBaseIds.length > 0) {
      // Also get the new base IDs (just copied)
      for (const childTable of tpChildTables) {
        const exists = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists`,
          [childTable]
        );
        if (!exists.rows[0]?.exists) continue;

        const hasBaseId = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'base_id') AS exists`,
          [childTable]
        );
        const hasOrgId = await pool.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'organization_id') AS exists`,
          [childTable]
        );

        let sourceRows;
        if (hasBaseId.rows[0]?.exists) {
          sourceRows = await pool.query(
            `SELECT * FROM "${childTable}" WHERE base_id = ANY($1)`,
            [sourceBaseIds]
          );
        } else if (hasOrgId.rows[0]?.exists) {
          sourceRows = await pool.query(
            `SELECT * FROM "${childTable}" WHERE organization_id = $1`,
            [SOURCE_ORG_ID]
          );
        } else {
          continue;
        }

        if (sourceRows.rows.length === 0) continue;

        if (dryRun) {
          console.log(`  📊 ${childTable}: ${sourceRows.rows.length} rows`);
          continue;
        }

        const colResult = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [childTable]
        );
        const allCols: string[] = colResult.rows.map((r: { column_name: string }) => r.column_name);

        const pkResult = await pool.query(
          `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) WHERE i.indrelid = $1::regclass AND i.indisprimary`,
          [childTable]
        );
        const pkCols: string[] = pkResult.rows.map((r: { attname: string }) => r.attname);

        let copied = 0;
        for (const row of sourceRows.rows) {
          const newRow: Record<string, unknown> = { ...row };

          if (allCols.includes('organization_id')) {
            newRow['organization_id'] = TARGET_ORG_ID;
          }

          for (const col of allCols) {
            if ((col === 'user_id' || col === 'created_by') && newRow[col] != null && typeof newRow[col] === 'string') {
              const mapped = userMap.get(newRow[col] as string);
              if (mapped) newRow[col] = mapped;
            }
          }

          for (const pk of pkCols) {
            const oldVal = String(row[pk] || '');
            if (oldVal.match(/^[0-9a-f]{8}-/i)) {
              newRow[pk] = newId();
            }
          }

          const cols = allCols.filter((c) => newRow[c] !== undefined);
          const placeholders = cols.map((_, i) => `$${i + 1}`);
          const values = cols.map((c) => newRow[c]);

          try {
            await pool.query(
              `INSERT INTO "${childTable}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING`,
              values
            );
            copied++;
          } catch {
            // skip
          }
        }

        console.log(`  ✓ ${childTable}: ${copied}/${sourceRows.rows.length} rows copied`);
      }
    }

    // ── Step 6: Initiative economics (financials, quality, benefit tracking) ──
    console.log('\n📋 Step 6: Copying initiative economics (deferred FK pass)...');
    const econ = await copyDeferredEconomics(pool, {
      dryRun,
      sourceOrgId: SOURCE_ORG_ID,
      targetOrgId: TARGET_ORG_ID,
      initiativeIdMap,
      analysisIdMap,
      userMap,
      annaId,
    });
    totalCopied += econ.copied;
    totalSkipped += econ.skipped;

    // ── Summary ──
    console.log(`\n${'='.repeat(60)}`);
    if (dryRun) {
      console.log(`📊 DRY-RUN SUMMARY: ~${totalCopied} rows would be copied`);
      console.log(`   Skipped tables (not copied): ${Array.from(SKIP_TABLES).join(', ')}`);
      console.log(
        `   Economics tables (step 6, after ID maps): ${Array.from(DEFERRED_ECONOMICS_TABLES).join(', ')}`
      );
      console.log('   Run with --write to execute.');
    } else {
      console.log(`✅ Clone complete. Data copied from DBR77 → Atelier.`);
      console.log(`   Owner: anna.zielinska@ateliertoys-demo.com (${annaId})`);
      console.log(`   Total rows copied: ${totalCopied}`);
      if (totalSkipped > 0) console.log(`   Total rows skipped: ${totalSkipped}`);
    }
    console.log(`${'='.repeat(60)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Clone failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
