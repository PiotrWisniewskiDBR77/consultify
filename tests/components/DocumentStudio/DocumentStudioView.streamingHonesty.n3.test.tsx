/**
 * N3 (2026-07-28) — doktryna streaming "na naszych oczach"
 * (`Harvard/wdrozenie-100/_DOKTRYNA_STREAMING_2026-07-27.md`):
 *
 *   (a) §4/§7.1 — a dropped SSE stream no longer falls back to the
 *       synchronous `/generate` path silently. `runStreamingGeneration`
 *       (DocumentStudioView.tsx) now surfaces a visible, non-blocking Polish
 *       notice ("Połączenie na żywo zerwane — dokańczam w tle…") BEFORE
 *       retrying — generation still completes (it is not blocked, only made
 *       honest).
 *   (b) §2/§7.3 — Stop button parity with Canvas (`useCanvasAIStream.ts`):
 *       `DocumentStudioGeneratingPanel` gets a Stop control wired to an
 *       `AbortController` on the view. Aborting returns to a consistent
 *       phase with no error banner and no synchronous fallback — the same
 *       contract Canvas's `stopStream` already has.
 *   (c) §5/§7.2 — `section.blocks[].sourceRef` already flowed over the
 *       `section` SSE event server-side but was discarded on render. It is
 *       now deduped and shown as "Based on: X, Y" chips under each finished
 *       section while the document is still being written.
 *
 * (d) — Mode 3 (template) plan-before-generate — is covered separately in
 * `DocumentStudioView.templatePlan.n3.test.tsx` (a later, independent commit).
 *
 * Uses the REAL `DocumentStudioGeneratingPanel` (not stubbed) so the
 * assertions exercise the actual rendered UI, following the mocking pattern
 * of `DocumentStudioView.zaiTeresa.test.tsx` /
 * `DocumentStudioView.resumeError.test.tsx` for everything else.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/triModeFlag', () => ({
  isTriModeEnabled: () => false,
}));

vi.mock('@/utils/zaiTeresaFlag', () => ({
  isZaiTeresaEnabled: () => false,
}));

vi.mock('@/components/shared/ExecutiveModuleShell', () => ({
  TopBar: () => <div data-testid="topbar-stub" />,
}));

vi.mock('@/components/shared/TriModeChooser', () => ({
  TriModeChooser: () => <div data-testid="tri-mode-chooser-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioDocumentPanel', () => ({
  DocumentStudioDocumentPanel: ({
    schema,
  }: {
    schema: { sections?: Array<{ title: string }> };
  }) => (
    <div data-testid="document-panel-stub">
      {schema.sections?.map((section) => section.title).join('|')}
    </div>
  ),
}));

vi.mock('@/components/DocumentStudio/DocumentStudioTemplateArchitectView', () => ({
  DocumentStudioTemplateArchitectView: () => <div data-testid="template-architect-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioAiEntryPanel', () => ({
  DocumentStudioAiEntryPanel: () => <div data-testid="ai-entry-panel-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioIntakeForm', () => ({
  DocumentStudioIntakeForm: () => <div data-testid="intake-form-stub">INTAKE FORM</div>,
}));

const generateDocumentStudioArtifactStreamMock = vi.fn();
const generateDocumentStudioArtifactMock = vi.fn();
const listDocumentStudioTemplatesMock = vi.fn();
const getDocumentStudioArtifactMock = vi.fn();
const planDocumentStudioOutlineMock = vi.fn();

vi.mock('@/components/DocumentStudio/api', () => {
  class MissingRequiredSourceError extends Error {
    missing: string[];
    constructor(missing: string[]) {
      super('missing_required_source');
      this.missing = missing;
    }
  }
  class TemplateResolveClientError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    generateDocumentStudioArtifact: (...args: unknown[]) =>
      generateDocumentStudioArtifactMock(...args),
    generateDocumentStudioArtifactStream: (...args: unknown[]) =>
      generateDocumentStudioArtifactStreamMock(...args),
    getDocumentStudioArtifact: (...args: unknown[]) => getDocumentStudioArtifactMock(...args),
    listDocumentStudioTemplates: (...args: unknown[]) => listDocumentStudioTemplatesMock(...args),
    MissingRequiredSourceError,
    planDocumentStudioOutline: (...args: unknown[]) => planDocumentStudioOutlineMock(...args),
    resolveDocumentStudioTemplate: vi.fn(),
    TemplateResolveClientError,
  };
});

import { DocumentStudioView } from '@/components/DocumentStudio/DocumentStudioView';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/document-studio" element={<DocumentStudioView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('DocumentStudioView — N3 doktryna streaming honesty fixes', () => {
  beforeEach(() => {
    listDocumentStudioTemplatesMock.mockReset().mockResolvedValue([]);
    generateDocumentStudioArtifactStreamMock.mockReset();
    generateDocumentStudioArtifactMock.mockReset();
    getDocumentStudioArtifactMock.mockReset();
    planDocumentStudioOutlineMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('(a) a dropped SSE stream shows a visible notice, never a silent fallback — and still completes', async () => {
    generateDocumentStudioArtifactStreamMock.mockRejectedValue(
      new Error('stream transport failed')
    );
    let resolveSync!: (value: unknown) => void;
    generateDocumentStudioArtifactMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        })
    );

    // `?entry=blank` auto-triggers `handleCreateEmptyDoc`, which runs through
    // the same `runStreamingGeneration` as every other entry mode — the
    // shortest path to a live stream attempt without driving the full form.
    renderAt('/document-studio?entry=blank');

    const notice = await screen.findByTestId('document-studio-stream-notice');
    expect(notice.textContent).toMatch(/Połączenie na żywo zerwane/i);
    // The old behavior: nothing rendered here at all while the sync retry
    // ran silently. This assertion is the regression guard for that.
    expect(screen.getByTestId('document-studio-generating')).toBeInTheDocument();

    resolveSync({
      artifactId: 'doc-1',
      schema: { title: 'Nowy dokument', sections: [] },
      generationWarnings: [],
    });

    await waitFor(() => {
      expect(screen.getByTestId('document-panel-stub')).toBeInTheDocument();
    });
    expect(generateDocumentStudioArtifactMock).toHaveBeenCalledTimes(1);
  });

  it('(b) clicking Stop aborts the in-flight stream and returns to a consistent state — no fallback, no error', async () => {
    let capturedSignal: AbortSignal | undefined;
    generateDocumentStudioArtifactStreamMock.mockImplementation(
      (_params: unknown, _handlers: unknown, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          capturedSignal = signal;
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    renderAt('/document-studio?entry=blank');

    const stopButton = await screen.findByTestId('document-studio-stop-generation');
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(capturedSignal?.aborted).toBe(true);
    });

    // Consistent state: the generating panel is gone, no fallback fired, no
    // error surfaced anywhere on screen.
    await waitFor(() => {
      expect(screen.queryByTestId('document-studio-generating')).not.toBeInTheDocument();
    });
    expect(generateDocumentStudioArtifactMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('(c) sourceRef chips from the section SSE event are rendered while the document is being written', async () => {
    generateDocumentStudioArtifactStreamMock.mockImplementation(
      (
        _params: unknown,
        handlers: {
          onPlan: (outline: unknown) => void;
          onSection: (event: unknown) => void;
        }
      ) => {
        handlers.onPlan({
          documentType: 'generic_document',
          title: 'Nowy dokument',
          sections: [{ title: 'Sekcja 1', level: 1, purpose: '', expectedLengthHint: 'short' }],
          recommendedDensity: 'concise',
          recommendedRegister: 'professional',
          recommendedLanguageStyle: 'formal',
        });
        handlers.onSection({
          sectionId: 'sec-1',
          index: 0,
          total: 1,
          title: 'Sekcja 1',
          blocks: [
            {
              blockId: 'b1',
              type: 'paragraph',
              content: 'x',
              sourceRef: { sourceType: 'interview', sourceId: 'int-4', sourceTitle: 'Wywiad #4' },
            },
            {
              blockId: 'b2',
              type: 'paragraph',
              content: 'y',
              // Same source referenced twice — must be deduped, not shown twice.
              sourceRef: { sourceType: 'interview', sourceId: 'int-4', sourceTitle: 'Wywiad #4' },
            },
            {
              blockId: 'b3',
              type: 'paragraph',
              content: 'z',
              sourceRef: { sourceType: 'insight', sourceId: 'ins-12', sourceTitle: 'Insight #12' },
            },
          ],
        });
        // Never resolves — the test only needs the mid-stream render.
        return new Promise(() => {});
      }
    );

    renderAt('/document-studio?entry=blank');

    const sourcesRow = await screen.findByTestId('generating-section-0-sources');
    expect(within(sourcesRow).getByText('Wywiad #4')).toBeInTheDocument();
    expect(within(sourcesRow).getByText('Insight #12')).toBeInTheDocument();
    // Deduped: "Wywiad #4" appears once even though two blocks referenced it.
    expect(within(sourcesRow).getAllByText('Wywiad #4')).toHaveLength(1);
  });

  it('(d) mounts the persisted canonical schema after done, never the progressive raw section state', async () => {
    const canonicalSections = Array.from({ length: 7 }, (_, index) => ({
      sectionId: `canonical-${index}`,
      title: `Canonical ${index + 1}`,
      orderIndex: index,
      blocks: [],
    }));
    generateDocumentStudioArtifactStreamMock.mockImplementation(
      async (_params: unknown, handlers: { onSection: (event: unknown) => void }) => {
        handlers.onSection({
          sectionId: 'raw-1',
          index: 0,
          total: 1,
          title: 'Vendor delays and resource reallocation',
          blocks: [{ blockId: 'raw-block', type: 'paragraph', content: 'progressive raw prose' }],
        });
        return {
          artifactId: 'artifact-canonical',
          schema: { artifactId: 'artifact-canonical', title: 'Done', sections: canonicalSections },
          generationWarnings: [],
        };
      }
    );
    getDocumentStudioArtifactMock.mockResolvedValue({
      schema: { artifactId: 'artifact-canonical', title: 'Reloaded', sections: canonicalSections },
      generationWarnings: [],
    });

    renderAt('/document-studio?entry=blank');

    const panel = await screen.findByTestId('document-panel-stub');
    expect(panel).toHaveTextContent('Canonical 1|Canonical 2|Canonical 3');
    expect(panel).not.toHaveTextContent(/vendor delays|reallocation|progressive raw/i);
    expect(getDocumentStudioArtifactMock).toHaveBeenCalledWith('artifact-canonical');
  });
});
