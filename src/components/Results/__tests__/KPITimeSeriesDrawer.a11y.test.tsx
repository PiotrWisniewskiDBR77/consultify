/**
 * @vitest-environment jsdom
 *
 * CB-01 / RB-001, RB-002, RV-022 — the KPI drawer must be a named dialog,
 * take focus on open, close on Escape, and return focus to the trigger. The
 * retired legacy writer must remain read-only and expose a named canonical CTA.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';

function mockI18n(lang: 'en' | 'pl') {
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({
      t: createRealT(lang),
      i18n: { language: lang },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }));
}

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/hooks/discovery/useOrganizationContext', () => ({
  useOrganizationContext: () => ({ formatForPrompt: () => '' }),
}));
vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));
vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(async () => ({ data: [] })), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: {
    getKpiCatalog: vi.fn(async () => ({
      kpis: [
        {
          id: 'kpi-1',
          name: 'Retention rate',
          description: '',
          unit: '%',
          targetValue: 90,
          baselineValue: 50,
          measurementFrequency: 'MONTHLY',
          alertDirection: 'BELOW',
          isPrimary: false,
          sortOrder: 0,
          isOnTarget: true,
          createdAt: new Date(0).toISOString(),
          currentDefinitionVersion: 1,
        },
      ],
      mappings: [],
    })),
    getKpiDrawerDetail: vi.fn(async () => ({ measurements: [], openCase: null, auditLog: [] })),
    updateKpi: vi.fn(),
    deleteKpi: vi.fn(),
  },
  shouldFallbackToLegacyResults: () => false,
}));

let KPITimeSeriesDrawerImport: typeof import('../KPITimeSeriesDrawer');

const Harness: React.FC<{ onCloseSpy: () => void }> = ({ onCloseSpy }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open KPI drawer
      </button>
      {open && (
        <KPITimeSeriesDrawerImport.KPITimeSeriesDrawer
          kpiId="kpi-1"
          initialSection="record"
          onClose={() => {
            onCloseSpy();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
};

const mountAndOpen = async (lang: 'en' | 'pl', onCloseSpy: () => void = vi.fn()) => {
  vi.resetModules();
  mockI18n(lang);
  KPITimeSeriesDrawerImport = await import('../KPITimeSeriesDrawer');
  render(<Harness onCloseSpy={onCloseSpy} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open KPI drawer' }));
  await screen.findByRole('dialog');
};

beforeEach(() => {
  vi.resetModules();
});

describe('KPITimeSeriesDrawer — dialog accessible contract (EN)', () => {
  it('exposes a named dialog role once opened', async () => {
    await mountAndOpen('en');

    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog).toHaveAccessibleName('Retention rate'));
  });

  it('names the close action with the KPI, in English', async () => {
    await mountAndOpen('en');

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Close Retention rate details' })
      ).toBeInTheDocument()
    );
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    vi.resetModules();
    mockI18n('en');
    KPITimeSeriesDrawerImport = await import('../KPITimeSeriesDrawer');
    render(<Harness onCloseSpy={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Open KPI drawer' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps the retired writer read-only and names the canonical measurement action', async () => {
    await mountAndOpen('en');

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Open canonical measurements' })
      ).toBeInTheDocument()
    );
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument();
  });
});

describe('KPITimeSeriesDrawer — dialog accessible contract (PL)', () => {
  it('names the close action with the KPI in real Polish, not English fallback', async () => {
    await mountAndOpen('pl');

    // Real PL string from public/locales/pl/translation.json:
    // results.drawer.closeFor = "Zamknij szczegóły {{name}}"
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Zamknij szczegóły Retention rate' })
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByRole('button', { name: 'Close Retention rate details' })
    ).not.toBeInTheDocument();
  });

  it('keeps the retired writer read-only in Polish instead of restoring legacy fields', async () => {
    await mountAndOpen('pl');

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Open canonical measurements' })
      ).toBeInTheDocument()
    );
    expect(screen.queryByLabelText('Wartość')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Data')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notatki')).not.toBeInTheDocument();
  });
});
