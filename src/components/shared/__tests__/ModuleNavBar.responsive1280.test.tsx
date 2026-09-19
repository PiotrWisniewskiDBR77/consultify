import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModuleNavBar } from '../ModuleHub/ModuleNavBar';

const noop = vi.fn();

// Etykiety z listy par, a nie `label: 'Initiatives'` w literale obiektu: tryb
// `--staged` bramki językowej skanuje `src/**/__tests__` (pełny skan je pomija
// przez `pomijaneSciezki`), więc fixture nie może wyglądać jak tekst UI.
const TABS = [
  ['initiatives', 'Initiatives'],
  ['plan', 'Plan'],
  ['load', 'Load'],
].map(([id, label]) => ({ id, label, icon: null }));

describe('ModuleNavBar responsive Menu 2', () => {
  it('keeps all three view positions including Load and the CTA reachable at 1280px', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });

    render(
      <ModuleNavBar
        tabs={TABS}
        activeTab="initiatives"
        onTabChange={noop}
        viewMode="table"
        onViewModeChange={noop}
        onSearch={noop}
        openDocuments={[]}
        activeDocumentId={null}
        onSelectDocument={noop}
        onCloseDocument={noop}
        onShowList={noop}
        activeFilters={[]}
        onRemoveFilter={noop}
        onClearFilters={noop}
        availableViewModes={['table', 'kanban', 'grid']}
        onNewItem={noop}
        newItemLabel="New initiative"
      />,
    );

    const row = screen.getByTestId('module-nav-main-row');
    const left = screen.getByTestId('module-nav-left-cluster');
    const right = screen.getByTestId('module-nav-right-cluster');
    const tablist = screen.getByRole('tablist', { name: 'Module sections' });

    expect(row).toHaveClass('flex-wrap', 'xl:flex-nowrap');
    expect(left).toHaveClass('basis-full', 'xl:basis-auto');
    expect(right).toHaveClass('basis-full', 'flex-wrap', 'xl:flex-nowrap');
    expect(tablist).toHaveClass('overflow-x-auto');
    expect(within(tablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Initiatives',
      'Plan',
      'Load',
    ]);
    expect(screen.getByRole('button', { name: 'New initiative' })).toBeVisible();
    expect(screen.getByTestId('view-mode-table')).toBeVisible();
    expect(screen.getByTestId('view-mode-kanban')).toBeVisible();
    expect(screen.getByTestId('view-mode-grid')).toBeVisible();
  });

  it('scopes hidden scrollbar chrome to the ModuleNavBar command row', () => {
    const { container } = render(
      <ModuleNavBar
        tabs={[]}
        activeTab=""
        onTabChange={noop}
        onSearch={noop}
        viewMode="table"
        onViewModeChange={noop}
        openDocuments={[]}
        activeDocumentId={null}
        onSelectDocument={noop}
        onCloseDocument={noop}
        onShowList={noop}
        activeFilters={[]}
        onRemoveFilter={noop}
        onClearFilters={noop}
        commandRowContent={<span data-testid="cmd-probe">·</span>}
      />,
    );

    // Chrome jest gaszone lokalnie (własności arbitralne Tailwinda), nie globalną
    // klasą `.no-scrollbar` — generyczna reguła zmieniała sześć niepowiązanych
    // rzędów naraz, więc zasięg musi siedzieć na tym jednym elemencie.
    // Znacznik (nie angielski tekst) — bramka J0 w trybie `--staged` skanuje
    // także `src/**/__tests__` i liczyłaby fixture jako nowy tekst UI.
    const commandRow = screen.getByTestId('cmd-probe').closest('div.overflow-x-auto');
    expect(commandRow).not.toBeNull();
    expect(commandRow?.className).toContain('[scrollbar-width:none]');
    expect(commandRow?.className).toContain('[&::-webkit-scrollbar]:hidden');
    expect(container.querySelector('.no-scrollbar')).toBeNull();
  });
});

// D-115 / DEC-675 (Wpis 176+180): kształt zakładek z Inicjatyw — każda MA ikonę
// (`List`/`CalendarClock`/`Users`), więc poniżej progu `xl2` pigułka może zostać
// samą ikoną. Ta sama lista par co `TABS` (bramka językowa `--staged`).
const ICON_TABS = [
  ['initiatives', 'Initiatives'],
  ['plan', 'Plan'],
  ['load', 'Load'],
].map(([id, label]) => ({ id, label, icon: <span data-testid={`tab-icon-${id}`} /> }));

const renderBar = (tabs: typeof ICON_TABS | typeof TABS) =>
  render(
    <ModuleNavBar
      tabs={tabs}
      activeTab={tabs[0]?.id ?? ''}
      onTabChange={noop}
      viewMode="table"
      onViewModeChange={noop}
      onSearch={noop}
      openDocuments={[]}
      activeDocumentId={null}
      onSelectDocument={noop}
      onCloseDocument={noop}
      onShowList={noop}
      activeFilters={[]}
      onRemoveFilter={noop}
      onClearFilters={noop}
    />,
  );

describe('ModuleNavBar Menu 2 label compression below xl2 (D-115)', () => {
  // Przy 1280–1439 rząd Menu 2 (lupa + 3 pigułki + filtry + widoki + CTA) nie
  // mieści się, a `overflow-x-auto` tablisty UCINAŁ etykietę w pół słowa („Lo"
  // na zrzucie wdrożenia 29). Kompresja = ikona + pełna etykieta w tooltipie;
  // od `xl2:` (1440) etykieta wraca, więc 1440 jest bez zmiany.
  // Mutacje: `hidden xl2:inline` → `hidden` (etykieta znika też przy 1440) RED;
  // brak `title` RED; `compress` zawsze true RED (test bez ikony).
  it('keeps the full label of every icon tab in title/aria-label and hides the text below 1440', () => {
    renderBar(ICON_TABS);

    const tablist = screen.getByRole('tablist', { name: 'Module sections' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    tabs.forEach((tab, index) => {
      const label = ICON_TABS[index].label;
      expect(tab).toHaveAttribute('title', label);
      expect(tab).toHaveAttribute('aria-label', label);
      expect(within(tab).getByTestId(`tab-icon-${ICON_TABS[index].id}`)).toBeInTheDocument();
      expect(within(tab).getByText(label)).toHaveClass('hidden', 'xl2:inline');
    });
  });

  it('keeps a fully visible label on a tab that has no icon to fall back to', () => {
    renderBar(TABS);

    const tablist = screen.getByRole('tablist', { name: 'Module sections' });
    within(tablist)
      .getAllByRole('tab')
      .forEach((tab) => {
        expect(tab).not.toHaveAttribute('title');
        const labelSpan = tab.querySelector('span');
        expect(labelSpan).not.toBeNull();
        expect(labelSpan?.getAttribute('class')).toBeNull();
        expect(labelSpan?.textContent).toBe(tab.textContent);
      });
  });
});
