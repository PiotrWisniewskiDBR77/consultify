/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../../../src/services/api', () => ({
  Api: { post: (...args: any[]) => state.post(...args), get: vi.fn() },
}));
vi.mock('../../../../src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline', () => ({
  useKimiArtifactPipeline: () => ({
    currentRun: null,
    isGenerating: false,
    isBusy: false,
    taskSteps: [],
    totalSteps: 0,
    completedSteps: 0,
    isCompleted: false,
    isFailed: false,
    failureReason: null,
    preview: null,
    startGeneration: vi.fn(),
    advancePipeline: vi.fn(),
    handleReplay: vi.fn(),
    handleRemix: vi.fn(),
    handleDownload: vi.fn(),
  }),
}));
vi.mock('../../../../src/utils/melsPrezentacjeFlag', () => ({
  isMelsPrezentacjeEnabled: () => false,
}));
vi.mock('../../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: any) => selector({ activeMessages: [] }),
}));
vi.mock('../../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({ chatKickoffMessage: null, clearChatKickoffMessage: vi.fn() }),
}));
vi.mock('../../../../src/components/AIChat/KimiWorkspace/KimiWorkspaceShell', () => ({
  KimiWorkspaceShell: () => <div />,
}));

import PrezentacjeView from '../../../../src/components/AIChat/KimiWorkspace/PrezentacjeView';

describe('PrezentacjeView template intake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('shows accessible brief before materialization and submits template lineage with facts', async () => {
    state.post.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith('/resolve')
          ? { data: { data: { template: { variables: [] } } } }
          : { data: { data: { id: 'deck-fresh' } } }
      )
    );
    render(
      <MemoryRouter initialEntries={['/prezentacje-gen?templateArtifactId=tpl-nova']}>
        <Routes>
          <Route path="/prezentacje-gen" element={<PrezentacjeView />} />
          <Route path="/presentations/builder/:id" element={<div>Builder opened</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(
      screen.getByRole('heading', { name: 'Uzupełnij brief prezentacji' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('presentation-template-lineage')).toHaveTextContent('tpl-nova');
    const generate = screen.getByRole('button', { name: 'Generuj prezentację' });
    expect(generate).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Brief i dane do slajdów'), {
      target: { value: 'NPV: EUR 3.2m; Payback: 11 months' },
    });
    fireEvent.change(screen.getByLabelText('Tytuł prezentacji'), {
      target: { value: 'Nova decision' },
    });
    fireEvent.submit(generate.closest('form')!);
    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith('/presentations/decks/from-template', {
        templateArtifactId: 'tpl-nova',
        brief: 'NPV: EUR 3.2m; Payback: 11 months',
        variableValues: {},
        title: 'Nova decision',
      })
    );
  });

  it('renders typed catalog controls, blocks missing required values and submits materialization values', async () => {
    state.post.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith('/resolve')
          ? {
              data: {
                data: {
                  template: {
                    variables: [
                      { key: 'budget', label: 'Budget', type: 'number', required: true },
                      {
                        key: 'scenario',
                        label: 'Scenario',
                        type: 'enum',
                        required: true,
                        options: ['Base', 'Upside'],
                      },
                    ],
                  },
                },
              },
            }
          : { data: { data: { id: 'deck-vars' } } }
      )
    );
    render(
      <MemoryRouter initialEntries={['/prezentacje-gen?templateArtifactId=tpl-vars']}>
        <Routes>
          <Route path="/prezentacje-gen" element={<PrezentacjeView />} />
          <Route path="/presentations/builder/:id" element={<div>Builder opened</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('spinbutton', { name: 'Budget *' })).toBeInTheDocument();
    const generate = screen.getByRole('button', { name: 'Generuj prezentację' });
    expect(generate).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Budget *' }), {
      target: { value: '1400000' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Scenario *' }), {
      target: { value: 'Base' },
    });
    expect(generate).toBeEnabled();
    fireEvent.submit(generate.closest('form')!);
    await waitFor(() =>
      expect(state.post).toHaveBeenCalledWith(
        '/presentations/decks/from-template',
        expect.objectContaining({ variableValues: { budget: '1400000', scenario: 'Base' } })
      )
    );
  });
});
