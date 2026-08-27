import { describe, expect, it } from 'vitest';

import {
  databaseIdentitiesMatch,
  formatDatabaseIdentity,
  formatDatabaseIdentityLine,
  parseDatabaseIdentityFromUrl,
  resolveApplicationDatabaseIdentity,
} from '../databaseIdentity.js';

const TEST_ENV = { NODE_ENV: 'test' };

describe('parseDatabaseIdentityFromUrl', () => {
  it('derives host, port and database and drops credentials', () => {
    const identity = parseDatabaseIdentityFromUrl(
      'postgresql://app:s3cret@sakura.proxy.rlwy.net:41234/railway?sslmode=require'
    );
    expect(identity).toMatchObject({
      host: 'sakura.proxy.rlwy.net',
      port: 41234,
      database: 'railway',
    });
    expect(JSON.stringify(identity)).not.toContain('s3cret');
    expect(JSON.stringify(identity)).not.toContain('app');
  });

  it('defaults the port to 5432', () => {
    expect(parseDatabaseIdentityFromUrl('postgres://h/railway')?.port).toBe(5432);
  });

  it('returns null for an unexpanded Railway reference', () => {
    expect(parseDatabaseIdentityFromUrl('${{Postgres.DATABASE_URL}}')).toBeNull();
  });

  it('returns null for blank or unparseable input', () => {
    expect(parseDatabaseIdentityFromUrl(undefined)).toBeNull();
    expect(parseDatabaseIdentityFromUrl('   ')).toBeNull();
    expect(parseDatabaseIdentityFromUrl('not a url')).toBeNull();
  });
});

describe('resolveApplicationDatabaseIdentity', () => {
  it('follows DATABASE_URL like the application does', () => {
    const identity = resolveApplicationDatabaseIdentity({
      ...TEST_ENV,
      DATABASE_URL: 'postgresql://u:p@trolley.proxy.rlwy.net:28146/railway',
    });
    expect(identity).toMatchObject({ host: 'trolley.proxy.rlwy.net', source: 'app:DATABASE_URL' });
  });

  it('falls back to DB_HOST when DATABASE_URL is an unexpanded reference', () => {
    const identity = resolveApplicationDatabaseIdentity({
      ...TEST_ENV,
      DATABASE_URL: '${{Postgres.DATABASE_URL}}',
      DB_HOST: 'thomas.proxy.rlwy.net',
      DB_PORT: '28864',
      DB_NAME: 'railway',
    });
    expect(identity).toMatchObject({
      host: 'thomas.proxy.rlwy.net',
      port: 28864,
      database: 'railway',
      source: 'app:DB_HOST',
    });
  });

  it('returns null when nothing resolves, so callers must fail closed', () => {
    expect(resolveApplicationDatabaseIdentity({ ...TEST_ENV })).toBeNull();
  });
});

describe('databaseIdentitiesMatch — the DEC-165 recurrence check', () => {
  const sakura = parseDatabaseIdentityFromUrl('postgres://u:p@sakura.proxy.rlwy.net:41234/railway');

  it('MUTATION: an injected divergence does NOT match', () => {
    const app = resolveApplicationDatabaseIdentity({
      ...TEST_ENV,
      DATABASE_URL: 'postgresql://u:p@trolley.proxy.rlwy.net:28146/railway',
    });
    expect(databaseIdentitiesMatch(app, sakura)).toBe(false);
  });

  it('MUTATION REVERSED: the same database matches despite different credentials', () => {
    const app = resolveApplicationDatabaseIdentity({
      ...TEST_ENV,
      DATABASE_URL: 'postgresql://other:otherpw@sakura.proxy.rlwy.net:41234/railway',
    });
    expect(databaseIdentitiesMatch(app, sakura)).toBe(true);
  });

  it('does not match on the shared database NAME alone', () => {
    // All three Railway databases are named `railway` (DEC-2026-08-28-165).
    const thomas = parseDatabaseIdentityFromUrl('postgres://u:p@thomas.proxy.rlwy.net:28864/railway');
    expect(sakura!.database).toBe(thomas!.database);
    expect(databaseIdentitiesMatch(sakura, thomas)).toBe(false);
  });

  it('never matches an unresolved side', () => {
    expect(databaseIdentitiesMatch(null, sakura)).toBe(false);
    expect(databaseIdentitiesMatch(sakura, null)).toBe(false);
  });
});

describe('log formatting', () => {
  it('emits a greppable, credential-free line', () => {
    const identity = parseDatabaseIdentityFromUrl('postgres://app:s3cret@sakura.host:41234/railway');
    const line = formatDatabaseIdentityLine('app', identity);
    expect(line).toContain('DB_IDENTITY role=app');
    expect(line).toContain('host=sakura.host');
    expect(line).toContain('database=railway');
    expect(line).not.toContain('s3cret');
    expect(formatDatabaseIdentity(identity)).toBe('sakura.host:41234/railway');
  });

  it('says so explicitly when nothing resolved', () => {
    expect(formatDatabaseIdentityLine('migration', null)).toContain('identity=unresolved');
  });
});
