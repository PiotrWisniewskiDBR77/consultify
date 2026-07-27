/**
 * FAZA B1 (2026-07-27) — `DocumentStudioView` × `ff_zai_teresa` wiring.
 *
 * Pins the `docEntryMode === 'ai'` branch added to remove the intake form
 * from the "Z AI" flow (N11/N12,
 * Harvard/wdrozenie-100/_NAGRANIE_PIOTRA_WIZJA_MATERIALY_2026-07-27.md):
 *
 *   (a) flag ON  + `?entry=ai`       -> `DocumentStudioAiEntryPanel`, NOT the
 *                                       intake form (no Density/Goal/Audience
 *                                       fields anywhere on screen).
 *   (b) first chat message           -> `generateDocumentStudioArtifactStream`
 *                                       is called directly (no outline-review
 *                                       step — BANG, same as Mode 3), with an
 *                                       intake built from sane defaults and
 *                                       WITHOUT client-supplied `sourceRefs` —
 *                                       the precondition for the server's
 *                                       auto-grounding (`autoGroundGenerateRequest`
 *                                       in `document-studio.routes.ts`) to
 *                                       fire, exactly like every other caller
 *                                       of this endpoint. Once the stream
 *                                       resolves, the view lands on the
 *                                       document panel.
 *   (c) flag OFF + `?entry=ai`       -> byte-identical old behavior (intake
 *                                       form, not the new panel).
 *   (d) `?entry=blank` / `?entry=template` -> untouched by the flag either way.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/triModeFlag', () => ({
  isTriModeEnabled: () => false,
}));

const isZaiTeresaEnabledMock = vi.fn(() => false);
vi.mock('@/utils/zaiTeresaFlag', () => ({
  isZaiTeresaEnabled: () => isZaiTeresaEnabledMock(),
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
  DocumentStudioIntakeForm: () => <div data-testid="intake-form-stub">INTAKE FORM</div>,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioOutlinePanel', () => ({
  DocumentStudioOutlinePanel: () => <div data-testid="outline-panel-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioTemplateArchitectView', () => ({
  DocumentStudioTemplateArchitectView: () => <div data-testid="template-architect-stub" />,
}));

let capturedAiEntryProps: any = null;
vi.mock('@/components/DocumentStudio/DocumentStudioAiEntryPanel', () => ({
  DocumentStudioAiEntryPanel: (props: any) => {
    capturedAiEntryProps = props;
    return (
      <div data-testid="ai-entry-panel-stub">
        <button
          type="button"
          onClick={() =>
            props.onFirstMessage('Przygotuj raport dla zarządu z wynikami audytu Q3.')
          }
        >
          mock-send-first-message
        </button>
      </div>
    );
  },
}));

const generateDocumentStudioArtifactStreamMock = vi.fn();
const generateDocumentStudioArtifactMock = vi.fn();
const listDocumentStudioTemplatesMock = vi.fn();
const getDocumentStudioArtifactMock = vi.fn();
const planDocumentStudioOutlineMock = vi.fn();

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

describe('DocumentStudioView — ff_zai_teresa (FAZA B1: "Z AI" bez formularza)', () => {
  beforeEach(() => {
    isZaiTeresaEnabledMock.mockReturnValue(false);
    capturedAiEntryProps = null;
    listDocumentStudioTemplatesMock.mockReset().mockResolvedValue([]);
    generateDocumentStudioArtifactStreamMock.mockReset();
    generateDocumentStudioArtifactMock.mockReset();
    getDocumentStudioArtifactMock.mockReset();
    planDocumentStudioOutlineMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('(a) flag ON + ?entry=ai renders the AI entry panel, never the intake form', async () => {
    isZaiTeresaEnabledMock.mockReturnValue(true);
    renderAt('/document-studio?entry=ai');

    const panel = await screen.findByTestId('ai-entry-panel-stub');
    expect(panel).toBeInTheDocument();
    expect(screen.queryByTestId('intake-form-stub')).not.toBeInTheDocument();
  });

  it('(b) first chat message calls generate/stream directly (no outline step) with a defaulted intake and no client sourceRefs; success lands on the document panel', async () => {
    isZaiTeresaEnabledMock.mockReturnValue(true);
    generateDocumentStudioArtifactStreamMock.mockResolvedValue({
      artifactId: 'doc-123',
      schema: { title: 'Raport dla zarządu', sections: [] },
      generationWarnings: [],
    });

    renderAt('/document-studio?entry=ai');
    const panel = await screen.findByTestId('ai-entry-panel-stub');
    expect(panel).toBeInTheDocument();

    fireEvent.click(screen.getByText('mock-send-first-message'));

    await waitFor(() => {
      expect(generateDocumentStudioArtifactStreamMock).toHaveBeenCalledTimes(1);
    });

    const [params] = generateDocumentStudioArtifactStreamMock.mock.calls[0] as [
      {
        intake: {
          description: string;
          documentType?: string;
          density?: string;
          goal?: string;
          audience?: string[];
        };
        outline?: unknown;
        useLlm?: boolean;
        templateId?: string;
        sourceRefs?: unknown;
      },
    ];

    // Defaults preserved under the hood (item 3 of the brief): the fields the
    // old form collected did not vanish from the system, only from the screen.
    expect(params.intake.description).toBe(
      'Przygotuj raport dla zarządu z wynikami audytu Q3.'
    );
    expect(params.intake.documentType).toBeUndefined();
    expect(params.intake.density).toBe('standard');
    expect(params.intake.goal).toBe('inform');
    expect(params.intake.audience).toBeUndefined();
    // No outline preview step (BANG, N11/N12) — same shape Mode 3 already uses.
    expect(params.outline).toBeUndefined();
    expect(params.useLlm).toBe(true);
    expect(params.templateId).toBeUndefined();
    // No client-supplied sourceRefs: precondition for server auto-grounding.
    expect(params.sourceRefs).toBeUndefined();

    await waitFor(() => {
      expect(screen.getByTestId('document-panel-stub')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ai-entry-panel-stub')).not.toBeInTheDocument();
  });

  it('(c) flag OFF + ?entry=ai renders the old intake form, never the AI entry panel', async () => {
    isZaiTeresaEnabledMock.mockReturnValue(false);
    renderAt('/document-studio?entry=ai');

    const form = await screen.findByTestId('intake-form-stub');
    expect(form).toBeInTheDocument();
    expect(screen.queryByTestId('ai-entry-panel-stub')).not.toBeInTheDocument();
  });

  it('(d) ?entry=blank is untouched by the flag — auto-creates without showing either intake surface', async () => {
    isZaiTeresaEnabledMock.mockReturnValue(true);
    generateDocumentStudioArtifactStreamMock.mockResolvedValue({
      artifactId: 'blank-doc-1',
      schema: { title: 'Nowy dokument', sections: [] },
      generationWarnings: [],
    });

    renderAt('/document-studio?entry=blank');

    await waitFor(() => {
      expect(generateDocumentStudioArtifactStreamMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('ai-entry-panel-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('intake-form-stub')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('document-panel-stub')).toBeInTheDocument();
    });
  });

  it('(d) ?entry=template is untouched by the flag — still renders the intake form (Mode 3 picker)', async () => {
    isZaiTeresaEnabledMock.mockReturnValue(true);
    renderAt('/document-studio?entry=template');

    const form = await screen.findByTestId('intake-form-stub');
    expect(form).toBeInTheDocument();
    expect(screen.queryByTestId('ai-entry-panel-stub')).not.toBeInTheDocument();
  });
});
