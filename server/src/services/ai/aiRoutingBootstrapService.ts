import { randomUUID } from 'node:crypto';

import logger from '../../utils/Logger.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { EXECUTIVE_USE_CASES, getRoutingPurposeKeys } from './aiTaskCatalog.js';
import llmConfigService from './llmConfigService.js';

type DbFlagType = 'boolean' | 'integer' | 'unknown';

async function getColumnType(table: string, column: string): Promise<DbFlagType> {
  try {
    const row = await dbGet<{ data_type?: string }>(
      `SELECT data_type
       FROM information_schema.columns
       WHERE table_name = ? AND column_name = ?
       LIMIT 1`,
      [table, column],
      { fallback: true } as any
    );
    const dt = String((row as any)?.data_type || '').toLowerCase();
    if (dt === 'boolean') return 'boolean';
    if (dt.includes('int')) return 'integer';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function coerceActiveValue(table: string, column: string, value: boolean): Promise<boolean | number> {
  const t = await getColumnType(table, column);
  if (t === 'integer') return value ? 1 : 0;
  return value;
}

async function ensureRoutingSchema(): Promise<void> {
  // Keep SQL compatible with both adapters; Postgres accepts BOOLEAN, SQLite stores as 0/1.
  const stmts: string[] = [
    `CREATE TABLE IF NOT EXISTS ai_purposes (
      purpose TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      default_tier TEXT,
      requirements TEXT,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ai_purpose_assignments (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      purpose TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL DEFAULT '',
      priority INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      fallback_model_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, purpose, provider_id, model_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_purpose_assignments_purpose ON ai_purpose_assignments(purpose)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_purpose_assignments_org ON ai_purpose_assignments(organization_id)`,
    // best-effort schema extensions (ignored on old engines)
    `ALTER TABLE ai_purpose_assignments ADD COLUMN IF NOT EXISTS fallback_model_id TEXT`,
    `ALTER TABLE ai_purpose_assignments ADD COLUMN IF NOT EXISTS release_bundle_id TEXT`,
    `ALTER TABLE ai_purpose_assignments ADD COLUMN IF NOT EXISTS prompt_key TEXT`,
    `ALTER TABLE ai_purpose_assignments ADD COLUMN IF NOT EXISTS prompt_version TEXT`,
    `ALTER TABLE ai_purpose_assignments ADD COLUMN IF NOT EXISTS policy_version TEXT`,
  ];

  for (const sql of stmts) {
    try {
      await dbRun(sql, [], { fallback: true } as any);
    } catch {
      // best-effort
    }
  }
}

async function pickDefaultProviderId(): Promise<{ providerId: string; modelId: string }> {
  const candidates = ['openrouter', 'openai', 'anthropic', 'google', 'deepseek'];
  for (const key of candidates) {
    const row = await llmConfigService.getProviderFromDb(key);
    if (row?.id && row?.provider) {
      const providerId = String(row.id);
      const modelId = String(row.model_id || row.id || row.provider || '');
      return { providerId, modelId };
    }
  }
  throw new Error('No LLM provider rows found to seed purpose assignments');
}

async function seedPurposeAssignments(): Promise<{ seeded: number; purposes: string[] }> {
  const activeValue = await coerceActiveValue('ai_purpose_assignments', 'is_active', true);

  // Prefer multiple active+configured providers for critical purposes (chat) so routing has fallback.
  const availableProviders = await llmConfigService.getAllProviders(false);
  const preferredOrder = ['openrouter', 'openai', 'anthropic', 'google', 'deepseek'];
  const providerCandidates = preferredOrder
    .map((id) => availableProviders.find((p) => String((p as any).provider || '').toLowerCase() === id))
    .filter((p) => p && (p as any).apiKey) as any[];

  const selectedProviders =
    providerCandidates.length > 0
      ? providerCandidates.slice(0, 3)
      : [await pickDefaultProviderId()].map((x) => ({ rowId: x.providerId, modelId: x.modelId }));

  const purposes = new Set<string>();
  for (const useCase of EXECUTIVE_USE_CASES) {
    for (const p of useCase.purposes || []) {
      for (const k of getRoutingPurposeKeys(p) || []) purposes.add(k);
      purposes.add(String(p));
    }
  }

  // Always include base chat routing key.
  purposes.add('chat');

  let seeded = 0;
  for (const p of Array.from(purposes).map((x) => String(x).trim()).filter(Boolean)) {
    for (let i = 0; i < selectedProviders.length; i++) {
      const sp = selectedProviders[i];
      const providerRowId = String((sp as any).rowId || (sp as any).providerId || '').trim();
      const modelId = String((sp as any).modelId || (sp as any).id || '').trim();
      if (!providerRowId || !modelId) continue;

      try {
        const exists = await dbGet(
          `SELECT id FROM ai_purpose_assignments
           WHERE purpose = ?
             AND organization_id IS NULL
             AND provider_id = ?
           LIMIT 1`,
          [p, providerRowId],
          { fallback: true } as any
        );
        if (exists) continue;

        await dbRun(
          `INSERT INTO ai_purpose_assignments
           (id, organization_id, purpose, provider_id, model_id, priority, is_active, created_at, updated_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [randomUUID(), p, providerRowId, modelId, i * 10, activeValue],
          { fallback: true } as any
        );
        seeded += 1;
      } catch (err: any) {
        logger.warn('[AIRoutingBootstrap] failed to seed purpose assignment', {
          purpose: p,
          providerId: providerRowId,
          error: err?.message || err,
        });
      }
    }
  }

  return { seeded, purposes: Array.from(purposes) };
}

export async function ensureRoutingSchemaAndSeedDefaults(): Promise<{
  schemaEnsured: boolean;
  seeded: number;
}> {
  await ensureRoutingSchema();
  const result = await seedPurposeAssignments();
  logger.info('[AIRoutingBootstrap] Purpose routing defaults ensured', {
    seeded: result.seeded,
    purposes: result.purposes.length,
  });
  return { schemaEnsured: true, seeded: result.seeded };
}

export default { ensureRoutingSchemaAndSeedDefaults };

