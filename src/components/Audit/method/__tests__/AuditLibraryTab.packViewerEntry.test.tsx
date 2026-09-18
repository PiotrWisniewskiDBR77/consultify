/**
 * OP-2 (Wpis 99, wiersz planu 65 / U-27) — WEJŚCIE z Biblioteki pakietów na
 * ekran obiektu pakietu, bramkowane `VITE_AUDIT_PACKAGE_VIEWER` (domyślnie OFF).
 *
 * Kontrakt, którego te testy pilnują:
 *   1. OFF = dzisiejsze zachowanie bez zmian: klik wiersza otwiera PRAWY PANEL
 *      (`JedenPrawyPanel` + `StandardPreview`, DEC-397/DEC-397b) i NIC nie
 *      nawiguje — flaga nie może po cichu zabrać użytkownikowi panelu;
 *   2. ON = ten sam klik (i kebab „Otwórz podgląd") nawiguje na trasę obiektu
 *      `/audit-programs/packs/:packId` i NIE otwiera panelu — obie ścieżki
 *      wchodzą przez jeden `openPack`, więc nie mogą się rozjechać;
 *   3. deep link `?tab=library&selectPackId=…` (powrót z „Rozpocznij audyt"
 *      na ekranie obiektu) ZAZNACZA wiersz i niczego nie uruchamia — nawigacja
 *      nigdy nie tworzy programu audytowego sama z siebie.
 *
 * Mock `../auditsMethodApi` ma kształt serwera (`getPack` → `AuditPackDetail`),
 * zgodnie z briefem U7 i wzorem `AuditLibraryTab.test.tsx`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) return fallback.defaultValue;
      return key;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    getPack: vi.fn(),
  };
});

/**
 * `tests/setup.ts:185` podmienia globalnie `useNavigate` na no-op (ochrona
 * komponentów renderowanych BEZ `<Router>`). Ten plik renderuje w prawdziwym
 * `MemoryRouter` i musi zobaczyć PRAWDZIWĄ nawigację — setup wprost przewiduje
 * takie nadpisanie per plik ("A test that needs to assert navigation can
 * override this with its own per-file vi.mock").
 */
vi.mock('react-router-dom', async (importOriginal) => importOriginal());

import { AuditLibraryTab } from '../tabs/AuditLibraryTab';
import { getPack, type AuditPackDetail, type AuditPackSummary } from '../auditsMethodApi';
import {
  AUDIT_PACKAGE_VIEWER_FLAG_KEYS,
  isAuditPackageViewerEnabled,
  resetAuditPackageViewerFlagCache,
} from '@/utils/auditPackageViewerFlag';

const mockedGetPack = vi.mocked(getPack);

const pack: AuditPackSummary = {
  id: 'pack-1',
  packKey: 'demo-key',
  version: 2,
  title: 'Client QMS Procedure',
  summary: null,
  sourceId: 'src-1',
  sourceTitle: 'Some source',
  sourceVersion: '1',
  sourceType: 'INTERNAL_PROCEDURE',
  verificationStatus: 'VERIFIED',
  publicationStatus: 'published',
  requiredRoles: [],
  criteriaCount: 3,
  updatedAt: '2026-09-01',
  expertApprovedBy: 'expert-1',
};

const packDetail: AuditPackDetail = {
  ...pack,
  purpose: 'Verify conformity',
  scope: 'Whole organization',
  objectives: null,
  auditType: 'compliance',
  requiredCompetencies: [],
  findingTaxonomy: [],
  rightsStatus: 'licensed',
  rightsNote: null,
  criteria: [],
};

/** Znacznik trasy obiektu — dowód, że nawigacja naprawdę zaszła. */
const ObjectRouteProbe: React.FC = () => {
  const params = useParams<{ packId: string }>();
  return <div data-testid="object-route-probe">{params.packId}</div>;
};

function renderList(initialEntry = '/audit-programs?tab=library') {
  const onStartAudit = vi.fn();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/audit-programs"
          element={
            <AuditLibraryTab
              packs={[pack]}
              loading={false}
              error={null}
              onRetry={vi.fn()}
              isPolish={false}
              onStartAudit={onStartAudit}
              startingPackId={null}
              canManagePackLibrary
              onApprovePackExpert={vi.fn()}
              onPublishPack={vi.fn()}
              pendingPackActionKey={null}
              initialSelectedId={new URLSearchParams(initialEntry.split('?')[1] ?? '').get(
                'selectPackId'
              )}
            />
          }
        />
        <Route path="/audit-programs/packs/:packId" element={<ObjectRouteProbe />} />
      </Routes>
    </MemoryRouter>
  );
  return { onStartAudit };
}

function setFlag(value: '0' | '1' | null) {
  if (value === null) {
    window.localStorage.removeItem(AUDIT_PACKAGE_VIEWER_FLAG_KEYS.localStorage);
  } else {
    window.localStorage.setItem(AUDIT_PACKAGE_VIEWER_FLAG_KEYS.localStorage, value);
  }
  resetAuditPackageViewerFlagCache();
}

function openRowKebab() {
  fireEvent.click(screen.getByLabelText('Row actions'));
}

function menuItemByLabel(label: string): HTMLButtonElement {
  const menu = document.querySelector('[role="menu"]') as HTMLElement;
  const found = [...menu.querySelectorAll('button[role="menuitem"]')].find((b) =>
    b.textContent?.trim().startsWith(label)
  ) as HTMLButtonElement | undefined;
  if (!found) throw new Error(`kebab item "${label}" not found`);
  return found;
}

describe('OP-2 — wejście z Biblioteki na ekran obiektu pakietu', () => {
  beforeEach(() => {
    mockedGetPack.mockReset();
    mockedGetPack.mockResolvedValue(packDetail);
    setFlag(null);
  });

  afterEach(() => {
    setFlag(null);
  });

  it('flaga domyślnie OFF: fail-closed, zanim właściciel zaakceptuje ekran na zrzucie', () => {
    expect(isAuditPackageViewerEnabled()).toBe(false);
  });

  it('OFF: klik wiersza otwiera dzisiejszy prawy panel i NIE nawiguje na trasę obiektu', async () => {
    renderList();
    fireEvent.click(screen.getByText('Client QMS Procedure'));

    await waitFor(() => expect(mockedGetPack).toHaveBeenCalledWith('pack-1'));
    // Panel = tabela właściwości podglądu (Purpose / Rights / Finding taxonomy).
    expect(await screen.findByText('Rights')).toBeInTheDocument();
    expect(screen.queryByTestId('object-route-probe')).not.toBeInTheDocument();
  });

  it('ON: klik wiersza nawiguje na /audit-programs/packs/:packId i NIE otwiera panelu', async () => {
    setFlag('1');
    renderList();

    fireEvent.click(screen.getByText('Client QMS Procedure'));

    const probe = await screen.findByTestId('object-route-probe');
    expect(probe.textContent).toBe('pack-1');
    expect(mockedGetPack).not.toHaveBeenCalled();
  });

  it('ON: kebab „Open preview" idzie TĄ SAMĄ drogą co klik wiersza (jeden `openPack`, nie kopia)', async () => {
    setFlag('1');
    renderList();

    openRowKebab();
    fireEvent.click(menuItemByLabel('Open preview'));

    const probe = await screen.findByTestId('object-route-probe');
    expect(probe.textContent).toBe('pack-1');
  });

  it('OFF: kebab „Open preview" nadal otwiera panel (zachowanie 1:1)', async () => {
    renderList();

    openRowKebab();
    fireEvent.click(menuItemByLabel('Open preview'));

    await waitFor(() => expect(mockedGetPack).toHaveBeenCalledWith('pack-1'));
    expect(await screen.findByText('Rights')).toBeInTheDocument();
    expect(screen.queryByTestId('object-route-probe')).not.toBeInTheDocument();
  });

  it('deep link selectPackId zaznacza wiersz i NIE uruchamia „Rozpocznij audyt"', async () => {
    setFlag('1');
    expect(isAuditPackageViewerEnabled()).toBe(true);
    const { onStartAudit } = renderList('/audit-programs?tab=library&selectPackId=pack-1');

    await waitFor(() =>
      expect(screen.getAllByText('Client QMS Procedure').length).toBeGreaterThan(0)
    );
    expect(onStartAudit).not.toHaveBeenCalled();
    // Zaznaczenie wiersza = ten sam efekt co klik: dociągnięcie szczegółów
    // zaznaczonego pakietu. Nic poza tym — nawigacja nie tworzy programu.
    await waitFor(() => expect(mockedGetPack).toHaveBeenCalledWith('pack-1'));
    expect(screen.queryByTestId('object-route-probe')).not.toBeInTheDocument();
  });
});
