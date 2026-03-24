import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../../utils/queryHelpers.js';
import type {
  RadarDynamicContext,
  RadarProcessedSignal,
  RadarRankedSignal,
  RadarRelevanceBreakdown,
  RadarSignalCard,
  RadarImpactType,
  UserRadarProfileRecord,
} from './radarTypes.js';

function parseJsonArray(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((item) => String(item).trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(input: unknown): Record<string, number> {
  if (typeof input !== 'string') return {};
  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, Number(value) || 0])
    );
  } catch {
    return {};
  }
}

function toKeywordBag(values: string[]): string[] {
  const bag = new Set<string>();
  for (const value of values) {
    const source = String(value || '').toLowerCase();
    if (!source) continue;
    bag.add(source);
    for (const token of source.split(/[^a-z0-9ąćęłńóśźż-]+/i)) {
      const clean = token.trim();
      if (clean.length >= 3) bag.add(clean);
    }
  }
  return Array.from(bag);
}

function matchScore(tokens: string[], candidates: string[], weight: number): number {
  if (!tokens.length || !candidates.length) return 0;
  const haystack = candidates.map((item) => item.toLowerCase());
  const hits = tokens.filter((token) => haystack.some((candidate) => candidate.includes(token)));
  if (!hits.length) return 0;
  const ratio = Math.min(1, hits.length / Math.max(tokens.length, 1));
  return Math.round(weight * ratio);
}

function classifyImpactType(signal: RadarProcessedSignal): RadarImpactType {
  if (signal.domainTags.includes('compliance') || signal.domainTags.includes('cyber')) return 'compliance';
  if (signal.domainTags.includes('competition') || signal.domainTags.includes('market')) return 'commercial';
  if (signal.domainTags.includes('operations') || signal.domainTags.includes('execution'))
    return 'operational';
  if (signal.domainTags.includes('product')) return 'product';
  if (signal.domainTags.includes('leadership') || signal.domainTags.includes('transformation'))
    return 'strategic';
  return signal.contentType === 'how_to' || signal.contentType === 'tool_tip' ? 'learning' : 'risk';
}

function deriveWhyYouSeeThis(
  breakdown: RadarRelevanceBreakdown,
  signal: RadarProcessedSignal,
  profile: UserRadarProfileRecord,
  isPolish: boolean
): string {
  const L = (pl: string, en: string) => (isPolish ? pl : en);
  if (breakdown.projectMatch >= 15) {
    return L(
      'Bo ten sygnał pasuje do Twoich aktualnych zadań, decyzji albo inicjatyw.',
      'Because this signal matches your current tasks, decisions, or initiatives.'
    );
  }
  if (breakdown.trackedCompanyMatch >= 8) {
    return L(
      'Bo dotyczy firmy albo dostawcy, którego obserwujesz.',
      'Because it involves a company or vendor you track.'
    );
  }
  if (breakdown.trackedTopicMatch >= 10) {
    return L(
      `Bo pasuje do obserwowanego tematu: ${profile.trackedTopics[0] || signal.topicTags[0] || 'Radar'}.`,
      `Because it matches a tracked topic: ${profile.trackedTopics[0] || signal.topicTags[0] || 'Radar'}.`
    );
  }
  if (breakdown.roleMatch >= 10) {
    return L(
      'Bo pasuje do Twojej roli i typu decyzji, które zwykle prowadzisz.',
      'Because it matches your role and the decisions you usually drive.'
    );
  }
  if (breakdown.industryMatch >= 10) {
    return L(
      'Bo ten sygnał jest bliski Twojej branży i kontekstowi organizacji.',
      'Because this signal is close to your industry and organization context.'
    );
  }
  return L(
    'Bo Radar ocenił go jako świeży, wiarygodny i potencjalnie użyteczny teraz.',
    'Because Radar rated it as fresh, credible, and potentially useful now.'
  );
}

function deriveWhyItMatters(
  signal: RadarProcessedSignal,
  impactType: RadarImpactType,
  isPolish: boolean
): string {
  const L = (pl: string, en: string) => (isPolish ? pl : en);
  if (impactType === 'operational') {
    return L(
      'Może zmienić sposób sekwencjonowania pracy, rytuałów albo workflowów wykonawczych.',
      'It can shift sequencing, operating rituals, or execution workflows.'
    );
  }
  if (impactType === 'commercial') {
    return L(
      'To sygnał, który może zmienić oczekiwania rynku, pozycjonowanie albo tempo konkurencji.',
      'This may shift market expectations, positioning, or competitive pace.'
    );
  }
  if (impactType === 'compliance') {
    return L(
      'To ma wpływ na governance, ryzyko albo wymagania zgodności, więc nie powinno zostać tylko “do przeczytania”.',
      'It affects governance, risk, or compliance requirements, so it should not remain just “interesting reading”.'
    );
  }
  if (impactType === 'learning') {
    return L(
      'To praktyczny materiał, który może podnieść jakość Twojego kolejnego ruchu.',
      'This is a practical input that can improve the quality of your next move.'
    );
  }
  return L(
    'To wpływa na kierunek transformacji, framing decyzji albo sposób ustawienia priorytetów.',
    'It affects transformation direction, decision framing, or the way priorities are set.'
  );
}

function deriveNextStep(signal: RadarProcessedSignal, isPolish: boolean): string {
  const L = (pl: string, en: string) => (isPolish ? pl : en);
  if (signal.contentType === 'how_to' || signal.contentType === 'tool_tip') {
    return L(
      'Sprawdź, czy warto zamienić to w checklistę albo eksperyment w bieżącym projekcie.',
      'Check whether this should become a checklist or experiment in an active project.'
    );
  }
  if (signal.contentType === 'regulation') {
    return L(
      'Oceń wpływ na governance i dodaj temat do decyzji albo notatki roboczej.',
      'Assess governance impact and add the topic to a decision or working note.'
    );
  }
  if (signal.contentType === 'competitor_move') {
    return L(
      'Porównaj z Twoim aktualnym kierunkiem i zanotuj, czy to ryzyko, czy szansa.',
      'Compare it with your current direction and capture whether it is a risk or opportunity.'
    );
  }
  return L(
    'Otwórz sygnał, dopytaj AI o wpływ i zdecyduj, czy zamienić go w zadanie, notatkę albo decyzję.',
    'Open the signal, ask AI for impact, and decide whether it becomes a task, note, or decision.'
  );
}

class RadarRankingService {
  async getOrCreateProfile(params: {
    userId: string;
    orgId: string;
    role?: string | null;
    industry?: string | null;
  }): Promise<UserRadarProfileRecord> {
    const { userId, orgId, role, industry } = params;
    const existing = await queryHelpers.queryOne<any>(
      `SELECT * FROM user_radar_profiles WHERE user_id = ?`,
      [userId]
    );

    if (!existing) {
      const baseProfile: UserRadarProfileRecord = {
        userId,
        organizationId: orgId,
        roles: role ? [String(role)] : [],
        industries: industry ? [String(industry)] : [],
        seniority: null,
        region: null,
        trackedTopics: [],
        trackedCompanies: [],
        mutedTopics: [],
        mutedSources: [],
        preferredContentTypes: [],
        strategicInterests: [],
        personalizationWeights: {
          roleMatch: 15,
          industryMatch: 15,
          projectMatch: 20,
          trackedTopicMatch: 15,
          trackedCompanyMatch: 10,
          recentWorkContextMatch: 10,
          freshness: 5,
          trust: 5,
          actionability: 5,
          behaviorAdjustment: 5,
        },
      };

      await queryHelpers.queryRun(
        `INSERT INTO user_radar_profiles (
          user_id, organization_id, roles_json, industries_json, tracked_topics_json,
          tracked_companies_json, muted_topics_json, muted_sources_json,
          preferred_content_types_json, strategic_interests_json, personalization_weights_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          orgId,
          JSON.stringify(baseProfile.roles),
          JSON.stringify(baseProfile.industries),
          JSON.stringify(baseProfile.trackedTopics),
          JSON.stringify(baseProfile.trackedCompanies),
          JSON.stringify(baseProfile.mutedTopics),
          JSON.stringify(baseProfile.mutedSources),
          JSON.stringify(baseProfile.preferredContentTypes),
          JSON.stringify(baseProfile.strategicInterests),
          JSON.stringify(baseProfile.personalizationWeights),
        ]
      );

      return baseProfile;
    }

    return {
      userId,
      organizationId: String(existing.organization_id || orgId),
      roles: parseJsonArray(existing.roles_json),
      industries: parseJsonArray(existing.industries_json),
      seniority: existing.seniority ? String(existing.seniority) : null,
      region: existing.region ? String(existing.region) : null,
      trackedTopics: parseJsonArray(existing.tracked_topics_json),
      trackedCompanies: parseJsonArray(existing.tracked_companies_json),
      mutedTopics: parseJsonArray(existing.muted_topics_json),
      mutedSources: parseJsonArray(existing.muted_sources_json),
      preferredContentTypes: parseJsonArray(existing.preferred_content_types_json),
      strategicInterests: parseJsonArray(existing.strategic_interests_json),
      personalizationWeights: {
        roleMatch: 15,
        industryMatch: 15,
        projectMatch: 20,
        trackedTopicMatch: 15,
        trackedCompanyMatch: 10,
        recentWorkContextMatch: 10,
        freshness: 5,
        trust: 5,
        actionability: 5,
        behaviorAdjustment: 5,
        ...parseJsonObject(existing.personalization_weights_json),
      },
    };
  }

  async updateProfile(userId: string, patch: Partial<UserRadarProfileRecord>): Promise<UserRadarProfileRecord | null> {
    const current = await this.getOrCreateProfile({
      userId,
      orgId: patch.organizationId || '',
      role: patch.roles?.[0],
      industry: patch.industries?.[0],
    });
    const merged: UserRadarProfileRecord = {
      ...current,
      ...patch,
      roles: patch.roles ?? current.roles,
      industries: patch.industries ?? current.industries,
      trackedTopics: patch.trackedTopics ?? current.trackedTopics,
      trackedCompanies: patch.trackedCompanies ?? current.trackedCompanies,
      mutedTopics: patch.mutedTopics ?? current.mutedTopics,
      mutedSources: patch.mutedSources ?? current.mutedSources,
      preferredContentTypes: patch.preferredContentTypes ?? current.preferredContentTypes,
      strategicInterests: patch.strategicInterests ?? current.strategicInterests,
      personalizationWeights: {
        ...current.personalizationWeights,
        ...(patch.personalizationWeights || {}),
      },
    };

    await queryHelpers.queryRun(
      `UPDATE user_radar_profiles
       SET roles_json = ?, industries_json = ?, seniority = ?, region = ?,
           tracked_topics_json = ?, tracked_companies_json = ?, muted_topics_json = ?,
           muted_sources_json = ?, preferred_content_types_json = ?, strategic_interests_json = ?,
           personalization_weights_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [
        JSON.stringify(merged.roles),
        JSON.stringify(merged.industries),
        merged.seniority || null,
        merged.region || null,
        JSON.stringify(merged.trackedTopics),
        JSON.stringify(merged.trackedCompanies),
        JSON.stringify(merged.mutedTopics),
        JSON.stringify(merged.mutedSources),
        JSON.stringify(merged.preferredContentTypes),
        JSON.stringify(merged.strategicInterests),
        JSON.stringify(merged.personalizationWeights),
        userId,
      ]
    );

    return merged;
  }

  async buildDynamicContext(userId: string, orgId: string): Promise<RadarDynamicContext> {
    const [tasks, decisions, ideas, notes, initiatives, actions] = await Promise.all([
      queryHelpers.queryAll<{ title: string }>(
        `SELECT title FROM tasks
         WHERE organization_id = ? AND assignee_id = ?
         ORDER BY updated_at DESC
         LIMIT 8`,
        [orgId, userId]
      ),
      queryHelpers.queryAll<{ title: string }>(
        `SELECT title FROM decisions
         WHERE organization_id = ? AND (created_by = ? OR decision_maker_id = ?)
         ORDER BY created_at DESC
         LIMIT 6`,
        [orgId, userId, userId]
      ),
      queryHelpers.queryAll<{ title: string }>(
        `SELECT title FROM ideas
         WHERE organization_id = ? AND created_by = ?
         ORDER BY updated_at DESC
         LIMIT 6`,
        [orgId, userId]
      ),
      queryHelpers.queryAll<{ title: string }>(
        `SELECT title FROM notebook_pages
         WHERE organization_id = ? AND owner_user_id = ?
         ORDER BY updated_at DESC
         LIMIT 6`,
        [orgId, userId]
      ),
      queryHelpers.queryAll<{ title: string }>(
        `SELECT name AS title FROM initiatives
         WHERE organization_id = ?
         ORDER BY updated_at DESC
         LIMIT 6`,
        [orgId]
      ),
      queryHelpers.queryAll<{ action_type: string; signal_id?: string | null }>(
        `SELECT action_type, signal_id
         FROM radar_actions
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 40`,
        [userId]
      ),
    ]);

    return {
      taskTitles: tasks.map((item) => String(item.title || '')),
      decisionTitles: decisions.map((item) => String(item.title || '')),
      ideaTitles: ideas.map((item) => String(item.title || '')),
      noteTitles: notes.map((item) => String(item.title || '')),
      initiativeTitles: initiatives.map((item) => String(item.title || '')),
      calendarKeywords: [...tasks, ...decisions].map((item) => String(item.title || '')).slice(0, 8),
      recentActions: actions.map((item) => ({
        actionType: String(item.action_type || ''),
        signalId: item.signal_id ? String(item.signal_id) : null,
      })),
    };
  }

  async rankSignals(params: {
    userId: string;
    orgId: string;
    isPolish: boolean;
    profile: UserRadarProfileRecord;
    dynamicContext: RadarDynamicContext;
    signals: RadarProcessedSignal[];
  }): Promise<Array<{ signal: RadarProcessedSignal; ranked: RadarRankedSignal }>> {
    const { userId, orgId, isPolish, profile, dynamicContext, signals } = params;
    const roleTokens = toKeywordBag(profile.roles);
    const industryTokens = toKeywordBag(profile.industries);
    const trackedTopicTokens = toKeywordBag(profile.trackedTopics);
    const trackedCompanyTokens = toKeywordBag(profile.trackedCompanies);
    const recentContextTokens = toKeywordBag([
      ...dynamicContext.taskTitles,
      ...dynamicContext.decisionTitles,
      ...dynamicContext.ideaTitles,
      ...dynamicContext.noteTitles,
      ...dynamicContext.initiativeTitles,
      ...dynamicContext.calendarKeywords,
    ]);

    const mutedTopics = new Set(profile.mutedTopics.map((item) => item.toLowerCase()));
    const mutedSources = new Set(profile.mutedSources.map((item) => item.toLowerCase()));

    const rankedSignals: Array<{ signal: RadarProcessedSignal; ranked: RadarRankedSignal }> = [];

    for (const signal of signals) {
      const sourceName = String(signal.sourceName || '').toLowerCase();
      const signalText = [
        signal.normalizedTitle,
        ...signal.domainTags,
        ...signal.topicTags,
        ...signal.entityTags,
      ];

      if (signal.topicTags.some((topic) => mutedTopics.has(topic.toLowerCase()))) continue;
      if (sourceName && mutedSources.has(sourceName)) continue;

      const repeatedPenalty = signal.duplicateClusterId ? -6 : 0;
      const behaviorAdjustment =
        dynamicContext.recentActions.reduce((score, action) => {
          if (action.signalId !== signal.id) return score;
          if (action.actionType === 'save') return score + 3;
          if (action.actionType === 'ask_ai') return score + 2;
          if (action.actionType === 'less_like_this' || action.actionType === 'dismiss') return score - 3;
          return score;
        }, 0) + repeatedPenalty;

      const breakdown: RadarRelevanceBreakdown = {
        roleMatch: matchScore(roleTokens, signalText, profile.personalizationWeights.roleMatch || 15),
        industryMatch: matchScore(
          industryTokens,
          signalText,
          profile.personalizationWeights.industryMatch || 15
        ),
        projectMatch: matchScore(
          toKeywordBag([...dynamicContext.ideaTitles, ...dynamicContext.initiativeTitles]),
          signalText,
          profile.personalizationWeights.projectMatch || 20
        ),
        trackedTopicMatch: matchScore(
          trackedTopicTokens,
          signalText,
          profile.personalizationWeights.trackedTopicMatch || 15
        ),
        trackedCompanyMatch: matchScore(
          trackedCompanyTokens,
          signalText,
          profile.personalizationWeights.trackedCompanyMatch || 10
        ),
        recentWorkContextMatch: matchScore(
          recentContextTokens,
          signalText,
          profile.personalizationWeights.recentWorkContextMatch || 10
        ),
        freshness: Math.round((signal.freshnessScore / 100) * (profile.personalizationWeights.freshness || 5)),
        trust: Math.round((signal.trustScore / 100) * (profile.personalizationWeights.trust || 5)),
        actionability: Math.round(
          (signal.actionabilityScore / 100) * (profile.personalizationWeights.actionability || 5)
        ),
        behaviorAdjustment,
      };

      const finalScore = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
      const impactType = classifyImpactType(signal);
      const ranked: RadarRankedSignal = {
        id: uuidv4(),
        userId,
        signalId: signal.id,
        finalScore,
        relevanceBreakdown: breakdown,
        whyYouSeeThis: deriveWhyYouSeeThis(breakdown, signal, profile, isPolish),
        whyItMatters: deriveWhyItMatters(signal, impactType, isPolish),
        suggestedNextStep: deriveNextStep(signal, isPolish),
        impactType,
        confidenceScore: Math.min(
          0.98,
          Number((0.52 + Math.min(finalScore, 80) / 160).toFixed(2))
        ),
        relatedProjects: dynamicContext.initiativeTitles.slice(0, 2),
        relatedContext: [
          ...dynamicContext.taskTitles.slice(0, 2),
          ...dynamicContext.decisionTitles.slice(0, 1),
        ].filter(Boolean),
        generatedAt: new Date().toISOString(),
      };

      rankedSignals.push({ signal, ranked });
    }

    rankedSignals.sort((a, b) => b.ranked.finalScore - a.ranked.finalScore);

    for (const { signal, ranked } of rankedSignals.slice(0, 40)) {
      await queryHelpers.queryRun(
        `INSERT INTO radar_ranked_signals (
          id, user_id, organization_id, signal_id, final_score, relevance_breakdown_json,
          why_you_see_this, why_it_matters, suggested_next_step, impact_type, confidence_score,
          related_projects_json, related_context_json, generated_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, signal_id) DO UPDATE SET
          final_score = excluded.final_score,
          relevance_breakdown_json = excluded.relevance_breakdown_json,
          why_you_see_this = excluded.why_you_see_this,
          why_it_matters = excluded.why_it_matters,
          suggested_next_step = excluded.suggested_next_step,
          impact_type = excluded.impact_type,
          confidence_score = excluded.confidence_score,
          related_projects_json = excluded.related_projects_json,
          related_context_json = excluded.related_context_json,
          generated_at = excluded.generated_at,
          updated_at = CURRENT_TIMESTAMP`,
        [
          ranked.id,
          userId,
          orgId,
          signal.id,
          ranked.finalScore,
          JSON.stringify(ranked.relevanceBreakdown),
          ranked.whyYouSeeThis,
          ranked.whyItMatters,
          ranked.suggestedNextStep,
          ranked.impactType,
          ranked.confidenceScore,
          JSON.stringify(ranked.relatedProjects),
          JSON.stringify(ranked.relatedContext),
          ranked.generatedAt,
        ]
      );
    }

    return rankedSignals;
  }

  toSignalCard(
    signal: RadarProcessedSignal,
    ranked: RadarRankedSignal,
    localization?: {
      sourceLanguage?: string;
      requestedLanguage?: string;
      isLocalized?: boolean;
      localizationPending?: boolean;
    }
  ): RadarSignalCard {
    const metadata = signal.metadata || {};
    const rawTitle =
      typeof metadata.originalTitle === 'string' && metadata.originalTitle.trim().length > 0
        ? metadata.originalTitle.trim()
        : signal.normalizedTitle;
    const resolvedTitle =
      localization?.isLocalized && signal.normalizedTitle
        ? signal.normalizedTitle
        : rawTitle || signal.normalizedTitle || signal.summaryShort;
    const resolvedContentLanguage =
      localization?.isLocalized && localization?.requestedLanguage
        ? localization.requestedLanguage
        : localization?.sourceLanguage || 'en';
    return {
      id: ranked.id,
      signalId: signal.id,
      title: resolvedTitle,
      summary: signal.summaryShort,
      insightSummary: signal.summaryLong || signal.summaryShort,
      whyItMatters: ranked.whyItMatters,
      whyYouSeeThis: ranked.whyYouSeeThis,
      suggestedNextStep: ranked.suggestedNextStep,
      source: {
        id: signal.sourceId,
        name: signal.sourceName || 'Source',
        category: signal.sourceCategory || 'market',
        trustScore: signal.sourceTrustScore || signal.trustScore / 100,
        url: signal.canonicalUrl,
      },
      tags: {
        domains: signal.domainTags,
        topics: signal.topicTags,
        entities: signal.entityTags,
      },
      contentType: signal.contentType,
      relevanceScope: signal.relevanceScope,
      businessImpact: signal.businessImpact,
      actionability: signal.actionability,
      durability: signal.durability,
      impactType: ranked.impactType,
      confidenceScore: ranked.confidenceScore,
      freshnessScore: signal.freshnessScore,
      finalScore: ranked.finalScore,
      publishedAt: signal.publishedAt || null,
      relatedContext: ranked.relatedContext,
      contentLanguage: resolvedContentLanguage,
      requestedLanguage: localization?.requestedLanguage || localization?.sourceLanguage || 'en',
      isLocalized: localization?.isLocalized ?? true,
      localizationPending: localization?.localizationPending ?? false,
    };
  }
}

export const radarRankingService = new RadarRankingService();
