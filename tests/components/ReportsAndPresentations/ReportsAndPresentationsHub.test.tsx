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
let lastTabs: Array<{ id: string; label: string }> | null = null;

// Kanon 2026-07-26 (docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md
// §3): Menu 1 must stay at exactly 5 tabs REGARDLESS of these flags — the
// architects moved from Menu 1 siblings to an embedded mode inside "Szablony".
// Force both ON here to prove the tab list is flag-independent (see the test
// below); this has no bearing on the other tests since the mocked ModuleHub
// below ignores `primaryCta` (the only thing that reads these flags now).
vi.mock('../../../src/utils/deckArchitectFlag', () => ({
  isDeckArchitectEnabled: () => true,
}));
vi.mock('../../../src/utils/workbookTemplatesFlag', () => ({
  isWorkbookTemplatesEnabled: () => true,
}));

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

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  ModuleHub: ({ tabs, activeTab, title, commandRowContent, onTabChange, children }: any) => {
    lastOnTabChange = onTabChange;
    lastTabs = tabs;
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

// Embedded architect views (opened FROM the "Szablony" tab, kanon 2026-07-26)
// — stubbed like the other tab-content components above; these are heavy
// real screens with their own data fetching, out of scope for this shallow
// Menu 1 / routing test.
vi.mock('../../../src/components/Presentations/PresentationTemplateArchitectView', () => ({
  PresentationTemplateArchitectView: () => (
    <div data-testid="deck-architect-view">deck-architect</div>
  ),
}));
vi.mock('../../../src/components/AIChat/KimiWorkspace/ExceleParametricTemplates', () => ({
  ExceleParametricTemplates: () => (
    <div data-testid="workbook-templates-view">workbook-templates</div>
  ),
}));
vi.mock('../../../src/components/TemplateBuilder', () => ({
  TemplateBuilderFlow: ({ initialType }: { initialType?: string }) => (
    <div data-testid="excel-template-builder-flow">{initialType}</div>
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
      </MemoryRouter>
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
      </MemoryRouter>
    );

    expect(screen.getByTestId('templates-initial-artifact')).toHaveTextContent('tpl-art-77');
  });

  it('falls back to deck query param for presentation deep-link selection token', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=presentations&deck=deck-22']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(screen.getByTestId('presentations-initial-artifact')).toHaveTextContent('deck-22');
  });

  it('canonicalizes legacy deck query into artifactId with replace navigation', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=presentations&deck=deck-22']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(navigateMock).toHaveBeenCalledWith(
      '/presentations?tab=presentations&artifactId=deck-22',
      {
        replace: true,
      }
    );
  });

  // Kanon 2026-07-26: Architekt szablonów (Deck) i Generator szablonów (Excel)
  // przestały być zakładkami Menu 1 — otwierają się wewnątrz "Szablony".
  // isDeckArchitectEnabled/isWorkbookTemplatesEnabled są mockowane na ON u
  // góry pliku właśnie po to, by ten test udowodnił, że mimo obu flag ON
  // Menu 1 MA dokładnie 5 pozycji i nie zawiera 'template_architect' /
  // 'workbook_templates' jako osobnych id.
  it('keeps Menu 1 at exactly 5 tabs with both architect flags ON, no template_architect/workbook_templates siblings', () => {
    render(
      <MemoryRouter initialEntries={['/presentations']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(lastTabs).toHaveLength(5);
    const tabIds = (lastTabs || []).map((tab) => tab.id);
    expect(tabIds).toEqual([
      'outputs_all',
      'outputs_documents',
      'presentations',
      'outputs_sheets',
      'templates',
    ]);
    expect(tabIds).not.toContain('template_architect');
    expect(tabIds).not.toContain('workbook_templates');
  });

  it('resolves the legacy ?tab=template_architect deep link into the templates tab (embedded architect view)', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=template_architect']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    // Kanon: no more sibling tab id — the deep link now lands on 'templates',
    // rendering the deck architect IN PLACE with a "← Szablony" back control.
    expect(screen.getByTestId('active-tab')).toHaveTextContent('templates');
    expect(screen.getByTestId('deck-architect-view')).toBeInTheDocument();
    expect(screen.getByTestId('templates-architect-back')).toBeInTheDocument();
  });

  it('resolves the legacy ?tab=workbook_templates deep link into the templates tab (embedded architect view)', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=workbook_templates']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('templates');
    expect(screen.getByTestId('workbook-templates-view')).toBeInTheDocument();
    expect(screen.getByTestId('templates-workbook-back')).toBeInTheDocument();
  });

  // P1.2 (plan dokończenia Materiałów): każde wejście twórcze idzie przez
  // JAWNY wybór trybu — przycisk nazywa się "New AI document", więc entry=ai
  // jest jedynym słusznym trybem (wcześniej brak ?entry= zostawiał zachowanie
  // zależne od stanu triModeFlag, co mogło pokazać TriModeChooser zamiast
  // wejść wprost do AI).
  it('navigates to Document Studio with entry=ai from the "New AI document" command-row button', () => {
    render(
      <MemoryRouter initialEntries={['/presentations']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    const button = screen.getByTitle('New AI document (Document Studio)');
    act(() => {
      button.click();
    });

    expect(navigateMock).toHaveBeenCalledWith('/document-studio?entry=ai');
  });

  it('"← Szablony" returns from the embedded deck architect view to the Template Library table', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=template_architect']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(screen.getByTestId('deck-architect-view')).toBeInTheDocument();
    act(() => {
      screen.getByTestId('templates-architect-back').click();
    });

    expect(navigateMock).toHaveBeenCalledWith('/presentations?tab=templates', { replace: true });
    // Local view-state flips immediately (independent of the mocked navigate
    // actually changing history) — the library table reappears in place.
    expect(screen.queryByTestId('deck-architect-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('templates-initial-artifact')).toBeInTheDocument();
  });

  // Regresja G5 (przechwycona przez suitę E2E, NIE przez jednostkowe testy
  // powyżej — dlatego przeszła na demo): Hub przekazywał `TemplatesNewSplitButton`
  // (ReactNode) przez prop `primaryCta` StandardModuleBar, który oczekuje configu
  // {label,icon,onClick} — button.icon/label/onClick były `undefined`, więc
  // przycisk renderował się jako PUSTA, NIEKLIKALNA biała pigułka. Naprawa:
  // ten sam ReactNode idzie przez `primaryCtaContent` (dedykowany slot).
  // Te testy renderują PRAWDZIWY StandardModuleBar (nieomockowany w tym pliku
  // — mock '.../ModuleHub' powyżej jest martwy, Hub od dawna renderuje
  // StandardModuleBar bezpośrednio), więc łapią realne przekazanie propa.
  describe('"New template" split button (deck-architect flag ON)', () => {
    it('renders with visible, non-empty label text (regression: was an empty white pill)', () => {
      render(
        <MemoryRouter initialEntries={['/presentations?tab=templates']}>
          <ReportsAndPresentationsHub />
        </MemoryRouter>
      );

      const button = screen.getByTestId('outputs-new-btn');
      expect(button).toBeInTheDocument();
      expect(button.textContent?.trim()).toBe('New template');
    });

    it('clicking the main part triggers the default "New template" action (opens the format/mode launcher)', () => {
      render(
        <MemoryRouter initialEntries={['/presentations?tab=templates']}>
          <ReportsAndPresentationsHub />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('template-library-create-launcher')).not.toBeInTheDocument();

      act(() => {
        screen.getByTestId('outputs-new-btn').click();
      });

      expect(screen.getByTestId('template-library-create-launcher')).toBeInTheDocument();
    });

    it('opens the Excel Template Builder from the spreadsheet tile', () => {
      render(
        <MemoryRouter initialEntries={['/presentations?tab=templates']}>
          <ReportsAndPresentationsHub />
        </MemoryRouter>
      );

      act(() => screen.getByTestId('outputs-new-btn').click());
      act(() => screen.getByTestId('template-library-create-launcher-format-spreadsheet').click());
      act(() => screen.getByTestId('template-library-create-launcher-mode-blank').click());

      expect(screen.getByTestId('template-builder-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('excel-template-builder-flow')).toHaveTextContent('table');
      expect(navigateMock).not.toHaveBeenCalledWith(
        expect.stringContaining('tab=workbook_templates')
      );
    });

    it('clicking the split arrow reveals "Architekt szablonów", and selecting it navigates into the embedded deck-architect mode', () => {
      render(
        <MemoryRouter initialEntries={['/presentations?tab=templates']}>
          <ReportsAndPresentationsHub />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('templates-open-deck-architect')).not.toBeInTheDocument();

      act(() => {
        screen.getByTestId('templates-new-split-toggle').click();
      });

      const architectOption = screen.getByTestId('templates-open-deck-architect');
      expect(architectOption).toBeInTheDocument();
      expect(architectOption.textContent).toContain('Architekt szablonów');

      act(() => {
        architectOption.click();
      });

      expect(navigateMock).toHaveBeenCalledWith('/presentations?tab=template_architect');
    });
  });
});
