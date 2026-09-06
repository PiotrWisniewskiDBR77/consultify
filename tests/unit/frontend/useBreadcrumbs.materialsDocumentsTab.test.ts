/**
 * MVP audit 05/06.09.2026 (evidence/audyt-mvp-20260906/B2/RAPORT_B2.md,
 * WAŻNY #7 / defekt 3): opening `/presentations?tab=documents` (the
 * "Dokumenty" tab inside the Materiały module) showed a redundant top-left
 * breadcrumb "Dokumenty › Dokumenty" instead of "Materiały › Dokumenty" —
 * the module lost its own identity in the breadcrumb the moment a
 * recognized `?tab=` was present, because `useBreadcrumbs.ts`'s
 * PRESENTATIONS branch used `sidebar.outputsLibrary` (pl: "Dokumenty") as
 * the section label instead of `sidebar.materialy` (pl: "Materiały").
 *
 * This test drives the real hook with the REAL translation.json content
 * (not a hand-rolled dict) so a future edit that reintroduces the wrong
 * key, or that changes its pl value back to "Dokumenty", fails here.
 *
 * Mutation check: reverting the section label back to
 * `t('sidebar.outputsLibrary', 'Outputs')` makes this test fail (breadcrumb
 * becomes ["Dokumenty", "Dokumenty"]).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useBreadcrumbs } from '../../../src/hooks/useBreadcrumbs';

const state = vi.hoisted(() => ({
  pathname: '/presentations',
  search: '?tab=documents',
}));

const pl = JSON.parse(
  readFileSync(path.join(process.cwd(), 'public', 'locales', 'pl', 'translation.json'), 'utf8')
);

function getPath(obj: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce((cur: any, part) => (cur == null ? undefined : cur[part]), obj);
}

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: state.pathname, search: state.search }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => {
      const value = getPath(pl, key);
      return typeof value === 'string' ? value : fallback;
    },
  }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({ currentView: 'PRESENTATIONS' }),
}));

describe('useBreadcrumbs — Materiały module keeps its own identity on the Documents tab', () => {
  it('renders ["Materiały", "Dokumenty"] for /presentations?tab=documents, not ["Dokumenty", "Dokumenty"]', () => {
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual(['Materiały', 'Dokumenty']);
  });

  it('also keeps "Materiały" as the section label for other recognized tabs (e.g. presentations)', () => {
    state.search = '?tab=presentations';
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current?.[0]).toBe('Materiały');
    state.search = '?tab=documents';
  });
});
