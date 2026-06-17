/**
 * @vitest-environment jsdom
 *
 * M03 L-10 — column widths persist across reload.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usePersistedColumnWidths } from '../../../src/components/MyWork/shared/usePersistedColumnWidths';

const KEY = 'mywork:test:column-widths';
const defaults = () => ({ title: 200, status: 100 }) as any;

describe('usePersistedColumnWidths', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('starts from defaults when storage is empty', () => {
    const { result } = renderHook(() => usePersistedColumnWidths(KEY, defaults));
    expect(result.current[0]).toEqual({ title: 200, status: 100 });
  });

  it('persists a resize to localStorage', () => {
    const { result } = renderHook(() => usePersistedColumnWidths(KEY, defaults));
    act(() => result.current[1]((p: any) => ({ ...p, title: 320 })));
    const stored = JSON.parse(window.localStorage.getItem(KEY)!);
    expect(stored.title).toBe(320);
  });

  it('hydrates a stored width on the next mount (survives reload)', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ title: 280 }));
    const { result } = renderHook(() => usePersistedColumnWidths(KEY, defaults));
    // stored width wins, missing columns fall back to defaults
    expect(result.current[0].title).toBe(280);
    expect(result.current[0].status).toBe(100);
  });

  it('falls back to defaults on malformed storage', () => {
    window.localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => usePersistedColumnWidths(KEY, defaults));
    expect(result.current[0]).toEqual({ title: 200, status: 100 });
  });
});
