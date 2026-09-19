/**
 * @vitest-environment jsdom
 *
 * list-canon-v2 (Wpis 182 + 183) — IdeasTableContent, paczka (i).
 *
 * Te testy są dowodem WPIĘCIA, nie obecności: renderują PRAWDZIWY
 * `IdeasTableContent` (bez mockowania `StandardTable` — mock fasady byłby
 * testem na lustrze) i asertują ARGUMENTY, jakie komponent oddaje rodzicowi
 * (`MyIdeasListContent`): `onFocusIndexChange(index)`, `onOpenIdea(idea)`,
 * `onToggleSelect(id)`, `onSelectAllVisible()`, `onClearSelection()`,
 * `onDeleteIdea(idea)`, `onTableFilterChange(column, values)`.
 *
 * PRZED (flaga OFF, stan dzisiejszy) i PO (flaga ON, `ff.list_canon_v2.ideas`)
 * muszą dawać rodzicowi TE SAME argumenty — to jest warunek akceptu karty
 * PRZED/PO: zmiana jest wizualna/strukturalna, nie kontraktowa.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeasTableContent, fitTagChips } from '../../../src/components/MyWork/IdeasTableContent';
import type { MyIdea } from '../../../src/components/MyWork/myIdeasTypes';
import { SELECTED_ROW_CLASS } from '../../../src/components/shared/selectionTokens';
import { LIST_CANON_V2_FLAG_KEYS } from '../../../src/config/listCanonV2';
import type {
  ColumnWidths,
  FilterOption,
  TableFilters,
} from '../../../src/components/ui/ResizableTable';

const COLUMN_WIDTHS: ColumnWidths = {
  select: 40,
  title: 560,
  stage: 150,
  tags: 230,
  tool: 190,
  date: 128,
  actions: 56,
};

const IDEAS: MyIdea[] = [
  {
    id: 'idea-1',
    title: 'Ekspansja DE — mapa hipotez',
    body: 'Mapa hipotez wejscia na rynek DE.',
    tags: ['rynek', 'DE'],
    stage: 'shaping',
    preferredTool: 'mindmap',
    createdAt: '2026-06-20T09:00:00Z',
    updatedAt: '2026-07-15T11:20:00Z',
  },
  {
    id: 'idea-2',
    title: 'Automatyzacja raportowania OEE',
    body: 'Dashboard OEE zasilany z hali w czasie rzeczywistym.',
    tags: ['operacje'],
    stage: 'ready',
    preferredTool: 'table',
    createdAt: '2026-06-18T09:00:00Z',
    updatedAt: '2026-07-12T08:00:00Z',
  },
];

const STAGE_OPTIONS: FilterOption[] = [
  { value: 'shaping', label: 'Shaping' },
  { value: 'ready', label: 'Ready' },
];
const TAG_OPTIONS: FilterOption[] = [{ value: 'rynek', label: 'rynek' }];
const TOOL_OPTIONS: FilterOption[] = [{ value: 'mindmap', label: 'Mind map' }];

const IDEAS_CANON_PERSIST_KEY = 'my-work.ideas';

function clearFlagAndFacadeState() {
  window.localStorage.removeItem(LIST_CANON_V2_FLAG_KEYS.localStorageScreen('ideas'));
  window.localStorage.removeItem(LIST_CANON_V2_FLAG_KEYS.localStorage);
  window.localStorage.removeItem(`standardTable.rowDesc.${IDEAS_CANON_PERSIST_KEY}`);
  window.localStorage.removeItem(`filterableTable.cols.${IDEAS_CANON_PERSIST_KEY}`);
  window.localStorage.removeItem('consultify.mywork.ideas.showRowDescription.v1');
  window.sessionStorage.removeItem('consultify.mywork.ideas.previewDismissed.v1');
}

function renderTable(overrides: {
  selectedIds?: Set<string>;
  tableFilters?: TableFilters;
  focusedIndex?: number;
  ideas?: MyIdea[];
}) {
  const spies = {
    onFocusIndexChange: vi.fn(),
    onToggleSelect: vi.fn(),
    onSelectAllVisible: vi.fn(),
    onClearSelection: vi.fn(),
    onOpenIdea: vi.fn(),
    onDeleteIdea: vi.fn(),
    onTableFilterChange: vi.fn(),
    onChangeStage: vi.fn(),
    onToggleFavorite: vi.fn(),
    onStartConvert: vi.fn(),
    onColumnResize: vi.fn(),
    onSort: vi.fn(),
  };
  const selectedIds = overrides.selectedIds ?? new Set<string>();
  const ideas = overrides.ideas ?? IDEAS;
  const utils = render(
    <MemoryRouter initialEntries={['/']}>
      <IdeasTableContent
        ideas={ideas}
        isPolish={false}
        tableFilters={overrides.tableFilters ?? {}}
        availableStageOptions={STAGE_OPTIONS}
        availableTagOptions={TAG_OPTIONS}
        availableToolOptions={TOOL_OPTIONS}
        columnWidths={COLUMN_WIDTHS}
        selectedIds={selectedIds}
        allSelected={selectedIds.size === ideas.length}
        someSelected={selectedIds.size > 0 && selectedIds.size < ideas.length}
        focusedIndex={overrides.focusedIndex ?? -1}
        sortField="date"
        sortDir="desc"
        onSort={spies.onSort}
        onFocusIndexChange={spies.onFocusIndexChange}
        onToggleSelect={spies.onToggleSelect}
        onSelectAllVisible={spies.onSelectAllVisible}
        onClearSelection={spies.onClearSelection}
        onColumnResize={spies.onColumnResize}
        onTableFilterChange={spies.onTableFilterChange}
        onOpenIdea={spies.onOpenIdea}
        isFavorite={(id) => id === 'idea-2'}
        onToggleFavorite={spies.onToggleFavorite}
        onChangeStage={spies.onChangeStage}
        onOpenIdeaInProcessFlow={() => {}}
        onStartConvert={spies.onStartConvert}
        onDeleteIdea={spies.onDeleteIdea}
        onRefresh={() => {}}
      />
    </MemoryRouter>
  );
  return { ...utils, spies };
}

/**
 * Wiersz SZUKANY W TABELI, nie globalnie: w PO kliknięcie wiersza otwiera
 * podgląd, który renderuje ten sam tytuł — `screen.getByText` znalazłby dwa
 * elementy i nie wiadomo byłoby, który jest wierszem.
 */
const getRow = (title: string) => {
  const [table] = screen.getAllByRole('table');
  return within(table).getByText(title).closest('tr') as HTMLTableRowElement;
};

/** Filtry kolumn w kanonie: lejek → checkbox opcji → Apply. */
function applyStageFilter(optionLabel: string) {
  fireEvent.click(screen.getByLabelText('Filter Stage, no filter applied'));
  const panel = screen.getByRole('group', { name: 'Filter by Stage' });
  fireEvent.click(within(panel).getByLabelText(optionLabel));
  fireEvent.click(within(panel).getByText('Apply'));
}

describe('IdeasTableContent — list-canon-v2 PRZED (flaga OFF, bespoke <table>)', () => {
  beforeEach(clearFlagAndFacadeState);
  afterEach(clearFlagAndFacadeState);

  it('renders the bespoke table and none of the canonical header cells', () => {
    const { container } = renderTable({});
    expect(container.querySelector('thead th[data-column-id]')).toBeNull();
    expect(screen.getByTitle('Select visible')).toBeInTheDocument();
  });

  it('row click gives the parent the row index, double-click gives the full entity', () => {
    const { spies } = renderTable({});
    const row = getRow('Automatyzacja raportowania OEE');

    fireEvent.click(row);
    expect(spies.onFocusIndexChange).toHaveBeenCalledWith(1);
    expect(spies.onOpenIdea).not.toHaveBeenCalled();

    fireEvent.doubleClick(row);
    expect(spies.onOpenIdea).toHaveBeenCalledWith(IDEAS[1]);
  });

  it('row checkbox and select-all reach the parent selection callbacks with the id', () => {
    const { spies, container } = renderTable({});
    const row = getRow('Ekspansja DE — mapa hipotez');
    fireEvent.click(within(row).getByRole('checkbox'));
    expect(spies.onToggleSelect).toHaveBeenCalledWith('idea-1');

    fireEvent.click(screen.getByTitle('Select visible'));
    expect(spies.onSelectAllVisible).toHaveBeenCalledTimes(1);
    expect(container).toBeTruthy();
  });

  it('kebab Delete hands the entity to onDeleteIdea', () => {
    const { spies } = renderTable({});
    const row = getRow('Ekspansja DE — mapa hipotez');
    fireEvent.click(within(row).getByRole('button', { name: /row actions/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(spies.onDeleteIdea).toHaveBeenCalledWith(IDEAS[0]);
  });
});

describe('IdeasTableContent — list-canon-v2 PO (flaga ON, kanoniczny StandardTable)', () => {
  beforeEach(() => {
    clearFlagAndFacadeState();
    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorageScreen('ideas'), '1');
  });
  afterEach(clearFlagAndFacadeState);

  it('renders the canonical table (core header cells) instead of the bespoke one', () => {
    const { container } = renderTable({});
    expect(container.querySelector('thead th[data-column-id="title"]')).not.toBeNull();
    expect(container.querySelector('thead th[data-column-id="stage"]')).not.toBeNull();
    expect(screen.queryByTitle('Select visible')).toBeNull();
  });

  it('a row with two tags keeps both chips on ONE line (no wrap → equal row heights)', () => {
    // Odbiór właściciela (Wpis 201): wiersz z dwoma tagami łamał je do drugiej
    // linii i rósł ponad sąsiadów. Gwarancja jednej linii to `flex-nowrap` +
    // `overflow-hidden` na pojemniku chipów. Od Wpis 204 pojemnik niesie też
    // UKRYTĄ warstwę pomiarową (`aria-hidden`, duplikuje etykiety chipów), więc
    // widoczne chipy czytamy z BEZPOŚREDNICH dzieci `span` pudełka, a nie przez
    // `getByText` (złapałby duplikat). W jsdom `clientWidth=0` → guard pokazuje
    // wszystkie chipy (brak „+N"). Mutacja dowodowa: powrót do `flex-wrap` → RED.
    const { container } = renderTable({});
    const tagsBox = container.querySelector('div[title="rynek, DE"]');
    expect(tagsBox).not.toBeNull();
    expect(tagsBox!.className).toContain('flex-nowrap');
    expect(tagsBox!.className).toContain('overflow-hidden');
    expect(tagsBox!.className).not.toContain('flex-wrap');
    const visibleChips = Array.from(
      tagsBox!.querySelectorAll(':scope > span')
    ).map((el) => el.textContent);
    expect(visibleChips).toEqual(['rynek', 'DE']);
  });

  it('row click gives the parent the SAME index argument as PRZED and marks the preview row', () => {
    const { spies } = renderTable({});
    const row = getRow('Automatyzacja raportowania OEE');

    fireEvent.click(row);
    expect(spies.onFocusIndexChange).toHaveBeenCalledWith(1);
    expect(spies.onOpenIdea).not.toHaveBeenCalled();
    expect(getRow('Automatyzacja raportowania OEE').className).toContain(SELECTED_ROW_CLASS);

    fireEvent.doubleClick(row);
    expect(spies.onOpenIdea).toHaveBeenCalledWith(IDEAS[1]);
  });

  it('row checkbox → onToggleSelect(id); header select-all → onSelectAllVisible/onClearSelection', () => {
    const { spies } = renderTable({});
    const row = getRow('Ekspansja DE — mapa hipotez');
    const [selectAll, ...rowBoxes] = screen.getAllByRole('checkbox');

    fireEvent.click(rowBoxes[0]);
    expect(spies.onToggleSelect).toHaveBeenCalledWith('idea-1');

    fireEvent.click(selectAll);
    expect(spies.onSelectAllVisible).toHaveBeenCalledTimes(1);
    expect(row).toBeTruthy();
  });

  it('header select-all with everything selected routes to onClearSelection', () => {
    const { spies } = renderTable({ selectedIds: new Set(['idea-1', 'idea-2']) });
    const [selectAll] = screen.getAllByRole('checkbox');

    fireEvent.click(selectAll);
    expect(spies.onClearSelection).toHaveBeenCalledTimes(1);
    expect(spies.onSelectAllVisible).not.toHaveBeenCalled();
  });

  it('kebab keeps the same sections and hands the entity to onDeleteIdea', () => {
    const { spies } = renderTable({});
    const row = getRow('Ekspansja DE — mapa hipotez');
    fireEvent.click(within(row).getByRole('button', { name: /row actions/i }));

    // `normalizeRowActionSections` zrzuca ETYKIETY sekcji („Convert to") i
    // składa trzy strefy — asertujemy więc pozycje, które realnie istnieją.
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Initiative' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open preview' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(spies.onDeleteIdea).toHaveBeenCalledWith(IDEAS[0]);
  });

  it('right-click opens the core PPM-mirror popover anchored at the cursor', () => {
    renderTable({});
    const row = getRow('Ekspansja DE — mapa hipotez');

    fireEvent.contextMenu(row, { clientX: 120, clientY: 300 });

    const menu = screen.getByRole('menu');
    expect(menu.getAttribute('data-row-actions-menu')).toBe('context');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('column funnel passes the parent contract (columnId, values[]) — not core-internal chips', () => {
    const { spies } = renderTable({});
    applyStageFilter('Ready');
    expect(spies.onTableFilterChange).toHaveBeenCalledWith('stage', ['ready']);
  });

  it('a filter coming from the parent seeds the core funnel and clears through the same callback', () => {
    const { spies } = renderTable({ tableFilters: { stage: ['ready'] } });

    // Czipy renderuje RODZIC (`ModuleNavBar` → `ActiveFilters`), nie fasada —
    // komponent tabeli nie może dokleić drugiego paska.
    expect(screen.queryByText('Filters:')).toBeNull();

    // Stan rodzica musi być widoczny w lejku kanonu (checkbox + licznik).
    fireEvent.click(screen.getByLabelText('Filter Stage (active: 1)'));
    const panel = screen.getByRole('group', { name: 'Filter by Stage' });
    expect(within(panel).getByLabelText('Ready')).toBeChecked();

    fireEvent.click(within(panel).getByText('Clear'));
    fireEvent.click(within(panel).getByText('Apply'));

    expect(spies.onTableFilterChange).toHaveBeenCalledWith('stage', []);
  });

  it('migrates the legacy row-description preference into the facade key once and renders the body', () => {
    renderTable({});
    expect(window.localStorage.getItem(`standardTable.rowDesc.${IDEAS_CANON_PERSIST_KEY}`)).toBe(
      '1'
    );
    expect(screen.getAllByText('Mapa hipotez wejscia na rynek DE.').length).toBeGreaterThan(0);
  });

  it('does not overwrite a row-description choice the user already made in the facade', () => {
    window.localStorage.setItem(`standardTable.rowDesc.${IDEAS_CANON_PERSIST_KEY}`, '0');
    renderTable({});
    expect(window.localStorage.getItem(`standardTable.rowDesc.${IDEAS_CANON_PERSIST_KEY}`)).toBe(
      '0'
    );
  });

  it('stage cell change hands the entity and the new stage to onChangeStage', () => {
    const { spies } = renderTable({});
    const row = getRow('Ekspansja DE — mapa hipotez');

    // `IdeaStageSelectCell` to odznaka z przezroczystym natywnym `<select>`
    // na wierzchu — nie button+popup, więc zmiana idzie przez `change`.
    const select = within(row).getByTestId('idea-stage-select') as HTMLSelectElement;
    expect(select.value).toBe('shaping');
    fireEvent.change(select, { target: { value: 'ready' } });

    expect(spies.onChangeStage).toHaveBeenCalledWith(IDEAS[0], 'ready');
  });

  it('star toggle hands the idea id to onToggleFavorite', () => {
    const { spies } = renderTable({});
    const row = getRow('Ekspansja DE — mapa hipotez');

    fireEvent.click(within(row).getByRole('button', { name: 'Star' }));
    expect(spies.onToggleFavorite).toHaveBeenCalledWith('idea-1');
  });

  it('dismissed preview shows "Show panel" above the table and clicking it restores the preview', () => {
    window.sessionStorage.setItem('consultify.mywork.ideas.previewDismissed.v1', 'true');
    const { spies } = renderTable({});

    const showPanel = screen.getByRole('button', { name: 'Show panel' });
    fireEvent.click(showPanel);

    expect(screen.queryByRole('button', { name: 'Show panel' })).toBeNull();
    expect(getRow(IDEAS[0].title).className).toContain(SELECTED_ROW_CLASS);
    expect(spies.onFocusIndexChange).not.toHaveBeenCalled();
  });

  it('a dismissed preview is not reopened by a plain row click, but focus still reaches the parent', () => {
    window.sessionStorage.setItem('consultify.mywork.ideas.previewDismissed.v1', 'true');
    const { spies } = renderTable({});
    const row = getRow('Ekspansja DE — mapa hipotez');

    fireEvent.click(row);

    expect(spies.onFocusIndexChange).toHaveBeenCalledWith(0);
    expect(row.className).not.toContain(SELECTED_ROW_CLASS);
  });
});

describe('fitTagChips — pure overflow helper (Wpis 204 method b)', () => {
  const GAP = 4;

  it('returns every chip when they all fit (no "+N")', () => {
    // 64 + 96 + one gap = 164 ≤ 200
    expect(fitTagChips([64, 96], 28, 200, GAP)).toBe(2);
  });

  it('returns the largest whole-chip count that still leaves room for "+N"', () => {
    // chip0 + gap + plus = 64 + 4 + 28 = 96 ≤ 145, but both chips = 164 > 145
    expect(fitTagChips([64, 96], 28, 145, GAP)).toBe(1);
  });

  it('returns 0 when even the first chip + "+N" does not fit', () => {
    expect(fitTagChips([64, 96], 28, 60, GAP)).toBe(0);
  });

  it('keeps a single long chip (never slices it, "+N" would be pointless)', () => {
    // n=1: all-fits check 67 ≤ 145 → 1; the loop only runs to n-1 so a lone chip
    // is never replaced by "+1".
    expect(fitTagChips([67], 28, 145, GAP)).toBe(1);
  });

  it('returns 0 for an empty tag list', () => {
    expect(fitTagChips([], 28, 145, GAP)).toBe(0);
  });

  it('shows everything when the box is unmeasured (avail<=0, jsdom guard)', () => {
    expect(fitTagChips([64, 96, 120], 28, 0, GAP)).toBe(3);
  });
});

describe('IdeasTagChips — overflow wiring (canon-v2, flaga ON)', () => {
  beforeEach(() => {
    clearFlagAndFacadeState();
    window.localStorage.setItem(LIST_CANON_V2_FLAG_KEYS.localStorageScreen('ideas'), '1');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearFlagAndFacadeState();
  });

  it('collapses an overflowing Tags cell to whole chips + "+N", never a sliced chip', () => {
    // Wymuszamy przepełnienie: pudełko 230 px, chip = 10 px/znak. Trzy tagi
    // (80 + 130 + 70 + 2×4 = 288) nie mieszczą się; mieści się tylko pierwszy
    // chip + „+2" (80 + 4 + 20 = 104 ≤ 230), drugi już nie (210 + 8 + 20 = 238).
    // Dowód WPIĘCIA: IdeasTagChips naprawdę woła fitTagChips i renderuje „+N".
    // Mutacja: `return n` w fitTagChips (zawsze wszystko) → brak „+2" → RED.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(230);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return (this.textContent || '').length * 10;
    });

    const wideIdea: MyIdea = {
      id: 'idea-wide',
      title: 'Szeroki wiersz tagów',
      body: 'Trzy długie tagi, które nie mieszczą się w kolumnie.',
      tags: ['operacje', 'automatyzacja', 'raporty'],
      stage: 'ready',
      preferredTool: 'table',
      createdAt: '2026-06-18T09:00:00Z',
      updatedAt: '2026-07-12T08:00:00Z',
    };

    const { container } = renderTable({ ideas: [wideIdea] });
    const tagsBox = container.querySelector('div[title="operacje, automatyzacja, raporty"]');
    expect(tagsBox).not.toBeNull();

    const visibleChips = Array.from(tagsBox!.querySelectorAll(':scope > span')).map(
      (el) => el.textContent
    );
    expect(visibleChips).toEqual(['operacje', '+2']);
  });
});
