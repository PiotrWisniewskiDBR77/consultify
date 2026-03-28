import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Api from '@/services/api';

import type {
  HomeBlock,
  HomeBlockId,
  HomeBlockLayout,
  HomeBlockSize,
  HomeLayoutConfig,
  HomePrimaryAction,
  HomeScreenData,
  SparkItem,
} from './homeV2Types';

export type {
  AIPulseCorePayload,
  CommandDockPayload,
  DecisionTemperaturePayload,
  ExecutionCurrentPayload,
  HomeBlock,
  HomeBlockAccent,
  HomeBlockId,
  HomeBlockLayout,
  HomeBlockSize,
  HomeChatContextPacket,
  HomeFocusItem,
  HomeLayoutConfig,
  HomeScreenAction,
  HomeScreenData,
  HomeSignalCard,
  HomeTimeMode,
  IndustryLensPayload,
  MomentumPayload,
  SparkFieldPayload,
  SparkItem,
  TeamSignalPayload,
} from './homeV2Types';

export type HomeZoneId = 'brief' | 'spark' | 'pulse' | 'nudge';

export interface HomeBriefData {
  weekProgress: number;
  insight?: string;
  focusItems: Array<{
    id: string;
    type: 'task' | 'decision' | 'idea';
    title: string;
    meta: string;
  }>;
}

export interface SparkData {
  ideas: SparkItem[];
  notes: SparkItem[];
  aiNudge?: {
    text: string;
    action: string;
    ideaId: string;
  };
}

export interface PulseArticle {
  id: string;
  category: 'all' | 'ai_tech' | 'industry' | 'consulting' | 'clients';
  title: string;
  summary: string;
}

export interface PulseData {
  articles: PulseArticle[];
  frameworkOfDay?: {
    name: string;
    description: string;
  };
  benchmark?: {
    title: string;
    label: string;
    value: string;
    change: string;
  };
}

export interface NudgeData {
  pendingDecisions: number;
  overdueTasks: number;
  message?: string;
}

export interface HomeData {
  screen: HomeScreenData;
  blocks: HomeBlock[];
  layout: HomeLayoutConfig;
  brief: HomeBriefData | null;
  spark: SparkData | null;
  pulse: PulseData | null;
  nudge: NudgeData | null;
  loading: boolean;
  error: string | null;
  updateLayout: (layout: HomeLayoutConfig) => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_LAYOUT: HomeLayoutConfig = {
  ambientMotion: 'full',
  blockLayouts: [
    { blockId: 'aiPulseCore', visible: true, pinned: true },
    { blockId: 'momentum', visible: true },
    { blockId: 'sparkField', visible: true, pinned: true },
    { blockId: 'decisionTemperature', visible: true },
    { blockId: 'industryLens', visible: true },
    { blockId: 'executionCurrent', visible: true },
    { blockId: 'teamSignal', visible: true },
    { blockId: 'commandDock', visible: true, pinned: true },
  ],
};

const MOCK_SCREEN: HomeScreenData = {
  timeMode: 'liveDay',
  updatedAt: new Date().toISOString(),
  pulseLabel: 'Transformation pulse is rising',
  blocks: [
    {
      id: 'aiPulseCore',
      title: 'AI Pulse Core',
      subtitle: 'What matters most right now',
      accent: 'ai',
      size: 'hero',
      priorityWeight: 96,
      relevanceScore: 94,
      freshnessScore: 84,
      ctaIntents: ['plan', 'challenge', 'summarize'],
      payload: {
        greeting: 'Good morning',
        headline: 'Your transformation narrative needs one decisive move today.',
        summary:
          'Execution is moving, but leadership attention is still fragmented across approval, sequencing, and idea shaping.',
        insight:
          'Manufacturing leaders are shifting from isolated pilots to operating-model redesign. This is the right moment to convert your strongest idea into a real transformation lane.',
        weekProgress: 42,
        pulseScore: 77,
        focusItems: [
          {
            id: 'task-brief-1',
            type: 'task',
            title: 'Finalize the transformation steering brief',
            meta: 'Due today · leadership-facing',
            priority: 'high',
          },
          {
            id: 'decision-brief-1',
            type: 'decision',
            title: 'Approve pilot sequencing for the plant AI rollout',
            meta: '2 stakeholders waiting',
            priority: 'high',
          },
          {
            id: 'idea-brief-1',
            type: 'idea',
            title: 'AI quality inspection opportunity',
            meta: 'Strong cross-functional pull',
            priority: 'medium',
          },
        ],
      },
    },
    {
      id: 'momentum',
      title: 'Momentum',
      subtitle: 'Where the program is gaining speed',
      accent: 'success',
      size: 'lg',
      priorityWeight: 84,
      relevanceScore: 88,
      freshnessScore: 70,
      ctaIntents: ['summarize', 'prioritize'],
      payload: {
        headline: 'Three threads moved forward since yesterday.',
        summary:
          'Momentum is strongest in ideation and execution prep, but decision flow is still constraining scale.',
        stats: [
          { label: 'Ideas shaped', value: '3', trend: '+2 vs yesterday' },
          { label: 'Tasks closed', value: '7', trend: 'steady flow' },
          { label: 'Decisions pending', value: '2', trend: 'needs attention' },
        ],
        signals: [
          {
            id: 'momentum-signal-1',
            title: 'Pilot narrative has sharpened',
            summary: 'The strongest AI initiative now has clear value language for executives.',
            tag: 'Strategy',
            tone: 'positive',
          },
          {
            id: 'momentum-signal-2',
            title: 'Execution prep is improving',
            summary: 'Two workstreams have concrete owners and near-term next steps.',
            tag: 'Execution',
            tone: 'positive',
          },
          {
            id: 'momentum-signal-3',
            title: 'Decision lag is visible',
            summary: 'One unresolved approval is now shaping the pacing of the week.',
            tag: 'Decision',
            tone: 'warning',
          },
        ],
      },
    },
    {
      id: 'sparkField',
      title: 'Spark Field',
      subtitle: 'Ideas and notes with transformation gravity',
      accent: 'warm',
      size: 'lg',
      priorityWeight: 90,
      relevanceScore: 93,
      freshnessScore: 82,
      ctaIntents: ['expand', 'convert', 'challenge'],
      payload: {
        ideas: [
          {
            id: 'idea-1',
            type: 'idea',
            title: 'AI quality inspection lane',
            snippet:
              'Move from manual defect review to AI-assisted quality triage in the highest-loss line.',
            stage: 'shaping',
            updatedAt: '48 min ago',
            nodeCount: 6,
            taskCount: 2,
          },
          {
            id: 'idea-2',
            type: 'idea',
            title: 'Scheduling control tower',
            snippet:
              'A transformation concept for planners: exception handling, risk visibility, and AI what-if scenarios.',
            stage: 'growing',
            updatedAt: 'Yesterday',
            nodeCount: 9,
            taskCount: 1,
          },
        ],
        notes: [
          {
            id: 'note-1',
            type: 'note',
            title: 'Workshop synthesis: plant leadership',
            snippet:
              'The plant team is aligned on value pools, but sequencing between quality and planning still needs a decision.',
            updatedAt: '2h ago',
          },
          {
            id: 'note-2',
            type: 'note',
            title: 'Transformation narrative draft',
            snippet:
              'This note frames the program as capability-building, not just automation delivery.',
            updatedAt: 'Yesterday',
          },
        ],
        nudge: {
          text: 'The strongest idea still lacks a formal initiative and owner. This is the cleanest unlock available.',
          ideaId: 'idea-1',
        },
      },
    },
    {
      id: 'decisionTemperature',
      title: 'Decision Temperature',
      subtitle: 'Where approvals and blockers are heating up',
      accent: 'alert',
      size: 'md',
      priorityWeight: 87,
      relevanceScore: 86,
      freshnessScore: 76,
      ctaIntents: ['analyze', 'draft', 'unblock'],
      payload: {
        pendingCount: 4,
        blockedCount: 2,
        hottestDecision: {
          id: 'decision-1',
          title: 'Approve rollout sequence for plant AI quality pilot',
          ownerLabel: 'Operations + Transformation Office',
          priority: 'High',
          deadlineLabel: 'Needs closure this week',
        },
        signals: [
          {
            id: 'decision-temp-1',
            title: 'One unresolved approval is slowing three downstream tasks.',
            summary: 'The impact is now visible across execution sequencing.',
            tag: 'Blocker',
            tone: 'warning',
          },
          {
            id: 'decision-temp-2',
            title: 'A draft exists, but trade-offs are not yet explicit.',
            summary: 'This is a good candidate for AI-assisted decision framing.',
            tag: 'AI assist',
            tone: 'neutral',
          },
        ],
      },
    },
    {
      id: 'industryLens',
      title: 'Industry Lens',
      subtitle: 'External signals filtered for transformation relevance',
      accent: 'cool',
      size: 'lg',
      priorityWeight: 82,
      relevanceScore: 85,
      freshnessScore: 79,
      ctaIntents: ['compare', 'explore', 'translate'],
      payload: {
        industryLabel: 'Manufacturing',
        roleLens: 'Transformation lead',
        marketSignal: {
          id: 'industry-market',
          title: 'Energy volatility is reshaping transformation payback cases',
          summary:
            'Manufacturing programs with energy and planning levers are now being funded faster than isolated automation pilots.',
          tag: 'Market signal',
          tone: 'warning',
        },
        technologySignal: {
          id: 'industry-tech',
          title: 'Computer vision pilots are shifting into operating model redesign',
          summary:
            'Leaders are no longer buying “AI inspection” alone. They are redesigning triage, escalation, and quality governance around it.',
          tag: 'Technology signal',
          tone: 'positive',
        },
        benchmark: {
          label: 'Transformation benchmark',
          value: '14-18%',
          delta: 'value uplift in 12 months',
          implication:
            'Programs that combine quality + planning + governance outperform isolated pilots.',
        },
        peerCase: {
          title: 'Tier-1 supplier reframed AI from tool to operating lane',
          summary:
            'Instead of launching another PoC, they created one cross-functional lane with KPIs, owners, and weekly decision cadences.',
          implication: 'Your current strongest idea would benefit from the same reframing.',
        },
      },
    },
    {
      id: 'executionCurrent',
      title: 'Execution Current',
      subtitle: 'What is moving in transformation execution',
      accent: 'cool',
      size: 'md',
      priorityWeight: 78,
      relevanceScore: 81,
      freshnessScore: 65,
      ctaIntents: ['sequence', 'review'],
      payload: {
        headline: 'Execution is flowing, but one lane still needs a decision.',
        streams: [
          {
            id: 'task-stream-1',
            label: 'Steering brief',
            progressLabel: 'Ready for review',
            status: 'accelerating',
            entityType: 'task',
            entityId: 'task-brief-1',
          },
          {
            id: 'task-stream-2',
            label: 'Pilot business case',
            progressLabel: 'Data inputs collected',
            status: 'steady',
            entityType: 'task',
            entityId: 'task-business-case',
          },
          {
            id: 'decision-stream-3',
            label: 'Rollout sequence approval',
            progressLabel: 'Waiting on sponsor alignment',
            status: 'blocked',
            entityType: 'decision',
            entityId: 'decision-1',
          },
        ],
      },
    },
    {
      id: 'teamSignal',
      title: 'Team Signal',
      subtitle: 'How the program feels across people and alignment',
      accent: 'neutral',
      size: 'md',
      priorityWeight: 74,
      relevanceScore: 77,
      freshnessScore: 61,
      ctaIntents: ['summarize', 'prepare'],
      payload: {
        headline: 'The team is contributing, but alignment still needs narrative clarity.',
        summary: 'You have enough energy in the system. The risk is fragmentation, not inactivity.',
        signals: [
          {
            id: 'team-1',
            title: 'Leadership attention is available',
            detail: 'The window is open for one strong transformation story this week.',
            tone: 'positive',
          },
          {
            id: 'team-2',
            title: 'Cross-functional pull is emerging',
            detail: 'Quality and planning are converging around the same opportunity.',
            tone: 'positive',
          },
          {
            id: 'team-3',
            title: 'Narrative fragmentation remains',
            detail: 'Different stakeholders still describe the initiative in different ways.',
            tone: 'warning',
          },
        ],
      },
    },
    {
      id: 'commandDock',
      title: 'Command Dock',
      subtitle: 'Immediate moves',
      accent: 'neutral',
      size: 'hero',
      priorityWeight: 100,
      relevanceScore: 100,
      freshnessScore: 100,
      ctaIntents: ['create', 'navigate', 'chat'],
      payload: {
        actions: [
          { id: 'new-idea', label: '+ Idea', kind: 'create', target: 'idea' },
          { id: 'new-note', label: '+ Note', kind: 'create', target: 'note' },
          { id: 'new-task', label: '+ Task', kind: 'create', target: 'task' },
          { id: 'new-decision', label: '+ Decision', kind: 'create', target: 'decision' },
          { id: 'open-calendar', label: 'Calendar', kind: 'navigate', target: 'calendar' },
          {
            id: 'ask-ai',
            label: 'Ask AI',
            kind: 'chat',
            starterPrompt:
              'Help me understand what deserves the highest attention in this transformation right now.',
          },
        ],
      },
    },
  ],
};

function cloneMockScreen(): HomeScreenData {
  return JSON.parse(JSON.stringify(MOCK_SCREEN)) as HomeScreenData;
}

function createEmptyScreen(): HomeScreenData {
  return {
    ...cloneMockScreen(),
    updatedAt: new Date().toISOString(),
    blocks: [],
  };
}

function getDefaultLayout(): HomeLayoutConfig {
  return JSON.parse(JSON.stringify(DEFAULT_LAYOUT)) as HomeLayoutConfig;
}

function isValidBlockSize(value: unknown): value is HomeBlockSize {
  return value === 'sm' || value === 'md' || value === 'lg' || value === 'hero';
}

function sanitizeLayout(value: unknown): HomeLayoutConfig {
  const fallback = getDefaultLayout();
  if (!value || typeof value !== 'object') return fallback;

  const input = value as Partial<HomeLayoutConfig>;
  const incomingLayouts = Array.isArray(input.blockLayouts) ? input.blockLayouts : [];
  const validIds = new Set<HomeBlockId>(fallback.blockLayouts.map((block) => block.blockId));
  const seen = new Set<HomeBlockId>();

  const normalized: HomeBlockLayout[] = incomingLayouts
    .filter((entry): entry is HomeBlockLayout & { blockId: HomeBlockId } => {
      return (
        !!entry &&
        typeof entry === 'object' &&
        typeof entry.blockId === 'string' &&
        validIds.has(entry.blockId as HomeBlockId) &&
        !seen.has(entry.blockId as HomeBlockId)
      );
    })
    .map((entry) => {
      seen.add(entry.blockId as HomeBlockId);
      return {
        blockId: entry.blockId as HomeBlockId,
        visible: entry.visible !== false,
        pinned: entry.pinned === true,
        priorityOverride:
          typeof entry.priorityOverride === 'number' ? entry.priorityOverride : undefined,
        sizeOverride: isValidBlockSize(entry.sizeOverride) ? entry.sizeOverride : undefined,
      };
    });

  for (const defaultEntry of fallback.blockLayouts) {
    if (!seen.has(defaultEntry.blockId)) {
      normalized.push(defaultEntry);
    }
  }

  return {
    ambientMotion: input.ambientMotion === 'soft' ? 'soft' : 'full',
    blockLayouts: normalized,
  };
}

function mergeBlocksWithLayout(blocks: HomeBlock[], layout: HomeLayoutConfig): HomeBlock[] {
  const indexMap = new Map(layout.blockLayouts.map((item, index) => [item.blockId, index]));
  const layoutMap = new Map(layout.blockLayouts.map((item) => [item.blockId, item]));

  return [...blocks]
    .map((block) => {
      const override = layoutMap.get(block.id);
      return {
        ...block,
        size: override?.sizeOverride || block.size,
        priorityWeight: override?.priorityOverride ?? block.priorityWeight,
      } as HomeBlock;
    })
    .filter((block) => layoutMap.get(block.id)?.visible !== false)
    .sort((left, right) => {
      const leftLayout = layoutMap.get(left.id);
      const rightLayout = layoutMap.get(right.id);
      if (leftLayout?.pinned && !rightLayout?.pinned) return -1;
      if (!leftLayout?.pinned && rightLayout?.pinned) return 1;
      const orderDiff = (indexMap.get(left.id) ?? 999) - (indexMap.get(right.id) ?? 999);
      if (orderDiff !== 0) return orderDiff;
      return right.priorityWeight - left.priorityWeight;
    });
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function getBlockPayload(screen: HomeScreenData, blockId: HomeBlockId): Record<string, any> {
  return asObject(screen.blocks.find((block) => block.id === blockId)?.payload);
}

function buildLegacyBrief(screen: HomeScreenData): HomeBriefData | null {
  const payload = getBlockPayload(screen, 'aiPulseCore');
  const focusItems = Array.isArray(payload.focusItems)
    ? payload.focusItems
        .filter(
          (item: any) => item && typeof item.id === 'string' && typeof item.title === 'string'
        )
        .map((item: any) => ({
          id: item.id,
          type:
            item.type === 'task' || item.type === 'decision' || item.type === 'idea'
              ? item.type
              : 'idea',
          title: item.title,
          meta: item.meta || '',
        }))
    : [];

  if (!focusItems.length && !payload.insight) return null;

  return {
    weekProgress: typeof payload.weekProgress === 'number' ? payload.weekProgress : 0,
    insight: typeof payload.insight === 'string' ? payload.insight : undefined,
    focusItems,
  };
}

function buildLegacySpark(screen: HomeScreenData): SparkData | null {
  const payload = getBlockPayload(screen, 'sparkField');
  const ideas = Array.isArray(payload.ideas) ? payload.ideas : [];
  const notes = Array.isArray(payload.notes) ? payload.notes : [];

  if (!ideas.length && !notes.length) return null;

  return {
    ideas: ideas.map((item: any) => ({
      id: String(item.id || ''),
      type: 'idea' as const,
      title: String(item.title || ''),
      snippet: String(item.snippet || ''),
      stage: typeof item.stage === 'string' ? item.stage : undefined,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
      nodeCount: typeof item.nodeCount === 'number' ? item.nodeCount : undefined,
      taskCount: typeof item.taskCount === 'number' ? item.taskCount : undefined,
    })),
    notes: notes.map((item: any) => ({
      id: String(item.id || ''),
      type: 'note' as const,
      title: String(item.title || ''),
      snippet: String(item.snippet || ''),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
    })),
    aiNudge:
      payload.nudge && typeof payload.nudge === 'object'
        ? {
            text: String(payload.nudge.text || ''),
            action: 'Explore',
            ideaId: String(payload.nudge.ideaId || ''),
          }
        : undefined,
  };
}

function buildLegacyPulse(screen: HomeScreenData): PulseData | null {
  const payload = getBlockPayload(screen, 'industryLens');
  const articles: PulseArticle[] = [];

  if (payload.marketSignal) {
    articles.push({
      id: String(payload.marketSignal.id || 'industry-market'),
      category: 'industry',
      title: String(payload.marketSignal.title || ''),
      summary: String(payload.marketSignal.summary || ''),
    });
  }

  if (payload.technologySignal) {
    articles.push({
      id: String(payload.technologySignal.id || 'industry-tech'),
      category: 'ai_tech',
      title: String(payload.technologySignal.title || ''),
      summary: String(payload.technologySignal.summary || ''),
    });
  }

  if (!articles.length && !payload.benchmark && !payload.peerCase) return null;

  return {
    articles,
    frameworkOfDay: payload.peerCase
      ? {
          name: String(payload.peerCase.title || 'Case of the day'),
          description: String(payload.peerCase.summary || ''),
        }
      : undefined,
    benchmark: payload.benchmark
      ? {
          title: 'Benchmark',
          label: String(payload.benchmark.label || ''),
          value: String(payload.benchmark.value || ''),
          change: String(payload.benchmark.delta || ''),
        }
      : undefined,
  };
}

function buildLegacyNudge(screen: HomeScreenData): NudgeData | null {
  const decisionPayload = getBlockPayload(screen, 'decisionTemperature');
  const executionPayload = getBlockPayload(screen, 'executionCurrent');

  const pendingDecisions =
    typeof decisionPayload.pendingCount === 'number' ? decisionPayload.pendingCount : 0;
  const overdueTasks = Array.isArray(executionPayload.streams)
    ? executionPayload.streams.filter((stream: any) => stream?.status === 'blocked').length
    : 0;

  const message =
    typeof executionPayload.headline === 'string'
      ? executionPayload.headline
      : typeof decisionPayload.hottestDecision?.title === 'string'
        ? decisionPayload.hottestDecision.title
        : undefined;

  if (!pendingDecisions && !overdueTasks && !message) return null;

  return {
    pendingDecisions,
    overdueTasks,
    message,
  };
}

function buildCommandPrimaryAction(screen: HomeScreenData): HomePrimaryAction | null {
  const aiPulsePayload = getBlockPayload(screen, 'aiPulseCore');
  const topFocusItem = Array.isArray(aiPulsePayload.focusItems) ? aiPulsePayload.focusItems[0] : null;

  if (topFocusItem && typeof topFocusItem.id === 'string' && typeof topFocusItem.title === 'string') {
    const target =
      topFocusItem.type === 'idea' || topFocusItem.type === 'task' || topFocusItem.type === 'decision'
        ? topFocusItem.type
        : 'idea';

    return {
      title: String(topFocusItem.title),
      helper:
        typeof topFocusItem.meta === 'string' && topFocusItem.meta.trim().length > 0
          ? String(topFocusItem.meta)
          : typeof aiPulsePayload.summary === 'string'
            ? String(aiPulsePayload.summary)
            : '',
      action: {
        type: 'open',
        target,
        id: String(topFocusItem.id),
      },
    };
  }

  const decisionPayload = getBlockPayload(screen, 'decisionTemperature');
  const hottestDecision = decisionPayload.hottestDecision;
  if (
    hottestDecision &&
    typeof hottestDecision.id === 'string' &&
    typeof hottestDecision.title === 'string'
  ) {
    return {
      title: String(hottestDecision.title),
      helper:
        typeof hottestDecision.deadlineLabel === 'string' && hottestDecision.deadlineLabel.trim().length > 0
          ? String(hottestDecision.deadlineLabel)
          : typeof hottestDecision.ownerLabel === 'string'
            ? String(hottestDecision.ownerLabel)
            : '',
      action: {
        type: 'open',
        target: 'decision',
        id: String(hottestDecision.id),
      },
    };
  }

  const sparkPayload = getBlockPayload(screen, 'sparkField');
  if (
    sparkPayload.nudge &&
    typeof sparkPayload.nudge === 'object' &&
    typeof sparkPayload.nudge.ideaId === 'string'
  ) {
    return {
      title: String(sparkPayload.nudge.text || 'Explore the strongest idea'),
      helper: typeof sparkPayload.nudge.text === 'string' ? String(sparkPayload.nudge.text) : '',
      action: {
        type: 'open',
        target: 'idea',
        id: String(sparkPayload.nudge.ideaId),
      },
    };
  }

  return null;
}

function enrichCommandDock(screen: HomeScreenData): HomeScreenData {
  const primaryAction = buildCommandPrimaryAction(screen);

  return {
    ...screen,
    blocks: screen.blocks.map((block) => {
      if (block.id !== 'commandDock') return block;
      return {
        ...block,
        payload: {
          ...block.payload,
          primaryAction,
        },
      };
    }),
  };
}

export function useHomeData(refreshTrigger?: number): HomeData {
  const [screen, setScreen] = useState<HomeScreenData>(cloneMockScreen);
  const [layout, setLayout] = useState<HomeLayoutConfig>(getDefaultLayout);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) {
      setLoading(true);
      setError(null);
    }
    const [screenRes, prefsRes] = await Promise.allSettled([
      Api.get('/my-work/home/v2'),
      Api.get('/preferences').catch(() => null),
    ]);

    const screenData =
      screenRes.status === 'fulfilled' && screenRes.value?.data?.blocks
        ? enrichCommandDock(screenRes.value.data as HomeScreenData)
        : createEmptyScreen();
    const savedLayout =
      prefsRes.status === 'fulfilled' && prefsRes.value?.data?.home_layout
        ? sanitizeLayout(prefsRes.value.data.home_layout)
        : getDefaultLayout();

    if (screenRes.status === 'fulfilled') {
      setScreen(screenData);
      setLayout(savedLayout);
      setError(null);
      hasLoadedRef.current = true;
    } else {
      if (isInitialLoad) {
        setScreen(screenData);
        setLayout(savedLayout);
      }
      setError('Home V2 unavailable. Please try again in a moment.');
    }
    setLoading(false);
  }, []);

  const updateLayout = useCallback(async (newLayout: HomeLayoutConfig) => {
    const safeLayout = sanitizeLayout(newLayout);
    setLayout(safeLayout);
    try {
      await Api.put('/preferences', { home_layout: safeLayout });
    } catch {
      // Keep the optimistic layout locally even if persistence fails.
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const blocks = useMemo(
    () => mergeBlocksWithLayout(screen.blocks, layout),
    [layout, screen.blocks]
  );
  const brief = useMemo(() => buildLegacyBrief(screen), [screen]);
  const spark = useMemo(() => buildLegacySpark(screen), [screen]);
  const pulse = useMemo(() => buildLegacyPulse(screen), [screen]);
  const nudge = useMemo(() => buildLegacyNudge(screen), [screen]);

  return { screen, blocks, layout, brief, spark, pulse, nudge, loading, error, updateLayout, refresh: fetchData };
}
