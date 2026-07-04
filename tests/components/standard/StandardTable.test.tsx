/**
 * @vitest-environment jsdom
 * StandardTable — podstawowe testy renderu (Triada standard).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  StandardTable,
  type StandardRowMenu,
  type TableColumn,
  type TableRow,
} from '../../../src/components/standard/StandardTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : _key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const columns: TableColumn[] = [
  { id: 'name', label: 'Name', sortable: true },
  {
    id: 'status',
    label: 'Status',
    filterable: true,
    filterOptions: [{ value: 'DRAFT', label: 'Draft' }],
  },
];

const data: TableRow[] = [
  { id: '1', name: 'Alpha', status: 'DRAFT', description: 'Project X' },
  { id: '2', name: 'Beta', status: 'APPROVED', description: 'Project Y' },
];

const rowMenu = (_row: TableRow): StandardRowMenu => ({
  primary: [{ id: 'open', label: 'Open in Map', onClick: vi.fn() }],
  universalHandlers: { preview: vi.fn(), edit: vi.fn() },
  destructive: { onClick: vi.fn() },
});

describe('StandardTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders uppercase headers, rows and the row kebab', () => {
    render(<StandardTable columns={columns} data={data} rowMenu={rowMenu} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Row actions').length).toBe(2);
  });

  it('kebab contract: module blocks + mandatory universal and destructive blocks', () => {
    render(<StandardTable columns={columns} data={data} rowMenu={rowMenu} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    expect(screen.getByText('Open in Map')).toBeInTheDocument();
    // Blok 4 — zawsze obecny
    expect(screen.getByText('Open preview')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    // Archive bez handlera = disabled z dopiskiem, NIE ukryty
    const archive = screen.getByText('Archive').closest('button');
    expect(archive).toBeDisabled();
    // Blok 5 — Delete zawsze ostatni
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders selection checkboxes when selection prop is provided', () => {
    render(
      <StandardTable
        columns={columns}
        data={data}
        selection={{ selectedIds: new Set(), onChange: vi.fn() }}
      />
    );
    // select-all + 2 wiersze
    expect(screen.getAllByRole('checkbox').length).toBe(3);
  });

  it('renders loading / error / empty states from shared/states', () => {
    const { rerender } = render(<StandardTable columns={columns} data={[]} loading />);
    expect(screen.getByTestId('standard-table-loading')).toBeInTheDocument();

    rerender(<StandardTable columns={columns} data={[]} error="Boom" onRetry={vi.fn()} />);
    expect(screen.getByTestId('standard-table-error')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();

    rerender(
      <StandardTable
        columns={columns}
        data={[]}
        empty={{ title: 'No items yet', actionLabel: 'Create', onAction: vi.fn() }}
      />
    );
    expect(screen.getByTestId('standard-table-empty')).toBeInTheDocument();
    expect(screen.getByText('No items yet')).toBeInTheDocument();
  });

  it('shows the mandatory Settings2 view-settings trigger (TableSettingsPopover)', () => {
    render(<StandardTable columns={columns} data={data} rowMenu={rowMenu} />);
    expect(screen.getByLabelText('View settings')).toBeInTheDocument();
  });
});
