/**
 * @vitest-environment jsdom
 *
 * DEC-423b/c/d (właściciel, 06.09.2026 16:25–16:41, zrzuty Materiałów):
 * „jak posprzątamy tę prostą nawigację między przyciskami, będzie naprawdę
 * dobre" — JEDEN standard sterowania w KAŻDEJ z pięciu zakładek:
 *
 *   Menu 2: [lupa][zakładki] … [dropdown Status][dropdown Widoczność][pstryczek][CTA]
 *   Menu 3: JEDEN rząd chipów; ≤3 tam, gdzie Menu 2 ma dropdown statusu.
 *   Zero przycisków „Pokaż robocze" i „Filtry".
 *
 * TPL-1a v5: Biblioteka wzorców ma Status + Źródło w Menu 2. Menu 3 zawiera
 * wyłącznie formaty; wybór źródła zawęża ten sam zbiór i zapisuje się w URL.
 *
 * MUTACJE (zmierzone ręcznie 06.09.2026 przy tym dyżurze — patrz meldunek):
 *  1. przywrócenie przycisku „Pokaż robocze" w `rightControls`
 *     → „zero przycisków Pokaż robocze/Filtry" na CZERWONO (5 zakładek),
 *  2. przywrócenie `disabled` na CTA „Nowy wzorzec" po jego świadomym
 *     odmrożeniu → test DEC-558 aktywnego pełnego artefaktu na CZERWONO.
 *
 * [ODMROZENIE 11_MATERIALS DEC-558] CTA zostało odmrożone po akceptacji
 * makiety 16.09; kontrakt broni teraz aktywnego wejścia do governed buildera.
 */

// Ten kontrakt mierzy zapis filtra w URL, więc potrzebuje prawdziwego
// `useNavigate`, które globalny setup testów domyślnie zastępuje no-opem.
vi.unmock('react-router-dom');

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: unknown) => {
      const messages: Record<string, string> = {
        'reports.personal': 'Personal',
        'reports.application': 'Application',
        'reports.organization': 'Organization',
      };
      if (messages[k]) return messages[k];
      if (typeof opts === 'string') return opts;
      if (opts && typeof opts === 'object' && 'defaultValue' in opts) {
        return String((opts as { defaultValue: unknown }).defaultValue);
      }
      return k;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const { rapData, conversationStoreState } = vi.hoisted(() => ({
  rapData: {
    outputs: [] as unknown[],
    presentations: [] as unknown[],
    sheets: [] as unknown[],
    templates: [] as unknown[],
  },
  conversationStoreState: { setWorkspaceContext: vi.fn() },
}));

vi.mock('../useRapData', () => ({
  useArtifactOutputsList: () => ({
    rows: rapData.outputs,
    loading: false,
    error: null,
    moduleDisabled: false,
    refetch: vi.fn(),
  }),
  usePresentations: () => ({
    presentations: rapData.presentations,
    loading: false,
    error: null,
    fetchPresentations: vi.fn(),
    deleteDeck: vi.fn(),
  }),
  useReports: () => ({ reports: [], loading: false, error: null, fetchReports: vi.fn() }),
  useSheetOutputs: () => ({
    rows: rapData.sheets,
    loading: false,
    error: null,
    fetchSheets: vi.fn(),
  }),
  useTemplates: () => ({
    templates: rapData.templates,
    loading: false,
    error: null,
    fetchTemplates: vi.fn(),
  }),
  useRapActions: () => ({}),
}));

// Treść zakładek nie jest przedmiotem tego kontraktu — liczy się pasek.
vi.mock('../OutputsAggregateTabContent', () => ({
  OutputsAggregateTabContent: () => <div data-testid="tab-content-aggregate" />,
}));
vi.mock('../PresentationsTabContent', () => ({
  PresentationsTabContent: () => <div data-testid="tab-content-presentations" />,
}));
vi.mock('../SheetsTabContent', () => ({
  SheetsTabContent: () => <div data-testid="tab-content-sheets" />,
}));
vi.mock('../TemplatesTabContent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../TemplatesTabContent')>()),
  TemplatesTabContent: ({
    templates,
    activeFilters,
  }: {
    templates: Array<{ type: string; scope: string }>;
    activeFilters: Array<{ column: string; value: string }>;
  }) => {
    const visible = templates.filter((template) =>
      activeFilters.every(
        (filter) =>
          (filter.column !== 'type' || template.type === filter.value) &&
          (filter.column !== 'scope' || template.scope === filter.value)
      )
    );
    return <div data-testid="tab-content-templates" data-visible-count={visible.length} />;
  },
}));
vi.mock('../BundleHistoryPanel', () => ({ BundleHistoryPanel: () => null }));
vi.mock('../TemplateProvenanceApprovalDialog', () => ({
  TemplateProvenanceApprovalDialog: () => null,
}));
vi.mock('@/components/shared/CreateFormatModeLauncher', () => ({
  CreateFormatModeLauncher: () => null,
}));
vi.mock('@/components/TemplateBuilder', () => ({
  TemplateBuilderFlow: () => null,
  GovernedTemplateBuilderFlow: () => <div data-testid="governed-template-builder-flow" />,
}));
vi.mock('@/components/AIChat/KimiWorkspace/ExceleParametricTemplates', () => ({
  ExceleParametricTemplates: () => null,
}));
vi.mock('@/components/Presentations/PresentationTemplateArchitectView', () => ({
  PresentationTemplateArchitectView: () => null,
}));

vi.mock('@/utils/templatesGalleryFlag', () => ({ isTemplatesGalleryEnabled: () => true }));
vi.mock('@/utils/deckArchitectFlag', () => ({ isDeckArchitectEnabled: () => true }));
vi.mock('@/services/deliverablesGeneration', () => ({ isDeliverablesLightEnabled: () => false }));
vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: typeof conversationStoreState) => unknown) =>
    selector(conversationStoreState),
}));

import { ReportsAndPresentationsHub } from '../ReportsAndPresentationsHub';

const outputRow = (
  id: string,
  kind: string,
  statusKey: string,
  visibilityScope: string
): Record<string, unknown> => ({
  originRecordId: id,
  id,
  artifactId: `art-${id}`,
  title: `Materiał ${id}`,
  kind,
  statusKey,
  owner: 'Tester',
  updatedAt: '2026-09-01T10:00:00.000Z',
  governance: { visibilityScope, publishState: 'in_review' },
});

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
};

const renderHubAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ReportsAndPresentationsHub />
      <LocationProbe />
    </MemoryRouter>
  );

const menu3Chips = () => screen.queryAllByTestId(/^materials-menu3-chip-/);

beforeEach(() => {
  window.localStorage.clear();
  rapData.outputs = [
    outputRow('d1', 'document', 'draft', 'private'),
    outputRow('d2', 'document', 'ready', 'organization'),
    outputRow('p1', 'presentation', 'ready', 'organization'),
    outputRow('s1', 'sheet', 'draft', 'project'),
  ];
  rapData.presentations = [
    {
      id: 'pres-1',
      artifactId: 'art-pres-1',
      title: 'Prezentacja 1',
      sourceType: 'tool',
      owner: 'Tester',
      status: 'draft',
      updatedAt: '2026-09-01T10:00:00.000Z',
      governance: { visibilityScope: 'organization', publishState: 'in_review' },
    },
    {
      id: 'pres-2',
      artifactId: 'art-pres-2',
      title: 'Prezentacja 2',
      sourceType: 'assessment',
      owner: 'Tester',
      status: 'ready',
      updatedAt: '2026-09-01T10:00:00.000Z',
      governance: { visibilityScope: 'private', publishState: 'approved' },
    },
  ];
  rapData.sheets = [
    outputRow('sh1', 'sheet', 'draft', 'private'),
    outputRow('sh2', 'sheet', 'ready', 'organization'),
  ];
  rapData.templates = [
    {
      id: 'tpl-1',
      title: 'Wzorzec raportu',
      type: 'report',
      category: 'custom',
      scope: 'organization',
      status: 'approved',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'tpl-2',
      title: 'Wzorzec prezentacji',
      type: 'presentation',
      category: 'custom',
      scope: 'personal',
      status: 'draft',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'tpl-3',
      title: 'Wzorzec arkusza systemowego',
      type: 'sheet',
      category: 'system',
      scope: 'system',
      status: 'approved',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'tpl-4',
      title: 'Wzorzec bez źródła',
      type: 'report',
      category: 'custom',
      scope: 'unknown',
      status: 'draft',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
  ];
});

afterEach(() => vi.clearAllMocks());

const TABS: Array<{ nazwa: string; url: string }> = [
  { nazwa: 'Wszystkie', url: '/materials?tab=all' },
  { nazwa: 'Dokumenty', url: '/materials?tab=documents' },
  { nazwa: 'Prezentacje', url: '/materials?tab=presentations' },
  { nazwa: 'Arkusze', url: '/materials?tab=sheets' },
  { nazwa: 'Biblioteka wzorców', url: '/materials?tab=templates' },
];

describe('Materiały — jeden standard Menu 2/3 w 5 zakładkach (DEC-423b/c/d)', () => {
  it.each(TABS)(
    'zakładka $nazwa: zero przycisków „Pokaż robocze"/„Filtry" i DOKŁADNIE jeden rząd Menu 3',
    async ({ url }) => {
      renderHubAt(url);
      await screen.findByTestId('reports-presentations-hub');

      expect(screen.queryByText('Pokaż robocze')).toBeNull();
      expect(screen.queryByText('Filtry')).toBeNull();
      expect(screen.queryByText('Filters')).toBeNull();

      expect(screen.getAllByTestId('materials-menu3-row')).toHaveLength(1);
    }
  );

  it.each(TABS.slice(0, 4))(
    'zakładka $nazwa: DOKŁADNIE dwa dropdowny Menu 2 (Status + Widoczność)',
    async ({ url }) => {
      renderHubAt(url);
      await screen.findByTestId('reports-presentations-hub');

      expect(screen.getAllByTestId('materials-status-dropdown')).toHaveLength(1);
      expect(screen.getAllByTestId('materials-visibility-dropdown')).toHaveLength(1);
    }
  );

  it('dropdown Status niesie pozycję „Robocze" (dawny przycisk „Pokaż robocze")', async () => {
    renderHubAt('/materials?tab=all');
    await screen.findByTestId('reports-presentations-hub');

    const dropdown = screen.getByTestId('materials-status-dropdown');
    fireEvent.click(within(dropdown).getByRole('button'));

    const opcje = within(dropdown)
      .getAllByRole('option')
      .map((el) => el.textContent || '');
    // Etykieta idzie przez t() z angielskim defaultem (J10) — atrapa i18n zwraca default.
    expect(opcje.some((o) => o.includes('Robocze') || o.includes('Draft'))).toBe(true);
  });

  it.each(TABS.slice(1, 4))(
    'zakładka $nazwa: Menu 3 to ≤3 chipy (Wszystkie · Szkic · Gotowy)',
    async ({ url }) => {
      renderHubAt(url);
      await screen.findByTestId('reports-presentations-hub');

      const chipy = menu3Chips();
      expect(chipy.length).toBeGreaterThan(0);
      expect(chipy.length).toBeLessThanOrEqual(3);
      expect(screen.getByTestId('materials-menu3-chip-all')).toBeInTheDocument();
      expect(screen.getByTestId('materials-menu3-chip-draft')).toBeInTheDocument();
    }
  );

  it('TPL-1a v5: Źródło jest dropdownem Menu 2, zawęża listę i zapisuje wybór w URL', async () => {
    renderHubAt('/materials?tab=templates');
    await screen.findByTestId('reports-presentations-hub');

    // Menu 3 zachowuje wyłącznie formaty. Ta asercja jest punktem mutacji:
    // przywrócenie dawnych chipów scope musi dać RED.
    expect(screen.getByTestId('materials-menu3-chip-type-report')).toBeInTheDocument();
    expect(screen.getByTestId('materials-menu3-chip-type-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('materials-menu3-chip-type-presentation')).toBeInTheDocument();
    expect(screen.queryByTestId(/^materials-menu3-chip-scope-/)).toBeNull();
    expect(screen.queryByTestId('materials-menu3-chip-all-scopes')).toBeNull();

    expect(screen.queryByTestId('materials-visibility-dropdown')).toBeNull();
    expect(screen.getByTestId('materials-status-dropdown')).toBeInTheDocument();
    const source = screen.getByTestId('materials-source-dropdown');
    expect(source).toBeInTheDocument();
    expect(screen.getByTestId('materials-provenance-btn')).toBeInTheDocument();

    fireEvent.click(within(source).getByRole('button'));
    const options = within(source).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'All sources4',
      'Personal1',
      'Application1',
      'Organization1',
      'Unknown1',
    ]);
    fireEvent.click(within(source).getByRole('option', { name: /Personal/ }));

    await waitFor(() =>
      expect(screen.getByTestId('tab-content-templates')).toHaveAttribute('data-visible-count', '1')
    );
    await waitFor(() =>
      expect(screen.getByTestId('location-search')).toHaveTextContent(
        '?tab=templates&source=personal'
      )
    );
  });

  it('TPL-1a v5: deep link source odtwarza dropdown i filtrowaną listę', async () => {
    renderHubAt('/materials?tab=templates&source=system');
    await screen.findByTestId('reports-presentations-hub');

    expect(
      within(screen.getByTestId('materials-source-dropdown')).getByRole('button')
    ).toHaveTextContent('Source: Application');
    expect(screen.getByTestId('tab-content-templates')).toHaveAttribute('data-visible-count', '1');
  });

  it('Biblioteka wzorców: pstryczek Galeria|Tabela stoi w Menu 2, nie w treści', async () => {
    renderHubAt('/materials?tab=templates');
    await screen.findByTestId('reports-presentations-hub');

    const pstryczek = screen.getByTestId('templates-gallery-view-toggle');
    expect(pstryczek).toBeInTheDocument();
    expect(screen.getByTestId('templates-gallery-view-toggle-gallery')).toBeInTheDocument();
    expect(screen.getByTestId('templates-gallery-view-toggle-table')).toBeInTheDocument();
    // W Menu 2 (pasek), a nie wewnątrz treści zakładki.
    expect(pstryczek.closest('[data-testid="tab-content-templates"]')).toBeNull();
    // Standardowy segment lista/kafle jest tam wyłączony (jeden pstryczek, nie dwa).
    expect(screen.queryByTestId('view-mode-grid')).toBeNull();
  });

  it('[ODMROZENIE 11_MATERIALS DEC-558] Biblioteka wzorców: CTA otwiera pełny governed builder', async () => {
    renderHubAt('/materials?tab=templates');
    await screen.findByTestId('reports-presentations-hub');

    const cta = screen.getByTestId('outputs-new-btn');
    expect(cta).not.toBeDisabled();
    expect(cta).not.toHaveAttribute('title', 'Template creation lands in wave 2');

    fireEvent.click(cta);
    expect(await screen.findByTestId('governed-template-builder-flow')).toBeInTheDocument();
  });

  it.each(TABS.slice(0, 4))('zakładka $nazwa: CTA NIE jest zamrożony', async ({ url }) => {
    renderHubAt(url);
    await screen.findByTestId('reports-presentations-hub');
    expect(screen.getByTestId('outputs-new-btn')).not.toBeDisabled();
  });

  it('Arkusze: segment „Arkusze | Źródła danych" nie jest renderowany (Fala 2 · 3.17)', async () => {
    renderHubAt('/materials?tab=sheets');
    await screen.findByTestId('reports-presentations-hub');

    expect(screen.queryByTestId('rap-sheets-subtabs')).toBeNull();
    expect(screen.queryByText('Data sources')).toBeNull();
  });
});
