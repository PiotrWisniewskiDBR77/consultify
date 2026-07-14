import {
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  FileText,
  Lightbulb,
  Scale,
  Sparkles,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HomeBlockShell } from './HomeBlockShell';
import type { HomeBlock, HomeScreenAction } from './homeV2Types';

interface CommandDockProps {
  block: Extract<HomeBlock, { id: 'commandDock' }>;
  onAction: (action: HomeScreenAction) => void;
}

const ICONS = {
  idea: Lightbulb,
  note: FileText,
  task: CheckSquare,
  decision: Scale,
  calendar: CalendarDays,
  askAi: Sparkles,
};

export const CommandDock: React.FC<CommandDockProps> = ({ block, onAction }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const payload = block.payload;
  const runtimeSummary = payload.runtimeSummary;
  const primaryAction = payload.primaryAction;

  return (
    <HomeBlockShell block={block} className="sticky bottom-4 z-20">
      <div className="grid gap-3">
        {primaryAction ? (
          <div className="rounded-[22px] border border-primary-400/20 bg-gradient-to-r from-primary-500/12 via-primary-500/8 to-blue-400/10 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary-100/75">
                  {t('myWork.commandDock.doThisNow', 'Do this now')}
                </div>
                <div className="mt-1 text-base font-semibold text-white">{primaryAction.title}</div>
                <div className="mt-1 text-sm text-slate-600/80">{primaryAction.helper}</div>
              </div>
              <button
                type="button"
                onClick={() => onAction(primaryAction.action)}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.13]"
              >
                {getPrimaryActionLabel(primaryAction.action.type, isPolish)}
                <ArrowUpRight size={14} className="text-white/70" />
              </button>
            </div>
          </div>
        ) : null}
        {runtimeSummary ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-blue-100">
              {isPolish
                ? `Inbox oczekuje ${runtimeSummary.inboxPending}`
                : `Inbox pending ${runtimeSummary.inboxPending}`}
            </div>
            <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">
              {isPolish
                ? `SLA zagrozone ${runtimeSummary.inboxAtRisk}`
                : `SLA at risk ${runtimeSummary.inboxAtRisk}`}
            </div>
            <div className="rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1 text-primary-100">
              {isPolish
                ? `Ostatnie outputy ${runtimeSummary.recentOutputs}`
                : `Recent outputs ${runtimeSummary.recentOutputs}`}
            </div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
              {isPolish
                ? `Do review ${runtimeSummary.reviewSharedOutputs}`
                : `Needs review ${runtimeSummary.reviewSharedOutputs}`}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full text-[10px] uppercase tracking-[0.18em] text-slate-600">
            {t('myWork.commandDock.shortcutsAndQuickCreate', 'Shortcuts and quick create')}
          </div>
          {payload.actions.map((action) => {
            const Icon =
              action.id === 'new-idea'
                ? ICONS.idea
                : action.id === 'new-note'
                  ? ICONS.note
                  : action.id === 'new-task'
                    ? ICONS.task
                    : action.id === 'new-decision'
                      ? ICONS.decision
                      : action.id === 'open-calendar'
                        ? ICONS.calendar
                        : ICONS.askAi;

            return (
              <button
                key={action.id}
                onClick={() => {
                  if (action.kind === 'create' && action.target) {
                    onAction({
                      type: 'create',
                      target: action.target as 'idea' | 'note' | 'task' | 'decision',
                    });
                  } else if (action.kind === 'navigate' && action.target) {
                    onAction({ type: 'navigate', target: action.target as 'calendar' });
                  } else if (action.kind === 'chat' && action.starterPrompt) {
                    onAction({
                      type: 'chat',
                      packet: {
                        sourceBlock: 'commandDock',
                        intent: 'general_transform_assist',
                        title: block.title,
                        starterPrompt: action.starterPrompt,
                        entityType: 'home',
                        entityId: 'command-dock',
                      },
                    });
                  }
                }}
                className="group inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.10] hover:-translate-y-0.5"
              >
                <Icon size={16} className="text-primary-200" />
                {action.label}
                <ArrowUpRight
                  size={14}
                  className="text-white/35 transition group-hover:text-white/75"
                />
              </button>
            );
          })}
          <div className="ml-auto text-xs text-slate-600/55">
            {t('myWork.commandDock.priorityFirstShortcutsSecond', 'Priority first, shortcuts second')}
          </div>
        </div>
      </div>
    </HomeBlockShell>
  );
};

function getPrimaryActionLabel(
  actionType: 'open' | 'create' | 'navigate' | 'chat',
  isPolish: boolean
) {
  switch (actionType) {
    case 'open':
      return t('myWork.commandDock.open', 'Open');
    case 'create':
      return t('myWork.commandDock.create', 'Create');
    case 'navigate':
      return t('myWork.commandDock.goThere', 'Go there');
    case 'chat':
      return t('myWork.commandDock.askAI', 'Ask AI');
    default:
      return t('myWork.commandDock.open2', 'Open');
  }
}
