/**
 * @vitest-environment jsdom
 *
 * T6 — AuditsHub: lista programów + panel dashboardu.
 * Weryfikuje: loading state, empty state, lista z kartami, wybór programu,
 * obsługa błędu ładowania, otwieranie kreatora, kasowanie programu.
 *
 * The translation hook and the shared StandardTable/StandardPreview primitives
 * are deterministic test doubles. This suite owns the AuditsHub orchestration
 * contract; the shared primitives have their own focused contract suites.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) => {
      const translations: Record<string, string> = {
        'audit.newAuditProgram': 'New audit program',
        'audit.noAuditProgramsYet': 'No audit programs yet.',
        'audit.delete': 'Delete',
        'audit.surveysGenerated': 'Surveys generated',
        'audit.generateSurveys': 'Generate surveys',
        'audit.deleteThisAuditProgram': 'Delete this audit program?',
        'audit.failedToDelete': 'Failed to delete',
        'audit.iso27001': 'ISO 27001',
        'audit.loading': 'Loading...',
        'common.delete': 'Delete',
        'common.loading': 'Loading...',
      };
      if (typeof fallback === 'string') return fallback;
      return translations[key] || key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: any) => children,
  I18nextProvider: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockListPrograms = vi.fn();
const mockDeleteProgram = vi.fn();
const mockGenerateSurveys = vi.fn();
const mockGetCompletion = vi.fn();

vi.mock('../../../src/components/Audit/auditApi', () => ({
  listPrograms: (...args: unknown[]) => mockListPrograms(...args),
  deleteProgram: (...args: unknown[]) => mockDeleteProgram(...args),
  generateSurveys: (...args: unknown[]) => mockGenerateSurveys(...args),
  reopenProgram: vi.fn(),
  updateProgram: vi.fn(),
  getCompletion: (...args: unknown[]) => mockGetCompletion(...args),
}));

// Stub the wizard — just assert it gets opened, don't test its internals here.
vi.mock('../../../src/components/Audit/AuditOrchestratorWizard', () => ({
  AuditOrchestratorWizard: ({ open, onClose }: any) =>
    open ? (
      <div data-testid="audit-wizard">
        <button onClick={onClose}>close-wizard</button>
      </div>
    ) : null,
}));

// ModuleHub: passthrough shell + a functional FilterableTable stub. AuditsHub was
// refactored (M12 L-05/L-06) to the canonical §27 surface: ModuleHub shell +
// FilterableTable rows (one column-render per cell) inside TableWithPreviewLayout.
// The stub renders each column's render(row) so name/status/objective/count cells
// appear, plus a per-row select button and the row-actions menu (Generate/Delete).
vi.mock('../../../src/components/shared/ModuleHub', () => ({
  ModuleHub: ({ children, onNewItem, newItemLabel, rightControls }: any) => (
    <div data-testid="module-hub">
      <button onClick={onNewItem}>{newItemLabel}</button>
      {rightControls}
      {children}
    </div>
  ),
  FilterableTable: ({ data, columns, onRowClick, getRowActions, emptyMessage }: any) => {
    if (!data || data.length === 0) {
      return <div data-testid="ft-empty">{emptyMessage}</div>;
    }
    return (
      <div data-testid="ft-table">
        {data.map((row: any) => (
          <div key={row.id} data-testid={`ft-row-${row.id}`}>
            <button data-testid={`ft-select-${row.id}`} onClick={() => onRowClick?.(row)}>
              {columns.map((col: any) => (
                <span key={col.id}>{col.render ? col.render(row) : String(row[col.id] ?? '')}</span>
              ))}
            </button>
            {(getRowActions?.(row) ?? []).map((a: any) => (
              <button key={a.id} aria-label={a.label} disabled={a.disabled} onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

// Current Triada surface used by AuditsHub. Keep the double intentionally thin:
// render cells and row-menu actions so this suite verifies hub wiring without
// depending on StandardTable's own layout, portals or persisted preferences.
vi.mock('@/components/standard', () => ({
  StandardTable: ({ data, columns, onRowClick, empty, rowMenu }: any) => {
    if (!data || data.length === 0) {
      return (
        <div data-testid="standard-empty">
          <span>{empty?.title}</span>
          {empty?.onAction ? <button onClick={empty.onAction}>{empty.actionLabel}</button> : null}
        </div>
      );
    }
    return (
      <div data-testid="standard-table">
        {data.map((row: any) => {
          const menu = rowMenu?.(row) ?? {};
          const actions = [
            ...(menu.primary ?? []),
            ...(menu.statusTransitions ?? []),
            ...(menu.destructive ? [{ id: 'delete', label: 'Delete', ...menu.destructive }] : []),
          ];
          return (
            <div key={row.id} data-testid={`ft-row-${row.id}`}>
              <button data-testid={`ft-select-${row.id}`} onClick={() => onRowClick?.(row)}>
                {columns.map((col: any) => (
                  <span key={col.id}>
                    {col.render ? col.render(row) : String(row[col.id] ?? '')}
                  </span>
                ))}
              </button>
              {actions.map((action: any) => (
                <button
                  key={action.id}
                  aria-label={action.label}
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    );
  },
  StandardPreview: ({ title, actions }: any) => (
    <div data-testid="preview-pane">
      <span>{title}</span>
      {[...(actions?.informational ?? []), ...(actions?.resolutions ?? [])].map((action: any) => (
        <button
          key={action.id}
          aria-label={action.label}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  ),
  standardPreviewShortcuts: () => ({}),
}));

// TableWithPreviewLayout: render the table (children) and, when a row is selected,
// the preview pane (renderPreview(selectedItem)) — the per-program dashboard.
vi.mock('../../../src/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children, selectedItem, renderPreview }: any) => (
    <div data-testid="table-preview-layout">
      {children}
      {selectedItem ? <div data-testid="preview-pane">{renderPreview(selectedItem)}</div> : null}
    </div>
  ),
}));

// EntityStatusChip: render label as text.
vi.mock('../../../src/components/ui/primitives/chips', () => ({
  EntityStatusChip: ({ label }: any) => <span data-testid="status-chip">{label}</span>,
  MetaChip: ({ label }: any) => <span data-testid="meta-chip">{label}</span>,
  statusChipTone: () => 'neutral',
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProgram(
  overrides: Partial<{
    id: string;
    name: string;
    status: string;
    objective: string | null;
    templateIds: string[];
    assigneeIds: string[];
    surveysGenerated: boolean;
  }> = {}
) {
  return {
    id: overrides.id ?? 'prog-1',
    organizationId: 'org-1',
    name: overrides.name ?? 'ISO 27001 Audit',
    description: null,
    objective: overrides.objective ?? 'Ensure compliance',
    status: overrides.status ?? 'active',
    preset: null,
    config: {
      templateIds: overrides.templateIds ?? ['t-1'],
      assigneeIds: overrides.assigneeIds ?? ['u-1'],
      surveysGenerated: overrides.surveysGenerated ?? false,
    },
    createdBy: 'u-1',
    createdAt: '2026-06-17T00:00:00Z',
    updatedAt: '2026-06-17T00:00:00Z',
  };
}

const COMPLETION = { generated: false, total: 1, done: 0, percent: 0, byStatus: {} };

function renderHub() {
  return render(<AuditsHubUnderTest />);
}

// Import AFTER mocks are registered.
import { AuditsHub as AuditsHubUnderTest } from '../../../src/components/Audit/AuditsHub';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuditsHub — lista + dashboard (T6)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockGetCompletion.mockResolvedValue(COMPLETION);
    mockDeleteProgram.mockResolvedValue(undefined);
    mockGenerateSurveys.mockResolvedValue({
      program: makeProgram({ surveysGenerated: true }),
      requested: 1,
      created: 1,
      failed: 0,
      errors: [],
      alreadyGenerated: false,
    });
  });

  it('shows loading spinner on initial fetch', async () => {
    // Never resolves during this test — spinner persists
    mockListPrograms.mockReturnValue(new Promise(() => {}));
    renderHub();
    expect(screen.getByTestId('audits-hub')).toBeInTheDocument();
    expect(screen.getByText(/ładowanie|loading/i)).toBeInTheDocument();
  });

  it('shows empty state when no programs', async () => {
    mockListPrograms.mockResolvedValue({ programs: [], total: 0, limit: 50, offset: 0 });
    renderHub();
    await waitFor(() => {
      expect(screen.getByText('No audit programs yet.')).toBeInTheDocument();
    });
  });

  it('renders program list with name and status chip', async () => {
    mockListPrograms.mockResolvedValue({
      programs: [makeProgram({ name: 'Security Audit Q2', status: 'active' })],
      total: 1,
      limit: 50,
      offset: 0,
    });
    renderHub();
    await waitFor(() => {
      expect(screen.getByText('Security Audit Q2')).toBeInTheDocument();
    });
    expect(screen.getByTestId('status-chip')).toBeInTheDocument();
  });

  it('renders objective text under program name', async () => {
    mockListPrograms.mockResolvedValue({
      programs: [makeProgram({ objective: 'Reduce attack surface' })],
      total: 1,
      limit: 50,
      offset: 0,
    });
    renderHub();
    await waitFor(() => {
      expect(screen.getByText('Reduce attack surface')).toBeInTheDocument();
    });
  });

  it('shows template and assignee counts per program', async () => {
    mockListPrograms.mockResolvedValue({
      programs: [
        makeProgram({
          id: 'prog-counts',
          templateIds: ['t-1', 't-2'],
          assigneeIds: ['u-1', 'u-2', 'u-3'],
        }),
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
    renderHub();
    // §27 columns render the bare counts in dedicated cells (templates=2, assignees=3).
    await waitFor(() => {
      const row = screen.getByTestId('ft-row-prog-counts');
      expect(within(row).getByText('2')).toBeInTheDocument();
      expect(within(row).getByText('3')).toBeInTheDocument();
    });
  });

  it('shows error on load failure', async () => {
    mockListPrograms.mockRejectedValue(new Error('DB connection failed'));
    renderHub();
    await waitFor(() => {
      expect(screen.getByText(/db connection failed/i)).toBeInTheDocument();
    });
  });

  it('opens wizard on "New audit program" CTA', async () => {
    mockListPrograms.mockResolvedValue({ programs: [], total: 0, limit: 50, offset: 0 });
    renderHub();
    await waitFor(() => screen.queryByText(/ładowanie|loading/i) === null);

    const [newBtn] = screen.getAllByRole('button', { name: 'New audit program' });
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(screen.getByTestId('audit-wizard')).toBeInTheDocument();
    });
  });

  it('opens ISO 27001 wizard via right-controls button', async () => {
    mockListPrograms.mockResolvedValue({ programs: [], total: 0, limit: 50, offset: 0 });
    renderHub();
    await waitFor(() => screen.queryByText(/ładowanie|loading/i) === null);

    const isoBtn = screen.getByRole('button', { name: 'ISO 27001' });
    fireEvent.click(isoBtn);

    await waitFor(() => {
      expect(screen.getByTestId('audit-wizard')).toBeInTheDocument();
    });
  });

  it('closes wizard when wizard fires onClose', async () => {
    mockListPrograms.mockResolvedValue({ programs: [], total: 0, limit: 50, offset: 0 });
    renderHub();
    await waitFor(() => screen.queryByText(/ładowanie|loading/i) === null);

    fireEvent.click(screen.getAllByRole('button', { name: 'New audit program' })[0]);
    await waitFor(() => screen.getByTestId('audit-wizard'));

    fireEvent.click(screen.getByText('close-wizard'));
    await waitFor(() => {
      expect(screen.queryByTestId('audit-wizard')).not.toBeInTheDocument();
    });
  });

  it('calls deleteProgram and reloads list on confirm delete', async () => {
    const prog = makeProgram({ id: 'prog-del', name: 'To Delete' });
    mockListPrograms
      .mockResolvedValueOnce({ programs: [prog], total: 1, limit: 50, offset: 0 })
      .mockResolvedValueOnce({ programs: [], total: 0, limit: 50, offset: 0 });

    renderHub();
    await waitFor(() => screen.getByText('To Delete'));

    const delBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(delBtn);

    await waitFor(() => {
      expect(mockDeleteProgram).toHaveBeenCalledWith('prog-del');
    });
    await waitFor(() => {
      expect(screen.queryByText('To Delete')).not.toBeInTheDocument();
    });
  });

  it('selects a program by clicking its row — dashboard preview appears', async () => {
    const prog = makeProgram({ id: 'prog-click', name: 'Clickable Program' });
    mockListPrograms.mockResolvedValue({ programs: [prog], total: 1, limit: 50, offset: 0 });

    renderHub();
    await waitFor(() => screen.getByText('Clickable Program'));

    // Before selection the preview pane (per-program dashboard) is not mounted.
    expect(screen.queryByTestId('preview-pane')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ft-select-prog-click'));

    // After selection the preview pane renders the dashboard with the program name.
    await waitFor(() => {
      expect(screen.getByTestId('preview-pane')).toBeInTheDocument();
    });
    expect(
      within(screen.getByTestId('preview-pane')).getByText('Clickable Program')
    ).toBeInTheDocument();
  });

  it('shows "surveys generated" badge when surveysGenerated=true', async () => {
    mockListPrograms.mockResolvedValue({
      programs: [
        makeProgram({
          surveysGenerated: true,
          templateIds: ['t-1'],
          assigneeIds: ['u-1'],
        }),
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
    renderHub();
    await waitFor(() => {
      // The generate row action flips its label once surveys exist and disables
      // the idempotent transition.
      const genBtn = screen.getByRole('button', { name: 'Surveys generated' });
      expect(genBtn).toBeInTheDocument();
      expect(genBtn).toBeDisabled();
    });
  });
});
