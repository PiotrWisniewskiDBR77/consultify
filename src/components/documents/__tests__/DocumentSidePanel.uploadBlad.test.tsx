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
}));

vi.mock('@/services/api', () => ({
  Api: {
    uploadDocumentToLibrary: hoisted.uploadDocumentToLibrary,
    getProjectDocuments: hoisted.getProjectDocuments,
    getUserDocuments: hoisted.getUserDocuments,
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
  hoisted.getProjectDocuments.mockResolvedValue([]);
  hoisted.getUserDocuments.mockResolvedValue([]);
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
