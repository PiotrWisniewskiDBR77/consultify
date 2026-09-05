/**
 * @vitest-environment jsdom
 *
 * Uwaga właściciela (05.09, verbatim, na tabeli Pomysłów w Moja Praca):
 * "mam tylko wielki problem z tym panelem prawym bo on powinien być zamykany
 * jak nie jest potrzebny — a teraz nie mogę go zamknąć".
 *
 * Pomiar na żywo (localhost:3000/my-work/ideas) pokazał, że klik na X w
 * nagłówku `PreviewPaneShell` FAKTYCZNIE zamykał podgląd — ale
 * `IdeasTableContent`'s <tr onClick> bezwarunkowo wołał `setPreviewIdeaId`,
 * więc każdy kolejny klik w DOWOLNY wiersz (w tym ten sam, ponownie
 * zaznaczony) natychmiast otwierał panel z powrotem. Z perspektywy
 * przeglądania tabeli panel nigdy realnie nie zostawał zamknięty.
 *
 * Kontrakt po naprawie:
 *  - klik na X chowa panel,
 *  - zaznaczenie (klik) INNEGO wiersza NIE otwiera panelu z powrotem,
 *  - przycisk "Show panel" (widoczny tylko gdy panel jest świadomie
 *    zamknięty) przywraca normalne działanie (klik w wiersz znowu otwiera
 *    podgląd).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The preview pane is wrapped in framer-motion's <AnimatePresence> — closing
// it starts an exit transition, so the outgoing panel briefly stays mounted
// (opacity animating to 0) after the click that triggers the close. Assert
// absence with `waitFor` instead of a synchronous query so the test reflects
// the real (post-animation) end state instead of racing the transition.
const expectClosed = () =>
  waitFor(() => expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument());
const expectOpen = () =>
  waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument());

import { IdeasTableContent } from '../../../src/components/MyWork/IdeasTableContent';
import type { MyIdea } from '../../../src/components/MyWork/myIdeasTypes';
import type { ColumnWidths, FilterOption, TableFilters } from '../../../src/components/ui/ResizableTable';
import { resetJedenPanelForTests } from '../../../src/components/shared/PreviewPane/useJedenPanel';

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

const STAGE_OPTIONS: FilterOption[] = [{ value: 'spark', label: 'Iskra' }];
const TAG_OPTIONS: FilterOption[] = [{ value: 'rynek', label: 'rynek' }];
const TOOL_OPTIONS: FilterOption[] = [{ value: 'mindmap', label: 'Mapa rekomendacji' }];

function renderTable() {
  const tableFilters: TableFilters = {};
  return render(
    <MemoryRouter initialEntries={['/']}>
      <IdeasTableContent
        ideas={IDEAS}
        isPolish={false}
        tableFilters={tableFilters}
        availableStageOptions={STAGE_OPTIONS}
        availableTagOptions={TAG_OPTIONS}
        availableToolOptions={TOOL_OPTIONS}
        columnWidths={COLUMN_WIDTHS}
        selectedIds={new Set()}
        allSelected={false}
        someSelected={false}
        focusedIndex={-1}
        sortField="date"
        sortDir="desc"
        onSort={() => {}}
        onFocusIndexChange={() => {}}
        onToggleSelect={() => {}}
        onSelectAllVisible={() => {}}
        onClearSelection={() => {}}
        onColumnResize={() => {}}
        onTableFilterChange={() => {}}
        onOpenIdea={() => {}}
        onOpenIdeaInProcessFlow={() => {}}
        onStartConvert={() => {}}
        onDeleteIdea={() => {}}
        onRefresh={() => {}}
      />
    </MemoryRouter>
  );
}

const getRow = (title: string) => screen.getByText(title).closest('tr') as HTMLTableRowElement;

describe('IdeasTableContent — right preview panel can actually be closed (owner feedback 05.09)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.removeItem('consultify.listPanel.root.closed');
    resetJedenPanelForTests();
  });
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('opens the panel on row click and closes it on the header X — panel gone from the DOM', async () => {
    renderTable();
    fireEvent.click(getRow('Ekspansja DE — mapa hipotez'));
    await expectOpen();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await expectClosed();
  });

  it('selecting a different row after closing does NOT reopen the panel', async () => {
    renderTable();
    fireEvent.click(getRow('Ekspansja DE — mapa hipotez'));
    await expectOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await expectClosed();

    fireEvent.click(getRow('Automatyzacja raportowania OEE'));
    await expectClosed();

    // Nor does re-clicking the very row that was open when it got closed.
    fireEvent.click(getRow('Ekspansja DE — mapa hipotez'));
    await expectClosed();
  });

  it('persists the closed state in sessionStorage and restores it on remount', async () => {
    const { unmount } = renderTable();
    fireEvent.click(getRow('Ekspansja DE — mapa hipotez'));
    await expectOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await expectClosed();
    expect(window.sessionStorage.getItem('consultify.mywork.ideas.previewDismissed.v1')).toBe(
      'true'
    );
    unmount();

    renderTable();
    fireEvent.click(getRow('Automatyzacja raportowania OEE'));
    await expectClosed();
  });

  it('"Show panel" affordance reopens the panel and un-sticks the closed state', async () => {
    renderTable();
    fireEvent.click(getRow('Ekspansja DE — mapa hipotez'));
    await expectOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await expectClosed();

    const showPanelButton = screen.getByRole('button', { name: 'Show panel' });
    fireEvent.click(showPanelButton);

    // Reopens (falls back to the first row when nothing is focused) and the
    // closed flag is lifted — the contract owner asked for ("Pokaż panel"
    // restores normal single-click-opens behaviour, not just a one-off peek).
    await expectOpen();
    expect(window.sessionStorage.getItem('consultify.mywork.ideas.previewDismissed.v1')).toBe(
      'false'
    );
  });

  it('the kebab "Open preview" action always opens the panel and clears the closed state', async () => {
    renderTable();
    fireEvent.click(getRow('Ekspansja DE — mapa hipotez'));
    await expectOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await expectClosed();

    const row = getRow('Automatyzacja raportowania OEE');
    fireEvent.contextMenu(row, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open preview' }));

    await expectOpen();
  });
});
