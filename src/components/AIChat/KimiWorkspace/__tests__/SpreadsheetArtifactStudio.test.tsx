import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArtifactPreview } from '../KimiWorkspaceShell';
import { SpreadsheetArtifactStudio } from '../SpreadsheetArtifactStudio';

const openChatWithContext = vi.fn();
const editSelectedCell = vi.fn();
const clearSelectedCell = vi.fn();
const copySelection = vi.fn();
const cutSelection = vi.fn();
const pasteSelection = vi.fn();
const undo = vi.fn();
const redo = vi.fn();
const selectCell = vi.fn();
const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  listWorkbookComments: vi.fn(),
  createWorkbookComment: vi.fn(),
  setWorkbookCommentStatus: vi.fn(),
  listWorkbookSourceBindings: vi.fn(),
  bindWorkbookSource: vi.fn(),
  unbindWorkbookSource: vi.fn(),
  applyWorkbookCommands: vi.fn(),
  undoWorkbookCommand: vi.fn(),
  listWorkbookRevisions: vi.fn(),
  restoreWorkbookRevision: vi.fn(),
  renameWorkbook: vi.fn(),
  updateWorkbookGovernance: vi.fn(),
  getWorkbookApprovalState: vi.fn(),
  submitWorkbookForReview: vi.fn(),
  approveWorkbook: vi.fn(),
  rejectWorkbook: vi.fn(),
  getWorkbookSchema: vi.fn(),
}));

vi.mock('@/services/api', () => ({ Api: apiMocks }));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => openChatWithContext,
}));

vi.mock('../EditableSpreadsheetGrid', () => ({
  EditableSpreadsheetGrid: React.forwardRef(
    (
      {
        activeSheetIndex,
        onSelectionChange,
        onSaveStateChange,
        onSelectionContextMenu,
      }: {
        activeSheetIndex: number;
        onSelectionChange?: (selection: unknown) => void;
        onSaveStateChange?: (state: string) => void;
        onSelectionContextMenu?: (payload: unknown) => void;
      },
      ref
    ) => {
      React.useImperativeHandle(ref, () => ({
        editSelectedCell,
        clearSelectedCell,
        copySelection,
        cutSelection,
        pasteSelection,
        undo,
        redo,
        selectCell,
      }));
      return (
        <div data-testid="controlled-grid">
          <button
            type="button"
            onClick={() => {
              onSelectionChange?.({ rowIndex: 0, colIndex: 1, address: 'KPI Control!B2' });
              onSaveStateChange?.('saved');
            }}
          >
            sheet:{activeSheetIndex}
          </button>
          <button
            type="button"
            onClick={() =>
              onSelectionChange?.({
                rowIndex: 0,
                endRowIndex: 1,
                colIndex: 0,
                address: 'KPI Control!1:2',
                kind: 'row',
              })
            }
          >
            zaznacz wiersze
          </button>
          <button
            type="button"
            onClick={() =>
              onSelectionChange?.({
                rowIndex: 0,
                colIndex: 0,
                endColIndex: 1,
                address: 'KPI Control!A:B',
                kind: 'column',
              })
            }
          >
            zaznacz kolumny
          </button>
          <button
            type="button"
            onContextMenu={(event) => {
              event.preventDefault();
              onSelectionContextMenu?.({
                x: 120,
                y: 180,
                selection: {
                  rowIndex: 1,
                  colIndex: 3,
                  kind: 'cell',
                  address: 'KPI Control!D3',
                  rawValue: '=B3-C3',
                },
              });
            }}
          >
            menu komórki
          </button>
        </div>
      );
    }
  ),
}));

const preview: ArtifactPreview = {
  type: 'xlsx',
  title: 'Executive KPI Control',
  workbookId: 'wb-1',
  sheetNames: ['KPI Control', 'Assumptions'],
  rawSheets: [
    {
      id: '5dc36b14-f35e-48c6-a3c4-32ffeb4e8edf',
      name: 'KPI Control',
      columns: [],
      rows: [],
    },
    {
      id: '73cbc658-8d52-4599-b720-b87599daf480',
      name: 'Assumptions',
      columns: [],
      rows: [],
    },
  ],
};

const searchPreview: ArtifactPreview = {
  ...preview,
  rawSheets: [
    {
      ...preview.rawSheets![0],
      columns: [
        { key: 'metric', header: 'Metric' },
        { key: 'value', header: 'Value' },
      ],
      rows: [
        {
          cells: {
            metric: { value: 'Conversion rate' },
            value: { value: 21.2 },
          },
        },
      ],
    },
    {
      ...preview.rawSheets![1],
      columns: [{ key: 'assumption', header: 'Assumption' }],
      rows: [{ cells: { assumption: { value: 'Conversion baseline' } } }],
    },
  ],
};

describe('SpreadsheetArtifactStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.get.mockResolvedValue({ users: [] });
    apiMocks.getWorkbookApprovalState.mockResolvedValue({
      workbookVersion: 0,
      currentForVersion: false,
      state: 'draft',
      assignment: null,
    });
    apiMocks.submitWorkbookForReview.mockResolvedValue({
      state: 'review',
      currentForVersion: false,
      assignment: {
        id: 'assignment-1',
        assigned_to_user_id: 'reviewer-2',
        status: 'PENDING',
      },
    });
    apiMocks.approveWorkbook.mockResolvedValue({
      state: 'approved',
      currentForVersion: true,
      assignment: {
        id: 'assignment-1',
        assigned_to_user_id: 'reviewer-2',
        status: 'APPROVED',
      },
    });
    apiMocks.rejectWorkbook.mockResolvedValue({
      state: 'rejected',
      currentForVersion: false,
      assignment: {
        id: 'assignment-1',
        assigned_to_user_id: 'reviewer-2',
        status: 'REJECTED',
      },
    });
    apiMocks.listWorkbookComments.mockResolvedValue({ comments: [] });
    apiMocks.createWorkbookComment.mockResolvedValue({ id: 'comment-2', duplicate: false });
    apiMocks.setWorkbookCommentStatus.mockResolvedValue({
      ok: true,
      id: 'comment-1',
      status: 'resolved',
    });
    apiMocks.listWorkbookSourceBindings.mockResolvedValue({ bindings: [] });
    apiMocks.bindWorkbookSource.mockResolvedValue({
      id: 'binding-1',
      duplicate: false,
      version: 1,
    });
    apiMocks.unbindWorkbookSource.mockResolvedValue({ ok: true, id: 'binding-1', version: 2 });
    apiMocks.applyWorkbookCommands.mockResolvedValue({ version: 1 });
    apiMocks.undoWorkbookCommand.mockResolvedValue({ version: 2 });
    apiMocks.listWorkbookRevisions.mockResolvedValue({ revisions: [] });
    apiMocks.restoreWorkbookRevision.mockResolvedValue({
      ok: true,
      sourceVersion: 1,
      version: 4,
    });
    apiMocks.renameWorkbook.mockResolvedValue({
      ok: true,
      title: 'Executive KPI Control 2027',
      version: 1,
      unchanged: false,
    });
    apiMocks.updateWorkbookGovernance.mockResolvedValue({
      ok: true,
      classification: 'public',
      lifecycleStatus: 'draft',
      approvalCurrent: false,
      version: 0,
      unchanged: false,
    });
    apiMocks.getWorkbookSchema.mockResolvedValue({
      id: 'wb-1',
      title: preview.title,
      description: null,
      sheets: preview.rawSheets,
    });
  });

  it('uses one-line artifact chrome, one left panel and no local right rail', () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('spreadsheet-artifact-studio')).toHaveAttribute(
      'data-artifact-studio',
      'true'
    );
    expect(screen.getByTestId('spreadsheet-sheets-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('mels-right-rail')).not.toBeInTheDocument();
    expect(screen.queryByText(/Task completed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Replay|Remix/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eksportuj XLSX' })).toBeInTheDocument();
  });

  it('renames the workbook from Menu2 and adopts the returned version', async () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('mels-topbar-title'));
    const input = screen.getByTestId('mels-topbar-title-input');
    fireEvent.change(input, { target: { value: 'Executive KPI Control 2027' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(apiMocks.renameWorkbook).toHaveBeenCalledWith('wb-1', 'Executive KPI Control 2027', 0)
    );
    expect(await screen.findByText('Executive KPI Control 2027')).toBeInTheDocument();
  });

  it('changes classification from Menu2 with an explicit downgrade reason', async () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={{ ...preview, workbookClassification: 'internal' }}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Wewnętrzny' }));
    expect(screen.getByRole('dialog', { name: 'Klasyfikacja skoroszytu' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Uzasadnienie obniżenia klasyfikacji'), {
      target: { value: 'Materiał zatwierdzony do publikacji.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publiczny' }));

    await waitFor(() =>
      expect(apiMocks.updateWorkbookGovernance).toHaveBeenCalledWith('wb-1', {
        field: 'classification',
        value: 'public',
        baseVersion: 0,
        reason: 'Materiał zatwierdzony do publikacji.',
      })
    );
    expect(await screen.findByRole('button', { name: 'Publiczny' })).toBeInTheDocument();
  });

  it('requires an assigned reviewer instead of exposing direct review or approval transitions', async () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={{ ...preview, workbookLifecycle: 'draft', workbookApprovalCurrent: false }}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Szkic' }));
    await waitFor(() => expect(apiMocks.getWorkbookApprovalState).toHaveBeenCalledWith('wb-1'));
    expect(screen.queryByRole('button', { name: 'Zatwierdzony' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Do przeglądu' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalny' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Przekaż do przeglądu' })).toBeDisabled();
    expect(screen.getByText('Brak dostępnego recenzenta innego niż autor.')).toBeInTheDocument();
  });

  it('submits the workbook to an explicitly selected reviewer', async () => {
    apiMocks.get.mockResolvedValue({
      users: [
        {
          id: 'reviewer-2',
          first_name: 'Anna',
          last_name: 'Kowalska',
          email: 'anna@example.com',
        },
      ],
    });

    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={{ ...preview, workbookLifecycle: 'draft', workbookApprovalCurrent: false }}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Szkic' }));
    fireEvent.click(await screen.findByRole('button', { name: /Anna Kowalska/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Przekaż do przeglądu' }));

    await waitFor(() =>
      expect(apiMocks.submitWorkbookForReview).toHaveBeenCalledWith('wb-1', 'reviewer-2')
    );
    expect(await screen.findByText('W przeglądzie')).toBeInTheDocument();
  });

  it('lets the assigned review workflow approve the current workbook version', async () => {
    apiMocks.getWorkbookApprovalState.mockResolvedValue({
      workbookVersion: 0,
      currentForVersion: false,
      state: 'review',
      assignment: {
        id: 'assignment-1',
        assigned_to_user_id: 'reviewer-2',
        status: 'PENDING',
      },
    });

    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={{ ...preview, workbookLifecycle: 'in_review', workbookApprovalCurrent: false }}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Do przeglądu' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Zatwierdź' }));

    await waitFor(() => expect(apiMocks.approveWorkbook).toHaveBeenCalledWith('wb-1'));
    expect(await screen.findByRole('button', { name: 'Zatwierdzony' })).toBeInTheDocument();
  });

  it('switches the controlled grid and opens the global Teresa context', () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Assumptions' }));
    expect(screen.getByTestId('controlled-grid')).toHaveTextContent('sheet:1');

    fireEvent.click(screen.getByRole('button', { name: 'Teresa' }));
    expect(openChatWithContext).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'workbook',
        entityId: 'wb-1',
        contextData: expect.objectContaining({ activeSheetName: 'Assumptions' }),
      })
    );
  });

  it('shows persisted sources and itemized QA findings without reducing QA to a score', async () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={{
            ...preview,
            sourcePack: { sources: [{ title: 'Finance close July' }] },
            evidenceRefs: [{ label: 'CRM snapshot 2026-08-05' }],
            qualityReport: {
              score: 75,
              passed: false,
              issues: [
                {
                  code: 'MISSING_SOURCE',
                  severity: 'critical',
                  blocking: true,
                  sheet: 'Assumptions',
                  cell: 'B2',
                  message: 'Brak zatwierdzonego źródła dla założenia.',
                  fix: 'Przypisz dowód.',
                },
              ],
            },
          }}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Źródła i założenia' }));
    expect(screen.getByTestId('spreadsheet-sources-panel')).toHaveTextContent('Finance close July');
    expect(screen.getByTestId('spreadsheet-sources-panel')).toHaveTextContent(
      'CRM snapshot 2026-08-05'
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Kontrola jakości' }));
    expect(screen.getByTestId('spreadsheet-qa-panel')).toHaveTextContent(
      'Brak zatwierdzonego źródła dla założenia.'
    );
    expect(screen.getByTestId('spreadsheet-qa-panel')).not.toHaveTextContent('75');

    fireEvent.click(screen.getByRole('button', { name: /Brak zatwierdzonego źródła/ }));
    await waitFor(() => expect(selectCell).toHaveBeenCalledWith(1, 1));
  });

  it('jumps from a persisted source anchor to its workbook cell', async () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={{
            ...preview,
            evidenceRefs: [
              {
                label: 'CRM snapshot 2026-08-05',
                sheet: 'Assumptions',
                cell: 'B2',
              },
            ],
          }}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Źródła i założenia' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Przejdź do źródła CRM snapshot 2026-08-05' })
    );

    await waitFor(() => expect(selectCell).toHaveBeenCalledWith(1, 1));
  });

  it('opens an Office-like selection menu and passes an explicit versioned selection to global Teresa', () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={{ ...preview, workbookVersion: 12 }}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.contextMenu(screen.getByRole('button', { name: 'menu komórki' }));

    expect(screen.getByTestId('spreadsheet-selection-context-menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Kopiuj/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Przekaż Teresie' }));

    expect(openChatWithContext).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'workbook',
        entityId: 'wb-1',
        contextData: expect.objectContaining({
          versionId: 12,
          selection: expect.objectContaining({
            address: 'KPI Control!D3',
            rawValue: '=B3-C3',
            sheetName: 'KPI Control',
          }),
        }),
      })
    );
  });

  it('shows only real cell commands after selection and dispatches them to the grid', () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: 'Edytuj komórkę' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'sheet:0' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edytuj komórkę' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść zawartość' }));

    expect(editSelectedCell).toHaveBeenCalledOnce();
    expect(clearSelectedCell).toHaveBeenCalledOnce();
    expect(screen.getByText('KPI Control!B2')).toBeInTheDocument();
  });

  it('shows numeric selection statistics and controls canvas zoom from the bottom bar', () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={searchPreview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'sheet:0' }));

    expect(screen.getByLabelText('Statystyki zaznaczenia')).toHaveTextContent('Suma: 21,2');
    expect(screen.getByLabelText('Statystyki zaznaczenia')).toHaveTextContent('Średnia: 21,2');
    expect(screen.getByLabelText('Statystyki zaznaczenia')).toHaveTextContent('Licznik: 1');

    fireEvent.click(screen.getByRole('button', { name: 'Powiększ arkusz' }));
    expect(screen.getByRole('button', { name: 'Dopasuj arkusz' })).toHaveTextContent('110%');
    expect(screen.getByTestId('spreadsheet-grid-zoom-surface')).toHaveStyle({
      transform: 'scale(1.1)',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dopasuj arkusz' }));
    expect(screen.getByRole('button', { name: 'Dopasuj arkusz' })).toHaveTextContent('100%');
  });

  it('creates and resolves an anchored workbook comment from the left panel', async () => {
    apiMocks.listWorkbookComments
      .mockResolvedValueOnce({
        comments: [
          {
            id: 'comment-1',
            body: 'Sprawdź źródło wartości.',
            sheet_id: '5dc36b14-f35e-48c6-a3c4-32ffeb4e8edf',
            range_ref: 'B2',
            status: 'open',
          },
        ],
      })
      .mockResolvedValueOnce({ comments: [] });

    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'sheet:0' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Komentarze' }));

    expect(await screen.findByText('Sprawdź źródło wartości.')).toBeInTheDocument();
    expect(screen.getByLabelText('Komentarz do KPI Control!B2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rozwiąż' }));
    await waitFor(() =>
      expect(apiMocks.setWorkbookCommentStatus).toHaveBeenCalledWith(
        'wb-1',
        'comment-1',
        'resolved'
      )
    );

    fireEvent.change(screen.getByLabelText('Komentarz do KPI Control!B2'), {
      target: { value: 'Potwierdź założenie.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj komentarz' }));

    await waitFor(() =>
      expect(apiMocks.createWorkbookComment).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({
          body: 'Potwierdź założenie.',
          anchor: {
            sheetId: '5dc36b14-f35e-48c6-a3c4-32ffeb4e8edf',
            range: 'B2',
          },
        })
      )
    );
  });

  it('adds a sheet through the versioned command contract and exposes real sheet actions', async () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj arkusz' }));

    await waitFor(() =>
      expect(apiMocks.applyWorkbookCommands).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({
          commandId: 'xlsx.sheet.add',
          baseVersion: 0,
          operations: [
            expect.objectContaining({
              type: 'addSheet',
              name: 'Arkusz 3',
              sheetId: expect.any(String),
            }),
          ],
        })
      )
    );
    expect(await screen.findByRole('button', { name: 'Arkusz 3' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Akcje arkusza KPI Control' }));
    expect(screen.getByRole('menuitem', { name: 'Zmień nazwę' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplikuj' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Ukryj' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Usuń' })).toBeInTheDocument();
  });

  it('renames a sheet and can undo the structural revision', async () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Akcje arkusza KPI Control' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zmień nazwę' }));
    const input = screen.getByRole('textbox', { name: 'Nowa nazwa arkusza KPI Control' });
    fireEvent.change(input, { target: { value: 'KPI Zarząd' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByRole('button', { name: 'KPI Zarząd' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij' }));

    await waitFor(() => expect(apiMocks.undoWorkbookCommand).toHaveBeenCalledWith('wb-1', 1, 1));
    expect(await screen.findByRole('button', { name: 'KPI Control' })).toBeInTheDocument();
  });

  it('closes the sheet action menu with Escape', () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Akcje arkusza KPI Control' }));
    expect(screen.getByRole('menuitem', { name: 'Zmień nazwę' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: 'Zmień nazwę' })).not.toBeInTheDocument();
  });

  it('applies cell formatting through the versioned workbook command contract', async () => {
    const formattingPreview: ArtifactPreview = {
      ...preview,
      rawSheets: [
        {
          ...preview.rawSheets![0],
          columns: [
            { key: 'metric', label: 'Metric' },
            { key: 'value', label: 'Value' },
          ],
          rows: [{ cells: { metric: { value: 'Conversion' }, value: { value: 21.2 } } }],
        },
        preview.rawSheets![1],
      ],
    };
    apiMocks.getWorkbookSchema.mockResolvedValueOnce({
      id: 'wb-1',
      title: formattingPreview.title,
      description: null,
      sheets: formattingPreview.rawSheets,
    });
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={formattingPreview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'sheet:0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pogrubienie' }));

    await waitFor(() =>
      expect(apiMocks.applyWorkbookCommands).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({
          commandId: 'xlsx.format.bold',
          baseVersion: 0,
          operations: [
            {
              type: 'setCellStyle',
              sheetIndex: 0,
              startRow: 0,
              endRow: 0,
              startColumn: 1,
              endColumn: 1,
              patch: { bold: true },
            },
          ],
        })
      )
    );
    expect(apiMocks.getWorkbookSchema).toHaveBeenCalledWith('wb-1');
  });

  it('applies a selected-row insertion and refreshes from the authoritative workbook schema', async () => {
    const refreshedSheets = [
      { ...preview.rawSheets![0], rows: [{ cells: {} }, { cells: {} }] },
      preview.rawSheets![1],
    ];
    apiMocks.getWorkbookSchema.mockResolvedValueOnce({
      id: 'wb-1',
      title: preview.title,
      description: null,
      sheets: refreshedSheets,
    });

    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'zaznacz wiersze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Więcej narzędzi' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wstaw wiersz wyżej' }));

    await waitFor(() =>
      expect(apiMocks.applyWorkbookCommands).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({
          commandId: 'xlsx.row.insertAbove',
          operations: [{ type: 'insertRows', sheetIndex: 0, atIndex: 0, count: 2 }],
        })
      )
    );
    expect(apiMocks.getWorkbookSchema).toHaveBeenCalledWith('wb-1');
  });

  it('finds a workbook value and focuses its exact cell through the grid handle', async () => {
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={searchPreview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Znajdź' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Szukany tekst' }), {
      target: { value: 'conversion' },
    });

    expect(screen.getByText('1 z 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Następny' }));
    await waitFor(() => expect(selectCell).toHaveBeenCalledWith(0, 0));
  });

  it('replaces every workbook match as one versioned atomic command', async () => {
    apiMocks.getWorkbookSchema.mockResolvedValueOnce({
      id: 'wb-1',
      title: searchPreview.title,
      description: null,
      sheets: searchPreview.rawSheets,
    });
    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={searchPreview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Znajdź i zamień' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Szukany tekst' }), {
      target: { value: 'Conversion' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Zamień na' }), {
      target: { value: 'Activation' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Zakres wyszukiwania' }), {
      target: { value: 'workbook' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zamień wszystko (2)' }));

    await waitFor(() =>
      expect(apiMocks.applyWorkbookCommands).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({
          commandId: 'xlsx.replace.all',
          baseVersion: 0,
          operations: [
            expect.objectContaining({
              type: 'setCell',
              sheetIndex: 0,
              rowIndex: 0,
              columnKey: 'metric',
              value: 'Activation rate',
            }),
            expect.objectContaining({
              type: 'setCell',
              sheetIndex: 1,
              rowIndex: 0,
              columnKey: 'assumption',
              value: 'Activation baseline',
            }),
          ],
        })
      )
    );
    expect(apiMocks.getWorkbookSchema).toHaveBeenCalledWith('wb-1');
  });

  it('lists workbook versions and restores a selected revision as a new head', async () => {
    apiMocks.listWorkbookRevisions
      .mockResolvedValueOnce({
        revisions: [
          {
            id: 'revision-3',
            version: 3,
            command_id: 'xlsx.cell.edit',
            created_by: 'Piotr',
            created_at: '2026-08-09T10:00:00.000Z',
          },
          {
            id: 'revision-1',
            version: 1,
            command_id: 'xlsx.sheet.add',
            created_by: 'Teresa',
            created_at: '2026-08-09T09:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ revisions: [] });
    apiMocks.getWorkbookSchema.mockResolvedValue({
      id: 'wb-1',
      title: preview.title,
      description: null,
      sheets: preview.rawSheets,
    });
    vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(true);

    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={{ ...preview, workbookVersion: 3 }}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Historia wersji' }));
    expect(await screen.findByText('Wersja 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Przywróć' }));

    await waitFor(() =>
      expect(apiMocks.restoreWorkbookRevision).toHaveBeenCalledWith('wb-1', 1, 3)
    );
    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Przywrócić wersję 1 jako nową wersję skoroszytu?'
    );
    expect(apiMocks.getWorkbookSchema).toHaveBeenCalledWith('wb-1');
  });

  it('binds a source to the selected cell and reads it back in the Sources panel', async () => {
    apiMocks.listWorkbookSourceBindings
      .mockResolvedValueOnce({ bindings: [] })
      .mockResolvedValueOnce({
        bindings: [
          {
            id: 'binding-1',
            sheetId: '5dc36b14-f35e-48c6-a3c4-32ffeb4e8edf',
            sheet: 'KPI Control',
            range: 'B2',
            label: 'CRM snapshot 2026-08-05',
            sourceRef: 'crm://snapshot/2026-08-05',
            sourceType: 'user',
            anchoredVersion: 1,
            createdBy: 'user-1',
            createdAt: '2026-08-09T10:00:00.000Z',
          },
        ],
      });

    render(
      <MemoryRouter>
        <SpreadsheetArtifactStudio
          preview={preview}
          workbookId="wb-1"
          onDownload={vi.fn()}
          onCopyLink={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'sheet:0' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Źródła i założenia' }));
    fireEvent.change(await screen.findByLabelText('Powiąż źródło z zaznaczeniem'), {
      target: { value: 'CRM snapshot 2026-08-05' },
    });
    fireEvent.change(screen.getByLabelText('Odnośnik do źródła'), {
      target: { value: 'crm://snapshot/2026-08-05' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Powiąż z zaznaczeniem' }));

    await waitFor(() =>
      expect(apiMocks.bindWorkbookSource).toHaveBeenCalledWith(
        'wb-1',
        expect.objectContaining({
          sheetId: '5dc36b14-f35e-48c6-a3c4-32ffeb4e8edf',
          range: 'B2',
          label: 'CRM snapshot 2026-08-05',
          sourceRef: 'crm://snapshot/2026-08-05',
          baseVersion: 0,
        })
      )
    );
    expect(await screen.findByText('CRM snapshot 2026-08-05')).toBeInTheDocument();
    expect(screen.getByText('KPI Control · B2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuń powiązanie' })).toBeInTheDocument();
  });
});
