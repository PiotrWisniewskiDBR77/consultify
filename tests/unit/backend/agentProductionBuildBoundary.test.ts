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

    expect(pkg.scripts?.build).toBe('tsc --build tsconfig.build.json --force');
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
    const proofSource = fs.readFileSync(
      path.join(root, 'server/src/scripts/agentMigrationsIdempotencyRealDbProof.ts'),
      'utf8'
    );
    const releaseMigrations = [
      ...proofSource.matchAll(/'(202608\d{2}_[^']+\.sql)'/g),
    ].map((match) => match[1]);
    expect(releaseMigrations).toHaveLength(22);

    const expectedCommand =
      'DB_TYPE=postgres node dist/scripts/migrate.postgres.js --dir migrations --only ' +
      releaseMigrations.join(',');

    for (const filename of ['railway.json', 'railway.api.json']) {
      const config = JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8')) as {
        deploy?: { preDeployCommand?: string };
      };
      expect(config.deploy?.preDeployCommand).toBe(expectedCommand);
      expect(config.deploy?.preDeployCommand).not.toContain('--safe');
    }
  });
});
