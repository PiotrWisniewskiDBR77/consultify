/**
 * WorkspaceTools — shared building blocks for workspace tool panels.
 *
 * Standard "Workspace" pattern: reused across Notebook, Idea Workspace,
 * and future workspace types. Each workspace composes its own panel from:
 *   - Shared sections: AI, Transform, Share (this file)
 *   - Workspace-specific sections: defined per workspace
 *
 * @see docs/ui-standards/README.md
 */
import {
  ArrowDownFromLine,
  ArrowUpFromLine,
  ChevronDown,
  Languages,
  Mail,
  PenLine,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

import i18n from '@/i18n';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

/* ------------------------------------------------------------------ */
/*  Context — every workspace provides this                            */
/* ------------------------------------------------------------------ */

export interface WorkspaceContext {
  title: string;
  content: string;
  tags: string[];
  entityType: string;
  entityId?: string;
}

/* ------------------------------------------------------------------ */
/*  SectionLabel                                                       */
/* ------------------------------------------------------------------ */

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600/80 dark:text-slate-500/80 mb-2">
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/*  SectionDivider                                                     */
/* ------------------------------------------------------------------ */

export const SectionDivider: React.FC = () => (
  <div className="border-b border-slate-200/30 dark:border-white/[0.04]" />
);

/* ------------------------------------------------------------------ */
/*  ToolsPanelShell — container for all tool panels                    */
/* ------------------------------------------------------------------ */

interface ToolsPanelShellProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /**
   * EditorShell Wave W (W-1): when true the panel is embedded inside the
   * EditorShell right-rail column, which already owns the fixed width, the
   * left border and the collapse control. In that mode we drop our own
   * `w-80 border-l` framing and the redundant header close button so we
   * don't render "a panel inside a panel". Additive — default false keeps
   * the legacy sliding-drawer chrome byte-for-byte identical.
   */
  embedded?: boolean;
}

export const ToolsPanelShell: React.FC<ToolsPanelShellProps> = ({
  title,
  subtitle,
  icon,
  actions,
  onClose,
  children,
  className,
  embedded = false,
}) => (
  <div
    className={
      embedded
        ? `w-full h-full min-h-0 bg-gradient-to-b from-white via-white to-slate-50/30 dark:from-navy-950 dark:via-navy-950 dark:to-navy-900/20 flex flex-col backdrop-blur-sm ${className || ''}`
        : `w-80 shrink-0 border-l border-white/[0.06] bg-gradient-to-b from-white via-white to-slate-50/30 dark:from-navy-950 dark:via-navy-950 dark:to-navy-900/20 flex flex-col backdrop-blur-sm ${className || ''}`
    }
  >
    <div className="relative px-4 py-3 border-b border-slate-200/40 dark:border-white/[0.04] shrink-0">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-500/[0.03] via-slate-400/[0.01] to-transparent pointer-events-none" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon || (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-crimson-600 flex items-center justify-center shadow-sm shadow-primary-500/20">
              <Sparkles size={14} className="text-white" />
            </div>
          )}
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </div>
            <div className="text-[9px] font-medium text-slate-600 dark:text-slate-500 uppercase tracking-widest">
              {subtitle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {/* In embedded (EditorShell right-rail) mode the shell owns the
              collapse control, so the panel's own close button is redundant. */}
          {!embedded && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-slate-300 transition-all"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto nb-scroll">{children}</div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  AIQuickActions — Command + Chat buttons (shared)                   */
/* ------------------------------------------------------------------ */

interface AIQuickActionsProps {
  isPl: boolean;
  onFocusAICommand?: () => void;
  onOpenAIChat?: () => void;
}

export const AIQuickActions: React.FC<AIQuickActionsProps> = ({
  isPl,
  onFocusAICommand,
  onOpenAIChat,
}) => {
  const t = i18n.getFixedT(isPl ? 'pl' : 'en');
  if (!onFocusAICommand && !onOpenAIChat) return null;

  return (
    <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
      <SectionLabel>AI</SectionLabel>
      <div className="flex gap-2">
        {onFocusAICommand && (
          <button
            onClick={onFocusAICommand}
            className="flex-1 group rounded-xl py-2.5 px-3 bg-slate-50/60 dark:bg-white/[0.03] border border-slate-200/30 dark:border-white/[0.05] hover:bg-slate-100/80 dark:hover:bg-white/[0.06] hover:border-slate-300/40 dark:hover:border-white/[0.08] transition-all duration-200 hover:shadow-sm"
          >
            <div className="flex flex-col items-center gap-1">
              <Sparkles size={16} className="text-primary-500 dark:text-primary-400" />
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {t('sharedComponents.workspaceTools.commandLabel')}
              </span>
              <span className="text-[8px] text-slate-600 dark:text-slate-500 font-medium">⌘⇧A</span>
            </div>
          </button>
        )}
        {onOpenAIChat && (
          <button
            onClick={onOpenAIChat}
            className="flex-1 group rounded-xl py-2.5 px-3 bg-slate-50/60 dark:bg-white/[0.03] border border-slate-200/30 dark:border-white/[0.05] hover:bg-slate-100/80 dark:hover:bg-white/[0.06] hover:border-slate-300/40 dark:hover:border-white/[0.08] transition-all duration-200 hover:shadow-sm"
          >
            <div className="flex flex-col items-center gap-1">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-500 dark:text-slate-400"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {t('sharedComponents.workspaceTools.aiChatLabel')}
              </span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  TransformTextSection — translate, style, length, polish (shared)   */
/* ------------------------------------------------------------------ */

interface TransformTextSectionProps {
  isPl: boolean;
  context: WorkspaceContext;
}

export const TransformTextSection: React.FC<TransformTextSectionProps> = ({ isPl, context }) => {
  const t = i18n.getFixedT(isPl ? 'pl' : 'en');
  const { setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  const sendToChat = useCallback(
    (prompt: string) => {
      setChatKickoffMessage(prompt);
      if (isChatCollapsed) toggleChatCollapse();
    },
    [setChatKickoffMessage, isChatCollapsed, toggleChatCollapse]
  );

  const entityLabel = t(`sharedComponents.workspaceTools.entityLabel.${context.entityType}`, {
    defaultValue: t('sharedComponents.workspaceTools.entityLabel.default'),
  });

  const handleTranslate = () => {
    const targetLang = t('sharedComponents.workspaceTools.otherLanguageName');
    const excerpt = (context.content || '').trim().slice(0, 2000);
    sendToChat(
      t('sharedComponents.workspaceTools.translatePrompt', {
        entityLabel,
        targetLang,
        title: context.title,
        excerpt,
      })
    );
    trackFunnelEvent('notebook_transform_used', {});
    toast.success(t('sharedComponents.workspaceTools.sentToChatWithTarget', { targetLang }));
  };

  const handleChangeStyle = (style: string) => {
    const excerpt = (context.content || '').trim().slice(0, 2000);
    const knownStyles = ['formal', 'casual', 'concise', 'creative'];
    const styleKey = knownStyles.includes(style) ? style : 'formal';
    const styleDescription = t(`sharedComponents.workspaceTools.styleDescription.${styleKey}`);
    sendToChat(
      t('sharedComponents.workspaceTools.changeStylePrompt', {
        entityLabel,
        styleDescription,
        title: context.title,
        tags: context.tags.join(', ') || t('sharedComponents.workspaceTools.noTags'),
        excerpt,
      })
    );
    trackFunnelEvent('notebook_transform_used', {});
    toast.success(t('sharedComponents.workspaceTools.sentToChat'));
  };

  const handleChangeLength = (direction: 'shorter' | 'longer') => {
    const excerpt = (context.content || '').trim().slice(0, 2000);
    sendToChat(
      t(`sharedComponents.workspaceTools.changeLengthPrompt.${direction}`, {
        entityLabel,
        title: context.title,
        excerpt,
      })
    );
    trackFunnelEvent('notebook_transform_used', {});
    toast.success(t('sharedComponents.workspaceTools.sentToChat'));
  };

  const handlePolish = () => {
    const excerpt = (context.content || '').trim().slice(0, 2000);
    sendToChat(
      t('sharedComponents.workspaceTools.polishPrompt', {
        entityLabel,
        title: context.title,
        excerpt,
      })
    );
    toast.success(t('sharedComponents.workspaceTools.sentToChat'));
  };

  const styleOptions = [
    { id: 'formal', icon: '📋' },
    { id: 'casual', icon: '💬' },
    { id: 'concise', icon: '✂️' },
    { id: 'creative', icon: '🎨' },
  ];

  return (
    <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
      <SectionLabel>{t('sharedComponents.workspaceTools.transformTextLabel')}</SectionLabel>
      <div className="space-y-1.5">
        <button
          onClick={handleTranslate}
          className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] hover:shadow-sm"
        >
          <div className="relative w-7 h-7 rounded-lg bg-slate-100/80 dark:bg-white/[0.06] flex items-center justify-center text-sky-500 dark:text-sky-400 shrink-0">
            <Languages size={14} />
          </div>
          <div className="relative flex-1 min-w-0 text-left">
            <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
              {t('sharedComponents.workspaceTools.translateAction')}
            </div>
            <div className="text-[9px] text-slate-600 dark:text-slate-500">
              {t('sharedComponents.workspaceTools.translateTargetHint')}
            </div>
          </div>
        </button>

        <div className="relative">
          <button
            onClick={() => setStyleMenuOpen(!styleMenuOpen)}
            className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] hover:shadow-sm"
          >
            <div className="relative w-7 h-7 rounded-lg bg-slate-100/80 dark:bg-white/[0.06] flex items-center justify-center text-primary-500 dark:text-primary-400 shrink-0">
              <PenLine size={14} />
            </div>
            <div className="relative flex-1 min-w-0 text-left">
              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {t('sharedComponents.workspaceTools.changeStyleAction')}
              </div>
              <div className="text-[9px] text-slate-600 dark:text-slate-500">
                {t('sharedComponents.workspaceTools.changeStyleHint')}
              </div>
            </div>
            <ChevronDown
              size={14}
              className={`text-slate-600 transition-transform ${styleMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {styleMenuOpen && (
            <div className="mt-1 ml-9 grid grid-cols-2 gap-1">
              {styleOptions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    handleChangeStyle(s.id);
                    setStyleMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/30 dark:border-white/[0.06] hover:bg-primary-500/10 hover:border-primary-500/15 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-primary-700 dark:hover:text-primary-300 transition-all"
                >
                  <span>{s.icon}</span>
                  {t(`sharedComponents.workspaceTools.styleOptionLabel.${s.id}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => handleChangeLength('shorter')}
            className="group flex-1 flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] hover:shadow-sm"
          >
            <div className="relative w-7 h-7 rounded-lg bg-slate-100/80 dark:bg-white/[0.06] flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
              <ArrowDownFromLine size={14} />
            </div>
            <div className="relative text-left">
              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {t('sharedComponents.workspaceTools.shorterAction')}
              </div>
            </div>
          </button>
          <button
            onClick={() => handleChangeLength('longer')}
            className="group flex-1 flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] hover:shadow-sm"
          >
            <div className="relative w-7 h-7 rounded-lg bg-slate-100/80 dark:bg-white/[0.06] flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
              <ArrowUpFromLine size={14} />
            </div>
            <div className="relative text-left">
              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {t('sharedComponents.workspaceTools.longerAction')}
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={handlePolish}
          className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] hover:shadow-sm"
        >
          <div className="relative w-7 h-7 rounded-lg bg-slate-100/80 dark:bg-white/[0.06] flex items-center justify-center text-fuchsia-500 dark:text-fuchsia-400 shrink-0">
            <Wand2 size={14} />
          </div>
          <div className="relative flex-1 min-w-0 text-left">
            <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
              {t('sharedComponents.workspaceTools.polishAction')}
            </div>
            <div className="text-[9px] text-slate-600 dark:text-slate-500">
              {t('sharedComponents.workspaceTools.polishHint')}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  ShareSection — email (shared)                                      */
/* ------------------------------------------------------------------ */

interface ShareSectionProps {
  isPl: boolean;
  context: WorkspaceContext;
}

export const ShareSection: React.FC<ShareSectionProps> = ({ isPl, context }) => {
  const t = i18n.getFixedT(isPl ? 'pl' : 'en');
  const handleEmail = () => {
    const subject = encodeURIComponent(
      context.title || t('sharedComponents.workspaceTools.noteDefaultSubject')
    );
    const body = encodeURIComponent(
      `${context.title}\n${'—'.repeat(30)}\n\n${(context.content || '').trim().slice(0, 5000)}\n\n—\n${t('sharedComponents.workspaceTools.sentFromConsultify')}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    trackFunnelEvent('notebook_share_email', {});
    toast.success(t('sharedComponents.workspaceTools.emailClientOpened'));
  };

  return (
    <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
      <SectionLabel>{t('sharedComponents.workspaceTools.shareLabel')}</SectionLabel>
      <button
        onClick={handleEmail}
        className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] hover:shadow-sm"
      >
        <div className="relative w-7 h-7 rounded-lg bg-slate-100/80 dark:bg-white/[0.06] flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
          <Mail size={14} />
        </div>
        <div className="relative flex-1 min-w-0 text-left">
          <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
            {t('sharedComponents.workspaceTools.sendViaEmailLabel')}
          </div>
          <div className="text-[9px] text-slate-600 dark:text-slate-500">
            {t('sharedComponents.workspaceTools.opensEmailClientHint')}
          </div>
        </div>
      </button>
    </div>
  );
};
