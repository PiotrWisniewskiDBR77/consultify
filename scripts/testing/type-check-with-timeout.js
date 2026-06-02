import { spawn } from 'node:child_process';

const timeoutMs = Number.parseInt(process.env.TYPECHECK_TIMEOUT_MS || '180000', 10);
const startedAt = Date.now();

const child = spawn(
  process.execPath,
  ['--max-old-space-size=8192', './node_modules/.bin/tsc', '--noEmit'],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  }
);

const timeout = setTimeout(() => {
  const elapsedMs = Date.now() - startedAt;
  console.error(
    `[type-check:timeout] tsc did not complete within ${timeoutMs}ms; elapsed=${elapsedMs}ms`
  );
  child.kill('SIGTERM');
  setTimeout(() => {
    if (!child.killed) child.kill('SIGKILL');
  }, 5000).unref();
}, timeoutMs);

child.on('exit', (code, signal) => {
  clearTimeout(timeout);
  if (signal) {
    process.exit(signal === 'SIGTERM' || signal === 'SIGKILL' ? 124 : 1);
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  clearTimeout(timeout);
  console.error(`[type-check:timeout] failed to start tsc: ${error.message}`);
  process.exit(1);
});
