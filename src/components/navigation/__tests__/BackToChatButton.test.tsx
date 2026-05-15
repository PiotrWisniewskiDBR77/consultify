/**
 * Chat V9 / NAV NAV-M1 — tests for the Back-to-chat floating button.
 *
 * Coverage:
 *   - Flag gate (ON → render, OFF → null).
 *   - View gate (`AI_CHAT` and `WELCOME` → null, everything else with
 *     a conversation → render).
 *   - Conversation gate (`activeConversationId === null` → null).
 *   - Missing `returnToFullChat` (defensive — never true in prod) → null.
 *   - Click wires telemetry + navigation in the right order; telemetry
 *     failure does not block navigation.
 *   - Accessibility contract: `<button>` with `aria-label`.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppView } from '../../../types';
import { BackToChatButton } from '../BackToChatButton';

type AppStoreState = {
  currentView?: AppView;
  returnToFullChat?: () => void;
};
type ConvStoreState = {
  activeConversationId?: string | null;
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

describe('BackToChatButton', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockReset();
    mockAppState = {};
    mockConvState = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  // Flag gate.
  // -------------------------------------------------------------------
  it('returns null when the feature flag is disabled', () => {
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: vi.fn() };
    mockConvState = { activeConversationId: 'conv-1' };
    const { container } = render(<BackToChatButton isEnabled={() => false} />);
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------
  // View gate — AI_CHAT and WELCOME must never show the pill.
  // -------------------------------------------------------------------
  it('returns null on AppView.AI_CHAT even with a conversation', () => {
    mockAppState = { currentView: AppView.AI_CHAT, returnToFullChat: vi.fn() };
    mockConvState = { activeConversationId: 'conv-1' };
    const { container } = render(<BackToChatButton isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null on AppView.WELCOME even with a conversation', () => {
    mockAppState = { currentView: AppView.WELCOME, returnToFullChat: vi.fn() };
    mockConvState = { activeConversationId: 'conv-1' };
    const { container } = render(<BackToChatButton isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------
  // Conversation gate.
  // -------------------------------------------------------------------
  it('returns null when there is no active conversation', () => {
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: vi.fn() };
    mockConvState = { activeConversationId: null };
    const { container } = render(<BackToChatButton isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when activeConversationId is an empty string', () => {
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: vi.fn() };
    mockConvState = { activeConversationId: '' };
    const { container } = render(<BackToChatButton isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------
  // Defensive — store has no action installed.
  // -------------------------------------------------------------------
  it('returns null when returnToFullChat is missing on the store (defensive)', () => {
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: undefined };
    mockConvState = { activeConversationId: 'conv-1' };
    const { container } = render(<BackToChatButton isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------
  // Happy path — the pill renders, is a proper button, click wires
  // telemetry + navigation.
  // -------------------------------------------------------------------
  it('renders the pill when on a non-chat view with an active conversation', () => {
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: vi.fn() };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatButton isEnabled={() => true} />);

    const btn = screen.getByTestId('back-to-chat-button');
    expect(btn).toBeInTheDocument();
    expect(btn.tagName.toLowerCase()).toBe('button');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.getAttribute('aria-label')).toBe('Back to active conversation');
    expect(btn.textContent).toContain('Back to chat');
  });

  it('clicking fires telemetry with the current view, then calls returnToFullChat', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.FULL_STEP2_INITIATIVES, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-42' };

    render(<BackToChatButton isEnabled={() => true} />);
    fireEvent.click(screen.getByTestId('back-to-chat-button'));

    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
    expect(trackFunnelEventMock).toHaveBeenCalledWith('navigation_back_to_chat_clicked', {
      fromView: AppView.FULL_STEP2_INITIATIVES,
    });
    expect(returnMock).toHaveBeenCalledTimes(1);
  });

  it('payload never contains a conversation id or any other PII-like field', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.WORDY, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-SECRET' };

    render(<BackToChatButton isEnabled={() => true} />);
    fireEvent.click(screen.getByTestId('back-to-chat-button'));

    const payload = trackFunnelEventMock.mock.calls[0][1];
    expect(payload).toEqual({ fromView: AppView.WORDY });
    expect(Object.keys(payload)).toEqual(['fromView']);
    expect(JSON.stringify(payload)).not.toContain('conv-SECRET');
  });

  it('navigates even when telemetry throws', () => {
    trackFunnelEventMock.mockImplementationOnce(() => {
      throw new Error('sink exploded');
    });
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatButton isEnabled={() => true} />);
    fireEvent.click(screen.getByTestId('back-to-chat-button'));

    expect(returnMock).toHaveBeenCalledTimes(1);
  });
});
