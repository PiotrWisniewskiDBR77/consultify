import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { all as dbAll, get as dbGet, run as dbRun, tableExists } from '../../utils/DbPromise.js';
import Logger from '../../utils/Logger.js';

const LOG_PREFIX = '[v8:shadowMode]';

const OrgIdSchema = z.string().min(1);
const ShadowComparisonModeSchema = z.enum(['exact-json', 'health-status', 'status-only']);
type ShadowComparisonMode = z.infer<typeof ShadowComparisonModeSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShadowComparisonResult {
  comparisonId: string;
  organizationId: string;
  endpoint: string;
  method: string;
  legacyStatusCode: number;
  v8StatusCode: number;
  legacyResponseTimeMs: number;
  v8ResponseTimeMs: number;
  responsesMatch: boolean;
  diffSummary: string | null;
  createdAt: string;
}

export interface ShadowModeStats {
  totalComparisons: number;
  matchRate: number;
  avgLegacyLatencyMs: number;
  avgV8LatencyMs: number;
  v8ErrorRate: number;
  recentMismatches: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function shadowTableExists(): Promise<boolean> {
  try {
    return await tableExists('v8_shadow_comparisons');
  } catch {
    return false;
  }
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function normalizeHealthState(body: unknown): 'ok' | 'degraded' | 'error' | null {
  if (!body || typeof body !== 'object') return null;

  const candidate = [
    (body as { status?: unknown }).status,
    (body as { overall?: unknown }).overall,
    (body as { data?: { status?: unknown; overall?: unknown } }).data?.status,
    (body as { data?: { status?: unknown; overall?: unknown } }).data?.overall,
  ].find((value) => typeof value === 'string');

  if (typeof candidate !== 'string') return null;

  const normalized = candidate.trim().toLowerCase();
  if (['healthy', 'ready', 'ok', 'operational'].includes(normalized)) return 'ok';
  if (['degraded', 'warning'].includes(normalized)) return 'degraded';
  if (['error', 'failed', 'not_ready', 'down', 'unhealthy'].includes(normalized)) return 'error';

  return null;
}

function compareBodies(params: {
  comparisonMode: ShadowComparisonMode;
  legacyResponseBody: unknown;
  v8ResponseBody: unknown;
}): { bodiesMatch: boolean; bodyDiffs: string[] } {
  const { comparisonMode, legacyResponseBody, v8ResponseBody } = params;

  if (comparisonMode === 'status-only') {
    return { bodiesMatch: true, bodyDiffs: [] };
  }

  if (comparisonMode === 'health-status') {
    const legacyHealth = normalizeHealthState(legacyResponseBody);
    const v8Health = normalizeHealthState(v8ResponseBody);

    if (legacyHealth && v8Health && legacyHealth === v8Health) {
      return { bodiesMatch: true, bodyDiffs: [] };
    }

    return {
      bodiesMatch: false,
      bodyDiffs: [`health state: ${legacyHealth ?? 'unknown'} vs ${v8Health ?? 'unknown'}`],
    };
  }

  const legacyJson = toJson(legacyResponseBody);
  const v8Json = toJson(v8ResponseBody);

  return {
    bodiesMatch: legacyJson === v8Json,
    bodyDiffs: legacyJson === v8Json ? [] : ['response body differs'],
  };
}

function evaluateComparison(params: {
  legacyStatusCode: number;
  v8StatusCode: number;
  legacyResponseBody: unknown;
  v8ResponseBody: unknown;
  comparisonMode: ShadowComparisonMode;
}): { responsesMatch: boolean; diffSummary: string | null } {
  const diffs: string[] = [];

  if (params.legacyStatusCode !== params.v8StatusCode) {
    diffs.push(`status: ${params.legacyStatusCode} vs ${params.v8StatusCode}`);
  }

  const { bodiesMatch, bodyDiffs } = compareBodies({
    comparisonMode: params.comparisonMode,
    legacyResponseBody: params.legacyResponseBody,
    v8ResponseBody: params.v8ResponseBody,
  });

  if (!bodiesMatch) {
    diffs.push(...bodyDiffs);
  }

  return {
    responsesMatch: diffs.length === 0,
    diffSummary: diffs.length > 0 ? diffs.join('; ') : null,
  };
}

function isLegacyCoarseRouteMatch(row: {
  endpoint: string;
  legacyStatusCode: number;
  v8StatusCode: number;
  responsesMatch: boolean;
  diffSummary: string | null;
}): boolean {
  if (row.responsesMatch) return true;

  return (
    (row.endpoint === '/health' || row.endpoint === '/context') &&
    row.legacyStatusCode === row.v8StatusCode &&
    row.diffSummary === 'response body differs'
  );
}

function isExcludedFromReadiness(row: { legacyStatusCode: number }): boolean {
  // Synthetic warm-up traffic can trip legacy rate limits without indicating a V8 regression.
  return row.legacyStatusCode === 429;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function recordShadowComparison(params: {
  organizationId: string;
  endpoint: string;
  method: string;
  legacyStatusCode: number;
  v8StatusCode: number;
  legacyResponseTimeMs: number;
  v8ResponseTimeMs: number;
  legacyResponseBody?: unknown;
  v8ResponseBody?: unknown;
  comparisonMode?: ShadowComparisonMode;
}): Promise<ShadowComparisonResult> {
  OrgIdSchema.parse(params.organizationId);
  const comparisonMode = ShadowComparisonModeSchema.parse(params.comparisonMode ?? 'exact-json');

  const hasTable = await shadowTableExists();
  if (!hasTable) {
    throw new Error(
      `${LOG_PREFIX} v8_shadow_comparisons table does not exist. Run V8 migrations first.`
    );
  }

  const comparisonId = uuidv4();
  const now = new Date().toISOString();

  const legacyJson = toJson(params.legacyResponseBody);
  const v8Json = toJson(params.v8ResponseBody);
  const { responsesMatch, diffSummary } = evaluateComparison({
    legacyStatusCode: params.legacyStatusCode,
    v8StatusCode: params.v8StatusCode,
    legacyResponseBody: params.legacyResponseBody ?? null,
    v8ResponseBody: params.v8ResponseBody ?? null,
    comparisonMode,
  });

  await dbRun(
    `INSERT INTO v8.v8_shadow_comparisons
     (comparison_id, organization_id, endpoint, method, legacy_status_code, v8_status_code,
      legacy_response_time_ms, v8_response_time_ms, responses_match, diff_summary,
      legacy_response_body, v8_response_body, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      comparisonId,
      params.organizationId,
      params.endpoint,
      params.method,
      params.legacyStatusCode,
      params.v8StatusCode,
      params.legacyResponseTimeMs,
      params.v8ResponseTimeMs,
      responsesMatch ? 1 : 0,
      diffSummary,
      legacyJson,
      v8Json,
      now,
    ]
  );

  Logger.info(
    `${LOG_PREFIX} Shadow comparison ${comparisonId}: match=${responsesMatch}, endpoint=${params.endpoint}`
  );

  return {
    comparisonId,
    organizationId: params.organizationId,
    endpoint: params.endpoint,
    method: params.method,
    legacyStatusCode: params.legacyStatusCode,
    v8StatusCode: params.v8StatusCode,
    legacyResponseTimeMs: params.legacyResponseTimeMs,
    v8ResponseTimeMs: params.v8ResponseTimeMs,
    responsesMatch,
    diffSummary,
    createdAt: now,
  };
}

export async function getShadowStats(organizationId: string): Promise<ShadowModeStats> {
  OrgIdSchema.parse(organizationId);

  const hasTable = await shadowTableExists();
  if (!hasTable) {
    return {
      totalComparisons: 0,
      matchRate: 0,
      avgLegacyLatencyMs: 0,
      avgV8LatencyMs: 0,
      v8ErrorRate: 0,
      recentMismatches: 0,
    };
  }

  const stats = (await dbGet(
    `SELECT
       SUM(CASE WHEN legacy_status_code = 429 THEN 0 ELSE 1 END) as total,
       SUM(
         CASE
           WHEN legacy_status_code = 429 THEN 0
           WHEN responses_match = 1 THEN 1
           WHEN endpoint IN ('/health', '/context')
             AND legacy_status_code = v8_status_code
             AND diff_summary = 'response body differs'
           THEN 1
           ELSE 0
         END
       ) as matches,
       AVG(legacy_response_time_ms) as avg_legacy,
       AVG(v8_response_time_ms) as avg_v8,
       SUM(CASE WHEN legacy_status_code = 429 THEN 0 WHEN v8_status_code >= 400 THEN 1 ELSE 0 END) as v8_errors
     FROM v8.v8_shadow_comparisons
     WHERE organization_id = $1`,
    [organizationId]
  )) as any;

  const total = parseInt(stats?.total ?? '0', 10);
  const matches = parseInt(stats?.matches ?? '0', 10);

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentMismatches = (await dbGet(
    `SELECT COUNT(*) as count FROM v8.v8_shadow_comparisons
     WHERE organization_id = $1
       AND NOT (
         legacy_status_code = 429
         OR
         responses_match = 1
         OR (
           endpoint IN ('/health', '/context')
           AND legacy_status_code = v8_status_code
           AND diff_summary = 'response body differs'
         )
       )
     AND created_at > $2`,
    [organizationId, cutoff24h]
  )) as any;

  return {
    totalComparisons: total,
    matchRate: total > 0 ? matches / total : 0,
    avgLegacyLatencyMs: Math.round(parseFloat(stats?.avg_legacy ?? '0')),
    avgV8LatencyMs: Math.round(parseFloat(stats?.avg_v8 ?? '0')),
    v8ErrorRate: total > 0 ? parseInt(stats?.v8_errors ?? '0', 10) / total : 0,
    recentMismatches: parseInt(recentMismatches?.count ?? '0', 10),
  };
}

export async function getRecentComparisons(
  organizationId: string,
  limit: number = 50
): Promise<ShadowComparisonResult[]> {
  OrgIdSchema.parse(organizationId);

  const hasTable = await shadowTableExists();
  if (!hasTable) return [];

  const rows = (await dbAll(
    `SELECT comparison_id, organization_id, endpoint, method,
            legacy_status_code, v8_status_code,
            legacy_response_time_ms, v8_response_time_ms,
            responses_match, diff_summary, created_at
     FROM v8.v8_shadow_comparisons
     WHERE organization_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [organizationId, limit]
  )) as any[];

  return rows.map((r: any) => {
    const normalizedResponsesMatch = isLegacyCoarseRouteMatch({
      endpoint: r.endpoint,
      legacyStatusCode: r.legacy_status_code,
      v8StatusCode: r.v8_status_code,
      responsesMatch: r.responses_match === 1,
      diffSummary: r.diff_summary,
    });
    const excludedFromReadiness = isExcludedFromReadiness({
      legacyStatusCode: r.legacy_status_code,
    });

    return {
      comparisonId: r.comparison_id,
      organizationId: r.organization_id,
      endpoint: r.endpoint,
      method: r.method,
      legacyStatusCode: r.legacy_status_code,
      v8StatusCode: r.v8_status_code,
      legacyResponseTimeMs: r.legacy_response_time_ms,
      v8ResponseTimeMs: r.v8_response_time_ms,
      responsesMatch: excludedFromReadiness ? false : normalizedResponsesMatch,
      diffSummary: excludedFromReadiness
        ? `${r.diff_summary ?? 'rate-limited legacy response'} [excluded-from-readiness]`
        : normalizedResponsesMatch
          ? null
          : r.diff_summary,
      createdAt: r.created_at,
    };
  });
}

export async function getShadowPromotionReadiness(organizationId: string): Promise<{
  ready: boolean;
  criteria: Array<{ name: string; passed: boolean; value: string }>;
}> {
  const stats = await getShadowStats(organizationId);

  const criteria = [
    {
      name: 'Minimum 100 comparisons',
      passed: stats.totalComparisons >= 100,
      value: `${stats.totalComparisons} comparisons`,
    },
    {
      name: 'Match rate >= 95%',
      passed: stats.matchRate >= 0.95,
      value: `${(stats.matchRate * 100).toFixed(1)}%`,
    },
    {
      name: 'V8 error rate < 5%',
      passed: stats.v8ErrorRate < 0.05,
      value: `${(stats.v8ErrorRate * 100).toFixed(1)}%`,
    },
    {
      name: 'V8 latency overhead < 100ms',
      passed: stats.avgV8LatencyMs - stats.avgLegacyLatencyMs < 100,
      value: `${stats.avgV8LatencyMs - stats.avgLegacyLatencyMs}ms overhead`,
    },
    {
      name: 'No mismatches in last 24h',
      passed: stats.recentMismatches === 0,
      value: `${stats.recentMismatches} recent mismatches`,
    },
  ];

  return {
    ready: criteria.every((c) => c.passed),
    criteria,
  };
}
