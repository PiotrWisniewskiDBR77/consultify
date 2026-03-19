#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

import pg from 'pg';

import {
  logSelectedDatabaseTarget,
  resolveScriptDatabaseTarget,
  type ScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

type QueryRow = Record<string, unknown>;

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
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

function ensureExportsDir() {
  const dir = path.resolve(process.cwd(), 'server/exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFile(name: string, contents: string) {
  const fullPath = path.join(ensureExportsDir(), name);
  fs.writeFileSync(fullPath, contents, 'utf8');
  return fullPath;
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

async function tableExists(client: pg.Pool, tableName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return result.rows?.[0]?.exists === true;
}

async function safeQuery(client: pg.Pool, sql: string, params: unknown[] = []): Promise<QueryRow[]> {
  const result = await client.query(sql, params);
  return (result.rows || []) as QueryRow[];
}

async function buildAudit(target: ScriptDatabaseTarget, label: string) {
  const pool = new pg.Pool({ connectionString: target.connectionString });
  try {
    const tasksPresent = await tableExists(pool, 'tasks');
    const initiativesPresent = await tableExists(pool, 'initiatives');
    const usersPresent = await tableExists(pool, 'users');
    const orgsPresent = await tableExists(pool, 'organizations');

    const financeTables = [
      'financial_statements',
      'financial_statement_packs',
      'financial_statement_values',
      'financial_statement_versions',
    ];
    const financePresence = await Promise.all(
      financeTables.map(async (table) => ({
        table,
        exists: await tableExists(pool, table),
      }))
    );
    const financeExistingTables = financePresence.filter((item) => item.exists).map((item) => item.table);

    const [taskByOrg, taskByType, taskByStatus, initiativesByOrg, financeByOrg, duplicateEmails, demoOrgs] =
      await Promise.all([
        tasksPresent
          ? safeQuery(
              pool,
              `SELECT organization_id, COUNT(*)::int AS task_count
               FROM tasks
               GROUP BY organization_id
               ORDER BY task_count DESC, organization_id ASC`
            )
          : Promise.resolve([]),
        tasksPresent
          ? safeQuery(
              pool,
              `SELECT organization_id, COALESCE(NULLIF(task_type, ''), '<empty>') AS task_type, COUNT(*)::int AS task_count
               FROM tasks
               GROUP BY organization_id, COALESCE(NULLIF(task_type, ''), '<empty>')
               ORDER BY organization_id ASC, task_count DESC`
            )
          : Promise.resolve([]),
        tasksPresent
          ? safeQuery(
              pool,
              `SELECT organization_id, COALESCE(NULLIF(status, ''), '<empty>') AS status, COUNT(*)::int AS task_count
               FROM tasks
               GROUP BY organization_id, COALESCE(NULLIF(status, ''), '<empty>')
               ORDER BY organization_id ASC, task_count DESC`
            )
          : Promise.resolve([]),
        initiativesPresent
          ? safeQuery(
              pool,
              `SELECT organization_id, COUNT(*)::int AS initiative_count
               FROM initiatives
               GROUP BY organization_id
               ORDER BY initiative_count DESC, organization_id ASC`
            )
          : Promise.resolve([]),
        financeExistingTables.length > 0
          ? safeQuery(
              pool,
              `SELECT organization_id, COUNT(*)::int AS statement_count
               FROM financial_statements
               GROUP BY organization_id
               ORDER BY statement_count DESC, organization_id ASC`
            )
          : Promise.resolve([]),
        usersPresent
          ? safeQuery(
              pool,
              `SELECT lower(email) AS email, COUNT(*)::int AS duplicate_count,
                      array_agg(id ORDER BY id) AS user_ids,
                      array_agg(organization_id ORDER BY organization_id) AS organization_ids
               FROM users
               WHERE email IS NOT NULL AND trim(email) <> ''
               GROUP BY lower(email)
               HAVING COUNT(*) > 1
               ORDER BY duplicate_count DESC, lower(email) ASC`
            )
          : Promise.resolve([]),
        orgsPresent
          ? safeQuery(
              pool,
              `SELECT id, name
               FROM organizations
               WHERE lower(id) IN ('atelier', 'demo-org')
                  OR lower(name) LIKE '%demo%'
                  OR lower(name) LIKE '%atelier%'
               ORDER BY id ASC`
            )
          : Promise.resolve([]),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      label,
      target: {
        source: target.source,
        host: target.host,
        database: target.database,
      },
      checks: {
        tasksPresent,
        initiativesPresent,
        usersPresent,
        organizationsPresent: orgsPresent,
        financeTables: financePresence,
      },
      slices: {
        taskByOrg,
        taskByType,
        taskByStatus,
        initiativesByOrg,
        financeByOrg,
        duplicateEmails,
        demoOrgs,
      },
    };
  } finally {
    await pool.end();
  }
}

function toMarkdown(report: Awaited<ReturnType<typeof buildAudit>>) {
  const lines: string[] = [];
  lines.push(`# Data Truth Audit`);
  lines.push('');
  lines.push(`- Label: \`${report.label}\``);
  lines.push(`- Generated: \`${report.generatedAt}\``);
  lines.push(`- DB source: \`${report.target.source}\``);
  lines.push(`- Host: \`${report.target.host}\``);
  lines.push(`- Database: \`${report.target.database}\``);
  lines.push('');
  lines.push('## Table Presence');
  lines.push('');
  lines.push(`- tasks: \`${report.checks.tasksPresent}\``);
  lines.push(`- initiatives: \`${report.checks.initiativesPresent}\``);
  lines.push(`- users: \`${report.checks.usersPresent}\``);
  lines.push(`- organizations: \`${report.checks.organizationsPresent}\``);
  lines.push(
    `- finance tables: ${report.checks.financeTables
      .map((item) => `\`${item.table}:${item.exists ? 'present' : 'missing'}\``)
      .join(', ')}`
  );
  lines.push('');

  const sections: Array<[string, QueryRow[]]> = [
    ['Tasks By Organization', report.slices.taskByOrg],
    ['Tasks By Type', report.slices.taskByType],
    ['Tasks By Status', report.slices.taskByStatus],
    ['Initiatives By Organization', report.slices.initiativesByOrg],
    ['Financial Statements By Organization', report.slices.financeByOrg],
    ['Duplicate User Emails', report.slices.duplicateEmails],
    ['Demo Orgs', report.slices.demoOrgs],
  ];

  for (const [title, rows] of sections) {
    lines.push(`## ${title}`);
    lines.push('');
    if (!rows.length) {
      lines.push('- none');
      lines.push('');
      continue;
    }
    for (const row of rows) {
      lines.push(`- \`${JSON.stringify(row)}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = args.label || process.env.DB_AUDIT_LABEL || 'ad-hoc';
  const target = resolveScriptDatabaseTarget({
    label: 'db-truth-audit',
    databaseUrl: args['database-url'] || process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('db-truth-audit', target);

  const report = await buildAudit(target, label);
  const stamp = nowStamp();
  const jsonPath = writeFile(`data-truth-audit-${label}-${stamp}.json`, JSON.stringify(report, null, 2));
  const mdPath = writeFile(`data-truth-audit-${label}-${stamp}.md`, toMarkdown(report));

  console.log('✅ Data truth audit written:');
  console.log(`- ${jsonPath}`);
  console.log(`- ${mdPath}`);
}

main().catch((error) => {
  console.error('❌ Data truth audit failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
