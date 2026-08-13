/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG (table) batch 5 — FieldManager (drawer + nested AddFieldDialog),
 * GovernedModelsDashboard (CreateModelWizard, EditModelModal, model detail
 * slide-over), PlatformGridView's note editor (ViewRouter), and
 * ChatToSchemaPanel's slideOver mode converted onto the shared
 * `useDialogA11y` contract (G4-MODALS-REST).
 *
 * FieldManager's `AddFieldDialog` and GovernedModelsDashboard's
 * `CreateModelWizard`/`EditModelModal` all had a native `autoFocus` on their
 * name input — the same pre-open-focus race as a bespoke
 * `useEffect(() => ref.focus(), [])`; all now use `initialFocusRef`.
 *
 * PlatformGridView's row context menu (`rowMenu`) and its "Dodaj notatkę"
 * note editor share the same `fixed inset-0` wrapper class, but only the
 * note editor is a dialog — `rowMenu` is a right-click context menu
 * (anchored, single-click actions) and is deliberately left unconverted.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

vi.mock('@/services/api/tablePlatform.api', () => ({
  reorderFields: vi.fn(async () => ({})),
  listGovernedModels: vi.fn(async () => []),
  getGovernedModel: vi.fn(async (id: string) => ({ model_id: id, name: 'Model One' })),
  computeKpi: vi.fn(async () => ({ value: null })),
  createGovernedModel: vi.fn(async () => ({ model_id: 'new-model' })),
  addModelSource: vi.fn(async () => ({})),
  addModelKpi: vi.fn(async () => ({})),
  addModelDimension: vi.fn(async () => ({})),
  updateGovernedModel: vi.fn(async () => ({})),
  deleteGovernedModel: vi.fn(async () => ({})),
}));

import { FieldManager } from '../FieldManager';
import { GovernedModelsDashboard } from '../governed/GovernedModelsDashboard';
import { PlatformGridView, type PlatformGridViewProps } from '../ViewRouter';
import { ChatToSchemaPanel } from '../ChatToSchemaPanel';
import type { TablePlatformField } from '@/types/tablePlatform';
import type { TableNode, ColumnDef } from '../tableTypes';

function Harness({
  children,
}: {
  children: (open: boolean, onClose: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button data-testid="trigger" onClick={() => setOpen(true)}>
        Open
      </button>
      {children(open, () => setOpen(false))}
    </div>
  );
}

async function assertEscapeClosesAndRestoresFocus(trigger: HTMLElement) {
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
}

// ── FieldManager ──────────────────────────────────────────────────────────

describe('FieldManager — dialog a11y contract', () => {
  const fields: TablePlatformField[] = [
    {
      id: 'f1',
      tableId: 'tbl-1',
      name: 'Name',
      fieldType: 'singleLineText',
      options: {},
      isComputed: false,
      order: 0,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <FieldManager
            open={open}
            onClose={onClose}
            tableId="tbl-1"
            fields={fields}
            onFieldsChanged={vi.fn()}
          />
        )}
      </Harness>
    );
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/myWorkTable.fieldManager.fields/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });

  it('opens a nested "Add field" dialog focused on the name input, and Escape closes only the nested dialog', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <FieldManager
            open={open}
            onClose={onClose}
            tableId="tbl-1"
            fields={fields}
            onFieldsChanged={vi.fn()}
          />
        )}
      </Harness>
    );
    fireEvent.click(screen.getByTestId('trigger'));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByText(/myWorkTable\.fieldManager\.add/i));

    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.length).toBe(2);
    const addDialog = dialogs.find(
      (d) => d.getAttribute('aria-labelledby') === 'add-field-dialog-title'
    )!;
    expect(addDialog).toBeTruthy();

    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('INPUT');
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryAllByRole('dialog').length).toBe(1);
    });
  });
});

// ── GovernedModelsDashboard ──────────────────────────────────────────────

describe('GovernedModelsDashboard — CreateModelWizard dialog a11y contract', () => {
  it('opens the wizard with role=dialog, aria-modal, an accessible name, and focuses the name input; Escape closes and restores focus', async () => {
    render(<GovernedModelsDashboard baseId="base-1" tables={[]} />);
    await waitFor(() => expect(screen.queryByText(/Loading|Ładowanie/i)).not.toBeInTheDocument());

    const newModelBtn = await screen.findByText(/myWorkTable\.governedModels\.newModel/i);
    newModelBtn.focus();
    fireEvent.click(newModelBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/myWorkTable\.governedModels\.newDataModel/i);

    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('INPUT');
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('GovernedModelsDashboard — EditModelModal + detail slide-over dialog a11y contract', () => {
  it('EditModelModal has role=dialog, an accessible name, and focuses the pre-filled name input', async () => {
    const Api = await import('@/services/api/tablePlatform.api');
    (Api.listGovernedModels as any).mockResolvedValueOnce([{ model_id: 'm1' }]);
    (Api.getGovernedModel as any).mockResolvedValueOnce({ model_id: 'm1', name: 'Model One' });

    render(<GovernedModelsDashboard baseId="base-1" tables={[]} />);

    const editBtn = await screen.findByTitle('myWorkTable.governedModels.edit');
    fireEvent.click(editBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/myWorkTable\.governedModels\.editModel/i);

    await waitFor(() => {
      expect(document.activeElement).toHaveValue('Model One');
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('model detail slide-over has role=dialog and an accessible name matching the model; Escape closes it', async () => {
    const Api = await import('@/services/api/tablePlatform.api');
    (Api.listGovernedModels as any).mockResolvedValueOnce([{ model_id: 'm1' }]);
    (Api.getGovernedModel as any).mockResolvedValueOnce({ model_id: 'm1', name: 'Model One' });

    render(<GovernedModelsDashboard baseId="base-1" tables={[]} />);

    const cardTitle = await screen.findByText('Model One');
    fireEvent.click(cardTitle);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Model One');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

// ── PlatformGridView (ViewRouter) note editor ────────────────────────────

describe('PlatformGridView — note editor dialog a11y contract', () => {
  const platformFields: TablePlatformField[] = [
    {
      id: 'title',
      tableId: 'tbl-1',
      name: 'Title',
      fieldType: 'singleLineText',
      options: {},
      isComputed: false,
      order: 0,
      createdAt: '',
      updatedAt: '',
    },
  ];
  const columns: ColumnDef[] = [
    { key: 'title', header: 'Title', type: 'text', visible: true, width: 160 },
  ];
  const rows: TableNode[] = [
    { id: 'row-1', type: 'idea', data: { title: 'Row One' }, position: { x: 0, y: 0 } },
  ];

  function renderGrid() {
    const props: PlatformGridViewProps = {
      processedRows: rows,
      groupedRows: null,
      visibleColumns: columns,
      platformFieldById: new Map([
        ['title', { fieldType: 'singleLineText', options: {}, isComputed: false }],
      ]),
      locked: false,
      selectedRowIds: new Set(),
      toggleRowSelection: vi.fn(),
      handleFieldChange: vi.fn(),
      editingCellId: null,
      setEditingCellId: vi.fn(),
      onOpenLinkedRecord: vi.fn(),
      formatRules: [],
      platformFields,
      handleDuplicateRow: vi.fn(),
      handleDeleteRow: vi.fn(),
      handleInsertRow: vi.fn(),
    };
    return render(<PlatformGridView {...props} />);
  }

  it('has role=dialog, aria-modal, and an accessible name; focuses the textarea; Escape closes and restores focus', async () => {
    renderGrid();
    const rowCell = screen.getByText('Row One');
    const row = rowCell.closest('tr')!;
    row.focus();
    fireEvent.contextMenu(row);

    const addNote = await screen.findByText('Add note');
    fireEvent.click(addNote);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/Notatka|Note/i);

    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('TEXTAREA');
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

// ── ChatToSchemaPanel (slideOver mode) ───────────────────────────────────

describe('ChatToSchemaPanel — slideOver dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <ChatToSchemaPanel workspaceId="ws-1" onClose={onClose} mode="slideOver" />
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/myWorkTable\.chatToSchemaPanel\.aiTableBuilder/i);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does not render dialog semantics in modal mode (host-embedded, no fixed backdrop here)', () => {
    render(<ChatToSchemaPanel workspaceId="ws-1" onClose={vi.fn()} mode="modal" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
