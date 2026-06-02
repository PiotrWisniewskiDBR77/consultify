#!/usr/bin/env tsx
/**
 * QA Fixtures: SuperAdmin (People + Webhooks + Compliance + AuditLog samples)
 *
 * Provides safe, idempotent seed/reset for QA/E2E flows that previously had to
 * inspect real data ("INSPECTION_ONLY" status in CONTROL_BOARD). Designed so
 * automated tests and Antygravity manual gates can mutate without touching
 * real tenants.
 *
 * Safety guarantees:
 *  - Refuses to run unless QA_FIXTURES_CONFIRM is set explicitly.
 *  - Refuses to run if NODE_ENV === 'production' AND not QA_FIXTURES_PROD_OK=YES.
 *  - All seeded entities are scoped to a single QA organization id so reset
 *    cannot cascade into other tenants.
 *  - Reset deletes ONLY rows scoped to the QA org and the QA prefix.
 *
 * Usage (from consultify/):
 *   QA_FIXTURES_CONFIRM=YES npx tsx server/scripts/qa-fixtures-superadmin.ts seed
 *   QA_FIXTURES_CONFIRM=YES npx tsx server/scripts/qa-fixtures-superadmin.ts reset
 *
 * Optional env:
 *   QA_FIXTURES_ORG_ID  (default: qa-superadmin-org)
 *   QA_FIXTURES_PROD_OK=YES  (required when NODE_ENV=production)
 */

import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../src/utils/DbPromise.js';

type SubCommand = 'seed' | 'reset';

const QA_ORG_ID = process.env.QA_FIXTURES_ORG_ID || 'qa-superadmin-org';
const QA_PREFIX = 'qa-superadmin-';

function requireConfirmation(command: SubCommand) {
  const confirm = String(process.env.QA_FIXTURES_CONFIRM || '');
  if (confirm !== 'YES') {
    throw new Error(
      `Refusing to run '${command}': set QA_FIXTURES_CONFIRM=YES to acknowledge fixture mutations.`
    );
  }
  if (process.env.NODE_ENV === 'production' && process.env.QA_FIXTURES_PROD_OK !== 'YES') {
    throw new Error(
      `Refusing to run '${command}' in production: set QA_FIXTURES_PROD_OK=YES if intentional.`
    );
  }
}

async function tableExists(name: string): Promise<boolean> {
  const row = await dbGet<{ name?: string; table_name?: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    [name]
  );
  if (row?.name) return true;
  const pgRow = await dbGet<{ table_name?: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ?`,
    [name]
  );
  return Boolean(pgRow?.table_name);
}

async function ensureOrganization() {
  if (!(await tableExists('organizations'))) {
    console.warn('[qa-fixtures] organizations table missing, skipping org bootstrap.');
    return;
  }
  const existing = await dbGet<{ id: string }>(`SELECT id FROM organizations WHERE id = ?`, [
    QA_ORG_ID,
  ]);
  if (existing?.id) {
    console.log(`[qa-fixtures] org ${QA_ORG_ID} already exists`);
    return;
  }
  await dbRun(
    `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
    [QA_ORG_ID, 'QA SuperAdmin Fixtures', 'enterprise', 'active'],
    { fallback: false }
  );
  console.log(`[qa-fixtures] created org ${QA_ORG_ID}`);
}

async function ensurePeople() {
  if (!(await tableExists('users'))) {
    console.warn('[qa-fixtures] users table missing, skipping people seed.');
    return;
  }
  const people = [
    { suffix: 'owner', email: 'qa-owner@qa.consultify.local', role: 'OWNER' },
    { suffix: 'admin', email: 'qa-admin@qa.consultify.local', role: 'ADMIN' },
    { suffix: 'user', email: 'qa-user@qa.consultify.local', role: 'USER' },
  ];
  for (const person of people) {
    const id = `${QA_PREFIX}user-${person.suffix}`;
    const existing = await dbGet<{ id: string }>(`SELECT id FROM users WHERE id = ?`, [id]);
    if (existing?.id) continue;
    await dbRun(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, QA_ORG_ID, person.email, 'qa-disabled', 'QA', person.suffix.toUpperCase(), person.role, 'active'],
      { fallback: false }
    );
    console.log(`[qa-fixtures] created user ${person.email} (${person.role})`);
  }
}

async function ensureWebhooks() {
  if (!(await tableExists('webhook_registrations'))) {
    console.warn('[qa-fixtures] webhook_registrations table missing, skipping webhook seed.');
    return;
  }
  const id = `${QA_PREFIX}webhook-1`;
  const existing = await dbGet<{ id: string }>(
    `SELECT id FROM webhook_registrations WHERE id = ?`,
    [id]
  );
  if (existing?.id) return;
  await dbRun(
    `INSERT INTO webhook_registrations (id, organization_id, url, events, status, created_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      id,
      QA_ORG_ID,
      'https://example.invalid/webhook/qa',
      JSON.stringify(['organization.updated', 'admin_audit_log.created']),
      'enabled',
    ],
    { fallback: true }
  );
  console.log(`[qa-fixtures] created webhook ${id}`);
}

async function ensureComplianceDocs() {
  if (!(await tableExists('legal_documents'))) {
    console.warn('[qa-fixtures] legal_documents table missing, skipping compliance seed.');
    return;
  }
  const id = `${QA_PREFIX}legal-doc-1`;
  const existing = await dbGet<{ id: string }>(`SELECT id FROM legal_documents WHERE id = ?`, [id]);
  if (existing?.id) return;
  await dbRun(
    `INSERT INTO legal_documents (id, organization_id, document_type, title, content, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      QA_ORG_ID,
      'TERMS',
      'QA Sample Terms of Service',
      'This is a QA-only legal document. It is not legally binding.',
      'draft',
    ],
    { fallback: true }
  );
  console.log(`[qa-fixtures] created legal document ${id}`);
}

async function ensureAuditLogs() {
  if (!(await tableExists('admin_audit_logs'))) {
    console.warn('[qa-fixtures] admin_audit_logs table missing, skipping audit seed.');
    return;
  }
  const adminId = `${QA_PREFIX}user-admin`;
  const samples = [
    {
      action: 'login',
      resource: 'session',
      risk: 5,
      status: 'logged',
      metadata: { source: 'qa-fixtures', case: 'happy-path' },
    },
    {
      action: 'role_change',
      resource: 'user',
      risk: 65,
      status: 'logged',
      metadata: { source: 'qa-fixtures', case: 'high-risk' },
    },
    {
      action: 'export_data',
      resource: 'organization',
      risk: 90,
      status: 'escalated',
      metadata: { source: 'qa-fixtures', case: 'critical' },
    },
  ];
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const id = `${QA_PREFIX}audit-${i + 1}`;
    const existing = await dbGet<{ id: string }>(
      `SELECT id FROM admin_audit_logs WHERE id = ?`,
      [id]
    );
    if (existing?.id) continue;
    await dbRun(
      `INSERT INTO admin_audit_logs (
         id, organization_id, admin_id, action_type, resource_type, resource_id,
         resource_name, ip_address, risk_score, status, metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        QA_ORG_ID,
        adminId,
        sample.action,
        sample.resource,
        randomUUID(),
        `QA sample ${sample.action}`,
        '127.0.0.1',
        sample.risk,
        sample.status,
        JSON.stringify(sample.metadata),
      ],
      { fallback: true }
    );
    console.log(`[qa-fixtures] created audit log ${id} (${sample.action})`);
  }
}

async function seed() {
  requireConfirmation('seed');
  console.log(`[qa-fixtures] seed start (org=${QA_ORG_ID})`);
  await ensureOrganization();
  await ensurePeople();
  await ensureWebhooks();
  await ensureComplianceDocs();
  await ensureAuditLogs();
  console.log(`[qa-fixtures] seed done`);
}

async function reset() {
  requireConfirmation('reset');
  console.log(`[qa-fixtures] reset start (org=${QA_ORG_ID})`);
  const cleanups: Array<{ table: string; sql: string; params: any[] }> = [
    {
      table: 'admin_audit_logs',
      sql: `DELETE FROM admin_audit_logs WHERE organization_id = ? AND id LIKE ?`,
      params: [QA_ORG_ID, `${QA_PREFIX}%`],
    },
    {
      table: 'legal_documents',
      sql: `DELETE FROM legal_documents WHERE organization_id = ? AND id LIKE ?`,
      params: [QA_ORG_ID, `${QA_PREFIX}%`],
    },
    {
      table: 'webhook_registrations',
      sql: `DELETE FROM webhook_registrations WHERE organization_id = ? AND id LIKE ?`,
      params: [QA_ORG_ID, `${QA_PREFIX}%`],
    },
    {
      table: 'users',
      sql: `DELETE FROM users WHERE organization_id = ? AND id LIKE ?`,
      params: [QA_ORG_ID, `${QA_PREFIX}%`],
    },
  ];
  for (const cleanup of cleanups) {
    if (!(await tableExists(cleanup.table))) {
      console.warn(`[qa-fixtures] reset skip: table ${cleanup.table} missing`);
      continue;
    }
    const result = await dbRun(cleanup.sql, cleanup.params, { fallback: true });
    console.log(
      `[qa-fixtures] reset table=${cleanup.table} success=${result?.success ?? 'n/a'} changes=${
        result?.changes ?? 0
      }`
    );
  }
  console.log(`[qa-fixtures] reset done`);
}

async function main() {
  const command = (process.argv[2] || 'seed') as SubCommand;
  if (command !== 'seed' && command !== 'reset') {
    console.error(`Unknown command: ${command}. Use 'seed' or 'reset'.`);
    process.exit(2);
  }
  if (command === 'seed') await seed();
  else await reset();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[qa-fixtures] failed:', err?.message || err);
    process.exit(1);
  });
