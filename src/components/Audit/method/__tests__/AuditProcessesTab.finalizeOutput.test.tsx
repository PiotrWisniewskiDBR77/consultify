import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    finalizeOutput: vi.fn(),
    getProgram: vi.fn(),
    getProgramCoverage: vi.fn(),
    getProgramLifecycle: vi.fn(),
    listProgramCriteria: vi.fn(),
  };
});

import { resetAuditsReportChainFlagCache } from '@/utils/auditsReportChainFlag';

import {
  type AuditProgramSummary,
  finalizeOutput,
  getProgram,
  getProgramCoverage,
  getProgramLifecycle,
  listProgramCriteria,
} from '../auditsMethodApi';
import { AuditProcessesTab } from '../tabs/AuditProcessesTab';

const program: AuditProgramSummary = {
  id: 'prog-1',
  name: 'Audit 41',
  packId: 'pack-1',
  packTitle: null,
  packVersion: 1,
  lifecycleState: 'fieldwork',
  applicableCriteria: 1,
  concludedCriteria: 1,
  openFindings: 0,
  leadAuditorId: 'u1',
  leadAuditorName: null,
  plannedStart: null,
  plannedEnd: null,
  updatedAt: '2026-08-28',
};

function arrangeFlag(on: boolean) {
  window.localStorage.setItem('ff.audits_report_chain', on ? '1' : '0');
  resetAuditsReportChainFlagCache();
}

function renderTab(onProgramChanged = vi.fn()) {
  return render(
    <AuditProcessesTab
      programs={[program]}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      isPolish={false}
      onProgramChanged={onProgramChanged}
      initialSelectedId="prog-1"
    />
  );
}

describe('AuditProcessesTab finalize Output control', () => {
  beforeEach(() => {
    vi.mocked(getProgram).mockResolvedValue({ ...program, members: [] } as any);
    vi.mocked(getProgramCoverage).mockResolvedValue({
      applicableCriteria: 1,
      concludedCriteria: 1,
      insufficientEvidenceCriteria: 0,
    });
    vi.mocked(getProgramLifecycle).mockResolvedValue({ state: 'fieldwork', allowed: [] });
    vi.mocked(listProgramCriteria).mockResolvedValue([]);
    vi.mocked(finalizeOutput).mockReset();
  });

  afterEach(() => {
    window.localStorage.removeItem('ff.audits_report_chain');
    resetAuditsReportChainFlagCache();
  });

  it('flag OFF leaves the control out of the DOM', async () => {
    arrangeFlag(false);
    renderTab();
    expect(screen.queryByRole('button', { name: 'Finalize Output' })).toBeNull();
  });

  it('flag ON calls finalizeOutput with the selected program', async () => {
    arrangeFlag(true);
    vi.mocked(finalizeOutput).mockResolvedValue({
      id: 'out-1',
      programId: 'prog-1',
      programName: null,
      version: 1,
      title: 'Output',
      packVersion: 1,
      finalizedBy: 'u1',
      finalizedByName: null,
      finalizedAt: '2026-08-28',
      supersededBy: null,
      supersededAt: null,
      contentHash: 'abcdef1234567890',
    });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalize Output' }));
    await waitFor(() => expect(finalizeOutput).toHaveBeenCalledWith('prog-1'));
  });

  it('success shows version and shortened hash and refreshes once', async () => {
    arrangeFlag(true);
    const changed = vi.fn();
    vi.mocked(finalizeOutput).mockResolvedValue({
      id: 'out-1',
      programId: 'prog-1',
      programName: null,
      version: 3,
      title: 'Output',
      packVersion: 1,
      finalizedBy: 'u1',
      finalizedByName: null,
      finalizedAt: '2026-08-28',
      supersededBy: null,
      supersededAt: null,
      contentHash: 'abcdef1234567890',
    });
    renderTab(changed);
    fireEvent.click(await screen.findByRole('button', { name: 'Finalize Output' }));
    await screen.findByText(/Output created v3/);
    expect(screen.getByText('abcdef123456')).toBeInTheDocument();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('shows the literal backend conflict message', async () => {
    arrangeFlag(true);
    vi.mocked(finalizeOutput).mockRejectedValue({
      response: { status: 409, data: { error: '2 findings remain in draft; example afnd_1' } },
    });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalize Output' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '2 findings remain in draft; example afnd_1'
    );
  });

  it('disables during the request so two clicks produce one call', async () => {
    arrangeFlag(true);
    let resolve!: (value: any) => void;
    vi.mocked(finalizeOutput).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    renderTab();
    const button = await screen.findByRole('button', { name: 'Finalize Output' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(finalizeOutput).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    resolve({ id: 'out-1', version: 1, contentHash: 'abcdef123456' });
  });
});
