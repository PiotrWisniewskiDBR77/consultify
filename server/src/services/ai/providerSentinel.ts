/**
 * Provider Sentinel (v3)
 *
 * Runs continuous provider diagnostics in the background and stores results in DB:
 * - llm_providers.health_status / last_health_check
 * - llm_health_events time-series (best-effort)
 *
 * Why:
 * - User should NOT have to run scripts manually.
 * - SuperAdmin should see real-time issues: missing key, billing/quota, rate limit, outage.
 *
 * Safe:
 * - Never logs secrets.
 * - Uses cheap test calls (llmService.testConnection, Replicate list models).
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { llmService } from './llmService.js';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
type ErrorCategory = 'missing_key' | 'auth' | 'billing' | 'rate_limit' | 'network' | 'unknown';

type ProviderRow = {
  id: string;
  name: string;
  provider: string;
  model_id?: string | null;
  endpoint?: string | null;
  api_key?: string | null;
  kind?: string | null; // TEXT_LLM / IMAGE_MODEL
  is_active?: any;
};

function isActive(v: any): boolean {
  return v !== false && v !== 0 && String(v).toLowerCase() !== 'false';
}

function normalizeBaseUrl(endpoint?: string | null): string {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';
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

function envConfigured(provider: string): boolean {
  const p = String(provider || '').toLowerCase();
  if (p === 'openrouter') return !!process.env.OPENROUTER_API_KEY?.trim();
  if (p === 'openai') return !!process.env.OPENAI_API_KEY?.trim();
  if (p === 'anthropic') return !!process.env.ANTHROPIC_API_KEY?.trim();
  if (p === 'google' || p === 'gemini') {
    return !!(
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      (process.env as any).GOOGLE_API_KEY
    )?.trim();
  }
  if (p === 'deepseek') return !!process.env.DEEPSEEK_API_KEY?.trim();
  if (p === 'zai' || p === 'z_ai') return !!process.env.ZAI_API_KEY?.trim();
  if (p === 'replicate') {
    return !!(process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY)?.trim();
  }
  return false;
}

function classifyError(message: string, httpStatus?: number | null): ErrorCategory {
  const m = String(message || '').toLowerCase();
  const s = typeof httpStatus === 'number' ? httpStatus : null;

  if (m.includes('no ') && m.includes(' api key')) return 'missing_key';
  if (s === 401) return 'auth';
  if (s === 402) return 'billing';
  if (s === 429) return 'rate_limit';
  if (s === 403 && (m.includes('billing') || m.includes('quota') || m.includes('payment')))
    return 'billing';
  if (s === 403 && (m.includes('unauthorized') || m.includes('forbidden') || m.includes('invalid')))
    return 'auth';
  if (m.includes('insufficient_quota') || m.includes('quota') || m.includes('billing'))
    return 'billing';
  if (m.includes('rate limit') || m.includes('too many requests')) return 'rate_limit';
  if (m.includes('timeout') || m.includes('econn') || m.includes('network') || m.includes('socket'))
    return 'network';
  return 'unknown';
}

async function replicateAuthCheck(
  row: ProviderRow
): Promise<{ ok: boolean; detail: string; httpStatus?: number }> {
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
  if (res.ok) return { ok: true, detail: `OK (${latency}ms)`, httpStatus: res.status };
  const text = await res.text().catch(() => '');
  return {
    ok: false,
    detail: `HTTP ${res.status} (${latency}ms): ${text.slice(0, 160)}`,
    httpStatus: res.status,
  };
}

async function writeProviderStatus(params: {
  providerId: string;
  status: HealthStatus;
  checkedAtIso: string;
}): Promise<void> {
  try {
    await dbRun(
      `UPDATE llm_providers
       SET health_status = ?, last_health_check = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [params.status, params.checkedAtIso, params.providerId],
      { fallback: true }
    );
  } catch {
    /* ignore */
  }
}

async function writeHealthEvent(params: {
  provider: string;
  model?: string | null;
  status: HealthStatus;
  available: boolean;
  latencyMs: number;
  errorMessage?: string | null;
  checkedAtIso: string;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO llm_health_events (id, provider, model, status, available, latency_ms, error_message, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        String(params.provider || '').toLowerCase(),
        params.model || null,
        params.status,
        params.available ? 1 : 0,
        params.latencyMs || 0,
        params.errorMessage || null,
        params.checkedAtIso,
      ],
      { fallback: true }
    );
  } catch {
    /* ignore */
  }
}

async function testProvider(row: ProviderRow): Promise<{
  status: HealthStatus;
  latencyMs: number;
  errorMessage?: string | null;
  httpStatus?: number | null;
}> {
  const kind = String(row.kind || 'TEXT_LLM').toUpperCase();
  const provider = String(row.provider || '').toLowerCase();

  const hasDbKey = !!String(row.api_key || '').trim();
  const configured = hasDbKey || envConfigured(provider);
  if (!configured) {
    return {
      status: 'unhealthy',
      latencyMs: 0,
      errorMessage: 'MISSING_KEY: Provider not configured',
    };
  }

  if (kind === 'IMAGE_MODEL') {
    if (provider === 'replicate') {
      const start = Date.now();
      const r = await replicateAuthCheck(row);
      const latencyMs = Date.now() - start;
      return r.ok
        ? {
            status: latencyMs < 3000 ? 'healthy' : 'degraded',
            latencyMs,
            httpStatus: r.httpStatus || null,
          }
        : {
            status: 'unhealthy',
            latencyMs,
            errorMessage: r.detail,
            httpStatus: r.httpStatus || null,
          };
    }
    return { status: 'unknown', latencyMs: 0, errorMessage: null };
  }

  const start = Date.now();
  const result = await llmService.testConnection({
    provider: row.provider,
    apiKey: row.api_key,
    api_key: row.api_key,
    endpoint: row.endpoint,
    id: row.model_id,
  } as any);
  const latencyMs = Date.now() - start;
  if ((result as any)?.success === true) {
    return {
      status: latencyMs < 3000 ? 'healthy' : 'degraded',
      latencyMs,
      httpStatus: (result as any)?.httpStatus || null,
    };
  }
  const msg = String((result as any)?.error || (result as any)?.message || 'Connection failed');
  return {
    status: 'unhealthy',
    latencyMs,
    errorMessage: msg,
    httpStatus: (result as any)?.httpStatus || null,
  };
}

class ProviderSentinel {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;
  private lastRunAt = 0;

  start(intervalMs = 120_000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(
      () => void this.runOnce().catch(() => {}),
      Math.max(30_000, intervalMs)
    );
    void this.runOnce().catch(() => {});
    logger.info('[ProviderSentinel] Started', { intervalMs });
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    logger.info('[ProviderSentinel] Stopped');
  }

  async runOnce(): Promise<void> {
    const now = Date.now();
    if (this.running) return;
    if (now - this.lastRunAt < 10_000) return;
    this.running = true;
    this.lastRunAt = now;
    const checkedAtIso = new Date().toISOString();

    try {
      const providers = (await dbAll<ProviderRow>(
        `SELECT id, name, provider, model_id, endpoint, api_key, kind, is_active
         FROM llm_providers
         WHERE is_active = 1`,
        [],
        { fallback: true } as any
      )) as any as ProviderRow[];

      for (const p of providers || []) {
        if (!isActive((p as any).is_active)) continue;
        try {
          const r = await testProvider(p);
          const available = r.status === 'healthy' || r.status === 'degraded';
          const cat = r.errorMessage ? classifyError(r.errorMessage, r.httpStatus || null) : null;
          const errorMsg = r.errorMessage
            ? `${cat ? `${cat.toUpperCase()}: ` : ''}${r.errorMessage}`
            : null;

          await writeProviderStatus({ providerId: p.id, status: r.status, checkedAtIso });
          await writeHealthEvent({
            provider: p.provider,
            model: p.model_id || null,
            status: r.status,
            available,
            latencyMs: r.latencyMs || 0,
            errorMessage: available ? null : errorMsg,
            checkedAtIso,
          });
        } catch (e: any) {
          await writeProviderStatus({ providerId: p.id, status: 'unhealthy', checkedAtIso });
          await writeHealthEvent({
            provider: p.provider,
            model: p.model_id || null,
            status: 'unhealthy',
            available: false,
            latencyMs: 0,
            errorMessage: `UNKNOWN: ${String(e?.message || e).slice(0, 300)}`,
            checkedAtIso,
          });
        }
      }
    } catch (e: any) {
      logger.warn('[ProviderSentinel] runOnce failed', { error: e?.message || e });
    } finally {
      this.running = false;
    }
  }
}

export const providerSentinel = new ProviderSentinel();
export default providerSentinel;
