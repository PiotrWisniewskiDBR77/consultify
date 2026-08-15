/**
 * @vitest-environment jsdom
 *
 * Regression test for AGT/templates status chips: before this fix, the
 * top-strip status chips for the Template Library tab were a hardcoded list
 * (active/draft/deprecated/archived) that never matched the values actually
 * produced by `mapTemplateStatus()` in useRapData.ts (approved/published/
 * draft/deprecated/unknown). Report-sourced templates (the majority of the
 * library) resolve to 'published' and were therefore invisible behind every
 * chip while 'All' still showed the true count.
 *
 * This test renders the real chip-building logic (statusChips derived from
 * TEMPLATE_STATUS_META) against a templates list containing 'published' and
 * 'approved' items, and asserts the corresponding chips appear with correct
 * counts and are clickable.
 */
import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
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

vi.mock('../../../src/components/standard/StandardModuleBar', () => ({
  StandardModuleBar: ({ tabs, activeTab, title, commandRowContent, children }: any) => (
    <div>
      <h1>{title}</h1>
      <div data-testid="active-tab">{activeTab}</div>
      <div>
        {tabs.map((tab: any) => (
          <span key={tab.id}>{tab.label}</span>
        ))}
      </div>
      <div data-testid="command-row">{commandRowContent}</div>
      <div>{children}</div>
    </div>
  ),
}));

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
}));

describe('ReportsAndPresentationsHub — Template Library status chips', () => {
  it('renders a chip (with correct count) for every status actually produced by mapTemplateStatus, including published/approved', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=templates']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('templates');

    const commandRow = screen.getByTestId('command-row');

    // Previously missing entirely — this is the core of the bug: Report-sourced
    // templates resolve to 'published'/'approved' and had no chip to appear under.
    const publishedChip = within(commandRow).getByTitle('Published');
    expect(publishedChip).toHaveTextContent('2');

    const approvedChip = within(commandRow).getByTitle('Approved');
    expect(approvedChip).toHaveTextContent('1');

    const draftChip = within(commandRow).getByTitle('Draft');
    expect(draftChip).toHaveTextContent('1');

    // 'All' must equal the sum of all templates regardless of status.
    const allChip = within(commandRow).getByTitle('All');
    expect(allChip).toHaveTextContent(String(templatesFixture.length));
  });

  it('clicking the Published chip toggles it active/inactive (drives the status filter)', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=templates']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    const commandRow = screen.getByTestId('command-row');
    const publishedChip = within(commandRow).getByTitle('Published');

    // MENU_3_CHIP_ACTIVE is the only variant carrying `bg-state-selected`
    // (both variants share Tailwind's `active:` pseudo-class prefix in their
    // base classes, so a naive /active/ substring check would false-positive).
    expect(publishedChip.className).not.toMatch(/bg-state-selected/);

    act(() => {
      publishedChip.click();
    });

    expect(publishedChip.className).toMatch(/bg-state-selected/);

    act(() => {
      publishedChip.click();
    });

    expect(publishedChip.className).not.toMatch(/bg-state-selected/);
  });
});
