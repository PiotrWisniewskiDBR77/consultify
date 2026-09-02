/**
 * @vitest-environment jsdom
 *
 * Regression test — Bramka 2 (Menu): Sidebar.tsx decorates (does NOT remove)
 * menu items outside `PILOT_VISIBLE_MENU_IDS` for a pilot-restricted role
 * (currently ~L121-146: `visibleMenuStructure` -> `decoratePilotItem` ->
 * `isPilotAllowedMenuId(item.id)`). `MODULE_MEETING` is not in
 * `PILOT_VISIBLE_MENU_IDS` (src/utils/pilotAccess.ts), so the pilot role must
 * see the "Meeting" item with a padlock (aria-disabled) while the owner role
 * sees it fully clickable.
 *
 * This is intentionally a full-component render test (not a reimplementation
 * of the decoration logic) so a removed/weakened gate turns the test red.
 *
 * Evidence pair:
 *  - "obcy nie widzi": pilot-restricted role (`USER`) -> the "Meeting" item is
 *    still present (decorated, not removed) but locked (aria-disabled=true).
 *  - "wlasciciel widzi": owner-ish role (`ADMIN`) -> the "Meeting" item is
 *    present and NOT locked (aria-disabled absent).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let currentRole = 'USER';

vi.mock('framer-motion', () => {
  // framer-motion props that aren't valid DOM attributes — strip them so the
  // underlying real tag (button/div/span/...) renders cleanly and stays
  // queryable by role/tag, unlike a blanket motion.* -> <div> mock which
  // would turn every motion.button into a non-button and break aria queries.
  const stripMotionProps = (props: Record<string, unknown>) => {
    const {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      layout: _layout,
      layoutId: _layoutId,
      whileTap: _whileTap,
      whileHover: _whileHover,
      whileFocus: _whileFocus,
      whileDrag: _whileDrag,
      variants: _variants,
      drag: _drag,
      dragConstraints: _dragConstraints,
      ...rest
    } = props;
    return rest;
  };

  const motion = new Proxy(
    {},
    {
      get:
        (_target: unknown, tag: string) =>
        ({
          children,
          ...props
        }: Record<string, unknown> & { children?: React.ReactNode }) =>
          React.createElement(tag, stripMotionProps(props), children as React.ReactNode),
    }
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, def?: string) => def ?? _key,
  }),
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isTablet: false, isMobile: false, isTouchDevice: false }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({
    setDisplayMode: vi.fn(),
    setWorkspaceContext: vi.fn(),
    activeConversationId: null,
    isSidebarOpen: false,
    toggleSidebar: vi.fn(),
  }),
}));

vi.mock('@/services/api', () => ({
  Api: { getPersonalTasks: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      currentView: 'AI_CHAT',
      setCurrentView: vi.fn(),
      navigateWithChatContext: vi.fn(),
      returnToFullChat: vi.fn(),
      logout: vi.fn(),
      isSidebarOpen: false,
      setIsSidebarOpen: vi.fn(),
      currentUser: { id: 'user-1', role: currentRole },
      freeSessionData: {},
      fullSessionData: {},
      theme: 'light',
      isSidebarCollapsed: false,
      toggleSidebarCollapse: vi.fn(),
      currentProjectId: null,
    }),
}));

import { Sidebar } from '../Sidebar';

afterEach(() => {
  vi.clearAllMocks();
});

describe('Sidebar pilot meeting lock (regression, bramka 2)', () => {
  it('obcy nie widzi: pilot-restricted role sees Meeting decorated as locked, not removed', () => {
    currentRole = 'USER';
    render(<Sidebar />);

    const meetingButton = screen.getByText('Meeting').closest('button');
    expect(meetingButton).not.toBeNull();
    expect(meetingButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('wlasciciel widzi: owner/admin role sees Meeting unlocked', () => {
    currentRole = 'ADMIN';
    render(<Sidebar />);

    const meetingButton = screen.getByText('Meeting').closest('button');
    expect(meetingButton).not.toBeNull();
    expect(meetingButton).not.toHaveAttribute('aria-disabled', 'true');
  });
});
