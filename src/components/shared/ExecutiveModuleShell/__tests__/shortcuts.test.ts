/**
 * @vitest-environment jsdom
 *
 * Unit tests for the MELS shortcut registry (EPIC-T16 D6).
 *
 * Coverage:
 *   * `buildMelsShortcuts` only emits descriptors for handlers that
 *     were supplied (no phantom shortcuts).
 *   * Each descriptor's match predicate fires on the documented combo
 *     and ignores wrong-key events.
 *   * `useMelsShortcuts` registers + tears down the listener.
 *   * Shortcuts in editable fields are suppressed unless modifier held.
 */

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMelsShortcuts, useMelsShortcuts } from '../shortcuts';

function fireKey(opts: KeyboardEventInit & { key: string }) {
  const event = new KeyboardEvent('keydown', { bubbles: true, ...opts });
  window.dispatchEvent(event);
  return event;
}

describe('buildMelsShortcuts', () => {
  it('only emits descriptors for handlers that were supplied', () => {
    const list = buildMelsShortcuts({});
    expect(list).toHaveLength(0);
  });

  it('emits the toggle-left-rail shortcut when handler supplied', () => {
    const list = buildMelsShortcuts({ onToggleLeftRail: () => undefined });
    expect(list.map((s) => s.id)).toEqual(['toggle-left-rail']);
    expect(list[0].display).toContain('\\');
  });

  it('match predicates fire for documented key combos', () => {
    const onToggleLeftRail = vi.fn();
    const onOpenHelp = vi.fn();
    const onRunPrimary = vi.fn();
    const list = buildMelsShortcuts({
      onToggleLeftRail,
      onOpenHelp,
      onRunPrimary,
    });

    const toggle = list.find((s) => s.id === 'toggle-left-rail')!;
    const help = list.find((s) => s.id === 'open-shortcut-help')!;
    const run = list.find((s) => s.id === 'run-primary')!;

    expect(toggle.match(new KeyboardEvent('keydown', { key: '\\', metaKey: true }))).toBe(true);
    expect(toggle.match(new KeyboardEvent('keydown', { key: '\\' }))).toBe(false);

    expect(help.match(new KeyboardEvent('keydown', { key: '/', ctrlKey: true }))).toBe(true);

    expect(run.match(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }))).toBe(true);
    expect(run.match(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
  });
});

describe('useMelsShortcuts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches a window keydown listener and removes it on unmount', () => {
    const handler = vi.fn();
    const list = buildMelsShortcuts({ onRunPrimary: handler });
    const { unmount } = renderHook(() => useMelsShortcuts(list));

    fireKey({ key: 'Enter', metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    fireKey({ key: 'Enter', metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores typing in editable fields without modifier', () => {
    const handler = vi.fn();
    const list = buildMelsShortcuts({ onOpenHelp: handler });
    renderHook(() => useMelsShortcuts(list));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const ev = new KeyboardEvent('keydown', { key: '/', bubbles: true });
    input.dispatchEvent(ev);
    // Note: dispatching on input still bubbles to window. The hook
    // guards via `event.target`, so the handler must NOT fire.
    expect(handler).not.toHaveBeenCalled();
  });

  it('still fires shortcuts in editable fields when modifier is held', () => {
    const handler = vi.fn();
    const list = buildMelsShortcuts({ onOpenHelp: handler });
    renderHook(() => useMelsShortcuts(list));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const ev = new KeyboardEvent('keydown', { key: '/', metaKey: true, bubbles: true });
    input.dispatchEvent(ev);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
