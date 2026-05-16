import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { V10RuntimeWorkspace, V10RuntimeWorkspaceBlock } from '../../../src/components/v10/V10RuntimeWorkspace';

describe('V10RuntimeWorkspace', () => {
  it('renders blocks in canonical toolbar order, filters readiness, syncs URL state, and toggles flag preview', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const blocks = [
      {
        id: 'artifact',
        title: 'Artifact',
        description: 'Artifact block',
        readiness: 'ready',
        flags: ['ff.artifact'],
        sections: ['Artifact Pipeline'],
      },
      {
        id: 'agent',
        title: 'Agent',
        description: 'Agent block',
        readiness: 'partial',
        flags: ['ff.agent'],
        sections: ['Agent Runtime'],
      },
      {
        id: 'onboarding',
        title: 'Onboarding',
        description: 'Onboarding block',
        readiness: 'flagged_off',
        flags: ['ff.onboarding'],
        sections: ['Onboarding Runtime'],
      },
    ] as const;

    render(
      <V10RuntimeWorkspace blocks={blocks}>
        {blocks.map((block) => (
          <V10RuntimeWorkspaceBlock key={block.id} block={block}>
            <div>{block.title} content</div>
          </V10RuntimeWorkspaceBlock>
        ))}
      </V10RuntimeWorkspace>
    );

    const toolbar = screen.getByTestId('v10-runtime-toolbar');
    const links = Array.from(toolbar.querySelectorAll('a')).map((node) => node.textContent || '');
    expect(links[0]).toContain('Artifact');
    expect(links[1]).toContain('Agent');
    expect(links[2]).toContain('Onboarding');
    expect(screen.getByRole('link', { name: /Jump to first issue/i })).toHaveAttribute(
      'href',
      '#v10-block-agent'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Issues (2)' }));
    expect(screen.queryByText('Artifact content')).not.toBeInTheDocument();
    expect(screen.getByText('Agent content')).toBeInTheDocument();
    expect(screen.getByText('Onboarding content')).toBeInTheDocument();
    expect(replaceStateSpy).toHaveBeenLastCalledWith(
      window.history.state,
      '',
      expect.stringContaining('v10Filter=issues')
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ready (1)' }));
    expect(screen.getByText('Artifact content')).toBeInTheDocument();
    expect(screen.queryByText('Agent content')).not.toBeInTheDocument();
    expect(replaceStateSpy).toHaveBeenLastCalledWith(
      window.history.state,
      '',
      expect.stringContaining('v10Filter=ready')
    );

    expect(screen.queryByText('ff.artifact')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show flags' }));
    expect(screen.getByText('ff.artifact')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All (3)' }));
    expect(screen.getByText('ff.agent')).toBeInTheDocument();
    expect(screen.getByText('ff.onboarding')).toBeInTheDocument();
    expect(replaceStateSpy).toHaveBeenLastCalledWith(
      window.history.state,
      '',
      expect.not.stringContaining('v10Filter=')
    );
  });
});
