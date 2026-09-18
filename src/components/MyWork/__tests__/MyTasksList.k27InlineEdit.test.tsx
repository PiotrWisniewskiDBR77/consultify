/**
 * K-27 (zgłoszenie testera #73, Kasia, `/my-work` → Zadania):
 *   „Nie mogę zmienić terminu / priorytetu / statusu zadania z listy — muszę
 *    otwierać szczegóły."
 *   Kryterium kolejki QA3 (KOLEJKI-DO-KONCA-20260918): „3 pola edytowalne
 *   inline; mutacja RED".
 *
 * KROK 0 (pomiar na tipie 7e64cb3cdd): funkcja inline-edycji ISTNIEJE od
 * `f0016dd07e` (2026-02-24) — komórki status/priority/date w kolumnach
 * StandardTable otwierają `InlineCellDropdown` / `<input type="date">` i wołają
 * `handleInlineEdit(taskId, field, value)` → `persistPersonalTask` →
 * `Api.updatePersonalTask(taskId, { [field]: value, expectedVersionToken })`
 * z optimistic update + undo + rollback. Premisa „nie da się" = FAŁSZ na
 * poziomie kodu; realna luka = BRAK testu, który to wpięcie zamraża.
 *
 * Ten test renderuje REALNY `MyTasksListContent` (domyślna ścieżka
 * `useStandardTable`, flaga ON od 2026-07-15) i przepuszcza prawdziwe rendery
 * kolumn (`column.render(row)`), więc wykonują się genuine komórki inline.
 * Asertuje ARGUMENT zapisu (payload + expectedVersionToken) — nie tekst na
 * ekranie i nie lokalne lustro (reguła „Testy wpięcia, nie obecności").
 */
import { act, fireEvent, render, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getPersonalTasks: vi.fn(),
  getDataContext: vi.fn(),
  get: vi.fn(),
  updatePersonalTask: vi.fn(),
}));

vi.mock('@/services/api', () => ({ Api: api }));
vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('@/i18n', () => ({
  default: { language: 'en', t: (_k: string, fb?: string) => fb || _k },
}));
vi.mock('react-i18next', () => {
  // STABILNE referencje: komponent memoizuje `fetchTasks` po `t` (useCallback),
  // a efekt `useEffect([fetchTasks])` odpala fetch. Gdyby `t` był nową funkcją
  // co render, fetchTasks i efekt tworzyłyby się na nowo → setLoading(true)
  // w pętli → drzewo migocze między tabelą a spinnerem (odczepia węzły).
  const t = (_k: string, fb?: string) => fb || _k;
  const i18n = { language: 'en' };
  return { useTranslation: () => ({ t, i18n }) };
});
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef(function MotionDiv(
      {
        children,
        initial: _i,
        animate: _a,
        exit: _e,
        transition: _t,
        ...props
      }: Record<string, unknown> & { children?: React.ReactNode },
      ref: React.Ref<HTMLDivElement>
    ) {
      return (
        <div ref={ref} {...props}>
          {children}
        </div>
      );
    }),
  },
}));

// StandardTable mock wywołuje PRAWDZIWE `column.render(row)` — dzięki temu
// komórki inline (status/priority/date) z produkcyjnego komponentu wykonują się.
vi.mock('@/components/standard', () => ({
  StandardTable: ({ columns, data }: any) => (
    <div data-testid="standard-table">
      {(data as any[]).map((row) => (
        <div key={row.id} data-testid={`row-${row.id}`}>
          {(columns as any[]).map((c) => (
            <div key={c.id} data-testid={`cell-${c.id}`}>
              {c.render(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/shared/ModuleHub/TableSettingsPopover', () => ({
  TableSettingsPopover: () => null,
}));
vi.mock('@/components/shared/PreviewPane', () => ({
  PreviewActionBar: () => null,
  PreviewAIHintStrip: () => null,
  PreviewDetailsSection: () => null,
  PreviewMetaCard: () => null,
  PreviewRelations: () => null,
}));
vi.mock('@/components/shared/RowActionsMenu', () => ({ RowActionsMenu: () => null }));
vi.mock('@/components/shared/selectionTokens', () => ({
  FOCUSED_ROW_CLASS: 'focused',
  PREVIEW_SELECTED_ROW_CLASS: 'preview',
  SELECTED_ROW_CLASS: 'selected',
}));
vi.mock('@/components/ui/primitives', () => ({ ErrorState: () => null }));
vi.mock('@/components/ui/primitives/chips/DueChip', () => ({
  deriveDueRisk: () => 'low',
  DueChip: ({ label }: any) => <span data-testid="due-chip">{label}</span>,
}));
vi.mock('@/components/ui/primitives/chips/EntityStatusChip', () => ({
  EntityStatusChip: ({ label }: any) => <span data-testid="status-chip">{label}</span>,
  statusChipTone: () => 'neutral',
}));
vi.mock('@/components/ui/ResizableTable', () => ({
  ColumnResizer: () => null,
  createTaskBulkActions: () => [],
  PRIORITY_FILTER_OPTIONS: [],
  TASK_STATUS_FILTER_OPTIONS: [],
}));
vi.mock('@/components/ui/ResizableTable/FilterDropdown', () => ({ FilterDropdown: () => null }));
vi.mock('@/utils/artifactLinks', () => ({ getArtifactPath: () => '#' }));
vi.mock('@/utils/clipboard', () => ({ copyAsMarkdown: vi.fn(), copyForSlack: vi.fn() }));
vi.mock('@/utils/listDateFormat', () => ({ formatListDate: (d: unknown) => String(d ?? '') }));
vi.mock('@/utils/m03TasksStandardTableFlag', () => ({
  isM03TasksStandardTableEnabled: () => true,
}));
vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({ showHelp: false, setShowHelp: vi.fn() }),
}));
vi.mock('../shared/BulkEditPopovers', () => ({
  BulkDatePicker: () => null,
  BulkPriorityPicker: () => null,
}));
vi.mock('../shared/ColumnConfigMenu', () => ({ ColumnConfigMenu: () => null }));
vi.mock('../shared/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ dialog: null, confirm: async () => true }),
}));
vi.mock('../shared/KeyboardShortcutsHelp', () => ({ KeyboardShortcutsHelp: () => null }));
vi.mock('../shared/SavedViewsMenu', () => ({ SavedViewsMenu: () => null }));
vi.mock('../shared/usePersistedColumnWidths', () => ({
  usePersistedColumnWidths: () => [{}, vi.fn()],
}));

import { MyTasksListContent } from '../MyTasksListContent';

const task = {
  id: 'task-1',
  // kebab-case (techniczne) wartości — bramka J0 (K4obj) flaguje angielskie
  // literały we właściwościach UI obiektu (`title`/`description`); test NIE
  // asertuje tekstu tytułu/opisu, więc używamy identyfikatorów, nie prozy.
  title: 'task-one-title',
  description: 'task-one-description',
  status: 'todo',
  priority: 'medium',
  dueDate: '2026-09-20',
  versionToken: 'v1',
};

const requiredProps = {
  activeFilter: 'all' as const,
  searchQuery: '',
  onTaskClick: vi.fn(),
  onCreateTask: vi.fn(),
  onCountsChange: vi.fn(),
};

const clickCell = (container: HTMLElement, colId: string) => {
  // Klik w WEWNĘTRZNY div (pierwszy potomek komórki) — tam siedzi onClick
  // otwierający dropdown; klik w sam wrapper `cell-*` nie zbąbelkowałby do
  // handlera. Otwarcie to zmiana stanu (`setOpenInlineCell`) → przerender,
  // więc węzeł komórki sprzed kliknięcia zostaje odłączony. Dlatego PO kliku
  // zwracamy ŚWIEŻO zapytany (live) węzeł — inaczej `within(stareCell)`
  // szukałby w odłączonym poddrzewie i `fireEvent.click` nie trafiłby w React.
  fireEvent.click(
    within(container).getByTestId(`cell-${colId}`).firstElementChild as Element
  );
  return within(container).getByTestId(`cell-${colId}`);
};

// `Api.getDataContext()` i `Api.get('/my-work/focus/state')` rozwiązują się
// asynchronicznie PO pierwszym renderze i przerenderowują listę (kolumny to
// `useMemo` zależny m.in. od `focusState`). Bez wypłukania tych promise'ów
// węzeł przycisku złapany przed kliknięciem zostaje odłączony od drzewa React
// i `fireEvent.click` nie trafia w handler. Dlatego najpierw stabilizujemy.
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('K-27 — due date / priority / status are inline-editable from the list (save wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getPersonalTasks.mockReset();
    api.getDataContext.mockReset();
    api.get.mockReset();
    api.updatePersonalTask.mockReset();
    api.getPersonalTasks.mockResolvedValue([task]);
    api.getDataContext.mockResolvedValue(null);
    api.get.mockResolvedValue(null);
    api.updatePersonalTask.mockImplementation((_id: string, updates: Record<string, unknown>) =>
      Promise.resolve({ ...updates })
    );
  });

  it('status: picking from the inline dropdown saves {status, expectedVersionToken}', async () => {
    const { container, getByTestId } = render(<MyTasksListContent {...requiredProps} />);
    await waitFor(() => expect(getByTestId('standard-table')).toBeTruthy());
    await settle();

    const cell = clickCell(container, 'statusFilter');
    fireEvent.click(within(cell).getByText('Review'));

    await waitFor(() =>
      expect(api.updatePersonalTask).toHaveBeenCalledWith('task-1', {
        status: 'review',
        expectedVersionToken: 'v1',
      })
    );
  });

  it('priority: picking from the inline dropdown saves {priority, expectedVersionToken}', async () => {
    const { container, getByTestId } = render(<MyTasksListContent {...requiredProps} />);
    await waitFor(() => expect(getByTestId('standard-table')).toBeTruthy());
    await settle();

    const cell = clickCell(container, 'priorityFilter');
    fireEvent.click(within(cell).getByText('High'));

    await waitFor(() =>
      expect(api.updatePersonalTask).toHaveBeenCalledWith('task-1', {
        priority: 'high',
        expectedVersionToken: 'v1',
      })
    );
  });

  it('dueDate: changing the inline <input type=date> saves {dueDate, expectedVersionToken}', async () => {
    const { container, getByTestId } = render(<MyTasksListContent {...requiredProps} />);
    await waitFor(() => expect(getByTestId('standard-table')).toBeTruthy());
    await settle();

    const cell = clickCell(container, 'date');
    const dateInput = cell.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(dateInput).toBeTruthy();
    fireEvent.change(dateInput as HTMLInputElement, { target: { value: '2026-09-30' } });

    await waitFor(() =>
      expect(api.updatePersonalTask).toHaveBeenCalledWith('task-1', {
        dueDate: '2026-09-30',
        expectedVersionToken: 'v1',
      })
    );
  });
});
