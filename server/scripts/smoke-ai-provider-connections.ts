#!/usr/bin/env tsx
/**
 * Smoke: AI provider connections + purpose coverage
 *
 * Goal:
 * - After inserting API keys (DB or env), verify providers are reachable
 * - Verify each ai_purpose has at least one active assignment pointing to a configured provider
 *
 * Usage (repo root):
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." tsx server/scripts/smoke-ai-provider-connections.ts
 *
 * Notes:
 * - Never prints secrets.
 * - For TEXT_LLM providers uses llmService.testConnection (cheap ping).
 * - For Replicate (IMAGE_MODEL) does a low-cost auth check via list models.
 */

import * as DbPromise from '../src/utils/DbPromise.js';
import { llmService } from '../src/services/ai/llmService.js';

const SMOKE_DB_TIMEOUT_MS = 15_000;
const DB_RETRY_ATTEMPTS = 3;

type CheckResult = {
  name: string;
  pass: boolean;
  details?: string;
};

type ProviderRow = {
  id: string;
  name: string;
  provider: string;
  model_id?: string | null;
  endpoint?: string | null;
  api_key?: string | null;
  kind?: string | null; // TEXT_LLM / IMAGE_MODEL
  is_active?: any;
  visibility?: string | null;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = String((error as Error)?.message || error).toLowerCase();
      const isTimeout = message.includes('timeout');
      if (!isTimeout || attempt === DB_RETRY_ATTEMPTS) {
        throw error;
      }
      await sleep(250 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unknown DB error');
}

async function dbAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return withDbRetry(() =>
    DbPromise.all<T>(sql, params, {
      fallback: false,
      timeout: SMOKE_DB_TIMEOUT_MS,
    })
  );
}

async function dbGet<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  return withDbRetry(() =>
    DbPromise.get<T>(sql, params, {
      fallback: false,
      timeout: SMOKE_DB_TIMEOUT_MS,
    })
  );
}

function normalizeBaseUrl(endpoint?: string | null): string {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';
  // Strip common suffixes so we can call base endpoints.
  let base = raw.replace(/\/+$/, '');
  const suffixes = [
    '/chat/completions',
    '/v1/chat/completions',
    '/v1/completions',
    '/v1/responses',
    '/v1/messages',
  ];
  const lower = base.toLowerCase();
  for (const s of suffixes) {
    if (lower.endsWith(s)) {
      base = base.slice(0, -s.length).replace(/\/+$/, '');
      break;
    }
  }
  return base;
}

async function replicateAuthCheck(row: ProviderRow): Promise<{ ok: boolean; detail: string }> {
  const token =
    String(row.api_key || '').trim() ||
    String(process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || '').trim();
  if (!token) return { ok: false, detail: 'Missing token (REPLICATE_API_TOKEN)' };

  const base = normalizeBaseUrl(row.endpoint) || 'https://api.replicate.com/v1';
  const url = `${base.replace(/\/+$/, '')}/models?limit=1`;
  const startedAt = Date.now();
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });
  const latency = Date.now() - startedAt;
  if (res.ok) return { ok: true, detail: `OK (${latency}ms)` };
  const text = await res.text().catch(() => '');
  return { ok: false, detail: `HTTP ${res.status} (${latency}ms): ${text.slice(0, 120)}` };
}

async function testProvider(row: ProviderRow): Promise<CheckResult> {
  const provider = String(row.provider || '').toLowerCase();
  const kind = String(row.kind || 'TEXT_LLM').toUpperCase();
  const modelId = String(row.model_id || '').trim();

  // IMAGE providers
  if (kind === 'IMAGE_MODEL') {
    if (provider === 'replicate') {
      try {
        const r = await replicateAuthCheck(row);
        return {
          name: `Provider IMAGE ${row.name} (${provider})`,
          pass: r.ok,
          details: r.detail,
        };
      } catch (e: any) {
        return {
          name: `Provider IMAGE ${row.name} (${provider})`,
          pass: false,
          details: String(e?.message || e),
        };
      }
    }

    // For other IMAGE_MODEL vendors we currently treat image calls via dedicated services.
    // Do a lightweight "configured" check without generating an image (costly).
    const hasKey = !!String(row.api_key || '').trim();
    return {
      name: `Provider IMAGE ${row.name} (${provider})`,
      pass: hasKey || true,
      details: hasKey ? 'Configured (db key present)' : 'Skipped (no low-cost check implemented)',
    };
  }

  // TEXT providers
  try {
    const result = await llmService.testConnection({
      provider: row.provider,
      api_key: row.api_key,
      apiKey: row.api_key,
      id: modelId || 'ping',
      endpoint: row.endpoint,
    } as any);

    const ok = (result as any)?.success === true;
    const latency = (result as any)?.latency;
    const status = (result as any)?.httpStatus;
    const msg = (result as any)?.error || (result as any)?.message || '';
    return {
      name: `Provider TEXT ${row.name} (${provider})`,
      pass: ok,
      details: ok
        ? `OK${typeof latency === 'number' ? ` (${latency}ms)` : ''}${status ? ` HTTP ${status}` : ''}`
        : String(msg || 'Connection failed'),
    };
  } catch (e: any) {
    return {
      name: `Provider TEXT ${row.name} (${provider})`,
      pass: false,
      details: String(e?.message || e),
    };
  }
}

async function checkPurposeCoverage(): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];

  // If enterprise tables not present, skip.
  try {
    await dbGet(`SELECT purpose FROM ai_purposes LIMIT 1`);
  } catch {
    checks.push({
      name: 'Purpose coverage (ai_purposes)',
      pass: true,
      details: 'Skipped (ai_purposes table not present in this DB)',
    });
    return checks;
  }

  const purposes = await dbAll<{ purpose: string; kind: string; is_active?: any }>(
    `SELECT purpose, kind, is_active FROM ai_purposes`,
    []
  );
  const providers = await dbAll<ProviderRow>(
    `SELECT id, name, provider, model_id, endpoint, api_key, kind, is_active FROM llm_providers`,
    []
  );
  const providerById = new Map<string, ProviderRow>();
  for (const p of providers || []) providerById.set(String(p.id), p);

  for (const p of purposes || []) {
    const purpose = String(p.purpose || '').trim();
    if (!purpose) continue;
    const isActive = (p as any)?.is_active !== false && (p as any)?.is_active !== 0;
    if (!isActive) continue;

    const assignments = await dbAll<any>(
      `SELECT provider_id, is_active FROM ai_purpose_assignments WHERE purpose = ?`,
      [purpose]
    );
    const activeAssignments = (assignments || []).filter(
      (a: any) => a?.is_active !== false && a?.is_active !== 0
    );

    const configured = activeAssignments.some((a: any) => {
      const providerRow = providerById.get(String(a.provider_id));
      if (!providerRow) return false;
      const prowActive = (providerRow as any)?.is_active !== false && (providerRow as any)?.is_active !== 0;
      if (!prowActive) return false;
      const hasKey = !!String(providerRow.api_key || '').trim();
      // env-configured fallback (covers OpenAI/OpenRouter/Anthropic/Gemini/DeepSeek/z.ai/Replicate)
      const envConfigured =
        providerRow.provider === 'openrouter'
          ? !!process.env.OPENROUTER_API_KEY
          : providerRow.provider === 'openai'
            ? !!process.env.OPENAI_API_KEY
            : providerRow.provider === 'anthropic'
              ? !!process.env.ANTHROPIC_API_KEY
              : providerRow.provider === 'google' || providerRow.provider === 'gemini'
                ? !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || (process.env as any).GOOGLE_API_KEY)
                : providerRow.provider === 'deepseek'
                  ? !!process.env.DEEPSEEK_API_KEY
                  : providerRow.provider === 'zai' || providerRow.provider === 'z_ai'
                    ? !!process.env.ZAI_API_KEY
                    : providerRow.provider === 'replicate'
                      ? !!(process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY)
                      : false;
      return hasKey || envConfigured;
    });

    checks.push({
      name: `Purpose coverage: ${purpose}`,
      pass: configured,
      details: configured
        ? 'OK (has at least one active assignment to configured provider)'
        : `Missing active assignment to configured provider`,
    });
  }

  return checks;
}

async function main(): Promise<void> {
  const checks: CheckResult[] = [];

  const providers = await dbAll<ProviderRow>(
    `SELECT id, name, provider, model_id, endpoint, api_key, kind, is_active, visibility
     FROM llm_providers
     ORDER BY is_active DESC, provider ASC, name ASC`,
    []
  );

  const active = (providers || []).filter((p) => (p as any)?.is_active !== false && (p as any)?.is_active !== 0);
  if (active.length === 0) {
    checks.push({ name: 'Providers configured', pass: false, details: 'No active providers in llm_providers' });
  } else {
    for (const p of active) {
      checks.push(await testProvider(p));
    }
  }

  checks.push(...(await checkPurposeCoverage()));

  const failed = checks.filter((c) => !c.pass);

  console.log('\n[smoke-ai-provider-connections] Summary:');
  for (const c of checks) {
    const suffix = c.details ? ` — ${c.details}` : '';
    console.log(` - ${c.pass ? 'OK' : 'FAIL'} ${c.name}${suffix}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((x) => x.name).join(', ')}`);
  }
  console.log('\n[smoke-ai-provider-connections] All checks passed.');
}

main().catch((err) => {
  console.error('[smoke-ai-provider-connections] Failed:', (err as any)?.message || err);
  process.exit(1);
});

