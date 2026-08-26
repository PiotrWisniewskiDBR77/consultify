/**
 * @vitest-environment jsdom
 *
 * Smoke test for the manager approval write-back (Module 06 Realizacja, P0-7).
 *
 * Verifies the previously-missing decision write-back loop:
 *  - Approve on a DECISION problem calls Api.decideDecision (PATCH /decisions/:id/decide)
 *  - After confirmation a read-back APPROVED badge renders inline.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => (typeof opts === 'string' ? opts : (opts?.defaultValue ?? k)),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: toastError } }));
vi.mock('@/providers/V8Provider', () => ({
  useV8: () => ({
    isV8Enabled: true,
    isV8ChatEnabled: false,
    isV8AICoreEnabled: false,
    isLoading: false,
    flags: undefined,
  }),
  V8Provider: ({ children }: { children: React.ReactNode }) => children,
}));

const { decideDecision, getManagerProblems, executeManagerProblemAction } = vi.hoisted(() => ({
  decideDecision: vi.fn(),
  getManagerProblems: vi.fn(),
  executeManagerProblemAction: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  Api: { decideDecision },
}));

vi.mock('../../../services/api/v8/execution-control', () => ({
  V8ExecutionControlApi: { getManagerProblems, executeManagerProblemAction },
}));

import { ManagerModuleView } from '../ManagerModuleView';

const decisionProblem = {
  id: 'p1',
  severity: 'warning',
  problemType: 'pending_decision',
  title: 'Approve vendor selection',
  rootCause: 'Decision pending past due date',
  sourceEntityType: 'DECISION',
  sourceEntityId: 'dec-42',
  sourceEntityName: 'Vendor selection',
  ownerId: null,
  ownerName: null,
  daysOverdue: 3,
  impactCount: 0,
  affectedEntities: [],
  actions: [{ id: 'approve', label: 'Approve', variant: 'primary' }],
  meta: {},
};

const workloadProblem = {
  id: 'p2',
  severity: 'warning',
  problemType: 'unassigned_task',
  title: 'Unassigned onboarding task',
  rootCause: 'No maker assigned',
  sourceEntityType: 'TASK',
  sourceEntityId: 'task-9',
  sourceEntityName: 'Onboarding task',
  ownerId: null,
  ownerName: null,
  daysOverdue: 0,
  impactCount: 0,
  affectedEntities: [],
  actions: [{ id: 'assign_maker', label: 'Assign maker', variant: 'primary' }],
  meta: {},
};

beforeEach(() => {
  decideDecision.mockReset();
  getManagerProblems.mockReset();
  executeManagerProblemAction.mockReset();
  getManagerProblems.mockResolvedValue({ data: { problems: [decisionProblem] } });
  decideDecision.mockResolvedValue({ success: true });
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('Manager approval write-back', () => {
  it('approving a decision calls decideDecision and renders the confirmed badge', async () => {
    render(<ManagerModuleView moduleId="decisions" projectId="proj-1" />);

    // Row loads, select it to open the preview.
    await waitFor(() => {
      expect(screen.getByText('Approve vendor selection')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Approve vendor selection'));

    // Approve button in the preview footer.
    const approveButtons = await screen.findAllByText('Approve');
    fireEvent.click(approveButtons[approveButtons.length - 1]);

    await waitFor(() => {
      expect(decideDecision).toHaveBeenCalledWith('dec-42', 'approved');
    });

    await waitFor(() => {
      expect(screen.getByTestId('decision-confirmed-badge')).toBeInTheDocument();
    });
  });

  it('DEC-120/A11: a non-decision lane action never round-trips through the retired 409 writer', async () => {
    getManagerProblems.mockResolvedValue({ data: { problems: [workloadProblem] } });

    render(<ManagerModuleView moduleId="workload" projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText('Unassigned onboarding task')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Unassigned onboarding task'));

    const assignButtons = await screen.findAllByText('Assign maker');
    fireEvent.click(assignButtons[assignButtons.length - 1]);

    // Must fail honestly WITHOUT ever calling the 409-guarded legacy writer.
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        'Saving is moving to the canonical execution registry — in progress'
      );
    });
    expect(executeManagerProblemAction).not.toHaveBeenCalled();
  });
});
