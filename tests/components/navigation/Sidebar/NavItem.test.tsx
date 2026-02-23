import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { AppView, UserRole } from '../../../../src/types';
import { NavItem } from '../../../../src/components/navigation/Sidebar/NavItem';

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

describe('NavItem (L2)', () => {
  const t = (_key: string, fallback?: string) => fallback ?? _key;

  it('renders label in expanded mode and calls onClick', () => {
    const onClick = vi.fn();
    render(
      <NavItem
        item={{ id: 'MY_WORK', label: 'My Work', viewId: AppView.MY_WORK }}
        currentView={AppView.AI_CHAT}
        completedViews={[]}
        showFull
        isTouchDevice={false}
        isChatSlidingPanelOpen={false}
        isFloatingActive={false}
        currentUserRole={UserRole.ADMIN}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onClick={onClick}
        getViewName={() => 'view'}
        t={t}
      />
    );

    expect(screen.getByText('My Work')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'MY_WORK' }));
  });

  it('uses tooltip label when collapsed', () => {
    render(
      <NavItem
        item={{ id: 'MY_WORK', label: 'My Work', viewId: AppView.MY_WORK }}
        currentView={AppView.AI_CHAT}
        completedViews={[]}
        showFull={false}
        isTouchDevice={false}
        isChatSlidingPanelOpen={false}
        isFloatingActive={false}
        currentUserRole={UserRole.ADMIN}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onClick={() => {}}
        getViewName={() => 'view'}
        t={t}
      />
    );

    expect(screen.getByRole('button')).toHaveAttribute('title', 'My Work');
  });

  it('highlights active item and AI chat when sliding panel is open', () => {
    const { rerender } = render(
      <NavItem
        item={{ id: 'MY_WORK', label: 'My Work', viewId: AppView.MY_WORK }}
        currentView={AppView.MY_WORK}
        completedViews={[]}
        showFull
        isTouchDevice={false}
        isChatSlidingPanelOpen={false}
        isFloatingActive={false}
        currentUserRole={UserRole.ADMIN}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onClick={() => {}}
        getViewName={() => 'view'}
        t={t}
      />
    );

    expect(screen.getByRole('button').className).toContain('bg-white/[0.08]');

    rerender(
      <NavItem
        item={{ id: 'AI_CHAT', label: 'Chat', viewId: AppView.AI_CHAT }}
        currentView={AppView.MY_WORK}
        completedViews={[]}
        showFull
        isTouchDevice={false}
        isChatSlidingPanelOpen
        isFloatingActive={false}
        currentUserRole={UserRole.ADMIN}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onClick={() => {}}
        getViewName={() => 'view'}
        t={t}
      />
    );

    expect(screen.getByRole('button').className).toContain('bg-white/[0.08]');
    expect(screen.getByRole('button')).toHaveAttribute('data-chat-toggle', 'true');
  });

  it('disables click and shows locked tooltip when requiresView is not completed', () => {
    const onClick = vi.fn();
    render(
      <NavItem
        item={{
          id: 'LOCKED',
          label: 'Locked',
          viewId: AppView.FULL_STEP3_ROADMAP,
          requiresView: AppView.FULL_STEP1_ASSESSMENT,
        }}
        currentView={AppView.MY_WORK}
        completedViews={[]}
        showFull
        isTouchDevice={false}
        isChatSlidingPanelOpen={false}
        isFloatingActive={false}
        currentUserRole={UserRole.USER}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onClick={onClick}
        getViewName={() => 'Assessment'}
        t={(key: string) => key}
      />
    );

    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('title')).toContain('common.locked');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not lock for admin users even when requiresView is missing', () => {
    const onClick = vi.fn();
    render(
      <NavItem
        item={{
          id: 'ADMIN_UNLOCK',
          label: 'Admin Unlocked',
          viewId: AppView.FULL_STEP3_ROADMAP,
          requiresView: AppView.FULL_STEP1_ASSESSMENT,
        }}
        currentView={AppView.MY_WORK}
        completedViews={[]}
        showFull
        isTouchDevice={false}
        isChatSlidingPanelOpen={false}
        isFloatingActive={false}
        currentUserRole={UserRole.ADMIN}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onClick={onClick}
        getViewName={() => 'Assessment'}
        t={(key: string) => key}
      />
    );

    const btn = screen.getByRole('button');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows badge label and completed indicator right-side container', () => {
    render(
      <NavItem
        item={{
          id: 'DISCOVERY_TOOLS',
          label: 'Tools',
          viewId: AppView.DISCOVERY_TOOLS,
          badge: 'new',
        }}
        currentView={AppView.AI_CHAT}
        completedViews={[AppView.DISCOVERY_TOOLS]}
        showFull
        isTouchDevice={false}
        isChatSlidingPanelOpen={false}
        isFloatingActive={false}
        currentUserRole={UserRole.ADMIN}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onClick={() => {}}
        getViewName={() => 'view'}
        t={t}
      />
    );

    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('renders "In development" for badge=soon and shows chevron for subitems', () => {
    const item = {
      id: 'PARENT',
      label: 'Parent',
      badge: 'soon' as const,
      viewId: AppView.MY_WORK,
      subItems: [{ id: 'CHILD', label: 'Child', viewId: AppView.AI_CHAT }],
    };

    const { container } = render(
      <NavItem
        item={item as any}
        currentView={AppView.MY_WORK}
        completedViews={[]}
        showFull
        isTouchDevice={false}
        isChatSlidingPanelOpen={false}
        isFloatingActive
        currentUserRole={UserRole.ADMIN}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onClick={() => {}}
        getViewName={() => 'view'}
        t={t}
      />
    );

    expect(screen.getByText('In development')).toBeInTheDocument();
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('treats parent item as active when a child is active', () => {
    render(
      <NavItem
        item={{
          id: 'PARENT2',
          label: 'Parent2',
          subItems: [{ id: 'CHILD2', label: 'Child2', viewId: AppView.AI_CHAT }],
        }}
        currentView={AppView.AI_CHAT}
        completedViews={[]}
        showFull
        isTouchDevice={false}
        isChatSlidingPanelOpen={false}
        isFloatingActive={false}
        currentUserRole={UserRole.ADMIN}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onClick={() => {}}
        getViewName={() => 'view'}
        t={t}
      />
    );

    expect(screen.getByRole('button').className).toContain('bg-white/[0.04]');
  });

  it('calls onMouseEnter and does not mark parent active when no child matches', () => {
    const onMouseEnter = vi.fn();
    render(
      <NavItem
        item={{
          id: 'PARENT3',
          label: 'Parent3',
          subItems: [{ id: 'CHILD3', label: 'Child3' }],
        }}
        currentView={AppView.MY_WORK}
        completedViews={[]}
        showFull
        isTouchDevice={false}
        isChatSlidingPanelOpen={false}
        isFloatingActive={false}
        currentUserRole={UserRole.ADMIN}
        onMouseEnter={onMouseEnter as any}
        onMouseLeave={() => {}}
        onClick={() => {}}
        getViewName={() => 'view'}
        t={t}
      />
    );

    const wrapper = screen.getByRole('button').parentElement as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button').className).not.toContain('font-medium');
  });
});
