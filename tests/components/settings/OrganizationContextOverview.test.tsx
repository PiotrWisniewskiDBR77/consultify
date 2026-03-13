import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { OrganizationContextOverview } from '../../../src/components/settings/OrganizationContextOverview';

const organizationContextGet = vi.fn();
const organizationContextGetTimeline = vi.fn();
const organizationContextGetClaims = vi.fn();
const organizationContextRebuild = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    organizationContextGet: (...args: any[]) => organizationContextGet(...args),
    organizationContextGetTimeline: (...args: any[]) => organizationContextGetTimeline(...args),
    organizationContextGetClaims: (...args: any[]) => organizationContextGetClaims(...args),
    organizationContextRebuild: (...args: any[]) => organizationContextRebuild(...args),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

describe('OrganizationContextOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    organizationContextGet.mockResolvedValue({
      counts: { items: 2, claims: 3, conflicts: 1 },
      conflicts: [{ claimPath: 'profile.industry', values: ['A', 'B'], sourceTypes: ['chat'] }],
    });
    organizationContextGetTimeline.mockResolvedValue({
      timeline: [
        {
          id: 'item-1',
          sourceType: 'chat_message',
          sourceLabel: 'AI message saved as org context',
          createdAt: '2026-03-12T12:00:00.000Z',
          channel: 'chat',
          isExplicit: true,
          summary: 'Answer saved from chat',
        },
      ],
    });
    organizationContextGetClaims.mockResolvedValue({
      claims: [
        {
          id: 'claim-1',
          claimPath: 'chat.explicitContext',
          value: { content: 'Answer saved from chat' },
          confidence: 0.85,
          sourceType: 'chat_message',
          sourceLabel: 'AI message saved as org context',
          reviewStatus: 'accepted',
          isExplicit: true,
          createdAt: '2026-03-12T12:00:00.000Z',
        },
      ],
    });
    organizationContextRebuild.mockResolvedValue({ ok: true });
  });

  it('renders recent claims loaded from Context OS', async () => {
    render(<OrganizationContextOverview organizationId="org-1" canRebuild />);

    await waitFor(() => {
      expect(screen.getByText('chat.explicitContext')).toBeInTheDocument();
    });

    expect(screen.getByText('AI message saved as org context')).toBeInTheDocument();
    expect(screen.getByText('accepted')).toBeInTheDocument();
  });

  it('rebuilds snapshot and reloads data', async () => {
    render(<OrganizationContextOverview organizationId="org-1" canRebuild />);

    const button = await screen.findByRole('button', { name: 'Rebuild snapshot' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(organizationContextRebuild).toHaveBeenCalledTimes(1);
    });
    expect(organizationContextGet).toHaveBeenCalledTimes(2);
    expect(toastSuccess).toHaveBeenCalled();
  });
});
