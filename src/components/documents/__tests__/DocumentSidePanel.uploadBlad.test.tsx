/**
 * @vitest-environment jsdom
 *
 * P-P05 (pilotaż Pawła 14.09, MEDIUM): „Document upload finishes silently but
 * the file never appears". Panel łykał plik, `handleFileUpload` wpisywał błąd
 * do `console.error` i na tym się kończyło — na ekranie ani potwierdzenia, ani
 * powodu. Dwie najczęstsze odmowy serwera to 400
 * `DOCUMENTS_PROJECT_ID_REQUIRED` (zakładka „Dokumenty projektu" bez projektu)
 * i zwykła porażka wysyłki.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  uploadDocumentToLibrary: vi.fn(),
  getProjectDocuments: vi.fn(),
  getUserDocuments: vi.fn(),
  createPersonalTask: vi.fn(),
  language: 'en' as 'en' | 'pl',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: hoisted.language },
    t: (
      key: string,
      defaultValue?: string | Record<string, unknown>,
      options?: Record<string, unknown>
    ) => {
      const catalogue: Record<string, Record<'en' | 'pl', string>> = {
        'documents.myDocs': { en: 'My documents', pl: 'Moje dokumenty' },
        'documents.createTask': { en: 'Create task', pl: 'Utwórz zadanie' },
        'documents.taskCreated': { en: 'Task created', pl: 'Zadanie utworzone' },
        'documents.reviewTaskTitle': {
          en: 'Review document: {{name}}',
          pl: 'Przejrzyj dokument: {{name}}',
        },
        'documents.reviewTaskDescription': {
          en: 'Review the source document and record the required follow-up.',
          pl: 'Przejrzyj dokument źródłowy i zapisz wymagane dalsze działania.',
        },
        'documents.taskCreateFailedWithReason': {
          en: 'Task creation failed: {{reason}}',
          pl: 'Nie udało się utworzyć zadania: {{reason}}',
        },
      };
      const values = (typeof defaultValue === 'object' ? defaultValue : options) || {};
      const template =
        catalogue[key]?.[hoisted.language] ||
        (typeof defaultValue === 'string' ? defaultValue : key);
      return template.replace(/{{(\w+)}}/g, (_match, name) => String(values[name] ?? ''));
    },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    uploadDocumentToLibrary: hoisted.uploadDocumentToLibrary,
    getProjectDocuments: hoisted.getProjectDocuments,
    getUserDocuments: hoisted.getUserDocuments,
    createPersonalTask: hoisted.createPersonalTask,
    moveDocumentToProject: vi.fn(),
    deleteDocument: vi.fn(),
    acknowledgeDocument: vi.fn(),
  },
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => ({
    activeSidePanel: 'DOCUMENTS',
    closeSidePanel: vi.fn(),
    currentUser: { id: 'u1', role: 'consultant' },
    setCurrentView: vi.fn(),
  }),
}));

const { DocumentSidePanel } = await import('../DocumentSidePanel');

function wyslijPlik() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const plik = new File(['x'], 'MapaRozwoju.pdf', { type: 'application/pdf' });
  Object.defineProperty(input, 'files', { value: [plik], configurable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.language = 'en';
  hoisted.getProjectDocuments.mockResolvedValue([]);
  hoisted.getUserDocuments.mockResolvedValue([]);
  hoisted.createPersonalTask.mockResolvedValue({ id: 'task-from-document-1' });
});

describe('S1.14 — dokument tworzy prawdziwe zadanie My Work', () => {
  it('wysyła źródło dokumentu i pokazuje odczytywalne potwierdzenie', async () => {
    hoisted.getUserDocuments.mockResolvedValue([
      {
        id: 'doc-7',
        originalName: 'Operational charter.docx',
        filename: 'operational-charter.docx',
        fileType: 'docx',
        fileSize: 1200,
        createdAt: '2026-09-15T00:00:00.000Z',
        status: 'ready',
      },
    ]);
    render(<DocumentSidePanel />);

    fireEvent.click(screen.getByRole('button', { name: 'My documents' }));
    expect(await screen.findByText('Operational charter.docx')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() =>
      expect(hoisted.createPersonalTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Review document: Operational charter.docx',
          sourceType: 'document',
          sourceId: 'doc-7',
          idempotencyKey: expect.any(String),
        })
      )
    );
    expect(await screen.findByText('Task created')).toBeInTheDocument();
  });

  it('blokuje podwójny zapis, gdy pierwsze żądanie nadal trwa', async () => {
    let finish!: (value: { id: string }) => void;
    hoisted.createPersonalTask.mockReturnValueOnce(
      new Promise<{ id: string }>((resolve) => {
        finish = resolve;
      })
    );
    hoisted.getUserDocuments.mockResolvedValue([
      {
        id: 'doc-7',
        originalName: 'Operational charter.docx',
        filename: 'operational-charter.docx',
        fileType: 'docx',
        fileSize: 1200,
        createdAt: '2026-09-15T00:00:00.000Z',
        status: 'ready',
      },
    ]);
    render(<DocumentSidePanel />);

    fireEvent.click(screen.getByRole('button', { name: 'My documents' }));
    const button = await screen.findByRole('button', { name: 'Create task' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(hoisted.createPersonalTask).toHaveBeenCalledTimes(1);
    finish({ id: 'task-from-document-1' });
    expect(await screen.findByText('Task created')).toBeInTheDocument();
  });

  it('po błędzie pokazuje powód i ponawia zapis z tym samym kluczem idempotencji', async () => {
    hoisted.createPersonalTask
      .mockRejectedValueOnce(new Error('Temporary gateway failure'))
      .mockResolvedValueOnce({ id: 'task-after-retry' });
    hoisted.getUserDocuments.mockResolvedValue([
      {
        id: 'doc-7',
        originalName: 'Operational charter.docx',
        filename: 'operational-charter.docx',
        fileType: 'docx',
        fileSize: 1200,
        createdAt: '2026-09-15T00:00:00.000Z',
        status: 'ready',
      },
    ]);
    render(<DocumentSidePanel />);

    fireEvent.click(screen.getByRole('button', { name: 'My documents' }));
    const button = await screen.findByRole('button', { name: 'Create task' });
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary gateway failure');
    fireEvent.click(button);
    expect(await screen.findByText('Task created')).toBeInTheDocument();

    expect(hoisted.createPersonalTask).toHaveBeenCalledTimes(2);
    const firstKey = hoisted.createPersonalTask.mock.calls[0][0].idempotencyKey;
    const retryKey = hoisted.createPersonalTask.mock.calls[1][0].idempotencyKey;
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(retryKey).toBe(firstKey);
  });

  it('w polskim interfejsie tworzy polski tytuł i pokazuje polski wynik', async () => {
    hoisted.language = 'pl';
    hoisted.getUserDocuments.mockResolvedValue([
      {
        id: 'doc-7',
        originalName: 'Karta operacyjna.docx',
        filename: 'karta-operacyjna.docx',
        fileType: 'docx',
        fileSize: 1200,
        createdAt: '2026-09-15T00:00:00.000Z',
        status: 'ready',
      },
    ]);
    render(<DocumentSidePanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Moje dokumenty' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Utwórz zadanie' }));

    await waitFor(() =>
      expect(hoisted.createPersonalTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Przejrzyj dokument: Karta operacyjna.docx',
          description: 'Przejrzyj dokument źródłowy i zapisz wymagane dalsze działania.',
        })
      )
    );
    expect(await screen.findByText('Zadanie utworzone')).toBeInTheDocument();
  });
});

describe('P-P05 — wysyłka dokumentu nie kończy się w ciszy', () => {
  it('pokazuje stan wysyłania i blokuje input do czasu odpowiedzi', async () => {
    let finishUpload!: (value: Record<string, unknown>) => void;
    hoisted.uploadDocumentToLibrary.mockReturnValue(
      new Promise<Record<string, unknown>>((resolve) => {
        finishUpload = resolve;
      })
    );
    render(<DocumentSidePanel />);
    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalled());

    wyslijPlik();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(screen.getByText('documents.uploading')).toBeInTheDocument();

    finishUpload({
      document: {
        id: 'doc-loading-1',
        originalName: 'MapaRozwoju.pdf',
        filename: 'mapa-rozwoju.pdf',
        createdAt: '2026-09-17T00:00:00.000Z',
        status: 'processing',
      },
    });
    expect(await screen.findByTestId('document-upload-success')).toBeInTheDocument();
    expect(input).not.toBeDisabled();
  });

  it('bez projektu startuje w Moich dokumentach i zachowuje potwierdzony upload mimo pustego readbacku', async () => {
    const uploaded = {
      id: 'doc-upload-1',
      originalName: 'MapaRozwoju.pdf',
      filename: 'mapa-rozwoju.pdf',
      fileType: 'pdf',
      fileSize: 1200,
      createdAt: '2026-09-17T00:00:00.000Z',
      status: 'processing',
    };
    hoisted.uploadDocumentToLibrary.mockResolvedValue({ document: uploaded });
    hoisted.getUserDocuments.mockResolvedValue([]);
    render(<DocumentSidePanel />);

    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalled());
    wyslijPlik();

    expect(await screen.findByTestId('document-upload-success')).toHaveTextContent(
      /MapaRozwoju\.pdf.*Processing/
    );
    expect(screen.getByText('MapaRozwoju.pdf')).toBeInTheDocument();
    expect(hoisted.uploadDocumentToLibrary).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ scope: 'user', projectId: undefined })
    );

    fireEvent.click(screen.getByTitle('Refresh document status'));
    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalledTimes(3));
    expect(screen.getByText('MapaRozwoju.pdf')).toBeInTheDocument();
  });

  it('odpowiedź bez document.id nie udaje sukcesu', async () => {
    hoisted.uploadDocumentToLibrary.mockResolvedValue({ message: 'ok' });
    render(<DocumentSidePanel />);
    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalled());

    wyslijPlik();

    expect(await screen.findByTestId('document-upload-error')).toHaveTextContent(
      /did not confirm the uploaded document/i
    );
    expect(screen.queryByTestId('document-upload-success')).not.toBeInTheDocument();
  });

  it.each([
    {
      document: {
        id: '   ',
        originalName: 'MapaRozwoju.pdf',
        status: 'processing',
      },
    },
    {
      document: {
        id: 'doc-without-name',
        status: 'processing',
      },
    },
    {
      document: {
        id: 'doc-without-status',
        originalName: 'MapaRozwoju.pdf',
      },
    },
    {
      document: {
        id: 'doc-unknown-status',
        originalName: 'MapaRozwoju.pdf',
        status: 'mystery',
      },
    },
  ])('nie potwierdza niepełnego rekordu 201: %#', async (response) => {
    hoisted.uploadDocumentToLibrary.mockResolvedValue(response);
    render(<DocumentSidePanel />);
    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalled());

    wyslijPlik();

    expect(await screen.findByTestId('document-upload-error')).toHaveTextContent(
      /did not confirm the uploaded document/i
    );
    expect(screen.queryByTestId('document-upload-success')).not.toBeInTheDocument();
    expect(screen.queryByText('MapaRozwoju.pdf')).not.toBeInTheDocument();
  });

  it('normalizuje nazwę z odpowiedzi 201, aby nie renderować pustego wiersza', async () => {
    hoisted.uploadDocumentToLibrary.mockResolvedValue({
      document: {
        id: ' doc-normalized-name ',
        originalName: '   ',
        filename: ' mapa-rozwoju.pdf ',
        status: ' READY ',
      },
    });
    render(<DocumentSidePanel />);
    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalled());

    wyslijPlik();

    expect(await screen.findByText('mapa-rozwoju.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('document-upload-success')).toHaveTextContent(
      /mapa-rozwoju\.pdf.*Ready/
    );
  });

  it('zachowuje bogatszy readback i chroni go przed kolejnym pustym odczytem', async () => {
    const postDocument = {
      id: 'doc-enriched-1',
      originalName: 'MapaRozwoju.pdf',
      filename: 'mapa-rozwoju.pdf',
      createdAt: '2026-09-17T00:00:00.000Z',
      status: 'processing',
    };
    const enrichedDocument = {
      ...postDocument,
      ownerName: 'Pawel Mroczkowski',
      processingState: { status: 'queued' },
    };
    hoisted.uploadDocumentToLibrary.mockResolvedValue({ document: postDocument });
    hoisted.getUserDocuments
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([enrichedDocument])
      .mockResolvedValueOnce([]);
    render(<DocumentSidePanel />);
    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalledTimes(1));

    wyslijPlik();

    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalledTimes(2));
    expect(await hoisted.getUserDocuments.mock.results[1].value).toEqual([enrichedDocument]);
    expect(await screen.findByText(/Pawel Mroczkowski/)).toBeInTheDocument();
    expect(screen.getByText('Queued for organization context processing.')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Refresh document status'));
    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalledTimes(3));
    expect(screen.getByText(/Pawel Mroczkowski/)).toBeInTheDocument();
    expect(screen.getByText('MapaRozwoju.pdf')).toBeInTheDocument();
  });

  it.each([
    ['partial_ready', 'Partially ready'],
    ['policy_blocked', 'Blocked by policy'],
  ])('pokazuje czytelną etykietę statusu %s', async (status, label) => {
    hoisted.uploadDocumentToLibrary.mockResolvedValue({
      document: {
        id: `doc-${status}`,
        originalName: 'MapaRozwoju.doc',
        filename: 'mapa-rozwoju.doc',
        createdAt: '2026-09-17T00:00:00.000Z',
        status,
      },
    });
    render(<DocumentSidePanel />);
    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalled());

    wyslijPlik();

    expect(await screen.findByTestId('document-upload-success')).toHaveTextContent(label);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('z projektu zachowuje scope/projectId i nie duplikuje wiersza z readbacku', async () => {
    const uploaded = {
      id: 'doc-project-1',
      originalName: 'MapaRozwoju.pdf',
      filename: 'mapa-rozwoju.pdf',
      fileType: 'pdf',
      fileSize: 1200,
      createdAt: '2026-09-17T00:00:00.000Z',
      status: 'ready',
    };
    hoisted.getProjectDocuments.mockResolvedValueOnce([]).mockResolvedValueOnce([uploaded]);
    hoisted.uploadDocumentToLibrary.mockResolvedValue({ document: uploaded });
    render(<DocumentSidePanel projectId="project-7" />);
    await waitFor(() => expect(hoisted.getProjectDocuments).toHaveBeenCalledWith('project-7'));

    wyslijPlik();

    expect(await screen.findByTestId('document-upload-success')).toHaveTextContent(/Ready/);
    expect(screen.getAllByText('MapaRozwoju.pdf')).toHaveLength(1);
    expect(hoisted.uploadDocumentToLibrary).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ scope: 'project', projectId: 'project-7' })
    );
  });

  it('odmowa serwera pokazuje powód na ekranie, nie tylko w konsoli', async () => {
    hoisted.uploadDocumentToLibrary.mockRejectedValue(new Error('Failed to upload document'));
    render(<DocumentSidePanel projectId="proj-1" />);
    await waitFor(() => expect(hoisted.getProjectDocuments).toHaveBeenCalled());

    wyslijPlik();

    const alert = await screen.findByTestId('document-upload-error');
    expect(alert).toHaveTextContent(/MapaRozwoju\.pdf/);
    expect(alert).toHaveTextContent(/Failed to upload document/);
  });

  it('bez projektu nie oferuje aktywnej zakładki uploadu projektowego', async () => {
    render(<DocumentSidePanel />);
    await waitFor(() => expect(hoisted.getUserDocuments).toHaveBeenCalled());

    const projectTab = screen.getByRole('button', { name: 'documents.projectDocs' });
    expect(projectTab).toBeDisabled();
    expect(projectTab).toHaveAttribute(
      'title',
      'Open Documents from a project to add project documents.'
    );
    expect(projectTab).toHaveAccessibleDescription(
      'Open Documents from a project to add project documents.'
    );
    expect(
      screen.getByText('Open Documents from a project to add project documents.')
    ).toBeVisible();
  });
});
