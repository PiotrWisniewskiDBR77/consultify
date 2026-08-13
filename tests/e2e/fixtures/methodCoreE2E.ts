/**
 * Method Kernel — DRD full-chain browser E2E fixtures (agent S2, CEL 1,
 * 2026-08-13).
 *
 * Self-contained process/DB lifecycle helpers for
 * `tests/e2e/drd-full-chain.spec.ts`. Deliberately does NOT use the shared
 * `playwright.config.ts` `webServer` mechanism — that config starts exactly
 * one long-lived backend for the whole suite, but this spec needs to STOP
 * and RESTART the backend twice mid-test (CEL 1 steps 9/16) against ITS OWN
 * disposable Postgres (`mac-pg-s2b`, port 55505 — never the shared
 * `mac-pg-team`), so it manages its own child processes end to end.
 *
 * Auth: two mechanisms, matching the two things this suite needs to prove —
 *
 *  1. `ENABLE_TEST_AUTH_BYPASS=true` (server env) — a request with NO
 *     Authorization header authenticates as the fixed identity
 *     `test-user-id`/`test-org-id`. Used for smoke/library reads that don't
 *     care WHO is asking.
 *  2. `E2E_MODE=true` (server env) + a `mintE2EToken()` token — the ONLY
 *     mechanism this suite uses for anything permission-sensitive (distinct
 *     owner/approver/lead_assessor/other-org actors). The server's own
 *     `verifyToken` middleware (server/src/middleware/auth.middleware.ts,
 *     the `E2E_MODE` branch) decodes (never verifies the signature of) a
 *     token carrying `{ id, organizationId, e2e: true }` and — as a side
 *     effect of that REAL HTTP request — INSERTs the organizations/users/
 *     organization_members rows itself if they don't exist yet. This is how
 *     "seed org/pack przez HTTP" is satisfied: the only external action is
 *     an HTTP request; every row it causes to exist is written by the
 *     application's own documented E2E provisioning path, never by this
 *     fixture running SQL. `mintE2EToken` does not need the server's real
 *     JWT_SECRET — the E2E_MODE branch calls `jwt.decode`, not `jwt.verify`.
 *     Pack readiness ('methodology_review' for DRD) is bypassed the SAME
 *     way CEL 3's E2E proof did: `POST /sessions` with `demoBypass: true`,
 *     gated server-side by `METHOD_CORE_DEMO_BYPASS_PACK_READINESS=true` —
 *     also zero SQL, also a real HTTP mechanism.
 */
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
export const SERVER_DIR = path.join(REPO_ROOT, 'server');

export const DISPOSABLE_DB = {
  container: 'mac-pg-s2b',
  port: 55505,
  user: 's2b',
  password: 's2b',
  database: 's2b_test',
} as const;

export const DATABASE_URL = `postgresql://${DISPOSABLE_DB.user}:${DISPOSABLE_DB.password}@localhost:${DISPOSABLE_DB.port}/${DISPOSABLE_DB.database}`;

export const ORG_ID = 'e2e-drd-org';
export const OTHER_ORG_ID = 'e2e-drd-other-org';

/** Mints a JWT-SHAPED token the server's E2E_MODE branch will DECODE (never
 * signature-verify) — see this file's header comment. Any secret works. */
export function mintE2EToken(id: string, organizationId: string, role = 'ADMIN'): string {
  return jwt.sign({ id, organizationId, role, e2e: true }, 'e2e-unverified-secret', { expiresIn: '4h' });
}

export interface RunningServer {
  readonly port: number;
  readonly baseUrl: string;
  readonly proc: ChildProcessWithoutNullStreams;
  readonly logPath: string;
  readonly startedAt: number;
  readonly readyAt: number;
  stop(): Promise<{ readonly stoppedAt: number }>;
}

/**
 * Starts the real Express server (tsx, no build step) against the
 * disposable DB, with BOTH `RUN_DB_TESTS=1 MOCK_DB=false` (so the DB-init
 * IIFE and the full API Gateway — including `/api/method/*` — actually run;
 * see `server/src/startup/testModeGates.ts`) and `E2E_MODE=true` +
 * `METHOD_CORE_DEMO_BYPASS_PACK_READINESS=true` (see header comment).
 * Polls `/api/ready` until `status === 'ready'` — budget 90s (measured
 * ~55-75s cold on this box; the coordinator's "~60s" pitfall note).
 */
export async function startServer(port: number, logPath: string): Promise<RunningServer> {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const startedAt = Date.now();

  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    RUN_DB_TESTS: '1',
    MOCK_DB: 'false',
    DB_TYPE: 'postgres',
    DATABASE_URL,
    ENABLE_TEST_AUTH_BYPASS: 'true',
    E2E_MODE: 'true',
    METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'true',
    DISABLE_CONNECTION_POOL: 'true',
    DISABLE_SCHEDULER: 'true',
  };

  const proc = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: SERVER_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);

  const baseUrl = `http://localhost:${port}`;
  const readyAt = await waitForReady(baseUrl, 90_000);

  return {
    port,
    baseUrl,
    proc,
    logPath,
    startedAt,
    readyAt,
    async stop() {
      await stopProcess(proc);
      logStream.end();
      return { stoppedAt: Date.now() };
    },
  };
}

async function waitForReady(baseUrl: string, timeoutMs: number): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/ready`);
      if (res.status === 200) {
        const body = (await res.json()) as { status?: string };
        if (body.status === 'ready') return Date.now();
      }
    } catch (err) {
      lastErr = err;
    }
    await sleep(1500);
  }
  throw new Error(`Server at ${baseUrl} did not become ready within ${timeoutMs}ms: ${String(lastErr)}`);
}

function stopProcess(proc: ChildProcessWithoutNullStreams): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      resolve();
      return;
    }
    const onExit = () => resolve();
    proc.once('exit', onExit);
    proc.kill('SIGTERM');
    // Hard-kill fallback if graceful shutdown hangs.
    setTimeout(() => {
      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill('SIGKILL');
      }
    }, 10_000);
  });
}

export interface RunningDevRender {
  readonly port: number;
  readonly baseUrl: string;
  readonly proc: ChildProcessWithoutNullStreams;
  stop(): Promise<void>;
}

/** Starts the dev-render Vite server, proxying `/api` to `apiTarget` (see
 * `dev-render/vite.config.ts`'s `DEV_RENDER_API_PROXY_TARGET`). Root is
 * POSITIONAL (`vite dev-render --port X`), never `--root` — a documented
 * pitfall for this harness. */
export async function startDevRender(port: number, apiTarget: string, logPath: string): Promise<RunningDevRender> {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  const proc = spawn(
    'npx',
    ['vite', 'dev-render', '--port', String(port), '--config', 'dev-render/vite.config.ts', '--strictPort'],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, DEV_RENDER_API_PROXY_TARGET: apiTarget },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);

  const baseUrl = `http://localhost:${port}`;
  const deadline = Date.now() + 30_000;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/drd-artifacts.html`);
      if (res.status === 200) {
        up = true;
        break;
      }
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  if (!up) throw new Error(`dev-render server at ${baseUrl} did not come up within 30s`);

  return {
    port,
    baseUrl,
    proc,
    async stop() {
      await stopProcess(proc);
      logStream.end();
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Read-only SQL verification pool against the disposable DB — used ONLY to
 * corroborate what the HTTP responses already showed (lineage, role
 * history), never to perform a step of the flow itself. */
export function openVerificationPool(): Pool {
  return new Pool({ connectionString: DATABASE_URL });
}

export interface E2EActors {
  readonly ownerId: string;
  readonly approverId: string;
  readonly leadId: string;
  readonly otherOrgUserId: string;
  readonly ownerToken: string;
  readonly approverToken: string;
  readonly leadToken: string;
  readonly otherOrgToken: string;
}

export function makeActors(suffix: string = randomUUID().slice(0, 8)): E2EActors {
  const ownerId = `e2e-owner-${suffix}`;
  const approverId = `e2e-approver-${suffix}`;
  const leadId = `e2e-lead-${suffix}`;
  const otherOrgUserId = `e2e-other-${suffix}`;
  return {
    ownerId,
    approverId,
    leadId,
    otherOrgUserId,
    ownerToken: mintE2EToken(ownerId, ORG_ID),
    approverToken: mintE2EToken(approverId, ORG_ID),
    leadToken: mintE2EToken(leadId, ORG_ID),
    otherOrgToken: mintE2EToken(otherOrgUserId, OTHER_ORG_ID),
  };
}

/** Minimal typed HTTP helper — every call in the spec goes through this
 * (never a raw SQL write) so "no manual SQL" is structurally true, not just
 * asserted. */
export async function apiCall(
  baseUrl: string,
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(extraHeaders ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
