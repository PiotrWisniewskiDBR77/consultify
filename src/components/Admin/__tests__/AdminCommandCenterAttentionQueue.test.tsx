import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { Api } from '../../../services/api';
import { AdminCommandCenterPanel } from '../AdminCommandCenterPanel';


// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/api', () => ({
  Api: {
    getAdminRiskSummary: vi.fn(),
    getTenantAdminAuditStats: vi.fn(),
    getAdminBillingAlerts: vi.fn(),
    getHealthPanelSummary: vi.fn(),
  },
}));
vi.mock('../../../services/enterpriseComplianceApi', () => ({
  getComplianceCostAttribution: vi.fn(),
}));
const api = vi.mocked(Api);
const renderPanel = () =>
  render(
    <MemoryRouter>
      <AdminCommandCenterPanel screen="attention-queue" />
    </MemoryRouter>
  );

describe('Command Center attention queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAdminRiskSummary.mockResolvedValue({ highRiskCount: 2 });
    api.getTenantAdminAuditStats.mockResolvedValue({ unresolvedCount: 3 });
    api.getAdminBillingAlerts.mockResolvedValue({ alerts: [] });
    api.getHealthPanelSummary.mockResolvedValue({ summary: { failed: 0 } });
  });
  /*
   * ★ Test był CZERWONY od 3af6a84586 (zamiana 4 kart na `StandardTable`).
   * Asercje opisywały wersję kartową: dopiski „Źródło:"/„Świeżość:" (klucze
   * `sourceLabel`/`freshnessLabel`, usunięte w tamtym commicie) i `<a>` per
   * karta (`role="link"`). Tabela nie ma ani jednego, ani drugiego — więc
   * bramka na tym ekranie od tamtej pory nic nie pilnowała. Odbiór grafiki
   * 174-domkniecie (2026-09-01): to właśnie ta cisza pozwoliła zniknąć
   * odnośnikowi „Otwórz ekran kanoniczny" bez żadnego sygnału.
   *
   * Teraz test opisuje TABELĘ i pilnuje nawigacji: 4 wiersze, komplet
   * nagłówków kolumn (w tym „Uwaga" — ta etykieta wyparowała raz podczas
   * naprawy) i nazwana akcja otwarcia ekranu kanonicznego w kebabie wiersza.
   */
  it('renderuje 4 sygnały w tabeli z kompletem nagłówków kolumn', async () => {
    renderPanel();
    expect(await screen.findByText('Ryzyka wymagające przeglądu')).toBeInTheDocument();
    expect(screen.getByText('Stan usług organizacji')).toBeInTheDocument();
    expect(screen.getByText('Nierozwiązane zdarzenia audytowe')).toBeInTheDocument();
    expect(screen.getByText('Alerty budżetowe')).toBeInTheDocument();
    // Etykiety czytane z samych komórek nagłówka: `name` roli `columnheader`
    // wciąga też aria-label uchwytu zmiany szerokości, więc dopasowanie po
    // nazwie roli jest niejednoznaczne.
    const naglowki = screen
      .getAllByRole('columnheader')
      .map((th) => th.querySelector('span')?.textContent?.trim() ?? '');
    for (const naglowek of ['Typ', 'Uwaga', 'Waga', 'Szczegóły', 'Źródło', 'Świeżość']) {
      expect(naglowki).toContain(naglowek);
    }
  });
  it('zachowuje drogę do ekranu kanonicznego jako nazwaną akcję wiersza', async () => {
    renderPanel();
    await screen.findByText('Ryzyka wymagające przeglądu');
    const kebaby = screen.getAllByRole('button', { name: /więcej|akcje|menu/i });
    expect(kebaby.length).toBeGreaterThan(0);
    await userEvent.click(kebaby[0]);
    expect(await screen.findByText('Otwórz ekran kanoniczny')).toBeInTheDocument();
  });
  it('shows an honest error when all sources fail', async () => {
    Object.values(api).forEach((fn: any) => fn.mockRejectedValue(new Error('down')));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się odczytać żadnego źródła sygnałów.'
    );
  });
});
