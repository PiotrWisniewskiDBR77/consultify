/**
 * @vitest-environment jsdom
 *
 * MW-07 — Calendar narrow-viewport fix (Codex FINAL UX FIX_REQUIRED).
 *
 * Codex finding: the sidebar (mini-calendar + Sources) rendered at a fixed
 * `w-64` regardless of viewport, overlapping the main grid below 768px and
 * making it unreadable. Fix: `CalendarView` now conditionally renders either
 * the inline sidebar (desktop) OR a mobile toggle button + Drawer holding
 * the SAME `CalendarSidebar`, driven by `useIsMobile()`
 * (`src/hooks/useDeviceType.ts`, `(max-width: 767px)` — matches
 * `tailwind.config`'s own `mobile` breakpoint alias) rather than a CSS-only
 * `hidden`/`md:block` split. This file tests BEHAVIOR (what actually mounts
 * and what a user can do), not CSS class strings — jsdom cannot evaluate
 * Tailwind responsive classes anyway, so a class-string assertion would not
 * prove anything real.
 *
 * `CalendarSidebar` and `CalendarGrid` are mocked to simple, identifiable
 * stubs — their own internals already have dedicated coverage
 * (`CalendarSidebar.availability.test.tsx`,
 * `CalendarGrid.lineage-conflict.test.tsx`); this file only needs to prove
 * WHICH one mounts, when, and that the toggle/close/Escape behavior works.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: unknown) => {
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      if (
        fallbackOrOpts &&
        typeof fallbackOrOpts === 'object' &&
        'defaultValue' in (fallbackOrOpts as Record<string, unknown>)
      ) {
        return String((fallbackOrOpts as { defaultValue: unknown }).defaultValue);
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: () => {} },
  }),
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// Same mock used by tests/components/navigation/Sidebar.mobile-overlay.test.tsx —
// framer-motion's real spring/AnimatePresence loop fights jsdom's lack of layout
// and produces a "Maximum update depth exceeded" churn (confirmed empirically:
// without this mock, test 6 below drove a vitest worker to OOM). Strip the
// animation-only props so they don't leak onto the DOM node as unknown attributes.
vi.mock('framer-motion', () => {
  const stripMotionProps = ({
    initial: _initial,
    animate: _animate,
    exit: _exit,
    variants: _variants,
    transition: _transition,
    drag: _drag,
    dragConstraints: _dragConstraints,
    dragElastic: _dragElastic,
    onDragEnd: _onDragEnd,
    whileTap: _whileTap,
    whileHover: _whileHover,
    layout: _layout,
    ...rest
  }: any) => rest;

  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: any) => <div {...stripMotionProps(props)}>{children}</div>,
      button: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <button ref={ref} {...stripMotionProps(props)}>
          {children}
        </button>
      )),
    },
  };
});

vi.mock('../../../src/services/api', () => ({
  default: {
    getIntegrations: vi.fn().mockResolvedValue([]),
    getMyWorkCalendarConflicts: vi.fn().mockResolvedValue({
      totalItems: 0,
      hasConflicts: false,
      tasks: [],
      decisions: [],
      suggestion: null,
    }),
    updateMyWorkCalendarEvent: vi.fn(),
  },
}));

vi.mock('../../../src/components/MyWork/Calendar/useCalendarData', () => ({
  useCalendarData: () => ({
    events: [
      {
        id: 'task-golden',
        title: 'Prepare quarterly rollout deck',
        start: '2026-03-10',
        allDay: true,
        source: 'task',
        sourceId: 'golden',
        projectName: 'Atelier Toys Rollout',
        provider: 'internal',
        version: '111',
      },
    ],
    loading: false,
    error: null,
    filter: { sources: ['task'] },
    setFilter: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../src/components/MyWork/Calendar/CalendarSidebar', () => ({
  CalendarSidebar: () => <div data-testid="calendar-sidebar-stub">Sources · Tasks · Initiatives</div>,
}));

vi.mock('../../../src/components/MyWork/Calendar/CalendarGrid', () => ({
  CalendarGrid: (props: any) => (
    <div data-testid="calendar-grid-stub">
      {props.events.map((e: any) => (
        <div key={e.id}>
          {e.title} — {e.projectName} · {e.provider}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../../src/components/MyWork/Calendar/CalendarCreateEventModal', () => ({
  CalendarCreateEventModal: () => null,
}));

// Query-aware matchMedia mock — overrides tests/setup.ts's always-false
// global default so this file alone can flip between "desktop" and
// "narrow viewport (<=767px)" without touching any other test's behavior.
function mockMatchMedia(matchesMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 767px') ? matchesMobile : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

import { CalendarView } from '../../../src/components/MyWork/Calendar/CalendarView';

describe('CalendarView — narrow viewport (Codex FINAL UX FIX_REQUIRED)', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('1) at 375px (mobile-matched media query), the desktop sidebar never mounts — no overlay onto the grid', () => {
    mockMatchMedia(true);
    render(<CalendarView />);
    expect(screen.queryByTestId('calendar-sidebar-stub')).not.toBeInTheDocument();
    expect(screen.getByTestId('calendar-grid-stub')).toBeInTheDocument();
  });

  it('2) at 375px, a "Sources & filters" toggle button is present and accessible by role/name', () => {
    mockMatchMedia(true);
    render(<CalendarView />);
    expect(
      screen.getByRole('button', { name: /sources & filters/i })
    ).toBeInTheDocument();
  });

  it('3) opening the panel shows the sources content', async () => {
    mockMatchMedia(true);
    render(<CalendarView />);
    expect(screen.queryByTestId('calendar-sidebar-stub')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /sources & filters/i }));

    await waitFor(() => {
      expect(screen.getByTestId('calendar-sidebar-stub')).toBeInTheDocument();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('4) closing the panel (X button) removes it and restores the full grid, unobstructed', async () => {
    mockMatchMedia(true);
    render(<CalendarView />);
    fireEvent.click(screen.getByRole('button', { name: /sources & filters/i }));
    await waitFor(() => {
      expect(screen.getByTestId('calendar-sidebar-stub')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close drawer/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('calendar-sidebar-stub')).not.toBeInTheDocument();
    });
    // The grid was never unmounted by the drawer opening/closing.
    expect(screen.getByTestId('calendar-grid-stub')).toBeInTheDocument();
  });

  it('5) on desktop (matchMedia does not match the mobile query), the sidebar renders inline and there is no mobile toggle button', () => {
    mockMatchMedia(false);
    render(<CalendarView />);
    expect(screen.getByTestId('calendar-sidebar-stub')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /sources & filters/i })
    ).not.toBeInTheDocument();
  });

  it('6) Escape closes the open panel (keyboard, not just the close button)', async () => {
    mockMatchMedia(true);
    render(<CalendarView />);
    fireEvent.click(screen.getByRole('button', { name: /sources & filters/i }));
    await waitFor(() => {
      expect(screen.getByTestId('calendar-sidebar-stub')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('calendar-sidebar-stub')).not.toBeInTheDocument();
    });
  });

  it('7) event title and project/provider lineage remain visible on mobile — the fix never hides the calendar content itself', () => {
    mockMatchMedia(true);
    render(<CalendarView />);
    expect(
      screen.getByText(/Prepare quarterly rollout deck.*Atelier Toys Rollout.*internal/)
    ).toBeInTheDocument();
  });
});
