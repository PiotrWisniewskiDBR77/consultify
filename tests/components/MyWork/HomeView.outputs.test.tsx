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
  SparkField: ({ block }: any) => (
    <div>
      <div>{block.title}</div>
      <span>{block.payload?.runtimeSummary?.recentNotes}</span>
      <span>{block.payload?.runtimeSummary?.recentOutputs}</span>
    </div>
  ),
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

const homeBlocks = [
  { id: 'aiPulseCore', title: 'AI Pulse Core' },
  { id: 'industryLens', title: 'Industry Lens' },
  { id: 'sparkField', title: 'Spark Field' },
  { id: 'momentum', title: 'Momentum' },
  { id: 'decisionTemperature', title: 'Decision Temperature' },
  { id: 'executionCurrent', title: 'Execution Current' },
  { id: 'teamSignal', title: 'Team Signal' },
].map((block) => ({
  ...block,
  accent: 'neutral' as const,
  size: 'lg' as const,
  priorityWeight: 80,
  relevanceScore: 80,
  freshnessScore: 80,
  ctaIntents: [],
  payload:
    block.id === 'aiPulseCore'
      ? {
          headline: 'A calm storyline for your transformation week.',
          pulseScore: 72,
          focusItems: [],
          insight: '',
          greeting: 'Hello',
          summary: '',
          weekProgress: 0,
        }
      : block.id === 'sparkField'
        ? {
            runtimeSummary: {
              ideasWithTasks: 2,
              recentNotes: 4,
              recentOutputs: 3,
              orgSignals: 5,
            },
            ideas: [],
            notes: [],
            nudge: null,
          }
        : {},
}));

describe('HomeView aggregated contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const refresh = vi.fn();
    useHomeDataMock.mockReturnValue({
      screen: {
        timeMode: 'liveDay',
        updatedAt: '2026-03-25T05:00:00.000Z',
        pulseLabel: 'Radar · context, ideas, and a gentle steer — not an ops wall.',
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
      refresh,
    });

    useV8MyWorkRoofSummaryMock.mockReturnValue({
      data: {
        overallStatus: 'coherent',
        surfaceMode: 'home_v2_aggregated_with_outputs_bridge',
        counts: {
          backed_by_real_service: 7,
          partial_stitched: 0,
          placeholder_non_canonical: 0,
        },
        homeBlocks: [
          { blockName: 'aiPulseCore', maturityLevel: 'backed_by_real_service' },
          { blockName: 'industryLens', maturityLevel: 'backed_by_real_service' },
          { blockName: 'sparkField', maturityLevel: 'backed_by_real_service' },
          { blockName: 'momentum', maturityLevel: 'backed_by_real_service' },
          { blockName: 'decisionTemperature', maturityLevel: 'backed_by_real_service' },
          { blockName: 'executionCurrent', maturityLevel: 'backed_by_real_service' },
          { blockName: 'teamSignal', maturityLevel: 'backed_by_real_service' },
        ],
      },
      isLoading: false,
      isError: false,
    });
  });

  it('renders the aggregated home contract with roof truth and block orchestration', () => {
    render(<HomeView onAction={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Roof ·/ }));

    expect(screen.getByText(/Radar · context/)).toBeInTheDocument();
    expect(screen.getByText(/Roof truth:/)).toBeInTheDocument();
    expect(screen.getByText(/Home V2 aggregated \+ outputs bridge/)).toBeInTheDocument();
    expect(screen.getAllByText('AI Pulse Core').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Industry Lens').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Execution Current').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Momentum').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Spark Field').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Decision Temperature').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Team Signal').length).toBeGreaterThan(0);
    expect(screen.getByText('4')).toBeInTheDocument();
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
  });

  it('shows a retryable radar error state instead of a raw empty screen', () => {
    const refresh = vi.fn();
    useHomeDataMock.mockReturnValue({
      screen: {
        timeMode: 'liveDay',
        updatedAt: '2026-03-25T05:00:00.000Z',
        pulseLabel: '',
        blocks: [],
      },
      blocks: [],
      layout: {
        ambientMotion: 'full',
        blockLayouts: [],
      },
      loading: false,
      error: 'Home V2 unavailable. Please try again in a moment.',
      updateLayout: vi.fn(),
      refresh,
    });

    render(<HomeView onAction={vi.fn()} />);

    expect(screen.getByText('Radar is temporarily unavailable.')).toBeInTheDocument();
    expect(
      screen.getByText('This does not mean the day is empty. Retry loading the home screen.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\+ Retry/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
