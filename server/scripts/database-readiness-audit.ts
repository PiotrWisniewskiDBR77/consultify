#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

import pg from 'pg';

import {
  logSelectedDatabaseTarget,
  resolveScriptDatabaseTarget,
  type ScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';
import { resolveDemoPolicy } from '../src/config/demoPolicy.js';

type Args = Record<string, string>;
type Check = { id: string; ok: boolean; details: string };

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

function ensureExportsDir() {
  const dir = path.resolve(process.cwd(), 'server/exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeFile(name: string, contents: string) {
  const fullPath = path.join(ensureExportsDir(), name);
  fs.writeFileSync(fullPath, contents, 'utf8');
  return fullPath;
}

async function tableExists(client: pg.Pool, tableName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return result.rows?.[0]?.exists === true;
}

async function countOrphans(client: pg.Pool, tableName: string): Promise<number | null> {
  const hasTable = await tableExists(client, tableName);
  if (!hasTable) return null;
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM "${tableName}" t
     LEFT JOIN organizations o ON o.id = t.organization_id
     WHERE t.organization_id IS NOT NULL AND o.id IS NULL`
  );
  return Number(result.rows?.[0]?.count || 0);
}

async function hasIndexContaining(client: pg.Pool, tableName: string, fragment: string): Promise<boolean> {
  const result = await client.query(
    `SELECT indexdef
     FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = $1`,
    [tableName]
  );
  const normalizedFragment = fragment.replace(/\s+/g, '').toLowerCase();
  return (result.rows || []).some((row) =>
    String(row.indexdef || '')
      .replace(/\s+/g, '')
      .toLowerCase()
      .includes(normalizedFragment)
  );
}

async function buildChecks(target: ScriptDatabaseTarget): Promise<Check[]> {
  const pool = new pg.Pool({ connectionString: target.connectionString });
  try {
    const demoPolicy = resolveDemoPolicy(process.env);
    const [tasksOrphans, initiativesOrphans, financeOrphans, auditLogExists, auditEventsExists] =
      await Promise.all([
        countOrphans(pool, 'tasks'),
        countOrphans(pool, 'initiatives'),
        countOrphans(pool, 'financial_statements'),
        tableExists(pool, 'audit_log'),
        tableExists(pool, 'audit_events'),
      ]);

    const [
      tasksOrgIdx,
      tasksAssigneeIdx,
      tasksStatusIdx,
      initiativesOrgIdx,
      financeOrgIdx,
      auditEventsOrgIdx,
    ] = await Promise.all([
      hasIndexContaining(pool, 'tasks', '(organization_id)'),
      hasIndexContaining(pool, 'tasks', '(assignee_id)'),
      hasIndexContaining(pool, 'tasks', '(status)'),
      hasIndexContaining(pool, 'initiatives', '(organization_id)'),
      hasIndexContaining(pool, 'financial_statements', '(organization_id)'),
      hasIndexContaining(pool, 'audit_events', '(org_id)'),
    ]);

    return [
      {
        id: 'audit-log-table-present',
        ok: auditLogExists,
        details: auditLogExists ? 'audit_log table present.' : 'audit_log table missing.',
      },
      {
        id: 'audit-events-table-present',
        ok: auditEventsExists,
        details: auditEventsExists ? 'audit_events table present.' : 'audit_events table missing.',
      },
      {
        id: 'no-orphan-tasks',
        ok: (tasksOrphans ?? 0) === 0,
        details: `orphan_task_rows=${tasksOrphans ?? 'n/a'}`,
      },
      {
        id: 'no-orphan-initiatives',
        ok: (initiativesOrphans ?? 0) === 0,
        details: `orphan_initiative_rows=${initiativesOrphans ?? 'n/a'}`,
      },
      {
        id: 'no-orphan-financial-statements',
        ok: (financeOrphans ?? 0) === 0,
        details: `orphan_financial_statement_rows=${financeOrphans ?? 'n/a'}`,
      },
      {
        id: 'tasks-index-organization-id',
        ok: tasksOrgIdx,
        details: tasksOrgIdx ? 'tasks indexed by organization_id.' : 'missing tasks organization_id index.',
      },
      {
        id: 'tasks-index-assignee-id',
        ok: tasksAssigneeIdx,
        details: tasksAssigneeIdx ? 'tasks indexed by assignee_id.' : 'missing tasks assignee_id index.',
      },
      {
        id: 'tasks-index-status',
        ok: tasksStatusIdx,
        details: tasksStatusIdx ? 'tasks indexed by status.' : 'missing tasks status index.',
      },
      {
        id: 'initiatives-index-organization-id',
        ok: initiativesOrgIdx,
        details: initiativesOrgIdx
          ? 'initiatives indexed by organization_id.'
          : 'missing initiatives organization_id index.',
      },
      {
        id: 'financial-statements-index-organization-id',
        ok: financeOrgIdx,
        details: financeOrgIdx
          ? 'financial_statements indexed by organization_id.'
          : 'missing financial_statements organization_id index.',
      },
      {
        id: 'audit-events-index-org-id',
        ok: auditEventsOrgIdx,
        details: auditEventsOrgIdx ? 'audit_events indexed by org_id.' : 'missing audit_events org_id index.',
      },
      {
        id: 'demo-policy-explicit',
        ok: !demoPolicy.requiresExplicitApproval || demoPolicy.explicitApprovalEnabled,
        details:
          !demoPolicy.requiresExplicitApproval || demoPolicy.explicitApprovalEnabled
            ? `demo policy approved for ${demoPolicy.demoOrgId}.`
            : `demo policy for ${demoPolicy.demoOrgId} requires explicit approval.`,
      },
    ];
  } finally {
    await pool.end();
  }
}

function toMarkdown(params: {
  label: string;
  target: ScriptDatabaseTarget;
  checks: Check[];
}): string {
  const allOk = params.checks.every((check) => check.ok);
  const lines: string[] = [];
  lines.push('# Database Readiness Audit');
  lines.push('');
  lines.push(`- Label: \`${params.label}\``);
  lines.push(`- Generated: \`${new Date().toISOString()}\``);
  lines.push(`- Host: \`${params.target.host}\``);
  lines.push(`- Database: \`${params.target.database}\``);
  lines.push(`- Source: \`${params.target.source}\``);
  lines.push(`- Result: \`${allOk ? 'PASS' : 'FAIL'}\``);
  lines.push('');
  lines.push('## Checks');
  lines.push('');
  for (const check of params.checks) {
    lines.push(`- [${check.ok ? 'x' : ' '}] \`${check.id}\` - ${check.details}`);
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = String(args.label || process.env.DB_READINESS_LABEL || 'ad-hoc').trim() || 'ad-hoc';
  const target = resolveScriptDatabaseTarget({
    label: 'database-readiness-audit',
    databaseUrl: args['database-url'] || process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget('database-readiness-audit', target);

  const checks = await buildChecks(target);
  const report = toMarkdown({ label, target, checks });
  const reportPath = writeFile(`database-readiness-audit-${label}-${stamp()}.md`, report);

  console.log(`${checks.every((check) => check.ok) ? '✅' : '❌'} Database readiness audit complete.`);
  console.log(`- ${reportPath}`);

  if (checks.some((check) => !check.ok)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    '❌ Database readiness audit failed:',
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
