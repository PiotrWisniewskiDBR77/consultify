import {
  Brain,
  Lightbulb,
  Link2,
  MessageCircle,
  PenLine,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SidekickContext } from '../aiSidekickContext';

interface FloatingAIPopoverProps {
  isPl?: boolean;
  nodeId: string;
  onAction: (action: string) => void;
  onOpenChatAboutNode: () => void;
  onClose: () => void;
}

const AI_ACTIONS = [
  {
    // J26 (channel 2): direct "select node → AI rewrites this node's label".
    action: 'mm_ai_rewrite_node',
    iconEl: PenLine,
    key: 'rewriteNode',
    labelEn: 'AI: Rewrite this node',
  },
  {
    action: 'mm_ai_expand_node',
    iconEl: Zap,
    key: 'expandNode',
    labelEn: 'Expand this node',
  },
  { action: 'mm_ai_deepen', iconEl: Wand2, key: 'deepenTopic', labelEn: 'Deepen topic' },
  {
    action: 'mm_ai_summarize_branch',
    iconEl: Brain,
    key: 'summarizeBranch',
    labelEn: 'Summarize branch',
  },
  {
    action: 'mm_ai_what_if',
    iconEl: Lightbulb,
    key: 'whatIfAnalysis',
    labelEn: 'What-if analysis',
  },
  {
    action: 'ai_suggest_links',
    iconEl: Link2,
    key: 'suggestLinks',
    labelEn: 'Suggest links',
  },
];

export const FloatingAIPopover: React.FC<FloatingAIPopoverProps> = ({
  isPl,
  onAction,
  onOpenChatAboutNode,
  onClose,
}) => {
  const { t } = useTranslation();
  const [ctx, setCtx] = useState<SidekickContext | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setCtx((e as CustomEvent<SidekickContext>).detail);
    };
    window.addEventListener('idea-mindmap-sidekick-context', handler);
    return () => window.removeEventListener('idea-mindmap-sidekick-context', handler);
  }, []);

  const hint = ctx ? (isPl ? ctx.promptHintPl : ctx.promptHint) : undefined;

  const dispatch = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <div className="w-52 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl py-1">
      {hint && (
        <div className="px-3 py-2 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted font-medium flex items-center gap-1">
            <Sparkles size={10} />
            {hint}
          </div>
        </div>
      )}
      <button
        onClick={() => {
          onOpenChatAboutNode();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2 py-2 text-[11px] font-semibold text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
      >
        <MessageCircle size={12} className="shrink-0" />
        {t('ideas.mindmap.askAiAboutThisNode', 'Ask AI about this node')}
      </button>
      <div className="border-t border-c-border-subtle dark:border-c-border-subtle my-0.5" />
      {AI_ACTIONS.map((a) => {
        const Icon = a.iconEl;
        return (
          <button
            key={a.action}
            onClick={() => dispatch(a.action)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
          >
            <Icon size={12} className="text-c-text-secondary shrink-0" />
            {t(`myWorkMindmap.aiAction.${a.key}`, a.labelEn)}
          </button>
        );
      })}
    </div>
  );
};
