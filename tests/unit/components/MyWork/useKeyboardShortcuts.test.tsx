/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardShortcuts } from '@/components/MyWork/hooks/useKeyboardShortcuts';

describe('MyWork useKeyboardShortcuts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('only exposes shortcuts that are actually wired for the current surface', () => {
    const { result } = renderHook(() =>
      useKeyboardShortcuts({
        onAddChild: vi.fn(),
        onAddSibling: vi.fn(),
        onCancel: vi.fn(),
      })
    );

    const keys = result.current.shortcuts.map((shortcut) => shortcut.key);

    expect(keys).toContain('?');
    expect(keys).toContain('Tab');
    expect(keys).toContain('Shift+Enter');
    expect(keys).not.toContain('Enter');
    expect(keys).not.toContain('n');
  });

  it('does not swallow Enter when no open handler is configured', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        enabled: true,
      })
    );

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const preventDefault = vi.fn();
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    document.dispatchEvent(event);

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
