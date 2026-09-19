/**
 * @vitest-environment jsdom
 *
 * Regression test for the Template Library status filter. The original bug:
 * the status affordance was a hardcoded chip list (active/draft/deprecated/
 * archived) that never matched the values `mapTemplateStatus()` in useRapData.ts
 * actually produces (approved/published/draft/deprecated/unknown). Report-sourced
 * templates — the majority of the library — resolve to 'published' and were
 * therefore invisible behind every chip while 'All' still showed the true count.
 *
 * DEC-423d (owner, 06.09.2026) moved that affordance out of the Menu 3 top-strip
 * chips and into the Menu 2 "Status" dropdown (data-testid
 * `materials-status-dropdown`, component `Menu2PresetDropdown`). The dropdown is
 * built from the SAME two sources that drive the table — `tabStatusOptions`
 * (from TEMPLATE_STATUS_META) and `tabStatusCounts` (countRowsByStatus over the
 * real `status` field) — so a status can no longer be counted-but-unselectable.
 *
 * This test renders the real Hub against a templates list containing
 * 'published' and 'approved' items and asserts those statuses appear in the
 * dropdown with correct counts, that 'All' equals the total, and that picking a
 * status drives the filter (round-trips into the dropdown's selected value).
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ReportsAndPresentationsHub } from '../../../src/components/ReportsAndPresentations/ReportsAndPresentationsHub';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: any) =>
        typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
      i18n: { language: 'en' },
    }),
  };
});

vi.mock('../../../src/components/shared/ModuleHub/useModuleOpenDocuments', () => ({
  useModuleOpenDocuments: () => ({
    openDocuments: [],
    setOpenDocuments: vi.fn(),
    activeDocumentId: null,
    setActiveDocumentId: vi.fn(),
  }),
}));

vi.mock('../../../src/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
}));

const templatesFixture = [
  { id: 'tpl-1', status: 'published', title: 'Report Template A' },
  { id: 'tpl-2', status: 'published', title: 'Report Template B' },
  { id: 'tpl-3', status: 'approved', title: 'Approved Template' },
  { id: 'tpl-4', status: 'draft', title: 'Draft Template' },
];

vi.mock('../../../src/components/ReportsAndPresentations/useRapData', () => ({
  useReports: () => ({
    reports: [],
    loading: false,
    error: null,
    fetchReports: vi.fn(),
    deleteReport: vi.fn(),
  }),
  usePresentations: () => ({
    presentations: [],
    loading: false,
    error: null,
    fetchPresentations: vi.fn(),
    deleteDeck: vi.fn(),
  }),
  useTemplates: () => ({
    templates: templatesFixture,
    loading: false,
    error: null,
  }),
  useArtifactOutputsList: () => ({
    rows: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSheetOutputs: () => ({
    rows: [],
    loading: false,
    error: null,
    fetchSheets: vi.fn(),
  }),
  useRapActions: () => ({
    exportReportPdf: vi.fn(),
    exportDeckPptx: vi.fn(),
    archiveReport: vi.fn(),
    archiveDeck: vi.fn(),
    startArtifactReview: vi.fn(),
  }),
}));

vi.mock('../../../src/components/ReportsAndPresentations/OutputsAggregateTabContent', () => ({
  OutputsAggregateTabContent: () => <div>aggregate-tab</div>,
}));

vi.mock('../../../src/components/ReportsAndPresentations/ReportsTabContent', () => ({
  ReportsTabContent: () => <div>reports-tab</div>,
}));

vi.mock('../../../src/components/ReportsAndPresentations/PresentationsTabContent', () => ({
  PresentationsTabContent: () => <div>presentations-tab</div>,
}));

vi.mock('../../../src/components/ReportsAndPresentations/SheetsTabContent', () => ({
  SheetsTabContent: () => <div>sheets-tab</div>,
}));

vi.mock('../../../src/components/ReportsAndPresentations/TemplatesTabContent', () => ({
  TemplatesTabContent: () => <div data-testid="templates-tab">templates-tab</div>,
  filterTemplatesBySearch: (rows: any[]) => rows,
}));

/** Open the Menu 2 Status dropdown and return its option elements. */
function openStatusOptions(): HTMLElement[] {
  const dropdown = screen.getByTestId('materials-status-dropdown');
  fireEvent.click(within(dropdown).getByRole('button', { expanded: false }));
  return within(within(dropdown).getByRole('listbox')).getAllByRole('option');
}

/**
 * Find the dropdown option whose label span reads exactly `label`. When `count`
 * is given, the option's count badge must match too — needed because the
 * `__drafts__` preset and the real `draft` status share the label "Draft"
 * (only the latter carries a count).
 */
function optionByLabel(options: HTMLElement[], label: string, count?: number): HTMLElement {
  const matches = options.filter((o) => within(o).queryByText(label) !== null);
  const match =
    count === undefined
      ? matches[0]
      : matches.find((o) => within(o).queryByText(String(count)) !== null);
  if (!match) {
    throw new Error(
      `No status option labelled "${label}"${count === undefined ? '' : ` with count ${count}`}. Found: ${options
        .map((o) => o.textContent)
        .join(' | ')}`
    );
  }
  return match;
}

describe('ReportsAndPresentationsHub — Template Library status filter (Menu 2 dropdown)', () => {
  it('offers every status produced by mapTemplateStatus (incl. published/approved) with correct counts, and All = total', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=templates']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    const options = openStatusOptions();

    // Previously missing entirely — this is the core of the bug: Report-sourced
    // templates resolve to 'published'/'approved' and had no chip to appear under.
    expect(within(optionByLabel(options, 'Published', 2)).getByText('2')).toBeInTheDocument();
    expect(within(optionByLabel(options, 'Approved', 1)).getByText('1')).toBeInTheDocument();
    // 'Draft' is ambiguous (the __drafts__ preset shares the label); the count
    // argument pins the real status option.
    expect(within(optionByLabel(options, 'Draft', 1)).getByText('1')).toBeInTheDocument();

    // 'All' must equal the sum of all templates regardless of status.
    expect(
      within(optionByLabel(options, 'All')).getByText(String(templatesFixture.length))
    ).toBeInTheDocument();
  });

  it('selecting Published drives the status filter (round-trips into the dropdown value)', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=templates']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    // Pick "Published" — onChange('published') -> setSinglePreset('status', ...).
    fireEvent.click(optionByLabel(openStatusOptions(), 'Published'));

    // Reopen: the Published option is now the selected one, All is not.
    const options = openStatusOptions();
    expect(optionByLabel(options, 'Published')).toHaveAttribute('aria-selected', 'true');
    expect(optionByLabel(options, 'All')).toHaveAttribute('aria-selected', 'false');
  });
});
