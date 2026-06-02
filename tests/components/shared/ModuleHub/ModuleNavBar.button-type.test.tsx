/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModuleNavBar } from '../../../../src/components/shared/ModuleHub/ModuleNavBar';
import type { TabConfig } from '../../../../src/components/shared/ModuleHub/types';

const tabs: TabConfig[] = [{ id: 'initiatives', label: 'Initiatives' }];

describe('ModuleNavBar button safety', () => {
  it('uses explicit type=button for toolbar buttons', () => {
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
          onNewItem={vi.fn()}
          availableViewModes={['table', 'grid']}
        />
      </form>
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button');
    }
  });
});
