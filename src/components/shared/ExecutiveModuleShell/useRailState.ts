/**
 * useRailState — persistent rail state for `ExecutiveModuleShell`
 * (MELS § 3.1 + EPIC-T16 D2 + D7).
 *
 * Tracks per-module:
 *   * `leftCollapsed` — left rail collapse toggle (MELS-mandatory).
 *   * `rightCollapsed` — right rail collapse toggle.
 *   * `leftWidth` — user-resizable left rail width (clamped 200..480 px).
 *   * `rightWidth` — right rail panel width (clamped 320..560 px).
 *
 * State is persisted to `localStorage` under
 * `mels.rail.{moduleKey}` so each module can have its own preferences
 * and so reload preserves the user's pinned layout (T16-D7 contract).
 *
 * The hook is SSR-safe — it reads from localStorage lazily on first
 * client render and falls back to the supplied defaults during SSR.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface RailDimensions {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  leftWidth: number;
  rightWidth: number;
}

export interface UseRailStateOptions {
  /**
   * Stable key used for the localStorage entry. Must be unique per
   * executive module ('tabele' | 'wordy' | 'prezentacje').
   */
  moduleKey: string;
  defaultLeftCollapsed?: boolean;
  defaultRightCollapsed?: boolean;
  defaultLeftWidth?: number;
  defaultRightWidth?: number;
  /**
   * When true, persistence is disabled and only in-memory state is
   * used. Useful for tests and embedded contexts.
   */
  ephemeral?: boolean;
}

export interface UseRailStateResult extends RailDimensions {
  setLeftCollapsed: (collapsed: boolean) => void;
  setRightCollapsed: (collapsed: boolean) => void;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  resetToDefaults: () => void;
}

export const RAIL_WIDTH_BOUNDS = {
  leftMin: 200,
  leftMax: 480,
  rightMin: 320,
  rightMax: 560,
} as const;

const DEFAULTS: Required<
  Pick<
    UseRailStateOptions,
    'defaultLeftCollapsed' | 'defaultRightCollapsed' | 'defaultLeftWidth' | 'defaultRightWidth'
  >
> = {
  defaultLeftCollapsed: false,
  defaultRightCollapsed: false,
  defaultLeftWidth: 280,
  defaultRightWidth: 360,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function lsKey(moduleKey: string): string {
  return `mels.rail.${moduleKey}`;
}

function readPersisted(moduleKey: string): Partial<RailDimensions> | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(lsKey(moduleKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RailDimensions>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersisted(moduleKey: string, dims: RailDimensions): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(lsKey(moduleKey), JSON.stringify(dims));
  } catch {
    // localStorage may be full or disabled (Safari private mode).
    // Persistence is best-effort.
  }
}

export function useRailState(options: UseRailStateOptions): UseRailStateResult {
  const {
    moduleKey,
    defaultLeftCollapsed = DEFAULTS.defaultLeftCollapsed,
    defaultRightCollapsed = DEFAULTS.defaultRightCollapsed,
    defaultLeftWidth = DEFAULTS.defaultLeftWidth,
    defaultRightWidth = DEFAULTS.defaultRightWidth,
    ephemeral = false,
  } = options;

  const initial = useMemo<RailDimensions>(() => {
    const persisted = ephemeral ? null : readPersisted(moduleKey);
    return {
      leftCollapsed:
        typeof persisted?.leftCollapsed === 'boolean'
          ? persisted.leftCollapsed
          : defaultLeftCollapsed,
      rightCollapsed:
        typeof persisted?.rightCollapsed === 'boolean'
          ? persisted.rightCollapsed
          : defaultRightCollapsed,
      leftWidth: clamp(
        typeof persisted?.leftWidth === 'number' ? persisted.leftWidth : defaultLeftWidth,
        RAIL_WIDTH_BOUNDS.leftMin,
        RAIL_WIDTH_BOUNDS.leftMax
      ),
      rightWidth: clamp(
        typeof persisted?.rightWidth === 'number' ? persisted.rightWidth : defaultRightWidth,
        RAIL_WIDTH_BOUNDS.rightMin,
        RAIL_WIDTH_BOUNDS.rightMax
      ),
    };
    // We intentionally only re-init when the moduleKey changes; defaults
    // shifting at runtime would surprise consumers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  const [state, setState] = useState<RailDimensions>(initial);

  useEffect(() => {
    if (ephemeral) return;
    writePersisted(moduleKey, state);
  }, [ephemeral, moduleKey, state]);

  const setLeftCollapsed = useCallback((leftCollapsed: boolean) => {
    setState((prev) => ({ ...prev, leftCollapsed }));
  }, []);

  const setRightCollapsed = useCallback((rightCollapsed: boolean) => {
    setState((prev) => ({ ...prev, rightCollapsed }));
  }, []);

  const setLeftWidth = useCallback((width: number) => {
    const clamped = clamp(width, RAIL_WIDTH_BOUNDS.leftMin, RAIL_WIDTH_BOUNDS.leftMax);
    setState((prev) => ({ ...prev, leftWidth: clamped }));
  }, []);

  const setRightWidth = useCallback((width: number) => {
    const clamped = clamp(width, RAIL_WIDTH_BOUNDS.rightMin, RAIL_WIDTH_BOUNDS.rightMax);
    setState((prev) => ({ ...prev, rightWidth: clamped }));
  }, []);

  const toggleLeft = useCallback(() => {
    setState((prev) => ({ ...prev, leftCollapsed: !prev.leftCollapsed }));
  }, []);

  const toggleRight = useCallback(() => {
    setState((prev) => ({ ...prev, rightCollapsed: !prev.rightCollapsed }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setState({
      leftCollapsed: defaultLeftCollapsed,
      rightCollapsed: defaultRightCollapsed,
      leftWidth: defaultLeftWidth,
      rightWidth: defaultRightWidth,
    });
  }, [defaultLeftCollapsed, defaultLeftWidth, defaultRightCollapsed, defaultRightWidth]);

  return {
    ...state,
    setLeftCollapsed,
    setRightCollapsed,
    setLeftWidth,
    setRightWidth,
    toggleLeft,
    toggleRight,
    resetToDefaults,
  };
}

export default useRailState;
