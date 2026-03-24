import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { HomeView } from '../../../src/components/MyWork/Home/HomeView';
import type { RadarViewPayload } from '../../../src/components/MyWork/Home/homeV2Types';
import type { UnifiedOutputRow } from '../../../src/components/ReportsAndPresentations/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || '',
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

const useRadarDataMock = vi.fn();
vi.mock('../../../src/components/MyWork/Home/useRadarData', () => ({
  useRadarData: (...args: unknown[]) => useRadarDataMock(...args),
}));

const useMyWorkArtifactOutputsMock = vi.fn();
vi.mock('../../../src/components/ReportsAndPresentations/useRapData', () => ({
  useMyWorkArtifactOutputs: (...args: unknown[]) => useMyWorkArtifactOutputsMock(...args),
}));

const useV8MyWorkRoofSummaryMock = vi.fn();
vi.mock('../../../src/hooks/useV8MyWorkRoof', () => ({
  useV8MyWorkRoofSummary: (...args: unknown[]) => useV8MyWorkRoofSummaryMock(...args),
}));

const apiPostMock = vi.fn();
vi.mock('../../../src/services/api', () => ({
  default: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

const radarPayload: RadarViewPayload = {
  generatedAt: '2026-03-24T10:00:00.000Z',
  profile: {
    trackedTopics: ['AI'],
    trackedCompanies: ['Consultify'],
    mutedTopics: [],
    mutedSources: [],
  },
  dailyBriefing: {
    mainInsight: 'One strong signal needs executive attention.',
    keySignals: [
      {
        id: 'sig-1',
        signalId: 'sig-1',
        title: 'Board deck pressure is rising',
        summary: 'Leaders need a fresh presentation.',
        insightSummary: 'The board needs an updated narrative backed by evidence.',
        whyItMatters: 'A decision window is opening.',
        whyYouSeeThis: 'You own the linked initiative.',
        suggestedNextStep: 'Prepare a concise board deck.',
        source: { id: 'src-1', name: 'Radar', category: 'news', trustScore: 0.9 },
        tags: { domains: ['strategy'], topics: ['board'], entities: ['initiative'] },
        contentType: 'news',
        relevanceScope: 'project_specific',
        businessImpact: 'high',
        actionability: 'high',
        durability: 'current',
        impactType: 'strategic',
        confidenceScore: 0.91,
        freshnessScore: 0.88,
        finalScore: 0.89,
      },
    ],
    recommendedMove: null,
  },
  whatChanged: [],
  whyItMattersToMe: [],
  whatToDoNext: [],
  learnImprove: [],
  watchlist: [],
  metrics: {
    totalSignalsConsidered: 12,
    duplicateRate: 5,
    actionedSignalsLast30d: 3,
    savedSignalsLast30d: 2,
  },
  localization: {
    requestedLanguage: 'en',
    pendingCount: 0,
  },
};

const reviewRows: UnifiedOutputRow[] = [
  {
    kind: 'presentation',
    originRecordId: 'deck-1',
    artifactId: 'artifact-deck-1',
    title: 'Board deck Q1',
    statusKey: 'shared',
    owner: 'user-1',
    updatedAt: '2026-03-24T09:00:00.000Z',
    exportFormats: ['pptx'],
  },
];

const mineRows: UnifiedOutputRow[] = [
  {
    kind: 'document',
    originRecordId: 'report-1',
    artifactId: 'artifact-report-1',
    title: 'Weekly execution review',
    statusKey: 'draft',
    owner: 'user-1',
    updatedAt: '2026-03-24T08:00:00.000Z',
    exportFormats: ['pdf'],
  },
];

const recentRows: UnifiedOutputRow[] = [
  {
    kind: 'sheet',
    originRecordId: 'sheet-1',
    artifactId: 'artifact-sheet-1',
    title: 'Transformation tracker',
    statusKey: 'draft',
    owner: 'user-2',
    updatedAt: '2026-03-24T07:00:00.000Z',
    exportFormats: ['xlsx'],
  },
];

describe('HomeView outputs integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiPostMock.mockResolvedValue({ ok: true });
    useRadarDataMock.mockReturnValue({
      data: radarPayload,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    useMyWorkArtifactOutputsMock.mockReturnValue({
      mine: mineRows,
      review: reviewRows,
      recent: recentRows,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useV8MyWorkRoofSummaryMock.mockReturnValue({
      data: {
        overallStatus: 'mixed_truth',
        surfaceMode: 'radar_overlay_with_outputs_bridge',
        counts: {
          backed_by_real_service: 2,
          partial_stitched: 2,
          placeholder_non_canonical: 4,
        },
      },
      isLoading: false,
      isError: false,
    });
  });

  it('renders personal outputs lanes from the canonical artifact registry', () => {
    render(<HomeView onAction={vi.fn()} />);

    expect(screen.getByText(/Roof truth:/)).toBeInTheDocument();
    expect(screen.getByText(/Radar overlay \+ outputs bridge/)).toBeInTheDocument();
    expect(screen.getByText('My outputs')).toBeInTheDocument();
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.getByText('Recent mine')).toBeInTheDocument();
    expect(screen.getByText('Recent outputs')).toBeInTheDocument();
    expect(screen.getByText('Board deck Q1')).toBeInTheDocument();
    expect(screen.getByText('Weekly execution review')).toBeInTheDocument();
    expect(screen.getByText('Transformation tracker')).toBeInTheDocument();
  });

  it('routes output actions through the My Work home action contract', () => {
    const onAction = vi.fn();
    render(<HomeView onAction={onAction} />);

    fireEvent.click(screen.getByText('Board deck Q1'));
    expect(onAction).toHaveBeenCalledWith({
      type: 'open',
      target: 'presentation',
      id: 'deck-1',
    });

    fireEvent.click(screen.getByText('Open review queue'));
    expect(onAction).toHaveBeenCalledWith({
      type: 'navigate',
      target: 'outputs_review',
    });

    fireEvent.click(screen.getByText('Open my outputs'));
    expect(onAction).toHaveBeenCalledWith({
      type: 'navigate',
      target: 'outputs_mine',
    });

    fireEvent.click(screen.getByText('Open library'));
    expect(onAction).toHaveBeenCalledWith({
      type: 'navigate',
      target: 'outputs_all',
    });
  });
});
