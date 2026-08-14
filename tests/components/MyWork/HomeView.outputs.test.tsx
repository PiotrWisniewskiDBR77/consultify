import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeView } from '../../../src/components/MyWork/Home/HomeView';

vi.mock('i18next', () => ({
  default: {
    t: (_key: string, fallback?: string) => fallback || _key,
  },
}));

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  default: {
    error: toastErrorMock,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : undefined;
      const labels: Record<string, string> = {
        'myWork.radar.unavailable': 'Radar is temporarily unavailable.',
        'myWork.radar.unavailableHint':
          'This does not mean the day is empty. Retry loading the home screen.',
        'myWork.radar.retry': 'Retry',
        'myWork.radar.roofModules': 'Roof · 7 modules',
        'myWork.radar.roofExpandHint': 'Expand roof truth',
        'myWork.radar.explain': 'Explain',
        'myWork.radar.pulse': 'Pulse',
        'myWork.radar.loadErrorToast': 'Radar could not load. Showing recovery state.',
      };
      return labels[key] || fallback || key;
    },
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('framer-motion', () => {
  const stripMotionProps = (props: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (
        key === 'initial' ||
        key === 'animate' ||
        key === 'exit' ||
        key === 'transition' ||
        key === 'whileHover' ||
        key === 'whileTap' ||
        key === 'whileFocus' ||
        key === 'whileInView' ||
        key === 'variants' ||
        key === 'layout' ||
        key === 'layoutId'
      ) {
        continue;
      }
      cleaned[key] = props[key];
    }
    return cleaned;
  };
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = (props: Record<string, unknown> & { children?: React.ReactNode }) => {
          const { children, ...rest } = props;
          return React.createElement(tag, stripMotionProps(rest), children);
        };
        Component.displayName = `motion.${tag}`;
        return Component;
      },
    }
  );
  return { motion };
});

const useHomeDataMock = vi.fn();
vi.mock('../../../src/components/MyWork/Home/useHomeData', () => ({
  useHomeData: (...args: unknown[]) => useHomeDataMock(...args),
}));

const useRadarDataMock = vi.fn();
vi.mock('../../../src/components/MyWork/Home/useRadarData', () => ({
  useRadarData: (...args: unknown[]) => useRadarDataMock(...args),
}));

// The preview panel upgrades to an async Teresa AI briefing when a signal is
// opened. Pin it to the settled deterministic baseline so the panel renders the
// signal's preview copy (whyItMatters, etc.) synchronously instead of a shimmer.
vi.mock('../../../src/components/MyWork/Home/useRadarBriefing', () => ({
  useRadarBriefing: () => ({ briefing: null, loading: false }),
}));

const useV8MyWorkRoofSummaryMock = vi.fn();
vi.mock('../../../src/hooks/useV8MyWorkRoof', () => ({
  useV8MyWorkRoofSummary: (...args: unknown[]) => useV8MyWorkRoofSummaryMock(...args),
}));

vi.mock('@/providers/V8Provider', () => ({
  useV8: () => ({ isV8Enabled: true }),
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    listInsights: vi.fn().mockResolvedValue({ insights: [] }),
  },
}));

vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: {
    getWorkflowSignals: vi.fn().mockResolvedValue({ signals: [] }),
  },
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

    useRadarDataMock.mockReturnValue({
      data: {
        generatedAt: '2026-05-18T00:00:00.000Z',
        radarMap: {
          signals: [
            {
              id: 'sig-1',
              name: 'AI Agents',
              ring: 'NOW',
              quadrant: 'MY_PROJECTS',
              status: 'new',
              signalType: 'TECHNOLOGY',
              importanceLevel: 'large',
              fitLevel: 'high',
              preview: {
                shortDescription: 'Agentic workflows for repetitive work.',
                whyItMatters: 'Can reduce repetitive delivery effort.',
                whyItMattersForYou: 'You run delivery and growth experiments.',
                howToThinkAboutIt: 'Start from one repeatable workflow.',
                goodFirstQuestion: 'Which repetitive flow should be first?',
                suggestedNextStep: 'Talk to Teresa for a first experiment.',
              },
            },
          ],
        },
        whatChanged: [],
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  it('renders the aggregated home contract with roof truth and block orchestration', () => {
    render(<HomeView onAction={vi.fn()} />);

    expect(screen.getByText(/Radar · context/)).toBeInTheDocument();
    expect(screen.getByText(/Your Radar/)).toBeInTheDocument();
    expect(screen.getAllByText(/Radar/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI Agents/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Industry Lens/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Execution Current/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Momentum/)).not.toBeInTheDocument();
    expect(screen.queryByText(/KPI Alerts/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Triage Cockpit|triage/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/NOW/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PREPARE/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/LEARN/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/OBSERVE/).length).toBeGreaterThan(0);
  });

  it('passes home actions through to the My Work hub contract', () => {
    const onAction = vi.fn();
    render(<HomeView onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: /Talk to Teresa/i }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'chat',
      packet: expect.objectContaining({
        intent: 'radar_signal_consult',
        title: 'AI Agents',
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Idea/i }));
    expect(onAction).toHaveBeenCalledWith({
      type: 'create',
      target: 'idea',
    });
  });

  it('supports interactive radar signal selection and updates preview panel', () => {
    render(<HomeView onAction={vi.fn()} />);
    const point = screen.getByTestId('radar-signal-sig-1');
    fireEvent.click(point);
    expect(screen.getByText('Can reduce repetitive delivery effort.')).toBeInTheDocument();
    expect(screen.getAllByText('You run delivery and growth experiments.').length).toBeGreaterThan(0);
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
    expect(toastErrorMock).toHaveBeenCalledWith('Radar could not load. Showing recovery state.');
  });
});
