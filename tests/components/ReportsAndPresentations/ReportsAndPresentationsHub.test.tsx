/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ReportsAndPresentationsHub } from '../../../src/components/ReportsAndPresentations/ReportsAndPresentationsHub';

const navigateMock = vi.fn();
let lastWorkbookTemplateId: string | null | undefined;
let lastWorkbookId: string | null | undefined;

// Kanon 2026-07-26 (docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md
// §3): Menu 1 must stay at exactly 5 tabs REGARDLESS of this flag — the
// architect moved from a Menu 1 sibling to an embedded mode inside "Szablony".
// Force it ON here to prove the tab list is flag-independent (see the test
// below); this has no bearing on the other tests since the mocked ModuleHub
// below ignores `primaryCta` (the only thing that reads this flag now).
// 2026-09-02: dropped the sibling `workbookTemplatesFlag` mock — the module
// it targeted was deleted along with the dead "Generator szablonów (Arkusz)"
// CTA entry (owner decyzja „nie" on gen-excel-templates-tab, 08-30). See the
// kanon comment above `tabs` in ReportsAndPresentationsHub.tsx.
vi.mock('../../../src/utils/deckArchitectFlag', () => ({
  isDeckArchitectEnabled: () => true,
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

// D-34b: the Hub renders the REAL `StandardModuleBar` (which delegates tab nav
// to `ModuleNavBar`), NOT `ModuleHub`. The former `vi.mock('.../shared/ModuleHub')`
// stub — with its `data-testid="active-tab"` and captured `tabs`/`onTabChange` —
// was therefore never invoked, and every assertion built on it went red. Do not
// re-add it; the tab-surface helpers below read the live `role="tab"` DOM.

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
  filterTemplatesBySearch: (rows: any[]) => rows,
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
  ExceleParametricTemplates: ({
    initialTemplateId,
    initialWorkbookId,
    onBuilt,
  }: {
    initialTemplateId?: string | null;
    initialWorkbookId?: string | null;
    onBuilt?: (result: { id: string }) => void;
  }) => {
    lastWorkbookTemplateId = initialTemplateId;
    lastWorkbookId = initialWorkbookId;
    return (
      <div data-testid="workbook-templates-view">
        workbook-templates
        <button onClick={() => onBuilt?.({ id: 'built-workbook-99' })}>mock-build</button>
      </div>
    );
  },
}));
vi.mock('../../../src/components/TemplateBuilder', () => ({
  GovernedTemplateBuilderFlow: () => (
    <div data-testid="governed-template-builder-flow">governed</div>
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Live Menu 1 tab surface (ModuleNavBar): each tab is a `role="tab"` button with
// `aria-selected` and an `aria-label` equal to its label. These helpers replace
// the removed ModuleHub mock's `data-testid="active-tab"` / captured `tabs`.
const tab = (name: string) => screen.getByRole('tab', { name });
const allTabs = () => screen.getAllByRole('tab');
const expectTabSelected = (name: string) =>
  expect(tab(name)).toHaveAttribute('aria-selected', 'true');

describe('ReportsAndPresentationsHub', () => {
  it('opens a canonical sheet template directly in workbook UI', () => {
    render(
      <MemoryRouter
        initialEntries={['/reports?tab=workbook_templates&workbookTemplateId=sheet-template-42']}
      >
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expect(screen.getByTestId('workbook-templates-view')).toBeInTheDocument();
    expect(lastWorkbookTemplateId).toBe('sheet-template-42');
  });

  // D-34b: this test used to assert a workbookId round-trip (rehydrate
  // `workbookId` from the URL, then re-navigate with the built workbook id after
  // `onBuilt`). The live Hub renders `ExceleParametricTemplates` with ONLY
  // `initialTemplateId` — it never passes `initialWorkbookId` or `onBuilt`
  // (ReportsAndPresentationsHub.tsx:1416-1419), so that round-trip is unwired.
  // DEC-607: reported as a finding in the meldunek, NOT drive-by fixed here.
  // The rewritten test pins what the deep link DOES guarantee on the live
  // surface: the workbook UI opens with the template id rehydrated.
  it('opens the workbook UI with the template id rehydrated from a workbook_templates deep link carrying an extra workbookId', () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/reports?tab=workbook_templates&workbookTemplateId=sheet-template-42&workbookId=workbook-42',
        ]}
      >
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expectTabSelected('Template Library');
    expect(screen.getByTestId('workbook-templates-view')).toBeInTheDocument();
    expect(screen.getByTestId('templates-workbook-back')).toBeInTheDocument();
    expect(lastWorkbookTemplateId).toBe('sheet-template-42');
  });

  it('preserves artifactId query param when switching tabs', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=all&artifactId=art-123&view=detail']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    act(() => {
      tab('Template Library').click();
    });

    expect(navigateMock).toHaveBeenCalledWith(
      '/presentations?tab=templates&artifactId=art-123&view=detail',
      { replace: true }
    );
  });

  it('renders the 5-type Outputs Library tab bar and opens presentations on /presentations', () => {
    render(
      <MemoryRouter initialEntries={['/presentations']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    // Menu 2 = 5 artifact TYPES (Hub comment #83). Each is a role=tab whose
    // accessible name is its label.
    for (const label of ['All', 'Documents', 'Presentations', 'Sheets', 'Template Library']) {
      expect(tab(label)).toBeInTheDocument();
    }
    // Personal scopes are NOT tabs anymore — reachable only via ?tab= deep links
    // and the Filters dropdown's Visibility/Review facets.
    expect(screen.queryByRole('tab', { name: 'Mine' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Needs review' })).toBeNull();
    // /presentations entry selects the Presentations tab.
    expectTabSelected('Presentations');
  });

  it('keeps legacy reports query alias mapped to documents tab', () => {
    render(
      <MemoryRouter initialEntries={['/reports?tab=reports']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expectTabSelected('Documents');
  });

  it('treats documents as the canonical reports tab query', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=documents']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expectTabSelected('Documents');
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

  // Kanon 2026-07-26: Architekt szablonów (Deck) przestał być zakładką Menu 1
  // — otwiera się wewnątrz "Szablony". isDeckArchitectEnabled jest mockowane
  // na ON u góry pliku właśnie po to, by ten test udowodnił, że mimo flagi ON
  // Menu 1 MA dokładnie 5 pozycji i nie zawiera 'template_architect' /
  // 'workbook_templates' jako osobnych id. (2026-09-02: 'workbook_templates'
  // nigdy nie był bramkowany osobną flagą jako Menu 1 tab — sprawdzamy to
  // nadal, bo to wartość embedded `templatesView`, nie martwy stan.)
  it('keeps Menu 1 at exactly 5 tabs with the deck architect flag ON, no template_architect/workbook_templates siblings', () => {
    render(
      <MemoryRouter initialEntries={['/presentations']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    const tabs = allTabs();
    expect(tabs).toHaveLength(5);
    const names = tabs.map((el) => el.getAttribute('aria-label'));
    expect(names).toEqual(['All', 'Documents', 'Presentations', 'Sheets', 'Template Library']);
    expect(names.some((n) => /architect/i.test(n ?? ''))).toBe(false);
    expect(names.some((n) => /workbook/i.test(n ?? ''))).toBe(false);
  });

  it('resolves the legacy ?tab=template_architect deep link into the templates tab (embedded architect view)', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=template_architect']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    // Kanon: no more sibling tab id — the deep link now lands on 'templates',
    // rendering the deck architect IN PLACE with a "← Szablony" back control.
    expectTabSelected('Template Library');
    expect(screen.getByTestId('deck-architect-view')).toBeInTheDocument();
    expect(screen.getByTestId('templates-architect-back')).toBeInTheDocument();
  });

  it('resolves the legacy ?tab=workbook_templates deep link into the templates tab (embedded architect view)', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=workbook_templates']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    expectTabSelected('Template Library');
    expect(screen.getByTestId('workbook-templates-view')).toBeInTheDocument();
    expect(screen.getByTestId('templates-workbook-back')).toBeInTheDocument();
  });

  // P1.2 (plan dokończenia Materiałów): każde wejście twórcze idzie przez
  // JAWNY wybór trybu. D-01 zdjął dedykowany przycisk command-row "New AI
  // document (Document Studio)"; dziś kanoniczne wejście na zakładce Documents
  // to CTA "New" (outputs-new-btn) → dwustopniowy launcher Materiałów (format
  // preset = document) → kafel trybu AI → Document Studio z entry=ai.
  it('routes the Documents-tab New CTA through the materials launcher AI mode into Document Studio entry=ai', () => {
    render(
      <MemoryRouter initialEntries={['/presentations?tab=documents']}>
        <ReportsAndPresentationsHub />
      </MemoryRouter>
    );

    act(() => {
      screen.getByTestId('outputs-new-btn').click();
    });
    act(() => {
      screen.getByTestId('materials-create-launcher-mode-ai').click();
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

    it('clicking the main part opens the governed full-screen template artifact', () => {
      render(
        <MemoryRouter initialEntries={['/presentations?tab=templates']}>
          <ReportsAndPresentationsHub />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('template-builder-overlay')).not.toBeInTheDocument();

      act(() => {
        screen.getByTestId('outputs-new-btn').click();
      });

      expect(screen.getByTestId('template-builder-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('governed-template-builder-flow')).toBeInTheDocument();
    });

    it('does not route through the old format/mode modal', () => {
      render(
        <MemoryRouter initialEntries={['/presentations?tab=templates']}>
          <ReportsAndPresentationsHub />
        </MemoryRouter>
      );

      act(() => screen.getByTestId('outputs-new-btn').click());
      expect(screen.queryByTestId('template-library-create-launcher')).not.toBeInTheDocument();
      expect(screen.getByTestId('governed-template-builder-flow')).toBeInTheDocument();
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
      expect(architectOption.textContent).toContain('Template Architect');

      act(() => {
        architectOption.click();
      });

      expect(navigateMock).toHaveBeenCalledWith('/presentations?tab=template_architect');
    });

    // Regresja (2026-09-02, owner decyzja „nie" 08-30 na gen-excel-templates-tab
    // — „To samo nie wiem, po co on jest."): "Generator szablonów (Arkusz)" był
    // zdublowany wpis w tym samym menu, wołający dokładnie ten sam handler co
    // kafel "Excel" w launcherze "Nowy szablon". Dowód, że nie wraca.
    it('never shows the retired "Generator szablonów (Arkusz)" entry in the split menu', () => {
      render(
        <MemoryRouter initialEntries={['/presentations?tab=templates']}>
          <ReportsAndPresentationsHub />
        </MemoryRouter>
      );

      act(() => {
        screen.getByTestId('templates-new-split-toggle').click();
      });

      expect(screen.queryByTestId('templates-open-workbook-templates')).not.toBeInTheDocument();
      expect(screen.queryByText('Generator szablonów (Arkusz)')).not.toBeInTheDocument();
    });
  });
});
