import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';
import { pickTipOfDay } from '../homeCoverFeedService.js';
import { radarLocalizationService } from './radarLocalizationService.js';
import { radarProcessingService } from './radarProcessingService.js';
import { radarRankingService } from './radarRankingService.js';
import { radarSourceRegistryService } from './radarSourceRegistryService.js';
import type { RadarRecommendation, RadarSignalCard, RadarViewPayload } from './radarTypes.js';

function dedupeBySignalId(cards: RadarSignalCard[]): RadarSignalCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.signalId)) return false;
    seen.add(card.signalId);
    return true;
  });
}

function tipCard(params: {
  id: string;
  title: string;
  body: string;
  isPolish: boolean;
}): RadarSignalCard {
  return {
    id: params.id,
    signalId: params.id,
    title: params.title,
    summary: params.body,
    insightSummary: params.body,
    whyItMatters: params.isPolish
      ? 'To praktyczny materiał do podniesienia jakości kolejnego ruchu.'
      : 'This is practical material to improve the quality of your next move.',
    whyYouSeeThis: params.isPolish
      ? 'Radar dokłada też evergreen guidance, nie tylko sygnały z rynku.'
      : 'Radar also brings evergreen guidance, not only market signals.',
    suggestedNextStep: params.isPolish
      ? 'Zastosuj to do bieżącego projektu albo zamień w checklistę.'
      : 'Apply it to an active project or turn it into a checklist.',
    source: {
      id: 'internal-tip',
      name: 'Consultify',
      category: 'guidance',
      trustScore: 0.95,
    },
    tags: {
      domains: ['execution'],
      topics: ['playbook', 'workflow'],
      entities: [],
    },
    contentType: 'tool_tip',
    relevanceScope: 'role_specific',
    businessImpact: 'medium',
    actionability: 'high',
    durability: 'evergreen',
    impactType: 'learning',
    confidenceScore: 0.9,
    freshnessScore: 65,
    finalScore: 58,
    publishedAt: null,
    relatedContext: [],
  };
}

function buildRecommendations(cards: RadarSignalCard[], isPolish: boolean): RadarRecommendation[] {
  const L = (pl: string, en: string) => (isPolish ? pl : en);
  const top = cards[0];
  const riskCard = cards.find(
    (card) => card.impactType === 'risk' || card.impactType === 'compliance'
  );
  const opportunityCard = cards.find(
    (card) => card.impactType === 'commercial' || card.impactType === 'product'
  );

  const recommendations: RadarRecommendation[] = [];

  if (top) {
    recommendations.push({
      id: 'radar-action-1',
      kind: 'action',
      title: L('Najbliższy ruch', 'Next move'),
      body: top.suggestedNextStep,
      signalId: top.signalId,
    });
    recommendations.push({
      id: 'radar-question-1',
      kind: 'question',
      title: L('Pytanie do zespołu', 'Question for the team'),
      body: L(
        `Czy ten sygnał powinien wejść do backlogu lub decyzji zamiast zostać tylko “do przeczytania”?`,
        `Should this signal enter backlog or decision flow instead of staying “interesting reading”?`
      ),
      signalId: top.signalId,
    });
  }

  if (cards[1]) {
    recommendations.push({
      id: 'radar-question-2',
      kind: 'question',
      title: L('Pytanie strategiczne', 'Strategic question'),
      body: L(
        `Który z bieżących projektów najbardziej zmieni się, jeśli ten sygnał okaże się prawdziwy?`,
        `Which active project changes the most if this signal proves true?`
      ),
      signalId: cards[1].signalId,
    });
  }

  if (riskCard) {
    recommendations.push({
      id: 'radar-risk-1',
      kind: 'risk',
      title: L('Ryzyko do obserwacji', 'Risk to watch'),
      body: riskCard.whyItMatters,
      signalId: riskCard.signalId,
    });
  }

  if (opportunityCard) {
    recommendations.push({
      id: 'radar-opportunity-1',
      kind: 'opportunity',
      title: L('Szansa do testu', 'Opportunity to test'),
      body: opportunityCard.suggestedNextStep,
      signalId: opportunityCard.signalId,
    });
  }

  return recommendations.slice(0, 7);
}

function toRadarMapSignal(card: RadarSignalCard, index: number) {
  return {
    id: card.signalId,
    name: card.title,
    icon: card.tags.domains[0] || 'signal',
    ring:
      card.ring || (index < 4 ? 'NOW' : index < 8 ? 'PREPARE' : index < 12 ? 'LEARN' : 'OBSERVE'),
    quadrant:
      card.quadrant ||
      (index % 4 === 0
        ? 'MY_DEVELOPMENT'
        : index % 4 === 1
          ? 'MY_PROJECTS'
          : index % 4 === 2
            ? 'MY_INDUSTRY'
            : 'MY_ROLE'),
    status: card.status || (index < 3 ? 'new' : 'updated'),
    signalType: card.signalType || 'TREND',
    importanceLevel:
      card.businessImpact === 'high'
        ? 'large'
        : card.businessImpact === 'medium'
          ? 'medium'
          : 'small',
    fitLevel:
      card.actionability === 'high' ? 'high' : card.actionability === 'medium' ? 'medium' : 'low',
    score: Math.round(card.finalScore ?? 0),
    confidence: card.confidenceScore ?? 0.6,
    sourceName: card.source?.name || 'Source',
    sourceUrl: card.source?.url,
    topic: card.tags?.topics?.[0],
    entity: card.tags?.entities?.[0],
    publishedAt: card.publishedAt ?? null,
    preview: {
      shortDescription: card.summary,
      whyItMatters: card.whyItMatters,
      whyItMattersForYou: card.whyYouSeeThis,
      howToThinkAboutIt: card.insightSummary,
      goodFirstQuestion:
        card.preview?.goodFirstQuestion ||
        `What does ${card.title} change in your current workflow?`,
      suggestedNextStep: card.suggestedNextStep,
    },
  } as const;
}

class RadarService {
  private async ingestFallbackSources(nowIso: string, limit = 8): Promise<void> {
    const fallbackSources = await radarSourceRegistryService.listAll();
    const active = fallbackSources
      .filter((source) => source.active)
      .sort((a, b) => b.trustScore - a.trustScore)
      .slice(0, limit);

    await Promise.all(
      active.map(async (source) => {
        await radarProcessingService.ingestSource(source);
        await radarSourceRegistryService.markRefreshed(
          source.id,
          nowIso,
          source.refreshFrequencyMinutes
        );
      })
    );
  }

  async buildView(params: {
    userId: string;
    orgId: string;
    role?: string | null;
    industry?: string | null;
    isPolish: boolean;
  }): Promise<RadarViewPayload> {
    const { userId, orgId, role, industry, isPolish } = params;
    const now = new Date();
    const nowIso = now.toISOString();
    const requestedLanguage = isPolish ? 'pl' : 'en';

    await radarSourceRegistryService.syncDefaultSources();
    const dueSources = await radarSourceRegistryService.listDue(nowIso, 5);
    await Promise.all(
      dueSources.map(async (source) => {
        await radarProcessingService.ingestSource(source);
        await radarSourceRegistryService.markRefreshed(
          source.id,
          nowIso,
          source.refreshFrequencyMinutes
        );
      })
    );

    let processedSignals = await radarProcessingService.listSignals(80);
    if (!processedSignals.length) {
      await this.ingestFallbackSources(nowIso);
      processedSignals = await radarProcessingService.listSignals(80);
    }

    const [profile, dynamicContext, actions30d, duplicateStats, watchlistItems] = await Promise.all(
      [
        radarRankingService.getOrCreateProfile({ userId, orgId, role, industry }),
        radarRankingService.buildDynamicContext(userId, orgId),
        queryHelpers
          .queryAll<{ action_type: string }>(
            `SELECT action_type
           FROM radar_actions
           WHERE user_id = ? AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`,
            [userId]
          )
          .catch(async () =>
            queryHelpers.queryAll<{ action_type: string }>(
              `SELECT action_type
             FROM radar_actions
             WHERE user_id = ? AND created_at >= datetime('now', '-30 days')`,
              [userId]
            )
          ),
        queryHelpers.queryOne<{ duplicate_count: number; total_count: number }>(
          `SELECT
             SUM(CASE WHEN duplicate_cluster_id IS NOT NULL THEN 1 ELSE 0 END) AS duplicate_count,
             COUNT(*) AS total_count
           FROM radar_processed_signals`
        ),
        queryHelpers.queryAll<{ item_type: string; value: string; active: number }>(
          `SELECT item_type, value, active
           FROM watchlist_items
           WHERE user_id = ? AND active = 1
           ORDER BY created_at DESC
           LIMIT 20`,
          [userId]
        ),
      ]
    );

    const ranked = await radarRankingService.rankSignals({
      userId,
      orgId,
      isPolish,
      profile,
      dynamicContext,
      signals: processedSignals,
    });

    const topRankedSignals = ranked.slice(0, 18).map(({ signal, ranked: score }) => {
      const localization = radarLocalizationService.resolveSignal(signal, requestedLanguage);
      return {
        signal: localization.signal,
        ranked: score,
        localization,
      };
    });
    const localizationPendingCount = radarLocalizationService.prewarmSignals(
      topRankedSignals.filter((item) => item.localization.pending).map((item) => item.signal),
      requestedLanguage
    );
    const cards = topRankedSignals.map(({ signal, ranked: score, localization }) =>
      radarRankingService.toSignalCard(signal, score, {
        sourceLanguage: localization.sourceLanguage,
        requestedLanguage: localization.requestedLanguage,
        isLocalized: localization.isLocalized,
        localizationPending: localization.pending,
      })
    );

    const { appTip, aiPlaybookTip } = pickTipOfDay(now);
    const learnCards = dedupeBySignalId([
      ...cards
        .filter((card) => card.contentType === 'how_to' || card.contentType === 'tool_tip')
        .slice(0, 2),
      tipCard({
        id: `tip:${appTip.id}`,
        title: isPolish ? appTip.titlePl : appTip.titleEn,
        body: isPolish ? appTip.bodyPl : appTip.bodyEn,
        isPolish,
      }),
      tipCard({
        id: `tip:${aiPlaybookTip.id}`,
        title: isPolish ? aiPlaybookTip.titlePl : aiPlaybookTip.titleEn,
        body: isPolish ? aiPlaybookTip.bodyPl : aiPlaybookTip.bodyEn,
        isPolish,
      }),
    ]).slice(0, 4);

    const whatChanged = cards.slice(0, 8);
    const whyItMattersToMe = dedupeBySignalId(
      cards.filter((card) =>
        ['role_specific', 'industry_specific', 'company_specific', 'project_specific'].includes(
          card.relevanceScope
        )
      )
    ).slice(0, 6);

    const watchlistCards = dedupeBySignalId(
      cards.filter((card) => {
        if (card.durability === 'evergreen') return false;
        const values = watchlistItems.map((item) => String(item.value).toLowerCase());
        return (
          card.tags.topics.some((topic) => values.includes(topic.toLowerCase())) ||
          values.includes(card.source.name.toLowerCase()) ||
          card.businessImpact === 'high'
        );
      })
    ).slice(0, 5);

    const recommendations = buildRecommendations(cards, isPolish);

    const mainInsight =
      cards[0]?.whyItMatters ||
      (isPolish
        ? 'Radar nie jest feedem. To warstwa interpretacji i działania dla Twojej pracy.'
        : 'Radar is not a feed. It is an interpretation and action layer for your work.');

    const duplicateCount = Number(duplicateStats?.duplicate_count || 0);
    const totalCount = Math.max(1, Number(duplicateStats?.total_count || 0));

    return {
      generatedAt: nowIso,
      profile: {
        trackedTopics: profile.trackedTopics,
        trackedCompanies: profile.trackedCompanies,
        mutedTopics: profile.mutedTopics,
        mutedSources: profile.mutedSources,
      },
      dailyBriefing: {
        mainInsight,
        keySignals: cards.slice(0, 3),
        recommendedMove: recommendations.find((item) => item.kind === 'action') || null,
      },
      whatChanged,
      whyItMattersToMe: whyItMattersToMe.length ? whyItMattersToMe : cards.slice(0, 4),
      whatToDoNext: recommendations,
      learnImprove: learnCards,
      watchlist: watchlistCards.length ? watchlistCards : cards.slice(3, 7),
      radarMap: {
        signals: cards.slice(0, 20).map((card, index) => toRadarMapSignal(card, index)),
      },
      metrics: {
        totalSignalsConsidered: processedSignals.length,
        duplicateRate: Number(((duplicateCount / totalCount) * 100).toFixed(1)),
        actionedSignalsLast30d: actions30d.filter((item) =>
          ['ask_ai', 'create_task', 'add_to_note', 'add_to_decision', 'save'].includes(
            String(item.action_type)
          )
        ).length,
        savedSignalsLast30d: actions30d.filter((item) => String(item.action_type) === 'save')
          .length,
      },
      localization: {
        requestedLanguage,
        pendingCount: localizationPendingCount,
      },
    };
  }

  async listSources() {
    return radarSourceRegistryService.listAll();
  }

  async getMetrics(userId: string) {
    const [actions, duplicates] = await Promise.all([
      queryHelpers.queryAll<{ action_type: string; created_at: string }>(
        `SELECT action_type, created_at
         FROM radar_actions
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 200`,
        [userId]
      ),
      queryHelpers.queryOne<{ duplicate_count: number; total_count: number }>(
        `SELECT
           SUM(CASE WHEN duplicate_cluster_id IS NOT NULL THEN 1 ELSE 0 END) AS duplicate_count,
           COUNT(*) AS total_count
         FROM radar_processed_signals`
      ),
    ]);

    return {
      weeklyActiveLikeSignals: actions.filter((item) => {
        const created = Date.parse(String(item.created_at || ''));
        return Number.isFinite(created) && Date.now() - created <= 7 * 24 * 60 * 60 * 1000;
      }).length,
      actionCount: actions.length,
      saveCount: actions.filter((item) => item.action_type === 'save').length,
      askAiCount: actions.filter((item) => item.action_type === 'ask_ai').length,
      duplicateRate: Number(
        (
          (Number(duplicates?.duplicate_count || 0) /
            Math.max(1, Number(duplicates?.total_count || 0))) *
          100
        ).toFixed(1)
      ),
    };
  }
}

export const radarService = new RadarService();
