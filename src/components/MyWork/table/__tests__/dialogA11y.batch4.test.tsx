/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG (table) batch 4 — RecordTemplateManager (list + editor),
 * LinkedRecordPicker, FrameworkGenerator, ExportToPresentation, and
 * ViewConfigPanel converted onto the shared `useDialogA11y` contract
 * (G4-MODALS-REST).
 *
 * RecordTemplateManager's `TemplateEditor` and GovernedModelsDashboard's
 * `EditModelModal` (batch5) both had a native `autoFocus` on their name
 * input — the same class of pre-open-focus race as a bespoke
 * `useEffect(() => ref.focus(), [])`. Both now use `initialFocusRef`.
 *
 * `RecordTemplateManager`'s `TemplateDropdown` (an anchored, single-click
 * "from template" popover) and `RowTemplatePicker` (same anchored
 * single-select popover shape) were deliberately NOT converted — they are
 * popovers/listboxes, not dialogs (same class as the row context menus in
 * `ViewRouter`/`TableToolbar` that this program already excludes).
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
  listRecordTemplates: vi.fn(async () => ({ templates: [] })),
  deleteRecordTemplate: vi.fn(async () => ({})),
  updateRecordTemplate: vi.fn(async () => ({})),
  createRecordTemplate: vi.fn(async () => ({})),
  getTable: vi.fn(async () => ({ name: 'Table 1', fields: [] })),
  searchRecords: vi.fn(async () => ({ records: [] })),
  listRecords: vi.fn(async () => ({ records: [] })),
  getRecord: vi.fn(async () => ({ data: {} })),
}));

import { RecordTemplateManager } from '../RecordTemplateManager';
import { LinkedRecordPicker } from '../LinkedRecordPicker';
import { FrameworkGenerator } from '../FrameworkGenerator';
import { ExportToPresentation } from '../ExportToPresentation';
import { ViewConfigPanel, type ViewConfigState } from '../views/ViewConfigPanel';

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

async function openAndAssertDialog(name: RegExp | string) {
  const trigger = screen.getByTestId('trigger');
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAccessibleName(name as any);
  return { trigger, dialog };
}

async function assertEscapeClosesAndRestoresFocus(trigger: HTMLElement) {
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
}

describe('RecordTemplateManager — dialog a11y contract (list)', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <RecordTemplateManager
            open={open}
            onClose={onClose}
            tableId="tbl-1"
            fields={[]}
            onUseTemplate={vi.fn()}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Record Templates/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('RecordTemplateManager — dialog a11y contract (TemplateEditor)', () => {
  it('opens a nested "New Template" dialog focused on the name input, and Escape closes only the editor', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <RecordTemplateManager
            open={open}
            onClose={onClose}
            tableId="tbl-1"
            fields={[]}
            onUseTemplate={vi.fn()}
          />
        )}
      </Harness>
    );
    fireEvent.click(screen.getByTestId('trigger'));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByText(/^New$/i));

    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.length).toBe(2);
    const editor = dialogs.find((d) => d.getAttribute('aria-labelledby') === 'record-template-editor-title')!;
    expect(editor).toBeTruthy();
    expect(editor).toHaveAccessibleName(/New Template/i);

    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('INPUT');
    });

    // Two simultaneously-open `useDialogA11y` dialogs would both react to a
    // single Escape press (stopPropagation doesn't stop sibling listeners on
    // the same `document` target) — the outer manager suspends its own
    // listener while this nested editor is open, so only the editor closes.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryAllByRole('dialog').length).toBe(1);
    });
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Record Templates/i);
  });
});

describe('LinkedRecordPicker — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; focuses search input; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <LinkedRecordPicker
            open={open}
            onClose={onClose}
            recordId="rec-1"
            fieldId="field-1"
            linkedTableId="tbl-2"
            currentLinks={[]}
            onLink={vi.fn()}
            onUnlink={vi.fn()}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/myWorkTable.linkedRecordPicker.title/i);
    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('INPUT');
    });
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('FrameworkGenerator — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <FrameworkGenerator open={open} onClose={onClose} onApply={vi.fn()} />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/myWorkTable.frameworkGenerator.frameworkGenerator/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('ExportToPresentation — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <ExportToPresentation
            open={open}
            onClose={onClose}
            nodes={[]}
            columns={[]}
            ideaTitle="Idea"
            viewLayout="table"
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(
      /myWorkTable.exportToPresentation.exportToPresentation/i
    );
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('ViewConfigPanel — dialog a11y contract', () => {
  const config: ViewConfigState = { viewType: 'grid', visibleFieldIds: [] };

  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <ViewConfigPanel
            open={open}
            onClose={onClose}
            columns={[]}
            config={config}
            onChange={vi.fn()}
            onSave={vi.fn()}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/myWorkTable.viewConfigPanel.viewConfiguration/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});
