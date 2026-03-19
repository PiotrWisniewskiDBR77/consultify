#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

import pg from 'pg';

import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';
import { describeOrganizationTargetPolicy } from './lib/organizationTargetPolicy.js';

type Args = Record<string, string>;

type TablePlan = {
  table: string;
  sourceCount: number;
  targetCount: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current?.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function ensureExportsDir(): string {
  const dir = path.resolve(process.cwd(), 'server/exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeReport(filename: string, contents: string): string {
  const fullPath = path.join(ensureExportsDir(), filename);
  fs.writeFileSync(fullPath, contents, 'utf8');
  return fullPath;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function organizationExists(client: pg.Pool, orgId: string): Promise<boolean> {
  const result = await client.query(`SELECT id FROM organizations WHERE id = $1 LIMIT 1`, [orgId]);
  return Boolean(result.rows?.[0]?.id);
}

async function discoverFinanceTables(client: pg.Pool): Promise<string[]> {
  const result = await client.query(
    `SELECT table_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name = 'organization_id'
       AND (table_name LIKE 'financial_%' OR table_name IN ('budgets', 'valuations'))
     ORDER BY table_name ASC`
  );
  return (result.rows || []).map((row) => String(row.table_name || '')).filter(Boolean);
}

async function buildPlan(client: pg.Pool, sourceOrgId: string, targetOrgId: string): Promise<TablePlan[]> {
  const tables = await discoverFinanceTables(client);
  const plans: TablePlan[] = [];

  for (const table of tables) {
    const result = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE organization_id = $1)::int AS source_count,
         COUNT(*) FILTER (WHERE organization_id = $2)::int AS target_count
       FROM "${table}"`,
      [sourceOrgId, targetOrgId]
    );

    plans.push({
      table,
      sourceCount: Number(result.rows?.[0]?.source_count || 0),
      targetCount: Number(result.rows?.[0]?.target_count || 0),
    });
  }

  return plans;
}

function toMarkdown(params: {
  sourceOrgId: string;
  targetOrgId: string;
  dryRun: boolean;
  targetHost: string;
  targetDatabase: string;
  tables: TablePlan[];
}): string {
  const lines: string[] = [];
  lines.push('# Finance Org Reassign Report');
  lines.push('');
  lines.push(`- Generated: \`${new Date().toISOString()}\``);
  lines.push(`- Mode: \`${params.dryRun ? 'dry-run' : 'write'}\``);
  lines.push(`- Host: \`${params.targetHost}\``);
  lines.push(`- Database: \`${params.targetDatabase}\``);
  lines.push(`- Source org: \`${params.sourceOrgId}\``);
  lines.push(`- Target org: \`${params.targetOrgId}\``);
  lines.push(`- Policy: \`${describeOrganizationTargetPolicy()}\``);
  lines.push('');
  lines.push('## Table Plan');
  lines.push('');

  for (const table of params.tables) {
    lines.push(
      `- \`${table.table}\`: source_rows=\`${table.sourceCount}\`, target_rows=\`${table.targetCount}\``
    );
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.write !== 'true';
  const sourceOrgId = String(args['source-org-id'] || process.env.SOURCE_ORG_ID || '').trim();
  const targetOrgId = String(args['target-org-id'] || process.env.TARGET_ORG_ID || '').trim();

  if (!sourceOrgId) {
    throw new Error(
      '[finance-org-reassign] Missing source organization. Pass --source-org-id or SOURCE_ORG_ID.'
    );
  }
  if (!targetOrgId) {
    throw new Error(
      '[finance-org-reassign] Missing target organization. Pass --target-org-id or TARGET_ORG_ID.'
    );
  }
  if (sourceOrgId === targetOrgId) {
    throw new Error('[finance-org-reassign] Source and target organizations must differ.');
  }

  const dbTarget = resolveScriptDatabaseTarget({
    label: 'finance-org-reassign',
    databaseUrl: args['database-url'] || process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('finance-org-reassign', dbTarget);

  const pool = new pg.Pool({ connectionString: dbTarget.connectionString });

  try {
    const sourceOrgExists = await organizationExists(pool, sourceOrgId);
    const targetOrgExists = await organizationExists(pool, targetOrgId);
    if (!targetOrgExists) {
      throw new Error(`[finance-org-reassign] Target organization "${targetOrgId}" was not found.`);
    }

    const plan = await buildPlan(pool, sourceOrgId, targetOrgId);
    const reportPath = writeReport(
      `finance-org-reassign-${dryRun ? 'dry-run' : 'write'}-${stamp()}.md`,
      toMarkdown({
        sourceOrgId,
        targetOrgId,
        dryRun,
        targetHost: dbTarget.host,
        targetDatabase: dbTarget.database,
        tables: plan,
      })
    );

    if (!sourceOrgExists) {
      console.warn(
        `[finance-org-reassign] Source organization "${sourceOrgId}" is missing in organizations. Proceeding because finance rows may be orphaned and still need reassignment.`
      );
    }

    if (dryRun) {
      console.log('✅ Finance org reassign dry-run complete.');
      console.log(`- ${reportPath}`);
      return;
    }

    requireConfirmation(
      'FINANCE_ORG_MIGRATION_CONFIRM',
      'MOVE_FINANCE_ORG',
      'finance-org-reassign'
    );

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const table of plan) {
        if (table.sourceCount === 0) continue;
        await client.query(`UPDATE "${table.table}" SET organization_id = $1 WHERE organization_id = $2`, [
          targetOrgId,
          sourceOrgId,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    console.log('✅ Finance organization reassignment complete.');
    console.log(`- ${reportPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    '❌ Finance organization reassignment failed:',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
