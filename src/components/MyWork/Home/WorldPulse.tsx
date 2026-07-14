import { Bookmark, Globe, Share2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PulseArticle, PulseData } from './useHomeData';

interface WorldPulseProps {
  data: PulseData;
  onSaveToNotebook?: (articleId: string) => void;
  onShareArticle?: (articleId: string) => void;
  onLinkToIdea?: (articleId: string) => void;
  onLearnFramework?: () => void;
}

type PulseCategory = 'all' | 'ai_tech' | 'industry' | 'consulting' | 'clients';

const CATEGORY_LABELS: Record<PulseCategory, { en: string; pl: string }> = {
  all: { en: 'All', pl: 'Wszystko' },
  ai_tech: { en: 'AI & Tech', pl: 'AI i Tech' },
  industry: { en: 'Industry', pl: 'Branża' },
  consulting: { en: 'Consulting', pl: 'Consulting' },
  clients: { en: 'Your Clients', pl: 'Twoi klienci' },
};

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  ai_tech: 'bg-gradient-to-br from-indigo-500/20 to-blue-500/20',
  industry: 'bg-gradient-to-br from-emerald-500/20 to-amber-500/20',
  consulting: 'bg-gradient-to-br from-primary-500/20 to-crimson-700/20',
  clients: 'bg-gradient-to-br from-danger-500/20 to-amber-500/20',
};

const CATEGORY_TEXT_STYLES: Record<string, string> = {
  ai_tech: 'text-indigo-500',
  industry: 'text-emerald-500',
  consulting: 'text-primary-400',
  clients: 'text-danger-400',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  ai_tech: '🤖',
  industry: '🏭',
  consulting: '📊',
  clients: '🤝',
};

export const WorldPulse: React.FC<WorldPulseProps> = ({
  data,
  onSaveToNotebook,
  onShareArticle,
  onLearnFramework,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [activeCategory, setActiveCategory] = useState<PulseCategory>('all');

  const filteredArticles =
    activeCategory === 'all'
      ? data.articles
      : data.articles.filter((a) => a.category === activeCategory);

  return (
    <div className="p-8 bg-gradient-to-b from-navy-900/60 to-navy-800/40 border border-white/[0.06] rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
            <Globe size={16} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">World Pulse</h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-500">
          {t('myWork.worldPulse.whatSHappeningIn', 'What\'s happening in your world')}
        </span>
      </div>

      <div className="flex gap-2 mb-6">
        {(Object.keys(CATEGORY_LABELS) as PulseCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
              activeCategory === cat
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'text-slate-500 dark:text-slate-500 border-white/[0.06] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {isPolish ? CATEGORY_LABELS[cat].pl : CATEGORY_LABELS[cat].en}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
        <div className="flex flex-col gap-4">
          {filteredArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onSave={() => onSaveToNotebook?.(article.id)}
              onShare={() => onShareArticle?.(article.id)}
              isPolish={isPolish}
            />
          ))}
          {filteredArticles.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-500">
              {t('myWork.worldPulse.noArticlesInThis', 'No articles in this category')}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {data.frameworkOfDay && (
            <div className="p-6 bg-gradient-to-br from-primary-500/[0.08] to-crimson-500/[0.06] border border-primary-500/[0.12] rounded-2xl">
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary-400 mb-3">
                {t('myWork.worldPulse.frameworkOfTheDay', 'Framework of the Day')}
              </div>
              <h4 className="text-xl font-serif text-slate-900 dark:text-white mb-2.5 leading-snug">
                {data.frameworkOfDay.name}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                {data.frameworkOfDay.description}
              </p>
              <button
                onClick={onLearnFramework}
                className="text-xs font-semibold text-primary-400 hover:underline flex items-center gap-1"
              >
                {t('myWork.worldPulse.learnMore', 'Learn more')} &rarr;
              </button>
            </div>
          )}

          {data.benchmark && (
            <div className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-2.5">
                {data.benchmark.title}
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-white mb-1.5">
                {data.benchmark.label}
              </div>
              <div className="text-3xl font-extrabold text-emerald-500 mb-1">
                {data.benchmark.value}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-500">
                {data.benchmark.change}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ArticleCard: React.FC<{
  article: PulseArticle;
  onSave: () => void;
  onShare: () => void;
  isPolish: boolean;
}> = ({ article, onSave, onShare, isPolish }) => (
  <div className="flex gap-4 p-5 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] hover:translate-x-1 transition-all duration-150 cursor-pointer">
    <div
      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${CATEGORY_BADGE_STYLES[article.category] || ''}`}
    >
      {CATEGORY_EMOJIS[article.category] || '📰'}
    </div>
    <div className="flex-1 min-w-0">
      <div
        className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${CATEGORY_TEXT_STYLES[article.category] || 'text-slate-500'}`}
      >
        {isPolish
          ? CATEGORY_LABELS[article.category as PulseCategory]?.pl
          : CATEGORY_LABELS[article.category as PulseCategory]?.en}
      </div>
      <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-1.5 leading-snug">
        {article.title}
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
        {article.summary}
      </p>
      <div className="flex gap-3 mt-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-300 flex items-center gap-1 transition-colors"
        >
          <Bookmark size={11} />
          {t('myWork.worldPulse.saveToNotebook', 'Save to notebook')}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-300 flex items-center gap-1 transition-colors"
        >
          <Share2 size={11} />
          {t('myWork.worldPulse.share', 'Share')}
        </button>
      </div>
    </div>
  </div>
);
