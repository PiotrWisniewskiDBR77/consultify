import {
  Bot,
  CheckCircle2,
  Flower2,
  GitBranch,
  Lightbulb,
  Loader2,
  Plus,
  Rocket,
  Sparkles,
  Sprout,
  Tag,
  TreePine,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

const IdeasMindMap = React.lazy(() => import('./IdeasMindMap'));

class MindMapErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export type IdeaStage = 'spark' | 'incubating' | 'shaping' | 'ready' | 'promoted';

export type MyIdea = {
  id: string;
  title: string;
  body?: string | null;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  sourceType?: string | null;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  stage?: IdeaStage;
  potential?: string | null;
  complexity?: string | null;
  aiExpansion?: string | null;
  promotedTo?: string | null;
  area?: string | null;
  priority?: number | null;
  branch?: string | null;
};

export type IdeasViewMode = 'list' | 'cards' | 'garden' | 'mindmap';

interface MyIdeasListContentProps {
  viewMode?: IdeasViewMode;
  searchQuery: string;
  onIdeaClick: (ideaId: string, ideaData?: MyIdea) => void;
  onCreateIdea: () => void;
  onCountsChange: (counts: { total: number }) => void;
}

const STAGE_CONFIG: Record<IdeaStage, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
}> = {
  spark: {
    icon: Lightbulb,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/15',
    borderColor: 'border-amber-400/30 dark:border-amber-500/20',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-600 dark:text-amber-400',
  },
  incubating: {
    icon: Sprout,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    borderColor: 'border-emerald-400/30 dark:border-emerald-500/20',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
  },
  shaping: {
    icon: TreePine,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/15',
    borderColor: 'border-blue-400/30 dark:border-blue-500/20',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-600 dark:text-blue-400',
  },
  ready: {
    icon: CheckCircle2,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10 dark:bg-purple-500/15',
    borderColor: 'border-purple-400/30 dark:border-purple-500/20',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-600 dark:text-purple-400',
  },
  promoted: {
    icon: Rocket,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10 dark:bg-rose-500/15',
    borderColor: 'border-rose-400/30 dark:border-rose-500/20',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-600 dark:text-rose-400',
  },
};

function mapRawStageToStage(raw?: string | null): IdeaStage {
  if (!raw) return 'spark';
  const s = raw.toLowerCase();
  if (s === 'done' || s === 'summary' || s === 'shaping') return 'shaping';
  if (s === 'expanding' || s === 'researching' || s === 'proposing' || s === 'incubating') return 'incubating';
  if (s === 'ready') return 'ready';
  if (s === 'promoted') return 'promoted';
  if (s === 'seed' || s === 'spark') return 'spark';
  return 'spark';
}

export const MyIdeasListContent: React.FC<MyIdeasListContentProps> = ({
  viewMode = 'garden',
  searchQuery,
  onIdeaClick,
  onCreateIdea,
  onCountsChange,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [ideas, setIdeas] = useState<MyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string>('all');

  const fetchIdeas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getMyIdeas({ q: searchQuery || undefined, limit: 200 });
      const mapped = ((data || []) as any[]).map((raw) => ({
        ...raw,
        stage: mapRawStageToStage(raw.stage),
      }));
      setIdeas(mapped as MyIdea[]);
    } catch (err) {
      console.error('Failed to fetch ideas:', err);
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load ideas'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, t]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  useEffect(() => {
    onCountsChange({ total: ideas.length });
  }, [ideas.length, onCountsChange]);

  const tags = useMemo(() => {
    const s = new Set<string>();
    ideas.forEach((i) => (i.tags || []).forEach((tag) => s.add(String(tag).toLowerCase())));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
    if (activeTag === 'all') return ideas;
    return ideas.filter((i) =>
      (i.tags || []).map((x) => String(x).toLowerCase()).includes(activeTag)
    );
  }, [ideas, activeTag]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ minHeight: 300 }}>
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl">
      <div className="relative mb-4">
        <Flower2 size={48} className="text-amber-400" />
        <Sparkles size={16} className="absolute -top-1 -right-1 text-amber-500 animate-pulse" />
      </div>
      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
        {isPolish ? 'Twój ogród pomysłów czeka' : 'Your Idea Garden awaits'}
      </h3>
      <p className="text-sm text-slate-500 mb-4 max-w-md">
        {isPolish
          ? 'Zasiej pierwszy pomysł — AI pomoże go rozwinąć, zbada kontekst i zaproponuje kreatywne warianty.'
          : 'Plant your first idea — AI will help it grow, research context, and propose creative variants.'}
      </p>
      <button
        onClick={onCreateIdea}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all"
      >
        <Plus size={16} />
        {isPolish ? 'Zasiej pomysł' : 'Plant an idea'}
      </button>
    </div>
  );

  const renderStageBadge = (stage: IdeaStage) => {
    const cfg = STAGE_CONFIG[stage];
    const Icon = cfg.icon;
    const labels: Record<IdeaStage, { en: string; pl: string }> = {
      spark: { en: 'Spark', pl: 'Iskra' },
      incubating: { en: 'Growing', pl: 'Rośnie' },
      shaping: { en: 'Shaping', pl: 'Kształtuje się' },
      ready: { en: 'Ready', pl: 'Gotowy' },
      promoted: { en: 'Promoted', pl: 'Promowany' },
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}>
        <Icon size={10} />
        {isPolish ? labels[stage].pl : labels[stage].en}
      </span>
    );
  };

  const renderPotentialDot = (potential?: string | null) => {
    if (!potential) return null;
    const colors: Record<string, string> = {
      high: 'bg-emerald-400',
      medium: 'bg-amber-400',
      low: 'bg-slate-400',
    };
    return <span className={`w-2 h-2 rounded-full ${colors[potential] || 'bg-slate-300'}`} title={potential} />;
  };

  const renderSourceBadge = (sourceType?: string | null) => {
    const isAI = sourceType === 'ai_chat' || sourceType === 'ai_hint' || sourceType === 'ai_suggestion';
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
          isAI
            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
            : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'
        }`}
        title={isAI ? 'AI-generated' : 'Created by you'}
      >
        {isAI ? <Bot size={9} /> : <User size={9} />}
        {isAI ? 'AI' : isPolish ? 'Ty' : 'You'}
      </span>
    );
  };

  const renderAreaBadge = (area?: string | null) => {
    if (!area) return null;
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-400/20">
        <GitBranch size={9} />
        {area}
      </span>
    );
  };

  const renderPriorityBar = (priority?: number | null) => {
    const p = priority ?? 50;
    const w = Math.max(10, Math.min(100, p));
    const color = p >= 75 ? 'bg-emerald-400' : p >= 50 ? 'bg-amber-400' : 'bg-slate-400';
    return (
      <div className="w-12 h-1 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden" title={`${isPolish ? 'Priorytet' : 'Priority'}: ${p}/100`}>
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${w}%` }} />
      </div>
    );
  };

  // ──────────── MIND MAP VIEW ────────────
  if (viewMode === 'mindmap') {
    return (
      <div className="w-full h-full overflow-hidden">
        <MindMapErrorBoundary fallback={
          <div className="w-full flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: 300 }}>
            <GitBranch size={48} className="text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
              {isPolish ? 'Nie udało się załadować mapy myśli' : 'Failed to load mind map'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {isPolish ? 'Spróbuj odświeżyć stronę (Cmd+Shift+R)' : 'Try refreshing the page (Cmd+Shift+R)'}
            </p>
          </div>
        }>
          <React.Suspense fallback={
            <div className="flex-1 flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-amber-500" size={32} />
            </div>
          }>
            <IdeasMindMap
              ideas={filteredIdeas}
              onIdeaClick={onIdeaClick}
              onCreateIdea={onCreateIdea}
              isPolish={!!isPolish}
            />
          </React.Suspense>
        </MindMapErrorBoundary>
      </div>
    );
  }

  // ──────────── GARDEN VIEW ────────────
  if (viewMode === 'garden') {
    if (filteredIdeas.length === 0) return <div className="p-4 overflow-y-auto h-full">{renderEmpty()}</div>;

    const allSections: { stage: IdeaStage; ideas: MyIdea[] }[] = [
      { stage: 'spark' as IdeaStage, ideas: filteredIdeas.filter((i) => i.stage === 'spark') },
      { stage: 'incubating' as IdeaStage, ideas: filteredIdeas.filter((i) => i.stage === 'incubating') },
      { stage: 'shaping' as IdeaStage, ideas: filteredIdeas.filter((i) => i.stage === 'shaping') },
      { stage: 'ready' as IdeaStage, ideas: filteredIdeas.filter((i) => i.stage === 'ready') },
      { stage: 'promoted' as IdeaStage, ideas: filteredIdeas.filter((i) => i.stage === 'promoted') },
    ];
    const gardenSections = allSections.filter((s) => s.ideas.length > 0);

    const sectionLabels: Record<IdeaStage, { en: string; pl: string; desc_en: string; desc_pl: string }> = {
      spark: {
        en: 'New Sparks',
        pl: 'Nowe iskry',
        desc_en: 'Fresh ideas waiting to be developed',
        desc_pl: 'Świeże pomysły czekające na rozwój',
      },
      incubating: {
        en: 'Incubating',
        pl: 'W inkubatorze',
        desc_en: 'AI is expanding and researching these ideas',
        desc_pl: 'AI rozwija i bada te pomysły',
      },
      shaping: {
        en: 'Taking Shape',
        pl: 'Nabierają kształtu',
        desc_en: 'Proposals ready, summary generated',
        desc_pl: 'Propozycje gotowe, podsumowanie wygenerowane',
      },
      ready: {
        en: 'Ready for Team',
        pl: 'Gotowe dla zespołu',
        desc_en: 'Fully developed ideas ready to promote',
        desc_pl: 'W pełni opracowane pomysły gotowe do promocji',
      },
      promoted: {
        en: 'Promoted',
        pl: 'Promowane',
        desc_en: 'Ideas that became initiatives or team discussions',
        desc_pl: 'Pomysły, które stały się inicjatywami lub dyskusjami zespołu',
      },
    };

    return (
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
        <div className="p-4 space-y-6">
          {/* Tag filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTag('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeTag === 'all'
                  ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
            >
              {t('myWork.ideas.tags.all', 'All')}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeTag === tag
                    ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
                title={tag}
              >
                <span className="inline-flex items-center gap-1">
                  <Tag size={12} />
                  {tag}
                </span>
              </button>
            ))}
          </div>

          {/* Garden Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400/20 to-emerald-400/20 dark:from-amber-500/15 dark:to-emerald-500/15">
              <Flower2 size={20} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Ogród Pomysłów' : 'Idea Garden'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isPolish
                  ? `${filteredIdeas.length} pomysłów rośnie w Twoim ogrodzie`
                  : `${filteredIdeas.length} ideas growing in your garden`}
              </p>
            </div>
            <div className="ml-auto">
              <button
                onClick={onCreateIdea}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 hover:shadow-amber-500/35 transition-all"
              >
                <Plus size={14} />
                {isPolish ? 'Nowy pomysł' : 'New idea'}
              </button>
            </div>
          </div>

          {/* Garden Sections */}
          {gardenSections.map(({ stage, ideas: sectionIdeas }) => {
            const cfg = STAGE_CONFIG[stage];
            const Icon = cfg.icon;
            const labels = sectionLabels[stage];

            return (
              <div key={stage} className="space-y-3">
                {/* Section header */}
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${cfg.bgColor}`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {isPolish ? labels.pl : labels.en}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                        {sectionIdeas.length}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isPolish ? labels.desc_pl : labels.desc_en}
                    </div>
                  </div>
                </div>

                {/* Section cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sectionIdeas.map((idea) => (
                    <button
                      key={idea.id}
                      onClick={() => onIdeaClick(idea.id, idea)}
                      className={`group text-left p-4 rounded-2xl border ${cfg.borderColor} bg-white dark:bg-navy-900 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5`}
                    >
                      <div className="flex items-start gap-2.5 mb-2">
                        <div className={`flex-shrink-0 p-1.5 rounded-lg ${cfg.bgColor} group-hover:scale-110 transition-transform`}>
                          <Icon size={14} className={cfg.color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {idea.title}
                          </div>
                        </div>
                        {renderPotentialDot(idea.potential)}
                      </div>
                      {idea.body ? (
                        <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2 ml-8">
                          {idea.body}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1.5 flex-wrap ml-8">
                        {renderSourceBadge(idea.sourceType)}
                        {renderAreaBadge(idea.area)}
                        {renderPriorityBar(idea.priority)}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {idea.updatedAt
                            ? new Date(idea.updatedAt).toLocaleDateString()
                            : idea.createdAt
                              ? new Date(idea.createdAt).toLocaleDateString()
                              : ''}
                        </span>
                        {(idea.tags || []).length > 0 && (
                          <div className="flex gap-1">
                            {(idea.tags || []).slice(0, 2).map((tag) => (
                              <span
                                key={`${idea.id}-${tag}`}
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${cfg.badgeBg} ${cfg.badgeText}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* "Plant" card in spark section */}
                  {stage === 'spark' && (
                    <button
                      onClick={onCreateIdea}
                      className="text-left p-4 rounded-2xl border-2 border-dashed border-amber-300/50 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-900/5 hover:border-amber-400/70 dark:hover:border-amber-500/40 hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-all duration-200 flex flex-col items-center justify-center min-h-[100px] gap-2"
                    >
                      <div className="p-2 rounded-xl bg-amber-500/10">
                        <Plus size={18} className="text-amber-500" />
                      </div>
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {isPolish ? 'Zasiej nowy pomysł' : 'Plant a new idea'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* If no sections at all but we have ideas (shouldn't happen, but safety) */}
          {gardenSections.length === 0 && filteredIdeas.length > 0 && (
            <div className="text-center py-8 text-sm text-slate-500">
              {isPolish ? 'Brak pomysłów w wybranej kategorii' : 'No ideas matching selected tag'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────── CARDS VIEW ────────────
  if (viewMode === 'cards') {
    return (
      <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
        <div className="p-4 space-y-4">
          {/* Tag filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTag('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeTag === 'all'
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
            >
              {t('myWork.ideas.tags.all', 'All')}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeTag === tag
                    ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
                title={tag}
              >
                <span className="inline-flex items-center gap-1">
                  <Tag size={12} />
                  {tag}
                </span>
              </button>
            ))}
          </div>

          {filteredIdeas.length === 0 ? (
            renderEmpty()
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredIdeas.map((idea) => (
                <button
                  key={idea.id}
                  onClick={() => onIdeaClick(idea.id, idea)}
                  className="group text-left p-5 rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-amber-400/50 dark:hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 dark:hover:shadow-amber-500/10 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 group-hover:bg-amber-500/20 dark:group-hover:bg-amber-500/30 transition-colors">
                      <Lightbulb size={20} className="text-amber-500 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {idea.title}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {renderSourceBadge(idea.sourceType)}
                        {renderStageBadge(idea.stage || 'spark')}
                        {renderAreaBadge(idea.area)}
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  {idea.body ? (
                    <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-2">
                      {idea.body}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 mb-2">
                    {renderPriorityBar(idea.priority)}
                  </div>
                  {(idea.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(idea.tags || []).slice(0, 4).map((tag) => (
                        <span
                          key={`${idea.id}-${tag}`}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/20 dark:border-amber-500/30"
                        >
                          {tag}
                        </span>
                      ))}
                      {(idea.tags || []).length > 4 && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          +{(idea.tags || []).length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────── LIST VIEW ────────────
  return (
    <div className="w-full h-full overflow-y-auto bg-white dark:bg-navy-950">
      <div className="p-4 space-y-4">
        {/* Tag filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTag('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeTag === 'all'
                ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
            }`}
          >
            {t('myWork.ideas.tags.all', 'All')}
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeTag === tag
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
              title={tag}
            >
              <span className="inline-flex items-center gap-1">
                <Tag size={12} />
                {tag}
              </span>
            </button>
          ))}
        </div>

        {filteredIdeas.length === 0 ? (
          renderEmpty()
        ) : (
          <div className="space-y-2">
            {filteredIdeas.map((idea) => (
              <button
                key={idea.id}
                onClick={() => onIdeaClick(idea.id, idea)}
                className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {idea.title}
                      </div>
                      {renderSourceBadge(idea.sourceType)}
                      {renderStageBadge(idea.stage || 'spark')}
                      {renderAreaBadge(idea.area)}
                      {renderPriorityBar(idea.priority)}
                      {renderPotentialDot(idea.potential)}
                    </div>
                    {idea.body ? (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {idea.body}
                      </div>
                    ) : null}
                    {(idea.tags || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(idea.tags || []).slice(0, 6).map((tag) => (
                          <span
                            key={`${idea.id}-${tag}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-navy-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {idea.createdAt ? new Date(idea.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyIdeasListContent;
