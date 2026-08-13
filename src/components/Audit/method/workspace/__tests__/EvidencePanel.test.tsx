/**
 * EvidencePanel — ogniwo „dostarczony dowód". Mockuje `../workspaceApi` NA
 * POZIOMIE MODUŁU (kształt serwera).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../workspaceApi', async () => {
  const actual = await vi.importActual<typeof import('../workspaceApi')>('../workspaceApi');
  return {
    ...actual,
    listEvidence: vi.fn(),
    submitEvidence: vi.fn(),
    reviewEvidence: vi.fn(),
  };
});

import { EvidencePanel } from '../EvidencePanel';
import * as workspaceApi from '../workspaceApi';
import type { WorkspaceCapability, WorkspaceEvidence } from '../workspaceApi';

const mockedListEvidence = vi.mocked(workspaceApi.listEvidence);
const mockedSubmitEvidence = vi.mocked(workspaceApi.submitEvidence);
const mockedReviewEvidence = vi.mocked(workspaceApi.reviewEvidence);

function evidenceItem(overrides: Partial<WorkspaceEvidence> = {}): WorkspaceEvidence {
  return {
    id: 'ev-1',
    programId: 'prog-1',
    criterionId: 'crit-1',
    requestId: null,
    evidenceKind: 'document',
    title: 'Access policy v3',
    description: null,
    externalReference: null,
    contentSnapshot: null,
    providedBy: 'user-1',
    providedAt: '2026-08-01T00:00:00Z',
    capturedAt: '2026-08-01T00:00:00Z',
    sufficiency: null,
    reliability: null,
    currencyStatus: null,
    supportsConformity: null,
    reviewNote: null,
    accepted: null,
    acceptedBy: null,
    acceptedAt: null,
    rejectionReason: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function renderPanel(capabilities: WorkspaceCapability[], onEvidenceChanged = vi.fn()) {
  return render(
    <EvidencePanel
      programId="prog-1"
      criterionId="crit-1"
      capabilities={new Set(capabilities)}
      isPolish
      onEvidenceChanged={onEvidenceChanged}
    />
  );
}

describe('EvidencePanel', () => {
  it('lists evidence in a real StandardTable (kanon list — not a bespoke grid)', async () => {
    mockedListEvidence.mockResolvedValue([evidenceItem()]);
    const { container } = renderPanel(['evidence.review']);

    await waitFor(() => expect(screen.getByText('Access policy v3')).toBeInTheDocument());
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('lets the auditee submit new evidence when they have evidence.submit', async () => {
    mockedListEvidence.mockResolvedValue([]);
    mockedSubmitEvidence.mockResolvedValue(evidenceItem({ id: 'ev-2' }));
    renderPanel(['evidence.submit']);

    await waitFor(() => expect(mockedListEvidence).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /dodaj dowód/i }));
    fireEvent.change(screen.getByLabelText('Tytuł dowodu'), { target: { value: 'New evidence' } });
    fireEvent.click(screen.getByRole('button', { name: /zapisz dowód/i }));

    await waitFor(() =>
      expect(mockedSubmitEvidence).toHaveBeenCalledWith(
        expect.objectContaining({ programId: 'prog-1', criterionId: 'crit-1', title: 'New evidence' })
      )
    );
  });

  it('does not offer the submit form without evidence.submit', async () => {
    mockedListEvidence.mockResolvedValue([]);
    renderPanel(['evidence.review']);

    await waitFor(() => expect(mockedListEvidence).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /dodaj dowód/i })).not.toBeInTheDocument();
  });

  it('lets a reviewer save contradicting evidence, and marks it as such once saved', async () => {
    const item = evidenceItem();
    mockedListEvidence.mockResolvedValueOnce([item]);
    mockedReviewEvidence.mockResolvedValue({ ...item, supportsConformity: false, accepted: true });
    mockedListEvidence.mockResolvedValueOnce([{ ...item, supportsConformity: false, accepted: true }]);
    renderPanel(['evidence.review']);

    await waitFor(() => expect(screen.getByText('Access policy v3')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Access policy v3'));

    const reviewForm = await screen.findByTestId('evidence-review-form');
    fireEvent.click(within(reviewForm).getByRole('button', { name: /dowód przeczący/i }));

    await waitFor(() =>
      expect(mockedReviewEvidence).toHaveBeenCalledWith('ev-1', expect.objectContaining({ supportsConformity: false, accepted: true }))
    );

    // After the reload, the table shows the contradicting-evidence chip — the
    // fact is never hidden. (The review form's own button carries the same
    // label, so assert on the StatusChip specifically via role="status".)
    await waitFor(() => {
      const chips = screen.getAllByRole('status').filter((el) => el.textContent === 'Dowód przeczący');
      expect(chips.length).toBeGreaterThan(0);
    });
  });
});
