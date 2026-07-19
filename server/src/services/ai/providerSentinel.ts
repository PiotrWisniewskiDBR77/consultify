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

import {
  all as dbAll,
  columnExists as dbColumnExists,
  run as dbRun,
  tableExists as dbTableExists,
} from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { getAlertAggregator } from '../AlertAggregator.js';
import { EXECUTIVE_USE_CASES, getRoutingPurposeKeys } from './aiTaskCatalog.js';
import { ALERT_TYPE, SEVERITY } from './alerting.js';
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
  // Strip ONLY the trailing operation path, and leave any /vN version segment
  // intact (e.g. https://api.anthropic.com/v1/messages -> https://api.anthropic.com/v1,
  // NOT bare https://api.anthropic.com). The old list included '/v1/messages' etc.
  // as whole suffixes, which over-stripped the /v1 segment too -> provider SDKs
  // then POST to `${baseURL}/messages` with no /v1 -> 404. See llmService.ts's
  // normalizeBaseUrl (same bug, fixed the same way) for the twin of this function.
  const suffixes = ['/chat/completions', '/completions', '/responses', '/messages'];
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
  if (m.includes('api key expired') || m.includes('renew the api key')) return 'auth';
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

const ACTIVE_SQL = `COALESCE(NULLIF(LOWER(TRIM(CAST(%s AS TEXT))), ''), 'false') IN ('1', 'true', 't', 'yes', 'y', 'on')`;

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
  errorCategory?: ErrorCategory | null;
  errorHttpStatus?: number | null;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const hasErrorCols = await hasProviderErrorColumns();
    if (!hasErrorCols) {
      await dbRun(
        `UPDATE llm_providers
         SET health_status = ?, last_health_check = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [params.status, params.checkedAtIso, params.providerId],
        { fallback: true }
      );
      return;
    }

    await dbRun(
      `UPDATE llm_providers
       SET
         health_status = ?,
         last_health_check = ?,
         last_error_category = ?,
         last_error_http_status = ?,
         last_error_message = ?,
         last_error_at = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        params.status,
        params.checkedAtIso,
        params.errorCategory || null,
        typeof params.errorHttpStatus === 'number' ? params.errorHttpStatus : null,
        params.errorMessage || null,
        params.errorCategory ? params.checkedAtIso : null,
        params.providerId,
      ],
      { fallback: true }
    );
  } catch {
    /* ignore */
  }
}

let providerErrorColsCached: boolean | null = null;
async function hasProviderErrorColumns(): Promise<boolean> {
  if (providerErrorColsCached !== null) return providerErrorColsCached;
  try {
    const [c1, c2, c3, c4] = await Promise.all([
      dbColumnExists('llm_providers', 'last_error_category'),
      dbColumnExists('llm_providers', 'last_error_http_status'),
      dbColumnExists('llm_providers', 'last_error_message'),
      dbColumnExists('llm_providers', 'last_error_at'),
    ]);
    providerErrorColsCached = !!(c1 && c2 && c3 && c4);
  } catch {
    providerErrorColsCached = false;
  }
  return providerErrorColsCached;
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

async function emitAggregatedAlert(
  alertType: string,
  severity: 'info' | 'warning' | 'error' | 'critical',
  title: string,
  message: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await getAlertAggregator().processAlert(alertType, severity, title, message, data);
  } catch (err: any) {
    logger.warn('[ProviderSentinel] Failed to emit alert', {
      error: err?.message || err,
      alertType,
    });
  }
}

let hasLoggedCoverageSchemaSkip = false;
const coverageStartAtMs = Date.now();
let hasLoggedCoverageGraceSkip = false;

async function routingCoverageSchemaReady(): Promise<boolean> {
  try {
    const [hasAssignments, hasProviders, hasPurpose, hasProviderId, hasProviderHealthStatus] =
      await Promise.all([
        dbTableExists('ai_purpose_assignments'),
        dbTableExists('llm_providers'),
        dbColumnExists('ai_purpose_assignments', 'purpose'),
        dbColumnExists('ai_purpose_assignments', 'provider_id'),
        dbColumnExists('llm_providers', 'health_status'),
      ]);

    return hasAssignments && hasProviders && hasPurpose && hasProviderId && hasProviderHealthStatus;
  } catch {
    return false;
  }
}

async function evaluateUseCaseCoverage(): Promise<void> {
  // Avoid false-positive "coverage missing" alerts during cold start while bootstrap is seeding.
  const graceMs = Number(process.env.AI_PURPOSE_COVERAGE_GRACE_MS || 120_000);
  if (Number.isFinite(graceMs) && graceMs > 0 && Date.now() - coverageStartAtMs < graceMs) {
    if (!hasLoggedCoverageGraceSkip) {
      logger.info(
        '[ProviderSentinel] Skipping purpose coverage check during startup grace window',
        {
          graceMs,
        }
      );
      hasLoggedCoverageGraceSkip = true;
    }
    return;
  }

  const schemaReady = await routingCoverageSchemaReady();
  if (!schemaReady) {
    if (!hasLoggedCoverageSchemaSkip) {
      logger.info(
        '[ProviderSentinel] Skipping purpose coverage check until AI routing schema is ready'
      );
      hasLoggedCoverageSchemaSkip = true;
    }
    return;
  }

  hasLoggedCoverageSchemaSkip = false;

  for (const useCase of EXECUTIVE_USE_CASES) {
    const purposeHealth = await Promise.all(
      useCase.purposes.map(async (purpose) => {
        const routingKeys = getRoutingPurposeKeys(purpose);
        if (routingKeys.length === 0) {
          return { purpose, total: 0, healthyish: 0 };
        }

        const placeholders = routingKeys.map(() => '?').join(',');
        const rows = (await dbAll(
          `SELECT lp.health_status
           FROM ai_purpose_assignments apa
           INNER JOIN llm_providers lp ON lp.id = apa.provider_id
           WHERE apa.purpose IN (${placeholders})
             AND ${ACTIVE_SQL.replace('%s', 'apa.is_active')}
             AND ${ACTIVE_SQL.replace('%s', 'lp.is_active')}`,
          routingKeys,
          { fallback: true } as any
        )) as Array<{ health_status?: string | null }>;

        const total = rows.length;
        const healthyish = rows.filter((row) => {
          const status = String(row.health_status || 'unknown').toLowerCase();
          return status === 'healthy' || status === 'degraded' || status === 'unknown';
        }).length;

        return { purpose, total, healthyish };
      })
    );

    const missing = purposeHealth.filter((item) => item.total === 0).map((item) => item.purpose);
    const threatened = purposeHealth
      .filter((item) => item.total > 0 && item.healthyish === 0)
      .map((item) => item.purpose);

    if (missing.length > 0) {
      await emitAggregatedAlert(
        ALERT_TYPE.PURPOSE_COVERAGE_MISSING,
        SEVERITY.CRITICAL,
        `Purpose coverage missing: ${useCase.label}`,
        `No assignments found for: ${missing.join(', ')}`,
        { useCase: useCase.key, purposes: missing }
      );
    }

    if (threatened.length > 0) {
      await emitAggregatedAlert(
        ALERT_TYPE.DELIVERY_THREATENED,
        SEVERITY.CRITICAL,
        `LLM delivery threatened: ${useCase.label}`,
        `No healthy providers remain for: ${threatened.join(', ')}`,
        { useCase: useCase.key, purposes: threatened, severity: SEVERITY.CRITICAL }
      );
    }
  }
}

class ProviderSentinel {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;
  private lastRunAt = 0;

  start(intervalMs = 120_000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(
      () =>
        void this.runOnce().catch((err: unknown) =>
          logger.warn('[ProviderSentinel] health check failed', err)
        ),
      Math.max(30_000, intervalMs)
    );
    void this.runOnce().catch((err: unknown) =>
      logger.warn('[ProviderSentinel] initial health check failed', err)
    );
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
         WHERE ${ACTIVE_SQL.replace('%s', 'is_active')}`,
        [],
        { fallback: true } as any
      )) as any as ProviderRow[];

      for (const p of providers || []) {
        if (!isActive((p as any).is_active)) continue;
        try {
          const r = await testProvider(p);
          const providerId = String(p.provider || '').toLowerCase();
          const cat = r.errorMessage ? classifyError(r.errorMessage, r.httpStatus || null) : null;

          // Keep OpenRouter continuously selectable in routing even if it has auth/billing issues.
          // Mark as degraded (not unhealthy) so modelRouter's health gating doesn't exclude it,
          // but still record the error and report it as unavailable for diagnostics.
          const statusToWrite: HealthStatus =
            providerId === 'openrouter' &&
            r.status === 'unhealthy' &&
            (cat === 'auth' || cat === 'billing')
              ? 'degraded'
              : r.status;

          const available =
            (statusToWrite === 'healthy' || statusToWrite === 'degraded') &&
            !(
              providerId === 'openrouter' &&
              (cat === 'auth' || cat === 'billing') &&
              r.status === 'unhealthy'
            );
          const errorMsg = r.errorMessage
            ? `${cat ? `${cat.toUpperCase()}: ` : ''}${r.errorMessage}`
            : null;

          await writeProviderStatus({
            providerId: p.id,
            status: statusToWrite,
            checkedAtIso,
            errorCategory: available ? null : cat || 'unknown',
            errorHttpStatus: available ? null : (r.httpStatus ?? null),
            errorMessage: available ? null : errorMsg,
          });
          await writeHealthEvent({
            provider: p.provider,
            model: p.model_id || null,
            status: statusToWrite,
            available,
            latencyMs: r.latencyMs || 0,
            errorMessage: available ? null : errorMsg,
            checkedAtIso,
          });

          if (!available) {
            const severity =
              cat === 'billing' || cat === 'auth' || cat === 'missing_key' || cat === 'rate_limit'
                ? SEVERITY.WARNING
                : SEVERITY.CRITICAL;

            const titlePrefix =
              cat === 'billing'
                ? 'Provider billing issue'
                : cat === 'auth'
                  ? 'Provider auth issue'
                  : cat === 'missing_key'
                    ? 'Provider missing key'
                    : cat === 'rate_limit'
                      ? 'Provider rate-limited'
                      : 'Provider down';

            const hint =
              cat === 'billing'
                ? 'Likely unpaid/credits/quota issue. Check provider billing/subscription.'
                : cat === 'auth'
                  ? 'Likely invalid/expired key. Check API key permissions.'
                  : cat === 'missing_key'
                    ? 'Provider key not configured in env/DB.'
                    : cat === 'rate_limit'
                      ? 'Rate limit hit. Consider throttling or adding fallback.'
                      : null;

            await emitAggregatedAlert(
              String(p.kind || '').toUpperCase() === 'IMAGE_MODEL'
                ? ALERT_TYPE.IMAGE_PROVIDER_UNAVAILABLE
                : ALERT_TYPE.PROVIDER_DOWN,
              severity,
              `${titlePrefix}: ${p.provider}`,
              `${errorMsg || 'Provider unavailable'}${hint ? `\n\nHint: ${hint}` : ''}`,
              {
                providerId: p.provider,
                modelId: p.model_id || null,
                purpose:
                  String(p.kind || '').toUpperCase() === 'IMAGE_MODEL'
                    ? 'presentation_visual_generation'
                    : undefined,
                error: errorMsg,
                errorCategory: cat || 'unknown',
                httpStatus: r.httpStatus ?? null,
              }
            );
          } else if ((r.latencyMs || 0) >= 8000) {
            await emitAggregatedAlert(
              ALERT_TYPE.HIGH_LATENCY,
              SEVERITY.WARNING,
              `High latency: ${p.provider}`,
              `Latency ${r.latencyMs}ms for ${p.provider}/${p.model_id || 'default'}`,
              {
                providerId: p.provider,
                modelId: p.model_id || null,
                latencyMs: r.latencyMs,
                threshold: 8000,
              }
            );
          }
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
          await emitAggregatedAlert(
            ALERT_TYPE.PROVIDER_DOWN,
            SEVERITY.CRITICAL,
            `Provider down: ${p.provider}`,
            String(e?.message || e).slice(0, 300),
            { providerId: p.provider, modelId: p.model_id || null, error: String(e?.message || e) }
          );
        }
      }

      await evaluateUseCaseCoverage();
    } catch (e: any) {
      logger.warn('[ProviderSentinel] runOnce failed', { error: e?.message || e });
    } finally {
      this.running = false;
    }
  }
}

export const providerSentinel = new ProviderSentinel();
export default providerSentinel;
