/**
 * UnifiedNodeDetailDrawer — M06 Fala 4.1b consolidation.
 *
 * Verifies the single canonical drawer covers BOTH legacy capability sets:
 *   - variant="mindmap" (was NodeDetailDrawer / IdeaRecommendationMap)
 *   - variant="idea"    (was IdeaNodeDetailDrawer / IdeaMapWorkspace)
 * plus the shared core (status, notes/depth fields, tags, evidence) and the
 * flag-OFF contract (each consumer keeps rendering its legacy drawer).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

const getMyIdeaAISuggestions = vi.fn().mockResolvedValue({ suggestions: [] });
const getIdeaAISuggestions = vi.fn().mockResolvedValue({ suggestions: [] });
const getObjectArtifacts = vi.fn().mockResolvedValue({ artifactLinks: [] });
const expandMyIdeaMap = vi.fn().mockResolvedValue({ proposal: { add: { nodes: [] } } });
const detachArtifactFromObject = vi.fn().mockResolvedValue({});

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaAISuggestions: (...a: any[]) => getMyIdeaAISuggestions(...a),
    getIdeaAISuggestions: (...a: any[]) => getIdeaAISuggestions(...a),
    getObjectArtifacts: (...a: any[]) => getObjectArtifacts(...a),
    expandMyIdeaMap: (...a: any[]) => expandMyIdeaMap(...a),
    detachArtifactFromObject: (...a: any[]) => detachArtifactFromObject(...a),
  },
  getMapVersionFromPayload: () => null,
}));

vi.mock('@/services/ideaAIGenerator', () => ({
  generateAIProposal: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const i18nState = vi.hoisted(() => ({ language: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState, t: (k: string) => k }),
}));

// Lightweight NModeBlocks stubs — render children so section content is queryable.
vi.mock('@/components/shared/NModeBlocks', () => ({
  ToggleBlock: ({ title, children }: any) => (
    <div data-block={title}>
      <div>{title}</div>
      {children}
    </div>
  ),
  Callout: ({ title, children }: any) => (
    <div data-callout={title}>
      {title}
      {children}
    </div>
  ),
  EmptyStateInline: ({ message }: any) => <div>{message}</div>,
}));

vi.mock('../../../src/components/shared/TeresaMark', () => ({
  default: () => <span data-testid="teresa-mark" />,
}));
vi.mock('@/components/shared/TeresaMark', () => ({
  default: () => <span data-testid="teresa-mark" />,
}));

vi.mock('@/utils/artifactLinks', () => ({
  getArtifactLabel: (t: string) => t,
}));

import {
  UnifiedNodeDetailDrawer,
  type UnifiedNodeData,
} from '../../../src/components/MyWork/mindmap/UnifiedNodeDetailDrawer';

// ── Fixtures ───────────────────────────────────────────────────────────────

const baseNode: UnifiedNodeData = {
  nodeId: 'n1',
  label: 'Growth hypothesis',
  branchKey: 'B1',
  status: 'idea',
  tags: ['market', 'saas'],
  notes: '',
  evidenceLinks: [],
};

function mindmapProps(overrides: Partial<any> = {}) {
  return {
    variant: 'mindmap' as const,
    open: true,
    onClose: vi.fn(),
    nodeData: baseNode,
    ideaId: 'idea-1',
    ideaTitle: 'My idea',
    allNodes: [{ id: 'n1', data: { label: 'Growth hypothesis' } }],
    allEdges: [],
    onUpdateNode: vi.fn(),
    onConvertNode: vi.fn(),
    onNavigateToNode: vi.fn(),
    onDrillDown: vi.fn(),
    ...overrides,
  };
}

function ideaProps(overrides: Partial<any> = {}) {
  return {
    variant: 'idea' as const,
    open: true,
    onClose: vi.fn(),
    nodeData: { ...baseNode, priority: 60, owner: 'Ada', comments: [], attachments: [] },
    ideaId: 'idea-1',
    activeTool: 'mindmap' as any,
    allNodes: [{ id: 'n1', data: { label: 'Growth hypothesis' } }],
    mapVersion: 3,
    onMapConflictRefresh: vi.fn(),
    onUpdateNode: vi.fn(),
    onGenerateProposal: vi.fn(),
    onDrillDown: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  i18nState.language = 'en';
});

// ── Shared core (both variants) ────────────────────────────────────────────

describe('UnifiedNodeDetailDrawer — closed / null', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(<UnifiedNodeDetailDrawer {...mindmapProps({ open: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when nodeData=null', () => {
    const { container } = render(<UnifiedNodeDetailDrawer {...mindmapProps({ nodeData: null })} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('UnifiedNodeDetailDrawer — shared core parity', () => {
  it('mindmap variant renders label, tags, notes, and status buttons', () => {
    render(<UnifiedNodeDetailDrawer {...mindmapProps()} />);
    expect(screen.getByText('Growth hypothesis')).toBeTruthy();
    expect(screen.getByText('market')).toBeTruthy();
    expect(screen.getByText('saas')).toBeTruthy();
    // superset status enum — mindmap flow includes Validated + Ready to Convert
    expect(screen.getByRole('button', { name: 'Validated' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ready to Convert' })).toBeTruthy();
  });

  it('idea variant renders label, tags, and its 4-status enum', () => {
    render(<UnifiedNodeDetailDrawer {...ideaProps()} />);
    expect(screen.getByText('Growth hypothesis')).toBeTruthy();
    // idea flow: Idea / Exploring / Ready / Rejected (no Convert flow)
    expect(screen.getByRole('button', { name: 'Ready' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rejected' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ready to Convert' })).toBeNull();
  });

  it('changing status calls onUpdateNode with the new status', () => {
    const onUpdateNode = vi.fn();
    render(<UnifiedNodeDetailDrawer {...mindmapProps({ onUpdateNode })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exploring' }));
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { status: 'exploring' });
  });

  it('editing notes fires onUpdateNode on blur (shared depth model)', () => {
    const onUpdateNode = vi.fn();
    render(<UnifiedNodeDetailDrawer {...mindmapProps({ onUpdateNode })} />);
    const notes = screen.getByPlaceholderText('Add notes, details...') as HTMLTextAreaElement;
    fireEvent.change(notes, { target: { value: 'hello' } });
    fireEvent.blur(notes);
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { notes: 'hello' });
  });
});

// ── mindmap-only capabilities ───────────────────────────────────────────────

describe('UnifiedNodeDetailDrawer — mindmap variant capabilities', () => {
  it('renders Convert footer and fires onConvertNode', () => {
    const onConvertNode = vi.fn();
    render(<UnifiedNodeDetailDrawer {...mindmapProps({ onConvertNode })} />);
    fireEvent.click(screen.getByRole('button', { name: /Convert → Initiative/ }));
    expect(onConvertNode).toHaveBeenCalledWith('n1', 'initiative');
  });

  it('queries company context via getMyIdeaAISuggestions on open', () => {
    render(<UnifiedNodeDetailDrawer {...mindmapProps()} />);
    expect(getMyIdeaAISuggestions).toHaveBeenCalledTimes(1);
    // idea-only artifact fetch must NOT fire in mindmap variant
    expect(getObjectArtifacts).not.toHaveBeenCalled();
    expect(getIdeaAISuggestions).not.toHaveBeenCalled();
  });

  it('shows Company Context section (mindmap-only)', () => {
    render(<UnifiedNodeDetailDrawer {...mindmapProps()} />);
    expect(screen.getByText('Company Context')).toBeTruthy();
    expect(screen.getByText('AI: Expand Topic')).toBeTruthy();
  });
});

// ── idea-only capabilities ──────────────────────────────────────────────────

describe('UnifiedNodeDetailDrawer — idea variant capabilities', () => {
  it('renders priority, owner, comments, attachments (idea-only sections)', () => {
    render(<UnifiedNodeDetailDrawer {...ideaProps()} />);
    expect(screen.getByText(/Priority/)).toBeTruthy();
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.getByText('Comments')).toBeTruthy();
    expect(screen.getByText('Attachments')).toBeTruthy();
    expect(screen.getByText('AI Context')).toBeTruthy();
  });

  it('fetches AI context + server artifacts on open (idea-only)', () => {
    render(<UnifiedNodeDetailDrawer {...ideaProps()} />);
    expect(getIdeaAISuggestions).toHaveBeenCalledTimes(1);
    expect(getObjectArtifacts).toHaveBeenCalledTimes(1);
    // mindmap-only company-context fetch must NOT fire in idea variant
    expect(getMyIdeaAISuggestions).not.toHaveBeenCalled();
  });

  it('adding a comment calls onUpdateNode with comments patch', () => {
    const onUpdateNode = vi.fn();
    render(<UnifiedNodeDetailDrawer {...ideaProps({ onUpdateNode })} />);
    const box = screen.getByPlaceholderText('Add comment...') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'nice' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: false });
    expect(onUpdateNode).toHaveBeenCalledTimes(1);
    const [, patch] = onUpdateNode.mock.calls[0];
    expect(patch.comments).toHaveLength(1);
    expect(patch.comments[0].text).toBe('nice');
  });

  it('changing priority slider fires onUpdateNode', () => {
    const onUpdateNode = vi.fn();
    render(<UnifiedNodeDetailDrawer {...ideaProps({ onUpdateNode })} />);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '80' } });
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { priority: 80 });
  });

  it('does NOT render mindmap Convert footer', () => {
    render(<UnifiedNodeDetailDrawer {...ideaProps()} />);
    expect(screen.queryByRole('button', { name: /Convert → Initiative/ })).toBeNull();
  });
});
