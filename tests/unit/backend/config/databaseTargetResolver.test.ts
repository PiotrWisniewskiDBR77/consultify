import { describe, expect, it } from 'vitest';

import {
  assertNoLocalDatabaseOutsideTests,
  assertNoPrivateRailwayDbHostOutsideRailway,
  getDatabaseHost,
  resolveReachableDatabaseUrl,
} from '../../../../../server/src/config/databaseTargetResolver.js';

describe('databaseTargetResolver', () => {
  it('uses public database url outside Railway when private Railway host is configured', () => {
    const result = resolveReachableDatabaseUrl({
      databaseUrl: 'postgresql://user:pass@pgvector.railway.internal:5432/railway',
      publicDatabaseUrl: 'postgresql://user:pass@caboose.proxy.rlwy.net:15646/railway',
      env: {},
    });

    expect(result.databaseUrl).toBe('postgresql://user:pass@caboose.proxy.rlwy.net:15646/railway');
    expect(result.source).toBe('DATABASE_PUBLIC_URL');
    expect(result.reason).toContain('private host pgvector.railway.internal');
  });

  it('keeps private Railway database url when running inside Railway', () => {
    const result = resolveReachableDatabaseUrl({
      databaseUrl: 'postgresql://user:pass@pgvector.railway.internal:5432/railway',
      publicDatabaseUrl: 'postgresql://user:pass@caboose.proxy.rlwy.net:15646/railway',
      env: {
        RAILWAY_SERVICE_ID: 'svc_123',
      } as NodeJS.ProcessEnv,
    });

    expect(result.databaseUrl).toBe('postgresql://user:pass@pgvector.railway.internal:5432/railway');
    expect(result.source).toBe('DATABASE_URL');
  });

  it('throws outside Railway when only private Railway db host is available', () => {
    expect(() =>
      resolveReachableDatabaseUrl({
        databaseUrl: 'postgresql://user:pass@pgvector.railway.internal:5432/railway',
        env: {},
      })
    ).toThrow(/unreachable outside Railway/);
  });

  it('rejects DB_HOST private Railway host outside Railway', () => {
    expect(() =>
      assertNoPrivateRailwayDbHostOutsideRailway({
        DB_HOST: 'pgvector.railway.internal',
      } as NodeJS.ProcessEnv)
    ).toThrow(/private Railway host/);
  });

  it('rejects localhost DATABASE_URL outside tests', () => {
    expect(() =>
      assertNoLocalDatabaseOutsideTests({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/consultify',
      } as NodeJS.ProcessEnv)
    ).toThrow(/external Postgres target/);
  });

  it('allows localhost DATABASE_URL in tests', () => {
    expect(() =>
      assertNoLocalDatabaseOutsideTests({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/consultify_test',
      } as NodeJS.ProcessEnv)
    ).not.toThrow();
  });

  it('extracts database host safely', () => {
    expect(getDatabaseHost('postgresql://user:pass@caboose.proxy.rlwy.net:15646/railway')).toBe(
      'caboose.proxy.rlwy.net'
    );
    expect(getDatabaseHost('not-a-url')).toBeNull();
  });
});
