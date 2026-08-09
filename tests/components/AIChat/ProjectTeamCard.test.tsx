/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectTeamCard } from '../../../src/components/AIChat/ProjectTeamCard';

const getTeam = vi.fn(),
  propose = vi.fn(),
  approve = vi.fn(),
  activate = vi.fn();
vi.mock('@/services/api/v8/transformation-cases', () => ({
  TransformationCasesApi: {
    getProjectTeam: (...a: unknown[]) => getTeam(...a),
    proposeProjectTeam: (...a: unknown[]) => propose(...a),
    approveProjectTeam: (...a: unknown[]) => approve(...a),
    activateProjectTeam: (...a: unknown[]) => activate(...a),
  },
}));
describe('ProjectTeamCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeam.mockRejectedValue(new Error('none'));
    propose.mockResolvedValue({});
    approve.mockResolvedValue({});
    activate.mockResolvedValue({});
  });
  it('keeps unknown identities explicit and sends a governed Teresa proposal', async () => {
    render(
      <ProjectTeamCard
        caseId="case-1"
        caseVersion={3}
        projectId="project-1"
        currentUserId={null}
        isPolish={false}
      />
    );
    expect(await screen.findByText(/UNKNOWN requires an answer/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Teresa to propose' }));
    await waitFor(() =>
      expect(propose).toHaveBeenCalledWith(
        'case-1',
        expect.objectContaining({
          expectedCaseVersion: 3,
          sponsorUserId: null,
          members: expect.arrayContaining([
            expect.objectContaining({ kind: 'human', identityId: null }),
            expect.objectContaining({
              kind: 'agent',
              identityId: 'consultify:teresa:transformation-agent',
              budgetLimit: 0,
            }),
          ]),
        }),
        expect.any(String)
      )
    );
  });
  it('renders operational team truth in the Case rather than technical diagnostics', async () => {
    getTeam.mockResolvedValue({
      blueprint_version_id: 'bv-1',
      blueprint_version: 2,
      status: 'approved',
      sponsor_user_id: 'sponsor',
      missing_keys_json: [],
      clarification_questions_json: [],
      members_json: [
        {
          kind: 'human',
          identityId: 'owner',
          displayName: 'Owner',
          role: 'Project owner',
          authority: ['coordinate'],
          sourceRefs: ['membership'],
        },
        {
          kind: 'agent',
          identityId: 'agent',
          displayName: 'Teresa',
          role: 'Orchestration',
          authority: ['prepare'],
          autonomy: 'execute_with_approval',
          budgetLimit: 500,
          sourceRefs: ['plan'],
        },
      ],
      raci_json: [],
      work_json: [
        {
          workItem: 'Delivery',
          ownerIdentityId: 'owner',
          branchStatus: 'planned',
          estimatedCost: 500,
          conflicts: ['capacity'],
          pendingDecisions: ['timing'],
        },
      ],
    });
    render(
      <ProjectTeamCard
        caseId="case-1"
        caseVersion={3}
        projectId="project-1"
        currentUserId="sponsor"
        isPolish={false}
      />
    );
    expect(await screen.findByText(/branch planned/)).toHaveTextContent('cost 500');
    expect(screen.getByText(/conflicts capacity/)).toHaveTextContent('pending timing');
    fireEvent.click(screen.getByRole('button', { name: 'Activate team and A06' }));
    await waitFor(() =>
      expect(activate).toHaveBeenCalledWith('case-1', 'bv-1', expect.any(String))
    );
  });
});
