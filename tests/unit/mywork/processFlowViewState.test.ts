import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROCESS_FLOW_VIEW_STATE,
  isValidViewport,
  normalizeProcessFlowViewState,
  processFlowViewportStorageKey,
  resolveHydrationViewport,
} from '../../../src/components/MyWork/processflow/viewState';

describe('isValidViewport', () => {
  it('accepts a well-formed viewport', () => {
    expect(isValidViewport({ x: 10, y: -20, zoom: 1.5 })).toBe(true);
  });
  it('rejects missing fields', () => {
    expect(isValidViewport({ x: 10, y: -20 })).toBe(false);
  });
  it('rejects non-numeric fields', () => {
    expect(isValidViewport({ x: '10', y: 0, zoom: 1 })).toBe(false);
  });
  it('rejects zoom <= 0', () => {
    expect(isValidViewport({ x: 0, y: 0, zoom: 0 })).toBe(false);
    expect(isValidViewport({ x: 0, y: 0, zoom: -1 })).toBe(false);
  });
  it('rejects null/non-object', () => {
    expect(isValidViewport(null)).toBe(false);
    expect(isValidViewport('nope')).toBe(false);
    expect(isValidViewport(42)).toBe(false);
  });
});

describe('normalizeProcessFlowViewState', () => {
  it('returns defaults when raw is absent', () => {
    expect(normalizeProcessFlowViewState(undefined)).toEqual(DEFAULT_PROCESS_FLOW_VIEW_STATE);
    expect(normalizeProcessFlowViewState(null)).toEqual(DEFAULT_PROCESS_FLOW_VIEW_STATE);
  });
  it('returns defaults when raw is not an object', () => {
    expect(normalizeProcessFlowViewState('garbage')).toEqual(DEFAULT_PROCESS_FLOW_VIEW_STATE);
  });
  it('preserves showGrid=false and snap=false (bug L-04 regression)', () => {
    const result = normalizeProcessFlowViewState({ showGrid: false, snap: false });
    expect(result.showGrid).toBe(false);
    expect(result.snap).toBe(false);
  });
  it('defaults booleans when field is not a boolean', () => {
    const result = normalizeProcessFlowViewState({ showGrid: 'yes', snap: 1 });
    expect(result.showGrid).toBe(true);
    expect(result.snap).toBe(true);
  });
  it('accepts layoutMode vertical, defaults invalid to horizontal', () => {
    expect(normalizeProcessFlowViewState({ layoutMode: 'vertical' }).layoutMode).toBe('vertical');
    expect(normalizeProcessFlowViewState({ layoutMode: 'diagonal' }).layoutMode).toBe('horizontal');
  });
  it('carries a valid viewport through', () => {
    const result = normalizeProcessFlowViewState({ viewport: { x: 1, y: 2, zoom: 0.8 } });
    expect(result.viewport).toEqual({ x: 1, y: 2, zoom: 0.8 });
  });
  it('drops an invalid viewport', () => {
    const result = normalizeProcessFlowViewState({ viewport: { x: 1 } });
    expect(result.viewport).toBeUndefined();
  });
});

describe('resolveHydrationViewport', () => {
  it('prefers a valid blob viewport over localStorage', () => {
    const blob = { x: 1, y: 2, zoom: 1 };
    const local = JSON.stringify({ x: 9, y: 9, zoom: 9 });
    expect(resolveHydrationViewport(blob, local)).toEqual(blob);
  });
  it('falls back to localStorage when blob viewport is missing', () => {
    const local = JSON.stringify({ x: 3, y: 4, zoom: 0.5 });
    expect(resolveHydrationViewport(undefined, local)).toEqual({ x: 3, y: 4, zoom: 0.5 });
  });
  it('falls back to localStorage when blob viewport is invalid', () => {
    const local = JSON.stringify({ x: 3, y: 4, zoom: 0.5 });
    expect(resolveHydrationViewport({ x: 1 }, local)).toEqual({ x: 3, y: 4, zoom: 0.5 });
  });
  it('returns null when both are absent', () => {
    expect(resolveHydrationViewport(undefined, null)).toBeNull();
  });
  it('returns null when localStorage has malformed JSON', () => {
    expect(resolveHydrationViewport(undefined, '{not json')).toBeNull();
  });
  it('returns null when localStorage viewport is invalid', () => {
    expect(resolveHydrationViewport(undefined, JSON.stringify({ x: 1 }))).toBeNull();
  });
});

describe('processFlowViewportStorageKey', () => {
  it('namespaces by ideaId', () => {
    expect(processFlowViewportStorageKey('idea-1')).toBe('pf-viewport-idea-1');
    expect(processFlowViewportStorageKey('idea-2')).toBe('pf-viewport-idea-2');
  });
});
