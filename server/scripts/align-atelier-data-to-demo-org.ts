#!/usr/bin/env npx tsx
/**
 * After DBR77→`atelier` clone, production JWT / AccessPolicy often use DEMO_ORG_ID
 * (e.g. `ateliertoys-demo`) while rows stayed on slug `atelier` → empty Tasks/Decisions in UI.
 *
 * This script rewrites organization_id on all tenant-scoped tables from SOURCE_ORG → TARGET_ORG.
 * Optional: mark Anna-assigned tasks as task_type='personal' so My Work → Tasks (personal-tasks API) shows them.
 * Optional: remap decisions.decision_maker_id from clone owner (Piotr) → Anna so My Work → Decisions is not empty.
 *
 * Dry-run:
 *   npx tsx server/scripts/align-atelier-data-to-demo-org.ts
 * Execute:
 *   npx tsx server/scripts/align-atelier-data-to-demo-org.ts --write
 *
 * Production (Railway from laptop):
 *   ALIGN_PERSONAL_TASKS=1 ALIGN_REMAP_DECISIONS=1 railway run --service consultify --environment production -- \
 *     env -u DATABASE_URL npx tsx server/scripts/align-atelier-data-to-demo-org.ts --write
 *
 * If DEMO_ORG_ID row is missing, --write creates it by cloning the SOURCE org row (same columns, new id).
 */

import pg from 'pg';

import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';

const SOURCE_ORG = process.env.ALIGN_SOURCE_ORG?.trim() || 'atelier';
const TARGET_ORG =
  process.env.ALIGN_TARGET_ORG?.trim() ||
  process.env.DEMO_ORG_ID?.trim() ||
  'ateliertoys-demo';
const ANNA_EMAIL = process.env.ALIGN_ANNA_EMAIL?.trim() || 'anna.zielinska@ateliertoys-demo.com';
const DECISION_SOURCE_EMAIL =
  process.env.ALIGN_DECISION_SOURCE_EMAIL?.trim() || 'piotr.wisniewski@dbr77.com';
const MARK_PERSONAL = process.env.ALIGN_PERSONAL_TASKS === '1' || process.env.ALIGN_PERSONAL_TASKS === 'true';
const REMAP_DECISIONS =
  process.env.ALIGN_REMAP_DECISIONS === '1' || process.env.ALIGN_REMAP_DECISIONS === 'true';

async function main() {
  const write = process.argv.includes('--write');
  const target = resolveScriptDatabaseTarget({
    label: 'align-atelier-demo-org',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  logSelectedDatabaseTarget('align-atelier-demo-org', target);
  const pool = new pg.Pool({ connectionString: target.connectionString });

  try {
    const orgCheck = await pool.query(
      `SELECT id, name FROM organizations WHERE id = ANY($1::text[])`,
      [[SOURCE_ORG, TARGET_ORG]]
    );
    console.log('Organizations:', JSON.stringify(orgCheck.rows, null, 2));

    let tgt = orgCheck.rows.find((r: { id: string }) => r.id === TARGET_ORG);
    if (!tgt && !write) {
      console.log(
        `\nTarget org "${TARGET_ORG}" is missing — --write would create it from "${SOURCE_ORG}".\n`
      );
    } else if (!tgt && write) {
      const srcOrg = await pool.query(`SELECT * FROM organizations WHERE id = $1 LIMIT 1`, [SOURCE_ORG]);
      if (!srcOrg.rows[0]) {
        console.error(`Source org "${SOURCE_ORG}" not found.`);
        process.exit(1);
      }
      const ocols = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' ORDER BY ordinal_position`
      );
      const colNames: string[] = ocols.rows.map((r: { column_name: string }) => r.column_name);
      const src = srcOrg.rows[0] as Record<string, unknown>;
      const ins: Record<string, unknown> = {};
      for (const c of colNames) {
        ins[c] = src[c];
      }
      ins['id'] = TARGET_ORG;
      const ic = colNames.filter((c) => ins[c] !== undefined);
      const ph = ic.map((_, i) => `$${i + 1}`);
      await pool.query(
        `INSERT INTO organizations (${ic.map((c) => `"${c}"`).join(', ')}) VALUES (${ph.join(', ')}) ON CONFLICT (id) DO NOTHING`,
        ic.map((c) => ins[c])
      );
      console.log(`  ✓ Created organization row: ${TARGET_ORG} (cloned from ${SOURCE_ORG})`);
      tgt = { id: TARGET_ORG, name: String(ins['name'] || '') };
    } else if (!tgt) {
      console.error(`Target org "${TARGET_ORG}" missing and not --write.`);
      process.exit(1);
    }

    const tabs = await pool.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'organization_id'
         AND data_type IN ('text', 'character varying')
       GROUP BY table_name ORDER BY table_name`
    );
    const tables: string[] = tabs.rows.map((r: { table_name: string }) => r.table_name);

    if (!write) {
      let total = 0;
      for (const t of tables) {
        const c = await pool.query(
          `SELECT COUNT(*)::int AS c FROM "${t}" WHERE organization_id = $1`,
          [SOURCE_ORG]
        );
        const n = c.rows[0]?.c ?? 0;
        if (n > 0) {
          console.log(`  ${t}: ${n} rows`);
          total += n;
        }
      }
      console.log(`\nDRY-RUN: ${total} rows would move ${SOURCE_ORG} → ${TARGET_ORG}`);
      console.log(`  MARK_PERSONAL_TASKS (Anna): ${MARK_PERSONAL}`);
      console.log(`  REMAP_DECISIONS (→ Anna): ${REMAP_DECISIONS}`);
      console.log('  Pass --write to execute.\n');
      return;
    }

    console.log(`\nUpdating organization_id ${SOURCE_ORG} → ${TARGET_ORG}…`);
    let moved = 0;
    for (const t of tables) {
      try {
        const u = await pool.query(`UPDATE "${t}" SET organization_id = $1 WHERE organization_id = $2`, [
          TARGET_ORG,
          SOURCE_ORG,
        ]);
        const n = u.rowCount ?? 0;
        if (n > 0) {
          console.log(`  ✓ ${t}: ${n}`);
          moved += n;
        }
      } catch (e) {
        console.warn(`  ⚠ ${t}: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
      }
    }
    console.log(`\n  Total rows updated: ${moved}`);

    const anna = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [ANNA_EMAIL]);
    const annaId = anna.rows[0]?.id as string | undefined;
    if (MARK_PERSONAL && annaId) {
      const pt = await pool.query(
        `UPDATE tasks SET task_type = 'personal' WHERE organization_id = $1 AND assignee_id = $2`,
        [TARGET_ORG, annaId]
      );
      console.log(`\n  ✓ tasks → task_type 'personal' for Anna assignee: ${pt.rowCount ?? 0}`);
    } else if (MARK_PERSONAL) {
      console.warn('\n  Anna user not found; skipped personal task marking.');
    }

    if (REMAP_DECISIONS) {
      const annaRow = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [ANNA_EMAIL]);
      const srcRow = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [
        DECISION_SOURCE_EMAIL,
      ]);
      const aid = annaRow.rows[0]?.id as string | undefined;
      const sid = srcRow.rows[0]?.id as string | undefined;
      if (aid && sid && aid !== sid) {
        const dc = await pool.query(
          `UPDATE decisions SET decision_maker_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE organization_id = $2 AND decision_maker_id = $3`,
          [aid, TARGET_ORG, sid]
        );
        console.log(
          `\n  ✓ decisions → decision_maker_id ${DECISION_SOURCE_EMAIL} → ${ANNA_EMAIL}: ${dc.rowCount ?? 0}`
        );
      } else {
        console.warn(
          '\n  Skipped decision remap (need distinct Anna + source users, or missing users).'
        );
      }
    }

    console.log('\n✅ Align complete.\n');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
