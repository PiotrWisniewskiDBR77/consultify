import {
  ArrowUpRight,
  Brain,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  NotebookPen,
  Presentation,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import Api from '@/services/api';

import { useMyWorkArtifactOutputs } from '../../ReportsAndPresentations/useRapData';
import type { UnifiedOutputRow } from '../../ReportsAndPresentations/types';
import type {
  HomeScreenAction,
  RadarRecommendation,
  RadarSignalCard,
  RadarViewPayload,
} from './homeV2Types';
import { useRadarData } from './useRadarData';

interface HomeViewProps {
  userName?: string;
  refreshTrigger?: number;
  onAction: (action: HomeScreenAction) => void;
}

type RadarActionType =
  | 'view_briefing'
  | 'open_signal'
  | 'ask_ai'
  | 'add_to_note'
  | 'create_task'
  | 'add_to_watchlist'
  | 'more_like_this'
  | 'less_like_this';

export const HomeView: React.FC<HomeViewProps> = ({ userName, refreshTrigger, onAction }) => {
  const { i18n } = useTranslation();
  const lang = String(i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
  const pl = lang.startsWith('pl');
  const { data, loading, error, refresh } = useRadarData(refreshTrigger);
  const {
    mine: myOutputs,
    review: reviewOutputs,
    recent: recentOutputs,
    loading: myOutputsLoading,
    error: myOutputsError,
  } = useMyWorkArtifactOutputs(8);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const allSignals = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, RadarSignalCard>();
    for (const signal of [
      ...data.dailyBriefing.keySignals,
      ...data.whatChanged,
      ...data.whyItMattersToMe,
      ...data.learnImprove,
      ...data.watchlist,
    ]) {
      map.set(signal.signalId, signal);
    }
    return Array.from(map.values());
  }, [data]);

  useEffect(() => {
    if (!allSignals.length) {
      setSelectedSignalId(null);
      return;
    }
    if (!allSignals.some((signal) => signal.signalId === selectedSignalId)) {
      setSelectedSignalId(allSignals[0].signalId);
    }
  }, [allSignals, selectedSignalId]);

  useEffect(() => {
    if (!data?.generatedAt) return;
    void logRadarAction('view_briefing');
  }, [data?.generatedAt]);

  const selectedSignal =
    allSignals.find((signal) => signal.signalId === selectedSignalId) ||
    data?.dailyBriefing.keySignals[0] ||
    null;
  const prioritizedReviewOutputs = useMemo(() => reviewOutputs.slice(0, 3), [reviewOutputs]);
  const prioritizedMyOutputs = useMemo(() => {
    const reviewArtifactIds = new Set(prioritizedReviewOutputs.map((item) => item.artifactId || item.originRecordId));
    return myOutputs
      .filter((item) => !reviewArtifactIds.has(item.artifactId || item.originRecordId))
      .slice(0, 3);
  }, [myOutputs, prioritizedReviewOutputs]);
  const prioritizedRecentOutputs = useMemo(() => {
    const occupiedArtifactIds = new Set(
      [...prioritizedReviewOutputs, ...prioritizedMyOutputs].map(
        (item) => item.artifactId || item.originRecordId,
      ),
    );
    return recentOutputs
      .filter((item) => !occupiedArtifactIds.has(item.artifactId || item.originRecordId))
      .slice(0, 3);
  }, [prioritizedMyOutputs, prioritizedReviewOutputs, recentOutputs]);

  const openOutput = useCallback(
    (row: UnifiedOutputRow) => {
      const target =
        row.kind === 'presentation' ? 'presentation' : row.kind === 'sheet' ? 'sheet' : 'report';
      onAction({ type: 'open', target, id: row.originRecordId });
    },
    [onAction]
  );

  async function logRadarAction(
    actionType: RadarActionType,
    signal?: RadarSignalCard,
    extras?: {
      createdObjectType?: string;
      createdObjectId?: string;
      payload?: Record<string, unknown>;
    }
  ) {
    try {
      await Api.post('/my-work/radar/actions', {
        signalId: signal?.signalId,
        actionType,
        sourceContext: 'home',
        createdObjectType: extras?.createdObjectType,
        createdObjectId: extras?.createdObjectId,
        payload: extras?.payload,
      });
    } catch {
      // Radar logging must not block the UI.
    }
  }

  const openSignal = async (signal: RadarSignalCard) => {
    setSelectedSignalId(signal.signalId);
    await logRadarAction('open_signal', signal);
  };

  const askAi = async (signal: RadarSignalCard) => {
    setBusyAction('ask_ai');
    try {
      const localizedTitle = getSignalTitle(signal, pl);
      const localizedSummary = getSignalSummary(signal, pl);
      await logRadarAction('ask_ai', signal);
      onAction({
        type: 'chat',
        packet: {
          sourceBlock: 'aiPulseCore',
          intent: 'radar_signal_interpretation',
          title: localizedTitle,
          entityName: localizedTitle,
          starterPrompt: pl
            ? `Przeanalizuj ten sygnał Radaru. Traktuj go jako aktywny kontekst rozmowy. Odpowiedz: co się zmieniło, dlaczego to ważne dla mnie, jakie ryzyko lub szansę widzisz i jaki ruch wykonać teraz.\n\nTytuł: ${localizedTitle}\nPodsumowanie: ${localizedSummary}\nSzerszy kontekst: ${signal.insightSummary || localizedSummary}\nDlaczego to ważne: ${signal.whyItMatters}\nDlaczego to widzę: ${signal.whyYouSeeThis}\nSugerowany next step: ${signal.suggestedNextStep}`
            : `Analyze this Radar signal and treat it as the active conversation context. Answer: what changed, why it matters to me, what risk or opportunity you see, and what move I should make now.\n\nTitle: ${localizedTitle}\nSummary: ${localizedSummary}\nBroader context: ${signal.insightSummary || localizedSummary}\nWhy it matters: ${signal.whyItMatters}\nWhy I see this: ${signal.whyYouSeeThis}\nSuggested next step: ${signal.suggestedNextStep}`,
          entityType: 'note',
          entityId: signal.signalId,
          contextData: {
            kind: 'radar_signal',
            sourceBlock: 'radar_briefing_hero',
            signal,
            radarSignal: {
              signalId: signal.signalId,
              title: localizedTitle,
              summary: localizedSummary,
              insightSummary: signal.insightSummary || localizedSummary,
              whyItMatters: signal.whyItMatters,
              whyYouSeeThis: signal.whyYouSeeThis,
              suggestedNextStep: signal.suggestedNextStep,
              impactType: signal.impactType,
              businessImpact: signal.businessImpact,
              relevanceScope: signal.relevanceScope,
              sourceName: signal.source.name,
              sourceUrl: signal.source.url || null,
              tags: signal.tags,
            },
          },
        },
      });
    } finally {
      setBusyAction(null);
    }
  };

  const addToNote = async (signal: RadarSignalCard) => {
    setBusyAction('add_to_note');
    try {
      const created = await Api.post('/my-work/notebook/pages', {
        title: getSignalTitle(signal, pl),
        contentText: buildNoteBody(signal, pl),
        tags: signal.tags.topics.slice(0, 4),
        visibility: 'private',
      });
      const noteId = created?.data?.id ? String(created.data.id) : undefined;
      await logRadarAction('add_to_note', signal, {
        createdObjectType: 'note',
        createdObjectId: noteId,
      });
      if (noteId) onAction({ type: 'open', target: 'note', id: noteId });
    } finally {
      setBusyAction(null);
    }
  };

  const createTask = async (signal: RadarSignalCard) => {
    setBusyAction('create_task');
    try {
      await logRadarAction('create_task', signal);
      onAction({ type: 'create', target: 'task' });
    } finally {
      setBusyAction(null);
    }
  };

  const addToWatchlist = async (signal: RadarSignalCard) => {
    setBusyAction('add_to_watchlist');
    try {
      await logRadarAction('add_to_watchlist', signal, {
        payload: {
          itemType: signal.source.name ? 'company' : 'topic',
          value: signal.source.name || signal.tags.topics[0] || signal.title,
        },
      });
      await refresh();
    } finally {
      setBusyAction(null);
    }
  };

  const trainPreference = async (
    signal: RadarSignalCard,
    actionType: 'more_like_this' | 'less_like_this'
  ) => {
    setBusyAction(actionType);
    try {
      await logRadarAction(actionType, signal);
      await refresh();
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#060B18]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent dark:border-violet-400"
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#060B18]">
        <p className="text-base text-red-600 dark:text-red-400">
          {error || (pl ? 'Radar niedostępny' : 'Radar unavailable')}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-[#060B18]">
      <BgCanvas />

      <div className="relative z-10 flex items-center justify-between px-7 pt-4 pb-2">
        <span className="text-[13px] font-medium text-slate-500 dark:text-slate-500">
          {pl ? 'Radar 2.0 · warstwa intelligence' : 'Radar 2.0 · intelligence layer'}
          {userName ? ` · ${userName}` : ''}
        </span>
        <span className="text-[12px] text-slate-400 dark:text-slate-500">
          {new Date(data.generatedAt).toLocaleTimeString(pl ? 'pl-PL' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="relative z-10 flex-1 overflow-auto px-7 pb-6">
        <BriefingPanel
          pl={pl}
          briefing={data.dailyBriefing}
          onOpenSignal={openSignal}
          onAskAi={askAi}
          onAddToNote={addToNote}
          onCreateTask={createTask}
        />

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <SignalListSection
              pl={pl}
              title={pl ? 'Co się zmieniło' : 'What changed'}
              subtitle={
                pl
                  ? 'Najmocniejsze sygnały z rynku, technologii i wykonania.'
                  : 'Strongest signals across market, technology, and execution.'
              }
              signals={data.whatChanged}
              selectedSignalId={selectedSignalId}
              onOpenSignal={openSignal}
              onAddToNote={addToNote}
              onMoreLikeThis={(signal) => trainPreference(signal, 'more_like_this')}
              onLessLikeThis={(signal) => trainPreference(signal, 'less_like_this')}
              busyAction={busyAction}
            />
            <SignalListSection
              pl={pl}
              title={pl ? 'Co ma znaczenie dla mnie' : 'Why it matters to me'}
              subtitle={
                pl
                  ? 'Sygnały dopasowane do roli, projektów i bieżącej pracy.'
                  : 'Signals tailored to role, projects, and live work context.'
              }
              signals={data.whyItMattersToMe}
              selectedSignalId={selectedSignalId}
              onOpenSignal={openSignal}
              onAddToNote={addToNote}
              onMoreLikeThis={(signal) => trainPreference(signal, 'more_like_this')}
              onLessLikeThis={(signal) => trainPreference(signal, 'less_like_this')}
              busyAction={busyAction}
            />
          </div>

          <div className="space-y-4">
            <SelectedSignalPanel
              pl={pl}
              signal={selectedSignal}
              busyAction={busyAction}
              onAskAi={askAi}
              onAddToNote={addToNote}
              onCreateTask={createTask}
              onAddToWatchlist={addToWatchlist}
              onMoreLikeThis={(signal) => trainPreference(signal, 'more_like_this')}
              onLessLikeThis={(signal) => trainPreference(signal, 'less_like_this')}
            />
            <RecommendationsPanel
              pl={pl}
              recommendations={data.whatToDoNext}
              onSelectSignal={(signalId) => {
                const signal = allSignals.find((item) => item.signalId === signalId);
                if (signal) void openSignal(signal);
              }}
            />
            <OutputsQueuePanel
              pl={pl}
              reviewOutputs={prioritizedReviewOutputs}
              myOutputs={prioritizedMyOutputs}
              recentOutputs={prioritizedRecentOutputs}
              loading={myOutputsLoading}
              error={myOutputsError}
              onOpenOutput={openOutput}
              onOpenLibrary={(target) => onAction({ type: 'navigate', target })}
            />
            <SignalListSection
              pl={pl}
              title={pl ? 'Edukacja i porady' : 'Learn / improve'}
              subtitle={
                pl
                  ? 'Playbooki, how-to i guidance do podniesienia jakości pracy.'
                  : 'Playbooks, how-to, and guidance to improve work quality.'
              }
              signals={data.learnImprove}
              selectedSignalId={selectedSignalId}
              onOpenSignal={openSignal}
              onAddToNote={addToNote}
              onMoreLikeThis={(signal) => trainPreference(signal, 'more_like_this')}
              onLessLikeThis={(signal) => trainPreference(signal, 'less_like_this')}
              busyAction={busyAction}
              compact
            />
            <SignalListSection
              pl={pl}
              title={pl ? 'Watchlist' : 'Watchlist'}
              subtitle={
                pl
                  ? 'Słabsze sygnały i rzeczy warte dalszego śledzenia.'
                  : 'Weaker signals and items worth tracking further.'
              }
              signals={data.watchlist}
              selectedSignalId={selectedSignalId}
              onOpenSignal={openSignal}
              onAddToNote={addToNote}
              onMoreLikeThis={(signal) => trainPreference(signal, 'more_like_this')}
              onLessLikeThis={(signal) => trainPreference(signal, 'less_like_this')}
              busyAction={busyAction}
              compact
            />
            <MetricsPanel pl={pl} data={data} />
          </div>
        </div>
      </div>
    </div>
  );
};

const BriefingPanel: React.FC<{
  pl: boolean;
  briefing: RadarViewPayload['dailyBriefing'];
  onOpenSignal: (signal: RadarSignalCard) => void | Promise<void>;
  onAskAi: (signal: RadarSignalCard) => void | Promise<void>;
  onAddToNote: (signal: RadarSignalCard) => void | Promise<void>;
  onCreateTask: (signal: RadarSignalCard) => void | Promise<void>;
}> = ({ pl, briefing, onOpenSignal, onAskAi, onAddToNote, onCreateTask }) => {
  const [activeBriefIndex, setActiveBriefIndex] = useState(0);
  const [showSignalsPanel, setShowSignalsPanel] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const activeSignal = briefing.keySignals[activeBriefIndex] || briefing.keySignals[0] || null;

  useEffect(() => {
    setActiveBriefIndex(0);
  }, [briefing.mainInsight, briefing.keySignals]);

  const changeBrief = (direction: -1 | 1) => {
    if (briefing.keySignals.length <= 1) return;
    setActiveBriefIndex((current) => {
      const total = briefing.keySignals.length;
      return (current + direction + total) % total;
    });
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-5 dark:border-violet-400/20 dark:bg-violet-500/[0.08] dark:bg-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-700/80 dark:text-violet-300/75">
          <Sparkles size={13} />
          {pl ? 'Briefing dnia' : 'Daily briefing'}
        </div>
        <div className="flex items-center gap-2">
          {briefing.keySignals.length > 1 && (
            <div className="flex items-center gap-1 rounded-full border border-violet-200 bg-white/70 px-1 py-1 dark:border-white/10 dark:bg-white/[0.04]">
              <button
                type="button"
                onClick={() => changeBrief(-1)}
                className="rounded-full p-1 text-slate-500 transition hover:bg-white dark:text-slate-400 dark:hover:bg-white/[0.08]"
                aria-label={pl ? 'Poprzedni brief' : 'Previous brief'}
              >
                <ChevronLeft size={12} />
              </button>
              <span className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
                {activeBriefIndex + 1}/{briefing.keySignals.length}
              </span>
              <button
                type="button"
                onClick={() => changeBrief(1)}
                className="rounded-full p-1 text-slate-500 transition hover:bg-white dark:text-slate-400 dark:hover:bg-white/[0.08]"
                aria-label={pl ? 'Następny brief' : 'Next brief'}
              >
                <ChevronRight size={12} />
              </button>
            </div>
          )}
          <div className="rounded-full border border-violet-200 bg-white/70 px-3 py-1 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
            {pl ? 'Najważniejsze na teraz' : 'What matters now'}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="max-w-[68ch] text-[18px] font-semibold leading-7 text-slate-900 dark:text-slate-100">
            {briefing.mainInsight}
          </h2>

          {activeSignal && (
            <>
              <div className="mt-3 text-[13px] font-medium text-slate-800 dark:text-slate-200">
                {getSignalTitle(activeSignal, pl)}
              </div>
              <p className="mt-2 max-w-[72ch] text-[13px] leading-6 text-slate-600 dark:text-slate-400">
                {activeSignal.insightSummary || getSignalSummary(activeSignal, pl)}
              </p>
              <p className="mt-2 max-w-[72ch] text-[13px] leading-6 text-slate-700 dark:text-slate-300">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {pl ? 'Co z tego wynika: ' : 'What it means: '}
                </span>
                {activeSignal.whyItMatters}
              </p>
            </>
          )}
        </div>

        {showSignalsPanel && (
          <div className="w-full lg:w-[280px] lg:shrink-0">
            <div className="grid gap-2">
              {briefing.keySignals.map((signal, index) => (
                <button
                  key={signal.signalId}
                  type="button"
                  onClick={() => setActiveBriefIndex(index)}
                  className={cn(
                    'rounded-2xl border px-3 py-2.5 text-left transition',
                    index === activeBriefIndex
                      ? 'border-violet-300 bg-white dark:border-violet-300/30 dark:bg-white/[0.08]'
                      : 'border-slate-200 bg-white/80 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]'
                  )}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                    {pl ? `Sygnał ${index + 1}` : `Signal ${index + 1}`}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-800 dark:text-slate-200">
                    {getSignalTitle(signal, pl)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <GhostButton
            label={pl ? 'Pogadaj z AI' : 'Ask AI'}
            onClick={() => (activeSignal ? void onAskAi(activeSignal) : undefined)}
            icon={<Brain size={14} />}
            tone="violet"
          />
          <GhostButton
            label={pl ? 'Do notatki' : 'To notes'}
            onClick={() => (activeSignal ? void onAddToNote(activeSignal) : undefined)}
            icon={<NotebookPen size={14} />}
            tone="cyan"
          />
          <GhostButton
            label={pl ? 'Utwórz zadanie' : 'Create task'}
            onClick={() => (activeSignal ? void onCreateTask(activeSignal) : undefined)}
            icon={<CheckSquare size={14} />}
            tone="amber"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInfoPanel((value) => !value)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
            aria-label={pl ? 'Pokaż informacje' : 'Show info'}
          >
            <Info size={14} />
          </button>
          <button
            type="button"
            onClick={() => setShowSignalsPanel((value) => !value)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-[12px] font-medium text-slate-600 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
          >
            {showSignalsPanel ? (pl ? 'Ukryj sygnały' : 'Hide signals') : (pl ? 'Pokaż sygnały' : 'Show signals')}
            {showSignalsPanel ? <ChevronRight size={13} className="rotate-90" /> : <ChevronLeft size={13} className="rotate-180" />}
          </button>
        </div>
      </div>

      {showInfoPanel && activeSignal && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-[13px] leading-6 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
          <p>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {pl ? 'Dlaczego to widzisz: ' : 'Why you see this: '}
            </span>
            {activeSignal.whyYouSeeThis}
          </p>
          <p className="mt-2">
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {pl ? 'Najbliższy ruch: ' : 'Next move: '}
            </span>
            {activeSignal.suggestedNextStep}
          </p>
        </div>
      )}
    </section>
  );
};

const SignalListSection: React.FC<{
  pl: boolean;
  title: string;
  subtitle: string;
  signals: RadarSignalCard[];
  selectedSignalId: string | null;
  onOpenSignal: (signal: RadarSignalCard) => void | Promise<void>;
  onAddToNote: (signal: RadarSignalCard) => void | Promise<void>;
  onMoreLikeThis: (signal: RadarSignalCard) => void | Promise<void>;
  onLessLikeThis: (signal: RadarSignalCard) => void | Promise<void>;
  busyAction: string | null;
  compact?: boolean;
}> = ({
  pl,
  title,
  subtitle,
  signals,
  selectedSignalId,
  onOpenSignal,
  onAddToNote,
  onMoreLikeThis,
  onLessLikeThis,
  busyAction,
  compact = false,
}) => (
  <SectionShell title={title} subtitle={subtitle}>
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      {signals.map((signal) => (
        <div
          key={signal.signalId}
          className={cn(
            'rounded-2xl border p-3 transition',
            signal.signalId === selectedSignalId
              ? 'border-violet-300 bg-violet-50 dark:border-violet-300/25 dark:bg-violet-400/[0.08]'
              : 'border-slate-200 bg-white/80 hover:bg-white dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
          )}
        >
          <button className="w-full text-left" onClick={() => void onOpenSignal(signal)}>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
              <SignalBadge label={signal.source.name} />
              <SignalBadge label={signal.impactType} />
              <SignalBadge label={signal.businessImpact} />
              {isSignalLocalizationPending(signal) && (
                <SignalBadge label={pl ? 'lokalizacja' : 'localizing'} />
              )}
            </div>
            <div className="mt-2 text-[14px] font-semibold leading-6 text-slate-900 dark:text-slate-100">
              {getSignalTitle(signal, pl)}
            </div>
            <div className="mt-1 text-[12px] leading-5 text-slate-600 dark:text-slate-400">
              {compact ? signal.whyItMatters : getSignalSummary(signal, pl)}
            </div>
          </button>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <TinyButton
              label={pl ? 'Na później' : 'Later'}
              onClick={() => void onAddToNote(signal)}
              busy={busyAction === 'add_to_note'}
              icon={<NotebookPen size={11} />}
              tone="cyan"
            />
            <TinyButton
              label={pl ? 'Interesuje' : 'Relevant'}
              onClick={() => void onMoreLikeThis(signal)}
              busy={busyAction === 'more_like_this'}
              tone="emerald"
            />
            <TinyButton
              label={pl ? 'Mniej trafne' : 'Less relevant'}
              onClick={() => void onLessLikeThis(signal)}
              busy={busyAction === 'less_like_this'}
              tone="rose"
            />
          </div>
        </div>
      ))}
    </div>
  </SectionShell>
);

const SelectedSignalPanel: React.FC<{
  pl: boolean;
  signal: RadarSignalCard | null;
  busyAction: string | null;
  onAskAi: (signal: RadarSignalCard) => void | Promise<void>;
  onAddToNote: (signal: RadarSignalCard) => void | Promise<void>;
  onCreateTask: (signal: RadarSignalCard) => void | Promise<void>;
  onAddToWatchlist: (signal: RadarSignalCard) => void | Promise<void>;
  onMoreLikeThis: (signal: RadarSignalCard) => void | Promise<void>;
  onLessLikeThis: (signal: RadarSignalCard) => void | Promise<void>;
}> = ({
  pl,
  signal,
  busyAction,
  onAskAi,
  onAddToNote,
  onCreateTask,
  onAddToWatchlist,
  onMoreLikeThis,
  onLessLikeThis,
}) => (
  <SectionShell
    title={pl ? 'Wybrany sygnał' : 'Selected signal'}
    subtitle={pl ? 'Znaczenie, uzasadnienie i akcje.' : 'Meaning, rationale, and actions.'}
  >
    {signal ? (
      <>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
          <SignalBadge label={signal.source.name} />
          <SignalBadge label={signal.relevanceScope} />
          <SignalBadge label={signal.impactType} />
          <SignalBadge label={`${Math.round(signal.confidenceScore * 100)}%`} />
          {isSignalLocalizationPending(signal) && (
            <SignalBadge label={pl ? 'lokalizacja' : 'localizing'} />
          )}
        </div>
        <h3 className="mt-3 text-[20px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
          {getSignalTitle(signal, pl)}
        </h3>
        <p className="mt-2 text-[14px] leading-6 text-slate-600 dark:text-slate-400">
          {getSignalSummary(signal, pl)}
        </p>

        <Callout title={pl ? 'Dlaczego to ważne' : 'Why it matters'} body={signal.whyItMatters} />
        <Callout title={pl ? 'Dlaczego to widzisz' : 'Why you see this'} body={signal.whyYouSeeThis} />
        <Callout title={pl ? 'Co zrobić dalej' : 'What to do next'} body={signal.suggestedNextStep} />

        <div className="mt-4 flex flex-wrap gap-2">
          <GhostButton
            label={pl ? 'Pogadaj z AI' : 'Ask AI'}
            icon={<Brain size={14} />}
            onClick={() => void onAskAi(signal)}
            busy={busyAction === 'ask_ai'}
            tone="violet"
          />
          <GhostButton
            label={pl ? 'Do notatki' : 'To notes'}
            icon={<NotebookPen size={14} />}
            onClick={() => void onAddToNote(signal)}
            busy={busyAction === 'add_to_note'}
            tone="cyan"
          />
          <GhostButton
            label={pl ? 'Utwórz zadanie' : 'Create task'}
            icon={<CheckSquare size={14} />}
            onClick={() => void onCreateTask(signal)}
            busy={busyAction === 'create_task'}
            tone="amber"
          />
          <GhostButton
            label={pl ? 'Watchlist' : 'Watchlist'}
            icon={<TrendingUp size={14} />}
            onClick={() => void onAddToWatchlist(signal)}
            busy={busyAction === 'add_to_watchlist'}
            tone="emerald"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <TinyButton
            label={pl ? 'Interesuje mnie to' : 'This is relevant'}
            onClick={() => void onMoreLikeThis(signal)}
            busy={busyAction === 'more_like_this'}
            tone="emerald"
          />
          <TinyButton
            label={pl ? 'Pokazuj mniej takich' : 'Show fewer like this'}
            onClick={() => void onLessLikeThis(signal)}
            busy={busyAction === 'less_like_this'}
            tone="rose"
          />
          {signal.source.url && (
            <TinyButton
              label={pl ? 'Źródło' : 'Source'}
              onClick={() => window.open(signal.source.url, '_blank', 'noopener,noreferrer')}
              icon={<ArrowUpRight size={12} />}
              tone="slate"
            />
          )}
        </div>
      </>
    ) : (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100/80 px-4 py-5 text-[13px] text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-500">
        {pl
          ? 'Wybierz sygnał z listy, aby zobaczyć interpretację i akcje.'
          : 'Select a signal to see interpretation and actions.'}
      </div>
    )}
  </SectionShell>
);

const RecommendationsPanel: React.FC<{
  pl: boolean;
  recommendations: RadarRecommendation[];
  onSelectSignal: (signalId?: string) => void;
}> = ({ pl, recommendations, onSelectSignal }) => (
  <SectionShell
    title={pl ? 'Co warto zrobić' : 'What to do next'}
    subtitle={pl ? 'Ruchy, pytania, ryzyka i szanse.' : 'Moves, questions, risks, and opportunities.'}
  >
    <div className="space-y-2">
      {recommendations.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelectSignal(item.signalId)}
          className="w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-left transition hover:bg-white dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
            {item.kind}
          </div>
          <div className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-200">{item.title}</div>
          <div className="mt-1 text-[12px] leading-5 text-slate-600 dark:text-slate-400">{item.body}</div>
        </button>
      ))}
    </div>
  </SectionShell>
);

const MetricsPanel: React.FC<{ pl: boolean; data: RadarViewPayload }> = ({ pl, data }) => (
  <SectionShell
    title={pl ? 'Sygnał jakości' : 'Quality signal'}
    subtitle={pl ? 'Podstawowe metryki pracy Radaru.' : 'Baseline Radar operating metrics.'}
  >
    <div className="grid grid-cols-2 gap-2">
      <MetricPill
        label={pl ? 'Sygnały' : 'Signals'}
        value={String(data.metrics.totalSignalsConsidered)}
      />
      <MetricPill
        label={pl ? 'Duplicate' : 'Duplicate'}
        value={`${data.metrics.duplicateRate}%`}
      />
      <MetricPill
        label={pl ? 'Akcje 30d' : 'Actions 30d'}
        value={String(data.metrics.actionedSignalsLast30d)}
      />
      <MetricPill
        label={pl ? 'Save 30d' : 'Save 30d'}
        value={String(data.metrics.savedSignalsLast30d)}
      />
    </div>
  </SectionShell>
);

const OutputsQueuePanel: React.FC<{
  pl: boolean;
  reviewOutputs: UnifiedOutputRow[];
  myOutputs: UnifiedOutputRow[];
  recentOutputs: UnifiedOutputRow[];
  loading: boolean;
  error: string | null;
  onOpenOutput: (row: UnifiedOutputRow) => void;
  onOpenLibrary: (target: 'outputs_all' | 'outputs_mine' | 'outputs_review') => void;
}> = ({ pl, reviewOutputs, myOutputs, recentOutputs, loading, error, onOpenOutput, onOpenLibrary }) => (
  <SectionShell
    title={pl ? 'Moje outputy' : 'My outputs'}
    subtitle={
      pl
        ? 'Osobisty widok artefaktów z tej samej biblioteki outputów.'
        : 'Personal artifact view over the same outputs library.'
    }
  >
    {loading ? (
      <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        {pl ? 'Ładowanie artefaktów...' : 'Loading artifacts...'}
      </div>
    ) : error ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100/80 px-4 py-3 text-[13px] text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-500">
        {pl ? 'Biblioteka outputów jest chwilowo niedostępna.' : 'Outputs library is temporarily unavailable.'}
      </div>
    ) : (
      <div className="space-y-3">
        <OutputsLane
          pl={pl}
          title={pl ? 'Do review' : 'Needs review'}
          emptyLabel={pl ? 'Brak artefaktów do review.' : 'No artifacts waiting for review.'}
          rows={reviewOutputs}
          ctaLabel={pl ? 'Otwórz review queue' : 'Open review queue'}
          onOpenOutput={onOpenOutput}
          onOpenLane={() => onOpenLibrary('outputs_review')}
        />
        <OutputsLane
          pl={pl}
          title={pl ? 'Ostatnie moje' : 'Recent mine'}
          emptyLabel={pl ? 'Brak osobistych artefaktów.' : 'No personal artifacts yet.'}
          rows={myOutputs}
          ctaLabel={pl ? 'Otwórz moje outputy' : 'Open my outputs'}
          onOpenOutput={onOpenOutput}
          onOpenLane={() => onOpenLibrary('outputs_mine')}
        />
        <OutputsLane
          pl={pl}
          title={pl ? 'Ostatnie outputy' : 'Recent outputs'}
          emptyLabel={pl ? 'Brak ostatnich outputów.' : 'No recent outputs yet.'}
          rows={recentOutputs}
          ctaLabel={pl ? 'Otwórz bibliotekę' : 'Open library'}
          onOpenOutput={onOpenOutput}
          onOpenLane={() => onOpenLibrary('outputs_all')}
        />
      </div>
    )}
  </SectionShell>
);

const OutputsLane: React.FC<{
  pl: boolean;
  title: string;
  emptyLabel: string;
  rows: UnifiedOutputRow[];
  ctaLabel: string;
  onOpenOutput: (row: UnifiedOutputRow) => void;
  onOpenLane: () => void;
}> = ({ pl, title, emptyLabel, rows, ctaLabel, onOpenOutput, onOpenLane }) => (
  <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
        {title}
      </div>
      <button
        type="button"
        onClick={onOpenLane}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        {ctaLabel}
        <ArrowUpRight size={12} />
      </button>
    </div>
    {rows.length ? (
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <button
            key={`${row.kind}:${row.originRecordId}`}
            type="button"
            onClick={() => onOpenOutput(row)}
            className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-left transition hover:bg-white dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.06]"
          >
            <div className="rounded-xl bg-slate-900/5 p-2 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
              {row.kind === 'presentation' ? (
                <Presentation size={14} />
              ) : row.kind === 'sheet' ? (
                <FileSpreadsheet size={14} />
              ) : (
                <FileText size={14} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                {row.title}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>{formatOutputKind(row.kind, pl)}</span>
                <span>•</span>
                <span>{formatOutputStatus(row.statusKey, pl)}</span>
                <span>•</span>
                <span>{formatOutputDate(row.updatedAt, pl)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    ) : (
      <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-100/70 px-3 py-3 text-[12px] text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-slate-500">
        {emptyLabel}
      </div>
    )}
  </div>
);

const SectionShell: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <section className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none">
    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
      {title}
    </div>
    <div className="mt-1 text-[13px] text-slate-600 dark:text-slate-500">{subtitle}</div>
    <div className="mt-4">{children}</div>
  </section>
);

const Callout: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
      {title}
    </div>
    <div className="mt-1 text-[13px] leading-6 text-slate-700 dark:text-slate-400">{body}</div>
  </div>
);

const SignalBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
    {label.replace(/_/g, ' ')}
  </span>
);

const MetricPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
      {label}
    </div>
    <div className="mt-1 text-[16px] font-semibold text-slate-900 dark:text-slate-100">{value}</div>
  </div>
);

const GhostButton: React.FC<{
  label: string;
  onClick: () => void;
  busy?: boolean;
  icon?: React.ReactNode;
  tone?: 'violet' | 'cyan' | 'amber' | 'emerald' | 'rose' | 'slate';
}> = ({ label, onClick, busy = false, icon, tone = 'slate' }) => (
  <button
    onClick={onClick}
    disabled={busy}
    className={cn(
      'inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-2 text-[12px] font-medium transition hover:bg-slate-50 disabled:opacity-60 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]',
      tone === 'violet' && 'border-violet-200 text-violet-700 dark:border-violet-300/20 dark:text-violet-100/88',
      tone === 'cyan' && 'border-cyan-200 text-cyan-700 dark:border-cyan-300/20 dark:text-cyan-100/84',
      tone === 'amber' && 'border-amber-200 text-amber-700 dark:border-amber-300/20 dark:text-amber-100/84',
      tone === 'emerald' && 'border-emerald-200 text-emerald-700 dark:border-emerald-300/20 dark:text-emerald-100/84',
      tone === 'rose' && 'border-rose-200 text-rose-700 dark:border-rose-300/20 dark:text-rose-100/84',
      tone === 'slate' && 'border-slate-200 text-slate-700 dark:border-white/10 dark:text-slate-300'
    )}
  >
    {busy ? <Loader2 size={14} className="animate-spin" /> : icon}
    {label}
  </button>
);

const TinyButton: React.FC<{
  label: string;
  onClick: () => void;
  busy?: boolean;
  icon?: React.ReactNode;
  tone?: 'emerald' | 'rose' | 'cyan' | 'slate';
}> = ({ label, onClick, busy = false, icon, tone = 'slate' }) => (
  <button
    onClick={onClick}
    disabled={busy}
    className={cn(
      'inline-flex items-center gap-1 rounded-full border bg-transparent px-2.5 py-1.5 text-[10px] font-medium transition hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-white/[0.04]',
      tone === 'emerald' && 'border-emerald-200 text-emerald-700 dark:border-emerald-300/18 dark:text-emerald-300',
      tone === 'rose' && 'border-rose-200 text-rose-700 dark:border-rose-300/18 dark:text-rose-300',
      tone === 'cyan' && 'border-cyan-200 text-cyan-700 dark:border-cyan-300/18 dark:text-cyan-300',
      tone === 'slate' && 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400'
    )}
  >
    {busy ? <Loader2 size={12} className="animate-spin" /> : icon}
    {label}
  </button>
);

const BgCanvas: React.FC = () => (
  <>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(139,92,246,0.10),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(120,119,198,0.12),transparent)]" />
    <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:44px_44px] dark:opacity-20 dark:[background-image:linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)]" />
    <motion.div
      className="pointer-events-none absolute -left-44 -top-44 h-[38rem] w-[38rem] rounded-full bg-gradient-to-br from-violet-400/25 to-cyan-300/20 blur-[170px] dark:from-violet-600/25 dark:to-cyan-500/20"
      animate={{ x: [0, 30, -18, 0], y: [0, 22, -28, 0], scale: [1, 1.08, 0.94, 1] }}
      transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="pointer-events-none absolute -right-36 top-[20%] h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-amber-300/20 to-rose-300/15 blur-[170px] dark:from-amber-500/20 dark:to-rose-400/15"
      animate={{ x: [0, -26, 18, 0], y: [0, -20, 22, 0], scale: [1, 0.95, 1.07, 1] }}
      transition={{ duration: 36, repeat: Infinity, ease: 'easeInOut' }}
    />
  </>
);

function isSignalLocalizationPending(signal: RadarSignalCard | null | undefined): boolean {
  if (!signal) return false;
  if (signal.isLocalized) return false;
  if (!signal.localizationPending) return false;
  if (!signal.requestedLanguage || !signal.contentLanguage) return false;
  return signal.requestedLanguage !== signal.contentLanguage;
}

function getSignalTitle(signal: RadarSignalCard, pl: boolean): string {
  if (!isSignalLocalizationPending(signal)) return signal.title;
  return pl ? 'Trwa przygotowanie polskiej wersji sygnału...' : 'Preparing English version...';
}

function getSignalSummary(signal: RadarSignalCard, pl: boolean): string {
  if (!isSignalLocalizationPending(signal)) return signal.summary;
  return pl
    ? 'Radar przygotowuje lokalizację tej treści. Widok odświeży się automatycznie.'
    : 'Radar is preparing the localized version of this content. The view will refresh automatically.';
}

function buildNoteBody(signal: RadarSignalCard, pl: boolean): string {
  const localizedTitle = getSignalTitle(signal, pl);
  const localizedSummary = getSignalSummary(signal, pl);
  return pl
    ? [
        `Sygnał Radaru: ${localizedTitle}`,
        '',
        `Podsumowanie: ${localizedSummary}`,
        '',
        `Dlaczego to ważne: ${signal.whyItMatters}`,
        `Dlaczego to widzę: ${signal.whyYouSeeThis}`,
        `Sugerowany następny krok: ${signal.suggestedNextStep}`,
        '',
        `Źródło: ${signal.source.name}`,
        `Tagi: ${signal.tags.topics.join(', ') || 'brak'}`,
      ].join('\n')
    : [
        `Radar signal: ${localizedTitle}`,
        '',
        `Summary: ${localizedSummary}`,
        '',
        `Why it matters: ${signal.whyItMatters}`,
        `Why I see this: ${signal.whyYouSeeThis}`,
        `Suggested next step: ${signal.suggestedNextStep}`,
        '',
        `Source: ${signal.source.name}`,
        `Tags: ${signal.tags.topics.join(', ') || 'n/a'}`,
      ].join('\n');
}

function formatOutputKind(kind: UnifiedOutputRow['kind'], pl: boolean): string {
  if (kind === 'presentation') return pl ? 'Prezentacja' : 'Presentation';
  if (kind === 'sheet') return pl ? 'Arkusz' : 'Sheet';
  return pl ? 'Dokument' : 'Document';
}

function formatOutputStatus(statusKey: string, pl: boolean): string {
  const normalized = String(statusKey || '').toLowerCase();
  const labels: Record<string, { pl: string; en: string }> = {
    draft: { pl: 'Szkic', en: 'Draft' },
    ready: { pl: 'Gotowe', en: 'Ready' },
    generated: { pl: 'Wygenerowane', en: 'Generated' },
    editing: { pl: 'W edycji', en: 'Editing' },
    shared: { pl: 'Udostępnione', en: 'Shared' },
    exported: { pl: 'Wyeksportowane', en: 'Exported' },
    archived: { pl: 'Zarchiwizowane', en: 'Archived' },
  };
  const label = labels[normalized];
  if (label) return pl ? label.pl : label.en;
  return statusKey || (pl ? 'Status' : 'Status');
}

function formatOutputDate(value: string, pl: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(pl ? 'pl-PL' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}
