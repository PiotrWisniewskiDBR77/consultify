/**
 * @vitest-environment jsdom
 * StandardTable — podstawowe testy renderu (Triada standard).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  normalizeRowActionSections,
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

  it('kebab contract: maps capabilities into context, manage and danger', () => {
    render(<StandardTable columns={columns} data={data} rowMenu={rowMenu} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    expect(screen.getByText('Open in Map')).toBeInTheDocument();
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

    // Danger pozostaje ostatnią strefą.
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(document.querySelectorAll('[role="menu"] > .border-t')).toHaveLength(2);
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
    // Decyzja zarządzająca R01 (2026-08-06), NADRZĘDNA wobec P-17/P-18: pozycja
    // ograniczona regułą zostaje widoczna i wyłączona, ale POWÓD nie jest już
    // prezentowany w menu (kanon §1/§7/§10). Stan biznesowy — obecność pozycji
    // i `disabled` powyżej — jest nietknięty; powód żyje w deskryptorze capability.
    expect(screen.queryByText(/Finish or cancel it first/)).toBeNull();
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

  it('reserves the same description slot when a row description is empty', () => {
    window.localStorage.setItem('standardTable.rowDesc.description-height', '1');
    const mixedDescriptions: TableRow[] = [
      { id: '1', name: 'With description', description: 'Two-line slot' },
      { id: '2', name: 'Without description' },
    ];

    const { container } = render(
      <StandardTable
        columns={[{ id: 'name', label: 'Name' }]}
        data={mixedDescriptions}
        persistKey="description-height"
      />
    );

    const slots = container.querySelectorAll('[data-row-description-slot]');
    expect(slots).toHaveLength(2);
    expect([...slots].every((slot) => slot.classList.contains('min-h-8'))).toBe(true);
  });

  it('normalizes low-level rowActions to context, manage and danger without changing actions', () => {
    const open = vi.fn();
    const ai = vi.fn();
    const convert = vi.fn();
    const remove = vi.fn();
    const normalized = normalizeRowActionSections([
      { id: 'open', kind: 'open', actions: [{ id: 'open', label: 'Open', onClick: open }] },
      { id: 'ai', kind: 'ai', actions: [{ id: 'ai', label: 'AI', onClick: ai }] },
      {
        id: 'convert',
        kind: 'convert',
        actions: [{ id: 'convert', label: 'Convert', onClick: convert }],
      },
      {
        id: 'danger',
        kind: 'danger',
        actions: [{ id: 'delete', label: 'Delete', onClick: remove, variant: 'danger' }],
      },
    ]);

    expect(normalized.map((section) => section.kind)).toEqual(['context', 'manage', 'danger']);
    expect(normalized[1].actions.map((action) => action.id)).toEqual(['ai', 'convert']);
    expect(
      normalized.flatMap((section) => section.actions).map((action) => action.onClick)
    ).toEqual([open, ai, convert, remove]);
  });
});
