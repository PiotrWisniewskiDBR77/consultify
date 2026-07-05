/**
 * B1 (M18) — explicit confirmation gate for the transformative editor scope.
 *
 * Proves:
 *   1. TransformativeConfirmDialog renders the warning title, message,
 *      consequence list, and Cancel/Continue actions when open, and renders
 *      nothing when closed;
 *   2. Cancel / Escape / Continue invoke the right callbacks;
 *   3. DocumentStudioEditorPanel wiring: submitting a transformative
 *      instruction opens the dialog INSTEAD of firing the API call; the
 *      request is only sent after the user explicitly confirms, and is
 *      never sent when the user cancels (window.confirm is gone).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Local i18n mock (overrides the global setup mock) so that
// `returnObjects: true` yields a real array for the consequences list.
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      if (typeof options === 'string') return options;
      if (options && typeof options === 'object') {
        const opts = options as { returnObjects?: boolean; defaultValue?: unknown };
        if (opts.returnObjects) {
          return Array.isArray(opts.defaultValue) ? opts.defaultValue : [];
        }
        if (typeof opts.defaultValue === 'string') return opts.defaultValue;
      }
      return key;
    },
  }),
}));

const apiMocks = vi.hoisted(() => ({
  createDocumentStudioTransformativeProposal: vi.fn(),
  createDocumentStudioLocalProposal: vi.fn(),
  createDocumentStudioSectionProposal: vi.fn(),
  createDocumentStudioGlobalProposal: vi.fn(),
  createDocumentStudioMethodologyProposal: vi.fn(),
  createDocumentStudioSourceProposal: vi.fn(),
  approveDocumentStudioProposal: vi.fn(),
  rejectDocumentStudioProposal: vi.fn(),
  getDocumentStudioAuditTrail: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/components/DocumentStudio/api', () => apiMocks);

import { DocumentStudioEditorPanel } from '../../../src/components/DocumentStudio/DocumentStudioEditorPanel';
import { TransformativeConfirmDialog } from '../../../src/components/DocumentStudio/TransformativeConfirmDialog';
import type {
  DocumentEditorProposal,
  DocumentSchema,
} from '../../../src/components/DocumentStudio/types';

const SCHEMA = {
  documentId: 'doc-1',
  artifactId: 'art-1',
  title: 'Test document',
  documentType: 'executive_memo',
  language: 'en',
  audience: ['C-suite'],
  sections: [
    {
      sectionId: 'sec-1',
      orderIndex: 0,
      level: 1,
      title: 'Summary',
      blocks: [{ blockId: 'blk-1', type: 'paragraph', content: 'Hello' }],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
} as unknown as DocumentSchema;

const PROPOSAL: DocumentEditorProposal = {
  proposalId: 'prop-1',
  artifactId: 'art-1',
  scope: 'transformative',
  instruction: 'Rebuild everything',
  affectedSectionIds: ['sec-1'],
  status: 'proposed',
  diff: { before: 'Hello', after: 'Rebuilt' },
  createdBy: 'test',
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.getDocumentStudioAuditTrail.mockResolvedValue([]);
});

describe('TransformativeConfirmDialog', () => {
  it('renders title, message, consequences, and both actions when open', () => {
    render(
      <TransformativeConfirmDialog open onCancel={() => undefined} onConfirm={() => undefined} />
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Rebuild the whole document?')).toBeInTheDocument();
    expect(
      screen.getByText('This can dramatically rebuild the document. Continue?')
    ).toBeInTheDocument();
    // Consequence list (blast radius) is spelled out.
    expect(screen.getByText(/every section and block/i)).toBeInTheDocument();
    expect(screen.getByText(/structure, headings, and wording/i)).toBeInTheDocument();
    expect(screen.getByText(/before\/after diff/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <TransformativeConfirmDialog
        open={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('invokes onCancel via the Cancel button and Escape, and onConfirm via Continue', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<TransformativeConfirmDialog open onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('DocumentStudioEditorPanel — transformative scope gating (B1)', () => {
  function setupTransformativeSubmit() {
    render(
      <DocumentStudioEditorPanel
        artifactId="art-1"
        schema={SCHEMA}
        onSchemaUpdated={() => undefined}
      />
    );
    // Switch to the transformative scope.
    fireEvent.click(screen.getByRole('button', { name: 'Transformative' }));
    // Provide an instruction.
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Rebuild everything' },
    });
    // Submit.
    fireEvent.click(screen.getByRole('button', { name: 'Create proposal' }));
  }

  it('opens the confirmation dialog WITHOUT sending the request', () => {
    setupTransformativeSubmit();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(apiMocks.createDocumentStudioTransformativeProposal).not.toHaveBeenCalled();
  });

  it('sends the transformative request only after explicit Continue', async () => {
    apiMocks.createDocumentStudioTransformativeProposal.mockResolvedValue(PROPOSAL);
    setupTransformativeSubmit();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(apiMocks.createDocumentStudioTransformativeProposal).toHaveBeenCalledTimes(1)
    );
    expect(apiMocks.createDocumentStudioTransformativeProposal).toHaveBeenCalledWith(
      'art-1',
      { instruction: 'Rebuild everything' },
      { useLlm: false }
    );
    // Dialog closes after confirm.
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('never sends the request when the user cancels', async () => {
    setupTransformativeSubmit();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(apiMocks.createDocumentStudioTransformativeProposal).not.toHaveBeenCalled();
  });

  it('does not gate non-transformative scopes behind the dialog', async () => {
    apiMocks.createDocumentStudioGlobalProposal.mockResolvedValue({
      ...PROPOSAL,
      scope: 'global',
    });
    render(
      <DocumentStudioEditorPanel
        artifactId="art-1"
        schema={SCHEMA}
        onSchemaUpdated={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Whole document' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Polish wording' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create proposal' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(apiMocks.createDocumentStudioGlobalProposal).toHaveBeenCalledTimes(1)
    );
  });
});
