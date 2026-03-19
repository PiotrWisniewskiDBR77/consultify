export type HomeTimeMode = 'morning' | 'liveDay' | 'eveningWrap';

export type HomeBlockId =
  | 'aiPulseCore'
  | 'momentum'
  | 'sparkField'
  | 'decisionTemperature'
  | 'industryLens'
  | 'executionCurrent'
  | 'teamSignal'
  | 'commandDock';

export type HomeBlockSize = 'sm' | 'md' | 'lg' | 'hero';
export type HomeBlockAccent = 'ai' | 'warm' | 'cool' | 'alert' | 'success' | 'neutral';

export type HomeEntityType =
  | 'home'
  | 'idea'
  | 'note'
  | 'task'
  | 'decision'
  | 'industry_signal'
  | 'transformation_signal';

export interface HomeBlockLayout {
  blockId: HomeBlockId;
  visible: boolean;
  pinned?: boolean;
  priorityOverride?: number | null;
  sizeOverride?: HomeBlockSize | null;
}

export interface HomeLayoutConfig {
  blockLayouts: HomeBlockLayout[];
  ambientMotion: 'soft' | 'full';
}

export interface HomeChatContextPacket {
  sourceBlock: HomeBlockId;
  intent: string;
  title: string;
  starterPrompt: string;
  entityType?: HomeEntityType;
  entityId?: string;
  entityName?: string;
  contextData?: Record<string, unknown>;
}

export type HomeScreenAction =
  | { type: 'chat'; packet: HomeChatContextPacket }
  | { type: 'navigate'; target: 'ideas' | 'notebook' | 'calendar' | 'tasks' | 'decisions' | 'manager' }
  | { type: 'open'; target: 'idea' | 'note' | 'task' | 'decision'; id: string }
  | { type: 'create'; target: 'idea' | 'note' | 'task' | 'decision' };

export interface HomeFocusItem {
  id: string;
  type: 'task' | 'decision' | 'idea';
  title: string;
  meta: string;
  priority: 'high' | 'medium' | 'low';
}

export interface HomeSignalCard {
  id: string;
  title: string;
  summary: string;
  tag: string;
  tone?: 'positive' | 'warning' | 'neutral';
  entityType?: HomeEntityType;
  entityId?: string;
}

export interface SparkItem {
  id: string;
  type: 'idea' | 'note';
  title: string;
  snippet: string;
  stage?: string;
  updatedAt: string;
  nodeCount?: number;
  taskCount?: number;
}

export interface HomeTip {
  id: string;
  titleEn: string;
  titlePl: string;
  bodyEn: string;
  bodyPl: string;
  tags?: string[];
}

export interface HomeNewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt?: string;
  summary?: string;
}

export interface PeerTipItem {
  id: string;
  text: string;
  authorName?: string;
  createdAt: string;
}

export interface UpcomingEventItem {
  id: string;
  source: 'task' | 'decision' | 'initiative';
  title: string;
  date: string;
  urgency: 'overdue' | 'today' | 'soon';
}

export interface AIPulseCorePayload {
  greeting: string;
  headline: string;
  summary: string;
  insight: string;
  weekProgress: number;
  pulseScore: number;
  focusItems: HomeFocusItem[];
  appTipOfDay?: HomeTip | null;
  aiPlaybookTip?: HomeTip | null;
}

export interface MomentumPayload {
  headline: string;
  summary: string;
  stats: Array<{ label: string; value: string; trend: string }>;
  signals: HomeSignalCard[];
}

export interface SparkFieldPayload {
  ideas: SparkItem[];
  notes: SparkItem[];
  nudge: { text: string; ideaId: string } | null;
  orgIdeas?: SparkItem[];
}

export interface DecisionTemperaturePayload {
  pendingCount: number;
  blockedCount: number;
  hottestDecision: {
    id: string;
    title: string;
    ownerLabel: string;
    priority: string;
    deadlineLabel: string;
  } | null;
  signals: HomeSignalCard[];
}

export interface IndustryLensPayload {
  industryLabel: string;
  roleLens: string;
  marketSignal: HomeSignalCard;
  technologySignal: HomeSignalCard;
  aiNews?: HomeNewsItem[];
  benchmark: {
    label: string;
    value: string;
    delta: string;
    implication: string;
  };
  peerCase: {
    title: string;
    summary: string;
    implication: string;
  };
}

export interface ExecutionCurrentPayload {
  headline: string;
  streams: Array<{
    id: string;
    label: string;
    progressLabel: string;
    status: 'accelerating' | 'steady' | 'blocked';
    entityType?: HomeEntityType;
    entityId?: string;
  }>;
  nextUp?: UpcomingEventItem[];
}

export interface TeamSignalPayload {
  headline: string;
  summary: string;
  signals: Array<{
    id: string;
    title: string;
    detail: string;
    tone: 'positive' | 'warning' | 'neutral';
  }>;
  peerTips?: PeerTipItem[];
}

export interface CommandDockPayload {
  actions: Array<{
    id: string;
    label: string;
    kind: 'create' | 'navigate' | 'chat';
    target?: 'idea' | 'note' | 'task' | 'decision' | 'ideas' | 'notebook' | 'calendar' | 'tasks';
    starterPrompt?: string;
  }>;
}

export type HomeBlockPayloadMap = {
  aiPulseCore: AIPulseCorePayload;
  momentum: MomentumPayload;
  sparkField: SparkFieldPayload;
  decisionTemperature: DecisionTemperaturePayload;
  industryLens: IndustryLensPayload;
  executionCurrent: ExecutionCurrentPayload;
  teamSignal: TeamSignalPayload;
  commandDock: CommandDockPayload;
};

export type HomeBlock = {
  [K in HomeBlockId]: {
    id: K;
    title: string;
    subtitle?: string;
    accent: HomeBlockAccent;
    size: HomeBlockSize;
    priorityWeight: number;
    relevanceScore: number;
    freshnessScore: number;
    ctaIntents: string[];
    payload: HomeBlockPayloadMap[K];
  };
}[HomeBlockId];

export interface HomeScreenData {
  timeMode: HomeTimeMode;
  updatedAt: string;
  pulseLabel: string;
  blocks: HomeBlock[];
}

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
    domains: string[];
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
