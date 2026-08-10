/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — RowDetailPanel (the row/idea detail drawer) rendered a
 * plain `fixed inset-0` overlay with ZERO `role="dialog"` / `aria-modal` /
 * focus-trap / focus-restore (it did have a local Escape-to-close for its
 * comment/mention editors, which is unrelated and untouched). Fixed via the
 * shared `useDialogA11y` hook.
 *
 * Mocks mirror RowDetailPanel.comments.test.tsx's harness (same component,
 * same required providers) — kept in a separate file per this stream's
 * scope so the pre-existing "RowDetailPanel.comments" failure (unrelated,
 * not fixed here) stays isolated.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { TablePlatformField } from '@/types/tablePlatform';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: string | { defaultValue?: string }) =>
      (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  getRecordWatchers: vi.fn().mockResolvedValue([]),
  toggleRecordWatch: vi.fn().mockResolvedValue({ watching: false }),
  listRecordComments: vi.fn().mockResolvedValue({ comments: [], total: 0 }),
  addRecordComment: vi.fn(),
  updateRecordComment: vi.fn(),
  deleteRecordComment: vi.fn(),
  getAttachments: vi.fn().mockResolvedValue([]),
  getActivities: vi.fn().mockResolvedValue([]),
  getAiInsights: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentUser: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 't@example.com' },
      currentOrganization: { id: 'org-1' },
    }),
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers: vi.fn().mockResolvedValue([]) },
}));

import { RowDetailPanel } from '../RowDetailPanel';
import type { ColumnDef, TableNode } from '../tableTypes';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

const FIXTURE_COLUMNS: ColumnDef[] = [
  { key: 'fld_name', header: 'Name', type: 'text', visible: true, width: 200 },
];

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
];

function makeNode(): TableNode {
  return {
    id: 'rec-1',
    type: 'idea',
    // RowDetailPanel's own editable title <input> reads `node.data.label`
    // (see its "Editable title" block) — the dialog's accessible name
    // mirrors that same field, not the platform field's `fld_name` key.
    data: { fld_name: 'Alpha', label: 'Alpha' },
    position: { x: 0, y: 0 },
  };
}

function Trigger({
  children,
}: {
  children: (open: boolean, close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open trigger
      </button>
      {children(open, () => setOpen(false))}
    </div>
  );
}

describe('RowDetailPanel — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name derived from the record title', () => {
    render(
      <RowDetailPanel
        open
        onClose={vi.fn()}
        node={makeNode()}
        columns={FIXTURE_COLUMNS}
        edges={[]}
        allNodes={[makeNode()]}
        onFieldChange={vi.fn()}
        fields={FIXTURE_FIELDS}
        platformTableId="tbl-main"
      />
    );
    expect(screen.getByRole('dialog', { name: /Alpha/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(
      <RowDetailPanel
        open
        onClose={onClose}
        node={makeNode()}
        columns={FIXTURE_COLUMNS}
        edges={[]}
        allNodes={[makeNode()]}
        onFieldChange={vi.fn()}
        fields={FIXTURE_FIELDS}
        platformTableId="tbl-main"
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    const node = makeNode();
    render(
      <Trigger>
        {(open, close) =>
          open && (
            <RowDetailPanel
              open
              onClose={close}
              node={node}
              columns={FIXTURE_COLUMNS}
              edges={[]}
              allNodes={[node]}
              onFieldChange={vi.fn()}
              fields={FIXTURE_FIELDS}
              platformTableId="tbl-main"
            />
          )
        }
      </Trigger>
    );
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
