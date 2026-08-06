/**
 * B4 — export UX states of the DocumentStudioDocumentPanel.
 *
 * Verifies, with a mocked API layer:
 *   - loading: per-format spinner + all export buttons disabled while a
 *     (synchronous, single-flight) export request is in flight;
 *   - success: toast.success fires, the inline success note with the
 *     "Share links" hint appears and is dismissible;
 *   - success with export-time warnings: the warnings chip renders with
 *     the export-specific summary and reveals messages on expand;
 *   - error: a readable, i18n-framed alert (no bare technical message);
 *   - QA block: the QaBlockingError path renders the blocking banner.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (registered before the panel import below).
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, arg?: string | Record<string, unknown>) => {
      const opts: Record<string, unknown> =
        typeof arg === 'string' ? { defaultValue: arg } : (arg ?? {});
      const template = typeof opts.defaultValue === 'string' ? (opts.defaultValue as string) : key;
      return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(opts[name] ?? ''));
    },
  }),
}));

vi.mock('react-hot-toast', () => {
  const toast = { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() };
  return { toast, default: toast };
});

// The shared shell brings rails/shortcuts/persistence — out of scope here.
// Render only what the export UX lives in: the canvas.
vi.mock('@/components/shared/ExecutiveModuleShell', () => ({
  ExecutiveModuleShell: ({
    canvas,
    leftRailContent,
  }: {
    canvas: React.ReactNode;
    leftRailContent: React.ReactNode;
  }) => (
    <div>
      <aside data-testid="shell-left-rail">{leftRailContent}</aside>
      <div data-testid="shell-canvas">{canvas}</div>
    </div>
  ),
}));

vi.mock('@/components/DocumentStudio/editor', () => ({
  DocumentTipTapEditor: () => <div data-testid="tiptap-stub" />,
}));

vi.mock('@/components/DocumentStudio/DocumentStudioQaPanel', () => ({
  DocumentStudioQaPanel: () => <div data-testid="qa-panel-stub" />,
}));

vi.mock('@/services/executionModuleStandard/api', () => ({
  fetchExecutionModuleManifest: vi.fn(),
  validateExecutionModuleManifest: vi.fn(),
}));

vi.mock('@/utils/sheetArtifactOpen', () => ({
  buildMyWorkSheetTableOpenPath: vi.fn(() => '/my-work'),
  resolveTablePlatformWorkspaceIdForTable: vi.fn(async () => null),
}));

vi.mock('@/components/DocumentStudio/api', () => {
  class QaBlockingError extends Error {
    readonly code = 'qa_blocking';
    readonly report: unknown;
    constructor(report: unknown, message?: string) {
      super(message ?? 'QA blocking findings prevent export');
      this.name = 'QaBlockingError';
      this.report = report;
    }
  }
  class QaOverrideUnauthorizedError extends Error {
    readonly code = 'qa_override_unauthorized';
    readonly role: string | null;
    constructor(message: string, role: string | null = null) {
      super(message);
      this.name = 'QaOverrideUnauthorizedError';
      this.role = role;
    }
  }
  return {
    QaBlockingError,
    QaOverrideUnauthorizedError,
    exportDocumentStudioArtifact: vi.fn(),
    getDocumentStudioPolicy: vi.fn(async () => ({ canOverrideQa: false, role: null })),
    cancelDocumentStudioApproval: vi.fn(),
    createDocumentStudioComment: vi.fn(),
    createDocumentStudioShareLink: vi.fn(),
    getDocumentStudioAccessHistory: vi.fn(async () => []),
    getDocumentStudioCommentThreads: vi.fn(async () => []),
    getDocumentStudioSchemaDiff: vi.fn(),
    getDocumentStudioVariant: vi.fn(),
    insertDocumentStudioContentBlock: vi.fn(),
    instantiateDocumentStudioContentBlock: vi.fn(),
    listDocumentStudioApprovals: vi.fn(async () => []),
    listDocumentStudioContentBlocks: vi.fn(async () => []),
    listDocumentStudioShareLinks: vi.fn(async () => []),
    listDocumentStudioVariants: vi.fn(async () => []),
    recordDocumentStudioApprovalDecision: vi.fn(),
    requestDocumentStudioApproval: vi.fn(),
    saveDocumentStudioManualContent: vi.fn(),
    getDocumentStudioArtifact: vi.fn(),
  };
});

// Imported after the mocks above are registered.
/* eslint-disable import/first */
import { toast } from 'react-hot-toast';

import {
  exportDocumentStudioArtifact,
  QaBlockingError,
  saveDocumentStudioManualContent,
} from '@/components/DocumentStudio/api';
import DocumentStudioDocumentPanel from '@/components/DocumentStudio/DocumentStudioDocumentPanel';
import type { DocumentSchema } from '@/components/DocumentStudio/types';
/* eslint-enable import/first */

const exportMock = vi.mocked(exportDocumentStudioArtifact);
const saveContentMock = vi.mocked(saveDocumentStudioManualContent);

const SCHEMA: DocumentSchema = {
  documentId: 'doc-1',
  artifactId: 'art-1',
  title: 'Test document',
  documentType: 'report',
  language: 'en',
  audience: ['board'],
  goal: 'inform',
  communicationRegister: 'formal',
  density: 'standard',
  languageStyle: 'business',
  confidentiality: 'internal',
  sections: [
    {
      sectionId: 'sec-1',
      orderIndex: 0,
      level: 1,
      title: 'Existing section',
      blocks: [],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
  updatedAt: '2026-08-06T20:00:00.000Z',
} as unknown as DocumentSchema;

function renderPanel(onSchemaUpdated: (schema: DocumentSchema) => void = () => undefined): void {
  render(
    <DocumentStudioDocumentPanel
      artifactId="art-1"
      schema={SCHEMA}
      onStartOver={() => undefined}
      onSchemaUpdated={onSchemaUpdated}
    />
  );
}

function exportButton(label: 'Markdown' | 'DOCX' | 'PDF'): HTMLButtonElement {
  return screen.getByRole('button', { name: new RegExp(`^${label}$`) }) as HTMLButtonElement;
}

const SUCCESS_PAYLOAD = {
  format: 'docx' as const,
  filename: 'test.docx',
  contentBase64: Buffer.from('fake-docx').toString('base64'),
  manifest: {},
};

beforeAll(() => {
  // jsdom lacks these; the download trigger path needs them to be inert.
  (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:mock');
  (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
});

describe('DocumentStudioDocumentPanel — export UX (B4)', () => {
  it('adds a named section through the outline and persists normalized structure', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Decision required');
    const onSchemaUpdated = vi.fn();
    saveContentMock.mockImplementation(async (_artifactId, input) => ({
      ...SCHEMA,
      sections: input.sections,
      updatedAt: '2026-08-06T20:01:00.000Z',
    }));
    renderPanel(onSchemaUpdated);

    fireEvent.click(screen.getByRole('button', { name: '+ Add section' }));

    await waitFor(() => expect(saveContentMock).toHaveBeenCalledTimes(1));
    const [, input] = saveContentMock.mock.calls[0];
    expect(input.expectedVersion).toBe('2026-08-06T20:00:00.000Z');
    expect(input.sections).toHaveLength(2);
    expect(input.sections[1]).toEqual(
      expect.objectContaining({ title: 'Decision required', orderIndex: 1 })
    );
    expect(onSchemaUpdated).toHaveBeenCalledTimes(1);
  });

  it('shows a per-format spinner and disables all export buttons while exporting', async () => {
    let resolveExport: (v: typeof SUCCESS_PAYLOAD) => void = () => undefined;
    exportMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExport = resolve as typeof resolveExport;
        })
    );
    renderPanel();

    fireEvent.click(exportButton('DOCX'));

    await waitFor(() => expect(exportButton('DOCX')).toBeDisabled());
    expect(exportButton('Markdown')).toBeDisabled();
    expect(exportButton('PDF')).toBeDisabled();
    // Spinner only inside the in-flight format's button.
    expect(exportButton('DOCX').querySelector('.animate-spin')).not.toBeNull();
    expect(exportButton('Markdown').querySelector('.animate-spin')).toBeNull();

    resolveExport(SUCCESS_PAYLOAD);
    await waitFor(() => expect(exportButton('DOCX')).not.toBeDisabled());
  });

  it('on success fires toast.success and shows a dismissible note with the share hint', async () => {
    exportMock.mockResolvedValue(SUCCESS_PAYLOAD);
    renderPanel();

    fireEvent.click(exportButton('DOCX'));

    await waitFor(() =>
      expect(screen.getByTestId('document-export-success-note')).toBeInTheDocument()
    );
    expect(toast.success).toHaveBeenCalledWith('DOCX exported — the download has started.');
    expect(screen.getByText(/DOCX exported — the download has started\./)).toBeInTheDocument();
    // Share affordance: textual shortcut to the existing "Share links" rail tool.
    expect(screen.getByText(/Open “Share links” in the right-hand panel\./)).toBeInTheDocument();
    // No warnings chip when the payload carries none.
    expect(screen.queryByTestId('document-generation-warnings-chip')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('document-export-success-note')).not.toBeInTheDocument();
  });

  it('surfaces export-time generationWarnings via the warnings chip', async () => {
    exportMock.mockResolvedValue({
      ...SUCCESS_PAYLOAD,
      generationWarnings: [
        {
          code: 'chart_raster_failed',
          scope: 'block',
          blockId: 'blk-1',
          message: 'Chart "Revenue" could not be rasterized.',
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
        {
          code: 'logo_unavailable',
          scope: 'document',
          message: 'Cover logo could not be embedded.',
          occurredAt: '2026-01-01T00:00:01.000Z',
        },
      ],
    });
    renderPanel();

    fireEvent.click(exportButton('DOCX'));

    const chip = await screen.findByTestId('document-generation-warnings-chip');
    // Export-specific summary key (mock t() echoes the key for keys without
    // defaultValue) — proves the chip runs in its export variant.
    expect(chip.textContent).toContain('documentStudio.generationWarnings.exportSummary');

    fireEvent.click(chip.querySelector('button') as HTMLButtonElement);
    expect(screen.getByText(/could not be rasterized/)).toBeInTheDocument();
    expect(screen.getByText(/Cover logo could not be embedded/)).toBeInTheDocument();
  });

  it('renders a readable i18n error frame around the failure detail', async () => {
    exportMock.mockRejectedValue(new Error('render pipeline exploded'));
    renderPanel();

    fireEvent.click(exportButton('PDF'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('PDF export failed: render pipeline exploded');
    // No success artifacts on the error path.
    expect(screen.queryByTestId('document-export-success-note')).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('renders the QA-blocked banner when the export trips the QA gate', async () => {
    exportMock.mockRejectedValue(
      new QaBlockingError({
        overall: 42,
        categories: [{ category: 'sources', score: 40, blocking: true, findings: [{ id: 'f1' }] }],
      } as never)
    );
    renderPanel();

    fireEvent.click(exportButton('DOCX'));

    await waitFor(() => expect(screen.getByText('QA blocked the DOCX export')).toBeInTheDocument());
    expect(
      screen.getByText(/Export blocked by Quality QA\. Resolve the findings below/)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('document-export-success-note')).not.toBeInTheDocument();
  });
});
