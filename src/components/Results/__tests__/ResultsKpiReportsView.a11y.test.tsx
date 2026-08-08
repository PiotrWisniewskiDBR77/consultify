/**
 * @vitest-environment jsdom
 *
 * CB-01 / RB-036 — the "New KPI report" and "Create tasks from action plan"
 * dialogs must be named, take focus on open, close on Escape, and return
 * focus to the trigger; the create-report form's Name/Template/Period
 * fields must be labelled. PL/EN tests use the REAL shipped
 * `public/locales/{lang}/translation.json` (via `createRealT`) so a PL
 * assertion fails if the Polish string is actually missing or wrong.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    post: vi.fn(async () => ({})),
  },
}));

vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: {
    createKpiReport: vi.fn(async () => ({})),
    refreshKpiReport: vi.fn(async () => ({})),
  },
  shouldFallbackToLegacyResults: () => false,
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../kpiRuntime', () => ({
  loadResultsKpis: vi.fn(async () => ({ kpis: [], mappings: [] })),
}));

vi.mock('../resultsShowcaseData', () => ({
  shouldUseResultsShowcaseData: () => false,
  createResultsShowcaseReports: () => [],
}));

// The real TableWithPreviewLayout hides row actions behind a kebab menu
// out of scope for this file — render each item's label plus, for the
// single item under test, the REAL `renderPreviewFooter` output (the
// component's own `<PreviewActionBar>`, self-contained enough to mount
// directly) so its "Create tasks from action plan" pill — which opens the
// second dialog under test below — is directly reachable and clickable.
vi.mock('../../shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: (props: any) => (
    <div data-testid="reports-table">
      {(props.itemIds || []).map((id: string) => {
        const item = props.getItemById?.(id);
        return (
          <div key={id} data-testid="report-row">
            {item?.name ?? id}
            {item ? props.renderPreviewFooter?.(item) : null}
          </div>
        );
      })}
    </div>
  ),
  default: () => null,
}));

let ResultsKpiReportsViewImport: typeof import('../ResultsKpiReportsView');

const Harness: React.FC = () => {
  const [nonce, setNonce] = React.useState(0);
  return (
    <MemoryRouter>
      <button type="button" onClick={() => setNonce((n) => n + 1)}>
        New report
      </button>
      <ResultsKpiReportsViewImport.ResultsKpiReportsView
        activeFilters={[]}
        onFilterChange={vi.fn()}
        createNonce={nonce}
      />
    </MemoryRouter>
  );
};

const mountWithLang = async (lang: 'en' | 'pl') => {
  vi.resetModules();
  mockI18n(lang);
  ResultsKpiReportsViewImport = await import('../ResultsKpiReportsView');
  return render(<Harness />);
};

describe('ResultsKpiReportsView — create-report dialog accessible contract (EN)', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: [] });
  });

  it('opens a named dialog when createNonce bumps', async () => {
    await mountWithLang('en');
    fireEvent.click(screen.getByRole('button', { name: 'New report' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('New KPI report');
  });

  it('labels the Name, Template, and Period fields, in English', async () => {
    await mountWithLang('en');
    fireEvent.click(screen.getByRole('button', { name: 'New report' }));
    await screen.findByRole('dialog');

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Period start')).toBeInTheDocument();
    expect(screen.getByLabelText('Period end')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    await mountWithLang('en');
    const trigger = screen.getByRole('button', { name: 'New report' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('the named close button also closes the dialog', async () => {
    await mountWithLang('en');
    fireEvent.click(screen.getByRole('button', { name: 'New report' }));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('ResultsKpiReportsView — create-report dialog accessible contract (PL)', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: [] });
  });

  it('names the dialog and labels its fields in real Polish, not English fallback', async () => {
    await mountWithLang('pl');
    fireEvent.click(screen.getByRole('button', { name: 'New report' }));

    // Real PL strings from public/locales/pl/translation.json:
    // results.kpiReports.create.title = "Nowy raport KPI"
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Nowy raport KPI');
    expect(screen.queryByText('New KPI report')).not.toBeInTheDocument();

    // common.name="Nazwa", create.template="Szablon",
    // common.periodStart="Okres od", common.periodEnd="Okres do"
    expect(screen.getByLabelText('Nazwa')).toBeInTheDocument();
    expect(screen.getByLabelText('Szablon')).toBeInTheDocument();
    expect(screen.getByLabelText('Okres od')).toBeInTheDocument();
    expect(screen.getByLabelText('Okres do')).toBeInTheDocument();
  });

  it('names the close action in real Polish and it still closes the dialog', async () => {
    await mountWithLang('pl');
    fireEvent.click(screen.getByRole('button', { name: 'New report' }));
    await screen.findByRole('dialog');

    // common.close = "Zamknij"
    const closeButton = screen.getByRole('button', { name: 'Zamknij' });
    fireEvent.click(closeButton);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('ResultsKpiReportsView — create-tasks dialog accessible contract (EN)', () => {
  const REPORT_ROW = {
    reportId: 'rep-1',
    snapshotId: 'snap-1',
    title: 'Weekly rollout control pack',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    status: 'DRAFT',
  };

  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/results/kpi-reports') {
        return { data: [REPORT_ROW] };
      }
      if (url === `/results/kpi-reports/${REPORT_ROW.snapshotId}`) {
        return {
          data: {
            snapshot: {
              actionPlan: [
                { id: 'action-1', title: 'Follow up with sponsor', dueDate: '2026-03-01' },
              ],
            },
          },
        };
      }
      return { data: [] };
    });
  });

  const openTasksDialog = async (lang: 'en' | 'pl', triggerName: string) => {
    await mountWithLang(lang);
    await waitFor(() => expect(screen.getByTestId('report-row')).toBeInTheDocument());
    const trigger = screen.getByRole('button', { name: triggerName });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');
  };

  it('opens a named dialog distinct from the create-report dialog', async () => {
    await openTasksDialog('en', 'Create tasks from action plan');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Create tasks from action plan');
  });

  it('names the close action', async () => {
    await openTasksDialog('en', 'Create tasks from action plan');

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the row trigger', async () => {
    await openTasksDialog('en', 'Create tasks from action plan');
    const trigger = screen.getByRole('button', { name: 'Create tasks from action plan' });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('the Cancel button closes the dialog without creating anything', async () => {
    await openTasksDialog('en', 'Create tasks from action plan');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('ResultsKpiReportsView — create-tasks dialog accessible contract (PL)', () => {
  const REPORT_ROW = {
    reportId: 'rep-1',
    snapshotId: 'snap-1',
    title: 'Weekly rollout control pack',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    status: 'DRAFT',
  };

  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/results/kpi-reports') {
        return { data: [REPORT_ROW] };
      }
      if (url === `/results/kpi-reports/${REPORT_ROW.snapshotId}`) {
        return { data: { snapshot: { actionPlan: [] } } };
      }
      return { data: [] };
    });
  });

  it('names the dialog and its close action in real Polish, not English fallback', async () => {
    await mountWithLang('pl');
    await waitFor(() => expect(screen.getByTestId('report-row')).toBeInTheDocument());

    // Real PL string: results.kpiReports.tasks.create =
    // "Utwórz zadania z planu działań" (also used as the dialog heading)
    const trigger = screen.getByRole('button', { name: 'Utwórz zadania z planu działań' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Utwórz zadania z planu działań');
    expect(screen.queryByText('Create tasks from action plan')).not.toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: 'Zamknij' });
    expect(closeButton).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
