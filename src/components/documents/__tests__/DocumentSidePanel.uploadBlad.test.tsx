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
    t: (key: string, defaultValue?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
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
  it('odmowa serwera pokazuje powód na ekranie, nie tylko w konsoli', async () => {
    hoisted.uploadDocumentToLibrary.mockRejectedValue(new Error('Failed to upload document'));
    render(<DocumentSidePanel projectId="proj-1" />);
    await waitFor(() => expect(hoisted.getProjectDocuments).toHaveBeenCalled());

    wyslijPlik();

    const alert = await screen.findByTestId('document-upload-error');
    expect(alert).toHaveTextContent(/MapaRozwoju\.pdf/);
    expect(alert).toHaveTextContent(/Failed to upload document/);
  });

  it('zakładka „Dokumenty projektu" bez projektu mówi o tym ZANIM wyśle plik', async () => {
    render(<DocumentSidePanel />);
    await waitFor(() => expect(hoisted.getUserDocuments).not.toHaveBeenCalled());

    wyslijPlik();

    expect(await screen.findByTestId('document-upload-error')).toBeInTheDocument();
    expect(hoisted.uploadDocumentToLibrary).not.toHaveBeenCalled();
  });
});
