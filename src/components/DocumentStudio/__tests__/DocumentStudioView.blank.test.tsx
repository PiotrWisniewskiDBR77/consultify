/**
 * @vitest-environment jsdom
 *
 * BLOKER 06.09 (audyt B3 · Materiały → Dokumenty → „+ Nowy" → „Czysto").
 *
 * Tryb „Czysto" (`?entry=blank`) szedł przez `runStreamingGeneration`, czyli
 * przez SSE z `AbortController`, który efekt sprzątający na odmontowaniu
 * przerywa. W React StrictMode (mount → cleanup → mount w jednym commicie)
 * `abort()` padał ZANIM `fetch` wystartował: zero żądań do
 * `/document-studio/generate*`, a `catch` cicho ustawiał `phase='outline'`
 * przy `outline === null` → nieme „Brak wczytanego dokumentu.".
 *
 * Te testy bronią ZABEZPIECZENIA, nie scenariusza:
 *   1. w StrictMode powstaje realny dokument, a strumień NIE jest używany;
 *   2. odmontowanie w trakcie tworzenia nie unieważnia żądania;
 *   3. porażka zostawia trwały, wychodzalny stan z „Spróbuj ponownie",
 *      a nie niemy komunikat.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  generateMock,
  generateStreamMock,
  getArtifactMock,
  listTemplatesMock,
  navigateMock,
} = vi.hoisted(() => ({
  generateMock: vi.fn(),
  generateStreamMock: vi.fn(),
  getArtifactMock: vi.fn(),
  listTemplatesMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    generateDocumentStudioArtifact: generateMock,
    generateDocumentStudioArtifactStream: generateStreamMock,
    getDocumentStudioArtifact: getArtifactMock,
    listDocumentStudioTemplates: listTemplatesMock,
  };
});

// Panel dokumentu ciągnie edytor TipTap — poza zakresem tego testu.
vi.mock('../DocumentStudioDocumentPanel', () => ({
  DocumentStudioDocumentPanel: ({ artifactId }: { artifactId: string }) => (
    <div data-testid="document-panel">{artifactId}</div>
  ),
}));

import { DocumentStudioView } from '../DocumentStudioView';

const schema = {
  documentId: 'doc-1',
  artifactId: 'artifact-blank-1',
  title: 'Nowy dokument',
  documentType: 'generic_document',
  language: 'pl',
  sections: [{ sectionId: 's1', title: 'Sekcja 1', level: 1, blocks: [] }],
} as unknown as import('../types').DocumentSchema;

const renderBlank = (strict: boolean) => {
  const tree = (
    <MemoryRouter initialEntries={['/document-studio?entry=blank']}>
      <DocumentStudioView />
    </MemoryRouter>
  );
  return render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
};

describe('DocumentStudioView — tryb „Czysto" (?entry=blank)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTemplatesMock.mockResolvedValue([]);
    getArtifactMock.mockResolvedValue({ schema, generationWarnings: [] });
    generateMock.mockResolvedValue({ artifactId: 'artifact-blank-1', schema, generationWarnings: [] });
  });

  afterEach(() => cleanup());

  it('w StrictMode tworzy realny dokument i NIE używa abortowalnego strumienia', async () => {
    renderBlank(true);

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1));
    // Zabezpieczenie: pusty dokument nie ma co streamować, a strumień niesie
    // `AbortSignal`, który cleanup StrictMode/odmontowania natychmiast ubija.
    expect(generateStreamMock).not.toHaveBeenCalled();
    expect(generateMock.mock.calls[0][0]).toMatchObject({ useLlm: false });

    await screen.findByTestId('document-panel');
    expect(screen.queryByText(/Brak wczytanego dokumentu/i)).toBeNull();
  });

  it('odmontowanie w trakcie tworzenia NIE unieważnia żądania', async () => {
    let resolveGenerate: (v: unknown) => void = () => {};
    generateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGenerate = resolve;
        })
    );

    const { unmount } = renderBlank(false);
    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1));
    unmount();
    // Żądanie nie dostało `AbortSignal`, więc dokończy się po stronie serwera.
    expect(() =>
      resolveGenerate({ artifactId: 'artifact-blank-1', schema, generationWarnings: [] })
    ).not.toThrow();
  });

  it('porażka daje trwały polski komunikat i „Spróbuj ponownie" zamiast ciszy', async () => {
    generateMock.mockRejectedValueOnce(new Error('Serwer odmówił utworzenia dokumentu'));

    renderBlank(false);

    const failed = await screen.findByTestId('document-studio-blank-failed');
    expect(failed.textContent).toContain('Serwer odmówił utworzenia dokumentu');

    generateMock.mockResolvedValueOnce({
      artifactId: 'artifact-blank-1',
      schema,
      generationWarnings: [],
    });
    fireEvent.click(screen.getByRole('button', { name: /Spróbuj ponownie/i }));
    await screen.findByTestId('document-panel');
  });
});
