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
 * Biblioteka wzorców jest świadomym wyjątkiem od „dwóch dropdownów": jej
 * wymiarem widoczności jest `scope` (Osobisty/System/Organizacja/Nieznany), a
 * ten — decyzją właściciela („ten cały pasek powinien wjechać do menu
 * trzeciego") — mieszka w Menu 3 razem z formatami. Drugi dropdown o tym samym
 * znaczeniu byłby dubletem, więc zakładka ma Status + Pochodzenie i prawa.
 *
 * MUTACJE (zmierzone ręcznie 06.09.2026 przy tym dyżurze — patrz meldunek):
 *  1. przywrócenie przycisku „Pokaż robocze" w `rightControls`
 *     → „zero przycisków Pokaż robocze/Filtry" na CZERWONO (5 zakładek),
 *  2. zdjęcie `disabled` z CTA „Nowy wzorzec"
 *     → „Biblioteka: CTA zamrożony" na CZERWONO.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: unknown) => {
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
  TemplatesTabContent: () => <div data-testid="tab-content-templates" />,
}));
vi.mock('../BundleHistoryPanel', () => ({ BundleHistoryPanel: () => null }));
vi.mock('../TemplateProvenanceApprovalDialog', () => ({
  TemplateProvenanceApprovalDialog: () => null,
}));
vi.mock('@/components/shared/CreateFormatModeLauncher', () => ({
  CreateFormatModeLauncher: () => null,
}));
vi.mock('@/components/TemplateBuilder', () => ({ TemplateBuilderFlow: () => null }));
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

const renderHubAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ReportsAndPresentationsHub />
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
    expect(opcje.some((o) => o.includes('Robocze'))).toBe(true);
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

  it('Biblioteka wzorców: Menu 3 = formaty + źródła, Menu 2 bez dropdownu Widoczność', async () => {
    renderHubAt('/materials?tab=templates');
    await screen.findByTestId('reports-presentations-hub');

    // Formaty
    expect(screen.getByTestId('materials-menu3-chip-type-report')).toBeInTheDocument();
    expect(screen.getByTestId('materials-menu3-chip-type-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('materials-menu3-chip-type-presentation')).toBeInTheDocument();
    // Źródła
    expect(screen.getByTestId('materials-menu3-chip-scope-personal')).toBeInTheDocument();
    expect(screen.getByTestId('materials-menu3-chip-scope-system')).toBeInTheDocument();
    expect(screen.getByTestId('materials-menu3-chip-scope-organization')).toBeInTheDocument();
    expect(screen.getByTestId('materials-menu3-chip-scope-unknown')).toBeInTheDocument();

    // Widoczność wzorca = źródło, a to stoi w Menu 3 → brak drugiego dropdownu.
    expect(screen.queryByTestId('materials-visibility-dropdown')).toBeNull();
    expect(screen.getByTestId('materials-status-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('materials-provenance-btn')).toBeInTheDocument();
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

  it('Biblioteka wzorców: CTA „Nowy wzorzec" jest ZAMROŻONY (disabled + powód)', async () => {
    renderHubAt('/materials?tab=templates');
    await screen.findByTestId('reports-presentations-hub');

    const cta = screen.getByTestId('outputs-new-btn');
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute('title', 'Tworzenie wzorców w fali 2');
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
