/**
 * #DEAD-ACTIONS — mindmapIntentDetector.ts (AIChat) fires mm_create /
 * mm_expand_branch / mm_apply_framework from free-text chat prompts (e.g.
 * "create a mind map about X", "expand this idea", "apply SWOT"), but
 * useMindMapQuickActions had no case for any of the three — the chat showed
 * "Working on mind map…" and nothing happened on the canvas.
 *
 * This test drives the hook exactly the way UnifiedChatPanel does: dispatch
 * `idea-workspace-quick-action` with { action, text } and assert the canvas
 * actually gets nodes/edges (or the real AI pipeline is invoked), not silence.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    updateMyIdea: vi.fn().mockResolvedValue({}),
  },
}));

import { Api } from '@/services/api';
import {
  useMindMapQuickActions,
  type MindMapQuickActionHandlers,
  type MindMapQuickActionSetters,
} from '@/components/MyWork/mindmap/useMindMapQuickActions';

function makeHandlers(): MindMapQuickActionHandlers {
  return {
    addChildNode: vi.fn(),
    addSiblingNode: vi.fn(),
    addRootTopic: vi.fn(),
    duplicateSelected: vi.fn(),
    deleteSelected: vi.fn(),
    getSelectedNode: vi.fn(() => undefined),
    toggleCollapse: vi.fn(),
    setFoldLevel: vi.fn(),
    focusSelectedNode: vi.fn(),
    reparentSelectedPromote: vi.fn(),
    reparentSelectedDemote: vi.fn(),
    pushUndo: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    handleAIExpand: vi.fn(),
    autoLayout: vi.fn((n) => n),
    fitView: vi.fn(),
    exportAsSVG: vi.fn(),
    exportAsPNG: vi.fn(),
    exportAsJSON: vi.fn(),
  };
}

function makeSetters(nodesRef: { current: any[] }, edgesRef: { current: any[] }): MindMapQuickActionSetters {
  return {
    setNodes: vi.fn((updater: any) => {
      nodesRef.current = typeof updater === 'function' ? updater(nodesRef.current) : updater;
    }),
    setEdges: vi.fn((updater: any) => {
      edgesRef.current = typeof updater === 'function' ? updater(edgesRef.current) : updater;
    }),
    setLayoutMode: vi.fn(),
    setShowClusterBubbles: vi.fn(),
    setHeatmapMode: vi.fn(),
    setParticleFlow: vi.fn(),
    setShowWhatIf: vi.fn(),
    setShowBatchConvert: vi.fn(),
    setShowTimeline: vi.fn(),
    setShowPresentation: vi.fn(),
    setShowSnapshots: vi.fn(),
    setShowVoiceToNode: vi.fn(),
    setShowDocToMap: vi.fn(),
    setShowInterviewToMap: vi.fn(),
    setShowDependencyDetector: vi.fn(),
    setShowPriorityRecommender: vi.fn(),
    setShowAutoClustering: vi.fn(),
    setShowSentimentOverlay: vi.fn(),
    setShowActivityFeed: vi.fn(),
    setShowHealthScore: vi.fn(),
    setShowFunnelAnalytics: vi.fn(),
    setShowExportPPTX: vi.fn(),
    setShowEmbedInReports: vi.fn(),
    setShowCompetitiveLandscape: vi.fn(),
    setShowBranchComparison: vi.fn(),
    setShowTimeHeatmap: vi.fn(),
    setShowExportDiagramCode: vi.fn(),
    setShowImportExternalMap: vi.fn(),
    setShowMindMap3D: vi.fn(),
    setCommentNodeId: vi.fn(),
  };
}

const ROOT_NODE = {
  id: 'root',
  type: 'root',
  position: { x: 400, y: 300 },
  data: { label: 'Central Idea', branchKey: 'root' },
};

function makeHarness(nodesRef: { current: any[] }, edgesRef: { current: any[] }, handlers: MindMapQuickActionHandlers) {
  const setters = makeSetters(nodesRef, edgesRef);
  const Harness: React.FC = () => {
    useMindMapQuickActions({
      ideaId: 'idea-1',
      ideaTitle: 'Test Idea',
      isPolish: false,
      locked: false,
      nodes: nodesRef.current,
      edges: edgesRef.current,
      layoutMode: 'tree',
      handlers,
      setters,
    });
    return null;
  };
  return { Harness, setters };
}

function dispatchQuickAction(action: string, text?: string) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('idea-workspace-quick-action', { detail: { action, text } })
    );
  });
}

describe('useMindMapQuickActions — dead chat actions (mm_create / mm_expand_branch / mm_apply_framework)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mm_expand_branch aliases to the same real AI-expand call as mm_ai_expand_branch', () => {
    const nodesRef = { current: [ROOT_NODE] };
    const edgesRef = { current: [] as any[] };
    const handlers = makeHandlers();
    const { Harness } = makeHarness(nodesRef, edgesRef, handlers);
    render(<Harness />);

    dispatchQuickAction('mm_expand_branch');

    expect(handlers.handleAIExpand).toHaveBeenCalledTimes(1);
  });

  it('mm_create seeds the idea body via Api.updateMyIdea, renames root, and triggers the real AI expand', async () => {
    const nodesRef = { current: [ROOT_NODE] };
    const edgesRef = { current: [] as any[] };
    const handlers = makeHandlers();
    const { Harness } = makeHarness(nodesRef, edgesRef, handlers);
    render(<Harness />);

    dispatchQuickAction('mm_create', 'create a mind map about Market Entry Strategy');

    // Root node label updated synchronously (immediate canvas feedback)
    const root = nodesRef.current.find((n) => n.id === 'root');
    expect(root.data.label).toBe('Market Entry Strategy');

    // Wait for the async updateMyIdea → handleAIExpand chain to flush
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(Api.updateMyIdea).toHaveBeenCalledWith(
      'idea-1',
      expect.objectContaining({ body: 'create a mind map about Market Entry Strategy' })
    );
    expect(handlers.handleAIExpand).toHaveBeenCalledTimes(1);
  });

  it('mm_apply_framework applies the real McKinsey 7S template (7 branch nodes + 7 edges) onto the canvas', () => {
    const nodesRef = { current: [ROOT_NODE] };
    const edgesRef = { current: [] as any[] };
    const handlers = makeHandlers();
    const { Harness } = makeHarness(nodesRef, edgesRef, handlers);
    render(<Harness />);

    dispatchQuickAction('mm_apply_framework', 'apply the McKinsey 7S framework here');

    expect(nodesRef.current.length).toBe(8); // root + 7 McKinsey 7S branches
    const labels = nodesRef.current.map((n) => n.data.label).sort();
    expect(labels).toEqual(
      ['Central Idea', 'Strategy', 'Structure', 'Systems', 'Shared Values', 'Skills', 'Style', 'Staff'].sort()
    );
    expect(edgesRef.current.length).toBe(7);
    edgesRef.current.forEach((e) => expect(e.source).toBe('root'));
  });

  it('mm_apply_framework applies the real PESTEL template (6 branch nodes) — catalog now covers PEST for real', () => {
    const nodesRef = { current: [ROOT_NODE] };
    const edgesRef = { current: [] as any[] };
    const handlers = makeHandlers();
    const { Harness } = makeHarness(nodesRef, edgesRef, handlers);
    render(<Harness />);

    dispatchQuickAction('mm_apply_framework', 'apply the PEST framework here');

    expect(nodesRef.current.length).toBe(7); // root + 6 PESTEL branches
    expect(edgesRef.current.length).toBe(6);
    edgesRef.current.forEach((e) => expect(e.source).toBe('root'));
  });

  it('mm_apply_framework falls back to a labeled starter node for SWOT — the #10-AB dedup retired the ' +
    'mindmap-tool mm-swot template (cx-swot replacement is whiteboard-tool, not usable here)', () => {
    const nodesRef = { current: [ROOT_NODE] };
    const edgesRef = { current: [] as any[] };
    const handlers = makeHandlers();
    const { Harness } = makeHarness(nodesRef, edgesRef, handlers);
    render(<Harness />);

    dispatchQuickAction('mm_apply_framework', 'apply SWOT to this');

    // Must not silently no-op just because the legacy template was retired.
    expect(nodesRef.current.length).toBe(2); // root + fallback node
    expect(edgesRef.current.length).toBe(1);
    const fallback = nodesRef.current.find((n) => n.id !== 'root');
    expect(fallback).toBeTruthy();
    expect(fallback.data.label).toBe('SWOT');
    expect(fallback.data.branchKey).toBe('framework');
  });
});
