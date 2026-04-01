#!/usr/bin/env npx tsx
/**
 * Copies selected My Ideas from Piotr (dbr77) → Anna (atelier demo):
 *  - top showcase row (execution lane / context long title)
 *  - Robotic Workstation ROI Analysis
 *  - Production Line Optimization — Value Stream Map
 *  - Customer Service Process Redesign
 *  - Finance Reporting Modernization ("FK" finance showcase)
 *
 * Also copies my_idea_maps and my_idea_edges between those ideas.
 *
 * Usage:
 *   npx tsx server/scripts/copy-showcase-my-ideas-to-anna.ts           # dry-run
 *   npx tsx server/scripts/copy-showcase-my-ideas-to-anna.ts --write
 *
 * From laptop against Railway:
 *   env -u DATABASE_URL railway run --service consultify --environment production -- \
 *     env -u DATABASE_URL npx tsx server/scripts/copy-showcase-my-ideas-to-anna.ts --write
 */

import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';

const SOURCE_ORG = process.env.CLONE_SOURCE_ORG_ID?.trim() || 'dbr77';
const TARGET_ORG = process.env.CLONE_TARGET_ORG_ID?.trim() || 'atelier';
const SOURCE_EMAIL = process.env.COPY_IDEAS_FROM_EMAIL?.trim() || 'piotr.wisniewski@dbr77.com';
const TARGET_EMAIL = process.env.COPY_IDEAS_TO_EMAIL?.trim() || 'anna.zielinska@ateliertoys-demo.com';

/** Title filters matching the DBR77 / Piotr Ideas showcase (top list + finance). */
function titleWhereClause(): string {
  return `
    title ILIKE '%execution lane%'
    OR title ILIKE '%project management and digital transformation%'
    OR title = 'Robotic Workstation ROI Analysis'
    OR title LIKE 'Production Line Optimization%'
    OR title ILIKE 'Production Line Optimization%'
    OR title = 'Customer Service Process Redesign'
    OR title = 'Finance Reporting Modernization'
  `;
}

async function main() {
  const write = process.argv.includes('--write');
  const dbTarget = resolveScriptDatabaseTarget({
    label: 'copy-showcase-ideas',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  logSelectedDatabaseTarget('copy-showcase-ideas', dbTarget);
  const pool = new pg.Pool({ connectionString: dbTarget.connectionString });

  try {
    const srcUser = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [
      SOURCE_EMAIL,
    ]);
    const tgtUser = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [
      TARGET_EMAIL,
    ]);
    if (!srcUser.rows[0]?.id) {
      console.error(`Source user not found: ${SOURCE_EMAIL}`);
      process.exit(1);
    }
    if (!tgtUser.rows[0]?.id) {
      console.error(`Target user not found: ${TARGET_EMAIL}`);
      process.exit(1);
    }
    const sourceUserId = srcUser.rows[0].id as string;
    const targetUserId = tgtUser.rows[0].id as string;

    const ideasRes = await pool.query(
      `SELECT * FROM my_ideas WHERE organization_id = $1 AND user_id = $2 AND (${titleWhereClause()}) ORDER BY updated_at DESC`,
      [SOURCE_ORG, sourceUserId]
    );

    const rows = ideasRes.rows as Record<string, unknown>[];
    console.log(`\nMatched ${rows.length} source idea(s):`);
    for (const r of rows) {
      console.log(`  - ${String(r['title']).slice(0, 80)}…`);
    }

    if (!write) {
      console.log('\nDRY-RUN — pass --write to copy.\n');
      return;
    }

    const colResult = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'my_ideas' ORDER BY ordinal_position`
    );
    const ideaCols: string[] = colResult.rows.map((r: { column_name: string }) => r.column_name);

    const oldToNew = new Map<string, string>();
    for (const row of rows) {
      const oldId = String(row['id'] ?? '');
      if (!oldId) continue;
      oldToNew.set(oldId, uuidv4());
    }

    // Remove Anna duplicates for same titles (re-runnable)
    for (const row of rows) {
      await pool.query(
        `DELETE FROM my_idea_maps WHERE organization_id = $1 AND user_id = $2 AND idea_id IN (
           SELECT id FROM my_ideas WHERE organization_id = $1 AND user_id = $2 AND title = $3
         )`,
        [TARGET_ORG, targetUserId, row['title']]
      );
      await pool.query(
        `DELETE FROM my_ideas WHERE organization_id = $1 AND user_id = $2 AND title = $3`,
        [TARGET_ORG, targetUserId, row['title']]
      );
    }

    for (const row of rows) {
      const oldId = String(row['id'] ?? '');
      const newId = oldToNew.get(oldId);
      if (!newId) continue;

      const newRow: Record<string, unknown> = { ...row };
      newRow['id'] = newId;
      newRow['user_id'] = targetUserId;
      newRow['organization_id'] = TARGET_ORG;
      newRow['source_conversation_id'] = null;
      newRow['source_message_id'] = null;

      const cols = ideaCols.filter((c) => newRow[c] !== undefined);
      const ph = cols.map((_, i) => `$${i + 1}`);
      const values = cols.map((c) => newRow[c]);
      await pool.query(
        `INSERT INTO my_ideas (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${ph.join(', ')})`,
        values
      );
      console.log(`  ✓ idea copied: ${String(row['title']).slice(0, 60)}`);
    }

    // Maps
    if (oldToNew.size > 0) {
      const oldIds = [...oldToNew.keys()];
      const mapsRes = await pool.query(
        `SELECT * FROM my_idea_maps WHERE organization_id = $1 AND user_id = $2 AND idea_id = ANY($3::text[])`,
        [SOURCE_ORG, sourceUserId, oldIds]
      );
      for (const mrow of mapsRes.rows as Record<string, unknown>[]) {
        const oid = String(mrow['idea_id'] ?? '');
        const nid = oldToNew.get(oid);
        if (!nid) continue;
        await pool.query(`DELETE FROM my_idea_maps WHERE user_id = $1 AND organization_id = $2 AND idea_id = $3`, [
          targetUserId,
          TARGET_ORG,
          nid,
        ]);
        const newMap: Record<string, unknown> = { ...mrow };
        newMap['id'] = uuidv4();
        newMap['idea_id'] = nid;
        newMap['user_id'] = targetUserId;
        newMap['organization_id'] = TARGET_ORG;
        const mc = Object.keys(newMap).filter((k) => newMap[k] !== undefined);
        await pool.query(
          `INSERT INTO my_idea_maps (${mc.map((k) => `"${k}"`).join(', ')}) VALUES (${mc.map((_, i) => `$${i + 1}`).join(', ')})`,
          mc.map((k) => newMap[k])
        );
        console.log(`  ✓ map for idea ${nid.slice(0, 8)}…`);
      }
    }

    // Edges (both ends in copied set)
    if (oldToNew.size > 1) {
      const oldIds = [...oldToNew.keys()];
      const edgeRes = await pool.query(
        `SELECT * FROM my_idea_edges WHERE organization_id = $1 AND user_id = $2
         AND source_idea_id = ANY($3::text[]) AND target_idea_id = ANY($3::text[])`,
        [SOURCE_ORG, sourceUserId, oldIds]
      );
      for (const erow of edgeRes.rows as Record<string, unknown>[]) {
        const sOld = String(erow['source_idea_id'] ?? '');
        const tOld = String(erow['target_idea_id'] ?? '');
        const sNew = oldToNew.get(sOld);
        const tNew = oldToNew.get(tOld);
        if (!sNew || !tNew) continue;
        const newE: Record<string, unknown> = { ...erow };
        newE['id'] = uuidv4();
        newE['user_id'] = targetUserId;
        newE['organization_id'] = TARGET_ORG;
        newE['source_idea_id'] = sNew;
        newE['target_idea_id'] = tNew;
        const ec = Object.keys(newE).filter((k) => newE[k] !== undefined);
        try {
          await pool.query(
            `INSERT INTO my_idea_edges (${ec.map((k) => `"${k}"`).join(', ')}) VALUES (${ec.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`,
            ec.map((k) => newE[k])
          );
        } catch {
          /* ignore */
        }
      }
      console.log(`  ✓ edges copied: ${edgeRes.rows.length} (where both ends matched)`);
    }

    console.log('\n✅ Showcase ideas copy complete.\n');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
