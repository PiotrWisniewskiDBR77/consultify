import fs from 'node:fs';
import path from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModuleNavBar } from '../ModuleHub/ModuleNavBar';

const noop = vi.fn();

describe('ModuleNavBar responsive Menu 2', () => {
  it('keeps all three view positions including Load and the CTA reachable at 1280px', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });

    render(
      <ModuleNavBar
        tabs={[
          { id: 'initiatives', label: 'Initiatives', icon: null },
          { id: 'plan', label: 'Plan', icon: null },
          { id: 'load', label: 'Load', icon: null },
        ]}
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
      />
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

  it('defines one cross-browser no-scrollbar utility for all seven current consumers', () => {
    const repoRoot = path.resolve(__dirname, '../../../..');
    const css = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');
    const sourceFiles = [
      'src/components/Initiatives/InitiativesHub.tsx',
      'src/components/MyWork/MyWorkHub.tsx',
      'src/components/assessment/AssessmentMenu3ActionBar.tsx',
      'src/components/shared/BulkSelectionCluster.tsx',
      'src/components/shared/ModuleHub/ModuleNavBar.tsx',
      'src/components/shared/ModuleMenu3.tsx',
    ];
    const uses = sourceFiles.reduce((count, file) => {
      const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      return count + (source.match(/\bno-scrollbar\b/g) ?? []).length;
    }, 0);

    expect(uses).toBe(7);
    expect(css.match(/^\.no-scrollbar\s*\{/gm)).toHaveLength(1);
    expect(css).toMatch(/\.no-scrollbar\s*\{[^}]*scrollbar-width:\s*none;/s);
    expect(css).toMatch(/\.no-scrollbar::\-webkit-scrollbar\s*\{[^}]*display:\s*none;/s);
  });
});
