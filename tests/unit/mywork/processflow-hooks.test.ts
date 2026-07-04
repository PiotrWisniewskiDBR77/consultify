import type { RefObject } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Node, Edge } from 'reactflow';

import { useProcessFlowValidation } from '../../../src/components/MyWork/processflow/useProcessFlowValidation';
import { useProcessFlowAIProposal } from '../../../src/components/MyWork/processflow/useProcessFlowAIProposal';
import { useProcessFlowReadback } from '../../../src/components/MyWork/processflow/useProcessFlowReadback';
import { useProcessFlowExport } from '../../../src/components/MyWork/processflow/useProcessFlowExport';

const originalFetch = global.fetch;
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ── Client-side hooks (DP-7: V8 process-flow routes cut) ────────────────────
// validate/fetchReadback/exportAs('json'|'readback') no longer hit the
// network — they compute from the in-memory graph. These tests assert that
// no fetch happens and the computed shape matches what the consumer panels
// expect.

const startNode: Node = {
  id: 'n-start',
  type: 'flowNode',
  position: { x: 0, y: 0 },
  data: { shape: 'start', label: 'Start' },
};
const endNode: Node = {
  id: 'n-end',
  type: 'flowNode',
  position: { x: 200, y: 0 },
  data: { shape: 'end', label: 'End' },
};
const edge1: Edge = { id: 'e1', source: 'n-start', target: 'n-end' };

describe('useProcessFlowValidation (client-side)', () => {
  it('validate computes a result locally without any fetch', async () => {
    const { result } = renderHook(() =>
      useProcessFlowValidation({
        processId: 'p1',
        nodes: [startNode, endNode],
        edges: [edge1],
        semanticKit: 'classic' as any,
        autoValidate: false,
      })
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.valid).toBe(true);
    expect(result.current.result?.issues).toEqual([]);
  });

  it('reports a semantic_first error when Start node is missing', async () => {
    const { result } = renderHook(() =>
      useProcessFlowValidation({
        processId: 'p1',
        nodes: [endNode],
        edges: [],
        semanticKit: 'classic' as any,
        autoValidate: false,
      })
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.result?.valid).toBe(false);
    expect(
      result.current.result?.issues.some((i) => i.layer === 'semantic_first' && i.severity === 'error')
    ).toBe(true);
  });

  it('issuesForObject filters by object_id', async () => {
    const decisionNode: Node = {
      id: 'n-decision',
      type: 'flowNode',
      position: { x: 100, y: 0 },
      data: { shape: 'decision', label: 'Decide' },
    };
    const { result } = renderHook(() =>
      useProcessFlowValidation({
        processId: 'p1',
        nodes: [startNode, decisionNode, endNode],
        edges: [
          { id: 'e1', source: 'n-start', target: 'n-decision' },
          { id: 'e2', source: 'n-decision', target: 'n-end' },
        ],
        semanticKit: 'classic' as any,
        autoValidate: false,
      })
    );

    await act(async () => {
      await result.current.validate();
    });

    // Decision has only 1 outgoing edge -> should flag decision-exits issue on n-decision.
    expect(result.current.issuesForObject('n-decision').length).toBeGreaterThan(0);
    expect(result.current.issuesForObject('does-not-exist')).toHaveLength(0);
  });
});

describe('useProcessFlowAIProposal', () => {
  it('createProposal calls endpoint and sets activeProposal', async () => {
    const proposal = {
      id: 'ai-1',
      status: 'pending',
      prompt: 'add login step',
      summary: 'Added login',
      operations: [],
      risk_flags: [],
      validation_before: { valid: true, issue_count: 0 },
      validation_after: { valid: true, issue_count: 0 },
      readback_before: '',
      readback_after: '',
      created_at: '2026-04-11',
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => proposal });

    const { result } = renderHook(() => useProcessFlowAIProposal({ processId: 'p1' }));

    await act(async () => {
      await result.current.createProposal('add login step');
    });

    expect(result.current.activeProposal).toEqual(proposal);
    expect(result.current.isGenerating).toBe(false);
  });

  it('resolveProposal clears activeProposal', async () => {
    const proposal = {
      id: 'ai-1',
      status: 'pending',
      prompt: 'test',
      summary: 'Test',
      operations: [],
      risk_flags: [],
      validation_before: { valid: true, issue_count: 0 },
      validation_after: { valid: true, issue_count: 0 },
      readback_before: '',
      readback_after: '',
      created_at: '2026-04-11',
    };
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => proposal })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useProcessFlowAIProposal({ processId: 'p1' }));

    await act(async () => {
      await result.current.createProposal('test');
    });
    expect(result.current.activeProposal).toBeTruthy();

    await act(async () => {
      await result.current.resolveProposal('accept');
    });
    expect(result.current.activeProposal).toBeNull();
  });

  it('dismiss clears activeProposal without API call', async () => {
    const proposal = {
      id: 'ai-1',
      status: 'pending',
      prompt: 'test',
      summary: 'Test',
      operations: [],
      risk_flags: [],
      validation_before: { valid: true, issue_count: 0 },
      validation_after: { valid: true, issue_count: 0 },
      readback_before: '',
      readback_after: '',
      created_at: '2026-04-11',
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => proposal });

    const { result } = renderHook(() => useProcessFlowAIProposal({ processId: 'p1' }));
    await act(async () => {
      await result.current.createProposal('test');
    });

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.activeProposal).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only the create call
  });
});

describe('useProcessFlowReadback (client-side)', () => {
  it('fetchReadback computes a traversal locally without any fetch', async () => {
    const { result } = renderHook(() =>
      useProcessFlowReadback({ processId: 'p1', nodes: [startNode, endNode], edges: [edge1] })
    );

    await act(async () => {
      await result.current.fetchReadback();
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.paths[0].type).toBe('start');
  });

  it('does nothing when processId is null', async () => {
    const { result } = renderHook(() =>
      useProcessFlowReadback({ processId: null, nodes: [], edges: [] })
    );
    await act(async () => {
      await result.current.fetchReadback();
    });
    expect(result.current.result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('useProcessFlowExport (client-side JSON/readback, PNG untouched)', () => {
  it('exports JSON without any fetch (serializes in-memory graph)', async () => {
    const canvasRef = { current: null };
    const { result } = renderHook(() =>
      useProcessFlowExport({
        processId: 'p1',
        canvasRef: canvasRef as RefObject<HTMLDivElement | null>,
        nodes: [startNode, endNode],
        edges: [edge1],
        lanes: [{ id: 'l1', label: 'Lane 1' }],
        flowMode: 'classic',
        semanticKit: 'classic',
      })
    );

    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await act(async () => {
      await result.current.exportAs('json');
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('exports readback-text without any fetch', async () => {
    const canvasRef = { current: null };
    const { result } = renderHook(() =>
      useProcessFlowExport({
        processId: 'p1',
        canvasRef: canvasRef as RefObject<HTMLDivElement | null>,
        nodes: [startNode, endNode],
        edges: [edge1],
        lanes: [],
        flowMode: 'classic',
        semanticKit: 'classic',
      })
    );

    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await act(async () => {
      await result.current.exportAs('readback');
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalled();

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});
