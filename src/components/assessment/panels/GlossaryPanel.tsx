/**
 * GlossaryPanel
 *
 * Paczka1 #10b — consulting-terms glossary surfacing point. A non-consultant using
 * assessments/tools should be able to open a "słownik" (dictionary) of consulting
 * jargon (SWOT, WACC, OEE, MECE, impact x effort...) in plain PL/EN language.
 *
 * Reuses the existing overlay/panel visual language from the DRD assessment editor
 * (fixed, backdrop-blurred card) rather than inventing a new modal system.
 */

import { BookOpen, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CONSULTING_GLOSSARY,
  GLOSSARY_CATEGORIES,
  type GlossaryCategory,
} from '@/config/consultingGlossary';

const CATEGORY_LABELS: Record<GlossaryCategory, { en: string; pl: string }> = {
  strategy: { en: 'Strategy', pl: 'Strategia' },
  operations: { en: 'Operations', pl: 'Operacje' },
  finance: { en: 'Finance', pl: 'Finanse' },
  'data-ai': { en: 'Data & AI', pl: 'Dane i AI' },
  prioritization: { en: 'Prioritization', pl: 'Priorytetyzacja' },
  general: { en: 'General', pl: 'Ogólne' },
};

interface GlossaryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlossaryPanel: React.FC<GlossaryPanelProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const isPl = (i18n.language || '').toLowerCase().startsWith('pl');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<GlossaryCategory | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONSULTING_GLOSSARY.filter((term) => {
      if (activeCategory !== 'all' && term.category !== activeCategory) return false;
      if (!q) return true;
      const haystack = [term.term, ...(term.aliases || []), term.definition.en, term.definition.pl]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, activeCategory]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={t('assessment.glossary.title', 'Consulting Glossary')}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-slate-200 dark:border-white/20 bg-white/98 dark:bg-navy-950/98 backdrop-blur-xl shadow-[0_25px_60px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-300 flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {isPl ? 'Słownik terminów konsultingowych' : 'Consulting Terms Glossary'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isPl
                  ? 'Zrozumiały język zamiast żargonu'
                  : 'Plain language, no jargon left unexplained'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            aria-label={t('common.close', 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search + category filter */}
        <div className="p-3 border-b border-slate-200 dark:border-white/10 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isPl ? 'Szukaj terminu (np. SWOT, WACC)...' : 'Search a term (e.g. SWOT, WACC)...'
              }
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                activeCategory === 'all'
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              {isPl ? 'Wszystkie' : 'All'}
            </button>
            {GLOSSARY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                {isPl ? CATEGORY_LABELS[cat].pl : CATEGORY_LABELS[cat].en}
              </button>
            ))}
          </div>
        </div>

        {/* Term list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 && (
            <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
              {isPl ? 'Brak wyników.' : 'No results.'}
            </div>
          )}
          {filtered.map((term) => (
            <div
              key={term.id}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3.5"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-sm font-bold text-slate-900 dark:text-white">{term.term}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide shrink-0">
                  {isPl ? CATEGORY_LABELS[term.category].pl : CATEGORY_LABELS[term.category].en}
                </span>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {isPl ? term.definition.pl : term.definition.en}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlossaryPanel;
