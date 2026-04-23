import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { V10RuntimeWorkspaceView } from '../../../src/views/V10RuntimeWorkspaceView';

vi.mock('../../../src/components/Admin/ChatV10RuntimesPanel', () => ({
  ChatV10RuntimesPanel: () => <div data-testid="chat-v10-runtimes-panel">Mocked runtime host</div>,
}));

describe('V10RuntimeWorkspaceView', () => {
  it('renders the dedicated V10 entrypoint and smoke surface', () => {
    render(
      <MemoryRouter initialEntries={['/chat/v10-runtime']}>
        <V10RuntimeWorkspaceView />
      </MemoryRouter>
    );

    expect(screen.getByTestId('v10-runtime-entrypoint')).toBeInTheDocument();
    expect(screen.getByTestId('v10-runtime-smoke-surface')).toBeInTheDocument();
    expect(screen.getByTestId('v10-runtime-rollout-summary')).toBeInTheDocument();
    expect(screen.getByText('/chat/v10-runtime')).toBeInTheDocument();
    expect(screen.getByText('Default-off hygiene')).toBeInTheDocument();
    expect(screen.getByText('Artifact')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Connectors')).toBeInTheDocument();
    expect(screen.getByText('Outcome')).toBeInTheDocument();
    expect(screen.getByTestId('chat-v10-runtimes-panel')).toBeInTheDocument();
  });
});
