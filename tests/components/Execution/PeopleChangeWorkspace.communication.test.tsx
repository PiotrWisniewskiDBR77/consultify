/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PeopleChangeWorkspace } from '../../../src/components/Execution/PeopleChangeWorkspace';
import Api from '../../../src/services/api';

vi.mock('../../../src/services/api', () => ({
  __esModule: true,
  default: {
    getStakeholderSegments: vi.fn(),
    getStakeholderPlans: vi.fn(),
    getStakeholderPlanItems: vi.fn(),
    getSteercoPacks: vi.fn(),
    getStakeholderOverduePlans: vi.fn(),
    getStakeholderSendLog: vi.fn(),
    sendStakeholderPlanItem: vi.fn(),
    distributeSteercoPack: vi.fn(),
  },
  getHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

describe('PeopleChangeWorkspace communication seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/api/capabilities/match/requirements')) {
          return { ok: true, json: async () => ({ data: [] }) } as Response;
        }
        if (url.includes('/api/capabilities')) {
          return { ok: true, json: async () => ({ data: [] }) } as Response;
        }

        return { ok: true, json: async () => ({ data: [] }) } as Response;
      })
    );

    vi.mocked(Api.getStakeholderSegments).mockResolvedValue([
      { id: 'seg-1', name: 'Sponsors', segmentType: 'steerco', membersJson: [{ id: 'u-1' }] },
    ] as any);
    vi.mocked(Api.getStakeholderPlans).mockResolvedValue([
      { id: 'plan-1', description: 'Monthly sponsor update', cadence: 'monthly', isActive: true },
    ] as any);
    vi.mocked(Api.getStakeholderPlanItems).mockResolvedValue([
      {
        id: 'item-1',
        planId: 'plan-1',
        subject: 'SteerCo status memo',
        status: 'draft',
        segmentIds: ['seg-1'],
        channel: 'email',
      },
    ] as any);
    vi.mocked(Api.getSteercoPacks).mockResolvedValue([
      {
        id: 'pack-1',
        title: 'April SteerCo Pack',
        packType: 'status_update',
        status: 'draft',
        distributionChannels: 'in_app,email',
      },
    ] as any);
    vi.mocked(Api.getStakeholderOverduePlans).mockResolvedValue([
      { id: 'plan-2', description: 'Board recap', cadence: 'weekly', nextDueAt: '2026-03-20T00:00:00.000Z' },
    ] as any);
    vi.mocked(Api.getStakeholderSendLog).mockResolvedValue([
      { id: 'log-1', channel: 'email', recipientCount: 12, sentAt: '2026-03-26T00:00:00.000Z' },
    ] as any);
    vi.mocked(Api.sendStakeholderPlanItem).mockResolvedValue({ id: 'item-1', status: 'sent' } as any);
    vi.mocked(Api.distributeSteercoPack).mockResolvedValue([{ id: 'rec-1', packId: 'pack-1' }] as any);
  });

  it('loads stakeholder communication reads through the shared Api seam', async () => {
    render(<PeopleChangeWorkspace initiativeId="init-1" projectId="proj-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Communication' }));

    await waitFor(() => {
      expect(Api.getStakeholderSegments).toHaveBeenCalledWith('init-1');
      expect(Api.getStakeholderPlans).toHaveBeenCalledWith('init-1');
      expect(Api.getStakeholderPlanItems).toHaveBeenCalledWith('plan-1');
      expect(Api.getSteercoPacks).toHaveBeenCalledWith({ initiativeId: 'init-1' });
      expect(Api.getStakeholderOverduePlans).toHaveBeenCalledTimes(1);
      expect(Api.getStakeholderSendLog).toHaveBeenCalledWith({
        initiativeId: 'init-1',
        limit: 20,
      });
    });

    expect(await screen.findByText('Sponsors')).toBeInTheDocument();
    expect(screen.getByText('Monthly sponsor update')).toBeInTheDocument();
    expect(screen.getByText('SteerCo status memo')).toBeInTheDocument();
    expect(screen.getByText('April SteerCo Pack')).toBeInTheDocument();
    expect(screen.getByText(/Overdue Communications/i)).toBeInTheDocument();
    expect(screen.getByText(/email · 12 recipients/i)).toBeInTheDocument();

    const calledUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(calledUrls.some((url) => url.includes('/api/stakeholder-comm'))).toBe(false);
  });

  it('sends the next pending stakeholder plan item through the shared Api seam', async () => {
    render(<PeopleChangeWorkspace initiativeId="init-1" projectId="proj-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Communication' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Send now' }));

    await waitFor(() => {
      expect(Api.sendStakeholderPlanItem).toHaveBeenCalledWith('plan-1', 'item-1', {
        initiativeId: 'init-1',
        segmentId: 'seg-1',
        recipientCount: 1,
      });
    });

    expect(Api.getStakeholderPlans).toHaveBeenCalledTimes(2);
    expect(Api.getStakeholderPlanItems).toHaveBeenCalledTimes(2);

    const calledUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(calledUrls.some((url) => url.includes('/api/stakeholder-comm'))).toBe(false);
  });

  it('distributes a steerco pack through the shared Api seam', async () => {
    render(<PeopleChangeWorkspace initiativeId="init-1" projectId="proj-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Communication' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Distribute now' }));

    await waitFor(() => {
      expect(Api.distributeSteercoPack).toHaveBeenCalledWith('pack-1', {
        segmentIds: ['seg-1'],
        channels: ['in_app', 'email'],
      });
    });

    expect(Api.getSteercoPacks).toHaveBeenCalledTimes(2);

    const calledUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(calledUrls.some((url) => url.includes('/api/stakeholder-comm'))).toBe(false);
  });
});
