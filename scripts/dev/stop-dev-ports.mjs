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

function psPpid(pid) {
  const out = lines(`ps -o ppid= -p ${pid}`);
  const raw = (out[0] || '').trim();
  const ppid = Number(raw);
  return Number.isFinite(ppid) ? ppid : null;
}

function shouldStopParent(cmd) {
  // Orchestrators / wrappers that respawn children. Stop them too.
  // Keep this conservative: we only consider parents discovered from a listener
  // that already matched this repo, so it's safe to match by shape/args.
  if (!cmd) return false;
  return (
    cmd.includes(`${ROOT}/node_modules/.bin/concurrently`) ||
    cmd.includes('concurrently ') ||
    cmd.includes('npm exec concurrently') ||
    cmd.includes('npm run dev') ||
    cmd.includes('npm run dev:frontend') ||
    cmd.includes('npm run dev:backend')
  );
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
    // server dev (tsx). Depending on how it's launched, the LISTENing pid may be:
    // - the tsx wrapper itself (`tsx src/index.ts`)
    // - a node process using the tsx loader (`node --require ...tsx/dist/... src/index.ts`)
    cmd.includes(' tsx src/index.ts') ||
    (cmd.includes('/tsx/dist/') && cmd.includes(' src/index.ts') && cmd.includes(`${ROOT}/server/`)) ||
    cmd.includes(`${ROOT}/server/node_modules/.bin/tsx`) ||
    cmd.includes(`${ROOT}/node_modules/.bin/tsx`)
  );
}

const targetsByPid = new Map();
for (const port of PORTS) {
  for (const pid of getListeningPids(port)) {
    const cmd = psCmd(pid);
    if (cmd && shouldStop(cmd)) {
      targetsByPid.set(pid, { pid, port, cmd });

      // Also stop parent orchestrators (concurrently / npm wrappers) to prevent respawn loops.
      let cur = pid;
      for (let i = 0; i < 6; i++) {
        const ppid = psPpid(cur);
        if (!ppid || ppid <= 1) break;
        const pcmd = psCmd(ppid);
        if (pcmd && shouldStopParent(pcmd)) {
          if (!targetsByPid.has(ppid)) {
            targetsByPid.set(ppid, { pid: ppid, port, cmd: pcmd });
          }
        }
        cur = ppid;
      }
    }
  }
}

const targets = [...targetsByPid.values()];

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

// Escalate if something (like concurrently --restart-tries -1) didn't stop.
// Wait briefly, then send SIGKILL to remaining targets.
await new Promise((r) => setTimeout(r, 800));
for (const t of targets) {
  try {
    // signal 0 checks existence without sending a signal
    process.kill(t.pid, 0);
  } catch {
    continue;
  }
  try {
    process.kill(t.pid, 'SIGKILL');
  } catch {
    // ignore
  }
}

process.exit(0);

