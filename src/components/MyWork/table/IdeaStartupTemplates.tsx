/**
 * IdeaStartupTemplates — Slim seed surface for Ideas.
 *
 * Compact card: textarea + 2 buttons (Start with AI / Blank canvas).
 * Templates and intent-led starting points live inside the workspace toolbar.
 */
import { ArrowRight, Brain, Sparkles, Wand2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { IdeaWorkspaceSeedIntent } from '../ideaEntryTypes';

interface IdeaStartupTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelect: (payload: IdeaWorkspaceSeedIntent) => void;
}

export const IdeaStartupTemplates: React.FC<IdeaStartupTemplatesProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [heroText, setHeroText] = useState('');

  const handleSelect = useCallback(
    (startMode: 'describe_with_ai' | 'blank_canvas') => {
      const seedText = heroText.trim();
      onSelect({
        startMode,
        seedText,
        preferredSystem: 'mindmap',
        templateId: null,
        popularStartId: null,
        popularStartLabel: null,
        structuredBrief: null,
        source: 'seed_surface',
      });
      setHeroText('');
      onClose();
    },
    [heroText, onClose, onSelect]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-[560px] rounded-2xl border border-slate-200/40 dark:border-white/[0.04] bg-white/95 dark:bg-navy-900/95 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-slate-200/40 dark:border-white/[0.04] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/[0.03] via-transparent to-blue-500/[0.03] dark:from-violet-500/[0.06] dark:to-blue-500/[0.06]" />
          <div className="relative flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
              <Sparkles size={16} className="text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isPl ? 'Nowy pomysł' : 'New Idea'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isPl
                  ? 'Spokojny start, szybkie przejście do workspace.'
                  : 'Calm start, fast handoff into workspace.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative p-1.5 rounded-lg hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-colors duration-150"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500/80 dark:text-violet-400/70">
            {isPl ? 'Twój pomysł' : 'Your idea'}
          </div>
          <h4 className="mt-1.5 text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            {isPl
              ? 'Opisz problem, pomysł albo wynik'
              : 'Describe the problem, idea, or outcome'}
          </h4>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {isPl
              ? 'Szablony i intencje startowe znajdziesz w toolbarze workspace.'
              : 'Templates and starting intents are available in the workspace toolbar.'}
          </p>
          <textarea
            value={heroText}
            onChange={(e) => setHeroText(e.target.value)}
            rows={3}
            placeholder={
              isPl
                ? 'Np. Chcę uporządkować inicjatywy transformacyjne i znaleźć najlepszą kolejność wdrożeń...'
                : 'For example: I want to structure the transformation initiatives and find the best rollout order...'
            }
            autoFocus
            className="mt-3 w-full rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400/80 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSelect('describe_with_ai')}
              className="group flex items-center gap-3 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent px-4 py-3 text-left transition-all duration-200 hover:border-violet-500/35 hover:shadow-lg hover:shadow-violet-500/10"
            >
              <div className="rounded-lg p-1.5 bg-violet-500/10 text-violet-500 transition-transform duration-200 group-hover:scale-110">
                <Wand2 size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                  Start with AI
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  {isPl ? 'AI zbuduje workspace' : 'AI builds the workspace'}
                </div>
              </div>
              <ArrowRight size={13} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => handleSelect('blank_canvas')}
              className="group flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-gradient-to-br from-slate-500/[0.06] via-slate-400/[0.02] to-transparent px-4 py-3 text-left transition-all duration-200 hover:border-slate-300/80 hover:shadow-lg hover:shadow-slate-500/5"
            >
              <div className="rounded-lg p-1.5 bg-slate-500/10 text-slate-500 transition-transform duration-200 group-hover:scale-110">
                <Brain size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Blank canvas
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  {isPl ? 'Pusty workspace' : 'Empty workspace'}
                </div>
              </div>
              <ArrowRight size={13} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdeaStartupTemplates;
