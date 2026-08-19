/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn() },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getAttributions: vi.fn(),
    getParticipantLedger: vi.fn(),
    getProgramStatus: vi.fn(),
  },
}));

import {
  loadPartnerCanonicalRuntime,
  PartnerCanonicalRuntimePanel,
  type PartnerCanonicalRuntimeSnapshot,
} from '@/components/Partner/PartnerCanonicalRuntimePanel';
import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';

describe('PartnerCanonicalRuntimePanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads all five governed surfaces and derives persisted states', async () => {
    vi.mocked(V8PartnerApi.getProgramStatus).mockResolvedValue({
      lifecyclePhase: 'connected',
      partnerOrganizationStatus: 'ACTIVE',
      balances: {
        grossEarned: 1200,
        heldAmount: 200,
        paidOut: 400,
        availableToPayout: 600,
        currency: 'EUR',
      },
    } as any);
    vi.mocked(V8PartnerApi.getAttributions).mockResolvedValue({
      attributions: [
        { id: 'attr-1', status: 'ACTIVE' },
        { id: 'attr-2', status: 'EXPIRED' },
      ],
    } as any);
    vi.mocked(V8PartnerApi.getParticipantLedger).mockResolvedValue({
      entries: [
        {
          id: 'fact-1',
          eventType: 'referral.attributed',
          sourceVersion: 'partner-participant-referral-v1',
          sourceDigest: 'a'.repeat(64),
        },
      ],
    } as any);
    vi.mocked(Api.get).mockResolvedValue({
      success: true,
      data: {
        data: [
          { id: 'cert-1', status: 'completed', reviewState: 'approved' },
          { id: 'cert-2', status: 'in_progress', reviewState: 'pending' },
        ],
      },
    } as any);

    const snapshot = await loadPartnerCanonicalRuntime();

    expect(snapshot.programState).toBe('ready');
    expect(snapshot.certifications).toMatchObject({ total: 2, completed: 1, pendingReview: 1 });
    expect(snapshot.attributions).toMatchObject({ total: 2, active: 1 });
    expect(snapshot.participantLedger).toMatchObject({ state: 'ready' });
  });

  it('fails closed per surface and exposes no forbidden payout control', async () => {
    vi.mocked(V8PartnerApi.getProgramStatus).mockRejectedValue(new Error('program unavailable'));
    vi.mocked(V8PartnerApi.getAttributions).mockRejectedValue(new Error('attribution unavailable'));
    vi.mocked(V8PartnerApi.getParticipantLedger).mockRejectedValue(new Error('ledger unavailable'));
    vi.mocked(Api.get).mockRejectedValue(new Error('certification unavailable'));

    const snapshot = await loadPartnerCanonicalRuntime();
    render(<PartnerCanonicalRuntimePanel snapshot={snapshot} />);

    const panel = screen.getByRole('region', { name: 'Governed Partner runtime' });
    expect(within(panel).getAllByRole('listitem')).toHaveLength(5);
    expect(within(panel).getByText('Partner status')).toBeInTheDocument();
    expect(within(panel).getByText('Certification')).toBeInTheDocument();
    expect(within(panel).getByText('Attribution')).toBeInTheDocument();
    expect(within(panel).getByText('Participant ledger')).toBeInTheDocument();
    expect(within(panel).getByText('Accrual eligibility')).toBeInTheDocument();
    expect(within(panel).getAllByText('Unavailable')).toHaveLength(4);
    expect(within(panel).getByText('Policy gated')).toBeInTheDocument();
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
    expect(within(panel).getByRole('note')).toHaveTextContent('Accrual, payout requests');
    expect(within(panel).getByRole('list')).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'xl:grid-cols-5'
    );
  });

  it('renders verified values while keeping accrual policy-gated', () => {
    const snapshot: PartnerCanonicalRuntimeSnapshot = {
      program: {
        lifecyclePhase: 'certified',
        partnerOrganizationStatus: 'ACTIVE',
        balances: {
          grossEarned: 1000,
          heldAmount: 100,
          paidOut: 300,
          availableToPayout: 600,
          currency: 'EUR',
        },
      } as any,
      programState: 'ready',
      certifications: { total: 3, completed: 2, pendingReview: 1, state: 'ready' },
      attributions: { total: 4, active: 3, state: 'ready' },
      participantLedger: {
        state: 'ready',
        entries: [
          {
            id: 'fact-1',
            eventType: 'referral.attributed',
            participantOrganizationId: 'customer-1',
            sourceKind: 'partner_attribution',
            sourceId: 'attr-1',
            sourceVersion: 'partner-participant-referral-v1',
            sourceDigest: 'b'.repeat(64),
            occurredAt: '2026-08-19T10:00:00Z',
            recordedAt: '2026-08-19T10:00:01Z',
          },
        ],
      },
    };

    render(<PartnerCanonicalRuntimePanel snapshot={snapshot} />);

    expect(screen.getByText('certified')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('3 active attribution records')).toBeInTheDocument();
    expect(screen.getByText('partner-participant-referral-v1 · bbbbbbbbbbbb')).toBeInTheDocument();
    expect(screen.getByText(/Recorded balance only/)).toBeInTheDocument();
  });
});
