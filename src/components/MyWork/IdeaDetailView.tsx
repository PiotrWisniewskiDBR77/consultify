import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  Flower2,
  GitBranch,
  Globe,
  Loader2,
  MessageSquarePlus,
  Rocket,
  Scale,
  Sparkles,
  Sprout,
  Star,
  Target,
  ThumbsUp,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '@/services/api';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

import { AIConnections } from './shared/AIConnections';
import { buildAskAIMessage } from './shared/askAiHelper';
import { IdeaRecommendationMap } from './IdeaRecommendationMap';
import type { MyIdea } from './MyIdeasListContent';

type IdeaStage = 'seed' | 'expanding' | 'researching' | 'proposing' | 'summary' | 'ready' | 'promoted';

interface ResearchItem {
  title: string;
  url: string;
  snippet: string;
}

interface Proposal {
  title: string;
  description: string;
  whyItMatters: string;
  liked?: boolean;
}

interface IdeaSummary {
  verdict: string;
  potential: string;
  complexity: string;
  timeToValue: string;
  nextSteps: string[];
}

interface IdeaDetailViewProps {
  ideaId: string;
  initialOpenMap?: boolean;
  onClose: () => void;
  onSaved: (idea: MyIdea) => void;
}

const STAGE_ORDER: IdeaStage[] = [
  'seed',
  'expanding',
  'researching',
  'proposing',
  'summary',
  'ready',
  'promoted',
];

const POTENTIAL_CONFIG: Record<string, { color: string; label: string; labelPl: string }> = {
  high: { color: 'text-emerald-500', label: 'High potential', labelPl: 'Wysoki potencjał' },
  medium: { color: 'text-amber-500', label: 'Medium potential', labelPl: 'Średni potencjał' },
  low: { color: 'text-slate-400', label: 'Needs refinement', labelPl: 'Wymaga dopracowania' },
};

export const IdeaDetailView: React.FC<IdeaDetailViewProps> = ({
  ideaId,
  initialOpenMap,
  onClose,
  onSaved,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);
  const isNew = useMemo(() => ideaId.startsWith('new-idea-'), [ideaId]);
  const { emitMyWorkEvent, setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();

  const [loading, setLoading] = useState(!isNew);
  const [seedText, setSeedText] = useState('');
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<IdeaStage>('seed');
  const [developing, setDeveloping] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapIdeaId, setMapIdeaId] = useState<string | null>(null);
  const autoOpenedMapRef = useRef(false);

  // AI-generated content
  const [aiExpansion, setAiExpansion] = useState('');
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [researchAnswer, setResearchAnswer] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [summary, setSummary] = useState<IdeaSummary | null>(null);
  const [stageLabel, setStageLabel] = useState('');

  const [realId, setRealId] = useState(ideaId);
  const contentRef = useRef<HTMLDivElement>(null);

  const ensureSaved = useCallback(
    async (seed: string) => {
      const text = seed.trim();
      if (!text) {
        toast.error(isPolish ? 'Opisz swój pomysł' : 'Describe your idea');
        return null;
      }
      if (!isNew) return realId;

      try {
        const created = await Api.createMyIdea({
          title: text.split('\n')[0]?.slice(0, 120) || (isPolish ? 'Nowy pomysł' : 'New idea'),
          body: text,
          tags: [],
          sourceType: 'manual',
        });
        const nextId = created?.id || realId;
        setRealId(nextId);
        setTitle(created?.title || text.split('\n')[0]?.slice(0, 120) || '');
        onSaved(created as MyIdea);
        return nextId;
      } catch {
        toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
        return null;
      }
    },
    [isNew, isPolish, onSaved, realId]
  );

  useEffect(() => {
    if (isNew) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const idea = (await Api.getMyIdea(ideaId)) as any;
        if (cancelled) return;
        setTitle(idea?.title || '');
        setSeedText(idea?.seed_text || idea?.seedText || idea?.body || '');
        setAiExpansion(idea?.ai_expansion || idea?.aiExpansion || '');
        setStage((idea?.stage as IdeaStage) || 'seed');
        try { setResearch(JSON.parse(idea?.research_data || idea?.researchData || '[]')); } catch { setResearch([]); }
        try { setProposals(JSON.parse(idea?.creative_proposals || idea?.creativeProposals || '[]')); } catch { setProposals([]); }
        try { setSummary(JSON.parse(idea?.summary_data || idea?.summaryData || 'null')); } catch { setSummary(null); }
      } catch {
        toast.error(t('myWork.errors.fetchFailed', 'Failed to load idea'));
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [ideaId, isNew, t]);

  useEffect(() => {
    if (!initialOpenMap) return;
    if (autoOpenedMapRef.current) return;
    if (isNew) return;
    if (loading) return;
    autoOpenedMapRef.current = true;
    setMapIdeaId(realId);
    setMapOpen(true);
  }, [initialOpenMap, isNew, loading, realId]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' }), 200);
  }, []);

  const handleDevelop = useCallback(async () => {
    const currentId = await ensureSaved(seedText);
    if (!currentId) return;

    setDeveloping(true);
    setStage('expanding');
    setAiExpansion('');
    setResearch([]);
    setProposals([]);
    setSummary(null);

    try {
      const res = await fetch(`${API_URL}/my-work/my-ideas/${currentId}/develop`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedText: seedText.trim(), language: i18n.language }),
      });

      if (!res.ok) throw new Error('Development failed');
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case 'stage':
                setStage(event.stage);
                setStageLabel(event.label || '');
                scrollToBottom();
                break;
              case 'expansion':
                setAiExpansion(event.content || '');
                setTitle(prev => prev || (event.content || '').split('\n')[0]?.replace(/^#+\s*/, '').slice(0, 120));
                scrollToBottom();
                break;
              case 'research':
                setResearch(event.results || []);
                setResearchAnswer(event.answer || '');
                scrollToBottom();
                break;
              case 'proposals':
                setProposals((event.proposals || []).map((p: any) => ({ ...p, liked: false })));
                scrollToBottom();
                break;
              case 'summary':
                setSummary(event.summary || null);
                scrollToBottom();
                break;
              case 'done':
                setStage((event.stage as IdeaStage) || 'ready');
                break;
              case 'error':
                toast.error(event.message || 'Error');
                break;
            }
          } catch { /* skip unparseable */ }
        }
      }

      trackFunnelEvent('my_idea_developed', { ideaId: currentId });
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally {
      setDeveloping(false);
    }
  }, [seedText, ensureSaved, i18n.language, scrollToBottom]);

  const toggleProposalLike = (idx: number) => {
    setProposals(prev => prev.map((p, i) => i === idx ? { ...p, liked: !p.liked } : p));
  };

  const handleOpenChat = () => {
    setChatKickoffMessage(buildAskAIMessage({
      type: 'idea',
      title: title || seedText?.slice(0, 80) || 'Untitled Idea',
      description: seedText || undefined,
    }));
    if (isChatCollapsed) toggleChatCollapse();
  };

  const handleOpenMap = useCallback(async () => {
    const currentId = await ensureSaved(seedText);
    if (!currentId) return;
    setMapIdeaId(currentId);
    setMapOpen(true);
  }, [ensureSaved, seedText]);

  const handleConvert = useCallback(
    async (target: 'initiative' | 'task_set' | 'decision' | 'team_chat') => {
      const currentId = await ensureSaved(seedText);
      if (!currentId) return;

      try {
        setConverting(true);
        const result = await Api.convertMyIdea(currentId, {
          target,
          options: {
            language: i18n.language,
          },
        });

        trackFunnelEvent(`idea_converted_${target}`, { ideaId: currentId });

        // Refresh state so UI reflects promoted stage
        try {
          const updated = (await Api.getMyIdea(currentId)) as any;
          setStage((updated?.stage as IdeaStage) || 'promoted');
        } catch {
          // ignore
        }

        setConvertOpen(false);
        toast.success(
          target === 'initiative'
            ? isPolish
              ? 'Utworzono inicjatywę'
              : 'Initiative created'
            : target === 'task_set'
              ? isPolish
                ? 'Utworzono taski'
                : 'Tasks created'
              : target === 'decision'
                ? isPolish
                  ? 'Utworzono decyzję'
                  : 'Decision created'
                : isPolish
                  ? 'Wysłano do Team Chat'
                  : 'Posted to Team Chat'
        );
        emitMyWorkEvent({ type: 'item:converted', entityType: 'idea', entityId: currentId, meta: { target } });

        return result;
      } catch (err: any) {
        toast.error(err?.message || (isPolish ? 'Nie udało się wykonać konwersji' : 'Convert failed'));
        return null;
      } finally {
        setConverting(false);
      }
    },
    [ensureSaved, i18n.language, isPolish, seedText]
  );

  const stageIndex = STAGE_ORDER.indexOf(stage);
  const isStageReached = (s: IdeaStage) => STAGE_ORDER.indexOf(s) <= stageIndex;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-navy-950">
      {mapOpen && (
        <IdeaRecommendationMap
          ideaId={mapIdeaId || realId}
          ideaTitle={title || seedText?.split('\n')[0]?.slice(0, 120) || (isPolish ? 'Pomysł' : 'Idea')}
          onClose={() => setMapOpen(false)}
          onCenterEdit={() => {
            setMapOpen(false);
            setTimeout(() => {
              try {
                contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              } catch {
                // ignore
              }
            }, 50);
          }}
        />
      )}

      {/* Convert modal */}
      <AnimatePresence>
        {convertOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => !converting && setConvertOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.25, bounce: 0.12 }}
              className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-navy-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-500" />
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {isPolish ? 'Konwertuj pomysł' : 'Convert idea'}
                  </div>
                </div>
                <button
                  onClick={() => setConvertOpen(false)}
                  disabled={converting}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Wybierz, co chcesz zrobić z tym pomysłem. System przeniesie kontekst (opis, AI verdict i next steps).'
                    : 'Choose what to create from this idea. We will carry over context (description, AI verdict and next steps).'}
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleConvert('initiative')}
                    disabled={converting}
                    className="text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <Rocket size={16} className="text-amber-500" />
                      {isPolish ? 'Inicjatywa' : 'Initiative'}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Utwórz inicjatywę w PMO' : 'Create a PMO initiative'}
                    </div>
                  </button>

                  <button
                    onClick={() => handleConvert('task_set')}
                    disabled={converting}
                    className="text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      {isPolish ? 'Taski (z next steps)' : 'Tasks (from next steps)'}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {isPolish
                        ? 'Utwórz zestaw personal tasków'
                        : 'Create a set of personal tasks'}
                    </div>
                  </button>

                  <button
                    onClick={() => handleConvert('decision')}
                    disabled={converting}
                    className="text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <Star size={16} className="text-blue-500" />
                      {isPolish ? 'Decyzja' : 'Decision'}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Utwórz artefakt decyzyjny' : 'Create a decision artifact'}
                    </div>
                  </button>

                  <button
                    onClick={() => handleConvert('team_chat')}
                    disabled={converting}
                    className="text-left p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <MessageSquarePlus size={16} className="text-purple-500" />
                      {isPolish ? 'Team Chat' : 'Team Chat'}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Opublikuj wątek do omówienia' : 'Post a discussion thread'}
                    </div>
                  </button>
                </div>

                {/* Preview: next steps */}
                {summary?.nextSteps?.length ? (
                  <div className="mt-2 rounded-xl border border-slate-200/70 dark:border-navy-700 bg-slate-50/60 dark:bg-navy-950/30 px-4 py-3">
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      {isPolish ? 'Preview next steps' : 'Next steps preview'}
                    </div>
                    <div className="mt-2 space-y-1">
                      {summary.nextSteps.slice(0, 6).map((s, idx) => (
                        <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="line-clamp-2">{s}</span>
                        </div>
                      ))}
                      {summary.nextSteps.length > 6 && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isPolish
                            ? `+${summary.nextSteps.length - 6} kolejnych`
                            : `+${summary.nextSteps.length - 6} more`}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                <button
                  onClick={() => setConvertOpen(false)}
                  disabled={converting}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
                >
                  {isPolish ? 'Zamknij' : 'Close'}
                </button>
                {converting && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    {isPolish ? 'Tworzę…' : 'Creating…'}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-navy-700 bg-gradient-to-r from-amber-50/60 via-white to-emerald-50/40 dark:from-navy-900 dark:via-navy-900/90 dark:to-navy-900">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400/20 to-emerald-400/20 dark:from-amber-500/15 dark:to-emerald-500/15">
            <Flower2 size={20} className="text-amber-500" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {title || (isNew ? (isPolish ? 'Nowy pomysł' : 'New idea') : (isPolish ? 'Pomysł' : 'Idea'))}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <Sparkles size={10} />
              {isPolish ? 'Ogród Pomysłów — Inkubator AI' : 'Idea Garden — AI Incubator'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenMap}
            className="px-3 py-2 rounded-xl hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors text-[12px] font-semibold flex items-center gap-2"
            title={isPolish ? 'Otwórz mapę rekomendacji' : 'Open recommendation map'}
          >
            <GitBranch size={16} />
            {isPolish ? 'Mapa' : 'Map'}
          </button>
          <button
            onClick={handleOpenChat}
            className="p-2 rounded-xl hover:bg-purple-500/10 text-purple-500 transition-colors"
            title={isPolish ? 'Zapytaj AI o ten pomysł' : 'Ask AI about this idea'}
          >
            <Sparkles size={16} />
          </button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {stage !== 'seed' && (
        <div className="px-5 py-3 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 mb-2">
            {[
              { s: 'expanding', icon: Sparkles, label: isPolish ? 'Rozwój' : 'Expand' },
              { s: 'researching', icon: Globe, label: isPolish ? 'Badania' : 'Research' },
              { s: 'proposing', icon: Zap, label: isPolish ? 'Propozycje' : 'Proposals' },
              { s: 'summary', icon: Star, label: isPolish ? 'Podsumowanie' : 'Summary' },
              { s: 'ready', icon: CheckCircle2, label: isPolish ? 'Gotowe' : 'Ready' },
            ].map(({ s, icon: Icon, label }, i) => {
              const reached = isStageReached(s as IdeaStage);
              const active = stage === s;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <div className={`flex-1 h-0.5 rounded-full transition-colors duration-500 ${reached ? 'bg-amber-400' : 'bg-slate-200 dark:bg-navy-700'}`} />}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-300 ${active ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 scale-105' : reached ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>
                    {active && developing ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          {stageLabel && developing && (
            <div className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">{stageLabel}</div>
          )}
        </div>
      )}

      {/* Ready for action CTA */}
      {(stage === 'ready' || stage === 'summary') && !convertOpen && (
        <div className="px-5 py-2.5 border-b border-amber-200/40 dark:border-amber-800/20 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/15 dark:to-orange-950/10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
                {isPolish ? 'Pomysł gotowy do działania' : 'Idea ready for action'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleConvert('task_set')}
                disabled={converting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                <CheckSquare size={12} />
                {isPolish ? 'Utwórz taski' : 'Create Tasks'}
              </button>
              <button
                onClick={() => handleConvert('decision')}
                disabled={converting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all"
              >
                <Scale size={12} />
                {isPolish ? 'Decyzja' : 'Decision'}
              </button>
              <button
                onClick={() => handleConvert('initiative')}
                disabled={converting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all"
              >
                <Target size={12} />
                {isPolish ? 'Inicjatywa' : 'Initiative'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* SEED Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <Sprout size={16} className="text-amber-500" />
            </div>
            {isPolish ? 'Zasiej swój pomysł' : 'Plant your idea'}
          </div>
          <textarea
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            rows={stage === 'seed' ? 6 : 3}
            disabled={developing}
            placeholder={isPolish
              ? 'Opisz swój pomysł... np. "Chcę wdrożyć predykcyjne utrzymanie ruchu na liniach pakowania"'
              : 'Describe your idea... e.g. "I want to implement predictive maintenance on packaging lines"'}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400 placeholder:text-slate-400 disabled:opacity-60 transition-all resize-none"
          />
          {stage === 'seed' && (
            <div className="flex items-center gap-3">
              <motion.button
                onClick={handleDevelop}
                disabled={developing || !seedText.trim()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Rocket size={18} />
                {isPolish ? 'Rozwiń mój pomysł z AI' : 'Grow my idea with AI'}
                <ArrowRight size={16} />
              </motion.button>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                {isPolish ? 'AI zbada, rozwinie i zaproponuje warianty' : 'AI will research, expand, and propose variants'}
              </span>
            </div>
          )}
        </div>

        {/* AI EXPANSION */}
        <AnimatePresence>
          {isStageReached('expanding') && aiExpansion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <div className="p-1.5 rounded-lg bg-purple-500/10">
                  <Sparkles size={16} className="text-purple-500" />
                </div>
                {isPolish ? 'AI rozwinięcie' : 'AI expansion'}
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50/50 to-amber-50/30 dark:from-purple-900/20 dark:to-amber-900/10 border border-purple-200/40 dark:border-purple-500/20">
                <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{aiExpansion}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RESEARCH */}
        <AnimatePresence>
          {isStageReached('researching') && (research.length > 0 || researchAnswer) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <Globe size={16} className="text-blue-500" />
                </div>
                {isPolish ? 'Badania i kontekst' : 'Research & context'}
              </div>
              {researchAnswer && (
                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/40 dark:border-blue-500/20">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                    {isPolish ? 'Podsumowanie z sieci' : 'Web summary'}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{researchAnswer}</div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {research.map((r, i) => (
                  <motion.a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="group p-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-blue-400/50 dark:hover:border-blue-500/30 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <ExternalLink size={14} className="text-blue-500 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-900 dark:text-white line-clamp-2">{r.title}</div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{r.snippet}</div>
                      </div>
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CREATIVE PROPOSALS */}
        <AnimatePresence>
          {isStageReached('proposing') && proposals.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <Zap size={16} className="text-emerald-500" />
                </div>
                {isPolish ? 'Kreatywne propozycje' : 'Creative proposals'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {proposals.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      p.liked
                        ? 'border-emerald-400/60 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-md shadow-emerald-500/10'
                        : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-emerald-300/50 dark:hover:border-emerald-500/20 hover:shadow-md'
                    }`}
                    onClick={() => toggleProposalLike(i)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{p.title}</div>
                      <button
                        className={`p-1.5 rounded-lg transition-colors ${
                          p.liked
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10'
                        }`}
                      >
                        <ThumbsUp size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">{p.description}</div>
                    <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <TrendingUp size={11} />
                      {p.whyItMatters}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SUMMARY */}
        <AnimatePresence>
          {isStageReached('summary') && summary && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Star size={16} className="text-amber-500" />
                </div>
                {isPolish ? 'Podsumowanie' : 'Summary'}
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 via-white to-purple-50/30 dark:from-amber-900/15 dark:via-navy-900 dark:to-purple-900/10 border border-amber-200/50 dark:border-amber-500/20 shadow-lg shadow-amber-500/5">
                {/* Verdict */}
                <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-4 font-medium italic">
                  "{summary.verdict}"
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-xl bg-white/60 dark:bg-navy-800/60">
                    <div className={`text-lg font-semibold ${POTENTIAL_CONFIG[summary.potential]?.color || 'text-slate-500'}`}>
                      {summary.potential === 'high' ? (isPolish ? 'Wysoki' : 'High') : summary.potential === 'medium' ? (isPolish ? 'Średni' : 'Medium') : (isPolish ? 'Niski' : 'Low')}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-0.5">{isPolish ? 'Potencjał' : 'Potential'}</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/60 dark:bg-navy-800/60">
                    <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                      {summary.complexity === 'low' ? (isPolish ? 'Niska' : 'Low') : summary.complexity === 'medium' ? (isPolish ? 'Średnia' : 'Medium') : (isPolish ? 'Wysoka' : 'High')}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-0.5">{isPolish ? 'Złożoność' : 'Complexity'}</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/60 dark:bg-navy-800/60">
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{summary.timeToValue}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-0.5">{isPolish ? 'Czas do wartości' : 'Time to value'}</div>
                  </div>
                </div>

                {/* Next Steps */}
                {(summary.nextSteps || []).length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
                      {isPolish ? 'Następne kroki' : 'Next steps'}
                    </div>
                    {summary.nextSteps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <motion.button
                  onClick={() => setConvertOpen(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-500/10 border border-purple-400/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
                >
                  <Sparkles size={16} />
                  {isPolish ? 'Konwertuj' : 'Convert'}
                </motion.button>
                <motion.button
                  onClick={handleDevelop}
                  disabled={developing}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-50 transition-colors"
                >
                  <Sparkles size={16} />
                  {isPolish ? 'Rozwiń ponownie' : 'Develop again'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading placeholder when developing */}
        {developing && stage !== 'promoted' && !aiExpansion && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/20" />
                <Sparkles size={32} className="text-amber-500 animate-pulse relative" />
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                {stageLabel || (isPolish ? 'AI podlewa Twój pomysł...' : 'AI is nurturing your idea...')}
              </div>
            </div>
          </div>
        )}

        {!isNew && realId && <AIConnections entityType="idea" entityId={realId} />}
      </div>
    </div>
  );
};

export default IdeaDetailView;
