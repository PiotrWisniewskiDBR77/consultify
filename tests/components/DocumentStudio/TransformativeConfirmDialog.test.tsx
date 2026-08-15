import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stableT = (_key: string, fallback?: string | { defaultValue?: string }): string =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: stableT }),
}));

const apiMocks = vi.hoisted(() => ({
  createDocumentStudioTransformativeProposal: vi.fn(),
  approveDocumentStudioProposal: vi.fn(),
  rejectDocumentStudioProposal: vi.fn(),
}));

vi.mock('../../../src/components/DocumentStudio/api', () => apiMocks);

import { DocumentTransformativeEditPanel } from '../../../src/components/DocumentStudio/DocumentTransformativeEditPanel';
import type {
  DocumentEditorProposal,
  DocumentSchema,
} from '../../../src/components/DocumentStudio/types';

const proposal: DocumentEditorProposal = {
  proposalId: 'proposal-1',
  artifactId: 'artifact-1',
  scope: 'transformative',
  instruction: 'Rebuild it as a board memo',
  affectedSectionIds: ['section-1'],
  status: 'proposed',
  diff: { before: 'Long operational report', after: 'Concise board decision memo' },
  createdBy: 'user-1',
  createdAt: '2026-08-15T00:00:00.000Z',
};

const schemaAfter = { artifactId: 'artifact-1', title: 'Board memo' } as DocumentSchema;

function renderPanel(onSchemaUpdated = vi.fn()) {
  render(
    <DocumentTransformativeEditPanel artifactId="artifact-1" onSchemaUpdated={onSchemaUpdated} />
  );
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Rebuild it as a board memo' },
  });
  return { onSchemaUpdated };
}

function openConfirmation(): void {
  fireEvent.click(screen.getByTestId('document-transformative-request'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DocumentTransformativeEditPanel authority and review gates', () => {
  it('cancel closes the accessible warning and sends no API request', async () => {
    renderPanel();
    openConfirmation();

    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Rebuild the whole document?');
    expect(apiMocks.createDocumentStudioTransformativeProposal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(apiMocks.createDocumentStudioTransformativeProposal).not.toHaveBeenCalled();
  });

  it('sends exactly one request only after explicit confirmation', async () => {
    apiMocks.createDocumentStudioTransformativeProposal.mockResolvedValue(proposal);
    renderPanel();
    openConfirmation();

    expect(apiMocks.createDocumentStudioTransformativeProposal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('document-transformative-confirm'));

    await waitFor(() =>
      expect(apiMocks.createDocumentStudioTransformativeProposal).toHaveBeenCalledWith(
        'artifact-1',
        { instruction: 'Rebuild it as a board memo' },
        { useLlm: true }
      )
    );
    expect(apiMocks.createDocumentStudioTransformativeProposal).toHaveBeenCalledTimes(1);
  });

  it('synchronously fences a rapid double-confirm while the first request is pending', async () => {
    let resolveRequest!: (value: DocumentEditorProposal) => void;
    apiMocks.createDocumentStudioTransformativeProposal.mockImplementation(
      () => new Promise<DocumentEditorProposal>((resolve) => (resolveRequest = resolve))
    );
    renderPanel();
    openConfirmation();

    const confirm = screen.getByTestId('document-transformative-confirm');
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(apiMocks.createDocumentStudioTransformativeProposal).toHaveBeenCalledTimes(1);
    resolveRequest(proposal);
    await waitFor(() => expect(screen.getByTestId('document-transformative-review')).toBeVisible());
  });

  it('shows a governed before/after review and mutates the visible schema only after approval', async () => {
    apiMocks.createDocumentStudioTransformativeProposal.mockResolvedValue(proposal);
    apiMocks.approveDocumentStudioProposal.mockResolvedValue({
      proposal: { ...proposal, status: 'executed' },
      schema: schemaAfter,
    });
    const { onSchemaUpdated } = renderPanel();
    openConfirmation();
    fireEvent.click(screen.getByTestId('document-transformative-confirm'));

    expect(await screen.findByText('Long operational report')).toBeVisible();
    expect(screen.getByText('Concise board decision memo')).toBeVisible();
    expect(onSchemaUpdated).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Approve and apply' }));
    await waitFor(() => expect(onSchemaUpdated).toHaveBeenCalledWith(schemaAfter));
    expect(apiMocks.approveDocumentStudioProposal).toHaveBeenCalledWith('artifact-1', 'proposal-1');
  });

  it('surfaces creation failure and leaves the document unchanged', async () => {
    apiMocks.createDocumentStudioTransformativeProposal.mockRejectedValue(
      new Error('Proposal service unavailable')
    );
    const { onSchemaUpdated } = renderPanel();
    openConfirmation();
    fireEvent.click(screen.getByTestId('document-transformative-confirm'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Proposal service unavailable');
    expect(screen.queryByTestId('document-transformative-review')).not.toBeInTheDocument();
    expect(onSchemaUpdated).not.toHaveBeenCalled();
  });
});
