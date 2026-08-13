import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DefinitionRemediationQueue } from '../../../src/components/MyWork/DefinitionRemediationQueue';
import {
  listMyDefinitionRemediation,
  resolveDefinitionRemediation,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', async () => {
  const actual = await vi.importActual('../../../src/services/initiatives-execution/runtimeApi');
  return { ...actual, listMyDefinitionRemediation: vi.fn(), resolveDefinitionRemediation: vi.fn() };
});
vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: ({ data, onRowClick }: any) => (
    <div>
      {data.map((row: any) => (
        <button key={row.id} type="button" onClick={() => onRowClick(row)}>
          {row.title}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children, selectedItem, renderPreview, renderPreviewFooter }: any) => (
    <div>
      {children}
      {selectedItem && renderPreview(selectedItem)}
      {selectedItem && renderPreviewFooter(selectedItem)}
    </div>
  ),
}));

const task = {
  version: 1,
  aggregateType: 'task' as const,
  aggregateId: 'finance-task-1',
  initiativeId: 'initiative-1',
  findingId: 'definition:financial-analysis:EVIDENCE_REQUIRED',
  workType: 'FINANCE_EVIDENCE' as const,
  title: 'Provide Finance evidence',
  accountableId: 'finance-owner',
  dueAt: '2026-08-20T12:00:00.000Z',
  status: 'OPEN' as const,
  options: [],
};

describe('DefinitionRemediationQueue', () => {
  beforeEach(() => {
    vi.mocked(listMyDefinitionRemediation)
      .mockReset()
      .mockResolvedValueOnce([task])
      .mockResolvedValue([]);
    vi.mocked(resolveDefinitionRemediation)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2 });
  });

  it('completes the same canonical Finance Task with evidence and reads back removal', async () => {
    render(<DefinitionRemediationQueue />);
    fireEvent.click(await screen.findByRole('button', { name: task.title }));
    fireEvent.change(screen.getByLabelText('Evidence references'), {
      target: { value: 'finance:reconciliation:v1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Complete Task' }));
    await waitFor(() =>
      expect(resolveDefinitionRemediation).toHaveBeenCalledWith(
        'task',
        task.aggregateId,
        expect.objectContaining({
          expectedVersion: 1,
          workType: 'FINANCE_EVIDENCE',
          evidenceRefs: ['finance:reconciliation:v1'],
        })
      )
    );
    await waitFor(() => expect(listMyDefinitionRemediation).toHaveBeenCalledTimes(2));
  });
});
