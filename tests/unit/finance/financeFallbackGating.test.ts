// @vitest-environment jsdom
/**
 * M16/9.3 — risk-layer coverage for Finance (audit: ZERO tests for gating/fallback).
 *
 * Two real, server-free behaviours are covered here:
 *  1. shouldFallbackToLegacyFinance (src/services/api/v8/finance.ts) — the v8→legacy
 *     fallback decision: true only for "v8 endpoint not available" statuses
 *     [400, 404, 405, 501], false otherwise (so real errors surface).
 *  2. Beta gating (src/utils/betaAccess.ts) — MODULE_ECONOMICS (Finance) is a
 *     'closed' beta, locked for regular users; admins/owners/superadmins are exempt
 *     while BETA_ADMINS_EXEMPT is true.
 *
 * All assertions exercise the REAL exported functions — no re-implementation.
 */
import { describe, expect, it } from 'vitest';

import { shouldFallbackToLegacyFinance } from '../../../src/services/api/v8/finance';
import {
  BETA_ADMINS_EXEMPT,
  BETA_LOCKED_CODE,
  BETA_MENU_STATUS,
  getBetaStatus,
  isBetaClosed,
  isBetaLockedForRole,
  isBetaModule,
  lockClosedBetaModules,
} from '../../../src/utils/betaAccess';

describe('shouldFallbackToLegacyFinance (src/services/api/v8/finance.ts)', () => {
  it('returns true for the v8-unavailable statuses 400/404/405/501', () => {
    for (const status of [400, 404, 405, 501]) {
      expect(shouldFallbackToLegacyFinance({ status })).toBe(true);
    }
  });

  it('returns false for success and genuine-error statuses 200/403/500', () => {
    for (const status of [200, 403, 500]) {
      expect(shouldFallbackToLegacyFinance({ status })).toBe(false);
    }
  });

  it('returns false for other non-fallback statuses (401/409/422/503)', () => {
    for (const status of [401, 409, 422, 503]) {
      expect(shouldFallbackToLegacyFinance({ status })).toBe(false);
    }
  });

  it('coerces string statuses via Number() — "404" still triggers fallback', () => {
    expect(shouldFallbackToLegacyFinance({ status: '404' })).toBe(true);
    expect(shouldFallbackToLegacyFinance({ status: '500' })).toBe(false);
  });

  it('returns false when error has no usable status (undefined/null/missing)', () => {
    expect(shouldFallbackToLegacyFinance(undefined)).toBe(false);
    expect(shouldFallbackToLegacyFinance(null)).toBe(false);
    expect(shouldFallbackToLegacyFinance({})).toBe(false);
    expect(shouldFallbackToLegacyFinance({ status: undefined })).toBe(false);
    expect(shouldFallbackToLegacyFinance({ status: 'not-a-number' })).toBe(false);
  });
});

describe('beta gating — MODULE_ECONOMICS (Finance) is closed (src/utils/betaAccess.ts)', () => {
  it('MODULE_ECONOMICS is registered as a closed beta in the SSOT', () => {
    expect(BETA_MENU_STATUS.MODULE_ECONOMICS).toBe('closed');
    expect(getBetaStatus('MODULE_ECONOMICS')).toBe('closed');
    expect(isBetaModule('MODULE_ECONOMICS')).toBe(true);
    expect(isBetaClosed('MODULE_ECONOMICS')).toBe(true);
  });

  it('trims whitespace around the module id when resolving status', () => {
    expect(getBetaStatus('  MODULE_ECONOMICS  ')).toBe('closed');
    expect(isBetaClosed('  MODULE_ECONOMICS  ')).toBe(true);
  });

  it('unknown / empty ids are not beta and not closed', () => {
    expect(isBetaModule('MODULE_DOES_NOT_EXIST')).toBe(false);
    expect(isBetaClosed('MODULE_DOES_NOT_EXIST')).toBe(false);
    expect(isBetaModule('')).toBe(false);
    expect(isBetaModule(null)).toBe(false);
    expect(isBetaModule(undefined)).toBe(false);
  });
});

describe('beta gating — role exemption (admins/owners exempt while BETA_ADMINS_EXEMPT)', () => {
  it('precondition: admins are currently exempt', () => {
    expect(BETA_ADMINS_EXEMPT).toBe(true);
  });

  it('locks closed betas for regular / pilot roles', () => {
    for (const role of ['USER', 'MEMBER', 'GUEST', 'VIEWER', 'CLIENT', '', null, undefined]) {
      expect(isBetaLockedForRole(role)).toBe(true);
    }
  });

  it('exempts ADMIN / OWNER / SUPERADMIN (and their aliases)', () => {
    for (const role of [
      'ADMIN',
      'OWNER',
      'SUPERADMIN',
      'administrator', // normalizes to ADMIN
      'super_admin', // normalizes to SUPERADMIN
    ]) {
      expect(isBetaLockedForRole(role)).toBe(false);
    }
  });
});

describe('lockClosedBetaModules — decorates Finance menu item with the locked plate', () => {
  const buildMenu = () => [
    { id: 'MODULE_ECONOMICS', label: 'Finance' },
    { id: 'MODULE_PRESENTATIONS', label: 'Documents' }, // open beta — must stay untouched
    {
      id: 'PARENT',
      label: 'Parent',
      subItems: [{ id: 'MODULE_ECONOMICS', label: 'Nested Finance' }],
    },
  ] as any;

  it('locks MODULE_ECONOMICS for a regular USER with BETA_LOCKED code + message', () => {
    const locked = lockClosedBetaModules(buildMenu(), 'USER', 'Access restricted');

    const finance = locked.find((m: any) => m.id === 'MODULE_ECONOMICS');
    expect(finance.isLocked).toBe(true);
    expect(finance.lockedCode).toBe(BETA_LOCKED_CODE);
    expect(finance.lockedMessage).toBe('Access restricted');

    // open beta is left fully accessible
    const docs = locked.find((m: any) => m.id === 'MODULE_PRESENTATIONS');
    expect(docs.isLocked).toBeUndefined();

    // nested closed-beta children are also locked (recursive decorate)
    const nested = locked.find((m: any) => m.id === 'PARENT').subItems[0];
    expect(nested.isLocked).toBe(true);
    expect(nested.lockedCode).toBe(BETA_LOCKED_CODE);
  });

  it('returns the menu untouched for an exempt ADMIN', () => {
    const menu = buildMenu();
    const result = lockClosedBetaModules(menu, 'ADMIN', 'Access restricted');

    // admin path short-circuits to the same menu reference, nothing locked
    expect(result).toBe(menu);
    expect(result.find((m: any) => m.id === 'MODULE_ECONOMICS').isLocked).toBeUndefined();
  });
});
