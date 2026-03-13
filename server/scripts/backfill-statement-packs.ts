#!/usr/bin/env tsx
import pg from 'pg';

import { syncStatementToPack } from '../src/services/financialStatementPackService.js';
import logger from '../src/utils/Logger.js';

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

async function main(): Promise<void> {
  const orgId = env('ORG_ID');
  const databaseUrl = env('DATABASE_URL');
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for statement pack backfill');
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const rowsResult = orgId
    ? await client.query<{ id: string; organization_id: string }>(
        `SELECT id, organization_id
         FROM financial_statements
         WHERE organization_id = $1
         ORDER BY created_at ASC`,
        [orgId]
      )
    : await client.query<{ id: string; organization_id: string }>(
        `SELECT id, organization_id
         FROM financial_statements
         ORDER BY created_at ASC`
      );
  const rows = rowsResult.rows || [];

  let synced = 0;
  for (const row of rows || []) {
    await syncStatementToPack(String(row.id));
    synced += 1;
  }

  const packCountResult = orgId
    ? await client.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM financial_statement_packs
         WHERE organization_id = $1`,
        [orgId]
      )
    : await client.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
         FROM financial_statement_packs`
      );
  const packCount = Number(packCountResult.rows[0]?.total || 0);

  await client.end();

  logger.info(
    `[backfill-statement-packs] synced=${synced} statements into ${packCount} packs${orgId ? ` for org=${orgId}` : ''}`
  );
}

main().catch((error) => {
  logger.error('[backfill-statement-packs] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
