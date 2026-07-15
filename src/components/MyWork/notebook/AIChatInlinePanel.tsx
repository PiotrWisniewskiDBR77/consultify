/**
 * AIChatInlinePanel — Notebook workspace tools panel.
 * Composes shared Workspace sections (AI, Transform, Share) with
 * notebook-specific sections (Insert blocks, Create from note, Page, Compose).
 */
import type { Editor } from '@tiptap/react';
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  Clock,
  Columns3,
  FileBarChart,
  GripVertical,
  Info,
  Lightbulb,
  ListChecks,
  Loader2,
  Mic,
  MicOff,
  Minus,
  Presentation,
  Scale,
  Send,
  Sparkles,
  Target,
  ToggleRight,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  AIQuickActions,
  SectionLabel,
  ShareSection,
  ToolsPanelShell,
  TransformTextSection,
  type WorkspaceContext,
} from '@/components/shared/WorkspaceTools';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

const AI_BLOCK_MIME = 'application/x-notebook-ai-block';

type ConvertTarget =
  | 'initiative'
  | 'task'
  | 'decision'
  | 'idea'
  | 'assessment'
  | 'report'
  | 'presentation';

interface AIChatInlinePanelProps {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
  noteTitle: string;
  noteContent: string;
  noteTags: string[];
  page?: {
    id: string;
    maturity: 'seed' | 'growing' | 'mature' | 'actionable';
    summary?: string | null;
    updatedAt?: string | null;
    visibility?: 'private' | 'project' | null;
    projectId?: string | null;
    wordCount: number;
  };
  onAskAI?: () => void;
  onDeletePage?: () => void;
  onSetVisibility?: (next: 'private' | 'project') => void;
  getRelativeTime?: (iso: string) => string;
  onFocusAICommand?: () => void;
  onOpenAIChat?: () => void;
  onConvert?: (target: ConvertTarget) => void;
  canConvertDeliverable?: boolean;
  convertBlockedReason?: string;
}

const MATURITY_STYLE: Record<string, { gradient: string; text: string; glow: string }> = {
  seed: {
    gradient: 'from-slate-400/20 to-slate-500/10',
    text: 'text-c-text-muted',
    glow: 'shadow-slate-400/10',
  },
  growing: {
    gradient: 'from-emerald-400/20 to-emerald-500/10',
    text: 'text-c-success',
    glow: 'shadow-emerald-400/10',
  },
  mature: {
    gradient: 'from-blue-400/20 to-blue-500/10',
    text: 'text-c-info',
    glow: 'shadow-blue-400/10',
  },
  actionable: {
    gradient: 'from-amber-400/20 to-amber-500/10',
    text: 'text-c-warning',
    glow: 'shadow-amber-400/10',
  },
};

export const AIChatInlinePanel: React.FC<AIChatInlinePanelProps> = ({
  open,
  onClose,
  editor,
  noteTitle,
  noteContent,
  noteTags,
  page,
  onAskAI,
  onDeletePage,
  onSetVisibility,
  getRelativeTime,
  onFocusAICommand,
  onOpenAIChat,
  onConvert,
  canConvertDeliverable = true,
  convertBlockedReason,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const recognitionRef = useRef<any>(null);

  const wsContext: WorkspaceContext = {
    title: noteTitle,
    content: noteContent,
    tags: noteTags,
    entityType: 'notebook',
    entityId: page?.id,
  };

  /* ---- Voice input ---- */
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SpeechRecognitionAPI) return;
    const rec = new SpeechRecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = isPl ? 'pl-PL' : 'en-US';
    rec.onresult = (e: any) => {
      const last = e.results.length - 1;
      const text = e.results[last][0].transcript;
      if (e.results[last].isFinal) {
        setInput((prev) => (prev ? `${prev} ${text}` : text).trim());
      }
    };
    rec.onerror = () => setIsRecording(false);
    rec.onend = () => setIsRecording(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {}
    };
  }, [isPl]);

  const toggleMic = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) {
      toast.error(t('myWorkNotebook.aiChatInlinePanel.micNotSupported'));
      return;
    }
    if (isRecording) {
      rec.stop();
      setIsRecording(false);
    } else {
      rec.start();
      setIsRecording(true);
      toast.success(t('myWorkNotebook.aiChatInlinePanel.recording'));
    }
  }, [isRecording, t]);

  /* ---- Block helpers (notebook-specific) ---- */
  const DELETABLE_BLOCKS = ['callout', 'details', 'table', 'blockquote', 'horizontalRule'];

  const deleteContainingBlock = useCallback(() => {
    if (!editor) return false;
    const { $from } = editor.state.selection;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (DELETABLE_BLOCKS.includes(node.type.name)) {
        const pos = $from.before(d);
        editor
          .chain()
          .focus()
          .deleteRange({ from: pos, to: pos + node.nodeSize })
          .run();
        toast.success(t('myWorkNotebook.aiChatInlinePanel.blockDeleted'));
        return true;
      }
    }
    toast.error(t('myWorkNotebook.aiChatInlinePanel.placeCursorInBlock'));
    return false;
  }, [editor, t]);

  const insertElement = useCallback(
    (action: () => void) => {
      if (!editor) return;
      editor.chain().focus();
      action();
    },
    [editor]
  );

  /* ---- AI compose + drag ---- */
  const runAIAndInsert = useCallback(
    async (rawText: string) => {
      if (!editor || !rawText.trim()) return;
      setIsGenerating(true);
      try {
        const systemPrompt = t('myWorkNotebook.aiChatInlinePanel.transformSystemPrompt');
        const userMessage = `Context: Note "${noteTitle}". Tags: ${noteTags.join(', ') || 'none'}\n\nInput: ${rawText}`;
        let result = '';
        await Api.chatWithAIStream(
          userMessage,
          [],
          (chunk) => {
            result += chunk;
          },
          () => {},
          systemPrompt,
          undefined,
          undefined,
          isPl ? 'pl' : 'en',
          undefined,
          { responseStyle: 'concise', selectedTier: 'STANDARD' },
          undefined
        );
        const text = result.trim();
        if (!text) return;
        const aiLabel = t('myWorkNotebook.aiChatInlinePanel.aiCommentLabel');
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'callout',
            attrs: { variant: 'primary' },
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: `✨ ${aiLabel}` }] },
              ...text
                .split(/\n\n+/)
                .filter(Boolean)
                .map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p.trim() }] })),
            ],
          })
          .run();
        trackFunnelEvent('notebook_ai_block_dropped', {});
        toast.success(t('myWorkNotebook.aiChatInlinePanel.insertedIntoNote'));
        setInput('');
      } catch (err: any) {
        toast.error(err?.message || t('myWorkNotebook.aiChatInlinePanel.aiError'));
      } finally {
        setIsGenerating(false);
      }
    },
    [editor, noteTitle, noteTags, isPl, t]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: CustomEvent<{ text: string }>) => {
      runAIAndInsert(e.detail.text);
    };
    window.addEventListener('notebook-ai-block-drop', handler as EventListener);
    return () => window.removeEventListener('notebook-ai-block-drop', handler as EventListener);
  }, [open, runAIAndInsert]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      const text = input.trim();
      if (!text) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData(AI_BLOCK_MIME, text);
      e.dataTransfer.setData('text/plain', text);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [input]
  );

  /* ---- Convert actions (notebook-specific) ---- */
  const handleConvertAction = (target: ConvertTarget) => {
    if (['assessment', 'report', 'presentation'].includes(target) && !canConvertDeliverable) {
      toast.error(
        convertBlockedReason || t('myWorkNotebook.aiChatInlinePanel.refineBeforeConvert')
      );
      return;
    }
    // V3-C02: report/presentation conversions should use backend convert endpoint
    // so source traceability is guaranteed via MyWork ToolSession materialization.
    onConvert?.(target);
  };

  if (!open) return null;

  const insertButtons = [
    {
      icon: Info,
      key: 'callout',
      labelKey: 'myWorkNotebook.aiChatInlinePanel.insertCallout',
      action: () => (editor?.commands as any)?.setCallout({ variant: 'info' }),
      iconColor: 'text-c-info',
    },
    {
      icon: AlertTriangle,
      key: 'warning',
      labelKey: 'myWorkNotebook.aiChatInlinePanel.insertWarning',
      action: () => (editor?.commands as any)?.setCallout({ variant: 'warning' }),
      iconColor: 'text-c-warning',
    },
    {
      icon: ToggleRight,
      key: 'toggle',
      labelKey: 'myWorkNotebook.aiChatInlinePanel.insertToggle',
      action: () => (editor?.commands as any)?.setDetails(),
      iconColor: 'text-c-text-muted',
    },
    {
      icon: Columns3,
      key: 'table',
      labelKey: 'myWorkNotebook.aiChatInlinePanel.insertTable',
      action: () =>
        editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      iconColor: 'text-c-accent',
    },
    {
      icon: Minus,
      key: 'divider',
      labelKey: 'myWorkNotebook.aiChatInlinePanel.insertDivider',
      action: () => editor?.chain().focus().setHorizontalRule().run(),
      iconColor: 'text-c-text-muted',
    },
  ];

  const convertActions: {
    id: ConvertTarget;
    icon: React.ComponentType<any>;
    labelKey: string;
    iconColor: string;
  }[] = [
    {
      id: 'initiative',
      icon: Target,
      labelKey: 'myWorkNotebook.aiChatInlinePanel.convertInitiative',
      iconColor: 'text-c-info',
    },
    {
      id: 'task',
      icon: CheckSquare,
      labelKey: 'myWorkNotebook.aiChatInlinePanel.convertTask',
      iconColor: 'text-c-success',
    },
    {
      id: 'decision',
      icon: Scale,
      labelKey: 'myWorkNotebook.aiChatInlinePanel.convertDecision',
      iconColor: 'text-c-warning',
    },
    {
      id: 'idea',
      icon: Lightbulb,
      labelKey: 'myWorkNotebook.aiChatInlinePanel.convertIdea',
      iconColor: 'text-c-text-muted',
    },
    {
      id: 'assessment',
      icon: ListChecks,
      labelKey: 'myWorkNotebook.aiChatInlinePanel.convertAssessment',
      iconColor: 'text-danger-500 dark:text-danger-400',
    },
    {
      id: 'report',
      icon: FileBarChart,
      labelKey: 'myWorkNotebook.aiChatInlinePanel.convertReport',
      iconColor: 'text-c-accent',
    },
    {
      id: 'presentation',
      icon: Presentation,
      labelKey: 'myWorkNotebook.aiChatInlinePanel.convertPresentation',
      iconColor: 'text-fuchsia-500 dark:text-fuchsia-400',
    },
  ];

  const matStyle = page
    ? MATURITY_STYLE[page.maturity] || MATURITY_STYLE.seed
    : MATURITY_STYLE.seed;

  return (
    <ToolsPanelShell
      title={t('myWorkNotebook.aiChatInlinePanel.tools')}
      subtitle={t('myWorkNotebook.aiChatInlinePanel.notebook')}
      onClose={onClose}
    >
      {/* ─── Insert blocks (notebook-specific) ─── */}
      <div className="px-3 py-3 border-b border-c-border-subtle">
        <SectionLabel>{t('myWorkNotebook.aiChatInlinePanel.insertBlock')}</SectionLabel>
        <div className="grid grid-cols-5 gap-1.5">
          {insertButtons.map(({ icon: Icon, key, labelKey, action, iconColor }) => (
            <button
              key={key}
              onClick={() => insertElement(action)}
              disabled={!editor}
              className="group relative flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-c-surface-raised border border-slate-200/30 dark:border-white/[0.05] hover:bg-c-surface-raised hover:border-c-border-subtle hover:shadow-sm disabled:opacity-40 transition-all duration-200"
              title={t(labelKey)}
            >
              <Icon size={16} className={iconColor} />
              <span className="text-[8px] font-semibold uppercase tracking-wider text-c-text-muted opacity-70 group-hover:opacity-100 transition-opacity">
                {t(labelKey)}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={deleteContainingBlock}
          disabled={!editor}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-danger-500/[0.06] text-danger-500/70 hover:bg-danger-500/[0.12] hover:text-danger-600 dark:hover:text-danger-400 text-[10px] font-medium disabled:opacity-40 transition-all"
        >
          <Trash2 size={11} />
          {t('myWorkNotebook.aiChatInlinePanel.deleteBlock')}
        </button>
      </div>

      {/* ─── AI (shared) ─── */}
      <AIQuickActions isPl={isPl} onFocusAICommand={onFocusAICommand} onOpenAIChat={onOpenAIChat} />

      {/* ─── Create from note (notebook-specific) ─── */}
      <div className="px-3 py-3 border-b border-c-border-subtle">
        <SectionLabel>{t('myWorkNotebook.aiChatInlinePanel.createFromNote')}</SectionLabel>
        <div className="mb-2 text-[10px] text-c-text-muted">
          {t('myWorkNotebook.aiChatInlinePanel.convertToHint')}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {convertActions.map(({ id, icon: Icon, labelKey, iconColor }) => {
            const isDeliverable = ['assessment', 'report', 'presentation'].includes(id);
            const disabled = !page || (isDeliverable && !canConvertDeliverable);
            return (
              <button
                key={id}
                onClick={() => handleConvertAction(id)}
                disabled={disabled}
                className="group flex items-center gap-2 px-2.5 py-2 rounded-xl bg-c-surface-raised border border-c-border-subtle hover:bg-c-surface-raised hover:border-c-border-subtle transition-all duration-200 hover:shadow-sm disabled:opacity-40"
                title={
                  disabled && isDeliverable && convertBlockedReason
                    ? convertBlockedReason
                    : undefined
                }
              >
                <div
                  className={`w-6 h-6 rounded-lg bg-c-surface-raised flex items-center justify-center ${iconColor} shrink-0`}
                >
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[10px] font-bold text-c-text truncate">
                    {t(labelKey)}
                  </div>
                  {disabled && isDeliverable && convertBlockedReason ? (
                    <div className="mt-0.5 text-[9px] text-c-text-muted line-clamp-2">
                      {convertBlockedReason}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Transform (shared) ─── */}
      <TransformTextSection isPl={isPl} context={wsContext} />

      {/* ─── Share (shared) ─── */}
      <ShareSection isPl={isPl} context={wsContext} />

      {/* ─── Page metadata (notebook-specific) ─── */}
      {page && (
        <div className="px-3 py-3 border-b border-c-border-subtle">
          <SectionLabel>{t('myWorkNotebook.aiChatInlinePanel.page')}</SectionLabel>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r ${matStyle.gradient} ${matStyle.text} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${matStyle.glow}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {page.maturity}
              </span>
              {onSetVisibility && (
                <div className="relative">
                  <select
                    value={page.visibility === 'project' && page.projectId ? 'project' : 'private'}
                    onChange={(e) => onSetVisibility(e.target.value as 'private' | 'project')}
                    className="appearance-none pr-5 pl-2.5 py-1 rounded-lg bg-c-surface-raised border border-c-border-subtle text-[10px] text-c-text-muted font-medium cursor-pointer hover:bg-c-surface-raised transition-all"
                  >
                    <option value="private">
                      {t('myWorkNotebook.aiChatInlinePanel.visibilityPrivate')}
                    </option>
                    {page.projectId && (
                      <option value="project">
                        {t('myWorkNotebook.aiChatInlinePanel.visibilityProject')}
                      </option>
                    )}
                  </select>
                  <ChevronDown
                    size={9}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-c-text-muted pointer-events-none"
                  />
                </div>
              )}
            </div>
            {page.summary && (
              <div className="text-[11px] text-c-text-muted italic leading-relaxed line-clamp-2 pl-0.5">
                {page.summary}
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[10px] text-c-text-muted tabular-nums font-medium">
                <Type size={11} className="opacity-60" />
                {page.wordCount} {t('myWorkNotebook.aiChatInlinePanel.words')}
              </span>
              {page.updatedAt && getRelativeTime && (
                <span className="inline-flex items-center gap-1 text-[10px] text-c-text-muted tabular-nums font-medium">
                  <Clock size={11} className="opacity-60" />
                  {getRelativeTime(page.updatedAt)}
                </span>
              )}
            </div>
            {(onAskAI || onDeletePage) && (
              <div className="flex items-center gap-2 pt-0.5">
                {onAskAI && (
                  <button
                    onClick={onAskAI}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold bg-c-surface-raised text-c-text hover:bg-c-surface-raised border border-c-border-subtle hover:border-c-border-subtle transition-all"
                  >
                    <Sparkles size={11} className="text-c-text-muted" />
                    {t('myWorkNotebook.aiChatInlinePanel.askAI')}
                  </button>
                )}
                {onDeletePage && (
                  <button
                    onClick={onDeletePage}
                    className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-[10px] font-medium bg-danger-500/[0.06] text-danger-400/70 hover:bg-danger-500/[0.12] hover:text-danger-500 border border-danger-500/[0.06] hover:border-danger-500/10 transition-all"
                    title={t('myWorkNotebook.aiChatInlinePanel.deletePage')}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Compose strip (notebook-specific) ─── */}
      <div className="p-3">
        <SectionLabel>{t('myWorkNotebook.aiChatInlinePanel.typeOrSpeak')}</SectionLabel>
        <div
          draggable={!!input.trim()}
          onDragStart={handleDragStart}
          className={`group relative rounded-2xl border transition-all duration-300 ${
            input.trim()
              ? 'border-c-border-subtle bg-c-surface-raised shadow-sm cursor-grab active:cursor-grabbing'
              : 'border-c-border-subtle bg-c-surface-raised'
          }`}
        >
          {input.trim() && (
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-slate-400/[0.06] via-transparent to-slate-400/[0.06] pointer-events-none" />
          )}
          <div className="relative p-3">
            <div className="flex items-start gap-2">
              {input.trim() && (
                <div className="mt-2.5 shrink-0 flex flex-col items-center gap-0.5">
                  <GripVertical
                    size={14}
                    className="text-c-text-muted group-hover:text-c-text-secondary transition-colors"
                  />
                  <div className="w-0.5 h-4 rounded-full bg-gradient-to-b from-slate-400/40 to-transparent" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('myWorkNotebook.aiChatInlinePanel.composePlaceholder')}
                  rows={3}
                  className="w-full bg-transparent text-sm text-c-text placeholder:text-c-text-muted outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-c-border-subtle">
                  <button
                    onClick={toggleMic}
                    className={`relative p-2 rounded-xl transition-all duration-200 ${isRecording ? 'bg-danger-500/15 text-danger-500 shadow-sm shadow-danger-500/10' : 'bg-c-surface-raised text-c-text-secondary hover:text-c-text dark:hover:text-c-text hover:bg-c-surface-raised'}`}
                    title={t('myWorkNotebook.aiChatInlinePanel.microphone')}
                  >
                    {isRecording && (
                      <span className="absolute inset-0 rounded-xl animate-ping bg-danger-500/10" />
                    )}
                    <span className="relative">
                      {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                    </span>
                  </button>
                  {input.trim() && (
                    <span className="flex items-center gap-1.5 text-[10px] font-medium">
                      {isGenerating ? (
                        <>
                          <Loader2 size={10} className="animate-spin text-c-text-muted" />
                          <span className="text-c-text-muted">
                            {t('myWorkNotebook.aiChatInlinePanel.generating')}
                          </span>
                        </>
                      ) : (
                        <span className="text-c-text-muted">
                          {t('myWorkNotebook.aiChatInlinePanel.drag')}
                        </span>
                      )}
                    </span>
                  )}
                  <button
                    onClick={() => input.trim() && runAIAndInsert(input.trim())}
                    disabled={!input.trim() || isGenerating}
                    className="relative p-2 rounded-xl bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised hover:shadow-sm disabled:opacity-30 transition-all duration-200"
                    title={t('myWorkNotebook.aiChatInlinePanel.aiPolishInsert')}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolsPanelShell>
  );
};

export { AI_BLOCK_MIME };
export type { ConvertTarget };
