import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GovernedInitiativeHandoffCard } from '../GovernedInitiativeHandoffCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}));

const response = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: async () => body } as Response);

describe('GovernedInitiativeHandoffCard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts idle and does not mutate before explicit consent', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <GovernedInitiativeHandoffCard
        initiativeId="initiative-1"
        title="Chat draft"
        onOpenInitiative={vi.fn()}
        onAdopted={vi.fn()}
      />
    );
    expect(screen.getByTestId('governed-initiative-handoff-initiative-1')).toHaveAttribute(
      'data-visual-state',
      'idle'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows concrete missing fields and never calls the adoption route while blocked', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => response({ id: 'initiative-1', problem_statement: '' }));
    const onOpenInitiative = vi.fn();
    render(
      <GovernedInitiativeHandoffCard
        initiativeId="initiative-1"
        onOpenInitiative={onOpenInitiative}
        onAdopted={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check before handoff' }));
    await waitFor(() =>
      expect(screen.getByTestId('governed-initiative-handoff-initiative-1')).toHaveAttribute(
        'data-visual-state',
        'blocked'
      )
    );
    expect(screen.getByText(/project, initiative owner, problem statement/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/initiatives/initiative-1');
    fireEvent.click(screen.getByRole('button', { name: /Complete in Initiatives/ }));
    expect(onOpenInitiative).toHaveBeenCalledWith('initiative-1');
  });

  it('requires a second explicit click before adopting a ready draft', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() =>
        response({
          id: 'initiative-1',
          project_id: 'project-1',
          owner_execution_id: 'owner-1',
          problem_statement: 'Measured problem',
        })
      )
      .mockImplementationOnce(() => response({ response: { initiativeId: 'initiative-1' } }, true));
    const onAdopted = vi.fn();
    render(
      <GovernedInitiativeHandoffCard
        initiativeId="initiative-1"
        onOpenInitiative={vi.fn()}
        onAdopted={onAdopted}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check before handoff' }));
    await waitFor(() =>
      expect(screen.getByTestId('governed-initiative-handoff-initiative-1')).toHaveAttribute(
        'data-visual-state',
        'ready'
      )
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pass to execution' }));
    await waitFor(() => expect(onAdopted).toHaveBeenCalledWith('initiative-1'));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1][0])).toContain('/adoptions/chat-draft');
  });
});
