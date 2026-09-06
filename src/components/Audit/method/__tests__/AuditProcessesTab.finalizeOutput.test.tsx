/**
 * AuditProcessesTab — "Finalize Output" control.
 *
 * DEC-417 (1.1-A3): flaga `ff_auditsReportChain` usunięta — kontrolka jest
 * teraz widoczna zawsze, bez warunku.
 *
 * `MemoryRouter`: `AuditProcessesTab` osadza `JedenPrawyPanel`, który woła
 * `useJedenPanel()`/`useLocation()` bezwarunkowo (K5, `useJedenPanel.ts`) —
 * bez Routera render rzuca „useLocation() may be used only in the context
 * of a <Router>” niezależnie od tej flagi (ZNALEZISKO przy 1.1-A3/K6).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { AuditProcessesTab } from '../tabs/AuditProcessesTab';
import {
  finalizeOutput,
  getProgram,
  getProgramCoverage,
  getProgramLifecycle,
  listProgramCriteria,
  type AuditProgramSummary,
} from '../auditsMethodApi';

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

function renderTab(onProgramChanged = vi.fn()) {
  return render(
    <MemoryRouter>
      <AuditProcessesTab
        programs={[program]}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        isPolish={false}
        onProgramChanged={onProgramChanged}
        initialSelectedId="prog-1"
      />
    </MemoryRouter>
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

  it('calls finalizeOutput with the selected program', async () => {
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
