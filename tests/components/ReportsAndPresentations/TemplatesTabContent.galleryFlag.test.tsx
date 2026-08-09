/**
 * @vitest-environment jsdom
 *
 * N4 (noc 2026-07-27/28): Galeria ↔ Tabela toggle behind `ff_galeria_szablonow`
 * (default OFF, src/utils/templatesGalleryFlag.ts). Port of the accepted
 * prototype `proto/galeria-szablonow` into the real "Szablony" tab.
 *
 * Flag is mocked directly (not via `window.location.search`) — mirrors the
 * established pattern for `deckArchitectFlag`/`workbookTemplatesFlag` in
 * `ReportsAndPresentationsHub.test.tsx`. Manipulating the query string
 * doesn't work under this repo's global `tests/setup.ts`: it freezes
 * `window.location` to a static snapshot object at setup time (stubs
 * assign/replace/reload), so `history.pushState` never becomes visible via
 * `window.location.search` inside a test.
 *
 * Covers the 5 acceptance checks from the task brief:
 *  (a) flag OFF  → today's StandardTable, byte-identical, no toggle.
 *  (b) flag ON   → gallery renders, tile count === template count.
 *  (c) toggle Galeria→Tabela renders the real StandardTable.
 *  (d) an orphaned template's tile has its primary action disabled with a reason.
 *  (e) the format chip narrows the tile set.
 */
import React, { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplatesTabContent } from '../../../src/components/ReportsAndPresentations/TemplatesTabContent';
import type { TemplateItem } from '../../../src/components/ReportsAndPresentations/types';
import type { FilterChip } from '../../../src/components/shared/ModuleHub';
import { isTemplatesGalleryEnabled } from '../../../src/utils/templatesGalleryFlag';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (_k: string, fallback?: string) => fallback || _k,
      i18n: { language: 'pl' },
    }),
  };
});

const navigateSpy = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/utils/templatesGalleryFlag', () => ({
  isTemplatesGalleryEnabled: vi.fn(() => false),
}));

const mockFlag = vi.mocked(isTemplatesGalleryEnabled);

beforeEach(() => {
  mockFlag.mockReset();
  navigateSpy.mockClear();
});

const TEMPLATES: TemplateItem[] = [
  {
    id: 'tpl-deprecated-1',
    artifactIndexId: 'tpl-deprecated-1',
    canonicalTemplateId: 'canon-deprecated-1',
    title: 'Wycofany raport zarządczy',
    description: 'Historyczny wzorzec, którego nie wolno używać.',
    type: 'report',
    category: 'custom',
    scope: 'organization',
    status: 'deprecated',
    updatedAt: '2026-08-07T00:30:00.000Z',
    createdBy: 'QA',
    sectionCount: 4,
  },
  {
    id: 'tpl-report-1',
    artifactIndexId: 'tpl-report-1',
    canonicalTemplateId: 'canon-report-1',
    title: 'Raport diagnostyczny DRD',
    description: 'Pełna diagnoza dojrzałości organizacji.',
    type: 'report',
    category: 'R1',
    scope: 'system',
    status: 'published',
    updatedAt: '2026-07-18T09:30:00.000Z',
    createdBy: 'Zespół DRD',
    sectionCount: 5,
  },
  {
    id: 'tpl-deck-1',
    artifactIndexId: 'tpl-deck-1',
    canonicalTemplateId: 'canon-deck-1',
    title: 'Deck dla komitetu sterującego',
    description: 'Comiesięczny status portfela.',
    type: 'presentation',
    category: 'R2',
    scope: 'system',
    status: 'published',
    updatedAt: '2026-07-24T13:05:00.000Z',
    createdBy: 'Zespół DRD',
    slideCount: 8,
  },
  {
    id: 'tpl-sheet-1',
    artifactIndexId: 'tpl-sheet-1',
    canonicalTemplateId: 'canon-sheet-1',
    title: 'Model budżetu operacyjnego',
    description: 'Budżet 12-miesięczny.',
    type: 'sheet',
    category: 'custom',
    scope: 'organization',
    status: 'published',
    updatedAt: '2026-07-20T07:55:00.000Z',
    createdBy: 'Zespół DRD',
  },
  {
    id: 'tpl-orphan-1',
    artifactIndexId: 'tpl-orphan-1',
    canonicalTemplateId: null,
    orphaned: true,
    title: 'Raport zamknięcia fazy',
    description: 'Wzorzec bez rekordu źródłowego.',
    type: 'report',
    category: 'custom',
    scope: 'organization',
    status: 'unknown',
    updatedAt: null,
    createdBy: 'Anna Kowalska',
    sectionCount: 3,
  },
];

// Mirrors how the real parent (ReportsAndPresentationsHub) owns
// `activeFilters` via useState and passes it down as a controlled prop —
// TemplatesTabContent itself holds no filter state.
function TabHarness() {
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  return (
    <TemplatesTabContent
      viewMode="table"
      searchQuery=""
      activeFilters={activeFilters}
      onFilterChange={setActiveFilters}
      templates={TEMPLATES}
      loading={false}
      error={null}
      onRefresh={() => {}}
    />
  );
}

function renderTab() {
  return render(<TabHarness />);
}

describe('TemplatesTabContent — Galeria ↔ Tabela (ff_galeria_szablonow)', () => {
  it('(a) flag OFF: renders the plain StandardTable, no gallery toggle', () => {
    mockFlag.mockReturnValue(false);
    renderTab();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByTestId('templates-gallery-view-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-gallery-filters')).not.toBeInTheDocument();
    for (const tpl of TEMPLATES) {
      expect(screen.queryByTestId(`template-gallery-tile-${tpl.id}`)).not.toBeInTheDocument();
    }
  });

  it('(b) flag ON: gallery is the default sub-view, tile count === template count', () => {
    mockFlag.mockReturnValue(true);
    renderTab();

    expect(screen.getByTestId('templates-gallery-view-toggle')).toBeInTheDocument();
    for (const tpl of TEMPLATES) {
      expect(screen.getByTestId(`template-gallery-tile-${tpl.id}`)).toBeInTheDocument();
    }
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('(c) toggling to "Tabela" renders the real StandardTable', async () => {
    mockFlag.mockReturnValue(true);
    renderTab();
    const user = userEvent.setup();

    await user.click(screen.getByTestId('templates-gallery-view-toggle-table'));

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByTestId('template-gallery-filters')).not.toBeInTheDocument();
  });

  it('(d) an orphaned template tile has its "Użyj wzorca" action disabled with a reason', () => {
    mockFlag.mockReturnValue(true);
    renderTab();

    const disabledCta = screen.getByTestId('template-gallery-use-disabled-tpl-orphan-1');
    expect(disabledCta).toBeDisabled();
    const tile = screen.getByTestId('template-gallery-tile-tpl-orphan-1');
    expect(within(tile).getByText(/Brak kanonicznego rekordu wzorca/i)).toBeInTheDocument();
    expect(within(tile).getByTestId('template-gallery-orphaned-badge')).toBeInTheDocument();

    // Non-orphaned tiles keep an ENABLED primary action.
    expect(screen.getByTestId('template-gallery-use-tpl-report-1')).not.toBeDisabled();
  });

  it('(e) the "Prezentacje" format chip narrows the tile set to presentations only', async () => {
    mockFlag.mockReturnValue(true);
    renderTab();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Prezentacje/ }));

    expect(screen.getByTestId('template-gallery-tile-tpl-deck-1')).toBeInTheDocument();
    expect(screen.queryByTestId('template-gallery-tile-tpl-report-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-gallery-tile-tpl-sheet-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-gallery-tile-tpl-orphan-1')).not.toBeInTheDocument();
  });

  it('(f) a deprecated canonical template cannot be used from the gallery', () => {
    mockFlag.mockReturnValue(true);
    renderTab();

    const tile = screen.getByTestId('template-gallery-tile-tpl-deprecated-1');
    expect(within(tile).getByTestId('template-gallery-use-disabled-tpl-deprecated-1')).toBeDisabled();
    expect(within(tile).getByText(/Wycofany wzorzec nie może być użyty/i)).toBeInTheDocument();
  });
});
