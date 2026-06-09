#!/usr/bin/env tsx
/**
 * Hotfix: elkomtech interview_insights.material_quality_json missing role_coverage/
 * department_coverage (and other array fields) → InsightViewer crashes on
 * `quality.role_coverage.length` (white-screens whole Interview module).
 *
 * INSPECT (read-only, default):
 *   railway run --environment production -- npx tsx server/scripts/fix-elkomtech-material-quality.ts
 * APPLY (writes prod):
 *   FIX_APPLY=YES_I_UNDERSTAND_PRODUCTION \
 *   railway run --environment production -- npx tsx server/scripts/fix-elkomtech-material-quality.ts
 */
import dotenv from 'dotenv';
import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';
import logger from '../src/utils/Logger.js';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
if (process.env.ENV_FILE) dotenv.config({ path: process.env.ENV_FILE, override: true });

const ORG_ID = 'elkomtech';
// Array fields the InsightViewer "Material quality" panel calls .length/.map/.join on.
const ARRAY_FIELDS = [
  'role_coverage',
  'department_coverage',
  'missing_voices',
  'limitations',
  'recommended_followups',
];

type Db = {
  run: (sql: string, p?: unknown[]) => Promise<unknown>;
  query: <T>(sql: string, p?: unknown[]) => Promise<{ rows?: T[] }>;
};

async function main() {
  const apply = process.env.FIX_APPLY === 'YES_I_UNDERSTAND_PRODUCTION';
  const target = resolveScriptDatabaseTarget({
    label: 'fix-elkomtech-material-quality',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('fix-elkomtech-material-quality', target);
  process.env.DATABASE_URL = target.connectionString;
  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = (await getDatabaseAsync()) as unknown as Db;

  // Default: scan EVERY org (the InsightViewer crash hits any org whose rendered
  // insight has a partial material_quality_json). Set FIX_ORG to scope to one org.
  const onlyOrg = process.env.FIX_ORG?.trim() || '';
  const r = onlyOrg
    ? await db.query<{ id: string; organization_id: string; material_quality_json: unknown }>(
        `SELECT id, organization_id, material_quality_json FROM interview_insights
         WHERE organization_id=$1 ORDER BY id`,
        [onlyOrg]
      )
    : await db.query<{ id: string; organization_id: string; material_quality_json: unknown }>(
        `SELECT id, organization_id, material_quality_json FROM interview_insights ORDER BY organization_id, id`
      );
  const rows = r.rows || [];
  logger.info(`[fix-mq] ${rows.length} insights (org=${onlyOrg || 'ALL'}); apply=${apply}`);
  const byOrgMissing: Record<string, number> = {};

  let patched = 0;
  for (const row of rows) {
    let mq: Record<string, unknown> | null = null;
    try {
      mq =
        typeof row.material_quality_json === 'string'
          ? JSON.parse(row.material_quality_json)
          : (row.material_quality_json as Record<string, unknown> | null);
    } catch {
      mq = null;
    }
    // Empty/null material_quality is SAFE: the viewer useMemo treats it as null and
    // renders an empty state. Only a NON-empty object missing array fields crashes.
    if (!mq || typeof mq !== 'object' || Object.keys(mq).length === 0) continue;
    const missing = ARRAY_FIELDS.filter((f) => !Array.isArray((mq as Record<string, unknown>)[f]));
    if (missing.length === 0) continue;
    byOrgMissing[row.organization_id] = (byOrgMissing[row.organization_id] || 0) + 1;
    logger.warn(`[fix-mq] ${row.organization_id}/${row.id}: missing → ${missing.join(', ')}`);
    if (apply) {
      const next = { ...mq };
      for (const f of missing) (next as Record<string, unknown>)[f] = [];
      await db.run(
        `UPDATE interview_insights SET material_quality_json=$1, updated_at=$2 WHERE id=$3`,
        [JSON.stringify(next), new Date().toISOString(), row.id]
      );
      patched += 1;
    }
  }

  const orgs = Object.entries(byOrgMissing);
  logger.info(`[fix-mq] affected orgs: ${orgs.length ? orgs.map(([o, n]) => `${o}=${n}`).join(', ') : 'none'}`);
  logger.info(`[fix-mq] done. ${apply ? `patched ${patched}` : 'INSPECT only — no writes'}`);
}

main().catch((e) => {
  console.error('[fix-mq] Failed:', e);
  process.exit(1);
});
