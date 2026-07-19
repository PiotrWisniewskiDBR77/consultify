/**
 * REJESTR V7-8 — starts/stops the dev-render Vite server for the runner.
 *
 * Mirrors CLAUDE.md #7's harness pattern (must run from repo root so
 * PostCSS/Tailwind config resolve — see dev-render/vite.config.ts header).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { repoRoot } from './screens.mjs';

const VITE_BIN = path.join(repoRoot, 'node_modules/.bin/vite');

async function pollReady(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || res.status === 404) return true; // server responds at all
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * Starts `vite --config dev-render/vite.config.ts` on the given port.
 * Returns { proc, stop() }.
 */
export async function startDevRender({ port = 3230, timeoutMs = 45_000, quiet = true } = {}) {
  const proc = spawn(
    VITE_BIN,
    ['--config', 'dev-render/vite.config.ts', '--port', String(port), '--strictPort'],
    {
      cwd: repoRoot,
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
    }
  );

  let stdout = '';
  let stderr = '';
  if (quiet) {
    proc.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
  }

  const exitedEarly = new Promise((resolve) => {
    proc.once('exit', (code) => resolve(code));
  });

  const url = `http://localhost:${port}/`;
  const readyPromise = pollReady(url, timeoutMs);
  const result = await Promise.race([
    readyPromise.then((ready) => ({ ready })),
    exitedEarly.then((code) => ({ ready: false, exitedCode: code })),
  ]);

  if (!result.ready) {
    try {
      proc.kill('SIGTERM');
    } catch {
      /* noop */
    }
    const detail = result.exitedCode !== undefined
      ? `proces zakończył się kodem ${result.exitedCode}`
      : `timeout ${timeoutMs}ms`;
    throw new Error(
      `dev-render nie wystartował na porcie ${port} (${detail}).\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`
    );
  }

  return {
    proc,
    url,
    async stop() {
      if (proc.exitCode === null && !proc.killed) {
        proc.kill('SIGTERM');
        await new Promise((resolve) => {
          const t = setTimeout(resolve, 3000);
          proc.once('exit', () => {
            clearTimeout(t);
            resolve();
          });
        });
        if (proc.exitCode === null) {
          try {
            proc.kill('SIGKILL');
          } catch {
            /* noop */
          }
        }
      }
    },
  };
}
