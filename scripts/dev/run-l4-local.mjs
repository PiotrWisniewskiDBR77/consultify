import { spawnSync } from 'node:child_process';
import net from 'node:net';

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

const id = runId();
const backendPort = await reserveEphemeralPort();
const frontendPort = await reserveEphemeralPort();

const env = {
  ...process.env,
  CI: 'true',
  E2E_MODE: 'true',
  E2E_USE_WEB_SERVER: 'true',
  E2E_BACKEND_RUNNER: 'tsx',
  E2E_API_URL: `http://127.0.0.1:${backendPort}`,
  E2E_BASE_URL: `http://127.0.0.1:${frontendPort}`,
  E2E_SQLITE_RESET: 'true',
  E2E_SQLITE_PATH: `./data/dev/consultinity-e2e-${id}.db`,
  E2E_RUN_ID: id,
};

// Best-effort: stop any leftover servers on chosen ports (should be none).
spawnSync(process.execPath, ['scripts/dev/stop-e2e-ports.mjs'], {
  env,
  stdio: 'inherit',
});

const res = spawnSync('playwright', ['test', '--config', 'playwright.smoke.config.ts'], {
  env,
  stdio: 'inherit',
});

process.exit(res.status ?? 1);
