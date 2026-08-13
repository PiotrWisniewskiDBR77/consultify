import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClosureDecisionQueue } from '../../../src/components/MyWork/ClosureDecisionQueue';
import {
  decideClosureCase,
  getClosureSnapshot,
  getEffectivenessSnapshot,
  listClosureCases,
  listEffectivenessCases,
  readExecutionCase,
  readRegisteredInitiative,
  requestClosureCase,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/components/MyWork/gateSignoffProjection', () => ({
  useGateSignoffGuard: () => ({
    state: 'READY',
    projection: { effectivePolicy: { policyEnforced: true } },
    quorumRef: { quorumId: 'closure-quorum', version: 2, receiptId: 'closure-receipt' },
  }),
}));
vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  decideClosureCase: vi.fn(),
  getClosureSnapshot: vi.fn(),
  getEffectivenessSnapshot: vi.fn(),
  listClosureCases: vi.fn(),
  listEffectivenessCases: vi.fn(),
  readExecutionCase: vi.fn(),
  readRegisteredInitiative: vi.fn(),
  requestClosureCase: vi.fn(),
}));

const closure = {
  version: 3,
  closureCaseId: 'closure-1',
  initiativeId: 'initiative-1',
  executionCaseId: 'case-1',
  effectivenessSnapshotRef: { snapshotId: 'effect-snapshot-1', version: 1 },
  requesterId: 'owner-1',
  authorityId: 'authority-1',
  status: 'PENDING',
  lessons: ['Keep evidence current'],
  lineageRefs: [{ ref: 'results-1', version: 4 }],
  followUps: [{ kind: 'TASK_REF', taskId: 'task-1', version: 2 }],
  retention: {
    classification: 'INTERNAL',
    policyRef: { ref: 'ret-1', version: 1 },
    legalHold: false,
  },
};

describe('ClosureDecisionQueue', () => {
  beforeEach(() => {
    vi.mocked(listClosureCases).mockResolvedValue({ items: [closure] });
    vi.mocked(listEffectivenessCases).mockResolvedValue({
      items: [
        {
          effectivenessCaseId: 'effect-1',
          initiativeId: 'initiative-1',
          executionCaseId: 'case-1',
          status: 'REVIEWED',
          reviewOutcome: 'CONFIRMED',
          effectivenessSnapshotId: 'effect-snapshot-1',
        },
      ],
    });
    vi.mocked(readRegisteredInitiative).mockResolvedValue({ version: 12 });
    vi.mocked(readExecutionCase).mockResolvedValue({ version: 8 });
    vi.mocked(getEffectivenessSnapshot).mockResolvedValue({
      snapshotId: 'effect-snapshot-1',
      version: 1,
    });
    vi.mocked(requestClosureCase).mockResolvedValue({ response: closure });
    vi.mocked(decideClosureCase).mockResolvedValue({
      response: { ...closure, status: 'CLOSED', closureSnapshotId: 'closure-snapshot-1' },
    });
    vi.mocked(getClosureSnapshot).mockResolvedValue({
      snapshotId: 'closure-snapshot-1',
      closureCaseId: 'closure-1',
    });
  });

  it('requests exact reviewed lineage with mandatory canonical Task follow-up', async () => {
    render(<ClosureDecisionQueue />);
    fireEvent.change(await screen.findByLabelText('Closure Effectiveness Case'), {
      target: { value: 'effect-1' },
    });
    for (const [label, value] of [
      ['closureCaseId', 'closure-2'],
      ['authorityId', 'authority-2'],
      ['lessons', 'Keep evidence current'],
      ['lineageRefs', 'results-1@4'],
      ['followUpTaskId', 'task-1'],
      ['followUpTaskVersion', '2'],
      ['retentionClassification', 'INTERNAL'],
      ['retentionPolicyRef', 'ret-1'],
      ['retentionPolicyVersion', '1'],
    ])
      fireEvent.change(screen.getByLabelText(`Closure request ${label}`), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Request independent Closure' }));
    await waitFor(() =>
      expect(requestClosureCase).toHaveBeenCalledWith(
        'closure-2',
        expect.objectContaining({
          expectedInitiativeVersion: 12,
          expectedExecutionCaseVersion: 8,
          effectivenessSnapshotRef: { snapshotId: 'effect-snapshot-1', version: 1 },
          lineageRefs: [{ ref: 'results-1', version: 4 }],
          followUps: [{ kind: 'TASK_REF', taskId: 'task-1', version: 2 }],
        })
      )
    );
  });

  it('passes exact CLOSURE quorum and only CLOSE produces immutable CLOSED snapshot', async () => {
    render(<ClosureDecisionQueue />);
    fireEvent.click((await screen.findByText('closure-1')).closest('tr')!);
    fireEvent.change(screen.getByLabelText('Closure rationale'), {
      target: { value: 'Independent close' },
    });
    fireEvent.change(screen.getByLabelText('Closure Snapshot ID'), {
      target: { value: 'closure-snapshot-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Decide Closure' }));
    await waitFor(() =>
      expect(decideClosureCase).toHaveBeenCalledWith(
        'closure-1',
        expect.objectContaining({
          outcome: 'CLOSE',
          expectedInitiativeVersion: 12,
          expectedExecutionCaseVersion: 8,
          governanceQuorumRequired: true,
          governanceQuorumRef: {
            quorumId: 'closure-quorum',
            version: 2,
            receiptId: 'closure-receipt',
          },
        })
      )
    );
    expect(await screen.findByText('CLOSURE_SNAPSHOT', { exact: false })).toHaveTextContent(
      'CLOSURE_SNAPSHOT · closure-snapshot-1 · CLOSED'
    );
  });
});
