/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSharedViewData = vi.fn();
const mockGetSharedViewRecords = vi.fn();

vi.mock('@/services/api/tablePlatform.api', () => ({
  getSharedViewData: (...args: unknown[]) => mockGetSharedViewData(...args),
  getSharedViewRecords: (...args: unknown[]) => mockGetSharedViewRecords(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ token: 'shared-tok-1' }),
  };
});

// Matches the repo convention (see TableRealtimeStatusIndicator.test.tsx): stub
// react-i18next's t() to return the fallback/key directly rather than relying
// on the real i18next HTTP backend to resolve translation.json in jsdom.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'table.passwordProtected': 'Password Protected',
        'table.enterPasswordToView': 'Enter the password to view this shared table.',
        'table.enterPasswordPlaceholder': 'Enter password',
        'table.incorrectPassword': 'Incorrect password',
        'table.verifying': 'Verifying…',
        'table.viewTable': 'View Table',
        'table.viewUnavailable': 'View Unavailable',
        'table.sharedViewReadOnly': 'Shared view — read only',
        'table.groupEmptyValue': '(Empty)',
        'table.failedToLoadSharedView': 'Failed to load shared view',
      };
      return dict[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

// eslint-disable-next-line import/first
import PublicViewPage from '@/components/MyWork/table/PublicViewPage';

const FIELDS = [
  { id: 'fld-name', name: 'Name', field_type: 'singleLineText' },
  { id: 'fld-status', name: 'Status', field_type: 'singleSelect' },
];

describe('PublicViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSharedViewData.mockResolvedValue({
      viewId: 'view-1',
      tableId: 'table-1',
      viewName: 'Shared Grid',
      viewType: 'grid',
      config: {},
      tableName: 'Projects',
      fields: FIELDS,
      hasPassword: false,
    });
  });

  it('renders filtered/sorted rows already produced by the server, ungrouped', async () => {
    mockGetSharedViewRecords.mockResolvedValue({
      records: [
        { id: 'r-1', data: { 'fld-name': 'Alpha', 'fld-status': 'Open' } },
        { id: 'r-2', data: { 'fld-name': 'Beta', 'fld-status': 'Open' } },
      ],
      total: 2,
      hasMore: false,
      fields: FIELDS,
    });

    render(<PublicViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta')).toBeInTheDocument();
    // Read-only footer present; no filter/sort controls rendered.
    expect(screen.getByText(/Shared view/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /filter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sort/i })).not.toBeInTheDocument();
  });

  it('renders simple, non-interactive group headers when the view has groups', async () => {
    mockGetSharedViewRecords.mockResolvedValue({
      records: [],
      total: 2,
      hasMore: false,
      fields: FIELDS,
      groups: [
        {
          value: 'Open',
          count: 1,
          records: [{ id: 'r-1', data: { 'fld-name': 'Alpha', 'fld-status': 'Open' } }],
        },
        {
          value: 'Closed',
          count: 1,
          records: [{ id: 'r-2', data: { 'fld-name': 'Beta', 'fld-status': 'Closed' } }],
        },
      ],
    });

    render(<PublicViewPage />);

    await waitFor(() => {
      expect(screen.getByTestId('shared-view-groups')).toBeInTheDocument();
    });

    const headers = screen.getAllByTestId('shared-view-group-header');
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent('Open');
    expect(headers[1]).toHaveTextContent('Closed');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    // Group headers are plain text, not interactive controls.
    for (const header of headers) {
      expect(header.querySelector('button')).toBeNull();
    }
  });

  it('does not render a hidden field even if it slipped into a record payload', async () => {
    mockGetSharedViewRecords.mockResolvedValue({
      records: [
        {
          id: 'r-1',
          data: { 'fld-name': 'Alpha', 'fld-status': 'Open', 'fld-secret': 'SHOULD_NOT_RENDER' },
        },
      ],
      total: 1,
      hasMore: false,
      // Server only returns metadata for visible fields — hidden field is absent here.
      fields: FIELDS,
    });

    render(<PublicViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
    expect(screen.queryByText('SHOULD_NOT_RENDER')).not.toBeInTheDocument();
  });

  it('shows the password gate and does not fetch records until a password is supplied', async () => {
    const pwError: any = new Error('Password required');
    pwError.code = 'VIEW_PASSWORD_REQUIRED';
    mockGetSharedViewData.mockRejectedValueOnce(pwError);

    render(<PublicViewPage />);

    await waitFor(() => {
      expect(screen.getByText('Password Protected')).toBeInTheDocument();
    });
    expect(mockGetSharedViewRecords).not.toHaveBeenCalled();
  });
});
