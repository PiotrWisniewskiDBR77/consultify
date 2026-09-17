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

    expect(row).toHaveClass('flex-wrap', 'min-[1360px]:flex-nowrap');
    expect(left).toHaveClass('basis-full', 'min-[1360px]:basis-auto');
    expect(right).toHaveClass('basis-full', 'flex-wrap', 'min-[1360px]:flex-nowrap');
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
