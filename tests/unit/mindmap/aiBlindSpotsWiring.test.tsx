/**
 * AIBlindSpotsDetector wiring — frontend must read the REAL backend contract of
 * POST /api/my-work/my-ideas/:id/map/gap-analysis (my-work.routes.ts):
 *
 *   { proposal: { add: { nodes: [{ id, data: { label, branchKey, ... } }], edges }, rationale } }
 *
 * Regression guard: the component used to read `res.gaps` (never returned by the
 * backend), so it burned an LLM call every ~60s and never displayed anything.
 * Also guards the polling fix: detection auto-runs at most ONCE per map open.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMyIdeaGapAnalysis: vi.fn(),
  },
}));

import { Api } from '@/services/api';
import { AIBlindSpotsDetector } from '@/components/MyWork/mindmap/AIBlindSpotsDetector';

const getGapAnalysis = vi.mocked(Api.getMyIdeaGapAnalysis);

/** 6 idea nodes (>=5 triggers auto-detect) + root + branch nodes (excluded from count). */
const NODES = [
  { id: 'root', data: { label: 'My idea' } },
  { id: 'branch-risks', data: { label: 'Risks', branchKey: 'risks' } },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `n-${i}`,
    data: { label: `Idea ${i}`, branchKey: 'options' },
  })),
];

const baseProps = {
  ideaId: 'idea-1',
  ideaTitle: 'My idea',
  nodes: NODES,
  edges: [] as Array<{ id: string; source: string; target: string }>,
  persistence: 'online',
  locked: false,
  onAddBlindSpot: vi.fn(),
};

/** Backend-shaped success payload (proposal.add.nodes + rationale). */
const PROPOSAL_RESPONSE = {
  proposal: {
    add: {
      nodes: [
        {
          id: 'gap-1',
          type: 'idea',
          position: { x: 220, y: 0 },
          data: { label: 'Compliance risks', branchKey: 'risks', nodeType: 'gap' },
        },
        {
          id: 'gap-2',
          type: 'idea',
          position: { x: 220, y: 70 },
          data: { label: 'Cost baseline', branchKey: 'evidence', nodeType: 'gap' },
        },
      ],
      edges: [{ id: 'edge-1', source: 'branch-risks', target: 'gap-1' }],
    },
    rationale: 'The map lacks risk and cost coverage.',
  },
};

/** Render + fire the one-shot auto-detect timer (3s) and flush the mocked API promise. */
const renderAndAutoDetect = async (props = baseProps) => {
  const utils = render(<AIBlindSpotsDetector {...props} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  return utils;
};

beforeEach(() => {
  vi.useFakeTimers();
  getGapAnalysis.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('AIBlindSpotsDetector — backend contract mapping', () => {
  it('renders gaps from {proposal:{add:{nodes},rationale}} (real backend shape)', async () => {
    getGapAnalysis.mockResolvedValue(PROPOSAL_RESPONSE);

    await renderAndAutoDetect();

    expect(getGapAnalysis).toHaveBeenCalledTimes(1);
    expect(getGapAnalysis).toHaveBeenCalledWith(
      'idea-1',
      expect.objectContaining({ seedText: 'My idea', language: 'en' })
    );

    // Panel auto-expands and shows the mapped gap labels + rationale.
    expect(screen.getByText('Compliance risks')).toBeTruthy();
    expect(screen.getByText('Cost baseline')).toBeTruthy();
    expect(screen.getByText('The map lacks risk and cost coverage.')).toBeTruthy();
  });

  it('passes mapped area/branchKey to onAddBlindSpot when a gap is added', async () => {
    const onAddBlindSpot = vi.fn();
    getGapAnalysis.mockResolvedValue(PROPOSAL_RESPONSE);

    await renderAndAutoDetect({ ...baseProps, onAddBlindSpot });

    const addButtons = screen.getAllByText('Add');
    fireEvent.click(addButtons[0]);

    expect(onAddBlindSpot).toHaveBeenCalledTimes(1);
    expect(onAddBlindSpot).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'gap-1',
        area: 'Compliance risks',
        branchKey: 'risks',
      })
    );
  });

  it('skips proposal nodes without a label instead of rendering blank rows', async () => {
    getGapAnalysis.mockResolvedValue({
      proposal: {
        add: {
          nodes: [
            { id: 'gap-1', data: { label: '', branchKey: 'risks' } },
            { id: 'gap-2', data: { label: 'Real gap', branchKey: 'options' } },
          ],
          edges: [],
        },
        rationale: '',
      },
    });

    await renderAndAutoDetect();

    expect(screen.getByText('Real gap')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy(); // header count = 1 visible spot
  });
});

describe('AIBlindSpotsDetector — empty / malformed responses', () => {
  it('shows an honest empty state (no crash) when the proposal is empty', async () => {
    getGapAnalysis.mockResolvedValue({
      proposal: { add: { nodes: [], edges: [] }, rationale: '' },
    });

    await renderAndAutoDetect();

    expect(getGapAnalysis).toHaveBeenCalledTimes(1);
    expect(screen.getByText('No blind spots found')).toBeTruthy();
  });

  it('does not crash on a malformed response (missing proposal)', async () => {
    getGapAnalysis.mockResolvedValue({ gaps: [] } as any);

    await renderAndAutoDetect();

    expect(getGapAnalysis).toHaveBeenCalledTimes(1);
    expect(screen.getByText('No blind spots found')).toBeTruthy();
  });

  it('empty state is dismissible and does not re-trigger detection', async () => {
    getGapAnalysis.mockResolvedValue({
      proposal: { add: { nodes: [], edges: [] }, rationale: '' },
    });

    const { container } = await renderAndAutoDetect();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(container.firstChild).toBeNull();
    expect(getGapAnalysis).toHaveBeenCalledTimes(1);
  });
});

describe('AIBlindSpotsDetector — no background polling', () => {
  it('auto-detects at most once per mount, even as the map keeps changing', async () => {
    getGapAnalysis.mockResolvedValue(PROPOSAL_RESPONSE);

    const { rerender } = await renderAndAutoDetect();
    expect(getGapAnalysis).toHaveBeenCalledTimes(1);

    // Simulate ongoing editing: node count changes + lots of time passing.
    for (let i = 0; i < 3; i++) {
      rerender(
        <AIBlindSpotsDetector
          {...baseProps}
          nodes={[
            ...NODES,
            { id: `extra-${i}`, data: { label: `Extra ${i}`, branchKey: 'options' } },
          ]}
        />
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });
    }

    expect(getGapAnalysis).toHaveBeenCalledTimes(1);
  });

  it('does not auto-detect when offline or with too few nodes', async () => {
    getGapAnalysis.mockResolvedValue(PROPOSAL_RESPONSE);

    await renderAndAutoDetect({ ...baseProps, persistence: 'local' });
    expect(getGapAnalysis).not.toHaveBeenCalled();

    await renderAndAutoDetect({
      ...baseProps,
      nodes: [
        { id: 'root', data: { label: 'My idea' } },
        { id: 'n-0', data: { label: 'Only one', branchKey: 'options' } },
      ],
    });
    expect(getGapAnalysis).not.toHaveBeenCalled();
  });
});
