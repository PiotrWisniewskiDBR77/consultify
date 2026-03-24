/**
 * Table Platform Runtime Smoke Test
 * V7-0: Verifies the platform is actually runnable end-to-end.
 *
 * Usage:
 *   npx tsx server/scripts/tp-smoke-test.ts
 *
 * Requires DATABASE_URL env var pointing to the PostgreSQL instance.
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env var is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail?: string;
}

const results: CheckResult[] = [];

async function check(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    results.push({ name, status: 'pass', detail: detail || undefined });
  } catch (e: any) {
    results.push({ name, status: 'fail', detail: e?.message });
  }
}

async function run() {
  console.log('=== Table Platform Smoke Test ===\n');

  // 1. Migration history
  await check('tp_migration_history exists', async () => {
    const r = await pool.query('SELECT COUNT(*) as cnt FROM tp_migration_history');
    const count = parseInt(r.rows[0].cnt, 10);
    if (count === 0) throw new Error('No migrations recorded');
    return `${count} migrations applied`;
  });

  // 2. Core schema tables
  const coreTables = [
    'tp_bases', 'tp_tables', 'tp_fields', 'tp_views', 'tp_records',
    'tp_record_links', 'tp_attachments', 'tp_audit_events', 'tp_schema_proposals',
  ];
  for (const table of coreTables) {
    await check(`Table ${table} exists`, async () => {
      await pool.query(`SELECT 1 FROM ${table} LIMIT 0`);
    });
  }

  // 3. Extended tables from later migrations
  const extendedTables = [
    'tp_forms', 'tp_automations', 'tp_interfaces', 'tp_extensions',
    'tp_governed_models', 'tp_base_templates', 'tp_record_comments',
    'tp_cell_history', 'tp_webhook_relays', 'tp_distributions',
  ];
  for (const table of extendedTables) {
    await check(`Table ${table} exists`, async () => {
      await pool.query(`SELECT 1 FROM ${table} LIMIT 0`);
    });
  }

  // 4. Template seeding
  await check('Default templates seeded', async () => {
    const r = await pool.query('SELECT COUNT(*) as cnt FROM tp_base_templates');
    const count = parseInt(r.rows[0].cnt, 10);
    if (count === 0) throw new Error('No templates found');
    return `${count} templates`;
  });

  // 5. CRUD smoke: create base → create table → create field → insert record → read → delete
  // Use gen_random_uuid() to get valid UUIDs
  const smokeIds = { base: '', table: '', field: '', record: '' };

  await check('CRUD: create base', async () => {
    const r = await pool.query(`
      INSERT INTO tp_bases (id, workspace_id, organization_id, name, created_by)
      VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'Smoke Test Base', gen_random_uuid())
      RETURNING id
    `);
    smokeIds.base = r.rows[0].id;
  });

  await check('CRUD: create table', async () => {
    const r = await pool.query(`
      INSERT INTO tp_tables (id, base_id, name, created_by)
      VALUES (gen_random_uuid(), $1, 'Smoke Table', gen_random_uuid())
      RETURNING id
    `, [smokeIds.base]);
    smokeIds.table = r.rows[0].id;
  });

  await check('CRUD: create field', async () => {
    const r = await pool.query(`
      INSERT INTO tp_fields (id, table_id, name, field_type, field_order, options)
      VALUES (gen_random_uuid(), $1, 'Name', 'single_line_text', 1, '{}')
      RETURNING id
    `, [smokeIds.table]);
    smokeIds.field = r.rows[0].id;
  });

  await check('CRUD: insert record', async () => {
    const data = JSON.stringify({ [smokeIds.field]: 'Hello V7' });
    const r = await pool.query(`
      INSERT INTO tp_records (id, table_id, data, created_by)
      VALUES (gen_random_uuid(), $1, $2::jsonb, gen_random_uuid())
      RETURNING id
    `, [smokeIds.table, data]);
    smokeIds.record = r.rows[0].id;
  });

  await check('CRUD: read record', async () => {
    const r = await pool.query('SELECT data FROM tp_records WHERE id = $1', [smokeIds.record]);
    if (r.rows.length === 0) throw new Error('Record not found');
    return `data=${JSON.stringify(r.rows[0].data)}`;
  });

  // Cleanup
  await check('CRUD: cleanup', async () => {
    await pool.query('DELETE FROM tp_records WHERE id = $1', [smokeIds.record]);
    await pool.query('DELETE FROM tp_fields WHERE id = $1', [smokeIds.field]);
    await pool.query('DELETE FROM tp_tables WHERE id = $1', [smokeIds.table]);
    await pool.query('DELETE FROM tp_bases WHERE id = $1', [smokeIds.base]);
  });

  // Report
  console.log('\n--- Results ---\n');
  let passes = 0, fails = 0;
  for (const r of results) {
    const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '⚠' : '✗';
    const detail = r.detail ? ` (${r.detail})` : '';
    console.log(`  ${icon} ${r.name}${detail}`);
    if (r.status === 'pass') passes++;
    else fails++;
  }

  console.log(`\n${passes} passed, ${fails} failed out of ${results.length} checks`);

  await pool.end();

  if (fails > 0) {
    console.log('\n❌ SMOKE TEST FAILED — Table Platform is NOT runnable');
    process.exit(1);
  } else {
    console.log('\n✅ SMOKE TEST PASSED — Table Platform is operational');
    process.exit(0);
  }
}

run().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
