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
    // Plan napraw MVP 05.09.2026, poz. (4): kształt mocka MUSI odpowiadać
    // realnej odpowiedzi `GET /api/admin/risk/summary`
    // (server/src/routes/adminP32.routes.ts `readRiskSummary`):
    // `{ organizationId, summary: { audit: { highRiskCount }, incidents } }`.
    // Stary mock `{ highRiskCount: 2 }` (płaski kształt) ukrywał dokładnie
    // ten błąd — test przechodził na zielono niezależnie od tego, czy
    // komponent czytał właściwą ścieżkę, bo mock i buggy kod zgadzały się co
    // do (błędnego) kontraktu. Zobacz też "test scenariusza nie broni
    // zabezpieczenia" — mutacja musi celować w prawdziwy kontrakt API.
    api.getAdminRiskSummary.mockResolvedValue({
      organizationId: 'org-1',
      summary: { audit: { totalLogs: 10, unresolvedCount: 1, highRiskCount: 2 }, incidents: [] },
    });
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
  it('poz. (4) plan 05.09: czyta highRiskCount z zagnieżdżonej ścieżki summary.audit, nie pokazuje zawsze 0', async () => {
    // Znany błąd z fali 174, potwierdzony nadal obecny 05.09: "Ryzyka
    // wymagające przeglądu" zawsze 0, bo komponent czytał `risk.highRiskCount`
    // (undefined) zamiast `risk.summary.audit.highRiskCount` (realny kontrakt
    // API). Dowód mutacyjny: cofnięcie fixu na `risk?.highRiskCount` czerwieni
    // tę asercję, bo mock w `beforeEach` celowo NIE ma płaskiego pola.
    renderPanel();
    await screen.findByText('Ryzyka wymagające przeglądu');
    expect(await screen.findByText('2 wysokiego ryzyka')).toBeInTheDocument();
    expect(screen.queryByText('0 wysokiego ryzyka')).not.toBeInTheDocument();
  });

  it('shows an honest error when all sources fail', async () => {
    Object.values(api).forEach((fn: any) => fn.mockRejectedValue(new Error('down')));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się odczytać żadnego źródła sygnałów.'
    );
  });
});
