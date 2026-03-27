/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deviceState = {
  isMobile: true,
  safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
};

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => ({
    isMobile: deviceState.isMobile,
    safeAreaInsets: deviceState.safeAreaInsets,
  }),
}));

import { BulkActionBar } from '../../../src/components/ui/ResizableTable/BulkActionBar';

describe('BulkActionBar mobile nav offset continuity', () => {
  beforeEach(() => {
    deviceState.isMobile = true;
    deviceState.safeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  });

  it('raises the bulk action bar above the mobile bottom navigation strip', () => {
    render(
      <BulkActionBar
        selectedCount={2}
        onClearSelection={vi.fn()}
        actions={[{ id: 'archive', label: 'Archive', icon: <span>A</span>, onClick: vi.fn() }]}
      />
    );

    expect(screen.getByTestId('bulk-action-bar')).toHaveStyle({ bottom: '76px' });
  });

  it('includes safe-area space in the mobile bottom offset', () => {
    deviceState.safeAreaInsets = { top: 0, bottom: 14, left: 0, right: 0 };

    render(
      <BulkActionBar
        selectedCount={2}
        onClearSelection={vi.fn()}
        actions={[{ id: 'archive', label: 'Archive', icon: <span>A</span>, onClick: vi.fn() }]}
      />
    );

    expect(screen.getByTestId('bulk-action-bar')).toHaveStyle({ bottom: '90px' });
  });

  it('keeps desktop positioning on non-mobile breakpoints', () => {
    deviceState.isMobile = false;

    render(
      <BulkActionBar
        selectedCount={2}
        onClearSelection={vi.fn()}
        actions={[{ id: 'archive', label: 'Archive', icon: <span>A</span>, onClick: vi.fn() }]}
      />
    );

    expect(screen.getByTestId('bulk-action-bar').style.bottom).toBe('');
  });
});
