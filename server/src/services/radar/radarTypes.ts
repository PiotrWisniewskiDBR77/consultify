export type RadarSourceType =
  | 'rss'
  | 'blog'
  | 'news_provider'
  | 'company_newsroom'
  | 'documentation_feed'
  | 'analyst_source'
  | 'manual';

export type RadarContentType =
  | 'news'
  | 'article'
  | 'guide'
  | 'how_to'
  | 'case_study'
  | 'regulation'
  | 'competitor_move'
  | 'tool_tip'
  | 'opinion'
  | 'weak_signal';

export type RadarDomain =
  | 'AI'
  | 'transformation'
  | 'operations'
  | 'product'
  | 'leadership'
  | 'execution'
  | 'compliance'
  | 'cyber'
  | 'market'
  | 'competition';

export type RadarRelevanceScope =
  | 'general'
  | 'role_specific'
  | 'industry_specific'
  | 'company_specific'
  | 'project_specific';

export type RadarImpactLevel = 'low' | 'medium' | 'high';
export type RadarDurability = 'hot' | 'current' | 'evergreen';
export type RadarImpactType =
  | 'strategic'
  | 'operational'
  | 'commercial'
  | 'product'
  | 'risk'
  | 'compliance'
  | 'learning';

export type RadarRing = 'NOW' | 'PREPARE' | 'LEARN' | 'OBSERVE';
export type RadarQuadrant = 'MY_DEVELOPMENT' | 'MY_PROJECTS' | 'MY_INDUSTRY' | 'MY_ROLE';
export type RadarSignalStatus = 'new' | 'updated' | 'saved' | 'watching' | 'ignored';
export type RadarSignalType =
  | 'TECHNOLOGY'
  | 'SKILL'
  | 'BUSINESS'
  | 'RISK'
  | 'PROCESS'
  | 'TOOL'
  | 'TREND'
  | 'IDEA';

export type RadarActionType =
  | 'view_briefing'
  | 'open_signal'
  | 'ask_ai'
  | 'save'
  | 'add_to_note'
  | 'create_task'
  | 'add_to_decision'
  | 'add_to_watchlist'
  | 'more_like_this'
  | 'less_like_this'
  | 'dismiss';

export interface RadarSourceRecord {
  id: string;
  name: string;
  sourceType: RadarSourceType;
  url: string;
  category: string;
  language: string;
  trustScore: number;
  refreshFrequencyMinutes: number;
  active: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  lastFetchedAt?: string | null;
  nextRefreshAt?: string | null;
}

export interface RadarRawItem {
  id: string;
  sourceId: string;
  title: string;
  rawText: string;
  rawHtml?: string | null;
  canonicalUrl: string;
  author?: string | null;
  publishedAt?: string | null;
  fetchedAt: string;
  language?: string | null;
  metadata: Record<string, unknown>;
  contentHash?: string | null;
}

export interface RadarProcessedSignal {
  id: string;
  rawItemId: string;
  sourceId: string;
  normalizedTitle: string;
  summaryShort: string;
  summaryLong: string;
  contentType: RadarContentType;
  domainTags: RadarDomain[];
  topicTags: string[];
  entityTags: string[];
  relevanceScope: RadarRelevanceScope;
  businessImpact: RadarImpactLevel;
  actionability: RadarImpactLevel;
  durability: RadarDurability;
  freshnessScore: number;
  impactScore: number;
  actionabilityScore: number;
  trustScore: number;
  duplicateClusterId?: string | null;
  status: string;
  signalKind: 'external' | 'educational' | 'internal';
  metadata: Record<string, unknown>;
  sourceName?: string;
  sourceCategory?: string;
  sourceTrustScore?: number;
  canonicalUrl?: string;
  publishedAt?: string | null;
}

export interface UserRadarProfileRecord {
  userId: string;
  organizationId: string;
  roles: string[];
  industries: string[];
  seniority?: string | null;
  region?: string | null;
  trackedTopics: string[];
  trackedCompanies: string[];
  mutedTopics: string[];
  mutedSources: string[];
  preferredContentTypes: string[];
  strategicInterests: string[];
  personalizationWeights: Record<string, number>;
}

export interface RadarDynamicContext {
  taskTitles: string[];
  decisionTitles: string[];
  ideaTitles: string[];
  noteTitles: string[];
  initiativeTitles: string[];
  calendarKeywords: string[];
  recentActions: Array<{ actionType: string; signalId?: string | null }>;
}

export interface RadarRelevanceBreakdown {
  roleMatch: number;
  industryMatch: number;
  projectMatch: number;
  trackedTopicMatch: number;
  trackedCompanyMatch: number;
  recentWorkContextMatch: number;
  freshness: number;
  trust: number;
  actionability: number;
  behaviorAdjustment: number;
}

export interface RadarRankedSignal {
  id: string;
  userId: string;
  signalId: string;
  finalScore: number;
  relevanceBreakdown: RadarRelevanceBreakdown;
  whyYouSeeThis: string;
  whyItMatters: string;
  suggestedNextStep: string;
  impactType: RadarImpactType;
  confidenceScore: number;
  relatedProjects: string[];
  relatedContext: string[];
  generatedAt: string;
}

export interface RadarSignalCard {
  id: string;
  signalId: string;
  title: string;
  summary: string;
  insightSummary: string;
  whyItMatters: string;
  whyYouSeeThis: string;
  suggestedNextStep: string;
  source: {
    id: string;
    name: string;
    category: string;
    trustScore: number;
    url?: string;
  };
  tags: {
    domains: RadarDomain[];
    topics: string[];
    entities: string[];
  };
  contentType: RadarContentType;
  relevanceScope: RadarRelevanceScope;
  businessImpact: RadarImpactLevel;
  actionability: RadarImpactLevel;
  durability: RadarDurability;
  impactType: RadarImpactType;
  confidenceScore: number;
  freshnessScore: number;
  finalScore: number;
  publishedAt?: string | null;
  relatedContext: string[];
  contentLanguage?: string;
  requestedLanguage?: string;
  isLocalized?: boolean;
  localizationPending?: boolean;
  ring?: RadarRing;
  quadrant?: RadarQuadrant;
  status?: RadarSignalStatus;
  signalType?: RadarSignalType;
  preview?: {
    shortDescription: string;
    whyItMatters: string;
    whyItMattersForYou: string;
    howToThinkAboutIt: string;
    goodFirstQuestion: string;
    suggestedNextStep: string;
  };
}

export interface RadarRecommendation {
  id: string;
  kind: 'action' | 'question' | 'risk' | 'opportunity';
  title: string;
  body: string;
  signalId?: string;
}

export interface RadarViewPayload {
  generatedAt: string;
  profile: {
    trackedTopics: string[];
    trackedCompanies: string[];
    mutedTopics: string[];
    mutedSources: string[];
  };
  dailyBriefing: {
    mainInsight: string;
    keySignals: RadarSignalCard[];
    recommendedMove: RadarRecommendation | null;
  };
  whatChanged: RadarSignalCard[];
  whyItMattersToMe: RadarSignalCard[];
  whatToDoNext: RadarRecommendation[];
  learnImprove: RadarSignalCard[];
  watchlist: RadarSignalCard[];
  radarMap?: {
    signals: Array<{
      id: string;
      name: string;
      icon?: string;
      ring: RadarRing;
      quadrant: RadarQuadrant;
      status: RadarSignalStatus;
      signalType: RadarSignalType;
      importanceLevel: 'small' | 'medium' | 'large';
      fitLevel: 'low' | 'medium' | 'high';
      /** Real relevance score (0–120) — drives radius within the ring band. */
      score: number;
      /** Model confidence 0–1. */
      confidence: number;
      sourceName: string;
      sourceUrl?: string;
      topic?: string;
      entity?: string;
      publishedAt?: string | null;
      preview: {
        shortDescription: string;
        whyItMatters: string;
        whyItMattersForYou: string;
        howToThinkAboutIt: string;
        goodFirstQuestion: string;
        suggestedNextStep: string;
      };
    }>;
  };
  metrics: {
    totalSignalsConsidered: number;
    duplicateRate: number;
    actionedSignalsLast30d: number;
    savedSignalsLast30d: number;
  };
  localization: {
    requestedLanguage: string;
    pendingCount: number;
  };
}
