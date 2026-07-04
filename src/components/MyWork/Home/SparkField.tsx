import { ArrowRight, FileText, Lightbulb, Plus, WandSparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HomeBlockShell } from './HomeBlockShell';
import type { HomeBlock, HomeScreenAction, SparkItem } from './homeV2Types';

interface SparkFieldProps {
  block: Extract<HomeBlock, { id: 'sparkField' }>;
  onAction: (action: HomeScreenAction) => void;
}

const STAGE_STYLE: Record<string, string> = {
  shaping: 'bg-primary-500/15 text-primary-200',
  growing: 'bg-emerald-500/15 text-emerald-200',
  spark: 'bg-amber-500/15 text-amber-100',
};

export const SparkField: React.FC<SparkFieldProps> = ({ block, onAction }) => {
  const { t } = useTranslation();
  const payload = block.payload;
  const nudge = payload.nudge;
  const runtimeSummary = payload.runtimeSummary;

  return (
    <HomeBlockShell block={block}>
      <div className="grid gap-2.5">
        {runtimeSummary ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">
              {t('myWork.radar.ideasWithTasks', { count: runtimeSummary.ideasWithTasks })}
            </div>
            <div className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-blue-100">
              {t('myWork.radar.recentNotes', { count: runtimeSummary.recentNotes })}
            </div>
            <div className="rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1 text-primary-100">
              {t('myWork.radar.recentOutputs', { count: runtimeSummary.recentOutputs })}
            </div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
              {t('myWork.radar.orgSignals', { count: runtimeSummary.orgSignals })}
            </div>
          </div>
        ) : null}
        {nudge ? (
          <button
            onClick={() =>
              onAction({
                type: 'chat',
                packet: {
                  sourceBlock: 'sparkField',
                  intent: 'expand_idea',
                  title: t('myWork.radar.expandIdea'),
                  starterPrompt: t('myWork.radar.expandIdeaPrompt', { text: nudge.text }),
                  entityType: 'idea',
                  entityId: nudge.ideaId,
                  contextData: {
                    text: nudge.text,
                    ideaId: nudge.ideaId,
                  },
                },
              })
            }
            className="flex items-center gap-2.5 rounded-lg border border-amber-400/15 bg-amber-500/[0.06] p-3 text-left transition hover:bg-amber-500/[0.10]"
          >
            <div className="rounded-xl bg-amber-500/15 p-2 text-amber-200">
              <WandSparkles size={16} />
            </div>
            <div className="flex-1 text-sm leading-7 text-amber-50/90">{nudge.text}</div>
            <ArrowRight size={16} className="text-amber-100/70" />
          </button>
        ) : null}

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {payload.ideas.map((idea) => (
            <IdeaCard key={idea.id} item={idea} onAction={onAction} />
          ))}
          <button
            onClick={() => onAction({ type: 'create', target: 'idea' })}
            className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-amber-300/20 bg-white/[0.03] text-center transition hover:border-amber-300/35 hover:bg-amber-500/[0.05] xl:min-h-[140px]"
          >
            <div className="mb-2 rounded-lg bg-amber-500/10 p-3 text-amber-200">
              <Plus size={18} />
            </div>
            <div className="text-sm font-semibold text-amber-50">{t('myWork.radar.newIdea')}</div>
            <div className="mt-1 text-xs text-slate-600/65">
              {t('myWork.radar.newIdeaSubtitle')}
            </div>
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {payload.notes.map((note) => (
            <button
              key={note.id}
              onClick={() => onAction({ type: 'open', target: 'note', id: note.id })}
              className="rounded-lg border border-c-border-subtle bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40">
                <FileText size={12} />
                {t('myWork.radar.noteLabel')}
              </div>
              <div className="mt-2 text-base font-semibold text-white">{note.title}</div>
              <div className="mt-1 text-sm leading-7 text-slate-600/72">{note.snippet}</div>
              <div className="mt-2 text-xs text-slate-600/70">{note.updatedAt}</div>
            </button>
          ))}
        </div>
      </div>
    </HomeBlockShell>
  );
};

const IdeaCard: React.FC<{
  item: SparkItem;
  onAction: (action: HomeScreenAction) => void;
}> = ({ item, onAction }) => {
  const { t } = useTranslation();
  const stage = item.stage || 'spark';
  return (
    <button
      onClick={() => onAction({ type: 'open', target: 'idea', id: item.id })}
      className="rounded-lg border border-c-border-subtle bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
            STAGE_STYLE[stage]
          }`}
        >
          {t('myWork.radar.stages.' + stage, { defaultValue: stage })}
        </span>
        <Lightbulb size={15} className="text-amber-200/70" />
      </div>
      <div className="mt-2 text-base font-semibold leading-snug text-white">{item.title}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-600/80">{item.snippet}</div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-600/70">
        <span>{item.updatedAt}</span>
        <span>
          {item.nodeCount ?? 0} {t('myWork.radar.nodes')}
          {item.taskCount ? ` · ${item.taskCount} ${t('myWork.radar.tasks')}` : ''}
        </span>
      </div>
    </button>
  );
};
