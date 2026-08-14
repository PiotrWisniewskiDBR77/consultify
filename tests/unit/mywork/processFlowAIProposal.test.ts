/**
 * M07 F2 — useProcessFlowAIProposal (real backend wiring).
 * Spec coverage: hook calls generateAIProposal with the right body
 * (generatorType by selection), maps the batch to panel state (before/after
 * from validateFlow/generateReadback), HTTP error → clear message without a
 * crash, accept applies via onApply / reject mutates nothing.
 */
import { act, renderHook } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProcessFlowAIProposal } from '../../../src/components/MyWork/processflow/useProcessFlowAIProposal';
import type { Lane } from '../../../src/components/MyWork/processflow/useProcessFlowNodes';

const generateAIProposalMock = vi.fn();

vi.mock('@/services/ideaAIGenerator', () => ({
  generateAIProposal: (...args: unknown[]) => generateAIProposalMock(...args),
}));

vi.mock('@/i18n', () => ({
  default: {
    t: (key: string, defaultValue: string, options?: Record<string, unknown>) => {
      const template =
        key === 'processFlow.aiProposal.errorGenerate' && options?.lng === 'pl'
          ? 'Nie udało się wygenerować propozycji AI. Spróbuj ponownie.'
          : defaultValue;
      return Object.entries(options ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
        template
      );
    },
  },
}));

const lanes: Lane[] = [{ id: 'lane-1', label: 'Main Process', color: '#e0e7ff' }];

const nodes: Node[] = [
  {
    id: 'n-start',
    type: 'flowNode',
    position: { x: 0, y: 0 },
    data: { shape: 'start', label: 'Start', laneId: 'lane-1' },
  },
  {
    id: 'n-end',
    type: 'flowNode',
    position: { x: 400, y: 0 },
    data: { shape: 'end', label: 'End', laneId: 'lane-1' },
  },
];

const edges: Edge[] = [{ id: 'e1', source: 'n-start', target: 'n-end' }];

function batchWith(patch: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    id: 'batch-1',
    tool: 'process_flow',
    generatorType: 'flow_generator',
    createdAt: Date.now(),
    proposals: [
      {
        id: 'prop-1',
        type: 'graph_patch',
        rationale: 'Add a review step between start and end',
        confidence: 0.82,
        status: 'pending',
        patch,
        ...overrides,
      },
    ],
  };
}

function renderProposalHook(extra: Partial<Parameters<typeof useProcessFlowAIProposal>[0]> = {}) {
  return renderHook(() =>
    useProcessFlowAIProposal({
      ideaId: 'idea-1',
      nodes,
      edges,
      lanes,
      semanticKit: 'classic' as never,
      isPl: false,
      language: 'en',
      ...extra,
    })
  );
}

beforeEach(() => {
  generateAIProposalMock.mockReset();
});

describe('useProcessFlowAIProposal — request body (decision 2)', () => {
  it('uses flow_generator with prompt as seedText when nothing is selected', async () => {
    generateAIProposalMock.mockResolvedValueOnce(
      batchWith({ addNodes: [{ id: 'n-new', label: 'Review' }] })
    );

    const { result } = renderProposalHook({ selectedNodeIds: [] });

    await act(async () => {
      await result.current.createProposal('add a review step');
    });

    expect(generateAIProposalMock).toHaveBeenCalledTimes(1);
    const body = generateAIProposalMock.mock.calls[0][0];
    expect(body.ideaId).toBe('idea-1');
    expect(body.generatorType).toBe('flow_generator');
    expect(body.tool).toBe('process_flow');
    expect(body.context.seedText).toBe('add a review step');
    expect(body.context.existingNodes).toHaveLength(2);
    expect(body.context.existingNodes[0]).toEqual({
      id: 'n-start',
      data: { label: 'Start', shape: 'start', laneId: 'lane-1' },
    });
    expect(body.context.existingLanes).toEqual(lanes);
    expect(body.context.language).toBe('en');
    expect(body.context.selection).toBeUndefined();
  });

  it('uses node_expand with selection.primaryId when exactly one node is selected', async () => {
    generateAIProposalMock.mockResolvedValueOnce(
      batchWith({ addNodes: [{ id: 'n-sub', label: 'Substep' }] })
    );

    const { result } = renderProposalHook({ selectedNodeIds: ['n-start'] });

    await act(async () => {
      await result.current.createProposal('break this down');
    });

    const body = generateAIProposalMock.mock.calls[0][0];
    expect(body.generatorType).toBe('node_expand');
    expect(body.context.selection).toEqual({
      type: 'node',
      count: 1,
      ids: ['n-start'],
      primaryId: 'n-start',
    });
  });

  it('falls back to flow_generator for multi-selection', async () => {
    generateAIProposalMock.mockResolvedValueOnce(batchWith({ addNodes: [] }));

    const { result } = renderProposalHook({ selectedNodeIds: ['n-start', 'n-end'] });

    await act(async () => {
      await result.current.createProposal('connect these');
    });

    expect(generateAIProposalMock.mock.calls[0][0].generatorType).toBe('flow_generator');
  });

  it('does nothing without ideaId or with a blank prompt', async () => {
    const { result } = renderProposalHook({ ideaId: null });
    await act(async () => {
      await result.current.createProposal('x');
    });

    const { result: result2 } = renderProposalHook();
    await act(async () => {
      await result2.current.createProposal('   ');
    });

    expect(generateAIProposalMock).not.toHaveBeenCalled();
  });
});

describe('useProcessFlowAIProposal — batch → panel state (decision 4)', () => {
  it('maps the proposal into panel view-model with before/after validation and readback', async () => {
    generateAIProposalMock.mockResolvedValueOnce(
      batchWith({
        addNodes: [{ id: 'n-review', label: 'Review', data: { shape: 'action' } }],
        addEdges: [{ id: 'e-r', source: 'n-start', target: 'n-review' }],
      })
    );

    const { result } = renderProposalHook();

    await act(async () => {
      await result.current.createProposal('add review');
    });

    const proposal = result.current.activeProposal;
    expect(proposal).toBeTruthy();
    expect(proposal?.id).toBe('prop-1');
    expect(proposal?.status).toBe('pending');
    expect(proposal?.summary).toBe('Add a review step between start and end');
    expect(proposal?.confidence).toBe(0.82);
    expect(proposal?.operations).toEqual([
      { action: 'create', target_id: 'n-review', params: { label: 'Review' } },
      {
        action: 'connect',
        target_id: 'e-r',
        params: { source: 'n-start', target: 'n-review' },
      },
    ]);
    // before: clean 2-node flow; after: n-review has no outgoing edge
    expect(proposal?.validation_before.issue_count).toBe(0);
    expect(proposal?.validation_after.issue_count).toBeGreaterThan(0);
    expect(proposal?.readback_before).toContain('Start');
    expect(proposal?.readback_after).toContain('Review');
    // ghost preview only for added nodes
    expect(proposal?.previewNodes?.map((n) => n.id)).toEqual(['proposal-ghost-n-review']);
    expect(proposal?.previewNodes?.[0]?.data._isGhost).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });

  it('surfaces lane-fallback warnings as risk flags (decision 3)', async () => {
    generateAIProposalMock.mockResolvedValueOnce(
      batchWith({
        addNodes: [{ id: 'n-x', label: 'X', data: { laneId: 'lane-unknown' } }],
      })
    );

    const { result } = renderProposalHook();

    await act(async () => {
      await result.current.createProposal('add x');
    });

    expect(result.current.activeProposal?.risk_flags).toHaveLength(1);
    expect(result.current.activeProposal?.risk_flags[0]).toContain('lane-unknown');
  });

  it('sets a clear error when the batch has no applicable graph_patch proposal', async () => {
    generateAIProposalMock.mockResolvedValueOnce({
      id: 'batch-x',
      tool: 'process_flow',
      generatorType: 'flow_generator',
      createdAt: Date.now(),
      proposals: [],
    });

    const { result } = renderProposalHook();

    await act(async () => {
      await result.current.createProposal('do nothing');
    });

    expect(result.current.activeProposal).toBeNull();
    expect(result.current.error).toMatch(/no change proposal/i);
  });

  it('handles HTTP errors with a clear message and no crash', async () => {
    generateAIProposalMock.mockRejectedValueOnce(new Error('HTTP 502: upstream timeout'));

    const { result } = renderProposalHook();

    await act(async () => {
      await result.current.createProposal('add step');
    });

    expect(result.current.error).toBe('HTTP 502: upstream timeout');
    expect(result.current.activeProposal).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });
});

describe('useProcessFlowAIProposal — resolve locally (decision 5)', () => {
  it('accept applies the patch to the current graph via onApply and clears the proposal', async () => {
    const onApply = vi.fn();
    generateAIProposalMock.mockResolvedValueOnce(
      batchWith({
        addNodes: [{ id: 'n-review', label: 'Review' }],
        addEdges: [{ id: 'e-r', source: 'n-start', target: 'n-review' }],
      })
    );

    const { result } = renderProposalHook({ onApply });

    await act(async () => {
      await result.current.createProposal('add review');
    });
    expect(result.current.activeProposal).toBeTruthy();

    act(() => {
      result.current.resolveProposal('accept');
    });

    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0][0];
    expect(applied.addedNodeIds).toEqual(['n-review']);
    expect(applied.nodes.map((n: Node) => n.id)).toContain('n-review');
    expect(applied.edges.map((e: Edge) => e.id)).toContain('e-r');
    expect(result.current.activeProposal).toBeNull();
  });

  it('reject clears the proposal WITHOUT applying anything', async () => {
    const onApply = vi.fn();
    generateAIProposalMock.mockResolvedValueOnce(
      batchWith({ addNodes: [{ id: 'n-review', label: 'Review' }] })
    );

    const { result } = renderProposalHook({ onApply });

    await act(async () => {
      await result.current.createProposal('add review');
    });

    act(() => {
      result.current.resolveProposal('reject');
    });

    expect(onApply).not.toHaveBeenCalled();
    expect(result.current.activeProposal).toBeNull();
  });

  it('dismiss clears proposal and error', async () => {
    generateAIProposalMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderProposalHook();

    await act(async () => {
      await result.current.createProposal('x');
    });
    expect(result.current.error).toBe('boom');

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.activeProposal).toBeNull();
  });

  it('localizes error copy to Polish when isPl and no server message', async () => {
    generateAIProposalMock.mockRejectedValueOnce(new Error(''));
    const { result } = renderProposalHook({ isPl: true, language: 'pl' });

    await act(async () => {
      await result.current.createProposal('dodaj krok');
    });

    expect(result.current.error).toMatch(/Nie udało się wygenerować/);
  });
});
