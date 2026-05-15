/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ModuleNavBar } from '../../../../src/components/shared/ModuleHub/ModuleNavBar';
import type { TabConfig } from '../../../../src/components/shared/ModuleHub/types';

const tabs: TabConfig[] = [{ id: 'initiatives', label: 'Initiatives' }];

describe('ModuleNavBar search accessibility', () => {
  it('announces expanded search state and links control to textbox', async () => {
    const user = userEvent.setup();
    render(
      <form>
        <ModuleNavBar
          tabs={tabs}
          activeTab="initiatives"
          onTabChange={vi.fn()}
          viewMode="table"
          onViewModeChange={vi.fn()}
          onSearch={vi.fn()}
          openDocuments={[]}
          activeDocumentId={null}
          onSelectDocument={vi.fn()}
          onCloseDocument={vi.fn()}
          onShowList={vi.fn()}
          activeFilters={[]}
          onRemoveFilter={vi.fn()}
          onClearFilters={vi.fn()}
          availableViewModes={['table', 'grid']}
        />
      </form>
    );

    const searchToggle = screen.getByRole('button', { name: 'Search' });
    expect(searchToggle).toHaveAttribute('aria-expanded', 'false');
    expect(searchToggle).not.toHaveAttribute('aria-controls');

    await user.click(searchToggle);

    expect(searchToggle).toHaveAttribute('aria-expanded', 'true');
    expect(searchToggle).toHaveAttribute('aria-controls', 'modulehub-command-search');
    const searchInput = screen.getByRole('textbox', { name: 'Search' });
    expect(searchInput).toHaveAttribute('id', 'modulehub-command-search');

    const tablist = screen.getByRole('tablist', { name: 'Module sections' });
    expect(tablist).toBeInTheDocument();
    const roleTabs = screen.getAllByRole('tab');
    expect(roleTabs).toHaveLength(1);
    expect(roleTabs[0]).toHaveAttribute('aria-selected', 'true');
  });
});
