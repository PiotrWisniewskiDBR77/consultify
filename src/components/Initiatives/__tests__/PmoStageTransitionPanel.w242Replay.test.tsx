import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import proof from '../../../../docs/program/PMO_1A_V4_W224_20260917/measure-v4d-realpg.json';
const state = vi.hoisted(() => ({ preflight: null as unknown }));
vi.mock('@/services/initiatives/lifecycleApi', () => ({
  fetchInitiativeTransitionPreflight: vi.fn(async () => state.preflight),
  applyInitiativeTransition: vi.fn(),
  setInitiativeLifecycleFlag: vi.fn(),
  readInitiativeFailureRule: vi.fn(),
}));
vi.mock('@/services/initiativeTransitionInboxApi', () => ({
  listLifecycleGateDecisions: vi.fn(async () => []),
  requestTransitionDecision: vi.fn(),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  readRegisteredInitiative: vi.fn(async () => ({ version: 3 })),
  requestAnalysisDecision: vi.fn(),
  startInitiativeAnalysis: vi.fn(),
}));
import { PmoStageTransitionPanel } from '../PmoStageTransitionPanel';
afterEach(cleanup);
const actor = '08c54d75-5260-57b1-9db6-a30aed89a587';
describe('W242 real component + real hook replay of local Gateway/RealPG responses', () => {
  it.each(proof.withIdentityScheduled.results)(
    '$title has a usable decision or an honest reason',
    async (row) => {
      state.preflight = row.preflight;
      render(
        <PmoStageTransitionPanel
          initiativeId={row.id}
          reviewerUserId={row.sponsorId}
          currentUserId={actor}
        />
      );
      await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
      const primary = row.preflight.transitions.find(
        (t) => t.roleAllowed && !['REJECT', 'CANCEL'].includes(t.gate || '')
      );
      if (!primary) {
        await screen.findByText('No transition is available for your role at this stage.');
        return;
      }
      const button = await screen.findByRole('button', { name: 'Request decision' });
      expect(button).toBeDisabled();
      expect(
        screen.getByTestId('pmo-decision-request-blocked-reason').textContent?.trim().length
      ).toBeGreaterThan(0);
    }
  );
  it('allows the distinct, authorized reviewer for the seeded ready case', async () => {
    state.preflight = proof.eligible.body;
    render(
      <PmoStageTransitionPanel
        initiativeId={proof.positive.initiativeId}
        reviewerUserId={actor}
        currentUserId="bf70ce19-b249-5c08-839f-449e1d5cddd8"
      />
    );
    expect(await screen.findByRole('button', { name: 'Request decision' })).toBeEnabled();
  });
  it('disables an unauthorized reviewer with the server reason', async () => {
    state.preflight = proof.wrongAuthority.body;
    render(
      <PmoStageTransitionPanel
        initiativeId={proof.positive.initiativeId}
        reviewerUserId="bf70ce19-b249-5c08-839f-449e1d5cddd8"
        currentUserId={actor}
      />
    );
    expect(await screen.findByRole('button', { name: 'Request decision' })).toBeDisabled();
    expect(screen.getByTestId('pmo-decision-request-blocked-reason')).toHaveTextContent(
      'reviewer authority'
    );
  });
});
