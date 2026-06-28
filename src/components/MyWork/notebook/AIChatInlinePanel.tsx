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
    text: 'text-slate-500',
    glow: 'shadow-slate-400/10',
  },
  growing: {
    gradient: 'from-emerald-400/20 to-emerald-500/10',
    text: 'text-emerald-500',
    glow: 'shadow-emerald-400/10',
  },
  mature: {
    gradient: 'from-blue-400/20 to-blue-500/10',
    text: 'text-blue-500',
    glow: 'shadow-blue-400/10',
  },
  actionable: {
    gradient: 'from-amber-400/20 to-amber-500/10',
    text: 'text-amber-500',
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
  const { i18n } = useTranslation();
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
      toast.error(isPl ? 'Mikrofon nie jest obsługiwany' : 'Microphone not supported');
      return;
    }
    if (isRecording) {
      rec.stop();
      setIsRecording(false);
    } else {
      rec.start();
      setIsRecording(true);
      toast.success(isPl ? 'Nagrywanie…' : 'Recording…');
    }
  }, [isRecording, isPl]);

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
        toast.success(isPl ? 'Usunięto blok' : 'Block deleted');
        return true;
      }
    }
    toast.error(isPl ? 'Ustaw kursor w bloku' : 'Place cursor inside block');
    return false;
  }, [editor, isPl]);

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
        const systemPrompt = isPl
          ? 'Przekształć surowy tekst w elegancki tekst gotowy do notatki. Zachowaj sens, popraw styl. Odpowiedz TYLKO tekstem.'
          : 'Transform raw text into elegant text ready for a note. Keep meaning, improve style. Respond ONLY with text.';
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
        const aiLabel = isPl ? 'Komentarz AI' : 'AI comment';
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
        toast.success(isPl ? 'Wstawiono do notatki' : 'Inserted into note');
        setInput('');
      } catch (err: any) {
        toast.error(err?.message || (isPl ? 'Błąd AI' : 'AI error'));
      } finally {
        setIsGenerating(false);
      }
    },
    [editor, noteTitle, noteTags, isPl]
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
        convertBlockedReason ||
          (isPl
            ? 'Najpierw dopracuj notatkę przed konwersją.'
            : 'Refine the note before converting it.')
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
      label: 'Callout',
      labelPl: 'Wyróżnienie',
      action: () => (editor?.commands as any)?.setCallout({ variant: 'info' }),
      iconColor: 'text-blue-500 dark:text-blue-400',
    },
    {
      icon: AlertTriangle,
      label: 'Warning',
      labelPl: 'Ostrzeżenie',
      action: () => (editor?.commands as any)?.setCallout({ variant: 'warning' }),
      iconColor: 'text-amber-500 dark:text-amber-400',
    },
    {
      icon: ToggleRight,
      label: 'Toggle',
      labelPl: 'Rozwijane',
      action: () => (editor?.commands as any)?.setDetails(),
      iconColor: 'text-slate-500 dark:text-slate-400',
    },
    {
      icon: Columns3,
      label: 'Table',
      labelPl: 'Tabela',
      action: () =>
        editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      iconColor: 'text-indigo-500 dark:text-indigo-400',
    },
    {
      icon: Minus,
      label: 'Divider',
      labelPl: 'Separator',
      action: () => editor?.chain().focus().setHorizontalRule().run(),
      iconColor: 'text-slate-600 dark:text-slate-500',
    },
  ];

  const convertActions: {
    id: ConvertTarget;
    icon: React.ComponentType<any>;
    labelPl: string;
    labelEn: string;
    iconColor: string;
  }[] = [
    {
      id: 'initiative',
      icon: Target,
      labelPl: 'Inicjatywa',
      labelEn: 'Initiative',
      iconColor: 'text-blue-500 dark:text-blue-400',
    },
    {
      id: 'task',
      icon: CheckSquare,
      labelPl: 'Task',
      labelEn: 'Task',
      iconColor: 'text-emerald-500 dark:text-emerald-400',
    },
    {
      id: 'decision',
      icon: Scale,
      labelPl: 'Decyzja',
      labelEn: 'Decision',
      iconColor: 'text-amber-500 dark:text-amber-400',
    },
    {
      id: 'idea',
      icon: Lightbulb,
      labelPl: 'Idea',
      labelEn: 'Idea',
      iconColor: 'text-slate-500 dark:text-slate-400',
    },
    {
      id: 'assessment',
      icon: ListChecks,
      labelPl: 'Assessment',
      labelEn: 'Assessment',
      iconColor: 'text-danger-500 dark:text-danger-400',
    },
    {
      id: 'report',
      icon: FileBarChart,
      labelPl: 'Raport',
      labelEn: 'Report',
      iconColor: 'text-indigo-500 dark:text-indigo-400',
    },
    {
      id: 'presentation',
      icon: Presentation,
      labelPl: 'Prezentacja',
      labelEn: 'Presentation',
      iconColor: 'text-fuchsia-500 dark:text-fuchsia-400',
    },
  ];

  const matStyle = page
    ? MATURITY_STYLE[page.maturity] || MATURITY_STYLE.seed
    : MATURITY_STYLE.seed;

  return (
    <ToolsPanelShell
      title={isPl ? 'Narzędzia' : 'Tools'}
      subtitle={isPl ? 'Notatnik' : 'Notebook'}
      onClose={onClose}
    >
      {/* ─── Insert blocks (notebook-specific) ─── */}
      <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
        <SectionLabel>{isPl ? 'Wstaw blok' : 'Insert block'}</SectionLabel>
        <div className="grid grid-cols-5 gap-1.5">
          {insertButtons.map(({ icon: Icon, label, labelPl, action, iconColor }) => (
            <button
              key={label}
              onClick={() => insertElement(action)}
              disabled={!editor}
              className="group relative flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-slate-50/60 dark:bg-white/[0.03] border border-slate-200/30 dark:border-white/[0.05] hover:bg-slate-100/80 dark:hover:bg-white/[0.06] hover:border-slate-300/40 dark:hover:border-white/[0.08] hover:shadow-sm disabled:opacity-40 transition-all duration-200"
              title={isPl ? labelPl : label}
            >
              <Icon size={16} className={iconColor} />
              <span className="text-[8px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 opacity-70 group-hover:opacity-100 transition-opacity">
                {isPl ? labelPl : label}
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
          {isPl ? 'Usuń blok' : 'Delete block'}
        </button>
      </div>

      {/* ─── AI (shared) ─── */}
      <AIQuickActions isPl={isPl} onFocusAICommand={onFocusAICommand} onOpenAIChat={onOpenAIChat} />

      {/* ─── Create from note (notebook-specific) ─── */}
      <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
        <SectionLabel>{isPl ? 'Utwórz z notatki' : 'Create from note'}</SectionLabel>
        <div className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">
          {isPl
            ? 'Convert to… utworzy najpierw MyWork session.'
            : 'Convert to… will create a MyWork session first.'}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {convertActions.map(({ id, icon: Icon, labelPl, labelEn, iconColor }) => {
            const isDeliverable = ['assessment', 'report', 'presentation'].includes(id);
            const disabled = !page || (isDeliverable && !canConvertDeliverable);
            return (
              <button
                key={id}
                onClick={() => handleConvertAction(id)}
                disabled={disabled}
                className="group flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50/40 dark:bg-white/[0.02] border border-slate-200/25 dark:border-white/[0.04] hover:bg-slate-100/60 dark:hover:bg-white/[0.05] hover:border-slate-300/30 dark:hover:border-white/[0.08] transition-all duration-200 hover:shadow-sm disabled:opacity-40"
                title={
                  disabled && isDeliverable && convertBlockedReason
                    ? convertBlockedReason
                    : undefined
                }
              >
                <div
                  className={`w-6 h-6 rounded-lg bg-slate-100/80 dark:bg-white/[0.06] flex items-center justify-center ${iconColor} shrink-0`}
                >
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">
                    {isPl ? labelPl : labelEn}
                  </div>
                  {disabled && isDeliverable && convertBlockedReason ? (
                    <div className="mt-0.5 text-[9px] text-slate-600 dark:text-slate-500 line-clamp-2">
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
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Strona' : 'Page'}</SectionLabel>
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
                    className="appearance-none pr-5 pl-2.5 py-1 rounded-lg bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/40 dark:border-white/[0.06] text-[10px] text-slate-500 dark:text-slate-400 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all"
                  >
                    <option value="private">{isPl ? '🔒 Prywatna' : '🔒 Private'}</option>
                    {page.projectId && (
                      <option value="project">{isPl ? '👥 Projekt' : '👥 Project'}</option>
                    )}
                  </select>
                  <ChevronDown
                    size={9}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
                  />
                </div>
              )}
            </div>
            {page.summary && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed line-clamp-2 pl-0.5">
                {page.summary}
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-500 tabular-nums font-medium">
                <Type size={11} className="opacity-60" />
                {page.wordCount} {isPl ? 'słów' : 'words'}
              </span>
              {page.updatedAt && getRelativeTime && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-500 tabular-nums font-medium">
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
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold bg-slate-50/80 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.07] border border-slate-200/30 dark:border-white/[0.06] hover:border-slate-300/40 dark:hover:border-white/[0.1] transition-all"
                  >
                    <Sparkles size={11} className="text-slate-500 dark:text-slate-400" />
                    {isPl ? 'Zapytaj AI' : 'Ask AI'}
                  </button>
                )}
                {onDeletePage && (
                  <button
                    onClick={onDeletePage}
                    className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-[10px] font-medium bg-danger-500/[0.06] text-danger-400/70 hover:bg-danger-500/[0.12] hover:text-danger-500 border border-danger-500/[0.06] hover:border-danger-500/10 transition-all"
                    title={isPl ? 'Usuń stronę' : 'Delete page'}
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
        <SectionLabel>{isPl ? 'Pisz lub mów' : 'Type or speak'}</SectionLabel>
        <div
          draggable={!!input.trim()}
          onDragStart={handleDragStart}
          className={`group relative rounded-2xl border transition-all duration-300 ${
            input.trim()
              ? 'border-slate-300/40 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.04] shadow-sm cursor-grab active:cursor-grabbing'
              : 'border-slate-200/40 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.02]'
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
                    className="text-slate-600/60 group-hover:text-slate-500 transition-colors"
                  />
                  <div className="w-0.5 h-4 rounded-full bg-gradient-to-b from-slate-400/40 to-transparent" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isPl ? 'Napisz lub naciśnij mikrofon…' : 'Type or press mic…'}
                  rows={3}
                  className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 dark:placeholder:text-slate-500/60 outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                  <button
                    onClick={toggleMic}
                    className={`relative p-2 rounded-xl transition-all duration-200 ${isRecording ? 'bg-danger-500/15 text-danger-500 shadow-sm shadow-danger-500/10' : 'bg-slate-100/80 dark:bg-white/[0.06] text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.08]'}`}
                    title={isPl ? 'Mikrofon' : 'Microphone'}
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
                          <Loader2 size={10} className="animate-spin text-slate-500" />
                          <span className="text-slate-500">
                            {isPl ? 'Generowanie…' : 'Generating…'}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-600/70 dark:text-slate-500/70">
                          {isPl ? '← Przeciągnij' : '← Drag'}
                        </span>
                      )}
                    </span>
                  )}
                  <button
                    onClick={() => input.trim() && runAIAndInsert(input.trim())}
                    disabled={!input.trim() || isGenerating}
                    className="relative p-2 rounded-xl bg-slate-100/80 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.08] hover:shadow-sm disabled:opacity-30 transition-all duration-200"
                    title={isPl ? 'AI: oczyść i wstaw' : 'AI: polish & insert'}
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
