/**
 * OP-1 v3b / W205: Audits → Sessions workspace must not hang forever on
 * "Next-stage gates: Loading…" when lifecycle gates fail. Criteria remain the
 * workspace entry point and lifecycle failure is shown as an explicit message.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    getProgram: vi.fn(),
    getProgramCoverage: vi.fn(),
    getProgramLifecycle: vi.fn(),
    listProgramCriteria: vi.fn(),
    transitionProgram: vi.fn(),
    finalizeOutput: vi.fn(),
  };
});

import { AuditProcessesTab } from '../tabs/AuditProcessesTab';
import {
  getProgram,
  getProgramCoverage,
  getProgramLifecycle,
  listProgramCriteria,
  type AuditProgramSummary,
} from '../auditsMethodApi';

const program: AuditProgramSummary = {
  id: 'prog-1',
  name: 'Q3 Compliance Audit',
  packId: 'pack-1',
  packTitle: 'ISO 19011 Audit Pack',
  packVersion: 1,
  lifecycleState: 'fieldwork',
  applicableCriteria: 1,
  concludedCriteria: 0,
  openFindings: 0,
  leadAuditorId: 'u1',
  leadAuditorName: 'Ada Lovelace',
  plannedStart: null,
  plannedEnd: null,
  updatedAt: '2026-09-17',
};

function renderTab() {
  return render(
    <MemoryRouter initialEntries={['/audit-programs?tab=processes']}>
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={() => {}}
        isPolish={false}
        onProgramChanged={() => {}}
      />
    </MemoryRouter>
  );
}

describe('AuditProcessesTab — OP-1 v3b next-stage gates failure', () => {
  beforeEach(() => {
    vi.mocked(getProgram).mockResolvedValue({
      ...program,
      objective: null,
      scopeText: null,
      projectId: null,
      members: [],
    } as any);
    vi.mocked(getProgramCoverage).mockResolvedValue({
      applicableCriteria: 1,
      concludedCriteria: 0,
      insufficientEvidenceCriteria: 0,
    });
    vi.mocked(getProgramLifecycle).mockRejectedValue(new Error('lifecycle unavailable'));
    vi.mocked(listProgramCriteria).mockResolvedValue([
      {
        id: 'criterion-1',
        programId: 'prog-1',
        parentId: null,
        ordinal: 1,
        refCode: 'INT-01',
        title: 'Customer complaint intake',
        applicable: true,
        conformityStatus: 'not_tested',
        workStatus: 'open',
        evidenceCount: 0,
        findingCount: 0,
        children: [],
      },
    ]);
  });

  it('shows an explicit gates error while preserving the criteria workspace link', async () => {
    renderTab();

    fireEvent.click(await screen.findByText('Q3 Compliance Audit'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load next-stage gates.');
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    const criterion = await screen.findByRole('link', {
      name: /INT-01.*Customer complaint intake/i,
    });
    expect(criterion).toHaveAttribute('href', '/audit-programs/prog-1/criteria/criterion-1');
    await waitFor(() => expect(listProgramCriteria).toHaveBeenCalledWith('prog-1'));
  });
});
