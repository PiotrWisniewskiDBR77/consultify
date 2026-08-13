import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GateSignoffQueue } from '../../../src/components/MyWork/GateSignoffQueue';
import {
  getMyGateSignoffs,
  submitGateSignoff,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  getMyGateSignoffs: vi.fn(),
  submitGateSignoff: vi.fn(),
}));

const item = (profile: 'BASELINE_SMALL' | 'STANDARD' | 'COMPLEX', index: number) => ({
  gate: (['DEFINITION', 'ANALYSIS', 'PORTFOLIO'] as const)[index],
  decisionId: `decision-${index}`,
  decisionVersion: 1,
  initiativeId: `initiative-${index}`,
  projectId: 'project-1',
  requesterId: 'requester-1',
  authorityId: 'actor-1',
  requestedAt: '2026-08-09T12:00:00.000Z',
  dueAt: '2026-08-11T12:00:00.000Z',
  sla: {
    hours: profile === 'COMPLEX' ? 24 : profile === 'STANDARD' ? 48 : 72,
    dueAt: '2026-08-11T12:00:00.000Z',
    state: 'OPEN' as const,
  },
  effectivePolicy: {
    policyId: `policy-${profile}`,
    policyVersion: 3,
    profile,
    source: 'ORGANIZATION',
    policyEnforced: true,
    rule:
      profile === 'COMPLEX'
        ? {
            quorum: 2,
            requiredRoles: ['BUSINESS_AUTHORITY', 'DOMAIN_AUTHORITY'],
            separation: true,
            slaHours: 24,
          }
        : profile === 'STANDARD'
          ? { quorum: 1, requiredRoles: ['GATE_AUTHORITY'], separation: true, slaHours: 48 }
          : { quorum: 1, requiredRoles: [], separation: false, slaHours: 72 },
  },
  actorBindings: [
    {
      roleKey:
        profile === 'COMPLEX'
          ? 'BUSINESS_AUTHORITY'
          : profile === 'STANDARD'
            ? 'GATE_AUTHORITY'
            : 'TEAM_LEAD',
      mode: 'DIRECT' as const,
      delegatedFrom: null,
      delegationProof: null,
      eligible: true,
    },
  ],
  actorEligible: true,
  quorum: {
    quorumId: `${(['DEFINITION', 'ANALYSIS', 'PORTFOLIO'] as const)[index]}:decision-${index}`,
    version: 0,
    status: 'COLLECTING' as const,
    signoffs: [],
    receiptId: null,
    updatedAt: null,
  },
});

describe('GateSignoffQueue', () => {
  beforeEach(() => {
    vi.mocked(getMyGateSignoffs)
      .mockReset()
      .mockResolvedValue({
        items: [item('BASELINE_SMALL', 0), item('STANDARD', 1), item('COMPLEX', 2)],
      });
    vi.mocked(submitGateSignoff).mockReset().mockResolvedValue({ status: 'APPLIED' });
  });

  it('renders exact Small, Standard and Complex policy/rule/SLA projections', async () => {
    render(<GateSignoffQueue />);
    expect(await screen.findByText('BASELINE_SMALL')).toBeInTheDocument();
    expect(screen.getByText('STANDARD')).toBeInTheDocument();
    expect(screen.getByText('COMPLEX')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('row', { name: /Gate Sign-off PORTFOLIO initiative-2 COMPLEX/ })
    );
    expect(screen.getByText('policy-COMPLEX · v3')).toBeInTheDocument();
    expect(screen.getByText('2; roles: BUSINESS_AUTHORITY, DOMAIN_AUTHORITY')).toBeInTheDocument();
    expect(screen.getByText('Requester cannot sign')).toBeInTheDocument();
  });

  it('submits only the actor-owned bound role and exact quorum version', async () => {
    render(<GateSignoffQueue />);
    fireEvent.click(
      await screen.findByRole('row', { name: /Gate Sign-off ANALYSIS initiative-1 STANDARD/ })
    );
    fireEvent.change(screen.getByLabelText('Sign-off rationale'), {
      target: { value: 'Evidence supports this gate.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record my sign-off' }));
    await waitFor(() =>
      expect(submitGateSignoff).toHaveBeenCalledWith(
        'initiative-1',
        expect.objectContaining({
          expectedVersion: 0,
          expectedQuorumVersion: 0,
          gate: 'ANALYSIS',
          decisionId: 'decision-1',
          requesterId: 'requester-1',
          roleKey: 'GATE_AUTHORITY',
          outcome: 'APPROVE',
          delegationProof: null,
          rationale: 'Evidence supports this gate.',
        })
      )
    );
  });
});
