import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Api from '@/services/api';
import { apiGetCached } from '@/services/api/baseClient';

import type {
  HomeBlock,
  HomeBlockId,
  HomeBlockLayout,
  HomeBlockSize,
  HomeLayoutConfig,
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
    { blockId: 'industryLens', visible: true, pinned: true },
    { blockId: 'sparkField', visible: true, pinned: true },
    { blockId: 'momentum', visible: true },
    { blockId: 'decisionTemperature', visible: true },
    { blockId: 'executionCurrent', visible: true },
    { blockId: 'teamSignal', visible: true },
  ],
};

const MOCK_SCREEN: HomeScreenData = {
  timeMode: 'liveDay',
  updatedAt: new Date().toISOString(),
  pulseLabel: 'Radar · context, ideas, and a gentle steer — not an ops wall.',
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

function isValidTimeMode(value: unknown): value is HomeScreenData['timeMode'] {
  return value === 'morning' || value === 'liveDay' || value === 'eveningWrap';
}

function isValidAccent(value: unknown): value is HomeBlock['accent'] {
  return (
    value === 'ai' ||
    value === 'warm' ||
    value === 'cool' ||
    value === 'alert' ||
    value === 'success' ||
    value === 'neutral'
  );
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cloneDefaultBlock<K extends HomeBlockId>(blockId: K): Extract<HomeBlock, { id: K }> {
  const block = MOCK_SCREEN.blocks.find((entry): entry is Extract<HomeBlock, { id: K }> => entry.id === blockId);
  if (!block) {
    throw new Error(`Missing default home block for ${blockId}`);
  }
  return JSON.parse(JSON.stringify(block)) as Extract<HomeBlock, { id: K }>;
}

function normalizeSignalCard(value: unknown, fallback: { id: string; title?: string; summary?: string; tag?: string }) {
  const input = asObject(value);
  return {
    id: asString(input.id, fallback.id),
    title: asString(input.title, fallback.title || ''),
    summary: asString(input.summary, fallback.summary || ''),
    tag: asString(input.tag, fallback.tag || ''),
    tone:
      input.tone === 'positive' || input.tone === 'warning' || input.tone === 'neutral'
        ? input.tone
        : 'neutral',
    entityType:
      input.entityType === 'home' ||
      input.entityType === 'idea' ||
      input.entityType === 'note' ||
      input.entityType === 'task' ||
      input.entityType === 'decision' ||
      input.entityType === 'industry_signal' ||
      input.entityType === 'transformation_signal'
        ? input.entityType
        : undefined,
    entityId: typeof input.entityId === 'string' ? input.entityId : undefined,
  };
}

function normalizeHomeBlock(block: unknown): HomeBlock | null {
  const input = asObject(block);
  const blockId = typeof input.id === 'string' ? (input.id as HomeBlockId) : null;
  if (!blockId) return null;

  switch (blockId) {
    case 'aiPulseCore': {
      const fallback = cloneDefaultBlock('aiPulseCore');
      const payload = asObject(input.payload);
      const focusItemsRaw = Array.isArray(payload.focusItems) ? payload.focusItems : fallback.payload.focusItems;
      return {
        ...fallback,
        title: asString(input.title, fallback.title),
        subtitle: asString(input.subtitle, fallback.subtitle || ''),
        accent: isValidAccent(input.accent) ? input.accent : fallback.accent,
        size: isValidBlockSize(input.size) ? input.size : fallback.size,
        priorityWeight: asNumber(input.priorityWeight, fallback.priorityWeight),
        relevanceScore: asNumber(input.relevanceScore, fallback.relevanceScore),
        freshnessScore: asNumber(input.freshnessScore, fallback.freshnessScore),
        ctaIntents: Array.isArray(input.ctaIntents) ? input.ctaIntents.map((item) => String(item)) : fallback.ctaIntents,
        payload: {
          greeting: asString(payload.greeting, fallback.payload.greeting),
          headline: asString(payload.headline, fallback.payload.headline),
          summary: asString(payload.summary, fallback.payload.summary),
          insight: asString(payload.insight, fallback.payload.insight),
          weekProgress: asNumber(payload.weekProgress, fallback.payload.weekProgress),
          pulseScore: asNumber(payload.pulseScore, fallback.payload.pulseScore),
          appTipOfDay: payload.appTipOfDay ?? fallback.payload.appTipOfDay ?? null,
          aiPlaybookTip: payload.aiPlaybookTip ?? fallback.payload.aiPlaybookTip ?? null,
          focusItems: focusItemsRaw
            .filter((item) => item && typeof item === 'object')
            .map((item: any, index) => ({
              id: asString(item.id, `focus-${index}`),
              type: item.type === 'task' || item.type === 'decision' || item.type === 'idea' ? item.type : 'idea',
              title: asString(item.title, ''),
              meta: asString(item.meta, ''),
              priority:
                item.priority === 'high' || item.priority === 'medium' || item.priority === 'low'
                  ? item.priority
                  : 'medium',
            })),
        },
      };
    }
    case 'momentum': {
      const fallback = cloneDefaultBlock('momentum');
      const payload = asObject(input.payload);
      const statsRaw = Array.isArray(payload.stats) ? payload.stats : fallback.payload.stats;
      const signalsRaw = Array.isArray(payload.signals) ? payload.signals : fallback.payload.signals;
      return {
        ...fallback,
        title: asString(input.title, fallback.title),
        subtitle: asString(input.subtitle, fallback.subtitle || ''),
        accent: isValidAccent(input.accent) ? input.accent : fallback.accent,
        size: isValidBlockSize(input.size) ? input.size : fallback.size,
        priorityWeight: asNumber(input.priorityWeight, fallback.priorityWeight),
        relevanceScore: asNumber(input.relevanceScore, fallback.relevanceScore),
        freshnessScore: asNumber(input.freshnessScore, fallback.freshnessScore),
        ctaIntents: Array.isArray(input.ctaIntents) ? input.ctaIntents.map((item) => String(item)) : fallback.ctaIntents,
        payload: {
          headline: asString(payload.headline, fallback.payload.headline),
          summary: asString(payload.summary, fallback.payload.summary),
          stats: statsRaw.map((stat: any, index) => ({
            label: asString(stat?.label, `stat-${index}`),
            value: asString(stat?.value, '0'),
            trend: asString(stat?.trend, ''),
          })),
          signals: signalsRaw.map((signal: any, index) =>
            normalizeSignalCard(signal, { id: `momentum-${index}` })
          ),
        },
      };
    }
    case 'sparkField': {
      const fallback = cloneDefaultBlock('sparkField');
      const payload = asObject(input.payload);
      const ideasRaw = Array.isArray(payload.ideas) ? payload.ideas : fallback.payload.ideas;
      const notesRaw = Array.isArray(payload.notes) ? payload.notes : fallback.payload.notes;
      return {
        ...fallback,
        title: asString(input.title, fallback.title),
        subtitle: asString(input.subtitle, fallback.subtitle || ''),
        accent: isValidAccent(input.accent) ? input.accent : fallback.accent,
        size: isValidBlockSize(input.size) ? input.size : fallback.size,
        priorityWeight: asNumber(input.priorityWeight, fallback.priorityWeight),
        relevanceScore: asNumber(input.relevanceScore, fallback.relevanceScore),
        freshnessScore: asNumber(input.freshnessScore, fallback.freshnessScore),
        ctaIntents: Array.isArray(input.ctaIntents) ? input.ctaIntents.map((item) => String(item)) : fallback.ctaIntents,
        payload: {
          ideas: ideasRaw.map((item: any, index) => ({
            id: asString(item?.id, `idea-${index}`),
            type: 'idea' as const,
            title: asString(item?.title, ''),
            snippet: asString(item?.snippet, ''),
            stage: asString(item?.stage, 'spark'),
            updatedAt: asString(item?.updatedAt, ''),
            nodeCount: typeof item?.nodeCount === 'number' ? item.nodeCount : undefined,
            taskCount: typeof item?.taskCount === 'number' ? item.taskCount : undefined,
          })),
          notes: notesRaw.map((item: any, index) => ({
            id: asString(item?.id, `note-${index}`),
            type: 'note' as const,
            title: asString(item?.title, ''),
            snippet: asString(item?.snippet, ''),
            updatedAt: asString(item?.updatedAt, ''),
          })),
          nudge:
            payload.nudge && typeof payload.nudge === 'object'
              ? {
                  text: asString((payload.nudge as any).text, ''),
                  ideaId: asString((payload.nudge as any).ideaId, ''),
                }
              : null,
          runtimeSummary:
            payload.runtimeSummary && typeof payload.runtimeSummary === 'object'
              ? {
                  ideasWithTasks: asNumber((payload.runtimeSummary as any).ideasWithTasks, 0),
                  recentNotes: asNumber((payload.runtimeSummary as any).recentNotes, 0),
                  recentOutputs: asNumber((payload.runtimeSummary as any).recentOutputs, 0),
                  orgSignals: asNumber((payload.runtimeSummary as any).orgSignals, 0),
                }
              : undefined,
          orgIdeas: Array.isArray(payload.orgIdeas) ? payload.orgIdeas : undefined,
        },
      };
    }
    case 'decisionTemperature': {
      const fallback = cloneDefaultBlock('decisionTemperature');
      const payload = asObject(input.payload);
      const signalsRaw = Array.isArray(payload.signals) ? payload.signals : fallback.payload.signals;
      const hottestDecision =
        payload.hottestDecision && typeof payload.hottestDecision === 'object'
          ? {
              id: asString((payload.hottestDecision as any).id, ''),
              title: asString((payload.hottestDecision as any).title, ''),
              ownerLabel: asString((payload.hottestDecision as any).ownerLabel, ''),
              priority: asString((payload.hottestDecision as any).priority, ''),
              deadlineLabel: asString((payload.hottestDecision as any).deadlineLabel, ''),
            }
          : null;
      return {
        ...fallback,
        title: asString(input.title, fallback.title),
        subtitle: asString(input.subtitle, fallback.subtitle || ''),
        accent: isValidAccent(input.accent) ? input.accent : fallback.accent,
        size: isValidBlockSize(input.size) ? input.size : fallback.size,
        priorityWeight: asNumber(input.priorityWeight, fallback.priorityWeight),
        relevanceScore: asNumber(input.relevanceScore, fallback.relevanceScore),
        freshnessScore: asNumber(input.freshnessScore, fallback.freshnessScore),
        ctaIntents: Array.isArray(input.ctaIntents) ? input.ctaIntents.map((item) => String(item)) : fallback.ctaIntents,
        payload: {
          pendingCount: asNumber(payload.pendingCount, fallback.payload.pendingCount),
          blockedCount: asNumber(payload.blockedCount, fallback.payload.blockedCount),
          hottestDecision,
          signals: signalsRaw.map((signal: any, index) =>
            normalizeSignalCard(signal, { id: `decision-${index}` })
          ),
        },
      };
    }
    case 'industryLens': {
      const fallback = cloneDefaultBlock('industryLens');
      const payload = asObject(input.payload);
      return {
        ...fallback,
        title: asString(input.title, fallback.title),
        subtitle: asString(input.subtitle, fallback.subtitle || ''),
        accent: isValidAccent(input.accent) ? input.accent : fallback.accent,
        size: isValidBlockSize(input.size) ? input.size : fallback.size,
        priorityWeight: asNumber(input.priorityWeight, fallback.priorityWeight),
        relevanceScore: asNumber(input.relevanceScore, fallback.relevanceScore),
        freshnessScore: asNumber(input.freshnessScore, fallback.freshnessScore),
        ctaIntents: Array.isArray(input.ctaIntents) ? input.ctaIntents.map((item) => String(item)) : fallback.ctaIntents,
        payload: {
          industryLabel: asString(payload.industryLabel, fallback.payload.industryLabel),
          roleLens: asString(payload.roleLens, fallback.payload.roleLens),
          marketSignal: normalizeSignalCard(payload.marketSignal, fallback.payload.marketSignal),
          technologySignal: normalizeSignalCard(payload.technologySignal, fallback.payload.technologySignal),
          aiNews: Array.isArray(payload.aiNews) ? payload.aiNews : undefined,
          benchmark:
            payload.benchmark && typeof payload.benchmark === 'object'
              ? {
                  label: asString((payload.benchmark as any).label, fallback.payload.benchmark.label),
                  value: asString((payload.benchmark as any).value, fallback.payload.benchmark.value),
                  delta: asString((payload.benchmark as any).delta, fallback.payload.benchmark.delta),
                  implication: asString(
                    (payload.benchmark as any).implication,
                    fallback.payload.benchmark.implication
                  ),
                }
              : fallback.payload.benchmark,
          peerCase:
            payload.peerCase && typeof payload.peerCase === 'object'
              ? {
                  title: asString((payload.peerCase as any).title, fallback.payload.peerCase.title),
                  summary: asString((payload.peerCase as any).summary, fallback.payload.peerCase.summary),
                  implication: asString(
                    (payload.peerCase as any).implication,
                    fallback.payload.peerCase.implication
                  ),
                }
              : fallback.payload.peerCase,
        },
      };
    }
    case 'executionCurrent': {
      const fallback = cloneDefaultBlock('executionCurrent');
      const payload = asObject(input.payload);
      const streamsRaw = Array.isArray(payload.streams) ? payload.streams : fallback.payload.streams;
      const artifactOutputsRaw = Array.isArray(payload.artifactOutputs)
        ? payload.artifactOutputs
        : fallback.payload.artifactOutputs || [];
      return {
        ...fallback,
        title: asString(input.title, fallback.title),
        subtitle: asString(input.subtitle, fallback.subtitle || ''),
        accent: isValidAccent(input.accent) ? input.accent : fallback.accent,
        size: isValidBlockSize(input.size) ? input.size : fallback.size,
        priorityWeight: asNumber(input.priorityWeight, fallback.priorityWeight),
        relevanceScore: asNumber(input.relevanceScore, fallback.relevanceScore),
        freshnessScore: asNumber(input.freshnessScore, fallback.freshnessScore),
        ctaIntents: Array.isArray(input.ctaIntents) ? input.ctaIntents.map((item) => String(item)) : fallback.ctaIntents,
        payload: {
          headline: asString(payload.headline, fallback.payload.headline),
          streams: streamsRaw.map((stream: any, index) => ({
            id: asString(stream?.id, `stream-${index}`),
            label: asString(stream?.label, ''),
            progressLabel: asString(stream?.progressLabel, ''),
            status:
              stream?.status === 'accelerating' || stream?.status === 'steady' || stream?.status === 'blocked'
                ? stream.status
                : 'steady',
            entityType:
              stream?.entityType === 'home' ||
              stream?.entityType === 'idea' ||
              stream?.entityType === 'note' ||
              stream?.entityType === 'task' ||
              stream?.entityType === 'decision' ||
              stream?.entityType === 'industry_signal' ||
              stream?.entityType === 'transformation_signal'
                ? stream.entityType
                : undefined,
            entityId: typeof stream?.entityId === 'string' ? stream.entityId : undefined,
          })),
          nextUp: Array.isArray(payload.nextUp) ? payload.nextUp : undefined,
          artifactOutputs: artifactOutputsRaw.map((artifact: any, index) => ({
            id: asString(artifact?.id, `artifact-${index}`),
            artifactId: asString(artifact?.artifactId, `artifact-${index}`),
            title: asString(artifact?.title, ''),
            outputType:
              artifact?.outputType === 'report' || artifact?.outputType === 'presentation' || artifact?.outputType === 'sheet'
                ? artifact.outputType
                : 'report',
            originRuntime:
              artifact?.originRuntime === 'report' || artifact?.originRuntime === 'presentation' || artifact?.originRuntime === 'sheet'
                ? artifact.originRuntime
                : 'report',
            deliveryState: asString(artifact?.deliveryState, ''),
            visibilityScope:
              artifact?.visibilityScope === 'private' ||
              artifact?.visibilityScope === 'project' ||
              artifact?.visibilityScope === 'organization' ||
              artifact?.visibilityScope === 'review_shared' ||
              artifact?.visibilityScope === 'demo'
                ? artifact.visibilityScope
                : 'private',
            publishState: typeof artifact?.publishState === 'string' ? artifact.publishState : null,
            reviewGateCount:
              typeof artifact?.reviewGateCount === 'number' ? artifact.reviewGateCount : undefined,
          })),
        },
      };
    }
    case 'teamSignal': {
      const fallback = cloneDefaultBlock('teamSignal');
      const payload = asObject(input.payload);
      const signalsRaw = Array.isArray(payload.signals) ? payload.signals : fallback.payload.signals;
      return {
        ...fallback,
        title: asString(input.title, fallback.title),
        subtitle: asString(input.subtitle, fallback.subtitle || ''),
        accent: isValidAccent(input.accent) ? input.accent : fallback.accent,
        size: isValidBlockSize(input.size) ? input.size : fallback.size,
        priorityWeight: asNumber(input.priorityWeight, fallback.priorityWeight),
        relevanceScore: asNumber(input.relevanceScore, fallback.relevanceScore),
        freshnessScore: asNumber(input.freshnessScore, fallback.freshnessScore),
        ctaIntents: Array.isArray(input.ctaIntents) ? input.ctaIntents.map((item) => String(item)) : fallback.ctaIntents,
        payload: {
          headline: asString(payload.headline, fallback.payload.headline),
          summary: asString(payload.summary, fallback.payload.summary),
          signals: signalsRaw.map((signal: any, index) => ({
            id: asString(signal?.id, `team-${index}`),
            title: asString(signal?.title, ''),
            detail: asString(signal?.detail, ''),
            tone:
              signal?.tone === 'positive' || signal?.tone === 'warning' || signal?.tone === 'neutral'
                ? signal.tone
                : 'neutral',
          })),
          peerTips: Array.isArray(payload.peerTips) ? payload.peerTips : undefined,
        },
      };
    }
    case 'commandDock': {
      const fallback = cloneDefaultBlock('commandDock');
      return {
        ...fallback,
        title: asString(input.title, fallback.title),
        subtitle: asString(input.subtitle, fallback.subtitle || ''),
        accent: isValidAccent(input.accent) ? input.accent : fallback.accent,
        size: isValidBlockSize(input.size) ? input.size : fallback.size,
        priorityWeight: asNumber(input.priorityWeight, fallback.priorityWeight),
        relevanceScore: asNumber(input.relevanceScore, fallback.relevanceScore),
        freshnessScore: asNumber(input.freshnessScore, fallback.freshnessScore),
        ctaIntents: Array.isArray(input.ctaIntents) ? input.ctaIntents.map((item) => String(item)) : fallback.ctaIntents,
        payload: asObject(input.payload) as any,
      };
    }
    default:
      return null;
  }
}

function normalizeHomeScreenData(value: unknown): HomeScreenData {
  const fallback = createEmptyScreen();
  const input = asObject(value);
  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];
  return {
    timeMode: isValidTimeMode(input.timeMode) ? input.timeMode : fallback.timeMode,
    updatedAt: asString(input.updatedAt, new Date().toISOString()),
    pulseLabel: asString(input.pulseLabel, fallback.pulseLabel),
    blocks: rawBlocks
      .map((block) => normalizeHomeBlock(block))
      .filter((block): block is HomeBlock => block !== null),
  };
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
    .filter((block) => block.id !== 'commandDock')
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

export function useHomeData(refreshTrigger?: number): HomeData {
  const [screen, setScreen] = useState<HomeScreenData>(createEmptyScreen);
  const [layout, setLayout] = useState<HomeLayoutConfig>(getDefaultLayout);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const retryCountRef = useRef(0);

  const fetchData = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) {
      setLoading(true);
      setError(null);
    }
    const [screenRes, prefsRes] = await Promise.allSettled([
      apiGetCached('/my-work/home/v2', 15_000, 'Failed to fetch Home V2'),
      apiGetCached('/preferences', 15_000, 'Failed to fetch preferences').catch(() => null),
    ]);

    const screenData =
      screenRes.status === 'fulfilled'
        ? normalizeHomeScreenData(screenRes.value?.data)
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
      retryCountRef.current = 0;
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

  useEffect(() => {
    if (!error || hasLoadedRef.current || retryCountRef.current >= 4) return;
    const delay = Math.min(2000 * 2 ** retryCountRef.current, 12000);
    const timer = window.setTimeout(() => {
      retryCountRef.current += 1;
      fetchData();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [error, fetchData]);

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
