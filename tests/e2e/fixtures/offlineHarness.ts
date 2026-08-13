/**
 * offlineHarness — shared setup for the REAL offline/reconnect + two-tab CAS
 * E2E specs (drd-offline-real.spec.ts, drd-two-tabs.spec.ts), 2026-08-13.
 *
 * ★ This harness talks to REAL, already-running processes — it does NOT
 * start them itself (no `webServer` block is added to the repo-root
 * `playwright.config.ts`, which this file/spec set deliberately does not
 * touch — out of scope). Before running either spec, start, from the repo
 * root:
 *
 *   1. A disposable Postgres (already running for this session:
 *      `mac-pg-s1b`, port 55500 — see the CEL 10 report for how it was
 *      created). Migrate + seed once:
 *        NODE_ENV=test DB_TYPE=postgres \
 *        DATABASE_URL="postgresql://s1b:s1b@localhost:55500/s1b_test" \
 *        npx tsx server/scripts/migrate.postgres.ts
 *      then seed `organizations`/`users` rows for `test-org-id`/
 *      `test-user-id` (matching `ENABLE_TEST_AUTH_BYPASS`'s hard-coded
 *      identity, server/src/middleware/auth.middleware.ts) and register the
 *      `drd@2.0.0-methodpack.1` pack via `MethodPackRegistry.register(...)`
 *      — see the report for the exact one-off script used.
 *
 *   2. The real backend, port 42750 (range 42700-42799 per this task's
 *      brief):
 *        cd server && PORT=42750 NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *        DB_TYPE=postgres METHOD_CORE_DEMO_BYPASS_PACK_READINESS=true \
 *        ENABLE_TEST_AUTH_BYPASS=true \
 *        DATABASE_URL="postgresql://s1b:s1b@localhost:55500/s1b_test" \
 *        POSTGRES_SKIP_INIT_IN_TEST=1 npx tsx src/index.ts
 *      Wait for `/api/ready` to report `"status":"ready"` (~60s cold start —
 *      measured pitfall, do not assume it is instant).
 *
 *   3. The dev-render harness, port 42820 (range 42800-42899), proxying
 *      `/api/**` to the real backend above (the ONLY thing that makes the
 *      `http-*` DRD screens' real fetch calls reach a real server instead of
 *      404ing against vite's own dev server — see
 *      `dev-render/vite.config.ts`'s own header comment on
 *      `DEV_RENDER_API_PROXY_TARGET`):
 *        DEV_RENDER_API_PROXY_TARGET=http://localhost:42750 \
 *        npx vite --config dev-render/vite.config.ts --port 42820
 *
 * `E2E_OFFLINE_FRONTEND_URL` / `E2E_OFFLINE_DATABASE_URL` env vars override
 * the defaults below if the ports above are already taken.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { Page, Response } from '@playwright/test';
import { Pool } from 'pg';

export const FRONTEND_URL = process.env.E2E_OFFLINE_FRONTEND_URL ?? 'http://localhost:42820';
export const DATABASE_URL =
  process.env.E2E_OFFLINE_DATABASE_URL ?? 'postgresql://s1b:s1b@localhost:55500/s1b_test';

export const ORG_ID = 'test-org-id';
export const USER_ID = 'test-user-id';

export const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/qa/offline-real-2026-08-13');
export const HAR_DIR = path.resolve(process.cwd(), 'docs/qa/offline-real-2026-08-13/har');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(HAR_DIR, { recursive: true });

export function drdHttpUrl(screen: string, params: Record<string, string> = {}): string {
  const url = new URL(`${FRONTEND_URL}/drd-workspace.html`);
  url.searchParams.set('screen', screen);
  url.searchParams.set('theme', 'light');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/** Waits for the visible source badge (`DrdSourceIndicator`) to report one
 * of the eight real states — never inferred from timing, always read from
 * `data-source` on the actual DOM node the app renders. */
export async function waitForBadge(
  page: Page,
  state:
    | 'SERVER'
    | 'SAVING'
    | 'SAVED'
    | 'OFFLINE'
    | 'RECOVERY_DRAFT'
    | 'CONFLICT'
    | 'RECONNECTING'
    | 'RECOVERED',
  timeoutMs = 20_000
): Promise<void> {
  await page.waitForSelector(`[data-testid="drd-source-indicator"][data-source="${state}"]`, {
    timeout: timeoutMs,
  });
}

export async function currentBadge(page: Page): Promise<string | null> {
  const el = page.locator('[data-testid="drd-source-indicator"]').first();
  if ((await el.count()) === 0) return null;
  return el.getAttribute('data-source');
}

/**
 * Listens for the POST /api/method/sessions response that
 * `DrdHttpSessionRuntime.create()` makes on a fresh `http-server` load, and
 * resolves with the real, server-issued session id — read from the ACTUAL
 * HTTP response body, never guessed/constructed client-side.
 */
export function captureCreatedSessionId(page: Page): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for POST /api/method/sessions response')), 20_000);
    const handler = async (response: Response) => {
      if (response.request().method() !== 'POST') return;
      if (!response.url().includes('/api/method/sessions')) return;
      if (response.url().includes('/api/method/sessions/')) return; // sub-resource, not the create call
      try {
        const body = await response.json();
        if (body?.session?.id) {
          clearTimeout(timer);
          page.off('response', handler);
          resolve(body.session.id as string);
        }
      } catch {
        // Not JSON / not the response we want — keep listening.
      }
    };
    page.on('response', handler);
  });
}

// ---------------------------------------------------------------------------
// SQL evidence — a direct `pg` Pool, INDEPENDENT of the app's own DbPromise
// layer, so "the write reached the database" is proven by a query this test
// itself issues, not by re-trusting the same code path under test.
// ---------------------------------------------------------------------------

let pool: Pool | null = null;
export function db(): Pool {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL });
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export interface SessionRow {
  readonly id: string;
  readonly state: string;
  readonly version: number;
}

export async function fetchSession(sessionId: string): Promise<SessionRow | null> {
  const res = await db().query(
    `SELECT id, state, version FROM method_sessions WHERE id = $1`,
    [sessionId]
  );
  return res.rows[0] ?? null;
}

export async function countEvents(sessionId: string): Promise<number> {
  const res = await db().query(`SELECT count(*)::int AS n FROM method_events WHERE session_id = $1`, [
    sessionId,
  ]);
  return res.rows[0].n as number;
}

export interface EventRow {
  readonly id: string;
  readonly type: string;
  readonly unit_id: string | null;
  readonly level: number | null;
  readonly idempotency_key: string | null;
  readonly occurred_at: string;
}

export async function listEventsFor(
  sessionId: string,
  unitId?: string
): Promise<EventRow[]> {
  const res = unitId
    ? await db().query(
        `SELECT id, type, unit_id, level, idempotency_key, occurred_at FROM method_events WHERE session_id = $1 AND unit_id = $2 ORDER BY occurred_at ASC, id ASC`,
        [sessionId, unitId]
      )
    : await db().query(
        `SELECT id, type, unit_id, level, idempotency_key, occurred_at FROM method_events WHERE session_id = $1 ORDER BY occurred_at ASC, id ASC`,
        [sessionId]
      );
  return res.rows;
}

// ---------------------------------------------------------------------------
// HAR masking — Playwright's `recordHar` writes the file verbatim, including
// any `Authorization` header. This harness's identity comes from
// `ENABLE_TEST_AUTH_BYPASS` (no token sent at all — see
// server/src/middleware/auth.middleware.ts), so in practice there is usually
// nothing to redact, but this function is applied UNCONDITIONALLY to every
// captured HAR so the guarantee holds even if a future run of this spec
// carries a real bearer token.
// ---------------------------------------------------------------------------

export function maskAuthorizationInHar(harPath: string): void {
  if (!fs.existsSync(harPath)) return;
  const raw = fs.readFileSync(harPath, 'utf-8');
  const har = JSON.parse(raw);
  let masked = 0;
  const maskHeaders = (headers: unknown) => {
    if (!Array.isArray(headers)) return;
    for (const h of headers) {
      if (h && typeof h.name === 'string' && h.name.toLowerCase() === 'authorization') {
        h.value = '***MASKED***';
        masked += 1;
      }
    }
  };
  for (const entry of har?.log?.entries ?? []) {
    maskHeaders(entry?.request?.headers);
    maskHeaders(entry?.response?.headers);
  }
  fs.writeFileSync(harPath, JSON.stringify(har, null, 2), 'utf-8');
  // eslint-disable-next-line no-console
  console.log(`[offlineHarness] masked ${masked} Authorization header(s) in ${harPath}`);
}
