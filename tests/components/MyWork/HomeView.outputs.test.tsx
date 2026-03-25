import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeView } from '../../../src/components/MyWork/Home/HomeView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

const useHomeDataMock = vi.fn();
vi.mock('../../../src/components/MyWork/Home/useHomeData', () => ({
  useHomeData: (...args: unknown[]) => useHomeDataMock(...args),
}));

const useV8MyWorkRoofSummaryMock = vi.fn();
vi.mock('../../../src/hooks/useV8MyWorkRoof', () => ({
  useV8MyWorkRoofSummary: (...args: unknown[]) => useV8MyWorkRoofSummaryMock(...args),
}));

vi.mock('../../../src/components/MyWork/Home/AIPulseCore', () => ({
  AIPulseCore: ({ block, onAction }: any) => (
    <button
      type="button"
      onClick={() =>
        onAction({
          type: 'chat',
          packet: {
            sourceBlock: block.id,
            intent: 'prioritize_transformation',
            title: block.title,
            starterPrompt: 'Test prompt',
          },
        })
      }
    >
      open {block.title}
    </button>
  ),
}));

vi.mock('../../../src/components/MyWork/Home/MomentumBlock', () => ({
  MomentumBlock: ({ block }: any) => <div>{block.title}</div>,
}));

vi.mock('../../../src/components/MyWork/Home/SparkField', () => ({
  SparkField: ({ block }: any) => <div>{block.title}</div>,
}));

vi.mock('../../../src/components/MyWork/Home/DecisionTemperatureBlock', () => ({
  DecisionTemperatureBlock: ({ block }: any) => <div>{block.title}</div>,
}));

vi.mock('../../../src/components/MyWork/Home/IndustryLensBlock', () => ({
  IndustryLensBlock: ({ block }: any) => <div>{block.title}</div>,
}));

vi.mock('../../../src/components/MyWork/Home/ExecutionCurrentBlock', () => ({
  ExecutionCurrentBlock: ({ block, onAction }: any) => (
    <button type="button" onClick={() => onAction({ type: 'navigate', target: 'outputs_review' })}>
      open {block.title}
    </button>
  ),
}));

vi.mock('../../../src/components/MyWork/Home/TeamSignalBlock', () => ({
  TeamSignalBlock: ({ block }: any) => <div>{block.title}</div>,
}));

vi.mock('../../../src/components/MyWork/Home/CommandDock', () => ({
  CommandDock: ({ block, onAction }: any) => (
    <button type="button" onClick={() => onAction({ type: 'create', target: 'idea' })}>
      open {block.title}
    </button>
  ),
}));

const homeBlocks = [
  { id: 'aiPulseCore', title: 'AI Pulse Core' },
  { id: 'momentum', title: 'Momentum' },
  { id: 'sparkField', title: 'Spark Field' },
  { id: 'decisionTemperature', title: 'Decision Temperature' },
  { id: 'industryLens', title: 'Industry Lens' },
  { id: 'executionCurrent', title: 'Execution Current' },
  { id: 'teamSignal', title: 'Team Signal' },
  { id: 'commandDock', title: 'Command Dock' },
].map((block) => ({
  ...block,
  accent: 'neutral' as const,
  size: 'lg' as const,
  priorityWeight: 80,
  relevanceScore: 80,
  freshnessScore: 80,
  ctaIntents: [],
  payload: {},
}));

describe('HomeView aggregated contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHomeDataMock.mockReturnValue({
      screen: {
        timeMode: 'liveDay',
        updatedAt: '2026-03-25T05:00:00.000Z',
        pulseLabel: 'Transformation pulse is rising',
        blocks: homeBlocks,
      },
      blocks: homeBlocks,
      layout: {
        ambientMotion: 'full',
        blockLayouts: homeBlocks.map((block) => ({ blockId: block.id, visible: true })),
      },
      loading: false,
      error: null,
      updateLayout: vi.fn(),
    });

    useV8MyWorkRoofSummaryMock.mockReturnValue({
      data: {
        overallStatus: 'mixed_truth',
        surfaceMode: 'home_v2_aggregated_with_outputs_bridge',
        counts: {
          backed_by_real_service: 2,
          partial_stitched: 2,
          placeholder_non_canonical: 4,
        },
        homeBlocks: [
          { blockName: 'aiPulseCore', maturityLevel: 'backed_by_real_service' },
          { blockName: 'industryLens', maturityLevel: 'backed_by_real_service' },
          { blockName: 'executionCurrent', maturityLevel: 'partial_stitched' },
          { blockName: 'commandDock', maturityLevel: 'partial_stitched' },
        ],
      },
      isLoading: false,
      isError: false,
    });
  });

  it('renders the aggregated home contract with roof truth and block orchestration', () => {
    render(<HomeView onAction={vi.fn()} />);

    expect(screen.getByText('Transformation pulse is rising')).toBeInTheDocument();
    expect(screen.getByText(/Roof truth:/)).toBeInTheDocument();
    expect(screen.getByText(/Home V2 aggregated \+ outputs bridge/)).toBeInTheDocument();
    expect(screen.getAllByText('AI Pulse Core').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Industry Lens').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Execution Current').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Command Dock').length).toBeGreaterThan(0);
    expect(screen.getByText('Momentum')).toBeInTheDocument();
    expect(screen.getByText('Spark Field')).toBeInTheDocument();
    expect(screen.getByText('Decision Temperature')).toBeInTheDocument();
    expect(screen.getByText('Team Signal')).toBeInTheDocument();
  });

  it('passes home actions through to the My Work hub contract', () => {
    const onAction = vi.fn();
    render(<HomeView onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'open AI Pulse Core' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'chat',
      packet: {
        sourceBlock: 'aiPulseCore',
        intent: 'prioritize_transformation',
        title: 'AI Pulse Core',
        starterPrompt: 'Test prompt',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'open Execution Current' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'navigate',
      target: 'outputs_review',
    });

    fireEvent.click(screen.getByRole('button', { name: 'open Command Dock' }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'create',
      target: 'idea',
    });
  });
});
