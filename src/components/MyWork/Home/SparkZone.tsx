import { Clock, FileText, Lightbulb, Plus, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { SparkData, SparkItem } from './useHomeData';
import i18n from '@/i18n';

interface SparkZoneProps {
  data: SparkData;
  onIdeaClick?: (id: string) => void;
  onNoteClick?: (id: string) => void;
  onNewIdea?: () => void;
  onExpandIdea?: (ideaId: string) => void;
}

const STAGE_STYLES: Record<string, string> = {
  spark: 'bg-amber-500/15 text-amber-500',
  growing: 'bg-emerald-500/15 text-emerald-500',
  shaping: 'bg-indigo-500/15 text-indigo-500',
  ready: 'bg-primary-500/15 text-primary-400',
};

export const SparkZone: React.FC<SparkZoneProps> = ({
  data,
  onIdeaClick,
  onNoteClick,
  onNewIdea,
  onExpandIdea,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-500 flex items-center justify-center">
            <Lightbulb size={16} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Spark Zone</h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-500">
          {t('myWork.sparkZone.yourIdeasAndCreative', 'Your ideas and creative space')}
        </span>
      </div>

      {data.aiNudge && (
        <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-amber-500/[0.06] to-amber-500/[0.04] border border-amber-500/10 rounded-xl mb-5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-500 flex items-center justify-center flex-shrink-0">
            <Sparkles size={12} className="text-white" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 flex-1">{data.aiNudge.text}</p>
          <button
            onClick={() => data.aiNudge && onExpandIdea?.(data.aiNudge.ideaId)}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 px-3.5 py-1.5 rounded-lg border border-amber-500/20 hover:bg-amber-500/10 transition-colors whitespace-nowrap"
          >
            {data.aiNudge.action} &rarr;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {data.ideas.map((idea) => (
          <IdeaCard key={idea.id} item={idea} onClick={() => onIdeaClick?.(idea.id)} />
        ))}

        <button
          onClick={onNewIdea}
          className="flex flex-col items-center justify-center min-h-[180px] p-6 border border-dashed border-amber-500/20 rounded-2xl text-center hover:border-amber-500/40 hover:bg-amber-500/[0.04] transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Plus size={20} className="text-amber-500" />
          </div>
          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            {t('myWork.sparkZone.newIdea', 'New Idea')}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
            {t('myWork.sparkZone.startFromScratchOr', 'Start from scratch or use a template')}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.notes.map((note) => (
          <NoteCard
            key={note.id}
            item={note}
            onClick={() => onNoteClick?.(note.id)}
            isPolish={isPolish}
          />
        ))}
      </div>
    </div>
  );
};

const IdeaCard: React.FC<{ item: SparkItem; onClick: () => void }> = ({ item, onClick }) => (
  <button
    onClick={onClick}
    className="text-left p-6 bg-white/[0.03] dark:bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:bg-white/[0.06] hover:border-amber-500/15 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-200 group relative overflow-hidden"
  >
    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-amber-500 to-danger-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    {item.stage && (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-3 ${STAGE_STYLES[item.stage] || STAGE_STYLES.spark}`}
      >
        {item.stage}
      </span>
    )}
    <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-2 leading-snug">
      {item.title}
    </h4>
    <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed line-clamp-2 mb-3">
      {item.snippet}
    </p>
    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
      <span className="flex items-center gap-1">
        <Clock size={11} />
        {item.updatedAt}
      </span>
      <span>
        {item.nodeCount != null && `${item.nodeCount} nodes`}
        {item.taskCount != null && item.taskCount > 0 && ` · ${item.taskCount} tasks`}
      </span>
    </div>
  </button>
);

const NoteCard: React.FC<{ item: SparkItem; onClick: () => void; isPolish: boolean }> = ({
  item,
  onClick,
  isPolish,
}) => (
  <button
    onClick={onClick}
    className="text-left p-5 bg-white/[0.03] dark:bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.06] hover:-translate-y-0.5 transition-all duration-150"
  >
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 mb-2 flex items-center gap-1.5">
      <FileText size={11} />
      {i18n.t('myWork.sparkZone.recentNote', 'Recent note')}
    </div>
    <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-1.5">{item.title}</h4>
    <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed line-clamp-2">
      {item.snippet}
    </p>
    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 block">
      {i18n.t('myWork.sparkZone.updated', 'Updated')} {item.updatedAt}
    </span>
  </button>
);
