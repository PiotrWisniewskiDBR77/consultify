import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MitigationPanel } from '../../../src/components/Execution/MitigationPanel';

const trackFunnelEventMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: any[]) => trackFunnelEventMock(...args),
}));

describe('MitigationPanel (L2)', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockClear();
    vi.useRealTimers();
    (globalThis as any).fetch = undefined;
    localStorage.clear();
  });

  it('renders initial values and inputs', () => {
    render(
      <MitigationPanel
        raidItemId="r-1"
        initialPlan="P"
        initialStrategy="MITIGATE"
        initialOwnerId="u-1"
        initialDueDate="2026-02-21"
        initialStatus="IN_PROGRESS"
      />
    );

    expect(screen.getByText('execution.mitigation.title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('execution.mitigation.planPlaceholder')).toHaveValue('P');
    const [strategySelect, statusSelect] = screen.getAllByRole('combobox');
    expect((strategySelect as HTMLSelectElement).value).toBe('MITIGATE');
    expect((statusSelect as HTMLSelectElement).value).toBe('IN_PROGRESS');
    expect(screen.getByDisplayValue('2026-02-21')).toBeInTheDocument();
    expect(screen.getByDisplayValue('u-1')).toBeInTheDocument();
  });

  it('renders localized option labels via strategy/status keys', () => {
    render(<MitigationPanel raidItemId="r-1" />);
    expect(screen.getByRole('option', { name: 'execution.mitigation.avoid' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'execution.mitigation.statusOpen' })
    ).toBeInTheDocument();
  });

  it('does not call fetch when auth token is missing', async () => {
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;

    render(<MitigationPanel raidItemId="r-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'execution.mitigation.save' }));

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('does not call fetch when localStorage throws', async () => {
    const fetchMock = vi.fn();
    (globalThis as any).fetch = fetchMock;

    const originalLocalStorage = globalThis.localStorage;
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem() {
            throw new Error('boom');
          },
        },
      });
      render(<MitigationPanel raidItemId="r-1" />);
      fireEvent.click(screen.getByRole('button', { name: 'execution.mitigation.save' }));

      await waitFor(() => {
        expect(fetchMock).not.toHaveBeenCalled();
      });
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  it('sends PATCH with only non-empty fields in body', async () => {
    localStorage.setItem('token', 't-1');

    const fetchMock = vi.fn(async () => ({ ok: true }));
    (globalThis as any).fetch = fetchMock;

    render(<MitigationPanel raidItemId="r-1" initialStatus="OPEN" />);

    fireEvent.change(screen.getByPlaceholderText('execution.mitigation.planPlaceholder'), {
      target: { value: 'Plan A' },
    });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'TRANSFER' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'CLOSED' } });
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByPlaceholderText('Owner ID'), { target: { value: 'u-9' } });

    fireEvent.click(screen.getByRole('button', { name: 'execution.mitigation.save' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/execution-control/raid/r-1/mitigation');
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer t-1');

    const body = JSON.parse(init.body);
    expect(body).toEqual(
      expect.objectContaining({
        raidItemId: 'r-1',
        mitigationPlan: 'Plan A',
        mitigationOwnerId: 'u-9',
        responseStrategy: 'TRANSFER',
        mitigationDueDate: '2026-03-01',
        mitigationStatus: 'CLOSED',
      })
    );
  });

  it('marks as saved on success, tracks funnel event and calls onSaved', async () => {
    vi.useFakeTimers();
    localStorage.setItem('token', 't-1');

    const fetchMock = vi.fn(async () => ({ ok: true }));
    (globalThis as any).fetch = fetchMock;

    const onSaved = vi.fn();
    render(
      <MitigationPanel
        raidItemId="r-1"
        initialStrategy="AVOID"
        initialStatus="OPEN"
        onSaved={onSaved}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'execution.mitigation.save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(trackFunnelEventMock).toHaveBeenCalledWith('execution_risk_mitigation_updated', {
      raidItemId: 'r-1',
      strategy: 'AVOID',
      status: 'OPEN',
    });
    expect(onSaved).toHaveBeenCalledTimes(1);

    expect(
      await screen.findByRole('button', { name: 'execution.mitigation.saved' })
    ).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'execution.mitigation.save' })).toBeInTheDocument();
    });
  });

  it('does not mark as saved when response is not ok', async () => {
    localStorage.setItem('token', 't-1');
    const fetchMock = vi.fn(async () => ({ ok: false }));
    (globalThis as any).fetch = fetchMock;

    render(<MitigationPanel raidItemId="r-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'execution.mitigation.save' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'execution.mitigation.save' })).toBeInTheDocument();
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });

  it('recovers from fetch throwing and re-enables save', async () => {
    localStorage.setItem('token', 't-1');
    const fetchMock = vi.fn(async () => {
      throw new Error('net');
    });
    (globalThis as any).fetch = fetchMock;

    render(<MitigationPanel raidItemId="r-1" />);
    const btn = screen.getByRole('button', { name: 'execution.mitigation.save' });
    fireEvent.click(btn);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'execution.mitigation.save' })).not.toBeDisabled()
    );
  });
});

