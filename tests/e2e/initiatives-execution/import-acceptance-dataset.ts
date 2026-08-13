import { Pool } from 'pg';

const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
const targetUrl = process.env.DATABASE_URL?.trim();
if (!sourceUrl || !targetUrl) {
  throw new Error('SOURCE_DATABASE_URL and DATABASE_URL are required');
}

const sourceOrganizationId = process.env.IE_SOURCE_ORGANIZATION_ID?.trim() || 'nordwerk-browser';
const targetOrganizationId = process.env.IE_TARGET_ORGANIZATION_ID?.trim();
const targetProjectId = process.env.IE_TARGET_PROJECT_ID?.trim();
const targetOwnerId = process.env.IE_TARGET_OWNER_ID?.trim();
if (!targetOrganizationId || !targetProjectId || !targetOwnerId) {
  throw new Error('IE_TARGET_ORGANIZATION_ID, IE_TARGET_PROJECT_ID and IE_TARGET_OWNER_ID are required');
}

const sourceProjectId = 'operations-transformation-2027';
const sourceOwnerId = 'initiative-owner';
const tables = [
  'initiative_candidates',
  'ie_aggregate_state',
  'ie_initiative_card_versions',
  'ie_initiative_card_selection',
  'ie_aggregate_relations',
  'ie_command_receipts',
  'ie_audit_events',
  'ie_outbox_events',
  'ie_governance_policies',
  'ie_governance_role_bindings',
] as const;

const source = new Pool({ connectionString: sourceUrl, max: 2 });
const target = new Pool({ connectionString: targetUrl, max: 2 });

function rewrite(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replaceAll(sourceOrganizationId, targetOrganizationId)
      .replaceAll(sourceProjectId, targetProjectId)
      .replaceAll(sourceOwnerId, targetOwnerId);
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, rewrite(nested)]));
  }
  return value;
}

async function importTable(table: (typeof tables)[number]) {
  const rows = (
    await source.query(`SELECT * FROM ${table} WHERE organization_id = $1`, [sourceOrganizationId])
  ).rows;
  if (rows.length === 0) return { table, source: 0, inserted: 0 };

  const columnMetadata = (
    await target.query(
      `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1
          ORDER BY ordinal_position`,
      [table]
    )
  ).rows as Array<{ column_name: string; data_type: string }>;
  const generated = new Set(
    (
      await target.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1
            AND (is_identity='YES' OR column_default LIKE 'nextval(%')`,
        [table]
      )
    ).rows.map((row) => row.column_name as string)
  );
  const columns = Object.keys(rows[0]).filter((column) => !generated.has(column));
  const jsonColumns = new Set(
    columnMetadata
      .filter(({ data_type }) => data_type === 'json' || data_type === 'jsonb')
      .map(({ column_name }) => column_name)
  );
  let inserted = 0;
  for (const raw of rows) {
    const rewritten = rewrite(raw) as Record<string, unknown>;
    rewritten.organization_id = targetOrganizationId;
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(',');
    const result = await target.query(
      `INSERT INTO ${table} (${columns.map((column) => `"${column}"`).join(',')})
       VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      columns.map((column) =>
        jsonColumns.has(column) ? JSON.stringify(rewritten[column]) : rewritten[column]
      )
    );
    inserted += result.rowCount ?? 0;
  }
  return { table, source: rows.length, inserted };
}

try {
  const results = [];
  for (const table of tables) results.push(await importTable(table));
  const aggregateSummary = await target.query(
    `SELECT aggregate_type, count(*)::int AS count
       FROM ie_aggregate_state
      WHERE organization_id=$1
        AND (payload_json::text LIKE '%aco-%' OR aggregate_id LIKE 'aco-%')
      GROUP BY aggregate_type ORDER BY aggregate_type`,
    [targetOrganizationId]
  );
  process.stdout.write(`${JSON.stringify({ results, aggregateSummary: aggregateSummary.rows }, null, 2)}\n`);
} finally {
  await Promise.all([source.end(), target.end()]);
}
