import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBreadcrumbs } from '../../../src/hooks/useBreadcrumbs';

/**
 * WAŻNY RAPORT_B #5: górny globalny breadcrumb (obok logo „77") pokazywał
 * „Ustawienia › Profil" na KAŻDEJ podstronie Ustawień — np. na
 * Import/Eksport, gdzie treść strony i lokalny breadcrumb poprawnie
 * pokazywały „Ustawienia › Import/Eksport ustawień". Przyczyna: hook
 * czytał `currentView` (AppView enum), który dla Ustawień faktycznie
 * zmienia się TYLKO dla ośmiu jawnie zmapowanych tras
 * (`getAppViewFromPath` w routeConfig.ts) — każda inna sekcja osiadała na
 * `AppView.SETTINGS_PROFILE_MODULE`, czyli "Profil".
 *
 * Naprawa: hook czyta sekcję WPROST z URL-a (`normalizeSettingsSectionFromPath`,
 * to samo źródło co SettingsView.tsx — lokalny breadcrumb, który już był
 * poprawny), więc oba miejsca są zsynchronizowane z tym samym adresem.
 *
 * Mutacja: przywrócenie starej gałęzi if/else opartej na `currentView`
 * (bez fallbacku 'profile') dla `/settings/import-export` → test poniżej
 * czerwony (sub zostaje 'Profil' zamiast 'Import/Eksport ustawień').
 */

const state = vi.hoisted(() => ({ pathname: '/settings/profile', search: '', currentView: 'SETTINGS_PROFILE_MODULE' }));

const PL: Record<string, string> = {
  'sidebar.settings': 'Ustawienia',
  'settings.sections.profile.title': 'Profil',
  'settings.sections.import-export.title': 'Import/Eksport ustawień',
  'settings.sections.security-dashboard.title': 'Przegląd bezpieczeństwa',
  'settings.sections.tenant-defaults.title': 'Domyślne ustawienia tenanta',
  'settings.sections.connected-apps.title': 'Połączone aplikacje',
  'settings.sections.templates.title': 'Szablony ustawień',
};

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: state.pathname, search: state.search }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => PL[key] || fallback,
  }),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector?: (s: any) => unknown) => {
    const fullState = { currentView: state.currentView, myWorkBreadcrumbs: null, interviewBreadcrumbs: null };
    return typeof selector === 'function' ? selector(fullState) : fullState;
  },
}));

describe('Settings breadcrumbs follow the URL, not a stale currentView (RAPORT_B #5)', () => {
  beforeEach(() => {
    state.search = '';
    state.currentView = 'SETTINGS_PROFILE_MODULE'; // never changes — exactly the bug condition.
  });

  it('shows "Profil" on /settings/profile', () => {
    state.pathname = '/settings/profile';
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual(['Ustawienia', 'Profil']);
  });

  it(
    'shows "Import/Eksport ustawień" on /settings/import-export, ' +
      'even though currentView is still stuck on SETTINGS_PROFILE_MODULE',
    () => {
      state.pathname = '/settings/import-export';
      const { result } = renderHook(() => useBreadcrumbs());
      expect(result.current).toEqual(['Ustawienia', 'Import/Eksport ustawień']);
      expect(result.current?.[1]).not.toBe('Profil');
    }
  );

  it.each([
    ['/settings/security-dashboard', 'Przegląd bezpieczeństwa'],
    ['/settings/tenant-defaults', 'Domyślne ustawienia tenanta'],
    ['/settings/connected-apps', 'Połączone aplikacje'],
    ['/settings/templates', 'Szablony ustawień'],
  ])('shows the correct localized sub-label for %s', (pathname, expectedSub) => {
    state.pathname = pathname;
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual(['Ustawienia', expectedSub]);
  });
});
