import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnifiedExecutionReportGenerator } from '../UnifiedExecutionReportGenerator';

const api = vi.hoisted(() => ({
  createReportRun: vi.fn(),
  getReportDefinition: vi.fn(),
  listReportDefinitions: vi.fn(),
  listReportRuns: vi.fn(),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => api);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const publishedDefinition = {
  definitionId: 'def-1',
  versions: [
    {
      definitionVersion: 3,
      state: 'PUBLISHED',
      name: 'Weekly pack',
      ownerId: 'owner',
      approverId: 'approver',
    },
  ],
};
const ready = (runs: any[] = []) => {
  api.listReportDefinitions.mockResolvedValue({ items: [{ definitionId: 'def-1' }] });
  api.getReportDefinition.mockResolvedValue(publishedDefinition);
  api.listReportRuns.mockResolvedValue({ items: runs });
};

describe('Unified Execution report generator', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
  });

  it('separates historical period, as-of, reporting week and forecast horizon', async () => {
    ready();
    render(<UnifiedExecutionReportGenerator />);
    expect(await screen.findByLabelText('Historical period start')).toBeInTheDocument();
    expect(screen.getByLabelText('Historical period end')).toBeInTheDocument();
    expect(screen.getByLabelText('Separate as-of timestamp')).toBeInTheDocument();
    expect(screen.getByLabelText('Reporting week')).toBeInTheDocument();
    expect(screen.getByLabelText('Forecast horizon (weeks)')).toBeInTheDocument();
  });

  it('creates a governed runtime-v1 DRAFT against an exact published definition', async () => {
    ready();
    api.createReportRun.mockResolvedValue({ status: 'CREATED' });
    render(<UnifiedExecutionReportGenerator />);
    await screen.findByLabelText('Report run ID');
    fireEvent.change(screen.getByLabelText('Report run ID'), { target: { value: 'run-new' } });
    fireEvent.change(screen.getByLabelText('Published definition'), {
      target: { value: 'def-1@3' },
    });
    fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Weekly steering' } });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'Board' } });
    fireEvent.change(screen.getByLabelText('Historical period start'), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByLabelText('Historical period end'), {
      target: { value: '2026-08-24' },
    });
    fireEvent.change(screen.getByLabelText('Separate as-of timestamp'), {
      target: { value: '2026-08-25T10:00' },
    });
    fireEvent.change(screen.getByLabelText('Reporting week'), { target: { value: '2026-W35' } });
    fireEvent.change(screen.getByLabelText('Authorized scope reference'), {
      target: { value: 'project:p1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create governed draft' }));
    await waitFor(() =>
      expect(api.createReportRun).toHaveBeenCalledWith(
        'run-new',
        expect.objectContaining({
          definitionRef: { definitionId: 'def-1', version: 3 },
          ownerId: 'owner',
          approverId: 'approver',
          expectedVersion: 0,
        })
      )
    );
  });

  it('keeps several report tabs open concurrently', async () => {
    ready([
      { reportRunId: 'run-1', status: 'DRAFT' },
      { reportRunId: 'run-2', status: 'DRAFT' },
    ]);
    render(<UnifiedExecutionReportGenerator />);
    fireEvent.click(await screen.findByRole('button', { name: /run-1/ }));
    fireEvent.click(screen.getByRole('button', { name: /run-2/ }));
    expect(screen.getByText(/Open report tabs: 2/)).toBeInTheDocument();
  });

  it('labels a published snapshot with its integrity hash and exposes no mutation control', async () => {
    ready([{ reportRunId: 'run-published', status: 'PUBLISHED', contentHash: 'sha256-abc' }]);
    render(<UnifiedExecutionReportGenerator />);
    expect(
      await screen.findByRole('button', { name: /contentHash:sha256-abc/ })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|refresh|overwrite/i })).toBeNull();
    expect(screen.getByText(/XLSX: BRAK_API/)).toBeInTheDocument();
  });

  it('renders honest load and validation states', async () => {
    api.listReportDefinitions.mockRejectedValueOnce(new Error('HTTP 503'));
    api.listReportRuns.mockResolvedValueOnce({ items: [] });
    const { unmount } = render(<UnifiedExecutionReportGenerator />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503');
    unmount();
    ready();
    render(<UnifiedExecutionReportGenerator />);
    expect(await screen.findByText(/INCOMPLETE/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create governed draft' })).toBeDisabled();
  });
});
