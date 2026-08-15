import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
  }),
}));

const apiMocks = vi.hoisted(() => ({
  createDocumentStudioTransformativeProposal: vi.fn(),
  approveDocumentStudioProposal: vi.fn(),
  rejectDocumentStudioProposal: vi.fn(),
}));

vi.mock('../../../src/components/DocumentStudio/api', () => apiMocks);

import { DocumentTransformativeEditPanel } from '../../../src/components/DocumentStudio/DocumentTransformativeEditPanel';

function openDialog(): HTMLButtonElement {
  render(
    <DocumentTransformativeEditPanel artifactId="artifact-1" onSchemaUpdated={() => undefined} />
  );
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Rebuild this document' } });
  const trigger = screen.getByTestId('document-transformative-request');
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  return trigger;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('transformative confirmation focus restoration', () => {
  it('returns focus to the trigger after Cancel', async () => {
    const trigger = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('returns focus to the trigger after Escape', async () => {
    const trigger = openDialog();
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('returns focus after the confirmed proposal request finishes', async () => {
    apiMocks.createDocumentStudioTransformativeProposal.mockResolvedValue({
      proposalId: 'proposal-1',
      artifactId: 'artifact-1',
      scope: 'transformative',
      instruction: 'Rebuild this document',
      affectedSectionIds: [],
      status: 'proposed',
      diff: { before: 'Before', after: 'After' },
      createdBy: 'user-1',
      createdAt: '2026-08-15T00:00:00.000Z',
    });
    const trigger = openDialog();
    fireEvent.click(screen.getByTestId('document-transformative-confirm'));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });
});
