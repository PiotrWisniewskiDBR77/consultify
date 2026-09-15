/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LaneSystem } from '../LaneSystem';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('reactflow', () => ({ useStore: () => [0, 0, 1] }));

const props = {
  lanes: [{ id: 'lane-1', label: 'Main Process', color: '#e0e7ff' }],
  isPl: false,
  locked: true,
  onRename: vi.fn(),
  onDelete: vi.fn(),
  onColorChange: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  dragOverLaneId: null,
};

describe('LaneSystem palette gutter', () => {
  it('moves the lane label beyond the measured floating-palette gutter', () => {
    render(<LaneSystem {...props} headerGutter={176} />);
    expect(screen.getByTestId('process-flow-lane-header-lane-1')).toHaveStyle({ left: '176px' });
  });

  it('keeps the canonical 8px inset when no palette overlaps the canvas', () => {
    render(<LaneSystem {...props} headerGutter={0} />);
    expect(screen.getByTestId('process-flow-lane-header-lane-1')).toHaveStyle({ left: '8px' });
  });
});
