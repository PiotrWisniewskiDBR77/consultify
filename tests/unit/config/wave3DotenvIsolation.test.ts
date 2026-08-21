/** @vitest-environment node */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
const root = process.cwd(),
  cleanup: string[] = [];
afterEach(() => {
  for (const p of cleanup.splice(0)) fs.rmSync(p, { recursive: true, force: true });
});
describe('Wave3 no-dotenv controls', () => {
  it('server disabled mode ignores base, local and explicit extra dotenv values', () => {
    const sentinel = `W3_SENTINEL_${process.pid}`,
      extra = `/tmp/consultify-wave3-runtime-${process.pid}-extra.env`;
    fs.writeFileSync(extra, `W3_RUNTIME_EXTRA_SENTINEL=${sentinel}_EXTRA\n`, { mode: 0o600 });
    cleanup.push(extra);
    const known: Record<string, string> = {};
    for (const file of ['.env', '.env.local', 'server/.env', 'server/.env.local'])
      if (fs.existsSync(file))
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
          const m = line.match(
            /^\s*(OPENAI_API_KEY|ANTHROPIC_API_KEY|RAILWAY_TOKEN|SUPABASE_KEY)\s*=\s*(.+)\s*$/
          );
          if (m) known[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        }
    const probe = `import './server/src/config/loadEnv.ts';console.log(JSON.stringify({extra:process.env.W3_RUNTIME_EXTRA_SENTINEL,keys:Object.fromEntries(${JSON.stringify(Object.keys(known))}.map(k=>[k,process.env[k]]))}))`;
    const env = {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || '',
      NODE_ENV: 'development',
      DOTENV_DISABLED: '1',
      ENV_FILE: extra,
    };
    const r = spawnSync(path.join(root, 'node_modules/.bin/tsx'), ['-e', probe], {
      cwd: root,
      env,
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    const json = JSON.parse(r.stdout.trim().split('\n').at(-1)!);
    expect(json.extra).toBeUndefined();
    for (const value of Object.values(json.keys)) expect(value).toBeUndefined();
  });
  it('Vite disabled mode sets envDir false and production artifacts exclude mode dotenv sentinel', async () => {
    const mode = 'wave3sentinel',
      sentinel = `W3_VITE_SENTINEL_${process.pid}_DO_NOT_BUNDLE`,
      envFile = path.join(root, `.env.${mode}`),
      out = `/tmp/consultify-wave3-runtime-vite-build-${process.pid}`;
    fs.writeFileSync(envFile, `VITE_BUILD_SHA=${sentinel}\nVITE_PROHIBITED_SENTINEL=${sentinel}\n`);
    cleanup.push(envFile, out);
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        const child = spawn(
          path.join(root, 'node_modules/.bin/vite'),
          ['build', '--mode', mode, '--outDir', out, '--logLevel', 'silent'],
          {
            cwd: root,
            env: {
              PATH: process.env.PATH || '',
              HOME: process.env.HOME || '',
              NODE_ENV: 'production',
              NODE_OPTIONS: '--max-old-space-size=8192',
              VITE_DOTENV_DISABLED: '1',
            },
            stdio: 'ignore',
          }
        );
        child.once('error', reject);
        child.once('exit', (code, signal) => resolve({ code, signal }));
      }
    );
    expect(result).toEqual({ code: 0, signal: null });
    const config = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
    expect(config).toContain("envDir: dotenvDisabled ? false : '.'");
    for (const file of walk(out))
      expect(fs.readFileSync(file).includes(Buffer.from(sentinel))).toBe(false);
  }, 120000);
});
function walk(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
    );
}
