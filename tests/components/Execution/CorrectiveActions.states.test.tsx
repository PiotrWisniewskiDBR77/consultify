/**
 * @vitest-environment jsdom
 *
 * CB-03 Codex review pass 2 — CorrectiveActions must distinguish:
 *  - no project/initiative context supplied (nothing to call) — "no-context"
 *  - a real request that fails (non-2xx / network error) — "error", retryable
 *  - a real request that succeeds with zero rows — genuine "empty" (on-track)
 *  - a real request that succeeds with rows — the actual list
 *
 * Before this fix, both a failed request AND a genuinely empty queue mapped
 * to the same `[]` + "All KPIs are on track" copy, so an outage was
 * indistinguishable from a healthy state.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CorrectiveActions } from '../../../src/components/Execution/CorrectiveActions';

describe('CorrectiveActions — honest load states', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('shows "No project context" and never calls fetch when no projectId is supplied', async () => {
    render(<CorrectiveActions />);

    expect(await screen.findByText('No project context')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows a distinct retryable "unavailable" state on a non-2xx response — not the healthy-empty copy', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 503 });

    render(<CorrectiveActions projectId="init-1" />);

    expect(await screen.findByText('Corrective Action is unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No corrective actions')).not.toBeInTheDocument();
    expect(screen.queryByText(/All KPIs are on track/i)).not.toBeInTheDocument();
  });

  it('shows the same unavailable state on a network error', async () => {
    (global.fetch as any).mockRejectedValue(new Error('network down'));

    render(<CorrectiveActions projectId="init-1" />);

    expect(await screen.findByText('Corrective Action is unavailable')).toBeInTheDocument();
  });

  it('retry re-issues the request and can recover into the genuine empty state', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<CorrectiveActions projectId="init-1" />);

    expect(await screen.findByText('Corrective Action is unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('No corrective actions')).toBeInTheDocument();
    });
    expect(screen.getByText(/All KPIs are on track/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('a genuine successful empty response shows the healthy-empty state directly', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => [] });

    render(<CorrectiveActions projectId="init-1" />);

    expect(await screen.findByText('No corrective actions')).toBeInTheDocument();
  });

  it('a successful response with rows renders the real list, not any empty/unavailable state', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'a1',
          title: 'Fix throughput',
          description: 'desc',
          status: 'OPEN',
          priority: 'HIGH',
          dueDate: '2099-01-01T00:00:00.000Z',
          createdDate: '2026-01-01T00:00:00.000Z',
          expectedImpact: 'impact',
        },
      ],
    });

    render(<CorrectiveActions projectId="init-1" />);

    expect(await screen.findByText('Fix throughput')).toBeInTheDocument();
    expect(screen.queryByText('No corrective actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Corrective Action is unavailable')).not.toBeInTheDocument();
  });

  it('fetches the real projectId in the request URL, never a fabricated org id or "all"', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => [] });

    render(<CorrectiveActions projectId="init-real-42" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/pmo/projects/init-real-42/corrective-actions'
      );
    });
  });
});
