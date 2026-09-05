import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setCurrentView, setMyWorkIntent } = vi.hoisted(() => ({
  setCurrentView: vi.fn(),
  setMyWorkIntent: vi.fn(),
}));

vi.mock('@/hooks/usePageAwarePolling', () => ({ usePageAwarePolling: vi.fn() }));
vi.mock('@/hooks/useNotificationSnooze', () => ({
  useNotificationSnooze: () => ({
    snooze: vi.fn(),
    isSnoozed: vi.fn(() => false),
    formatRemainingTime: vi.fn(() => ''),
    getSnoozedIds: vi.fn(() => []),
  }),
}));
vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({ updateWorkspaceFromView: vi.fn() }),
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    setCurrentView,
    setMyWorkIntent,
    isChatCollapsed: false,
    toggleChatCollapse: vi.fn(),
  }),
}));

import { NotificationDropdown } from '../../../src/components/layout/NotificationDropdown';
import { AppView } from '../../../src/types';

describe('day373 NotificationDropdown header navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders exactly one accessible Inbox navigation action and preserves its intent', async () => {
    const user = userEvent.setup();
    render(<NotificationDropdown />);

    await user.click(screen.getByRole('button', { name: 'Inbox' }));
    const navigationActions = screen
      .getAllByRole('button')
      .filter((button) => /^Open (Inbox|Notification Center)/.test(button.title));
    expect(navigationActions).toHaveLength(1);
    expect(navigationActions[0]).toHaveAccessibleName('Inbox');
    expect(navigationActions[0]).toHaveAttribute('title', 'Open Inbox (Action Queue)');

    await user.click(navigationActions[0]);
    expect(setMyWorkIntent).toHaveBeenCalledTimes(1);
    expect(setMyWorkIntent).toHaveBeenCalledWith({ tab: 'inbox' });
    expect(setCurrentView).toHaveBeenCalledWith(AppView.MY_WORK);
  });
});
