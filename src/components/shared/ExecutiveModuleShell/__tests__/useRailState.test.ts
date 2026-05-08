/**
 * @vitest-environment jsdom
 *
 * Unit tests for `useRailState` (EPIC-T16 D2).
 *
 * Coverage:
 *   * Defaults applied when nothing persisted.
 *   * Toggles flip the collapse flags.
 *   * Width setters clamp to RAIL_WIDTH_BOUNDS.
 *   * State persists to localStorage under `mels.rail.{moduleKey}`.
 *   * `ephemeral=true` suppresses persistence (for embedded contexts).
 *   * Re-init when `moduleKey` changes loads the right namespace.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  RAIL_WIDTH_BOUNDS,
  useRailState,
} from '../useRailState';

const LS_KEY = (key: string) => `mels.rail.${key}`;

describe('useRailState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('initialises with defaults when nothing persisted', () => {
    const { result } = renderHook(() => useRailState({ moduleKey: 'tabele' }));
    expect(result.current.leftCollapsed).toBe(false);
    expect(result.current.rightCollapsed).toBe(false);
    expect(result.current.leftWidth).toBe(280);
    expect(result.current.rightWidth).toBe(360);
  });

  it('honours caller-supplied defaults', () => {
    const { result } = renderHook(() =>
      useRailState({
        moduleKey: 'wordy',
        defaultLeftCollapsed: true,
        defaultLeftWidth: 320,
      })
    );
    expect(result.current.leftCollapsed).toBe(true);
    expect(result.current.leftWidth).toBe(320);
  });

  it('toggleLeft / toggleRight flip the collapse flags', () => {
    const { result } = renderHook(() => useRailState({ moduleKey: 'tabele' }));
    act(() => result.current.toggleLeft());
    expect(result.current.leftCollapsed).toBe(true);
    act(() => result.current.toggleRight());
    expect(result.current.rightCollapsed).toBe(true);
    act(() => result.current.toggleLeft());
    expect(result.current.leftCollapsed).toBe(false);
  });

  it('clamps left width into RAIL_WIDTH_BOUNDS', () => {
    const { result } = renderHook(() => useRailState({ moduleKey: 'tabele' }));
    act(() => result.current.setLeftWidth(50));
    expect(result.current.leftWidth).toBe(RAIL_WIDTH_BOUNDS.leftMin);
    act(() => result.current.setLeftWidth(9999));
    expect(result.current.leftWidth).toBe(RAIL_WIDTH_BOUNDS.leftMax);
    act(() => result.current.setLeftWidth(300));
    expect(result.current.leftWidth).toBe(300);
  });

  it('clamps right width into RAIL_WIDTH_BOUNDS', () => {
    const { result } = renderHook(() => useRailState({ moduleKey: 'tabele' }));
    act(() => result.current.setRightWidth(100));
    expect(result.current.rightWidth).toBe(RAIL_WIDTH_BOUNDS.rightMin);
    act(() => result.current.setRightWidth(9999));
    expect(result.current.rightWidth).toBe(RAIL_WIDTH_BOUNDS.rightMax);
  });

  it('persists state to localStorage under mels.rail.{moduleKey}', () => {
    const { result } = renderHook(() => useRailState({ moduleKey: 'tabele' }));
    act(() => {
      result.current.toggleLeft();
      result.current.setRightWidth(420);
    });
    const raw = window.localStorage.getItem(LS_KEY('tabele'));
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.leftCollapsed).toBe(true);
    expect(parsed.rightWidth).toBe(420);
  });

  it('restores persisted state on remount', () => {
    window.localStorage.setItem(
      LS_KEY('tabele'),
      JSON.stringify({
        leftCollapsed: true,
        rightCollapsed: true,
        leftWidth: 360,
        rightWidth: 480,
      })
    );
    const { result } = renderHook(() => useRailState({ moduleKey: 'tabele' }));
    expect(result.current.leftCollapsed).toBe(true);
    expect(result.current.rightCollapsed).toBe(true);
    expect(result.current.leftWidth).toBe(360);
    expect(result.current.rightWidth).toBe(480);
  });

  it('ephemeral=true suppresses persistence', () => {
    const { result } = renderHook(() =>
      useRailState({ moduleKey: 'tabele', ephemeral: true })
    );
    act(() => result.current.toggleLeft());
    expect(window.localStorage.getItem(LS_KEY('tabele'))).toBeNull();
  });

  it('namespaces persistence per moduleKey', () => {
    const tabele = renderHook(() => useRailState({ moduleKey: 'tabele' }));
    const wordy = renderHook(() => useRailState({ moduleKey: 'wordy' }));
    act(() => tabele.result.current.toggleLeft());
    expect(window.localStorage.getItem(LS_KEY('tabele'))).toBeTruthy();
    expect(window.localStorage.getItem(LS_KEY('wordy'))).toBeTruthy(); // initial write
    expect(wordy.result.current.leftCollapsed).toBe(false);
  });

  it('resetToDefaults restores configured defaults', () => {
    const { result } = renderHook(() =>
      useRailState({
        moduleKey: 'tabele',
        defaultLeftCollapsed: false,
        defaultLeftWidth: 260,
      })
    );
    act(() => {
      result.current.toggleLeft();
      result.current.setLeftWidth(420);
    });
    expect(result.current.leftCollapsed).toBe(true);
    expect(result.current.leftWidth).toBe(420);
    act(() => result.current.resetToDefaults());
    expect(result.current.leftCollapsed).toBe(false);
    expect(result.current.leftWidth).toBe(260);
  });
});
