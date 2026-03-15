/**
 * Create 3 demo tables in Railway DB for testing the Table Platform.
 *
 * Usage: npx tsx server/scripts/create-demo-tables.ts
 *
 * Tables:
 * 1. Project Tracker — projects with status, owner, deadline, budget
 * 2. CRM Contacts — leads/contacts with company, email, deal stage, value
 * 3. Product Inventory — products with SKU, category, price, stock, supplier
 */

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:2evh7mlls1n00vmwhzm180ner3xndjo3@trolley.proxy.rlwy.net:28146/railway';

const pool = new Pool({ connectionString: DATABASE_URL });

async function q(sql: string, params?: unknown[]) {
  return pool.query(sql, params);
}

async function uuid(): Promise<string> {
  const res = await q('SELECT gen_random_uuid() as id');
  return res.rows[0].id;
}

async function main() {
  console.log('⏳ Connecting to Railway DB...');

  // Check connection
  const ver = await q('SELECT version()');
  console.log('✅ Connected:', ver.rows[0].version.substring(0, 60));

  // Verify tp_bases exists
  const check = await q(
    `SELECT COUNT(*) as c FROM information_schema.tables WHERE table_name = 'tp_bases'`
  );
  if (check.rows[0].c === '0') {
    console.error('❌ tp_bases table does not exist. Run migrations first.');
    process.exit(1);
  }

  // Find workspace ID from my_ideas and organization
  let workspaceId: string;
  let organizationId: string;

  const wsRes = await q(`SELECT id FROM my_ideas LIMIT 1`);
  if (wsRes.rows.length > 0) {
    workspaceId = wsRes.rows[0].id;
    console.log(`Using existing idea as workspace: ${workspaceId}`);
  } else {
    workspaceId = 'demo-workspace-' + Date.now();
    console.log(`No ideas found — using synthetic workspace ID: ${workspaceId}`);
  }

  const orgRes = await q(`SELECT id, name FROM organizations WHERE id != 'system' LIMIT 1`);
  if (orgRes.rows.length > 0) {
    organizationId = orgRes.rows[0].id;
    console.log(`Using organization: ${orgRes.rows[0].name} (${organizationId})`);
  } else {
    organizationId = 'demo-org';
    console.log(`No org found — using synthetic: ${organizationId}`);
  }

  // Clean up existing demo base
  const existing = await q(
    `SELECT id FROM tp_bases WHERE name = 'Demo Base — Table Platform' LIMIT 1`
  );
  if (existing.rows.length > 0) {
    const oldId = existing.rows[0].id;
    console.log(`⚠️ Deleting existing demo base ${oldId}...`);
    // Delete in order: records → views → fields → tables → base
    await q(`DELETE FROM tp_records WHERE table_id IN (SELECT id FROM tp_tables WHERE base_id = $1)`, [oldId]);
    await q(`DELETE FROM tp_views WHERE table_id IN (SELECT id FROM tp_tables WHERE base_id = $1)`, [oldId]);
    await q(`DELETE FROM tp_fields WHERE table_id IN (SELECT id FROM tp_tables WHERE base_id = $1)`, [oldId]);
    await q(`DELETE FROM tp_tables WHERE base_id = $1`, [oldId]);
    await q(`DELETE FROM tp_bases WHERE id = $1`, [oldId]);
  }

  // ========================================
  // CREATE BASE
  // ========================================
  const baseId = await uuid();
  await q(
    `INSERT INTO tp_bases (id, workspace_id, organization_id, name, schema_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 1, now(), now())`,
    [baseId, workspaceId, organizationId, 'Demo Base — Table Platform']
  );
  console.log(`\n✅ Base: ${baseId}`);

  // ========================================
  // HELPER: create table + fields + view + records
  // ========================================
  async function createTable(
    name: string,
    fieldDefs: Array<{ name: string; type: string; options?: object }>,
    records: Array<Record<string, unknown>>,
    viewName: string
  ) {
    const tableId = await uuid();
    const fields: Record<string, string> = {};

    // Pre-generate field IDs
    for (const f of fieldDefs) {
      fields[f.name] = await uuid();
    }

    // Create table first (FK target for fields)
    const primaryFieldId = fields[fieldDefs[0].name];
    await q(
      `INSERT INTO tp_tables (id, base_id, name, primary_field_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())`,
      [tableId, baseId, name, primaryFieldId]
    );

    // Then create fields
    for (let i = 0; i < fieldDefs.length; i++) {
      const f = fieldDefs[i];
      await q(
        `INSERT INTO tp_fields (id, table_id, name, field_type, options, is_computed, field_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, $6, now(), now())`,
        [fields[f.name], tableId, f.name, f.type, JSON.stringify(f.options || {}), i]
      );
    }

    // Create default view
    const viewId = await uuid();
    const visibleIds = Object.values(fields);
    await q(
      `INSERT INTO tp_views (id, table_id, name, view_type, visible_field_ids, config, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, 'grid', $4, $5, true, now(), now())`,
      [viewId, tableId, viewName, `{${visibleIds.join(',')}}`, JSON.stringify({ sort: [], filters: [] })]
    );

    // Insert records — map human-readable field names to field UUIDs
    for (const rec of records) {
      const recId = await uuid();
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rec)) {
        if (fields[key]) {
          data[fields[key]] = value;
        }
      }
      await q(
        `INSERT INTO tp_records (id, table_id, data, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())`,
        [recId, tableId, JSON.stringify(data)]
      );
    }

    console.log(`✅ Table "${name}" — ${fieldDefs.length} fields, ${records.length} records (${tableId})`);
    return { tableId, fields };
  }

  // ========================================
  // TABLE 1: Project Tracker
  // ========================================
  await createTable(
    'Project Tracker',
    [
      { name: 'Project Name', type: 'singleLineText' },
      { name: 'Status', type: 'singleSelect', options: { choices: ['Planning', 'In Progress', 'Review', 'Done', 'On Hold'] } },
      { name: 'Owner', type: 'singleLineText' },
      { name: 'Deadline', type: 'date', options: { dateFormat: 'YYYY-MM-DD' } },
      { name: 'Budget (PLN)', type: 'number', options: { precision: 0 } },
      { name: 'Priority', type: 'singleSelect', options: { choices: ['Critical', 'High', 'Medium', 'Low'] } },
      { name: 'Description', type: 'longText' },
    ],
    [
      { 'Project Name': 'Consultify Table Platform', Status: 'In Progress', Owner: 'Piotr', Deadline: '2026-04-15', 'Budget (PLN)': 150000, Priority: 'Critical', Description: 'Build Airtable-like + Power BI-like table module' },
      { 'Project Name': 'Mobile App v2', Status: 'Planning', Owner: 'Anna', Deadline: '2026-06-01', 'Budget (PLN)': 80000, Priority: 'High', Description: 'Redesign mobile experience with offline support' },
      { 'Project Name': 'AI Copilot Integration', Status: 'In Progress', Owner: 'Marek', Deadline: '2026-05-01', 'Budget (PLN)': 60000, Priority: 'High', Description: 'Integrate GPT-based copilot across all modules' },
      { 'Project Name': 'Data Migration Tool', Status: 'Done', Owner: 'Kasia', Deadline: '2026-03-01', 'Budget (PLN)': 25000, Priority: 'Medium', Description: 'Tool for migrating client data from legacy systems' },
      { 'Project Name': 'Security Audit Q1', Status: 'Review', Owner: 'Tomek', Deadline: '2026-03-31', 'Budget (PLN)': 15000, Priority: 'Critical', Description: 'Quarterly security review and penetration testing' },
      { 'Project Name': 'Partner API v3', Status: 'On Hold', Owner: 'Ewa', Deadline: '2026-07-01', 'Budget (PLN)': 45000, Priority: 'Low', Description: 'New partner integration API with OAuth 2.0' },
      { 'Project Name': 'Performance Optimization', Status: 'Planning', Owner: 'Piotr', Deadline: '2026-04-30', 'Budget (PLN)': 20000, Priority: 'Medium', Description: 'Optimize query performance for tables with 10k+ records' },
    ],
    'All Projects'
  );

  // ========================================
  // TABLE 2: CRM Contacts
  // ========================================
  await createTable(
    'CRM Contacts',
    [
      { name: 'Contact Name', type: 'singleLineText' },
      { name: 'Company', type: 'singleLineText' },
      { name: 'Email', type: 'email' },
      { name: 'Phone', type: 'phoneNumber' },
      { name: 'Deal Stage', type: 'singleSelect', options: { choices: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] } },
      { name: 'Deal Value (PLN)', type: 'number', options: { precision: 0 } },
      { name: 'Last Contact', type: 'date', options: { dateFormat: 'YYYY-MM-DD' } },
      { name: 'Notes', type: 'longText' },
    ],
    [
      { 'Contact Name': 'Jan Kowalski', Company: 'TechCorp Polska', Email: 'jan@techcorp.pl', Phone: '+48 600 100 200', 'Deal Stage': 'Negotiation', 'Deal Value (PLN)': 250000, 'Last Contact': '2026-03-12', Notes: 'Interested in enterprise plan. Follow up on pricing.' },
      { 'Contact Name': 'Maria Nowak', Company: 'DataFlow SA', Email: 'maria@dataflow.com', Phone: '+48 601 200 300', 'Deal Stage': 'Proposal', 'Deal Value (PLN)': 180000, 'Last Contact': '2026-03-10', Notes: 'Sent proposal. Waiting for board approval.' },
      { 'Contact Name': 'Adam Wiśniewski', Company: 'FinTech Solutions', Email: 'adam@fintech.io', Phone: '+48 602 300 400', 'Deal Stage': 'Closed Won', 'Deal Value (PLN)': 120000, 'Last Contact': '2026-03-05', Notes: 'Contract signed. Onboarding starts April 1.' },
      { 'Contact Name': 'Katarzyna Zielińska', Company: 'GreenEnergy Sp.', Email: 'kasia@greenenergy.pl', Phone: '+48 603 400 500', 'Deal Stage': 'Lead', 'Deal Value (PLN)': 50000, 'Last Contact': '2026-03-14', Notes: 'Met at conference. Needs demo.' },
      { 'Contact Name': 'Tomasz Lewandowski', Company: 'BuildPro Group', Email: 'tomek@buildpro.pl', Phone: '+48 604 500 600', 'Deal Stage': 'Qualified', 'Deal Value (PLN)': 300000, 'Last Contact': '2026-03-08', Notes: 'Large construction company. Needs custom integrations.' },
      { 'Contact Name': 'Ewa Kamińska', Company: 'MediaHouse', Email: 'ewa@mediahouse.pl', Phone: '+48 605 600 700', 'Deal Stage': 'Closed Lost', 'Deal Value (PLN)': 75000, 'Last Contact': '2026-02-28', Notes: 'Chose competitor. Revisit in Q3.' },
      { 'Contact Name': 'Paweł Dąbrowski', Company: 'LogiTrans', Email: 'pawel@logitrans.com', Phone: '+48 606 700 800', 'Deal Stage': 'Proposal', 'Deal Value (PLN)': 200000, 'Last Contact': '2026-03-13', Notes: 'Fleet management use case. Very interested.' },
      { 'Contact Name': 'Agnieszka Wójcik', Company: 'HealthTech PL', Email: 'agnieszka@healthtech.pl', Phone: '+48 607 800 900', 'Deal Stage': 'Negotiation', 'Deal Value (PLN)': 400000, 'Last Contact': '2026-03-11', Notes: 'Hospital network. GDPR compliance critical.' },
    ],
    'All Contacts'
  );

  // ========================================
  // TABLE 3: Product Inventory
  // ========================================
  await createTable(
    'Product Inventory',
    [
      { name: 'Product Name', type: 'singleLineText' },
      { name: 'SKU', type: 'singleLineText' },
      { name: 'Category', type: 'singleSelect', options: { choices: ['Software', 'Hardware', 'Services', 'Accessories', 'Subscriptions'] } },
      { name: 'Price (PLN)', type: 'currency', options: { symbol: 'PLN', precision: 2 } },
      { name: 'Stock', type: 'number', options: { precision: 0 } },
      { name: 'Supplier', type: 'singleLineText' },
      { name: 'Reorder Level', type: 'number', options: { precision: 0 } },
      { name: 'Active', type: 'checkbox' },
    ],
    [
      { 'Product Name': 'Consultify Enterprise', SKU: 'CONS-ENT-001', Category: 'Software', 'Price (PLN)': 4999.00, Stock: 999, Supplier: 'Internal', 'Reorder Level': 0, Active: true },
      { 'Product Name': 'Consultify Pro', SKU: 'CONS-PRO-001', Category: 'Software', 'Price (PLN)': 1999.00, Stock: 999, Supplier: 'Internal', 'Reorder Level': 0, Active: true },
      { 'Product Name': 'Dell Monitor 27"', SKU: 'HW-MON-027', Category: 'Hardware', 'Price (PLN)': 1299.00, Stock: 45, Supplier: 'Dell Polska', 'Reorder Level': 10, Active: true },
      { 'Product Name': 'Logitech MX Master 3S', SKU: 'ACC-MOU-003', Category: 'Accessories', 'Price (PLN)': 449.00, Stock: 120, Supplier: 'Logitech', 'Reorder Level': 20, Active: true },
      { 'Product Name': 'Cloud Hosting (monthly)', SKU: 'SVC-HOST-001', Category: 'Services', 'Price (PLN)': 2500.00, Stock: 0, Supplier: 'Railway', 'Reorder Level': 0, Active: true },
      { 'Product Name': 'API Access Token (annual)', SKU: 'SUB-API-001', Category: 'Subscriptions', 'Price (PLN)': 599.00, Stock: 999, Supplier: 'Internal', 'Reorder Level': 0, Active: true },
      { 'Product Name': 'USB-C Hub 7-in-1', SKU: 'ACC-HUB-007', Category: 'Accessories', 'Price (PLN)': 189.00, Stock: 8, Supplier: 'Anker', 'Reorder Level': 15, Active: true },
      { 'Product Name': 'Legacy Connector v1', SKU: 'SW-LEG-001', Category: 'Software', 'Price (PLN)': 299.00, Stock: 0, Supplier: 'Internal', 'Reorder Level': 0, Active: false },
    ],
    'All Products'
  );

  // ========================================
  // VERIFY
  // ========================================
  console.log('\n========================================');
  console.log('📊 Verification');
  console.log('========================================');

  const countRes = await q(
    `SELECT t.name, COUNT(r.id) as records, 
            (SELECT COUNT(*) FROM tp_fields f WHERE f.table_id = t.id) as fields,
            (SELECT COUNT(*) FROM tp_views v WHERE v.table_id = t.id) as views
     FROM tp_tables t 
     LEFT JOIN tp_records r ON r.table_id = t.id 
     WHERE t.base_id = $1 
     GROUP BY t.id, t.name 
     ORDER BY t.name`,
    [baseId]
  );
  for (const row of countRes.rows) {
    console.log(`  ${row.name}: ${row.records} records, ${row.fields} fields, ${row.views} views`);
  }

  const totalRecords = await q(
    `SELECT COUNT(*) as c FROM tp_records WHERE table_id IN (SELECT id FROM tp_tables WHERE base_id = $1)`,
    [baseId]
  );
  console.log(`\n  Total: ${totalRecords.rows[0].c} records across 3 tables`);
  console.log(`  Base ID: ${baseId}`);
  console.log(`  Workspace: ${workspaceId}`);
  console.log('========================================\n');
}

main()
  .then(() => {
    console.log('✅ Demo tables created successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
