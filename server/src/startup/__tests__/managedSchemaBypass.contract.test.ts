/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const serverEntry = readFileSync(new URL('../../index.ts', import.meta.url), 'utf8');

describe('DB_MANAGED_SCHEMA verify-only startup contract', () => {
  it('returns ready before connection-pool, migration and seeding readiness code', () => {
    const bypassStart = serverEntry.indexOf(
      'if (skipManagedSchema) {',
      serverEntry.indexOf('logger.info(`[Server] Database schema initialized')
    );
    const bypassEnd = serverEntry.indexOf('\n        }', bypassStart);
    const poolStart = serverEntry.indexOf('// Initialize connection pool', bypassStart);
    const readinessStart = serverEntry.indexOf('establishDatabaseReadiness', bypassStart);
    const bypass = serverEntry.slice(bypassStart, bypassEnd);

    expect(bypassStart).toBeGreaterThan(-1);
    expect(bypassEnd).toBeGreaterThan(bypassStart);
    expect(poolStart).toBeGreaterThan(bypassEnd);
    expect(readinessStart).toBeGreaterThan(poolStart);
    expect(bypass).toContain("tpMigrationStatus = { state: 'disabled'");
    expect(bypass).toContain("sqlMigrationStatus = { state: 'disabled'");
    expect(bypass).toContain('dbReady = true');
    expect(bypass).toContain('return;');
  });
});
