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

export interface AIPulseCorePayload {
  greeting: string;
  headline: string;
  summary: string;
  insight: string;
  weekProgress: number;
  pulseScore: number;
  focusItems: HomeFocusItem[];
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
