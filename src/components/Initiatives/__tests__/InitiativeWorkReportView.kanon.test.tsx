/** @vitest-environment jsdom
 *
 * P1 · RP1b — przejazd kanonu triady „Raportu z pracy" (skazy 1·2·3 z Z-29).
 *
 * Co ten test BRONI (na renderze, nie na deklaracji):
 *   1. klik w wiersz otwiera `StandardPreview` z rozbiciem doręczeń per
 *      adresat (do 14.09 klik NIC nie robił — panelu nie było w ogóle),
 *   2. tabela pokazuje ETYKIETY, nie surowe kody enuma (`PUBLISHED`/`WEEKLY`),
 *   3. akcje wiersza są w KEBABIE (`RowActionsMenu`), a nie jako dwa przyciski
 *      w komórce.
 *
 * Mutacje dające RED:
 *   · usunięcie `onRowClick` z `StandardTable` → test 1 czerwony,
 *   · powrót `render: (row) => String(row.status)` → test 2 czerwony,
 *   · usunięcie propa `rowMenu` → test 3 czerwony.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any, opts?: any) => {
      const options = typeof fallback === 'object' ? fallback : opts;
      let text = typeof fallback === 'string' ? fallback : (options?.defaultValue ?? key);
      if (options && typeof options === 'object') {
        for (const [name, value] of Object.entries(options)) {
          text = String(text).replace(new RegExp(`{{${name}}}`, 'g'), String(value));
        }
      }
      return text;
    },
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  Trans: ({ children }: any) => children ?? null,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const RUN_PUBLISHED = {
  reportRunId: 'run-published-01',
  status: 'PUBLISHED',
  version: 5,
  ownerId: 'owner-1',
  approverId: 'approver-1',
  updatedAt: '2026-09-13T07:05:00.000Z',
  audience: ['anna@dbr77.com', 'marek@dbr77.com'],
  period: { start: '2026-09-06T00:00:00.000Z', end: '2026-09-13T00:00:00.000Z' },
  workReport: {
    title: 'Weekly team update — 8-14 Sep',
    templateId: 'WEEKLY_TEAM_UPDATE',
    cadence: 'WEEKLY',
    projectIds: [],
  },
  deliveryAttempts: [
    {
      receiptId: 'r1',
      audience: ['anna@dbr77.com', 'marek@dbr77.com'],
      startedAt: '2026-09-13T07:00:00.000Z',
      recipients: [
        {
          address: 'anna@dbr77.com',
          status: 'DELIVERED',
          attempts: 1,
          lastAttemptAt: '2026-09-13T07:01:00.000Z',
          lastError: null,
        },
        {
          address: 'marek@dbr77.com',
          status: 'FAILED',
          attempts: 2,
          lastAttemptAt: '2026-09-13T07:04:00.000Z',
          lastError: '550 mailbox unavailable',
        },
      ],
    },
  ],
};

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers: vi.fn(async () => []) },
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listReportDefinitions: vi.fn(async () => ({ items: [] })),
  getReportDefinition: vi.fn(async () => ({ definitionId: 'x', versions: [] })),
  listReportRuns: vi.fn(async () => ({ items: [RUN_PUBLISHED] })),
  createReportDefinition: vi.fn(),
  createReportRun: vi.fn(),
  deliverInitiativeWorkReport: vi.fn(),
  downloadInitiativeWorkReportPdf: vi.fn(),
  previewInitiativeWorkReport: vi.fn(),
  scheduleInitiativeWorkReport: vi.fn(),
  transitionReportDefinition: vi.fn(),
  transitionReportRun: vi.fn(),
}));

import { InitiativeWorkReportView } from '../InitiativeWorkReportView';

const renderView = () =>
  render(
    <MemoryRouter>
      <InitiativeWorkReportView
        currentProjectId={null}
        currentUserId="owner-1"
        currentOrganizationId="org-1"
      />
    </MemoryRouter>
  );

describe('InitiativeWorkReportView — canon pass (RP1b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows translated status and cadence labels, not raw enum codes', async () => {
    renderView();
    await screen.findByText('Weekly team update — 8-14 Sep');
    expect(screen.getByText('Published')).toBeTruthy();
    /* „Weekly" pada też jako opcja kadencji w kreatorze — dla tabeli liczy się
       komórka z tooltipem surowego kodu (patrz asercja `getByTitle` niżej). */
    expect(screen.getAllByText('Weekly').length).toBeGreaterThan(0);
    /* Surowy kod nie może stać jako TREŚĆ komórki. Kod silnika zostaje
       dostępny w tabeli właściwości podglądu (tooltip), nie w tabeli —
       własny `<span title>` w komórce łamał wielokropek `FilterableTable`. */
    expect(screen.queryByText('PUBLISHED')).toBeNull();
    expect(screen.queryByText('WEEKLY')).toBeNull();

    fireEvent.click(screen.getByText('Weekly team update — 8-14 Sep'));
    await screen.findByTestId('work-report-preview-deliveries');
    expect(screen.getByTitle('WEEKLY')).toBeTruthy();
    expect(screen.getByTitle('WEEKLY_TEAM_UPDATE')).toBeTruthy();
  });

  it('opens the preview on a row click with per-recipient delivery status', async () => {
    renderView();
    const titleCell = await screen.findByText('Weekly team update — 8-14 Sep');
    expect(screen.queryByTestId('work-report-preview-deliveries')).toBeNull();

    fireEvent.click(titleCell);

    const deliveries = await screen.findByTestId('work-report-preview-deliveries');
    expect(within(deliveries).getByText('anna@dbr77.com')).toBeTruthy();
    expect(within(deliveries).getByText('Delivered')).toBeTruthy();
    expect(within(deliveries).getByText('marek@dbr77.com')).toBeTruthy();
    expect(within(deliveries).getByText('Failed')).toBeTruthy();
    expect(within(deliveries).getByText(/550 mailbox unavailable/)).toBeTruthy();
  });

  it('offers the PDF action from the row kebab instead of in-cell buttons', async () => {
    const { container } = renderView();
    await screen.findByText('Weekly team update — 8-14 Sep');

    /* Przed zmianą „PDF"/„Send" stały jako przyciski W KOMÓRCE — teraz w tabeli
       nie ma ich wcale, dopóki nie otworzy się kebab. */
    expect(screen.queryByRole('button', { name: /^PDF$/ })).toBeNull();

    const kebab = container.querySelector('[data-testid="row-actions-trigger"], button[aria-haspopup="menu"]');
    expect(kebab).toBeTruthy();
    fireEvent.click(kebab as Element);

    await waitFor(() => {
      expect(screen.getByText('Open PDF')).toBeTruthy();
    });
    expect(screen.getByText('Open preview')).toBeTruthy();
  });

  it('keeps the creator collapsed behind a "New report" toggle, list first (skaza 6)', async () => {
    renderView();
    await screen.findByText('Weekly team update — 8-14 Sep');

    /* Kreator ZWINIĘTY na starcie — pole „Title" kreatora nie istnieje. */
    expect(screen.queryByText('Published report definition')).toBeNull();

    const toggle = screen.getByTestId('work-report-creator-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText('Published report definition')).toBeTruthy();
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('uses the canonical SelectField (labelled control), not a bare native select (skaza 4)', async () => {
    const { container } = renderView();
    await screen.findByText('Weekly team update — 8-14 Sep');
    fireEvent.click(screen.getByTestId('work-report-creator-toggle'));
    await screen.findByText('Published report definition');

    const selects = Array.from(container.querySelectorAll('select'));
    expect(selects.length).toBeGreaterThan(0);
    /* Kanon: KAŻDY dropdown kreatora jest opakowany przez `SelectField` —
       ma własny `id`, powiązany `<label for>` i chevron. Gołe `<select>`
       w `<label>` (stan sprzed 14.09) nie miało ani id, ani chevrona. */
    for (const select of selects) {
      expect(select.id).toBeTruthy();
      expect(container.querySelector(`label[for="${select.id}"]`)).toBeTruthy();
    }
  });
});
