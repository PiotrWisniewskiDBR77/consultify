import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DefinitionDecisionQueue } from '../../../src/components/MyWork/DefinitionDecisionQueue';
import {
  decideDefinition,
  listMyDefinitionDecisions,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', async () => {
  const actual = await vi.importActual('../../../src/services/initiatives-execution/runtimeApi');
  return { ...actual, decideDefinition: vi.fn(), listMyDefinitionDecisions: vi.fn() };
});
vi.mock('../../../src/components/MyWork/gateSignoffProjection', () => ({
  useGateSignoffGuard: () => ({
    ready: true,
    quorumRef: {
      quorumId: `DEFINITION:${pending.decisionId}`,
      version: 1,
      receiptId: 'receipt-definition',
    },
  }),
}));

vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: ({ data, onRowClick }: any) => (
    <div>
      {data.map((row: any) => (
        <button key={row.id} type="button" onClick={() => onRowClick(row)}>
          {row.title} {row.initiativeId}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children, selectedItem, renderPreview, renderPreviewFooter }: any) => (
    <div>
      {children}
      {selectedItem ? renderPreview(selectedItem) : null}
      {selectedItem ? renderPreviewFooter(selectedItem) : null}
    </div>
  ),
}));

const pending = {
  version: 1,
  decisionId: 'definition-decision-aco-001',
  initiativeId: 'aco-initiative-001',
  gate: 'DEFINITION' as const,
  status: 'PENDING' as const,
  requesterId: 'initiative-owner',
  authorityId: 'definition-authority',
  dueAt: '2026-08-20T12:00:00.000Z',
  requestedAt: '2026-08-09T20:00:00.000Z',
  cardVersions: { 'summary-scope': 1 },
};

describe('DefinitionDecisionQueue', () => {
  beforeEach(() => {
    vi.mocked(listMyDefinitionDecisions)
      .mockReset()
      .mockResolvedValueOnce([pending])
      .mockResolvedValue([]);
    vi.mocked(decideDefinition)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2 });
  });

  it('decides the same canonical My Work Decision and removes it after read-back', async () => {
    render(<DefinitionDecisionQueue />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: `Definition Decision ${pending.initiativeId}`,
      })
    );
    fireEvent.change(screen.getByLabelText('Decision rationale'), {
      target: { value: 'Definition evidence and scope are sufficient.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve Definition' }));

    await waitFor(() =>
      expect(decideDefinition).toHaveBeenCalledWith(
        pending.initiativeId,
        expect.objectContaining({
          decisionId: pending.decisionId,
          expectedVersion: pending.version,
          outcome: 'APPROVED',
        })
      )
    );
    await waitFor(() => expect(listMyDefinitionDecisions).toHaveBeenCalledTimes(2));
  });
});
