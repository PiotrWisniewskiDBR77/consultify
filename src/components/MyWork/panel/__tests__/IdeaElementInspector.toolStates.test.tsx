/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaElementInspector, type IdeaInspectorTool } from '../IdeaElementInspector';

describe('IdeaElementInspector tool-specific states', () => {
  it.each<IdeaInspectorTool>(['mindmap', 'process', 'whiteboard', 'table'])(
    'uses the common empty state for %s',
    (tool) => {
      render(<IdeaElementInspector element={null} tool={tool} />);
      expect(screen.getByText('Zaznacz element, aby zobaczyć właściwości')).toBeInTheDocument();
    }
  );

  it('shows only real recent items and omits the section when none were supplied', () => {
    const { rerender } = render(<IdeaElementInspector element={null} tool="mindmap" />);
    expect(screen.queryByText('Ostatnio otwarte')).not.toBeInTheDocument();
    rerender(
      <IdeaElementInspector
        element={null}
        tool="mindmap"
        recentItems={[{ id: 'node-1', title: 'Real node', type: 'Ryzyko', date: '14:28' }]}
      />
    );
    expect(screen.getByText('Ostatnio otwarte')).toBeInTheDocument();
    expect(screen.getByText('Real node')).toBeInTheDocument();
  });

  it('sends the native table state unchanged in the save payload', () => {
    const onSave = vi.fn().mockResolvedValue({ id: 'row-1', label: 'Row', state: 'done' });
    render(
      <IdeaElementInspector
        element={{ id: 'row-1', label: 'Row', state: 'todo' }}
        tool="table"
        nativeStates={['todo', 'in_progress', 'done', 'blocked']}
        onSave={onSave}
      />
    );
    fireEvent.change(screen.getByLabelText('Stan'), { target: { value: 'done' } });
    expect(onSave).toHaveBeenCalledWith({ state: 'done' });
  });

  it('does not invent a state selector for Process Flow', () => {
    render(<IdeaElementInspector element={{ id: 'edge-1', label: 'Edge' }} tool="process" />);
    expect(screen.queryByLabelText('Stan')).not.toBeInTheDocument();
    expect(screen.getByText('To narzędzie nie prowadzi stanu elementu')).toBeInTheDocument();
  });
});
