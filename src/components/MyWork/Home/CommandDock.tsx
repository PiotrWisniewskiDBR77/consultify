import { ArrowUpRight, CalendarDays, CheckSquare, FileText, Lightbulb, Scale, Sparkles } from 'lucide-react';
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
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const payload = block.payload;

  return (
    <HomeBlockShell block={block} className="sticky bottom-4 z-20">
      <div className="flex flex-wrap items-center gap-3">
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
                  onAction({ type: 'create', target: action.target as 'idea' | 'note' | 'task' | 'decision' });
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
              <ArrowUpRight size={14} className="text-white/35 transition group-hover:text-white/75" />
            </button>
          );
        })}
        <div className="ml-auto text-xs text-slate-300/55">
          {isPolish ? 'Most do całej aplikacji i czatu AI' : 'Bridge to the app and AI chat'}
        </div>
      </div>
    </HomeBlockShell>
  );
};
