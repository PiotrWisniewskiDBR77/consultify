import type { RefObject } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

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

describe('useProcessFlowValidation', () => {
  it('validate calls backend and stores result', async () => {
    const validationResult = { valid: true, issues: [], validated_at: '2026-04-11T00:00:00Z' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: validationResult }) });

    const { result } = renderHook(() =>
      useProcessFlowValidation({ processId: 'p1', nodes: [], edges: [], autoValidate: false })
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.result).toEqual(validationResult);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v8/process-flow/p1/validate',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('issuesForObject filters by object_id', async () => {
    const validationResult = {
      valid: false,
      issues: [
        { layer: 'semantic_first', severity: 'error', object_id: 'n1', rule: 'r1', message: 'err' },
        { layer: 'semantic_first', severity: 'warning', object_id: 'n2', rule: 'r2', message: 'warn' },
      ],
      validated_at: '2026-04-11T00:00:00Z',
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: validationResult }) });

    const { result } = renderHook(() =>
      useProcessFlowValidation({ processId: 'p1', nodes: [], edges: [], autoValidate: false })
    );

    await act(async () => {
      await result.current.validate();
    });

    expect(result.current.issuesForObject('n1')).toHaveLength(1);
    expect(result.current.issuesForObject('n2')).toHaveLength(1);
    expect(result.current.issuesForObject('n3')).toHaveLength(0);
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

describe('useProcessFlowReadback', () => {
  it('fetchReadback gets readback data', async () => {
    const readback = { paths: [{ type: 'start', label: 'Begin', object_id: 's1' }], warnings: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => readback });

    const { result } = renderHook(() => useProcessFlowReadback({ processId: 'p1' }));

    await act(async () => {
      await result.current.fetchReadback();
    });

    expect(result.current.result).toEqual(readback);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v8/process-flow/p1/readback',
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it('does nothing when processId is null', async () => {
    const { result } = renderHook(() => useProcessFlowReadback({ processId: null }));
    await act(async () => {
      await result.current.fetchReadback();
    });
    expect(result.current.result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('useProcessFlowExport', () => {
  it('exports JSON format', async () => {
    const exportData = { nodes: [], edges: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => exportData });

    const canvasRef = { current: null };
    const { result } = renderHook(() =>
      useProcessFlowExport({ processId: 'p1', canvasRef: canvasRef as RefObject<HTMLDivElement | null> })
    );

    // We can't fully test download behavior in jsdom, but we can verify the fetch
    await act(async () => {
      await result.current.exportAs('json');
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v8/process-flow/p1/export/json',
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });
});
