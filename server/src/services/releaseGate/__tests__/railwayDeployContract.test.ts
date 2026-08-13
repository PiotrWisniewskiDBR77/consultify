/**
 * Railway deploy contract — proves the DECLARED preDeployCommand still points at a real thing.
 *
 * Context: a 2026-08-13 forensic pass found the LIVE Railway service overriding
 * deploy.preDeployCommand with ["true"] (a no-op) on all 20 retained deployments, even though
 * railway.json / railway.api.json declare a real gate command. That live override is a separate,
 * out-of-band concern (Railway service settings, not this repo) and is NOT what this file checks.
 *
 * What THIS file guards against is the repo-side contract regressing silently:
 *   - either railway config losing deploy.preDeployCommand entirely
 *   - either being set back to the literal no-op "true" (string or array-joined)
 *   - either re-admitting a forbidden flag (--only / --safe / --allow-checksum-drift) that
 *     the gate's own runtime guard (assertNoForbiddenFlags) would refuse anyway, but which
 *     should never be declared in the first place
 *   - the script path the command names no longer corresponding to a real .ts source file in
 *     the repo (e.g. a rename/move that the two railway.json / railway.api.json files were not
 *     updated to match)
 *
 * Deliberately narrow: fs + path + vitest only. No DB, no network, no process spawn. This does
 * NOT prove the script actually compiles into the production image (that is a tsconfig
 * "include" question, checked separately) — only that the command string and the source file it
 * names are internally consistent.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(process.cwd());

const RAILWAY_CONFIG_FILES = ['railway.json', 'railway.api.json'] as const;

const FORBIDDEN_FLAGS = ['--only', '--safe', '--allow-checksum-drift'] as const;

function readJson(relativePath: string): any {
  const abs = path.resolve(REPO_ROOT, relativePath);
  return JSON.parse(fs.readFileSync(abs, 'utf-8'));
}

function commandText(cmd: unknown): string {
  return Array.isArray(cmd) ? cmd.join(' ') : String(cmd ?? '');
}

/**
 * Given a preDeployCommand string like "node dist/scripts/release-migration-gate.js", derive the
 * TypeScript source file it must have been compiled from, under server/.
 *
 * Compilation layout (server/tsconfig.json → tsconfig.build.json): rootDir "." (= server/),
 * outDir "./dist" → a root file at server/<X>.ts compiles to server/dist/<X>.js. So a runtime
 * path of dist/<X>.js names a source file at server/<X>.ts.
 */
function deriveExpectedSourcePath(text: string): string {
  const jsArg = text.split(/\s+/).find((tok) => tok.endsWith('.js'));
  if (!jsArg) {
    throw new Error(`preDeployCommand does not name a .js entry point: "${text}"`);
  }
  const withoutDistPrefix = jsArg.replace(/^(\.\/)?dist\//, '');
  const sourceRelativeToServer = withoutDistPrefix.replace(/\.js$/, '.ts');
  return path.posix.join('server', sourceRelativeToServer);
}

describe('railway deploy contract — declared preDeployCommand stays real', () => {
  for (const file of RAILWAY_CONFIG_FILES) {
    describe(file, () => {
      it('declares a non-empty deploy.preDeployCommand', () => {
        const cfg = readJson(file);
        const cmd = cfg?.deploy?.preDeployCommand;
        expect(cmd, `${file}: deploy.preDeployCommand must be present`).toBeTruthy();
        expect(commandText(cmd).trim().length, `${file}: deploy.preDeployCommand must not be empty`).toBeGreaterThan(0);
      });

      it('is never the no-op "true" (string or array-joined)', () => {
        const cfg = readJson(file);
        const text = commandText(cfg?.deploy?.preDeployCommand).trim();
        expect(text).not.toBe('true');
        expect(text).not.toBe('"true"');
      });

      it('carries none of the forbidden gate flags', () => {
        const cfg = readJson(file);
        const text = commandText(cfg?.deploy?.preDeployCommand);
        for (const flag of FORBIDDEN_FLAGS) {
          expect(text, `${file}: preDeployCommand must not contain ${flag}`).not.toContain(flag);
        }
      });

      it('names a script whose .ts source actually exists in the repo', () => {
        const cfg = readJson(file);
        const text = commandText(cfg?.deploy?.preDeployCommand);
        const expectedSource = deriveExpectedSourcePath(text);
        const abs = path.resolve(REPO_ROOT, expectedSource);
        expect(
          fs.existsSync(abs),
          `${file}: preDeployCommand "${text}" implies source file ${expectedSource}, which does not exist`
        ).toBe(true);
      });
    });
  }

  it('both railway configs agree on the same preDeployCommand', () => {
    const [a, b] = RAILWAY_CONFIG_FILES.map((f) => commandText(readJson(f)?.deploy?.preDeployCommand).trim());
    expect(a).toBe(b);
  });
});
