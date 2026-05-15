/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BottomNavigation } from '../../../src/components/navigation/BottomNavigation';
import { AppView } from '../../../src/types';

const deviceState = {
  isMobile: true,
};

const appState = {
  currentView: AppView.MY_WORK,
  setCurrentView: vi.fn(),
  returnToFullChat: vi.fn(),
  setIsSidebarOpen: vi.fn(),
  toggleChatCollapse: vi.fn(),
  isChatCollapsed: true,
};

const conversationState = {
  setDisplayMode: vi.fn(),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('../../../src/hooks/useDeviceType', () => ({
  useDeviceType: () => deviceState,
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => appState,
}));

vi.mock('../../../src/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: typeof conversationState) => unknown) =>
    selector(conversationState),
}));

describe('BottomNavigation', () => {
  beforeEach(() => {
    deviceState.isMobile = true;
    appState.currentView = AppView.MY_WORK;
    appState.isChatCollapsed = true;
    appState.setCurrentView.mockReset();
    appState.returnToFullChat.mockReset();
    appState.setIsSidebarOpen.mockReset();
    appState.toggleChatCollapse.mockReset();
    conversationState.setDisplayMode.mockReset();
  });

  it('uses canonical mobile targets for tools and initiatives', () => {
    appState.currentView = AppView.FULL_STEP2_INITIATIVES;

    render(<BottomNavigation />);

    const initiativesButton = screen.getByTestId('bottom-nav-initiatives');
    const assessmentButton = screen.getByTestId('bottom-nav-assessment');

    expect(initiativesButton).toHaveAttribute('aria-current', 'page');

    fireEvent.click(initiativesButton);
    fireEvent.click(assessmentButton);

    expect(appState.setCurrentView).toHaveBeenNthCalledWith(1, AppView.PORTFOLIO_ROADMAP);
    expect(appState.setCurrentView).toHaveBeenNthCalledWith(2, AppView.ASSESSMENT_OVERVIEW);
  });

  it('uses the canonical full-chat path for mobile AI entry', () => {
    render(<BottomNavigation />);

    fireEvent.click(screen.getByTestId('bottom-nav-ai'));

    expect(conversationState.setDisplayMode).toHaveBeenCalledWith('full');
    expect(appState.returnToFullChat).toHaveBeenCalledTimes(1);
    expect(appState.setCurrentView).not.toHaveBeenCalledWith(AppView.AI_CHAT);
  });

  it('marks active destination and sets accessible labels', () => {
    appState.currentView = AppView.MY_WORK;
    render(<BottomNavigation />);

    const nav = screen.getByRole('navigation', { name: 'Primary mobile navigation' });
    expect(nav).toBeInTheDocument();

    const myWorkButton = screen.getByTestId('bottom-nav-mywork');
    const assessmentButton = screen.getByTestId('bottom-nav-assessment');
    const aiButton = screen.getByTestId('bottom-nav-ai');
    const moreButton = screen.getByTestId('bottom-nav-more');

    expect(myWorkButton).toHaveAttribute('aria-current', 'page');
    expect(assessmentButton).not.toHaveAttribute('aria-current');
    expect(aiButton).toHaveAttribute('aria-label', 'Open AI chat');
    expect(moreButton).toHaveAttribute('aria-label', 'Open menu');
  });

  it('stays hidden outside mobile breakpoints', () => {
    deviceState.isMobile = false;

    const { container } = render(<BottomNavigation />);

    expect(container).toBeEmptyDOMElement();
  });
});
