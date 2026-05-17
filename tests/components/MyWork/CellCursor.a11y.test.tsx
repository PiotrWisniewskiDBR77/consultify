import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CellCursor } from '@/components/MyWork/table/CollaborationPresence';

describe('CellCursor accessibility', () => {
  it('renders status role with accessible editing label', () => {
    render(
      <CellCursor
        remoteUsers={[
          {
            id: 'user-2',
            name: 'Alice Johnson',
            color: '#8b5cf6',
            lastSeen: Date.now(),
            activeCell: { nodeId: 'node-7', colKey: 'status' },
          },
        ]}
        nodeId="node-7"
        colKey="status"
      />
    );

    expect(screen.getByRole('status', { name: 'Alice Johnson is editing this cell' })).toBeInTheDocument();
    expect(screen.getByTestId('cell-cursor-chip-node-7-status')).toHaveTextContent('Alice Johnson');
  });
});
