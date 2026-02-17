import { execSync } from 'node:child_process';

const PORTS = [3000, 3001];
const ROOT = process.cwd();

function lines(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
      .split('\n')
      .map((l) => l.trimEnd())
      .filter(Boolean);
  } catch (e) {
    const out = String(e?.stdout || '').trim();
    if (!out) return [];
    return out.split('\n').map((l) => l.trimEnd()).filter(Boolean);
  }
}

function getListeningPids(port) {
  const out = lines(`lsof -nP -iTCP:${port} -sTCP:LISTEN`);
  // lsof header + rows:
  // COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
  // node    123 ...
  const pids = new Set();
  for (const line of out.slice(1)) {
    const parts = line.split(/\s+/);
    const pid = Number(parts[1]);
    if (Number.isFinite(pid)) pids.add(pid);
  }
  return [...pids];
}

function psCmd(pid) {
  const out = lines(`ps -o command= -p ${pid}`);
  return out[0] || '';
}

function shouldStop(cmd) {
  // Only stop processes that look like OUR dev servers within this repo.
  // This avoids killing unrelated services.
  return (
    cmd.includes(`${ROOT}/node_modules/.bin/vite`) ||
    cmd.includes(' vite --port 3000') ||
    cmd.includes(`${ROOT}/server/dist/src/index.js`) ||
    cmd.includes(' dist/src/index.js') ||
    cmd.includes('node dist/src/index.js') ||
    cmd.includes(' tsx src/index.ts') ||
    cmd.includes(`${ROOT}/server/node_modules/.bin/tsx`) ||
    cmd.includes(`${ROOT}/node_modules/.bin/tsx`)
  );
}

const targets = [];
for (const port of PORTS) {
  for (const pid of getListeningPids(port)) {
    const cmd = psCmd(pid);
    if (cmd && shouldStop(cmd)) {
      targets.push({ pid, port, cmd });
    }
  }
}

if (targets.length === 0) {
  console.log('[dev:stop] No matching dev listeners found on ports 3000/3001.');
  process.exit(0);
}

console.log('[dev:stop] Stopping dev listeners:');
for (const t of targets) {
  console.log(`- pid=${t.pid} port=${t.port} cmd=${t.cmd}`);
}

for (const t of targets) {
  try {
    process.kill(t.pid, 'SIGTERM');
  } catch {
    // ignore
  }
}

process.exit(0);

