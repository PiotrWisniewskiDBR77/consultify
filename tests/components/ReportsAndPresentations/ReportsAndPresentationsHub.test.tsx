/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ReportsAndPresentationsHub } from '../../../src/components/ReportsAndPresentations/ReportsAndPresentationsHub';

const navigateMock = vi.fn();
let lastOnTabChange: ((tab: string) => void) | null = null;

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback || _key,
      i18n: { language: 'en' },
    }),
  };
});

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  ModuleHub: ({ tabs, activeTab, title, commandRowContent, onTabChange, children }: any) => {
    lastOnTabChange = onTabChange;
    return (
      <div>
        <h1>{title}</h1>
        <div data-testid="active-tab">{activeTab}</div>
        <div>
          {tabs.map((tab: any) => (
            <span key={tab.id}>{tab.label}</span>
          ))}
        </div>
        <div data-testid="command-row">{commandRowContent}</div>
        <button
          data-testid="switch-to-templates"
          onClick={() => onTabChange?.('templates')}
          type="button"
        >
          switch
        </button>
        <div>{children}</div>
      </div>
    );
  },
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
    templates: [],
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
  PresentationsTabContent: ({ initialArtifactId }: any) => (
    <div data-testid="presentations-initial-artifact">{initialArtifactId || 'none'}</div>
  ),
}));

vi.mock('../../../src/components/ReportsAndPresentations/SheetsTabContent', () => ({
  SheetsTabContent: () => <div>sheets-tab</div>,
}));

vi.mock('../../../src/components/ReportsAndPresentations/TemplatesTabContent', () => ({
  TemplatesTabContent: ({ initialArtifactId }: any) => (
    <div data-testid="templates-initial-artifact">{initialArtifactId || 'none'}</div>
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('ReportsAndPresentationsHub', () => {
  it('preserves artifactId query param when switching tabs', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=all&artifactId=art-123&view=detail']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>,
    );

    expect(lastOnTabChange).toBeTypeOf('function');
    act(() => {
      lastOnTabChange?.('templates');
    });

    expect(navigateMock).toHaveBeenCalledWith(
      '/presentations?tab=templates&artifactId=art-123&view=detail',
      { replace: true }
    );
  });

  it('renders Wave 2 Outputs Library taxonomy on the unified hub and opens presentations on /presentations', () => {
    render(
      <MemoryRouter initialEntries={['/presentations']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(screen.getAllByText('All').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mine').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs review').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Documents').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Presentations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sheets').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Template Library').length).toBeGreaterThan(0);
    expect(screen.getByTestId('active-tab')).toHaveTextContent('presentations');
  });

  it('keeps legacy reports query alias mapped to documents tab', () => {
    render(
      <MemoryRouter initialEntries={['/reports?tab=reports']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('outputs_documents');
  });

  it('treats documents as the canonical reports tab query', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=documents']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('outputs_documents');
  });

  it('passes initialArtifactId to templates tab content', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=templates&artifactId=tpl-art-77']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('templates-initial-artifact')).toHaveTextContent('tpl-art-77');
  });

  it('falls back to deck query param for presentation deep-link selection token', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=presentations&deck=deck-22']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('presentations-initial-artifact')).toHaveTextContent('deck-22');
  });

  it('canonicalizes legacy deck query into artifactId with replace navigation', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=presentations&deck=deck-22']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>,
    );

    expect(navigateMock).toHaveBeenCalledWith('/presentations?tab=presentations&artifactId=deck-22', {
      replace: true,
    });
  });
});
