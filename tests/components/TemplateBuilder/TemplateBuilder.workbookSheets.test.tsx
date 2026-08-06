/** @vitest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  TemplateBuilder,
  TemplateBuilderFlow,
} from '../../../src/components/TemplateBuilder/TemplateBuilder';
import {
  draftToPostBody,
  type TemplateDraft,
} from '../../../src/components/TemplateBuilder/templateBuilderModel';

const initialDraft = (): TemplateDraft => ({
  type: 'table',
  name: 'Portfolio Transformation Control — XLSX — 20260806',
  description: '',
  scope: 'org',
  themeRef: null,
  doc: [],
  deck: [],
  table: [
    {
      id: 'sheet-portfolio',
      name: 'Portfolio',
      columns: [
        {
          id: 'portfolio-col-1',
          name: 'Initiative',
          type: 'text',
          formula: '',
          starterValue: '',
          numberFormat: '',
          validation: { type: 'none', values: '', min: '', max: '' },
        },
      ],
    },
  ],
});

describe('TemplateBuilder workbook sheets', () => {
  it('adds sheets through the complete wizard and real ExecutiveModuleShell', async () => {
    const user = userEvent.setup();
    render(<TemplateBuilderFlow initialType="table" />);

    await user.type(screen.getByTestId('wizard-name'), 'Runtime shell workbook');
    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    await user.click(screen.getByRole('button', { name: 'Utwórz i edytuj' }));

    const realShell = screen.getByTestId('template-builder-mels');
    await user.click(within(realShell).getByTestId('structure-add'));
    expect(screen.getByTestId('template-builder-shell')).toHaveAttribute(
      'data-structure-count',
      '2'
    );
    expect(within(realShell).getByTestId('template-structure-list')).toHaveAttribute(
      'data-structure-count',
      '2'
    );
    expect(within(realShell).getByTestId('template-structure-list')).toHaveTextContent('Arkusz 1');
    expect(within(realShell).getByTestId('template-structure-list')).toHaveTextContent('Arkusz 2');

    await user.click(within(realShell).getByTestId('structure-add'));
    expect(screen.getByTestId('template-builder-shell')).toHaveAttribute(
      'data-structure-count',
      '3'
    );
    expect(within(realShell).getByTestId('template-structure-list')).toHaveAttribute(
      'data-structure-count',
      '3'
    );
    const structureItems = within(realShell)
      .getAllByRole('button')
      .filter((item) => item.dataset.testid?.startsWith('structure-item-'));
    expect(structureItems).toHaveLength(3);
    expect(within(realShell).getByTestId('template-structure-list')).toHaveTextContent('Arkusz 3');
  });

  it('adds a second sheet, keeps schemas independent, then saves and reopens both', async () => {
    const user = userEvent.setup();
    let savedDraft: TemplateDraft | null = null;
    const saveFn = vi.fn(async (draft: TemplateDraft) => {
      savedDraft = structuredClone(draft);
      return { id: 'template-1' };
    });

    const firstRender = render(
      <StrictMode>
        <TemplateBuilder initialDraft={initialDraft()} saveFn={saveFn} persistRailState={false} />
      </StrictMode>
    );

    await user.click(screen.getByTestId('structure-add'));
    const list = screen.getByTestId('template-structure-list');
    expect(
      within(list)
        .getAllByRole('button')
        .filter((item) => item.dataset.testid?.startsWith('structure-item-'))
    ).toHaveLength(2);
    expect(within(list).getByText('Portfolio')).toBeInTheDocument();
    expect(within(list).getByText('Arkusz 2')).toBeInTheDocument();

    await user.clear(screen.getByTestId('sheet-name'));
    await user.type(screen.getByTestId('sheet-name'), 'Milestones');
    await user.clear(screen.getByTestId('sheet-column-0-name'));
    await user.type(screen.getByTestId('sheet-column-0-name'), 'Milestone');
    await user.click(screen.getByTestId('sheet-add-column'));
    await user.clear(screen.getByTestId('sheet-column-1-name'));
    await user.type(screen.getByTestId('sheet-column-1-name'), 'Due date');

    await user.click(within(list).getByText('Portfolio'));
    expect(screen.getByTestId('sheet-name')).toHaveValue('Portfolio');
    expect(screen.getByTestId('sheet-column-0-name')).toHaveValue('Initiative');
    expect(screen.queryByTestId('sheet-column-1-name')).not.toBeInTheDocument();

    await user.click(within(list).getByText('Milestones'));
    expect(screen.getByTestId('sheet-column-0-name')).toHaveValue('Milestone');
    expect(screen.getByTestId('sheet-column-1-name')).toHaveValue('Due date');

    await user.click(screen.getByText('Zapisz jako szablon'));
    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(savedDraft?.table.map((sheet) => sheet.name)).toEqual(['Portfolio', 'Milestones']);
    expect(draftToPostBody(savedDraft!).meta.schema_snapshot).toMatchObject({
      sheets: [
        { name: 'Portfolio', columns: [{ header: 'Initiative' }] },
        { name: 'Milestones', columns: [{ header: 'Milestone' }, { header: 'Due date' }] },
      ],
    });

    firstRender.unmount();
    render(<TemplateBuilder initialDraft={savedDraft!} saveFn={saveFn} persistRailState={false} />);
    const reopenedList = screen.getByTestId('template-structure-list');
    expect(within(reopenedList).getByText('Portfolio')).toBeInTheDocument();
    expect(within(reopenedList).getByText('Milestones')).toBeInTheDocument();
    await user.click(within(reopenedList).getByText('Milestones'));
    expect(screen.getByTestId('sheet-column-1-name')).toHaveValue('Due date');
  });
});
