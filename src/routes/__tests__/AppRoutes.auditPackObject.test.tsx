/**
 * OP-2 (Wpis 99 + uzupełnienie Wpis 112, wiersz planu 65 / U-27) — fail-closed
 * `<Navigate>` na REALNYM `AppRoutes`, NIE na lustrze trasy (warunek twardy
 * Wpisu 112 P1). Konwencja repo (`executionRetiredDeepLinkRedirect.test.tsx`,
 * `AppRoutes.ai-chat-routing.test.tsx`) unika montowania całego `AppRoutes`, bo
 * ciągnie całe drzewo providerów; CTO wprost odrzucił lustro dla tej bramki
 * (reguła „Test na lustrze + GREEN mutacje wpięcia = HOLD", 18.09), więc ten
 * plik montuje PRAWDZIWY komponent `AppRoutes` w `MemoryRouter`.
 *
 * Atrakcje:
 *   - `@/store/useAppStore` — per plik (globalna atrapa `tests/setup.ts` nie ma
 *     `currentUser.isAuthenticated`/`role` ani `setNavigateFn`, a `ProtectedRoute`
 *     i `BetaGate` czytają dokładnie te pola);
 *   - `react-router-dom` — przywrócony do oryginału (`tests/setup.ts:185` globally
 *     podmienia `useNavigate` na no-op; tu musi działać prawdziwa nawigacja);
 *   - `MainLayout` (chrom) i `AuditsMethodHub` (TREŚĆ celu przekierowania) —
 *     stuby, żeby nie ciągnąć całego app shell; logika tras (`<Route>`,
 *     `AuditPackObjectRoute` z prawdziwym `<Navigate>` i `onBack`) pozostaje
 *     PRAWDZIWYM kodem `AppRoutes`;
 *   - `AuditPackObjectPage` renderuje się NAPRAWDĘ (nie stub) — dowód, że flaga
 *     ON dopuszcza ekran, a `Back` woła `navigate('/audit-programs?tab=library')`.
 *
 * Trzy reguły (mutacje w meldunku):
 *   1. OFF: `/audit-programs/packs/pack-1` → redirect na `/audit-programs?tab=library`
 *      (mutacja: usuń `<Navigate>` → RED);
 *   2. ON: ta sama trasa renderuje ekran obiektu, URL bez zmian;
 *   3. Back z ekranu → cel nawigacji `/audit-programs?tab=library`
 *      (mutacja: `onBack` → `navigate('/')` → RED).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../public/locales/en/translation.json';
import plTranslation from '../../../public/locales/pl/translation.json';

/**
 * `tests/setup.ts:185` globally mockuje `useNavigate` na no-op. Ten plik montuje
 * prawdziwy router i musi zobaczyć PRAWDZIWĄ nawigację — setup wprost przewiduje
 * nadpisanie per plik (`importOriginal`).
 */
vi.mock('react-router-dom', async (importOriginal) => importOriginal());

const { storeState } = vi.hoisted(() => ({
  storeState: {
    currentView: 'AI_CHAT',
    currentUser: {
      id: 'u-1',
      email: 'admin@example.test',
      name: 'Admin',
      role: 'ADMIN',
      isAuthenticated: true,
    } as Record<string, unknown> | null,
    currentOrganization: { id: 'org-1', name: 'Test Org', plan: 'professional' },
    currentProjectId: null,
    setCurrentView: vi.fn(),
    setCurrentUser: vi.fn(),
    setCurrentOrganization: vi.fn(),
    setCurrentProjectId: vi.fn(),
    setSessionMode: vi.fn(),
    setAuthInitialStep: vi.fn(),
    authInitialStep: 0,
    sessionMode: 'FREE',
    logout: vi.fn(),
    fullSessionData: null,
    setFullSessionData: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
    setNavigateFn: vi.fn(),
    isAuthInitializing: false,
    setDemoMode: vi.fn(),
    resetDemoState: vi.fn(),
    // Pola czytane przez AuditPackObjectPage (renderuje się naprawdę przy ON).
    user: { id: 'u-1', email: 'admin@example.test', name: 'Admin', role: 'ADMIN' },
    currentOrg: { id: 'org-1', name: 'Test Org', plan: 'professional' },
    organization: { id: 'org-1', name: 'Test Org' },
    aiConfig: { selectedTier: 'STANDARD', selectedModelId: null, autoMode: false },
    language: 'en',
    notifications: [],
    isAuthenticated: true,
    chatSystemPrompt: null,
    chatContextActions: null,
    isChatCollapsed: true,
  } as Record<string, unknown>,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (state: typeof storeState) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

// Chrom (app shell) — nieistotny dla logiki tras; stub, żeby nie ciągnąć nav.
vi.mock('@/layouts/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout-stub">{children}</div>
  ),
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout-stub">{children}</div>
  ),
}));

// TREŚĆ celu przekierowania `/audit-programs` — stub; asercja jest na URL, nie
// na hub. (Hub ma własne testy.)
vi.mock('@/components/Audit/method/AuditsMethodHub', () => ({
  default: () => <div data-testid="audits-hub-stub" />,
  AuditsMethodHub: () => <div data-testid="audits-hub-stub" />,
}));

// Sieć — ekran obiektu renderuje się naprawdę, więc getPack/listPrograms muszą
// zwrócić kształt serwera (bez realnego fetcha).
vi.mock('@/components/Audit/method/auditsMethodApi', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/Audit/method/auditsMethodApi')
  >('@/components/Audit/method/auditsMethodApi');
  return { ...actual, getPack: vi.fn(), listPrograms: vi.fn() };
});

import { AppRoutes } from '../AppRoutes';
import {
  getPack,
  listPrograms,
  type AuditPackDetail,
} from '@/components/Audit/method/auditsMethodApi';
import {
  AUDIT_PACKAGE_VIEWER_FLAG_KEYS,
  resetAuditPackageViewerFlagCache,
} from '@/utils/auditPackageViewerFlag';

const mockedGetPack = vi.mocked(getPack);
const mockedListPrograms = vi.mocked(listPrograms);
const INITIAL_LANGUAGE = i18n.language;

const packDetail: AuditPackDetail = {
  id: 'pack-1',
  packKey: 'qms-pack',
  version: 2,
  title: 'Client QMS Procedure',
  summary: 'Annual conformity pack.',
  sourceId: 'src-1',
  sourceTitle: 'Some source',
  sourceVersion: '1',
  sourceType: 'INTERNAL_PROCEDURE',
  verificationStatus: 'VERIFIED',
  publicationStatus: 'draft',
  requiredRoles: [],
  criteriaCount: 1,
  updatedAt: '2026-09-01T00:00:00Z',
  expertApprovedBy: null,
  purpose: 'Verify conformity',
  scope: 'Whole organization',
  objectives: null,
  auditType: 'compliance',
  requiredCompetencies: [],
  findingTaxonomy: [],
  rightsStatus: 'licensed',
  rightsNote: null,
  criteria: [
    {
      id: 'crit-1',
      parentId: null,
      ordinal: 1,
      refCode: 'ZAK-8.4.1',
      nodeKind: 'control',
      title: 'Supplier qualification',
      mandatory: true,
    },
  ],
};

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return (
    <output data-testid="location-probe">
      {location.pathname}
      {location.search}
    </output>
  );
};

function setFlag(value: '0' | '1' | null) {
  if (value === null) {
    window.localStorage.removeItem(AUDIT_PACKAGE_VIEWER_FLAG_KEYS.localStorage);
  } else {
    window.localStorage.setItem(AUDIT_PACKAGE_VIEWER_FLAG_KEYS.localStorage, value);
  }
  resetAuditPackageViewerFlagCache();
}

function mountAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <AppRoutes />
    </MemoryRouter>
  );
}

const readLocation = () => screen.getByTestId('location-probe').textContent || '';

describe('AppRoutes — OP-2 audit pack object route (realny AppRoutes, nie lustro)', () => {
  beforeEach(async () => {
    i18n.addResourceBundle('en', 'translation', enTranslation, true, true);
    i18n.addResourceBundle('pl', 'translation', plTranslation, true, true);
    await i18n.changeLanguage('en');
    mockedGetPack.mockReset();
    mockedListPrograms.mockReset();
    mockedGetPack.mockResolvedValue(packDetail);
    mockedListPrograms.mockResolvedValue({ items: [], total: 0 });
    storeState.currentUser = {
      id: 'u-1',
      email: 'admin@example.test',
      name: 'Admin',
      role: 'ADMIN',
      isAuthenticated: true,
    };
    storeState.isAuthInitializing = false;
  });

  afterEach(() => setFlag(null));

  afterAll(async () => {
    await i18n.changeLanguage(INITIAL_LANGUAGE);
  });

  it('OFF (fail-closed): /audit-programs/packs/pack-1 → redirect na /audit-programs?tab=library', async () => {
    setFlag('0');
    mountAt('/audit-programs/packs/pack-1');

    await waitFor(() => expect(readLocation()).toBe('/audit-programs?tab=library'));
    // Ekran obiektu NIE renderuje się przy OFF — to dokładnie ten <Navigate>.
    expect(screen.queryByTestId('audit-pack-object-page')).not.toBeInTheDocument();
    expect(mockedGetPack).not.toHaveBeenCalled();
  });

  it('ON: ta sama trasa renderuje ekran obiektu, URL bez zmian', async () => {
    setFlag('1');
    mountAt('/audit-programs/packs/pack-1');

    expect(await screen.findByTestId('audit-pack-object-page')).toBeInTheDocument();
    await waitFor(() => expect(mockedGetPack).toHaveBeenCalledWith('pack-1'));
    expect(readLocation()).toBe('/audit-programs/packs/pack-1');
  });

  it('ON: Back z ekranu nawiguje na /audit-programs?tab=library (cel nawigacji, nie lustro)', async () => {
    setFlag('1');
    mountAt('/audit-programs/packs/pack-1');

    await screen.findByTestId('audit-pack-object-page');
    fireEvent.click(await screen.findByRole('button', { name: /^back$/i }));

    await waitFor(() => expect(readLocation()).toBe('/audit-programs?tab=library'));
  });
});
