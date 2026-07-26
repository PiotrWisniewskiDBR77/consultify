/**
 * P0.1 (2026-07-26) — Materiały: opening a document must show content, not the
 * generator intake form. Root cause (audit): resuming `/document-studio/:id`
 * (or `?artifactId=`) for an id that the runtime can't resolve — a stale link
 * pointing at a different engine's record, or a genuinely deleted document —
 * threw from `getDocumentStudioArtifact`, which set `error` but left `phase`
 * at 'intake'. The intake form then rendered with `error` as a soft banner,
 * indistinguishable from "start a brand-new document" — silent data-loss-
 * looking behavior, not an honest failure state.
 *
 * This pins the fix: a failed resume renders a BLOCKING Polish error state
 * (`data-testid="document-load-error"`), never the intake form.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/triModeFlag', () => ({
  isTriModeEnabled: () => false,
}));

vi.mock('@/components/shared/ExecutiveModuleShell', () => ({
  TopBar: () => <div data-testid="topbar-stub" />,
}));

vi.mock('@/components/shared/TriModeChooser', () => ({
  TriModeChooser: () => <div data-testid="tri-mode-chooser-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioDocumentPanel', () => ({
  DocumentStudioDocumentPanel: () => <div data-testid="document-panel-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioGeneratingPanel', () => ({
  DocumentStudioGeneratingPanel: () => <div data-testid="generating-panel-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioIntakeForm', () => ({
  // A canary: if this ever renders alongside/instead of the error state, the
  // regression is back — the test asserts it is ABSENT.
  DocumentStudioIntakeForm: () => <div data-testid="intake-form-stub">INTAKE FORM</div>,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioOutlinePanel', () => ({
  DocumentStudioOutlinePanel: () => <div data-testid="outline-panel-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioTemplateArchitectView', () => ({
  DocumentStudioTemplateArchitectView: () => <div data-testid="template-architect-stub" />,
}));

const getDocumentStudioArtifactMock = vi.fn();
const listDocumentStudioTemplatesMock = vi.fn();

vi.mock('@/components/DocumentStudio/api', () => {
  class MissingRequiredSourceError extends Error {}
  class TemplateResolveClientError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    generateDocumentStudioArtifact: vi.fn(),
    generateDocumentStudioArtifactStream: vi.fn(),
    getDocumentStudioArtifact: (...args: unknown[]) => getDocumentStudioArtifactMock(...args),
    listDocumentStudioTemplates: (...args: unknown[]) => listDocumentStudioTemplatesMock(...args),
    MissingRequiredSourceError,
    planDocumentStudioOutline: vi.fn(),
    resolveDocumentStudioTemplate: vi.fn(),
    TemplateResolveClientError,
  };
});

import { DocumentStudioView } from '@/components/DocumentStudio/DocumentStudioView';

function renderAtArtifact(artifactId: string) {
  return render(
    <MemoryRouter initialEntries={[`/document-studio/${artifactId}`]}>
      <Routes>
        <Route path="/document-studio/:artifactId" element={<DocumentStudioView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('DocumentStudioView — failed resume renders a blocking error, never the intake form', () => {
  beforeEach(() => {
    getDocumentStudioArtifactMock.mockReset();
    listDocumentStudioTemplatesMock.mockReset();
    listDocumentStudioTemplatesMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a Polish blocking error (not the intake form) when the artifact 404s', async () => {
    const err = new Error('document_not_found') as Error & { status?: number };
    err.status = 404;
    getDocumentStudioArtifactMock.mockRejectedValue(err);

    renderAtArtifact('missing-doc-1');

    const errorState = await screen.findByTestId('document-load-error');
    expect(errorState.textContent).toMatch(/Nie znaleziono tego dokumentu/i);
    expect(screen.queryByTestId('intake-form-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('document-panel-stub')).not.toBeInTheDocument();
  });

  it('renders a generic Polish blocking error for non-404 load failures (not the intake form)', async () => {
    const err = new Error('boom') as Error & { status?: number };
    err.status = 500;
    getDocumentStudioArtifactMock.mockRejectedValue(err);

    renderAtArtifact('report-builder-record-not-a-document-studio-id');

    const errorState = await screen.findByTestId('document-load-error');
    expect(errorState.textContent).toMatch(/Nie udało się załadować dokumentu/i);
    expect(screen.queryByTestId('intake-form-stub')).not.toBeInTheDocument();
  });

  it('renders the real document (not the error state) when the artifact loads successfully', async () => {
    getDocumentStudioArtifactMock.mockResolvedValue({
      schema: { title: 'A real document', sections: [] },
      generationWarnings: [],
    });

    renderAtArtifact('doc-studio-42');

    const panel = await screen.findByTestId('document-panel-stub');
    expect(panel).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('document-load-error')).not.toBeInTheDocument());
  });
});
