/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the "mindmap-i18n-smoke" runda 5 defect (odbiór
 * 2026-09-05): the un-docked drawer overlay (`fixed ... z-modal`, rendered
 * when the IDE-025 right-panel slot is unavailable) used to be returned
 * IN-TREE instead of portaled — so it stayed trapped inside whatever local
 * stacking context hosted the mindmap canvas and lost real mouse clicks to
 * the sibling `aside[data-testid=mels-element-inspector-rail]`
 * (position:relative, mounted by ExecutiveModuleShell) even though the
 * overlay carried `fixed z-modal`.
 *
 * Fix: `UnifiedNodeDetailDrawer` now always renders its non-docked overlay
 * through `createPortal(..., document.body)`, so the fixed/z-modal stacking
 * context is created at the top level, above any local sibling.
 *
 * This test proves the escape mechanically: it mounts the drawer nested
 * inside a local wrapper element (standing in for the mindmap canvas
 * container) and asserts the drawer's DOM node ends up OUTSIDE that wrapper
 * and directly under `document.body`.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) =>
      typeof fallback === 'string' ? fallback : String(fallback ?? _key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaAISuggestions: vi.fn(async () => ({ suggestions: [] })),
    getObjectArtifacts: vi.fn(async () => ({ artifactLinks: [] })),
  },
  getMapVersionFromPayload: vi.fn(() => 1),
}));

vi.mock('@/services/ideaAIGenerator', () => ({
  generateAIProposal: vi.fn(async () => ({})),
}));

vi.mock('@/actions/ideaActionRegistry', () => ({
  runIdeaAction: vi.fn(async () => ({})),
}));

import { UnifiedNodeDetailDrawer, type UnifiedNodeData } from '../UnifiedNodeDetailDrawer';

const baseNodeData: UnifiedNodeData = {
  nodeId: 'node-1',
  label: 'Automate invoice matching',
  status: 'idea',
  evidenceLinks: [],
};

describe('UnifiedNodeDetailDrawer — un-docked overlay escapes to document.body', () => {
  it('renders the drawer root outside a local wrapper and directly under document.body', async () => {
    // Stand in for the mindmap canvas container that, in production, sits
    // alongside `aside[data-testid=mels-element-inspector-rail]` inside
    // ExecutiveModuleShell. Nothing here sets up a real stacking-context
    // trap (jsdom has no layout) — the point is purely DOM placement: does
    // the drawer's node end up as a descendant of this wrapper (bug) or
    // does it escape via portal (fix)?
    const localWrapper = document.createElement('div');
    localWrapper.setAttribute('data-testid', 'local-mindmap-canvas-stand-in');
    document.body.appendChild(localWrapper);

    render(
      <UnifiedNodeDetailDrawer
        variant="mindmap"
        open
        onClose={vi.fn()}
        nodeData={baseNodeData}
        ideaId="idea-1"
        ideaTitle="Ops efficiency"
        allNodes={[{ id: 'node-1', data: baseNodeData }]}
        allEdges={[]}
        onUpdateNode={vi.fn()}
      />,
      { container: localWrapper }
    );

    const drawer = await screen.findByTestId('unified-node-detail-drawer');

    // Bug behaviour would be: drawer is a descendant of localWrapper (the
    // render container), because `tresc` was returned in-tree with no
    // portal. Fixed behaviour: the drawer escaped via createPortal and is
    // NOT inside the local wrapper at all.
    expect(localWrapper.contains(drawer)).toBe(false);

    // It must actually be reachable from the document (not just detached).
    expect(document.body.contains(drawer)).toBe(true);

    // And specifically portaled straight onto <body>, so its `fixed z-modal`
    // stacking context is created at the top level — not nested under any
    // intermediate element that could itself be trapped inside another
    // stacking context (e.g. a transformed ancestor).
    expect(drawer.parentElement).toBe(document.body);

    document.body.removeChild(localWrapper);
  });
});
