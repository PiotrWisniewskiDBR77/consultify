import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBreadcrumbs } from '../../../src/hooks/useBreadcrumbs';

const state = vi.hoisted(() => ({ pathname: '/admin/overview', search: '', language: 'pl' }));

const translations: Record<string, Record<string, string>> = {
  pl: {
    'sidebar.adminPanel': 'Panel Administratora',
    'sidebar.adminSection.overview': 'Przegląd',
    'sidebar.adminSection.people': 'Użytkownicy i dostęp',
    'sidebar.adminSection.security': 'Bezpieczeństwo i tożsamość',
    'sidebar.adminSection.billing': 'Rozliczenia i FinOps',
    'sidebar.adminSection.ai': 'Nadzór i operacje AI',
    'sidebar.adminSection.integrations': 'Integracje i synchronizacja',
    'sidebar.adminSection.audit': 'Audyt, zgodność i ryzyko',
    'sidebar.adminSection.operations': 'Operacje organizacji',
  },
  en: {
    'sidebar.adminPanel': 'Admin Panel',
    'sidebar.adminSection.overview': 'Overview',
    'sidebar.adminSection.people': 'People & Access',
    'sidebar.adminSection.security': 'Security & Identity',
    'sidebar.adminSection.billing': 'Billing & FinOps',
    'sidebar.adminSection.ai': 'AI Governance & Operations',
    'sidebar.adminSection.integrations': 'Integrations & Sync',
    'sidebar.adminSection.audit': 'Audit, Compliance & Risk',
    'sidebar.adminSection.operations': 'Organization Operations',
  },
};

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: state.pathname, search: state.search }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => translations[state.language]?.[key] || fallback,
  }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({ currentView: 'ADMIN_OVERVIEW' }),
}));

const originalEnglish = [
  'Overview',
  'People & Access',
  'Security & Identity',
  'Billing & FinOps',
  'AI Governance & Operations',
  'Integrations & Sync',
  'Audit, Compliance & Risk',
  'Organization Operations',
];

const paths = [
  'overview',
  'people',
  'security',
  'billing',
  'ai',
  'integrations',
  'audit',
  'operations',
];

describe('Day 219 Admin breadcrumbs i18n', () => {
  beforeEach(() => {
    state.language = 'pl';
    state.search = '';
  });

  it.each(paths)(
    'R3 renders /admin/%s without any original English Admin label in Polish',
    (path) => {
      state.pathname = `/admin/${path}`;
      const { result } = renderHook(() => useBreadcrumbs());

      expect(result.current?.[0]).toBe('Panel Administratora');
      expect(originalEnglish).not.toContain(result.current?.[1]);
    }
  );

  it.each(paths)('R3 retains the English translation for /admin/%s', (path) => {
    state.language = 'en';
    state.pathname = `/admin/${path}`;
    const { result } = renderHook(() => useBreadcrumbs());

    expect(originalEnglish).toContain(result.current?.[1]);
  });
});
