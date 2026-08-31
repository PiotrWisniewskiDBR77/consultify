import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Agent production build boundary', () => {
  it('excludes all server source scripts and fails emission on TypeScript errors', () => {
    const config = fs.readFileSync(path.join(root, 'server/tsconfig.build.json'), 'utf8');

    expect(config).toMatch(/"noEmitOnError"\s*:\s*true/);
    expect(config).toContain('"src/scripts/**"');
    expect(config).toContain('"scripts/migrate.postgres.ts"');
  });

  it('uses the fail-hard production project for the public backend build command', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'server/package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.build).toContain('sync-server-runtime-mirrors.mjs --check');
    expect(pkg.scripts?.build).toContain('tsc --build tsconfig.build.json --force');
    expect(pkg.scripts?.build).toContain('npm run build:copy-assets');
    expect(pkg.scripts?.build).not.toContain('noCheck');
  });

  it('keeps proof scripts under a separate no-emit typecheck config', () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(root, 'server/tsconfig.proofs.json'), 'utf8')
    ) as { compilerOptions?: { noEmit?: boolean }; include?: string[] };

    expect(config.compilerOptions?.noEmit).toBe(true);
    expect(config.include).toContain('src/scripts/**/*.ts');
  });

  it('makes the Docker backend compile fail-hard and rejects dangerous emitted scripts', () => {
    const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile.api'), 'utf8');

    expect(dockerfile).toContain(
      'RUN rm -rf dist && NODE_OPTIONS="--max-old-space-size=3072" ./node_modules/.bin/tsc --build tsconfig.build.json'
    );
    expect(dockerfile).not.toContain('TypeScript build had errors (continuing if dist exists)');
    expect(dockerfile).toContain('proof/fixture/restart-worker script emitted');
    expect(dockerfile).toContain('strict Postgres migration runner missing');
    expect(dockerfile).toContain('server lock authoritative');
    expect(dockerfile).toContain('zero mismatches');
    expect(dockerfile).not.toMatch(/npm ci[^\n]*\|\|/);
    expect(dockerfile).not.toMatch(/npm install[^\n]*\|\|\s*true/);
  });

  it('runs the packaged strict Postgres migrator before the Railway API starts', () => {
    for (const filename of ['railway.json', 'railway.api.json']) {
      const config = JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8')) as {
        deploy?: { preDeployCommand?: string };
      };
      expect(config.deploy?.preDeployCommand).toBe('node dist/scripts/release-migration-gate.js');
      expect(config.deploy?.preDeployCommand).not.toContain('--safe');
    }

    const gate = fs.readFileSync(
      path.join(root, 'server/scripts/release-migration-gate.ts'),
      'utf8'
    );
    expect(gate).toContain('migrate.postgres.js');
    expect(gate).toContain('DATABASE_PUBLIC_URL');
    expect(gate).toContain("const args = [runner, '--dir', migrationsDir]");
    expect(gate).toContain('assertNoForbiddenFlags(argv)');
  });
});
