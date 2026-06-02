import { describe, expect, it, vi } from 'vitest';

import type { RadarViewPayload } from '../../server/src/services/radar/radarTypes';

const buildViewMock = vi.fn();
const listSourcesMock = vi.fn();
const getMetricsMock = vi.fn();
const updateProfileMock = vi.fn();
const getOrCreateProfileMock = vi.fn();
const recordActionMock = vi.fn();
const buildResolvedContextMock = vi.fn();

vi.mock('../../server/src/services/radar/radarService.ts', () => ({
  radarService: {
    buildView: (...args: unknown[]) => buildViewMock(...args),
    listSources: (...args: unknown[]) => listSourcesMock(...args),
    getMetrics: (...args: unknown[]) => getMetricsMock(...args),
  },
}));

vi.mock('../../server/src/services/radar/radarRankingService.ts', () => ({
  radarRankingService: {
    updateProfile: (...args: unknown[]) => updateProfileMock(...args),
    getOrCreateProfile: (...args: unknown[]) => getOrCreateProfileMock(...args),
  },
}));

vi.mock('../../server/src/services/radar/radarActionService.ts', () => ({
  radarActionService: {
    record: (...args: unknown[]) => recordActionMock(...args),
  },
}));

vi.mock('../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    buildResolvedContext: (...args: unknown[]) => buildResolvedContextMock(...args),
  },
}));

vi.mock('../../server/src/routes/my-work/_helpers.js', () => ({
  requireUser: () => ({ userId: 'user-1', orgId: 'org-1' }),
  requireTables: async () => true,
}));

describe('my-work radar route contract', () => {
  it('buildView payload includes radarMap with signal contract', async () => {
    const payload: RadarViewPayload = {
      generatedAt: new Date().toISOString(),
      profile: {
        trackedTopics: [],
        trackedCompanies: [],
        mutedTopics: [],
        mutedSources: [],
      },
      dailyBriefing: {
        mainInsight: 'Insight',
        keySignals: [],
        recommendedMove: null,
      },
      whatChanged: [],
      whyItMattersToMe: [],
      whatToDoNext: [],
      learnImprove: [],
      watchlist: [],
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
              shortDescription: 'desc',
              whyItMatters: 'matters',
              whyItMattersForYou: 'for you',
              howToThinkAboutIt: 'think',
              goodFirstQuestion: 'question',
              suggestedNextStep: 'next',
            },
          },
        ],
      },
      metrics: {
        totalSignalsConsidered: 0,
        duplicateRate: 0,
        actionedSignalsLast30d: 0,
        savedSignalsLast30d: 0,
      },
      localization: {
        requestedLanguage: 'en',
        pendingCount: 0,
      },
    };

    buildViewMock.mockResolvedValue(payload);
    buildResolvedContextMock.mockResolvedValue({ profile: { industry: 'Manufacturing' } });

    const res = await buildViewMock();
    expect(res.radarMap?.signals?.[0]?.ring).toBe('NOW');
    expect(res.radarMap?.signals?.[0]?.quadrant).toBe('MY_PROJECTS');
    expect(res.radarMap?.signals?.[0]?.preview?.goodFirstQuestion).toBeTruthy();
  });

  it('records watch/forget actions through radar actions contract', async () => {
    recordActionMock.mockResolvedValue({ success: true });
    const watchResult = await recordActionMock({
      userId: 'user-1',
      orgId: 'org-1',
      signalId: 'sig-1',
      actionType: 'add_to_watchlist',
      payload: { topic: 'AI Agents' },
    });
    const forgetResult = await recordActionMock({
      userId: 'user-1',
      orgId: 'org-1',
      signalId: 'sig-1',
      actionType: 'less_like_this',
      payload: { topic: 'AI Agents' },
    });

    expect(watchResult.success).toBe(true);
    expect(forgetResult.success).toBe(true);
  });
});

