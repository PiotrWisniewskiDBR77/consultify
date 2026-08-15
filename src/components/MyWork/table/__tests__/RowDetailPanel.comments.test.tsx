/**
 * @vitest-environment jsdom
 *
 * RowDetailPanel — Record Comments section (Table Platform).
 * Covers: list render from server, add clears input, delete gated to own
 * comments, and API-error surfacing.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TablePlatformField } from '@/types/tablePlatform';

import { RowDetailPanel } from '../RowDetailPanel';
import type { ColumnDef, TableNode } from '../tableTypes';

// ── Mocks ────────────────────────────────────────────────────────────────────

const toastError = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: string | { defaultValue?: string }) =>
      (typeof opts === 'string' ? opts : opts?.defaultValue) ?? k,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

const tpApiMocks = vi.hoisted(() => ({
  getRecordWatchers: vi.fn().mockResolvedValue([]),
  toggleRecordWatch: vi.fn().mockResolvedValue({ watching: false }),
  getAttachments: vi.fn().mockResolvedValue([]),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  listRecordComments: vi.fn().mockResolvedValue({ comments: [], total: 0 }),
  addRecordComment: vi.fn(),
  updateRecordComment: vi.fn(),
  deleteRecordComment: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => tpApiMocks);

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentUser: {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      },
      currentOrganization: { id: 'org-1' },
    }),
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: {
    getOrganizationMembers: vi.fn().mockResolvedValue([
      { userId: 'user-1', name: 'Test User', email: 'test@example.com' },
      { userId: 'user-2', name: 'Other User', email: 'other@example.com' },
    ]),
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

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

function makeNode(comments: unknown[] = []): TableNode {
  return {
    id: 'rec-1',
    type: 'idea',
    data: { fld_name: 'Alpha', comments },
    position: { x: 0, y: 0 },
  };
}

/**
 * Stateful harness mirroring how the real parent (useTablePlatformIntegration)
 * owns node data and re-renders RowDetailPanel with updated fields on change.
 */
function StatefulHarness({
  initialNode,
  onFieldChangeSpy,
}: {
  initialNode: TableNode;
  onFieldChangeSpy: (nodeId: string, field: string, value: unknown) => void;
}) {
  const [node, setNode] = React.useState(initialNode);
  const handleFieldChange = (nodeId: string, field: string, value: unknown) => {
    onFieldChangeSpy(nodeId, field, value);
    setNode((prev) => ({ ...prev, data: { ...prev.data, [field]: value } }));
  };
  return (
    <RowDetailPanel
      open
      onClose={vi.fn()}
      node={node}
      columns={FIXTURE_COLUMNS}
      edges={[]}
      allNodes={[node]}
      onFieldChange={handleFieldChange}
      fields={FIXTURE_FIELDS}
      platformTableId="tbl-main"
    />
  );
}

async function openCommentsTab(onFieldChange = vi.fn(), node = makeNode()) {
  render(<StatefulHarness initialNode={node} onFieldChangeSpy={onFieldChange} />);
  // Platform sheet defaults to the "fields" tab; switch to Comments.
  const commentsTabButton = await screen.findByRole('button', { name: /Comments/i });
  fireEvent.click(commentsTabButton);
  return { onFieldChange, node };
}

describe('RowDetailPanel — Comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tpApiMocks.getRecordWatchers.mockResolvedValue([]);
    tpApiMocks.toggleRecordWatch.mockResolvedValue({ watching: false });
    tpApiMocks.getAttachments.mockResolvedValue([]);
    tpApiMocks.listRecordComments.mockResolvedValue({ comments: [], total: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the comment list fetched from the server', async () => {
    tpApiMocks.listRecordComments.mockResolvedValue({
      comments: [
        {
          id: 'cmt-1',
          author_id: 'user-2',
          author_name: 'Other User',
          content: 'Hello there',
          created_at: '2026-07-01T10:00:00.000Z',
          updated_at: '2026-07-01T10:00:00.000Z',
        },
      ],
      total: 1,
    });

    await openCommentsTab();

    await waitFor(() =>
      expect(tpApiMocks.listRecordComments).toHaveBeenCalledWith('rec-1', { limit: 100 })
    );
    expect(await screen.findByText('Hello there')).toBeInTheDocument();
    expect(screen.getByText('Other User')).toBeInTheDocument();
  });

  it('adding a comment calls the API and clears the input', async () => {
    tpApiMocks.addRecordComment.mockResolvedValue({
      id: 'cmt-new',
      author_id: 'user-1',
      content: 'A new comment',
      created_at: '2026-07-04T00:00:00.000Z',
    });

    const onFieldChange = vi.fn();
    await openCommentsTab(onFieldChange);

    const textarea = await screen.findByPlaceholderText('Add a comment... (@ to mention)');
    fireEvent.change(textarea, { target: { value: 'A new comment' } });
    expect(textarea).toHaveValue('A new comment');

    const sendButton = textarea.parentElement!.querySelector('button[type="button"]')!;
    fireEvent.click(sendButton);

    await waitFor(() => expect(tpApiMocks.addRecordComment).toHaveBeenCalled());
    expect(tpApiMocks.addRecordComment).toHaveBeenCalledWith(
      'rec-1',
      'tbl-main',
      'A new comment',
      'Test User',
      undefined,
      undefined
    );
    await waitFor(() => expect(textarea).toHaveValue(''));
  });

  it("shows delete/edit controls only on the current user's own comment", async () => {
    tpApiMocks.listRecordComments.mockResolvedValue({
      comments: [
        {
          id: 'cmt-own',
          author_id: 'user-1',
          author_name: 'Test User',
          content: 'My own comment',
          created_at: '2026-07-01T10:00:00.000Z',
          updated_at: '2026-07-01T10:00:00.000Z',
        },
        {
          id: 'cmt-other',
          author_id: 'user-2',
          author_name: 'Other User',
          content: 'Someone else comment',
          created_at: '2026-07-01T11:00:00.000Z',
          updated_at: '2026-07-01T11:00:00.000Z',
        },
      ],
      total: 2,
    });

    await openCommentsTab();

    await waitFor(() => expect(tpApiMocks.listRecordComments).toHaveBeenCalled());
    const items = await screen.findAllByTestId('comment-item');
    expect(items).toHaveLength(2);

    const ownItem = items.find((el) => within(el).queryByText('My own comment'));
    const otherItem = items.find((el) => within(el).queryByText('Someone else comment'));
    expect(ownItem).toBeTruthy();
    expect(otherItem).toBeTruthy();

    expect(within(ownItem!).getByTestId('comment-delete-btn')).toBeInTheDocument();
    expect(within(ownItem!).getByTestId('comment-edit-btn')).toBeInTheDocument();
    expect(within(otherItem!).queryByTestId('comment-delete-btn')).not.toBeInTheDocument();
    expect(within(otherItem!).queryByTestId('comment-edit-btn')).not.toBeInTheDocument();

    tpApiMocks.deleteRecordComment.mockResolvedValue(undefined);
    fireEvent.click(within(ownItem!).getByTestId('comment-delete-btn'));
    await waitFor(() => expect(tpApiMocks.deleteRecordComment).toHaveBeenCalledWith('cmt-own'));
  });

  it('shows an error message when the list API fails', async () => {
    tpApiMocks.listRecordComments.mockRejectedValue(new Error('network down'));

    await openCommentsTab();

    expect(await screen.findByTestId('comments-error')).toHaveTextContent(
      'Failed to load comments'
    );
  });

  it('shows a toast when adding a comment fails', async () => {
    tpApiMocks.addRecordComment.mockRejectedValue(new Error('500'));

    await openCommentsTab();

    const textarea = await screen.findByPlaceholderText('Add a comment... (@ to mention)');
    fireEvent.change(textarea, { target: { value: 'Will fail' } });
    const sendButton = textarea.parentElement!.querySelector('button[type="button"]')!;
    fireEvent.click(sendButton);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to add comment'));
  });
});
