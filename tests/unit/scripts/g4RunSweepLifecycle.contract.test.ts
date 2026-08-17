import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'scripts/g4/run-sweep.sh');
const sandboxes: string[] = [];

async function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function waitForPortOccupied(port: number, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await portIsFree(port))) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for port ${port} to be occupied`);
}

async function waitForText(file: string, text: string, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = await readFile(file, 'utf8').catch(() => '');
    if (content.includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${text}`);
}

async function waitForNonEmpty(file: string, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = await readFile(file, 'utf8').catch(() => '');
    if (content.trim()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for non-empty ${file}`);
}

async function makeFakeNpx(mode: 'block' | 'fail') {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'g4-lifecycle-'));
  sandboxes.push(dir);
  const log = path.join(dir, 'surfaces.log');
  const detachedPid = path.join(dir, 'detached.pid');
  const fake = path.join(dir, 'npx');
  const body = mode === 'fail'
    ? `#!/usr/bin/env bash\necho "${'$'}{G4_SURFACE}|${'$'}{E2E_MODE}" >> "${'$'}{G4_TEST_LOG}"\nexit 23\n`
    : `#!/usr/bin/env bash\nset -e\necho "${'$'}{G4_SURFACE}|${'$'}{E2E_MODE}" >> "${'$'}{G4_TEST_LOG}"\nnode -e 'const {spawn}=require("child_process"),fs=require("fs"); const code=\`const net=require("net");net.createServer().listen(${'$'}{process.env.G4_TEST_PORT_A},"127.0.0.1");net.createServer().listen(${'$'}{process.env.G4_TEST_PORT_B},"127.0.0.1");setInterval(()=>{},1000)\`; const child=spawn(process.execPath,["-e",code],{detached:true,stdio:"ignore"}); fs.writeFileSync(process.env.G4_TEST_DETACHED_PID,String(child.pid)); setInterval(()=>{},1000)'\n`;
  await writeFile(fake, body, { mode: 0o755 });
  return { dir, log, detachedPid };
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map(async (dir) => {
    const detachedProcessId = Number((await readFile(path.join(dir, 'detached.pid'), 'utf8').catch(() => '')).trim());
    if (Number.isInteger(detachedProcessId) && detachedProcessId > 0) {
      try {
        process.kill(detachedProcessId, 'SIGTERM');
      } catch {
        // The lifecycle assertion expects the wrapper to have terminated it.
      }
    }
    await rm(dir, { recursive: true, force: true });
  }));
});

describe('G4 sweep wrapper lifecycle', () => {
  it('terminates the active process group and never starts the next surface', async () => {
    const { dir, log, detachedPid } = await makeFakeNpx('block');
    const portA = 45141;
    const portB = 45142;
    const child = spawn('bash', [SCRIPT, 'CHAT', 'MYW'], {
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        G4_TEST_LOG: log,
        G4_TEST_PORT_A: String(portA),
        G4_TEST_PORT_B: String(portB),
        G4_TEST_DETACHED_PID: detachedPid,
      },
      stdio: 'ignore',
    });

    await waitForText(log, 'CHAT|false');
    await waitForNonEmpty(detachedPid);
    await Promise.all([waitForPortOccupied(portA), waitForPortOccupied(portB)]);
    expect(await portIsFree(portA)).toBe(false);
    expect(await portIsFree(portB)).toBe(false);
    child.kill('SIGTERM');
    const exitCode = await new Promise<number | null>((resolve) => child.once('exit', resolve));

    expect(exitCode).toBe(143);
    expect((await readFile(log, 'utf8')).trim().split(/\s+/)).toEqual(['CHAT|false']);
    expect(await portIsFree(portA)).toBe(true);
    expect(await portIsFree(portB)).toBe(true);
    const detachedProcessId = Number((await readFile(detachedPid, 'utf8')).trim());
    expect(() => process.kill(detachedProcessId, 0)).toThrow();
  });

  it('fails fast when Playwright fails', async () => {
    const { dir, log } = await makeFakeNpx('fail');
    const child = spawn('bash', [SCRIPT, 'CHAT', 'MYW'], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, G4_TEST_LOG: log },
      stdio: 'ignore',
    });
    const exitCode = await new Promise<number | null>((resolve) => child.once('exit', resolve));

    expect(exitCode).toBe(23);
    expect((await readFile(log, 'utf8')).trim().split(/\s+/)).toEqual(['CHAT|false']);
  });
});
