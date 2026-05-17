#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * Bootstrap Organization Context Engine schema on the connected database.
 *
 * Calls ContextDocumentService.ensureSchema() once via a public side-effect
 * (we use the listContextDocuments helper which calls ensureSchema before SELECT).
 * After this script the following tables / columns must exist:
 *   - organization_context_storage_events
 *   - organization_context_processing_jobs (+ alter columns)
 *   - organization_context_lineage_events
 *   - organization_context_processing_attention_receipts
 *   - knowledge_docs (extra ALTER ADD COLUMN)
 *   - knowledge_chunks (extra ALTER ADD COLUMN)
 *   - audit_log (extra ALTER ADD COLUMN)
 *
 * Use ONLY against staging or controlled environments. Reads DATABASE_URL etc
 * from environment (export from .env.staging.local before running).
 */

import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.staging.local');
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error('[bootstrap] DATABASE_URL is missing - aborting.');
  process.exit(1);
}

console.log('[bootstrap] Connected to:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

async function main(): Promise<void> {
  const contextDocumentService = (await import('../src/services/organizationContext/ContextDocumentService.js')).default;
  const { all: dbAll } = await import('../src/utils/DbPromise.js');

  const beforeTables = (await dbAll<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN (
       'organization_context_storage_events',
       'organization_context_processing_jobs',
       'organization_context_lineage_events',
       'organization_context_processing_attention_receipts'
     ) ORDER BY table_name`,
    [],
    { fallback: false } as any,
  )) || [];
  console.log('[bootstrap] Tables present BEFORE:', beforeTables.map((r) => r.table_name));

  console.log('[bootstrap] Triggering ensureSchema() via listAccessibleDocuments(noop org)...');
  try {
    await (contextDocumentService as any).listAccessibleDocuments({
      organizationId: '__bootstrap_noop__',
      userId: '__bootstrap_noop__',
      scope: 'organization',
    });
  } catch (err: any) {
    console.warn('[bootstrap] listAccessibleDocuments noop returned error (expected if no data):', err?.message || String(err));
  }

  const afterTables = (await dbAll<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN (
       'organization_context_storage_events',
       'organization_context_processing_jobs',
       'organization_context_lineage_events',
       'organization_context_processing_attention_receipts'
     ) ORDER BY table_name`,
    [],
    { fallback: false } as any,
  )) || [];
  console.log('[bootstrap] Tables present AFTER:', afterTables.map((r) => r.table_name));

  const required = [
    'organization_context_storage_events',
    'organization_context_processing_jobs',
    'organization_context_lineage_events',
    'organization_context_processing_attention_receipts',
  ];
  const missing = required.filter((t) => !afterTables.find((r) => r.table_name === t));
  if (missing.length > 0) {
    console.error('[bootstrap] FAIL - still missing tables:', missing);
    process.exit(2);
  }

  console.log('[bootstrap] PASS - all required tables present.');

  const jobsCols = (await dbAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='organization_context_processing_jobs' ORDER BY column_name`,
    [],
    { fallback: false } as any,
  )) || [];
  console.log('[bootstrap] organization_context_processing_jobs columns:', jobsCols.map((r) => r.column_name).join(', '));

  process.exit(0);
}

main().catch((err) => {
  console.error('[bootstrap] FATAL:', err);
  process.exit(99);
});
