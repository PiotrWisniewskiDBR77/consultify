/**
 * Chat V9 / NAV-M2-lite — tests for the floating workspace
 * breadcrumb pill.
 *
 * Coverage:
 *   - Flag gate (ON → render, OFF → null).
 *   - Visibility contract inherited from `buildWorkspaceBreadcrumb`
 *     (null return → component returns null without side effects).
 *   - Missing `returnToFullChat` → null (defensive guard).
 *   - "Chat" segment is a button that calls `returnToFullChat()`.
 *   - Current-view segment is plain text with `aria-current="page"`.
 *   - A11y contract: the pill is a `<nav aria-label="Breadcrumb">`
 *     with an ordered list inside.
 *   - No telemetry wire-up (contract decision — mirrors T-TR1.3).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppView } from '../../../types';
import { WorkspaceBreadcrumb } from '../WorkspaceBreadcrumb';

type AppStoreState = {
  currentView?: AppView;
  returnToFullChat?: () => void;
};
type ConvStoreState = {
  activeConversationId?: string | null;
  conversations?: Array<{
    id: string;
    title: string;
    starred?: boolean;
    isPinned?: boolean;
  }>;
  setActiveConversation?: (id: string) => void;
  isSidebarOpen?: boolean;
  toggleSidebar?: () => void;
};

let mockAppState: AppStoreState = {};
let mockConvState: ConvStoreState = {};

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: (selector: (state: AppStoreState) => unknown) => selector(mockAppState),
}));

vi.mock('../../../store/useConversationStore', () => ({
  useConversationStore: (selector: (state: ConvStoreState) => unknown) => selector(mockConvState),
}));

const trackFunnelEventMock = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

function getFirstCallArg<T extends (...args: any[]) => any>(mockFn: ReturnType<typeof vi.fn<T>>) {
  return mockFn.mock.calls.at(0)?.[0];
}

describe('WorkspaceBreadcrumb', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockReset();
    mockAppState = {};
    mockConvState = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------- flag gate ---------------------------
  it('returns null when the feature flag is disabled', () => {
    mockAppState = {
      currentView: AppView.ASSESSMENT_SIRI,
      returnToFullChat: vi.fn(),
    };
    mockConvState = { activeConversationId: 'conv-1' };
    const { container } = render(<WorkspaceBreadcrumb isEnabled={() => false} />);
    expect(container.firstChild).toBeNull();
  });

  // --------------------------- builder gate ------------------------
  it('returns null when the builder returns null (e.g. hidden view)', () => {
    mockAppState = {
      currentView: AppView.AI_CHAT,
      returnToFullChat: vi.fn(),
    };
    mockConvState = { activeConversationId: 'conv-1' };
    const { container } = render(<WorkspaceBreadcrumb isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when there is no active conversation', () => {
    mockAppState = {
      currentView: AppView.ASSESSMENT_SIRI,
      returnToFullChat: vi.fn(),
    };
    mockConvState = { activeConversationId: null };
    const { container } = render(<WorkspaceBreadcrumb isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  // --------------------------- store hydration guard ---------------
  it('returns null when returnToFullChat is not a function', () => {
    mockAppState = {
      currentView: AppView.ASSESSMENT_SIRI,
      returnToFullChat: undefined,
    };
    mockConvState = { activeConversationId: 'conv-1' };
    const { container } = render(<WorkspaceBreadcrumb isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  // --------------------------- render path -------------------------
  it('renders the Chat anchor + curated label on a mapped view', () => {
    mockAppState = {
      currentView: AppView.ASSESSMENT_SIRI,
      returnToFullChat: vi.fn(),
    };
    mockConvState = { activeConversationId: 'conv-1' };
    render(<WorkspaceBreadcrumb isEnabled={() => true} />);

    expect(screen.getByTestId('workspace-breadcrumb')).toBeTruthy();
    expect(screen.getByTestId('workspace-breadcrumb-segment-0')).toHaveTextContent('Chat');
    expect(screen.getByTestId('workspace-breadcrumb-segment-1')).toHaveTextContent(
      'Assessment · SIRI'
    );
  });

  it('marks the current-view segment with aria-current="page"', () => {
    mockAppState = {
      currentView: AppView.ASSESSMENT_SIRI,
      returnToFullChat: vi.fn(),
    };
    mockConvState = { activeConversationId: 'conv-1' };
    render(<WorkspaceBreadcrumb isEnabled={() => true} />);

    const current = screen.getByTestId('workspace-breadcrumb-segment-1');
    expect(current.getAttribute('aria-current')).toBe('page');
  });

  it('renders the Chat segment as a button, not a plain span', () => {
    mockAppState = {
      currentView: AppView.ASSESSMENT_SIRI,
      returnToFullChat: vi.fn(),
    };
    mockConvState = { activeConversationId: 'conv-1' };
    render(<WorkspaceBreadcrumb isEnabled={() => true} />);

    const chatSegment = screen.getByTestId('workspace-breadcrumb-segment-0');
    expect(chatSegment.tagName).toBe('BUTTON');
  });

  // --------------------------- interaction -------------------------
  it('clicking the Chat segment calls returnToFullChat()', () => {
    const returnToFullChat = vi.fn();
    mockAppState = { currentView: AppView.ASSESSMENT_SIRI, returnToFullChat };
    mockConvState = { activeConversationId: 'conv-1' };
    render(<WorkspaceBreadcrumb isEnabled={() => true} />);

    fireEvent.click(screen.getByTestId('workspace-breadcrumb-segment-0'));

    expect(returnToFullChat).toHaveBeenCalledTimes(1);
  });

  it('emits zero telemetry events — the pill is a wayfinding affordance', () => {
    mockAppState = {
      currentView: AppView.ASSESSMENT_SIRI,
      returnToFullChat: vi.fn(),
    };
    mockConvState = { activeConversationId: 'conv-1' };
    render(<WorkspaceBreadcrumb isEnabled={() => true} />);

    fireEvent.click(screen.getByTestId('workspace-breadcrumb-segment-0'));

    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });

  // --------------------------- a11y --------------------------------
  it('exposes a <nav aria-label="Breadcrumb"> wrapper', () => {
    mockAppState = {
      currentView: AppView.ASSESSMENT_SIRI,
      returnToFullChat: vi.fn(),
    };
    mockConvState = { activeConversationId: 'conv-1' };
    render(<WorkspaceBreadcrumb isEnabled={() => true} />);

    const nav = screen.getByTestId('workspace-breadcrumb');
    expect(nav.tagName).toBe('NAV');
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
  });

  // --------------------------- builder injection ------------------
  it('respects an injected builder (test seam)', () => {
    mockAppState = {
      currentView: AppView.ASSESSMENT_SIRI,
      returnToFullChat: vi.fn(),
    };
    mockConvState = { activeConversationId: 'conv-1' };
    const build = vi.fn(() => ({
      segments: [
        { label: 'Chat', role: 'chat-link' as const },
        { label: 'Injected label', role: 'current' as const },
      ],
    }));
    render(<WorkspaceBreadcrumb isEnabled={() => true} build={build} />);

    expect(build).toHaveBeenCalledTimes(1);
    expect(getFirstCallArg(build)).toMatchObject({
      view: AppView.ASSESSMENT_SIRI,
      hasActiveConversation: true,
    });
    expect(screen.getByTestId('workspace-breadcrumb-segment-1')).toHaveTextContent(
      'Injected label'
    );
  });

  // --------------- NAV-M2-lite+ conversation-title segment ---------
  describe('NAV-M2-lite+ conversation title segment', () => {
    it('forwards the active conversation title to the builder', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [
          { id: 'conv-other', title: 'Other chat' },
          { id: 'conv-1', title: 'SIRI rollout Q3' },
        ],
      };
      const build = vi.fn(() => ({
        segments: [
          { label: 'Chat', role: 'chat-link' as const },
          { label: 'Assessment · SIRI', role: 'view' as const },
          { label: 'SIRI rollout Q3', role: 'current' as const },
        ],
      }));
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isConversationSegmentEnabled={() => true}
          build={build}
        />
      );

      expect(build).toHaveBeenCalledTimes(1);
      expect(getFirstCallArg(build)).toMatchObject({
        conversationTitle: 'SIRI rollout Q3',
        conversationSegmentEnabled: true,
      });
    });

    it('passes null conversationTitle when the active id is missing from the array', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-other', title: 'Other chat' }],
      };
      const build = vi.fn(() => ({
        segments: [
          { label: 'Chat', role: 'chat-link' as const },
          { label: 'Assessment · SIRI', role: 'current' as const },
        ],
      }));
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isConversationSegmentEnabled={() => true}
          build={build}
        />
      );

      expect(getFirstCallArg(build)).toMatchObject({
        conversationTitle: null,
      });
    });

    it('forwards the conversation-segment kill-switch value to the builder (OFF)', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'SIRI rollout Q3' }],
      };
      const build = vi.fn(() => ({
        segments: [
          { label: 'Chat', role: 'chat-link' as const },
          { label: 'Assessment · SIRI', role: 'current' as const },
        ],
      }));
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isConversationSegmentEnabled={() => false}
          build={build}
        />
      );

      expect(getFirstCallArg(build)).toMatchObject({
        conversationSegmentEnabled: false,
      });
    });

    it('renders 3 segments when the builder returns the 3-segment shape', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'SIRI rollout Q3' }],
      };
      const build = vi.fn(() => ({
        segments: [
          { label: 'Chat', role: 'chat-link' as const },
          { label: 'Assessment · SIRI', role: 'view' as const },
          { label: 'SIRI rollout Q3', role: 'current' as const },
        ],
      }));
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isConversationSegmentEnabled={() => true}
          build={build}
        />
      );

      expect(screen.getByTestId('workspace-breadcrumb-segment-0')).toHaveTextContent('Chat');
      expect(screen.getByTestId('workspace-breadcrumb-segment-1')).toHaveTextContent(
        'Assessment · SIRI'
      );
      expect(screen.getByTestId('workspace-breadcrumb-segment-2')).toHaveTextContent(
        'SIRI rollout Q3'
      );
    });

    it('marks the conversation-title segment as aria-current="page" and the middle view segment as non-current', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'SIRI rollout Q3' }],
      };
      const build = vi.fn(() => ({
        segments: [
          { label: 'Chat', role: 'chat-link' as const },
          { label: 'Assessment · SIRI', role: 'view' as const },
          { label: 'SIRI rollout Q3', role: 'current' as const },
        ],
      }));
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isConversationSegmentEnabled={() => true}
          build={build}
        />
      );

      const view = screen.getByTestId('workspace-breadcrumb-segment-1');
      const current = screen.getByTestId('workspace-breadcrumb-segment-2');
      expect(view.getAttribute('aria-current')).toBeNull();
      expect(current.getAttribute('aria-current')).toBe('page');
    });

    it('renders the middle view segment as a plain span, not a button', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'SIRI rollout Q3' }],
      };
      const build = vi.fn(() => ({
        segments: [
          { label: 'Chat', role: 'chat-link' as const },
          { label: 'Assessment · SIRI', role: 'view' as const },
          { label: 'SIRI rollout Q3', role: 'current' as const },
        ],
      }));
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isConversationSegmentEnabled={() => true}
          build={build}
        />
      );

      expect(screen.getByTestId('workspace-breadcrumb-segment-1').tagName).toBe('SPAN');
    });

    it('surfaces the builder-supplied full title as a tooltip on a truncated segment', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Full long title never truncated here' }],
      };
      const build = vi.fn(() => ({
        segments: [
          { label: 'Chat', role: 'chat-link' as const },
          { label: 'Assessment · SIRI', role: 'view' as const },
          {
            label: 'Full long title never trunca\u2026',
            role: 'current' as const,
            title: 'Full long title never truncated here',
          },
        ],
      }));
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isConversationSegmentEnabled={() => true}
          build={build}
        />
      );

      const current = screen.getByTestId('workspace-breadcrumb-segment-2');
      expect(current.getAttribute('title')).toBe('Full long title never truncated here');
    });

    it('clicking the Chat segment still calls returnToFullChat() in the 3-segment shape', () => {
      const returnToFullChat = vi.fn();
      mockAppState = { currentView: AppView.ASSESSMENT_SIRI, returnToFullChat };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'SIRI rollout Q3' }],
      };
      const build = vi.fn(() => ({
        segments: [
          { label: 'Chat', role: 'chat-link' as const },
          { label: 'Assessment · SIRI', role: 'view' as const },
          { label: 'SIRI rollout Q3', role: 'current' as const },
        ],
      }));
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isConversationSegmentEnabled={() => true}
          build={build}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-segment-0'));
      expect(returnToFullChat).toHaveBeenCalledTimes(1);
    });
  });

  // ------------- NAV-M3-lite recent-conversations dropdown ---------
  describe('NAV-M3-lite recent-conversations dropdown', () => {
    const baseBuild = () => ({
      segments: [
        { label: 'Chat', role: 'chat-link' as const },
        { label: 'Assessment · SIRI', role: 'current' as const },
      ],
    });

    it('does not render the caret when the recents kill-switch is OFF', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [
          { id: 'conv-1', title: 'Active' },
          { id: 'conv-2', title: 'Sibling' },
        ],
      };
      const buildRecents = vi.fn(() => [
        {
          id: 'conv-2',
          label: 'Sibling',
          fullTitle: 'Sibling',
          truncated: false,
          pinned: false,
        },
      ]);
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => false}
          build={baseBuild}
          buildRecents={buildRecents}
        />
      );

      expect(screen.queryByTestId('workspace-breadcrumb-recents-trigger')).toBeNull();
      // Builder is never called when the flag is OFF — zero work.
      expect(buildRecents).not.toHaveBeenCalled();
    });

    it('does not render the caret when the recents list is empty', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Active only' }],
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          build={baseBuild}
          buildRecents={() => []}
        />
      );

      expect(screen.queryByTestId('workspace-breadcrumb-recents-trigger')).toBeNull();
    });

    it('renders the caret trigger and opens the menu on click when recents exist', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [
          { id: 'conv-1', title: 'Active' },
          { id: 'conv-2', title: 'Sibling A' },
          { id: 'conv-3', title: 'Sibling B' },
        ],
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling A',
              fullTitle: 'Sibling A',
              truncated: false,
              pinned: false,
            },
            {
              id: 'conv-3',
              label: 'Sibling B',
              fullTitle: 'Sibling B',
              truncated: false,
              pinned: false,
            },
          ]}
        />
      );

      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      expect(trigger).toBeTruthy();
      fireEvent.click(trigger);

      expect(screen.getByTestId('workspace-breadcrumb-recents-menu')).toBeTruthy();
      expect(screen.getByTestId('workspace-breadcrumb-recent-0').textContent).toContain(
        'Sibling A'
      );
      expect(screen.getByTestId('workspace-breadcrumb-recent-1').textContent).toContain(
        'Sibling B'
      );
    });

    it('selecting a recent calls setActiveConversation(id) then returnToFullChat()', () => {
      const order: string[] = [];
      const setActiveConversation = vi.fn((id: string) => {
        order.push(`setActive:${id}`);
      });
      const returnToFullChat = vi.fn(() => {
        order.push('returnToFullChat');
      });
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat,
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [
          { id: 'conv-1', title: 'Active' },
          { id: 'conv-2', title: 'Sibling' },
        ],
        setActiveConversation,
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling',
              fullTitle: 'Sibling',
              truncated: false,
              pinned: false,
            },
          ]}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recent-0'));

      expect(setActiveConversation).toHaveBeenCalledWith('conv-2');
      expect(returnToFullChat).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['setActive:conv-2', 'returnToFullChat']);
    });

    it('still calls returnToFullChat when setActiveConversation throws', () => {
      const returnToFullChat = vi.fn();
      const setActiveConversation = vi.fn(() => {
        throw new Error('store error');
      });
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat,
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'A' }],
        setActiveConversation,
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling',
              fullTitle: 'Sibling',
              truncated: false,
              pinned: false,
            },
          ]}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      expect(() => {
        fireEvent.click(screen.getByTestId('workspace-breadcrumb-recent-0'));
      }).not.toThrow();
      expect(returnToFullChat).toHaveBeenCalledTimes(1);
    });

    it('forwards the active conversations + id to the recents builder', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      const conversations = [
        { id: 'conv-1', title: 'Active' },
        { id: 'conv-2', title: 'Sibling' },
      ];
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations,
      };
      const buildRecents = vi.fn(() => []);
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          build={baseBuild}
          buildRecents={buildRecents}
        />
      );

      expect(buildRecents).toHaveBeenCalledTimes(1);
      expect(getFirstCallArg(buildRecents)).toMatchObject({
        activeConversationId: 'conv-1',
      });
      expect(getFirstCallArg(buildRecents)?.conversations).toBe(conversations);
    });

    // -----------------------------------------------------------
    // NAV-M3-lite+ · pinned-first kill-switch plumbing
    // -----------------------------------------------------------
    it('passes pinnedEnabled=true to the builder when the pinned flag is ON', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Active' }],
      };
      const buildRecents = vi.fn(() => []);
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          isRecentsPinnedEnabled={() => true}
          build={baseBuild}
          buildRecents={buildRecents}
        />
      );

      expect(buildRecents).toHaveBeenCalledTimes(1);
      expect(getFirstCallArg(buildRecents)?.pinnedEnabled).toBe(true);
    });

    it('passes pinnedEnabled=false to the builder when the pinned flag is OFF', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Active' }],
      };
      const buildRecents = vi.fn(() => []);
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          isRecentsPinnedEnabled={() => false}
          build={baseBuild}
          buildRecents={buildRecents}
        />
      );

      expect(buildRecents).toHaveBeenCalledTimes(1);
      expect(getFirstCallArg(buildRecents)?.pinnedEnabled).toBe(false);
    });

    it('renders the pin glyph next to pinned rows in the popover', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [
          { id: 'conv-1', title: 'Active' },
          { id: 'conv-2', title: 'Pinned', starred: true },
          { id: 'conv-3', title: 'Plain' },
        ],
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          isRecentsPinnedEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Pinned',
              fullTitle: 'Pinned',
              truncated: false,
              pinned: true,
            },
            {
              id: 'conv-3',
              label: 'Plain',
              fullTitle: 'Plain',
              truncated: false,
              pinned: false,
            },
          ]}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));

      expect(screen.getByTestId('workspace-breadcrumb-recent-0').getAttribute('data-pinned')).toBe(
        'true'
      );
      expect(screen.getByTestId('workspace-breadcrumb-recent-0-pin')).toBeTruthy();
      expect(screen.getByTestId('workspace-breadcrumb-recent-1').getAttribute('data-pinned')).toBe(
        'false'
      );
      expect(screen.queryByTestId('workspace-breadcrumb-recent-1-pin')).toBeNull();
    });

    // -----------------------------------------------------------
    // NAV-M3-lite++ · "View all" footer
    // -----------------------------------------------------------
    it('renders the "View all" footer when the eligible count exceeds the cap', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Active' }],
        isSidebarOpen: false,
        toggleSidebar: vi.fn(),
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          isRecentsViewAllEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling',
              fullTitle: 'Sibling',
              truncated: false,
              pinned: false,
            },
          ]}
          countEligibleRecents={() => 7}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      expect(screen.getByTestId('workspace-breadcrumb-recents-view-all')).toBeTruthy();
    });

    it('suppresses the footer when the eligible count fits in the cap', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Active' }],
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          isRecentsViewAllEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling',
              fullTitle: 'Sibling',
              truncated: false,
              pinned: false,
            },
          ]}
          countEligibleRecents={() => 1}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      expect(screen.queryByTestId('workspace-breadcrumb-recents-view-all')).toBeNull();
    });

    it('suppresses the footer when the view-all kill-switch is OFF (even on overflow)', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Active' }],
      };
      const countEligibleRecents = vi.fn(() => 42);
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          isRecentsViewAllEnabled={() => false}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling',
              fullTitle: 'Sibling',
              truncated: false,
              pinned: false,
            },
          ]}
          countEligibleRecents={countEligibleRecents}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      expect(screen.queryByTestId('workspace-breadcrumb-recents-view-all')).toBeNull();
      // When the kill-switch is OFF, the counter is skipped
      // entirely — zero cost at steady state.
      expect(countEligibleRecents).not.toHaveBeenCalled();
    });

    it('clicking "View all" returns to chat and opens the sidebar when closed', () => {
      const returnToFullChat = vi.fn();
      const toggleSidebar = vi.fn();
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat,
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Active' }],
        isSidebarOpen: false,
        toggleSidebar,
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          isRecentsViewAllEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling',
              fullTitle: 'Sibling',
              truncated: false,
              pinned: false,
            },
          ]}
          countEligibleRecents={() => 12}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-view-all'));

      expect(returnToFullChat).toHaveBeenCalledTimes(1);
      expect(toggleSidebar).toHaveBeenCalledTimes(1);
    });

    it('clicking "View all" does NOT toggle the sidebar when already open', () => {
      const toggleSidebar = vi.fn();
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Active' }],
        isSidebarOpen: true,
        toggleSidebar,
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          isRecentsViewAllEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling',
              fullTitle: 'Sibling',
              truncated: false,
              pinned: false,
            },
          ]}
          countEligibleRecents={() => 9}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-view-all'));

      expect(toggleSidebar).not.toHaveBeenCalled();
    });

    it('clicking "View all" closes the popover', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'Active' }],
        isSidebarOpen: false,
        toggleSidebar: vi.fn(),
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          isRecentsViewAllEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling',
              fullTitle: 'Sibling',
              truncated: false,
              pinned: false,
            },
          ]}
          countEligibleRecents={() => 6}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      expect(screen.getByTestId('workspace-breadcrumb-recents-menu')).toBeTruthy();

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-view-all'));
      expect(screen.queryByTestId('workspace-breadcrumb-recents-menu')).toBeNull();
    });

    it('emits zero telemetry events on recent selection', () => {
      mockAppState = {
        currentView: AppView.ASSESSMENT_SIRI,
        returnToFullChat: vi.fn(),
      };
      mockConvState = {
        activeConversationId: 'conv-1',
        conversations: [{ id: 'conv-1', title: 'A' }],
        setActiveConversation: vi.fn(),
      };
      render(
        <WorkspaceBreadcrumb
          isEnabled={() => true}
          isRecentsEnabled={() => true}
          build={baseBuild}
          buildRecents={() => [
            {
              id: 'conv-2',
              label: 'Sibling',
              fullTitle: 'Sibling',
              truncated: false,
              pinned: false,
            },
          ]}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recent-0'));

      expect(trackFunnelEventMock).not.toHaveBeenCalled();
    });
  });
});
