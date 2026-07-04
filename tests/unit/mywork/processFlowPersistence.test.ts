/**
 * M07 F4 — useProcessFlowPersistence dual-mode adapter contract.
 *
 * Coverage (per _M07_F4_PERSISTENCE_SPEC.md §Testy):
 *  - Runtime mode: scheduleSave → externalRuntime.captureGraph (reason 'draft');
 *    save → captureGraph + flushGraph (reason 'manual', createSnapshot);
 *    refresh → externalRuntime.refresh; primeServerVersion is a no-op.
 *  - Fallback mode (no runtime): scheduleSave → useIdeaMapSync.queueSync;
 *    save → flushNow; primeServerVersion → useIdeaMapSync.primeServerVersion.
 *  - Re-hydration on conflict: syncState 'conflict' → runtime.refresh() once.
 *  - Version JUMP (>+1) → onExternalChange fires; own +1 bump → does NOT fire.
 *  - `saving/syncState/lastSavedAt` mirror the active source.
 */
import { act, renderHook } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProcessFlowPersistence } from '../../../src/components/MyWork/processflow/useProcessFlowPersistence';

// ── Mock the fallback sync layer ──────────────────────────────────────────
const queueSyncMock = vi.fn();
const flushNowMock = vi.fn(async () => ({ version: 2 }));
const primeServerVersionMock = vi.fn();
let fallbackState = {
  saving: false,
  syncState: 'idle' as string,
  lastSavedAt: null as number | null,
};

vi.mock('@/components/MyWork/canvas/useIdeaMapSync', () => ({
  useIdeaMapSync: () => ({
    saving: fallbackState.saving,
    syncState: fallbackState.syncState,
    lastSavedAt: fallbackState.lastSavedAt,
    queueSync: queueSyncMock,
    flushNow: flushNowMock,
    primeServerVersion: primeServerVersionMock,
  }),
}));

const nodes: Node[] = [
  { id: 'n1', type: 'flowNode', position: { x: 0, y: 0 }, data: { shape: 'start', label: 'A' } },
];
const edges: Edge[] = [];

function makeRuntime(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    loading: false,
    saving: false,
    lastSavedAt: null as number | null,
    syncState: 'idle' as any,
    nodes,
    edges,
    extensions: {},
    captureGraph: vi.fn(),
    flushGraph: vi.fn(async () => ({ version: 2 })),
    refresh: vi.fn(async () => {}),
    ...overrides,
  };
}

const payload = {
  nodes,
  edges,
  preferredTool: 'process_flow',
  extensions: { processFlow: { lanes: [] } },
};

beforeEach(() => {
  queueSyncMock.mockClear();
  flushNowMock.mockClear();
  primeServerVersionMock.mockClear();
  fallbackState = { saving: false, syncState: 'idle', lastSavedAt: null };
});

describe('useProcessFlowPersistence — runtime (connected) mode', () => {
  it('scheduleSave delegates to externalRuntime.captureGraph with reason draft', () => {
    const runtime = makeRuntime();
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false, externalRuntime: runtime as any })
    );
    act(() => result.current.scheduleSave(payload, { reason: 'draft' }));
    expect(runtime.captureGraph).toHaveBeenCalledTimes(1);
    expect(runtime.captureGraph).toHaveBeenCalledWith(
      { nodes, edges, extensions: payload.extensions },
      { reason: 'draft' }
    );
    // Fallback layer untouched in runtime mode.
    expect(queueSyncMock).not.toHaveBeenCalled();
  });

  it('save captures then flushes with reason manual + snapshot', async () => {
    const runtime = makeRuntime();
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false, externalRuntime: runtime as any })
    );
    await act(async () => {
      await result.current.save(payload, { reason: 'manual', createSnapshot: true, snapshotLabel: 'cp' });
    });
    expect(runtime.captureGraph).toHaveBeenCalled();
    expect(runtime.flushGraph).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'manual', createSnapshot: true, snapshotLabel: 'cp' })
    );
    expect(flushNowMock).not.toHaveBeenCalled();
  });

  it('refresh delegates to externalRuntime.refresh', async () => {
    const runtime = makeRuntime();
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false, externalRuntime: runtime as any })
    );
    await act(async () => {
      await result.current.refresh();
    });
    expect(runtime.refresh).toHaveBeenCalledTimes(1);
  });

  it('primeServerVersion is a no-op in runtime mode', () => {
    const runtime = makeRuntime();
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false, externalRuntime: runtime as any })
    );
    act(() => result.current.primeServerVersion(5));
    expect(primeServerVersionMock).not.toHaveBeenCalled();
  });

  it('scheduleSave is suppressed when locked', () => {
    const runtime = makeRuntime();
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: true, externalRuntime: runtime as any })
    );
    act(() => result.current.scheduleSave(payload, { reason: 'draft' }));
    expect(runtime.captureGraph).not.toHaveBeenCalled();
  });

  it('mirrors runtime saving/syncState/lastSavedAt', () => {
    const runtime = makeRuntime({ saving: true, syncState: 'saving', lastSavedAt: 12345 });
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false, externalRuntime: runtime as any })
    );
    expect(result.current.saving).toBe(true);
    expect(result.current.syncState).toBe('saving');
    expect(result.current.lastSavedAt).toBe(12345);
  });
});

describe('useProcessFlowPersistence — fallback mode (no runtime)', () => {
  it('scheduleSave delegates to useIdeaMapSync.queueSync', () => {
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false })
    );
    act(() => result.current.scheduleSave(payload, { reason: 'draft' }));
    expect(queueSyncMock).toHaveBeenCalledTimes(1);
    expect(queueSyncMock).toHaveBeenCalledWith(payload, { reason: 'draft' });
  });

  it('save delegates to useIdeaMapSync.flushNow', async () => {
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false })
    );
    await act(async () => {
      await result.current.save(payload, { reason: 'manual', createSnapshot: true });
    });
    expect(flushNowMock).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ reason: 'manual', createSnapshot: true })
    );
  });

  it('primeServerVersion delegates to useIdeaMapSync.primeServerVersion', () => {
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false })
    );
    act(() => result.current.primeServerVersion(7));
    expect(primeServerVersionMock).toHaveBeenCalledWith(7);
  });

  it('mirrors fallback saving/syncState/lastSavedAt', () => {
    fallbackState = { saving: true, syncState: 'queued', lastSavedAt: 999 };
    const { result } = renderHook(() =>
      useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false })
    );
    expect(result.current.saving).toBe(true);
    expect(result.current.syncState).toBe('queued');
    expect(result.current.lastSavedAt).toBe(999);
  });
});

describe('useProcessFlowPersistence — re-hydration signals', () => {
  it('conflict syncState triggers runtime.refresh once', () => {
    const runtime = makeRuntime({ syncState: 'idle' });
    const { rerender } = renderHook(
      (props: { rt: any }) =>
        useProcessFlowPersistence({ ideaId: 'idea-1', open: true, locked: false, externalRuntime: props.rt }),
      { initialProps: { rt: runtime } }
    );
    expect(runtime.refresh).not.toHaveBeenCalled();
    // Runtime transitions to conflict.
    const conflictRt = { ...runtime, syncState: 'conflict' };
    rerender({ rt: conflictRt });
    expect(runtime.refresh).toHaveBeenCalledTimes(1);
    // Staying in conflict does not re-fire.
    rerender({ rt: { ...conflictRt } });
    expect(runtime.refresh).toHaveBeenCalledTimes(1);
  });

  it('version JUMP (>+1) fires onExternalChange; own +1 bump does NOT', () => {
    const onExternalChange = vi.fn();
    const rt1 = makeRuntime({ version: 1 });
    const { rerender } = renderHook(
      (props: { rt: any }) =>
        useProcessFlowPersistence({
          ideaId: 'idea-1',
          open: true,
          locked: false,
          externalRuntime: props.rt,
          onExternalChange,
        }),
      { initialProps: { rt: rt1 } }
    );
    // Initial observation — no re-hydrate (host already hydrated on mount).
    expect(onExternalChange).not.toHaveBeenCalled();
    // Own save: +1 bump → no re-hydrate.
    rerender({ rt: makeRuntime({ version: 2 }) });
    expect(onExternalChange).not.toHaveBeenCalled();
    // Peer change: jump 2 → 5 (>+1) → re-hydrate.
    rerender({ rt: makeRuntime({ version: 5 }) });
    expect(onExternalChange).toHaveBeenCalledTimes(1);
  });
});
