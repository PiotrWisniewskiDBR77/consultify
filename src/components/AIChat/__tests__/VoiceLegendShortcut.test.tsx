/**
 * Chat V9 / VOICE VM3.1 — tests for the voice-modes legend keyboard
 * shortcut.
 *
 * Coverage:
 *   - Matcher: Alt+Shift+V matches; Ctrl/Meta+V does not; lone "v"
 *     does not; macOS `event.code` fallback works when the glyph is
 *     not a letter.
 *   - Guards: editable target, open modal → no-op.
 *   - Flag OFF: no event dispatched, no telemetry.
 *   - Happy path: event dispatched, telemetry emitted, default
 *     prevented.
 *   - Telemetry failure is swallowed; event still dispatched.
 *   - Unmount removes the listener.
 */

import { act, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VOICE_LEGEND_OPEN_EVENT } from '../../../utils/voiceLegendShortcutFlag';
import {
  hasOpenModal,
  isEditableTarget,
  matchesVoiceLegendShortcut,
  VoiceLegendShortcut,
} from '../VoiceLegendShortcut';

const trackFunnelEventMock = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

function fireKey(init: Partial<KeyboardEventInit> & { key?: string; code?: string }) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('matchesVoiceLegendShortcut', () => {
  it('matches Alt+Shift+V (key)', () => {
    const ev = new KeyboardEvent('keydown', { altKey: true, shiftKey: true, key: 'v' });
    expect(matchesVoiceLegendShortcut(ev)).toBe(true);
  });

  it('matches uppercase V too', () => {
    const ev = new KeyboardEvent('keydown', { altKey: true, shiftKey: true, key: 'V' });
    expect(matchesVoiceLegendShortcut(ev)).toBe(true);
  });

  it('matches via event.code fallback when key is a non-letter glyph (macOS Option+V → √)', () => {
    const ev = new KeyboardEvent('keydown', {
      altKey: true,
      shiftKey: true,
      key: '√',
      code: 'KeyV',
    });
    expect(matchesVoiceLegendShortcut(ev)).toBe(true);
  });

  it('does not match without Alt', () => {
    const ev = new KeyboardEvent('keydown', { shiftKey: true, key: 'v' });
    expect(matchesVoiceLegendShortcut(ev)).toBe(false);
  });

  it('does not match without Shift', () => {
    const ev = new KeyboardEvent('keydown', { altKey: true, key: 'v' });
    expect(matchesVoiceLegendShortcut(ev)).toBe(false);
  });

  it('does not match if Ctrl or Meta is also held (prevents paste hijack)', () => {
    const withCtrl = new KeyboardEvent('keydown', {
      altKey: true,
      shiftKey: true,
      ctrlKey: true,
      key: 'v',
    });
    const withMeta = new KeyboardEvent('keydown', {
      altKey: true,
      shiftKey: true,
      metaKey: true,
      key: 'v',
    });
    expect(matchesVoiceLegendShortcut(withCtrl)).toBe(false);
    expect(matchesVoiceLegendShortcut(withMeta)).toBe(false);
  });

  it('does not match a lone "v" keypress', () => {
    const ev = new KeyboardEvent('keydown', { key: 'v' });
    expect(matchesVoiceLegendShortcut(ev)).toBe(false);
  });
});

describe('isEditableTarget', () => {
  it('returns true for INPUT / TEXTAREA / SELECT', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
  });

  it('returns true for contenteditable elements', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(div)).toBe(true);
    div.setAttribute('contenteditable', 'plaintext-only');
    expect(isEditableTarget(div)).toBe(true);
  });

  it('returns false for plain elements and null', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('hasOpenModal', () => {
  it('returns true when a visible aria-modal is in the tree', () => {
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    expect(hasOpenModal(document)).toBe(true);
    document.body.removeChild(modal);
  });

  it('returns false when no aria-modal is present', () => {
    expect(hasOpenModal(document)).toBe(false);
  });
});

describe('VoiceLegendShortcut', () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    trackFunnelEventMock.mockReset();
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
    // Remove any stray aria-modal nodes from prior tests.
    document.querySelectorAll('[aria-modal="true"]').forEach((n) => n.remove());
  });

  it('dispatches the open event + telemetry on Alt+Shift+V', () => {
    render(<VoiceLegendShortcut isEnabled={() => true} />);
    const ev = fireKey({ altKey: true, shiftKey: true, key: 'v' });
    expect(ev.defaultPrevented).toBe(true);
    expect(trackFunnelEventMock).toHaveBeenCalledWith('voice_mode_legend_shortcut', {});
    const dispatched = dispatchSpy.mock.calls.find(
      (args: unknown[]) => args[0] instanceof Event && args[0].type === VOICE_LEGEND_OPEN_EVENT
    );
    expect(dispatched).toBeTruthy();
  });

  it('is a no-op when the flag is OFF', () => {
    render(<VoiceLegendShortcut isEnabled={() => false} />);
    fireKey({ altKey: true, shiftKey: true, key: 'v' });
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
    const dispatched = dispatchSpy.mock.calls.find(
      (args: unknown[]) => args[0] instanceof Event && args[0].type === VOICE_LEGEND_OPEN_EVENT
    );
    expect(dispatched).toBeFalsy();
  });

  it('ignores the shortcut when focus is inside an editable element', () => {
    render(<VoiceLegendShortcut isEnabled={() => true} />);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    const ev = new KeyboardEvent('keydown', {
      altKey: true,
      shiftKey: true,
      key: 'v',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      textarea.dispatchEvent(ev);
    });
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('ignores the shortcut when an aria-modal is open', () => {
    render(<VoiceLegendShortcut isEnabled={() => true} />);
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    fireKey({ altKey: true, shiftKey: true, key: 'v' });
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
    document.body.removeChild(modal);
  });

  it('still dispatches the event when telemetry throws', () => {
    trackFunnelEventMock.mockImplementationOnce(() => {
      throw new Error('sink exploded');
    });
    render(<VoiceLegendShortcut isEnabled={() => true} />);
    fireKey({ altKey: true, shiftKey: true, key: 'v' });
    const dispatched = dispatchSpy.mock.calls.find(
      (args: unknown[]) => args[0] instanceof Event && args[0].type === VOICE_LEGEND_OPEN_EVENT
    );
    expect(dispatched).toBeTruthy();
  });

  it('removes the listener on unmount', () => {
    const { unmount } = render(<VoiceLegendShortcut isEnabled={() => true} />);
    unmount();
    fireKey({ altKey: true, shiftKey: true, key: 'v' });
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });
});
