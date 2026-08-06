/**
 * N3 (2026-07-28) — doktryna streaming "na naszych oczach"
 * (`Harvard/wdrozenie-100/_DOKTRYNA_STREAMING_2026-07-27.md` §2/§7.4):
 *
 * Mode 3 (template) previously skipped straight to `generating`, the one
 * exception to "plan always shown" that Mode 1 already honored. It now goes
 * through the same `DocumentStudioOutlinePanel`, seeded client-side from the
 * already-loaded template's `sectionBlueprint` (zero extra round-trip) — one
 * click still confirms it, so the BANG flow speed (N11/N12) is unchanged.
 *
 * Uses the REAL `DocumentStudioOutlinePanel` (not stubbed) so the assertion
 * exercises the actual rendered plan screen, following the mocking pattern of
 * `DocumentStudioView.zaiTeresa.test.tsx` for everything else.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  DocumentStudioDocumentPanel: () => <div data-testid="document-panel-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioGeneratingPanel', () => ({
  DocumentStudioGeneratingPanel: () => <div data-testid="generating-panel-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioTemplateArchitectView', () => ({
  DocumentStudioTemplateArchitectView: () => <div data-testid="template-architect-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioAiEntryPanel', () => ({
  DocumentStudioAiEntryPanel: () => <div data-testid="ai-entry-panel-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioIntakeForm', () => ({
  DocumentStudioIntakeForm: (props: {
    onSubmit: (
      intake: unknown,
      options: {
        useLlm: boolean;
        templateId?: string;
        templateVersion?: string;
        sourceRefs?: unknown[];
      }
    ) => void;
  }) => (
    <div data-testid="intake-form-stub">
      <button
        type="button"
        onClick={() =>
          props.onSubmit(
            { description: 'Raport z audytu Q3.' },
            {
              useLlm: true,
              templateId: 'tpl-1',
              templateVersion: '1.0',
              sourceRefs: [
                { sourceType: 'url', sourceId: 'https://example.test/status', sourceTitle: 'Status' },
              ],
            }
          )
        }
      >
        mock-submit-template
      </button>
    </div>
  ),
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

const STUB_TEMPLATE = {
  templateId: 'tpl-1',
  organizationId: 'org-1',
  name: 'Raport z audytu',
  category: 'report',
  documentType: 'ai_audit_report',
  purpose: 'Raport z audytu AI dla klienta.',
  audience: ['CxO'],
  language: 'pl',
  languageStyle: 'formal',
  communicationRegister: 'executive',
  density: 'standard',
  confidentiality: 'internal',
  requiredInputs: [],
  sectionBlueprint: [
    {
      title: 'Streszczenie',
      level: 1,
      purpose: 'overview',
      required: true,
      expectedLengthHint: 'short',
    },
    {
      title: 'Ustalenia',
      level: 1,
      purpose: 'findings',
      required: true,
      expectedLengthHint: 'long',
    },
  ],
  exportRules: { docx: true, pdf: true, markdown: false, approvalRequiredForExport: false },
  status: 'approved',
  version: '1.0',
  createdBy: 'test',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('DocumentStudioView — N3 Mode 3 (template) shows the plan before generating', () => {
  beforeEach(() => {
    listDocumentStudioTemplatesMock.mockReset().mockResolvedValue([STUB_TEMPLATE]);
    generateDocumentStudioArtifactStreamMock.mockReset();
    generateDocumentStudioArtifactMock.mockReset();
    getDocumentStudioArtifactMock.mockReset();
    planDocumentStudioOutlineMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the plan (seeded from the template sectionBlueprint) before any generation call, then generates on one click without sending the preview outline', async () => {
    renderAt('/document-studio?entry=template');

    await screen.findByTestId('intake-form-stub');
    fireEvent.click(screen.getByText('mock-submit-template'));

    // Plan screen renders BEFORE any generation call — seeded client-side
    // from the template's sectionBlueprint, zero extra round-trip. (The
    // rendered text is "1. Streszczenie" / "2. Ustalenia" — regex substring
    // match, since exact getByText would need the full "N. Title" string.)
    await screen.findByText(/Streszczenie/);
    await screen.findByText(/Ustalenia/);
    expect(generateDocumentStudioArtifactStreamMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('generating-panel-stub')).not.toBeInTheDocument();

    generateDocumentStudioArtifactStreamMock.mockResolvedValue({
      artifactId: 'doc-tpl-1',
      schema: { title: 'Raport z audytu', sections: [] },
      generationWarnings: [],
    });

    // Same one-click gesture as before N3 — confirming the plan is not more
    // expensive than the old direct-to-generate flow.
    fireEvent.click(screen.getByRole('button', { name: /generate document/i }));

    await waitFor(() => {
      expect(generateDocumentStudioArtifactStreamMock).toHaveBeenCalledTimes(1);
    });
    const [params] = generateDocumentStudioArtifactStreamMock.mock.calls[0] as [
      { templateId?: string; templateVersion?: string; sourceRefs?: unknown[]; outline?: unknown },
    ];
    expect(params.templateId).toBe('tpl-1');
    expect(params.templateVersion).toBe('1.0');
    expect(params.sourceRefs).toEqual([
      { sourceType: 'url', sourceId: 'https://example.test/status', sourceTitle: 'Status' },
    ]);
    // The preview outline is for display only — the server remains the sole
    // source of truth for Mode 3's canonical outline (`outlineFromTemplate`
    // in `documentStudioService.ts`).
    expect(params.outline).toBeUndefined();
  });
});
