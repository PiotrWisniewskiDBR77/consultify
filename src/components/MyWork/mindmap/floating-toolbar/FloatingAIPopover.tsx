import { Brain, Lightbulb, MessageCircle, Wand2, Zap } from 'lucide-react';
import React from 'react';

interface FloatingAIPopoverProps {
  isPl: boolean;
  nodeId: string;
  onAction: (action: string) => void;
  onOpenChatAboutNode: () => void;
  onClose: () => void;
}

const AI_ACTIONS = [
  { action: 'mm_ai_expand_node', iconEl: Zap, labelPl: 'Rozwiń ten węzeł', labelEn: 'Expand this node' },
  { action: 'mm_ai_deepen', iconEl: Wand2, labelPl: 'Pogłęb temat', labelEn: 'Deepen topic' },
  { action: 'mm_ai_summarize_branch', iconEl: Brain, labelPl: 'Podsumuj gałąź', labelEn: 'Summarize branch' },
  { action: 'mm_ai_what_if', iconEl: Lightbulb, labelPl: 'What-if analiza', labelEn: 'What-if analysis' },
];

export const FloatingAIPopover: React.FC<FloatingAIPopoverProps> = ({
  isPl,
  onAction,
  onOpenChatAboutNode,
  onClose,
}) => {
  const dispatch = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <div className="w-52 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06] shadow-xl py-1">
      <button
        onClick={() => { onOpenChatAboutNode(); onClose(); }}
        className="w-full flex items-center gap-2 px-2 py-2 text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-500/5 transition-colors"
      >
        <MessageCircle size={12} className="shrink-0" />
        {isPl ? 'Zapytaj AI o ten węzeł' : 'Ask AI about this node'}
      </button>
      <div className="border-t border-slate-200/30 dark:border-white/[0.04] my-0.5" />
      {AI_ACTIONS.map((a) => {
        const Icon = a.iconEl;
        return (
          <button
            key={a.action}
            onClick={() => dispatch(a.action)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
          >
            <Icon size={12} className="text-purple-400 shrink-0" />
            {isPl ? a.labelPl : a.labelEn}
          </button>
        );
      })}
    </div>
  );
};
