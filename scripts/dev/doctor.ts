import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

type CheckResult = { ok: boolean; message: string };

function repoRoot() {
  return process.cwd();
}

function isProbablyDuplicateFilename(filePath: string) {
  const base = path.basename(filePath);
  // Common iCloud/Finder patterns we see in this repo: "Foo 2.ts", "Bar 13.tsx"
  return /\s\d+\.[a-z0-9]+$/i.test(base) || /\sCopy\./i.test(base) || base.endsWith('.icloud');
}

async function canConnect(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      try {
        socket.end();
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function walk(dir: string, onFile: (filePath: string) => void) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // Skip very large / irrelevant dirs
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git') continue;
      walk(p, onFile);
    } else if (ent.isFile()) {
      onFile(p);
    }
  }
}

function countDuplicates(relativeRoot: string) {
  const absRoot = path.join(repoRoot(), relativeRoot);
  if (!fs.existsSync(absRoot)) return { total: 0, examples: [] as string[] };

  let total = 0;
  const examples: string[] = [];
  walk(absRoot, (filePath) => {
    if (isProbablyDuplicateFilename(filePath)) {
      total++;
      if (examples.length < 10) examples.push(path.relative(repoRoot(), filePath));
    }
  });
  return { total, examples };
}

async function main() {
  const results: Array<{ name: string; result: CheckResult }> = [];

  const backendOk = await canConnect('127.0.0.1', 3001);
  results.push({
    name: 'Backend :3001',
    result: {
      ok: backendOk,
      message: backendOk ? 'reachable' : 'NOT reachable (expect 500/offline in UI)',
    },
  });

  const frontendOk = await canConnect('127.0.0.1', 3000);
  results.push({
    name: 'Frontend :3000',
    result: { ok: frontendOk, message: frontendOk ? 'reachable' : 'NOT reachable' },
  });

  const redisOk = await canConnect('127.0.0.1', 6379);
  results.push({
    name: 'Redis :6379',
    result: { ok: redisOk, message: redisOk ? 'reachable' : 'NOT reachable (set MOCK_REDIS=true to fallback)' },
  });

  const srcDup = countDuplicates('src');
  const serverSrcDup = countDuplicates('server/src');
  const hooksDup = countDuplicates('src/hooks');

  const fmt = (n: number) => n.toLocaleString('en-US');
  console.log('\nConsultinity doctor\n');

  for (const { name, result } of results) {
    console.log(`${result.ok ? '✅' : '❌'} ${name}: ${result.message}`);
  }

  console.log('\nDuplicate/iCloud file patterns (can cause lag / reload storms):');
  console.log(`- src/: ${fmt(srcDup.total)} matches`);
  console.log(`- server/src/: ${fmt(serverSrcDup.total)} matches`);
  console.log(`- src/hooks/: ${fmt(hooksDup.total)} matches`);
  const examples = [...srcDup.examples, ...serverSrcDup.examples].slice(0, 10);
  if (examples.length) {
    console.log('\nExamples:');
    for (const e of examples) console.log(`- ${e}`);
  }

  console.log('\nRecommendations:');
  console.log('- Run `npm run dev:stable` for a no-reload, low-noise dev mode.');
  console.log('- Optional: run `npm run cleanup:quarantine-duplicates` to move iCloud duplicates into `_quarantine/` (safe/undoable).');
  console.log('- If Redis is not reachable, set `MOCK_REDIS=true` in `.env` for local dev.');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

