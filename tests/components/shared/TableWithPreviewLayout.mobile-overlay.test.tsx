/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deviceState = {
  isMobile: true,
  safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    // DEC-404: panel `data-right-panel` to `motion.aside` (parytet z JedenPrawyPanel).
    aside: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) => (
      <aside {...props}>{children}</aside>
    ),
  },
}));

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => ({
    isMobile: deviceState.isMobile,
    safeAreaInsets: deviceState.safeAreaInsets,
  }),
}));

import { TableWithPreviewLayout } from '../../../src/components/shared/TableWithPreviewLayout';

describe('TableWithPreviewLayout mobile overlay continuity', () => {
  beforeEach(() => {
    deviceState.isMobile = true;
    deviceState.safeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  });

  it('renders the preview as a mobile overlay instead of a side pane', () => {
    render(
      <TableWithPreviewLayout
        selectedId="item-1"
        selectedItem={{ id: 'item-1', title: 'Item 1' }}
        onSelect={vi.fn()}
        previewOpen
        renderPreview={(item) => <div>{item.title} preview body</div>}
      >
        <div>table content</div>
      </TableWithPreviewLayout>
    );

    expect(screen.getByText('table content')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-preview-overlay')).toBeInTheDocument();
    expect(screen.getByText('Item 1 preview body')).toBeInTheDocument();
    expect(screen.queryByTitle('Pin for comparison')).not.toBeInTheDocument();
  });

  it('closes the mobile overlay from the backdrop', () => {
    const onSelect = vi.fn();

    render(
      <TableWithPreviewLayout
        selectedId="item-1"
        selectedItem={{ id: 'item-1', title: 'Item 1' }}
        onSelect={onSelect}
        previewOpen
        renderPreview={(item) => <div>{item.title} preview body</div>}
      >
        <div>table content</div>
      </TableWithPreviewLayout>
    );

    fireEvent.click(screen.getByTestId('mobile-preview-backdrop'));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('keeps the desktop side pane outside mobile breakpoints', () => {
    deviceState.isMobile = false;

    render(
      <TableWithPreviewLayout
        selectedId="item-1"
        selectedItem={{ id: 'item-1', title: 'Item 1' }}
        onSelect={vi.fn()}
        previewOpen
        renderPreview={(item) => <div>{item.title} preview body</div>}
      >
        <div>table content</div>
      </TableWithPreviewLayout>
    );

    expect(screen.queryByTestId('mobile-preview-overlay')).not.toBeInTheDocument();
    expect(screen.getByText('Item 1 preview body')).toBeInTheDocument();
  });
});
