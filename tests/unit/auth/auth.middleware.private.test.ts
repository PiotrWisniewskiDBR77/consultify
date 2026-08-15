import { describe, expect, it } from 'vitest';
import { __private__ } from '../../../server/src/middleware/auth.middleware';

describe('auth.middleware private helpers', () => {
  it('extractToken reads Bearer token from authorization header', () => {
    const req: any = { headers: { authorization: 'Bearer abc123' } };
    expect(__private__.extractToken(req)).toBe('abc123');
  });

  it('extractToken reads raw authorization header when not Bearer', () => {
    const req: any = { headers: { authorization: 'raw-token' } };
    expect(__private__.extractToken(req)).toBe('raw-token');
  });

  it('extractToken reads token from cookies', () => {
    const req: any = { headers: {}, cookies: { access_token: 'cookie-token' } };
    expect(__private__.extractToken(req)).toBe('cookie-token');
  });

  it('extractToken reads token from body', () => {
    const req: any = { headers: {}, body: { token: 'body-token' } };
    expect(__private__.extractToken(req)).toBe('body-token');
  });

  it('extractToken reads token from query', () => {
    const req: any = { headers: {}, query: { token: 'query-token' } };
    expect(__private__.extractToken(req)).toBe('query-token');
  });

  it('mapRole maps admin to administrator', () => {
    expect(__private__.mapRole('admin')).toBe('administrator');
  });

  it('mapRole preserves the raw superadmin identity for downstream authenticated mapping', () => {
    expect(__private__.mapRole('superadmin')).toBe('superadmin');
  });

  it('normalizePermissionRole maps manager to PROJECT_MANAGER', () => {
    expect(__private__.normalizePermissionRole('manager')).toBe('PROJECT_MANAGER');
  });

  it('normalizePermissionRole maps guest to VIEWER', () => {
    expect(__private__.normalizePermissionRole('guest')).toBe('VIEWER');
  });
});
