import { Clock, MessageSquare, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { HomeBriefData } from './useHomeData';

interface AICompanionBriefProps {
  data: HomeBriefData;
  userName?: string;
  onTalkToAI?: () => void;
  onFocusItemClick?: (id: string, type: 'task' | 'decision' | 'idea') => void;
}

const FOCUS_ICON_COLORS: Record<string, string> = {
  task: 'text-emerald-400',
  decision: 'text-amber-400',
  idea: 'text-primary-400',
};

const FOCUS_LABELS: Record<string, { en: string; pl: string }> = {
  task: { en: 'Top priority', pl: 'Priorytet' },
  decision: { en: 'Decision waiting', pl: 'Decyzja czeka' },
  idea: { en: 'Idea to explore', pl: 'Pomysł do zbadania' },
};

export const AICompanionBrief: React.FC<AICompanionBriefProps> = ({
  data,
  userName,
  onTalkToAI,
  onFocusItemClick,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const now = new Date();
  const hour = now.getHours();
  const greetingKey = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const greetings: Record<string, { en: string; pl: string }> = {
    morning: { en: 'Good morning', pl: 'Dzień dobry' },
    afternoon: { en: 'Good afternoon', pl: 'Cześć' },
    evening: { en: 'Good evening', pl: 'Dobry wieczór' },
  };
  const greeting = `${isPolish ? greetings[greetingKey].pl : greetings[greetingKey].en}${userName ? `, ${userName}` : ''}`;

  const dateStr = now.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="relative p-8 md:p-10 rounded-2xl bg-gradient-to-br from-primary-500/[0.08] via-crimson-500/[0.04] to-blue-500/[0.06] border border-primary-500/[0.12] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="absolute -top-1/2 -right-1/5 w-[400px] h-[400px] bg-gradient-radial from-primary-500/10 to-transparent rounded-full pointer-events-none" />

      <h2 className="text-2xl md:text-3xl font-serif font-normal text-slate-900 dark:text-white leading-tight mb-2">
        {greeting}
      </h2>

      <p className="text-xs text-slate-500 dark:text-slate-500 mb-6 flex items-center gap-1.5">
        <Clock size={12} />
        {dateStr} · {isPolish ? 'Tydzień' : 'Week'} {data.weekProgress}%{' '}
        {isPolish ? 'ukończony' : 'complete'}
      </p>

      {data.insight && (
        <div className="flex gap-4 items-start p-5 bg-white/[0.03] dark:bg-white/[0.03] rounded-xl border border-white/[0.06] mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-400 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {data.insight}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {data.focusItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onFocusItemClick?.(item.id, item.type)}
            className="text-left p-4 bg-white/[0.03] dark:bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] hover:border-c-border-subtle transition-all duration-150 hover:-translate-y-0.5 group"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 mb-1.5 flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${FOCUS_ICON_COLORS[item.type]} bg-current`}
              />
              {isPolish ? FOCUS_LABELS[item.type]?.pl : FOCUS_LABELS[item.type]?.en}
            </div>
            <div className="text-sm font-medium text-slate-800 dark:text-white leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {item.title}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">{item.meta}</div>
          </button>
        ))}
      </div>

      {onTalkToAI && (
        <button
          onClick={onTalkToAI}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-400 text-white text-sm font-semibold hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary-500/30 transition-all duration-150"
        >
          <MessageSquare size={16} />
          {isPolish ? 'Porozmawiajmy o tym' : "Let's talk about this"}
        </button>
      )}
    </div>
  );
};
