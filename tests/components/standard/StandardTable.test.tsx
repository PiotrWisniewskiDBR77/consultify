/**
 * @vitest-environment jsdom
 * StandardTable — podstawowe testy renderu (Triada standard).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    // Blok 4 — „Otwórz podgląd" zostaje zawsze: to nie funkcja do zbudowania,
    // tylko wejście do encji.
    expect(screen.getByText('Open preview')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();

    /**
     * ZMIANA REGUŁY (2026-07-28, P-17/P-18). Do tej pory test wymagał, żeby
     * `Archive` BEZ handlera renderował się wyłączony, z dopiskiem „Coming soon
     * (backend)" — i to właśnie ta reguła produkowała kebaby-atrapy, na które
     * Piotr zwrócił uwagę dwa razy: Sejf miał 3 z 4 pozycji martwe, Run agent
     * to samo. Wzorcem jest kebab Interview → Templates: 9 pozycji, ZERO
     * wyłączonych.
     *
     * Teraz rozstrzyga POWÓD braku — sprawdzane niżej w tym samym teście.
     */
    expect(screen.queryByText('Archive')).toBeNull();

    // Blok 5 — Delete zawsze ostatni
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('kebab: blokada z POWODEM produktu zostaje widoczna, „jeszcze tego nie ma" znika', () => {
    render(
      <StandardTable
        columns={columns}
        data={data}
        rowMenu={(row) => {
          const bazowe = rowMenu(row);
          return {
            ...bazowe,
            universalHandlers: {
              ...(bazowe.universalHandlers ?? {}),
              // Regula produktu — uzytkownik ma sie dowiedziec, DLACZEGO nie wolno.
              archiveNote: 'Finish or cancel it first',
            },
          };
        }}
      />
    );
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);

    const archive = screen.getByText('Archive').closest('button');
    expect(archive).toBeDisabled();
    expect(screen.getByText(/Finish or cancel it first/)).toBeInTheDocument();
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

  it('persists column visibility per table and restores it after remount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <StandardTable
        columns={columns}
        data={data}
        rowMenu={rowMenu}
        persistKey="acceptance.initiatives"
      />
    );

    await user.click(screen.getByLabelText('View settings'));
    await user.click(screen.getAllByText('Status')[1]);

    await waitFor(() => expect(screen.queryByText('APPROVED')).not.toBeInTheDocument());
    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem('filterableTable.cols.acceptance.initiatives') ?? '{}'
      );
      expect(stored.visibility?.status).toBe(false);
    });

    unmount();
    render(
      <StandardTable
        columns={columns}
        data={data}
        rowMenu={rowMenu}
        persistKey="acceptance.initiatives"
      />
    );
    expect(screen.queryByText('APPROVED')).not.toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('uses the same row action contract for kebab, right click and Shift+F10', async () => {
    const open = vi.fn();
    const preview = vi.fn();
    const menu: typeof rowMenu = () => ({
      primary: [{ id: 'open', label: 'Open workspace', onClick: open }],
      universalHandlers: { preview },
    });
    const user = userEvent.setup();
    render(<StandardTable columns={columns} data={data} rowMenu={menu} />);

    await user.click(screen.getAllByLabelText('Row actions')[0]);
    expect(screen.getByText('Open workspace')).toBeInTheDocument();
    expect(screen.getByText('Open preview')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const alphaRow = screen.getByText('Alpha').closest('tr');
    expect(alphaRow).not.toBeNull();
    fireEvent.contextMenu(alphaRow!, { clientX: 240, clientY: 180 });
    expect(screen.getByText('Open workspace')).toBeInTheDocument();
    expect(screen.getByText('Open preview')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    alphaRow!.focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    expect(screen.getByText('Open workspace')).toBeInTheDocument();
    expect(screen.getByText('Open preview')).toBeInTheDocument();
  });
});
