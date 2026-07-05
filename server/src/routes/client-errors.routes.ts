/**
 * Client Error Telemetry Endpoint (#24b)
 *
 * Receives app-level crash reports from the frontend ErrorBoundary /
 * RouteErrorBoundary (POST /api/errors) and records them server-side.
 *
 * Intentionally:
 *  - unauthenticated (crashes can happen before/around auth)
 *  - best-effort + payload-capped (never throws back at the client)
 *  - self-healing schema (lazy DDL, fail-soft) so a fresh env still records
 *
 * Beyond logging, this endpoint now (a) PERSISTS each crash to
 * `client_error_events` for later triage, and (b) AGGREGATES by a normalised
 * signature in a sliding window — when the same frontend crash hits a
 * threshold across users in a short window, it fires ONE throttled Slack
 * alert (#alerts) so a mass frontend outage stops being invisible until a
 * user happens to file a manual report.
 */

import { randomUUID } from 'node:crypto';

import { Request, Response, Router } from 'express';

import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { sendSystemAlert } from '../services/systemAlertNotifier.js';

const router = Router();

const MAX_FIELD = 8_000;

const clamp = (value: unknown, max = MAX_FIELD): string | null => {
  if (typeof value !== 'string') return null;
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
};

// ---------------------------------------------------------------------------
// Lazy schema (fail-soft): environments without migrations still record.
// ---------------------------------------------------------------------------
let _schemaEnsured = false;

async function ensureClientErrorSchema(): Promise<boolean> {
  if (_schemaEnsured) return true;
  try {
    await dbRun(
      `CREATE TABLE IF NOT EXISTS client_error_events (
        id TEXT PRIMARY KEY,
        signature TEXT,
        message TEXT,
        stack TEXT,
        component_stack TEXT,
        url TEXT,
        user_agent TEXT,
        correlation_id TEXT,
        app_env TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_client_error_events_signature ON client_error_events(signature)`
    );
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_client_error_events_created ON client_error_events(created_at)`
    );
    _schemaEnsured = true;
    return true;
  } catch (err) {
    logger.warn('[ClientError] ensureClientErrorSchema failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Signature: collapse volatile bits (numbers, whitespace) so the same logical
// crash from different users/props buckets together. message + first stack frame.
// ---------------------------------------------------------------------------
function computeSignature(message: string | null, stack: string | null): string {
  const firstFrame =
    (stack || '')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('at ')) || '';
  const base = `${(message || 'unknown').slice(0, 160)}|${firstFrame.slice(0, 160)}`;
  return base
    .toLowerCase()
    .replace(/0x[0-9a-f]+/g, '#') // hex addresses
    .replace(/\d+/g, '#') // line/col numbers, ids
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// In-memory sliding-window aggregation. When a signature crosses the threshold
// within the window, alert once (crossing edge); sendSystemAlert's own throttle
// is the backstop against re-alerting on a sustained storm.
// ---------------------------------------------------------------------------
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const ALERT_THRESHOLD = 5; // distinct hits of one signature within the window
const ALERT_THROTTLE_MS = 30 * 60 * 1000; // 30 min between alerts per signature
const MAX_TRACKED_SIGNATURES = 500;

const buckets = new Map<string, number[]>();

function recordAndCount(signature: string): number {
  const now = Date.now();
  const recent = (buckets.get(signature) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  buckets.set(signature, recent);

  // Bound memory: drop the least-recently-touched signatures if we overflow.
  if (buckets.size > MAX_TRACKED_SIGNATURES) {
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [key, times] of buckets) {
      const last = times[times.length - 1] ?? 0;
      if (last < oldestTs) {
        oldestTs = last;
        oldestKey = key;
      }
    }
    if (oldestKey) buckets.delete(oldestKey);
  }

  return recent.length;
}

/**
 * POST /api/errors
 * Body: { message, stack?, componentStack?, url?, userAgent? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const correlationId =
      (req as Request & { correlationId?: string }).correlationId ||
      req.get('X-Correlation-ID') ||
      null;

    const message = clamp(body.message, 500) || 'unknown';
    const stack = clamp(body.stack);
    const componentStack = clamp(body.componentStack);
    const url = clamp(body.url, 500) || req.get('Referer') || null;
    const userAgent = clamp(body.userAgent, 500) || req.get('User-Agent') || null;
    const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';
    const signature = computeSignature(message, stack);

    logger.error('[ClientError] App-level crash reported', {
      message,
      stack,
      componentStack,
      url,
      userAgent,
      correlationId,
      signature,
      receivedAt: new Date().toISOString(),
    });

    // Respond immediately; persistence + alerting are best-effort and must
    // never turn telemetry into a second failure surface.
    res.status(204).end();

    void (async () => {
      try {
        if (await ensureClientErrorSchema()) {
          await dbRun(
            `INSERT INTO client_error_events
               (id, signature, message, stack, component_stack, url, user_agent, correlation_id, app_env, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              randomUUID(),
              signature,
              message,
              stack,
              componentStack,
              url,
              userAgent,
              correlationId,
              appEnv,
              new Date().toISOString(),
            ]
          );
        }
      } catch (err) {
        logger.warn('[ClientError] persist failed (non-fatal)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Aggregate + threshold alert. Fire on the crossing edge; the notifier's
      // throttle prevents a sustained storm from re-paging every request.
      const count = recordAndCount(signature);
      if (count === ALERT_THRESHOLD) {
        try {
          await sendSystemAlert({
            title: message.slice(0, 120),
            message:
              `Ten sam błąd frontendu wystąpił ${count}× w ciągu ${Math.round(
                WINDOW_MS / 60000
              )} min (env: ${appEnv}).` +
              (url ? `\nPrzykładowy adres: ${url}` : '') +
              `\nSygnatura: ${signature.slice(0, 160)}`,
            severity: 'WARNING',
            source: 'Frontend',
            throttleKey: `client-error:${signature}`,
            throttleMs: ALERT_THROTTLE_MS,
          });
        } catch (err) {
          logger.warn('[ClientError] threshold alert failed (non-fatal)', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
  } catch (error) {
    // Telemetry must never become a second failure surface.
    logger.warn('[ClientError] Failed to record client crash report', error);
    if (!res.headersSent) res.status(202).json({ status: 'accepted-with-warning' });
  }
});

export default router;
