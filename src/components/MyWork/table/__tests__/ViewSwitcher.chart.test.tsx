/**
 * @vitest-environment jsdom
 *
 * ViewSwitcher — chart view type (tp-views-finish task 2).
 *
 * Chart (ChartBlock/ChartConfigPanel) previously existed only in the orphaned
 * `views/` module's ViewRouter, unreachable from the live P15 ViewRouter /
 * ViewSwitcher used by the Table Platform. This pins that the live saved-view
 * switcher now offers "Chart" as a creatable/listed view type, alongside the
 * pre-existing grid/kanban/calendar/timeline/gallery/form types.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { TablePlatformView } from '@/types/tablePlatform';

import { ViewSwitcher } from '../ViewSwitcher';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('../ShareViewDialog', () => ({
  ShareViewDialog: () => null,
}));

function makeView(id: string, name: string, viewType: TablePlatformView['viewType']): TablePlatformView {
  return {
    id,
    tableId: 't1',
    name,
    viewType,
    visibleFieldIds: [],
    config: {},
    createdAt: '',
    updatedAt: '',
  };
}

describe('ViewSwitcher — chart view type', () => {
  it('lists a saved chart view with the Chart label and icon slot', () => {
    const views = [makeView('v1', 'Grid', 'grid'), makeView('v2', 'Revenue chart', 'chart')];
    render(
      <ViewSwitcher views={views} activeViewId="v1" onViewChange={vi.fn()} onCreateView={vi.fn()} />
    );
    fireEvent.click(screen.getByText('Grid'));
    expect(screen.getByText('Revenue chart')).toBeInTheDocument();
    expect(screen.getByText('Chart')).toBeInTheDocument();
  });

  it('offers Chart as a create-view type and creates it on submit', () => {
    const onCreateView = vi.fn();
    render(
      <ViewSwitcher views={[]} activeViewId="" onViewChange={vi.fn()} onCreateView={onCreateView} />
    );
    fireEvent.click(screen.getByRole('button', { name: /views/i }));
    fireEvent.click(screen.getByText('Create view'));

    const nameInput = screen.getByPlaceholderText('View name…');
    fireEvent.change(nameInput, { target: { value: 'My Chart View' } });

    fireEvent.click(screen.getByText('Chart'));
    fireEvent.click(screen.getByText('Create'));

    expect(onCreateView).toHaveBeenCalledWith('My Chart View', 'chart', false);
  });
});
