import { execSync } from 'node:child_process';
import net from 'node:net';

const REQUIRED_PORTS = [3000, 3001];

function canBind(port) {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once('error', (err) => {
        if (err && err.code === 'EADDRINUSE') return resolve(false);
        return resolve(false);
      })
      .once('listening', () => {
        server.close(() => resolve(true));
      })
      .listen(port, '127.0.0.1');
  });
}

function lsof(port) {
  try {
    return execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();
  } catch (e) {
    const out = String(e?.stdout || '').trim();
    const err = String(e?.stderr || '').trim();
    return [out, err].filter(Boolean).join('\n');
  }
}

(async () => {
  const busy = [];
  for (const port of REQUIRED_PORTS) {
    // If we can bind, port is free.
    // If we can't, something is already listening (or another error occurred).
    // We treat any failure as "busy" and show lsof output.
    // This prevents hours lost to orphaned dev processes.
    // eslint-disable-next-line no-await-in-loop
    const ok = await canBind(port);
    if (!ok) busy.push(port);
  }

  if (busy.length > 0) {
    console.error('[preflight] Ports already in use:', busy.join(', '));
    for (const port of busy) {
      console.error(`\n[preflight] Listener details for :${port}\n${lsof(port) || '(no lsof output)'}`);
    }
    console.error('\n[preflight] Fix: run `npm run dev:stop` (safe) or stop the listed PIDs manually.');
    process.exit(1);
  }

  process.exit(0);
})().catch((e) => {
  console.error('[preflight] Unexpected failure:', e);
  process.exit(1);
});

