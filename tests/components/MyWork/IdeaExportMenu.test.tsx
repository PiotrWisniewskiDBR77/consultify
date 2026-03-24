import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaExportMenu } from '../../../src/components/MyWork/IdeaExportMenu';

describe('IdeaExportMenu', () => {
  it('previews and imports a diagram package payload', () => {
    const onImportGraph = vi.fn();

    render(
      <IdeaExportMenu
        open
        onClose={vi.fn()}
        ideaId="idea-1"
        title="Process hardening"
        graphNodes={[]}
        graphEdges={[]}
        onImportGraph={onImportGraph}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'diagram_package' },
    });

    const payload = JSON.stringify({
      version: 'consultify.diagram-package.v1',
      title: 'Imported flow',
      nodes: [{ id: 'n-1', type: 'flowNode', data: { label: 'Start' }, position: { x: 0, y: 0 } }],
      edges: [],
      extensions: { processFlow: { lanes: [{ id: 'lane-1', label: 'Lane 1', color: '#abc' }] } },
    });

    fireEvent.change(screen.getByPlaceholderText(/Paste import payload/i), {
      target: { value: payload },
    });

    expect(screen.getByText(/Ready to import: 1 nodes, 0 edges/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Import into workspace/i }));

    expect(onImportGraph).toHaveBeenCalledTimes(1);
    expect(onImportGraph.mock.calls[0][0]).toMatchObject({
      title: 'Imported flow',
      nodes: [{ id: 'n-1' }],
      edges: [],
    });
  });
});
