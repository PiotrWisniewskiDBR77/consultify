/**
 * A2 — whiteboard facilitation actions in IdeaCanvasContextMenu.
 *
 * The context menu is the entry point for the wb_* AI generators: clicking an
 * item calls generateAIProposal with the matching generatorType and hands the
 * batch to onGenerateProposal (which opens IdeaProposalReview — preview→apply).
 * Items are whiteboard-only: they must not leak into other canvas tools.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateAIProposal = vi.fn();
vi.mock('@/services/ideaAIGenerator', () => ({
  generateAIProposal: (...a: any[]) => generateAIProposal(...a),
}));

vi.mock('@/services/api', () => ({ Api: {} }));

const i18nState = vi.hoisted(() => ({ language: 'en' }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState, t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { IdeaCanvasContextMenu } from '@/components/MyWork/IdeaCanvasContextMenu';

const BATCH = {
  id: 'batch-1',
  tool: 'whiteboard',
  generatorType: 'wb_find_themes',
  proposals: [],
  createdAt: 1,
};

function baseProps(overrides: Partial<React.ComponentProps<typeof IdeaCanvasContextMenu>> = {}) {
  return {
    position: { x: 10, y: 10 },
    target: {},
    onClose: vi.fn(),
    ideaId: 'idea-1',
    activeTool: 'whiteboard' as any,
    title: 'Board title',
    seedText: 'Board seed',
    branch: '',
    area: '',
    graphNodes: [{ id: 'sticky-1', data: { label: 'Note' } }],
    graphEdges: [],
    isAccepted: true,
    onGenerateProposal: vi.fn(),
    ...overrides,
  };
}

describe('IdeaCanvasContextMenu — wb_* AI actions (A2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = 'en';
    generateAIProposal.mockResolvedValue(BATCH);
  });

  it('shows the three selection actions on a whiteboard node', () => {
    render(
      <IdeaCanvasContextMenu
        {...baseProps({ target: { nodeId: 'sticky-1', nodeLabel: 'Note' } })}
      />
    );

    expect(screen.getByText('AI: Find themes')).toBeInTheDocument();
    expect(screen.getByText('AI: Name clusters')).toBeInTheDocument();
    expect(screen.getByText('AI: Extract actions')).toBeInTheDocument();
  });

  it('shows the two cross-tool conversions on empty whiteboard canvas', () => {
    render(<IdeaCanvasContextMenu {...baseProps()} />);

    expect(screen.getByText('AI: Convert to mind map')).toBeInTheDocument();
    expect(screen.getByText('AI: Convert to table')).toBeInTheDocument();
  });

  it('hides whiteboard-only actions on other canvas tools', () => {
    render(
      <IdeaCanvasContextMenu
        {...baseProps({
          activeTool: 'mindmap' as any,
          target: { nodeId: 'n1', nodeLabel: 'Node' },
        })}
      />
    );
    expect(screen.queryByText('AI: Find themes')).not.toBeInTheDocument();
    expect(screen.queryByText('AI: Name clusters')).not.toBeInTheDocument();
    expect(screen.queryByText('AI: Extract actions')).not.toBeInTheDocument();
  });

  const CLICK_CASES: Array<{ label: string; generatorType: string; onNode: boolean }> = [
    { label: 'AI: Find themes', generatorType: 'wb_find_themes', onNode: true },
    { label: 'AI: Name clusters', generatorType: 'wb_name_clusters', onNode: true },
    { label: 'AI: Extract actions', generatorType: 'wb_extract_actions', onNode: true },
    { label: 'AI: Convert to mind map', generatorType: 'wb_to_map_branches', onNode: false },
    { label: 'AI: Convert to table', generatorType: 'wb_to_table', onNode: false },
  ];

  for (const { label, generatorType, onNode } of CLICK_CASES) {
    it(`click "${label}" → generateAIProposal(generatorType=${generatorType}) → onGenerateProposal(batch)`, async () => {
      const props = baseProps(
        onNode ? { target: { nodeId: 'sticky-1', nodeLabel: 'Note' } } : {}
      );
      render(<IdeaCanvasContextMenu {...props} />);

      fireEvent.click(screen.getByText(label));

      await waitFor(() => expect(generateAIProposal).toHaveBeenCalledTimes(1));
      const call = generateAIProposal.mock.calls[0][0];
      expect(call.generatorType).toBe(generatorType);
      expect(call.ideaId).toBe('idea-1');
      expect(call.tool).toBe('whiteboard');
      expect(call.context.existingNodes).toEqual(props.graphNodes);

      // Result goes to the review overlay (preview→apply) — never applied directly
      await waitFor(() => expect(props.onGenerateProposal).toHaveBeenCalledWith(BATCH));
      expect(props.onClose).toHaveBeenCalled();
    });
  }

  it('does not call the generator before the challenge is accepted', () => {
    render(<IdeaCanvasContextMenu {...baseProps({ isAccepted: false })} />);

    fireEvent.click(screen.getByText('AI: Convert to table'));

    expect(generateAIProposal).not.toHaveBeenCalled();
  });
});
