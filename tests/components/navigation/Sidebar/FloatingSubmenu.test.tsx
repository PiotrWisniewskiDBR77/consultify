import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { AppView } from '../../../../src/types';
import { FloatingSubmenu } from '../../../../src/components/navigation/Sidebar/FloatingSubmenu';

vi.mock('react-dom', async () => {
  const actual: any = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node: any) => node,
  };
});

vi.mock('framer-motion', () => {
  const React = require('react');
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <div ref={ref} data-testid="floating-menu" {...props}>
          {children}
        </div>
      )),
      button: ({ children, whileTap, ...props }: any) => <button {...props}>{children}</button>,
    },
  };
});

describe('FloatingSubmenu (L2)', () => {
  const originalInnerHeight = window.innerHeight;
  let offsetHeightGetter: PropertyDescriptor | undefined;

  beforeEach(() => {
    offsetHeightGetter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return 200;
      },
    });
  });

  afterEach(() => {
    window.innerHeight = originalInnerHeight;
    if (offsetHeightGetter) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeightGetter);
    }
  });

  const rect = (top: number, right: number): DOMRect =>
    ({
      top,
      right,
      left: 0,
      bottom: top + 10,
      width: 10,
      height: 10,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as any;

  it('positions relative to parentRect and clamps to viewport', () => {
    window.innerHeight = 500;

    render(
      <FloatingSubmenu
        parentRect={rect(400, 100)}
        items={[]}
        title="Title"
        onClose={() => {}}
        onItemClick={() => {}}
        currentView={AppView.MY_WORK}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        theme="light"
      />
    );

    const menu = screen.getByTestId('floating-menu');
    expect(menu.style.left).toBe('108px'); // right(100) + 8
    expect(menu.style.top).toBe('280px'); // 500 - 200 - 20
  });

  it('clamps top to at least 10px', () => {
    render(
      <FloatingSubmenu
        parentRect={rect(-50, 10)}
        items={[]}
        title="Title"
        onClose={() => {}}
        onItemClick={() => {}}
        currentView={AppView.MY_WORK}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        theme="light"
      />
    );

    expect(screen.getByTestId('floating-menu').style.top).toBe('10px');
  });

  it('renders title header with and without border depending on items, and applies dark theme classes', () => {
    const { rerender } = render(
      <FloatingSubmenu
        parentRect={rect(20, 10)}
        items={[]}
        title="NoItems"
        onClose={() => {}}
        onItemClick={() => {}}
        currentView={AppView.MY_WORK}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        theme="dark"
      />
    );

    const header0 = screen.getByText('NoItems');
    expect(header0.className).not.toContain('border-b');
    expect(screen.getByTestId('floating-menu').className).toContain('bg-navy-900');

    rerender(
      <FloatingSubmenu
        parentRect={rect(20, 10)}
        items={[{ id: 'i1', label: 'Item1', viewId: AppView.AI_CHAT } as any]}
        title="HasItems"
        onClose={() => {}}
        onItemClick={() => {}}
        currentView={AppView.MY_WORK}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        theme="dark"
      />
    );

    const header1 = screen.getByText('HasItems');
    expect(header1.className).toContain('border-b');
  });

  it('navigates only when item has viewId, and styles active item for light/dark', () => {
    const onItemClick = vi.fn();

    const IconComp = ({ size }: any) => <span data-testid="icon" data-size={String(size)} />;

    const items: any[] = [
      { id: 'active', label: 'Active', viewId: AppView.AI_CHAT, icon: <IconComp /> },
      { id: 'inactive', label: 'Inactive', viewId: AppView.MY_WORK, icon: 'X' },
      { id: 'noview', label: 'NoView' },
    ];

    const { rerender } = render(
      <FloatingSubmenu
        parentRect={rect(20, 10)}
        items={items}
        title="Menu"
        onClose={() => {}}
        onItemClick={onItemClick}
        currentView={AppView.AI_CHAT}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        theme="light"
      />
    );

    expect(screen.getByTestId('icon')).toHaveAttribute('data-size', '16');
    expect(screen.getByText('X')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(onItemClick).toHaveBeenCalledWith(items[0]);

    fireEvent.click(screen.getByRole('button', { name: 'NoView' }));
    expect(onItemClick).toHaveBeenCalledTimes(2);

    // active style (light)
    expect(screen.getByRole('button', { name: 'Active' }).className).toContain('bg-primary-50');

    rerender(
      <FloatingSubmenu
        parentRect={rect(20, 10)}
        items={items}
        title="Menu"
        onClose={() => {}}
        onItemClick={onItemClick}
        currentView={AppView.AI_CHAT}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        theme="dark"
      />
    );

    expect(screen.getByRole('button', { name: 'Active' }).className).toContain('bg-white/[0.08]');
    expect(screen.getByRole('button', { name: /Inactive/ }).className).toContain(
      'hover:bg-white/[0.05]'
    );
  });

  it('forwards mouse enter/leave handlers to the menu container', () => {
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();

    render(
      <FloatingSubmenu
        parentRect={rect(20, 10)}
        items={[]}
        title="Menu"
        onClose={() => {}}
        onItemClick={() => {}}
        currentView={AppView.MY_WORK}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        theme="light"
      />
    );

    const menu = screen.getByTestId('floating-menu');
    fireEvent.mouseEnter(menu);
    fireEvent.mouseLeave(menu);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
  });
});
