/**
 * Chat V9 / NAV NAV-M1.1 — tests for the Back-to-chat keyboard shortcut.
 *
 * Coverage:
 *   - Shortcut matcher: Alt+Shift+C matches, lone `c` doesn't, Ctrl/Meta
 *     combinations don't, wrong key doesn't, macOS `ç` glyph still matches
 *     via `event.code === 'KeyC'`.
 *   - Editable-target guard: `<input>`, `<textarea>`, `<select>`,
 *     `[contenteditable]` all suppress.
 *   - Open-modal guard: an element with `aria-modal="true"` suppresses.
 *   - Flag gate (ON → fires, OFF → no-op + no listener effect).
 *   - View gate (`AI_CHAT` / `WELCOME` → no-op).
 *   - Conversation gate (`null` / empty → no-op).
 *   - Missing `returnToFullChat` → no-op (defensive).
 *   - Happy path: telemetry fires with `fromView`, then
 *     `returnToFullChat()`. Telemetry failure doesn't block navigation.
 *   - Listener lifecycle: unmount removes the `keydown` listener.
 */

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppView } from '../../../types';
import {
  BackToChatShortcut,
  hasOpenModal,
  isEditableTarget,
  matchesShortcut,
} from '../BackToChatShortcut';

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
  useConversationStore: (selector: (state: ConvStoreState) => unknown) =>
    selector(mockConvState),
}));

const trackFunnelEventMock = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

function dispatchShortcut(overrides: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'c',
    code: 'KeyC',
    altKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
    ...overrides,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('BackToChatShortcut — helpers', () => {
  it('matchesShortcut only returns true for Alt+Shift+<letter C>', () => {
    const base = { key: 'c', code: 'KeyC', altKey: true, shiftKey: true };
    expect(matchesShortcut(new KeyboardEvent('keydown', base))).toBe(true);
    expect(matchesShortcut(new KeyboardEvent('keydown', { ...base, altKey: false }))).toBe(false);
    expect(matchesShortcut(new KeyboardEvent('keydown', { ...base, shiftKey: false }))).toBe(false);
    expect(matchesShortcut(new KeyboardEvent('keydown', { ...base, ctrlKey: true }))).toBe(false);
    expect(matchesShortcut(new KeyboardEvent('keydown', { ...base, metaKey: true }))).toBe(false);
    expect(
      matchesShortcut(new KeyboardEvent('keydown', { ...base, key: 'b', code: 'KeyB' }))
    ).toBe(false);
  });

  it('matchesShortcut falls back to event.code when Alt+C produces a glyph (macOS ç)', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'ç',
      code: 'KeyC',
      altKey: true,
      shiftKey: true,
    });
    expect(matchesShortcut(event)).toBe(true);
  });

  it('isEditableTarget flags inputs, textareas, selects, and contenteditable', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const plain = document.createElement('div');

    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(plain)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('hasOpenModal returns true only when an aria-modal element exists', () => {
    expect(hasOpenModal(document)).toBe(false);
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    try {
      expect(hasOpenModal(document)).toBe(true);
    } finally {
      document.body.removeChild(modal);
    }
    expect(hasOpenModal(null)).toBe(false);
  });
});

describe('BackToChatShortcut — component', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockReset();
    mockAppState = {};
    mockConvState = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders nothing (headless)', () => {
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: vi.fn() };
    mockConvState = { activeConversationId: 'conv-1' };
    const { container } = render(<BackToChatShortcut isEnabled={() => true} />);
    expect(container.firstChild).toBeNull();
  });

  it('fires telemetry then returnToFullChat on Alt+Shift+C', () => {
    const returnMock = vi.fn();
    mockAppState = {
      currentView: AppView.FULL_STEP2_INITIATIVES,
      returnToFullChat: returnMock,
    };
    mockConvState = { activeConversationId: 'conv-42' };

    render(<BackToChatShortcut isEnabled={() => true} />);
    dispatchShortcut();

    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
    expect(trackFunnelEventMock).toHaveBeenCalledWith('navigation_back_to_chat_shortcut', {
      fromView: AppView.FULL_STEP2_INITIATIVES,
    });
    expect(returnMock).toHaveBeenCalledTimes(1);
  });

  it('payload is RODO-safe: only fromView, no conversation id', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.WORDY, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-SECRET' };

    render(<BackToChatShortcut isEnabled={() => true} />);
    dispatchShortcut();

    const payload = trackFunnelEventMock.mock.calls[0][1];
    expect(Object.keys(payload)).toEqual(['fromView']);
    expect(JSON.stringify(payload)).not.toContain('conv-SECRET');
  });

  it('does nothing when the flag is disabled', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatShortcut isEnabled={() => false} />);
    dispatchShortcut();

    expect(trackFunnelEventMock).not.toHaveBeenCalled();
    expect(returnMock).not.toHaveBeenCalled();
  });

  it('does nothing on AppView.AI_CHAT', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.AI_CHAT, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatShortcut isEnabled={() => true} />);
    dispatchShortcut();

    expect(returnMock).not.toHaveBeenCalled();
  });

  it('does nothing on AppView.WELCOME', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.WELCOME, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatShortcut isEnabled={() => true} />);
    dispatchShortcut();

    expect(returnMock).not.toHaveBeenCalled();
  });

  it('does nothing when there is no active conversation', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: null };

    render(<BackToChatShortcut isEnabled={() => true} />);
    dispatchShortcut();

    expect(returnMock).not.toHaveBeenCalled();
  });

  it('does nothing when returnToFullChat is missing from the store', () => {
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: undefined };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatShortcut isEnabled={() => true} />);
    expect(() => dispatchShortcut()).not.toThrow();
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });

  it('does not fire when focus is inside a textarea', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatShortcut isEnabled={() => true} />);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      code: 'KeyC',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      textarea.dispatchEvent(event);
    });

    expect(returnMock).not.toHaveBeenCalled();
  });

  it('does not fire when any element has aria-modal="true"', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatShortcut isEnabled={() => true} />);

    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    dispatchShortcut();

    expect(returnMock).not.toHaveBeenCalled();
  });

  it('navigates even when telemetry throws', () => {
    trackFunnelEventMock.mockImplementationOnce(() => {
      throw new Error('sink exploded');
    });
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatShortcut isEnabled={() => true} />);
    dispatchShortcut();

    expect(returnMock).toHaveBeenCalledTimes(1);
  });

  it('ignores a lone "c" keypress with no modifiers', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-1' };

    render(<BackToChatShortcut isEnabled={() => true} />);
    dispatchShortcut({ altKey: false, shiftKey: false });

    expect(returnMock).not.toHaveBeenCalled();
  });

  it('removes its keydown listener on unmount', () => {
    const returnMock = vi.fn();
    mockAppState = { currentView: AppView.MY_WORK, returnToFullChat: returnMock };
    mockConvState = { activeConversationId: 'conv-1' };

    const { unmount } = render(<BackToChatShortcut isEnabled={() => true} />);
    unmount();
    dispatchShortcut();

    expect(returnMock).not.toHaveBeenCalled();
  });
});
