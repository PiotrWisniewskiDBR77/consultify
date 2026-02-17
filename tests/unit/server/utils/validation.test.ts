import { describe, expect, it } from 'vitest';

import {
  sanitizeString,
  validateEmail,
  validateInitiative,
  validateOrganization,
  validateProject,
  validateRequiredFields,
  validateResourceAccess,
  validateUserRole,
  validateUUID,
} from '../../../../server/src/utils/validation.js';

type MockDb = {
  get: (sql: string, params: unknown[], cb: (err: Error | null, row: unknown) => void) => void;
};

describe('server utils/validation', () => {
  it('validateUserRole returns true only for allowed roles', () => {
    expect(validateUserRole({ id: 'u1', role: 'ADMIN' }, ['ADMIN'])).toBe(true);
    expect(validateUserRole({ id: 'u1', role: 'USER' }, ['ADMIN'])).toBe(false);
    expect(validateUserRole({ id: 'u1' } as any, ['ADMIN'])).toBe(false);
    expect(validateUserRole(null, ['ADMIN'])).toBe(false);
  });

  it('validateResourceAccess grants ADMIN/SUPERADMIN and owner-only access otherwise', () => {
    expect(validateResourceAccess({ id: 'u1', role: 'ADMIN' }, 'u2')).toBe(true);
    expect(validateResourceAccess({ id: 'u1', role: 'SUPERADMIN' }, 'u2')).toBe(true);
    expect(validateResourceAccess({ id: 'u1', role: 'USER' }, 'u1')).toBe(true);
    expect(validateResourceAccess({ id: 'u1', role: 'USER' }, 'u2')).toBe(false);
    expect(validateResourceAccess(null, 'u1')).toBe(false);
  });

  it('validateRequiredFields returns missing fields (undefined/null/empty string)', () => {
    const out = validateRequiredFields({ a: 1, b: '', c: null, d: undefined } as any, [
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(out.valid).toBe(false);
    expect(out.missingFields).toEqual(['b', 'c', 'd', 'e']);
  });

  it('validateEmail validates basic email format', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('bad@')).toBe(false);
    expect(validateEmail(null)).toBe(false);
  });

  it('validateUUID validates standard UUID format', () => {
    expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(validateUUID('not-a-uuid')).toBe(false);
    expect(validateUUID(undefined)).toBe(false);
  });

  it('sanitizeString escapes basic HTML-sensitive characters and stringifies non-strings', () => {
    expect(sanitizeString('<a>"x"</a>')).toBe('&lt;a&gt;&quot;x&quot;&lt;&#x2F;a&gt;');
    expect(sanitizeString(123)).toBe('123');
  });

  it('validateOrganization returns error when orgId missing', async () => {
    const db: MockDb = { get: () => {} };
    await expect(validateOrganization(null, null, db as any)).resolves.toEqual({
      valid: false,
      error: 'Organization ID is required',
    });
  });

  it('validateOrganization returns db error on first query error', async () => {
    const db: MockDb = {
      get: (_sql, _params, cb) => cb(new Error('db'), null),
    };
    await expect(validateOrganization('org1', null, db as any)).resolves.toEqual({
      valid: false,
      error: 'Database error validating organization',
    });
  });

  it('validateOrganization returns not found when org missing', async () => {
    const db: MockDb = {
      get: (_sql, _params, cb) => cb(null, null),
    };
    await expect(validateOrganization('org1', null, db as any)).resolves.toEqual({
      valid: false,
      error: 'Organization not found',
    });
  });

  it('validateOrganization returns inactive when status is not active', async () => {
    const db: MockDb = {
      get: (_sql, _params, cb) => cb(null, { id: 'org1', status: 'disabled' }),
    };
    await expect(validateOrganization('org1', null, db as any)).resolves.toEqual({
      valid: false,
      error: 'Organization is not active',
    });
  });

  it('validateOrganization checks membership when userId provided', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const db: MockDb = {
      get: (sql, params, cb) => {
        calls.push({ sql, params });
        if (sql.includes('FROM organizations')) return cb(null, { id: 'org1', status: 'active' });
        if (sql.includes('FROM users')) return cb(null, { id: 'u1' });
        cb(null, null);
      },
    };

    await expect(validateOrganization('org1', 'u1', db as any)).resolves.toEqual({
      valid: true,
      org: { id: 'org1', status: 'active' },
    });
    expect(calls.length).toBe(2);
  });

  it('validateOrganization rejects membership when user does not belong', async () => {
    const db: MockDb = {
      get: (sql, _params, cb) => {
        if (sql.includes('FROM organizations')) return cb(null, { id: 'org1', status: 'active' });
        return cb(null, null);
      },
    };

    await expect(validateOrganization('org1', 'u1', db as any)).resolves.toEqual({
      valid: false,
      error: 'User does not belong to organization',
    });
  });

  it('validateProject returns error when projectId missing', async () => {
    const db: MockDb = { get: () => {} };
    await expect(validateProject(undefined, 'org1', db as any)).resolves.toEqual({
      valid: false,
      error: 'Project ID is required',
    });
  });

  it('validateProject returns db error and not found cases', async () => {
    const dbErr: MockDb = { get: (_s, _p, cb) => cb(new Error('db'), null) };
    await expect(validateProject('p1', 'org1', dbErr as any)).resolves.toEqual({
      valid: false,
      error: 'Database error validating project',
    });

    const dbMissing: MockDb = { get: (_s, _p, cb) => cb(null, null) };
    await expect(validateProject('p1', 'org1', dbMissing as any)).resolves.toEqual({
      valid: false,
      error: 'Project not found or access denied',
    });
  });

  it('validateProject returns valid on success', async () => {
    const db: MockDb = { get: (_s, _p, cb) => cb(null, { id: 'p1' }) };
    await expect(validateProject('p1', 'org1', db as any)).resolves.toEqual({
      valid: true,
      project: { id: 'p1' },
    });
  });

  it('validateInitiative returns error when initiativeId missing', async () => {
    const db: MockDb = { get: () => {} };
    await expect(validateInitiative(null, 'org1', db as any)).resolves.toEqual({
      valid: false,
      error: 'Initiative ID is required',
    });
  });

  it('validateInitiative returns db error and not found cases', async () => {
    const dbErr: MockDb = { get: (_s, _p, cb) => cb(new Error('db'), null) };
    await expect(validateInitiative('i1', 'org1', dbErr as any)).resolves.toEqual({
      valid: false,
      error: 'Database error validating initiative',
    });

    const dbMissing: MockDb = { get: (_s, _p, cb) => cb(null, null) };
    await expect(validateInitiative('i1', 'org1', dbMissing as any)).resolves.toEqual({
      valid: false,
      error: 'Initiative not found or access denied',
    });
  });

  it('validateInitiative returns valid on success', async () => {
    const db: MockDb = { get: (_s, _p, cb) => cb(null, { id: 'i1' }) };
    await expect(validateInitiative('i1', 'org1', db as any)).resolves.toEqual({
      valid: true,
      initiative: { id: 'i1' },
    });
  });
});
