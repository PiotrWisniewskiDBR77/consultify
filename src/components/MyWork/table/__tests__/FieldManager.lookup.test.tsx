/**
 * @vitest-environment jsdom
 *
 * FieldManager — Lookup field configuration.
 *
 * Covers the "Add Field" → lookup type flow: selecting a linkedRecord field
 * on this table, then a target field on the linked table, must save
 * `options` in the exact shape RelationService.computeLookup reads
 * (server/src/services/tablePlatform/RelationService.ts):
 *   { linkedFieldId: <linkedRecord field id on this table>,
 *     lookupFieldId: <field id on the linked table> }
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TablePlatformField } from '@/types/tablePlatform';

import { FieldManager } from '../FieldManager';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const tpApiMocks = vi.hoisted(() => ({
  createField: vi.fn(),
  updateField: vi.fn(),
  deleteField: vi.fn(),
  reorderFields: vi.fn(),
  getTable: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => tpApiMocks);

const FIXTURE_FIELDS: TablePlatformField[] = [
  {
    id: 'fld_name',
    tableId: 'tbl-main',
    name: 'Name',
    fieldType: 'singleLineText',
    options: {},
    isComputed: false,
    order: 0,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'fld_link',
    tableId: 'tbl-main',
    name: 'Related Tasks',
    fieldType: 'linkedRecord',
    options: { linkedTableId: 'tbl-tasks' },
    isComputed: false,
    order: 1,
    createdAt: '',
    updatedAt: '',
  },
];

describe('FieldManager — Lookup field configuration', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('saves options as { linkedFieldId, lookupFieldId } matching RelationService.computeLookup', async () => {
    tpApiMocks.getTable.mockResolvedValue({
      id: 'tbl-tasks',
      fields: [
        { id: 'fld_task_name', name: 'Task name', field_type: 'singleLineText' },
        { id: 'fld_task_status', name: 'Status', field_type: 'singleSelect' },
      ],
    });
    tpApiMocks.createField.mockResolvedValue({ id: 'fld_new_lookup' });

    render(
      <FieldManager
        open
        onClose={vi.fn()}
        tableId="tbl-main"
        fields={FIXTURE_FIELDS}
        onFieldsChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add/i }));

    const nameInput = screen.getByPlaceholderText(/Status, Priority/i);
    fireEvent.change(nameInput, { target: { value: 'Task Status Lookup' } });

    // Select the "lookup" field type from the type grid.
    fireEvent.click(screen.getByRole('button', { name: 'Lookup' }));

    // Select the linking field (linkedRecord field on this table) — first select in the dialog.
    const selects = screen.getAllByRole('combobox');
    const linkFieldSelect = selects[0];
    fireEvent.change(linkFieldSelect, { target: { value: 'fld_link' } });

    // Linked-table fields load asynchronously via getTable().
    await waitFor(() => expect(tpApiMocks.getTable).toHaveBeenCalledWith('tbl-tasks'));

    const targetFieldSelect = await screen.findByDisplayValue('Select field...');
    fireEvent.change(targetFieldSelect, { target: { value: 'fld_task_status' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Field' }));

    await waitFor(() => expect(tpApiMocks.createField).toHaveBeenCalled());
    expect(tpApiMocks.createField).toHaveBeenCalledWith(
      'tbl-main',
      'Task Status Lookup',
      'lookup',
      { linkedFieldId: 'fld_link', lookupFieldId: 'fld_task_status' }
    );
  });

  it('disables Create until both linking field and target field are chosen', async () => {
    tpApiMocks.getTable.mockResolvedValue({
      id: 'tbl-tasks',
      fields: [{ id: 'fld_task_status', name: 'Status', field_type: 'singleSelect' }],
    });

    render(
      <FieldManager
        open
        onClose={vi.fn()}
        tableId="tbl-main"
        fields={FIXTURE_FIELDS}
        onFieldsChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add/i }));
    fireEvent.change(screen.getByPlaceholderText(/Status, Priority/i), {
      target: { value: 'Incomplete Lookup' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lookup' }));

    const createButton = screen.getByRole('button', { name: 'Create Field' });
    expect(createButton).toBeDisabled();

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'fld_link' } });

    // Still disabled: target field not chosen yet.
    expect(createButton).toBeDisabled();

    await waitFor(() => expect(tpApiMocks.getTable).toHaveBeenCalled());
    const targetFieldSelect = await screen.findByDisplayValue('Select field...');
    fireEvent.change(targetFieldSelect, { target: { value: 'fld_task_status' } });

    expect(createButton).not.toBeDisabled();
  });

  it('shows a hint and no linking-field options when the table has no linkedRecord field', () => {
    render(
      <FieldManager
        open
        onClose={vi.fn()}
        tableId="tbl-main"
        fields={[FIXTURE_FIELDS[0]]}
        onFieldsChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Lookup' }));

    expect(screen.getByText(/Add a "Linked record" field first/i)).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    expect(within(selects[0]).getAllByRole('option')).toHaveLength(1); // only placeholder
  });
});
