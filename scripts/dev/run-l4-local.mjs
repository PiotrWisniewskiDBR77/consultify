import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

function reserveEphemeralPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function runId() {
  const raw = String(process.env.E2E_RUN_ID || '').trim();
  if (raw) return raw;
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, label, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    const probe = spawnSync('curl', ['-sfL', '--max-time', '2', url], {
      stdio: 'ignore',
    });
    if (probe.status === 0) {
      return;
    }
    lastError = probe.error?.message || `curl exit ${probe.status ?? 'unknown'}`;
    await sleep(1000);
  }
  throw new Error(`${label} did not become ready: ${lastError || 'timeout'}`);
}

async function terminate(child, label) {
  if (!child?.pid || child.killed) return;
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');

  const exited = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    sleep(5000).then(() => false),
  ]);

  if (!exited) {
    child.kill('SIGKILL');
    await Promise.race([
      new Promise((resolve) => child.once('exit', () => resolve(true))),
      sleep(2000),
    ]);
  }
}

const id = runId();
const backendPort = process.env.E2E_API_URL
  ? Number(new URL(process.env.E2E_API_URL).port || '3001')
  : await reserveEphemeralPort();
const apiUrl = process.env.E2E_API_URL || `http://127.0.0.1:${backendPort}`;
const baseUrl = process.env.E2E_BASE_URL || apiUrl;
const workspaceRoot = process.cwd();
const serverRoot = path.join(workspaceRoot, 'server');
const tsxBin = path.join(workspaceRoot, 'node_modules', '.bin', 'tsx');
const testSupportKey = String(process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me');
const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://user:pass@external-db-host:5432/consultify';
const playwrightArgs = ['playwright', 'test', '--config', 'playwright.smoke.config.ts', ...process.argv.slice(2)];

const sharedEnv = {
  ...process.env,
  CI: 'true',
  E2E_MODE: 'true',
  E2E_USE_WEB_SERVER: 'false',
  E2E_ALLOW_LOCALHOST_REMOTE: 'true',
  E2E_API_URL: apiUrl,
  E2E_BASE_URL: baseUrl,
  E2E_RUN_ID: id,
  TEST_SUPPORT_KEY: testSupportKey,
};

const backend = spawn(tsxBin, ['src/index.ts'], {
  cwd: serverRoot,
  env: {
    ...sharedEnv,
    NODE_ENV: 'test',
    PORT: String(backendPort),
    DATABASE_URL: databaseUrl,
    MOCK_DB: 'true',
    MOCK_REDIS: 'true',
    ENABLE_TEST_GATEWAY: 'true',
    ENABLE_TEST_SUPPORT: 'true',
  },
  stdio: 'inherit',
});

let exitCode = 1;

try {
  console.log(`[L4 local] waiting for backend: ${apiUrl}/api/health/ping`);
  await waitForUrl(`${apiUrl}/api/health/ping`, 'backend health');
  console.log(`[L4 local] backend ready`);
  console.log(`[L4 local] waiting for frontend: ${baseUrl}`);
  await waitForUrl(baseUrl, 'frontend root');
  console.log(`[L4 local] frontend ready`);
  console.log('[L4 local] starting playwright smoke');

  const res = spawnSync('npx', playwrightArgs, {
    cwd: workspaceRoot,
    env: sharedEnv,
    stdio: 'inherit',
  });
  exitCode = res.status ?? 1;
} finally {
  await terminate(backend, 'backend');
}

process.exit(exitCode);
