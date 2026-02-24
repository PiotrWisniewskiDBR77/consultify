import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Flower2,
  Globe,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  Rocket,
  Save,
  Send,
  Sparkles,
  Sprout,
  Star,
  ThumbsUp,
  Trash2,
  TreePine,
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

import type { MyIdea } from './MyIdeasListContent';

type IdeaStage = 'seed' | 'expanding' | 'researching' | 'proposing' | 'summary' | 'done';

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
  onClose: () => void;
  onSaved: (idea: MyIdea) => void;
}

const STAGE_ORDER: IdeaStage[] = ['seed', 'expanding', 'researching', 'proposing', 'summary', 'done'];

const POTENTIAL_CONFIG: Record<string, { color: string; label: string; labelPl: string }> = {
  high: { color: 'text-emerald-500', label: 'High potential', labelPl: 'Wysoki potencjał' },
  medium: { color: 'text-amber-500', label: 'Medium potential', labelPl: 'Średni potencjał' },
  low: { color: 'text-slate-400', label: 'Needs refinement', labelPl: 'Wymaga dopracowania' },
};

export const IdeaDetailView: React.FC<IdeaDetailViewProps> = ({ ideaId, onClose, onSaved }) => {
  const { i18n, t } = useTranslation();
  const isPolish = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);
  const isNew = useMemo(() => ideaId.startsWith('new-idea-'), [ideaId]);

  const [loading, setLoading] = useState(!isNew);
  const [seedText, setSeedText] = useState('');
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState<IdeaStage>('seed');
  const [developing, setDeveloping] = useState(false);

  // AI-generated content
  const [aiExpansion, setAiExpansion] = useState('');
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [researchAnswer, setResearchAnswer] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [summary, setSummary] = useState<IdeaSummary | null>(null);
  const [stageLabel, setStageLabel] = useState('');

  const [realId, setRealId] = useState(ideaId);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = useCallback(() => {
    setTimeout(() => contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' }), 200);
  }, []);

  const handleDevelop = useCallback(async () => {
    const text = seedText.trim();
    if (!text) { toast.error(isPolish ? 'Opisz swój pomysł' : 'Describe your idea'); return; }

    let currentId = realId;

    if (isNew) {
      try {
        const created = await Api.createMyIdea({
          title: text.split('\n')[0]?.slice(0, 120) || (isPolish ? 'Nowy pomysł' : 'New idea'),
          body: text,
          tags: [],
          sourceType: 'manual',
        });
        currentId = created?.id || currentId;
        setRealId(currentId);
        setTitle(created?.title || text.split('\n')[0]?.slice(0, 120) || '');
        onSaved(created as MyIdea);
      } catch {
        toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
        return;
      }
    }

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
        body: JSON.stringify({ seedText: text, language: i18n.language }),
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
                setStage('done');
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
  }, [seedText, realId, isNew, isPolish, i18n.language, onSaved, scrollToBottom]);

  const toggleProposalLike = (idx: number) => {
    setProposals(prev => prev.map((p, i) => i === idx ? { ...p, liked: !p.liked } : p));
  };

  const handlePromoteToChat = () => {
    toast.success(isPolish ? 'Idea gotowa do omówienia w Team Chat' : 'Idea ready for Team Chat discussion');
  };

  const handlePromoteToInitiative = () => {
    toast.success(isPolish ? 'Idea promowana do inicjatywy' : 'Idea promoted to initiative');
  };

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
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
          <X size={16} />
        </button>
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
                  onClick={handlePromoteToChat}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-500/10 border border-purple-400/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
                >
                  <MessageSquarePlus size={16} />
                  {isPolish ? 'Omów w Team Chat' : 'Discuss in Team Chat'}
                </motion.button>
                <motion.button
                  onClick={handlePromoteToInitiative}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all"
                >
                  <Rocket size={16} />
                  {isPolish ? 'Utwórz inicjatywę' : 'Create initiative'}
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
        {developing && stage !== 'done' && !aiExpansion && (
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
      </div>
    </div>
  );
};

export default IdeaDetailView;
