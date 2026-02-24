/**
 * AIChatInlinePanel — menu podręczne notatnika.
 * Przyciski wstawiania elementów + blok tekstu z mikrofonem (drag & drop do notatki).
 */
import type { Editor } from '@tiptap/react';
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Columns3,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Info,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Mic,
  MicOff,
  Minus,
  Send,
  Sparkles,
  ToggleRight,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

const AI_BLOCK_MIME = 'application/x-notebook-ai-block';

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
}

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
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Voice input — Web Speech API
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
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
      toast.error(isPl ? 'Mikrofon nie jest obsługiwany w tej przeglądarce' : 'Microphone not supported');
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

  const DELETABLE_BLOCKS = ['callout', 'details', 'table', 'blockquote', 'horizontalRule'];

  const deleteContainingBlock = useCallback(() => {
    if (!editor) return false;
    const { state } = editor;
    const { $from } = state.selection;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (DELETABLE_BLOCKS.includes(node.type.name)) {
        const pos = $from.before(d);
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
        toast.success(isPl ? 'Usunięto blok' : 'Block deleted');
        return true;
      }
    }
    toast.error(isPl ? 'Ustaw kursor w bloku do usunięcia' : 'Place cursor inside block to delete');
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

  const runAIAndInsert = useCallback(
    async (rawText: string) => {
      if (!editor || !rawText.trim()) return;
      setIsGenerating(true);
      try {
        const systemPrompt = isPl
          ? 'Użytkownik podał surowy tekst (strumień myśli). Przekształć to w elegancki, uporządkowany tekst gotowy do notatki. Zachowaj sens, popraw styl. Odpowiedz TYLKO wygenerowanym tekstem, bez komentarzy.'
          : 'The user provided raw text (stream of thought). Transform it into elegant, organized text ready for a note. Keep the meaning, improve style. Respond ONLY with the generated text, no commentary.';

        const context = `Note: "${noteTitle}". Tags: ${noteTags.join(', ') || 'none'}`;
        const userMessage = `Context: ${context}\n\nUser input: ${rawText}`;

        let result = '';
        await Api.chatWithAIStream(
          userMessage,
          [],
          (chunk) => { result += chunk; },
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
        const paragraphs = text.split(/\n\n+/).filter(Boolean);
        const content = [
          { type: 'paragraph', content: [{ type: 'text', text: `✨ ${aiLabel}` }] },
          ...paragraphs.map((p) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: p.trim() }],
          })),
        ];
        editor.chain().focus().insertContent({
          type: 'callout',
          attrs: { variant: 'purple' },
          content,
        }).run();

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

  // Expose runAIAndInsert for drop handler (via custom event)
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

  if (!open) return null;

  const insertButtons = [
    { icon: Info, label: 'Callout', labelPl: 'Wyróżnienie', action: () => (editor?.commands as any)?.setCallout({ variant: 'info' }) },
    { icon: AlertTriangle, label: 'Warning', labelPl: 'Ostrzeżenie', action: () => (editor?.commands as any)?.setCallout({ variant: 'warning' }) },
    { icon: ToggleRight, label: 'Toggle', labelPl: 'Toggle', action: () => (editor?.commands as any)?.setDetails() },
    { icon: Columns3, label: 'Table', labelPl: 'Tabela', action: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { icon: Minus, label: 'Divider', labelPl: 'Separator', action: () => editor?.chain().focus().setHorizontalRule().run() },
    { icon: Heading1, label: 'H1', labelPl: 'H1', action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { icon: Heading2, label: 'H2', labelPl: 'H2', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { icon: Heading3, label: 'H3', labelPl: 'H3', action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { icon: List, label: 'List', labelPl: 'Lista', action: () => editor?.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, label: 'Num', labelPl: 'Num.', action: () => editor?.chain().focus().toggleOrderedList().run() },
    { icon: ListChecks, label: 'Check', labelPl: 'Check', action: () => editor?.chain().focus().toggleTaskList().run() },
  ];

  return (
    <div className="w-80 shrink-0 border-l border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 flex flex-col">
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-navy-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-700 dark:text-violet-300">
          <Sparkles size={16} />
          <span>{isPl ? 'Narzędzia notatnika' : 'Notebook tools'}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]">
          <X size={14} />
        </button>
      </div>

      {/* Insert element buttons */}
      <div className="px-2 py-2 border-b border-slate-200 dark:border-navy-800">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 px-1 mb-1.5">
          {isPl ? 'Wstaw' : 'Insert'}
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={deleteContainingBlock}
            disabled={!editor}
            className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
            title={isPl ? 'Usuń blok' : 'Delete block'}
          >
            <Trash2 size={14} />
          </button>
          {insertButtons.map(({ icon: Icon, label, labelPl, action }) => (
            <button
              key={label}
              onClick={() => insertElement(action)}
              disabled={!editor}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-50 transition-colors"
              title={isPl ? labelPl : label}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        {(onFocusAICommand || onOpenAIChat) && (
          <div className="mt-2 flex items-center gap-1 px-1">
            {onFocusAICommand && (
              <button
                onClick={onFocusAICommand}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2 py-1.5 text-[11px] font-semibold hover:bg-violet-500/20 transition-colors"
                title={isPl ? 'Polecenie AI' : 'AI command'}
              >
                <Sparkles size={12} />
                {isPl ? 'Polecenie' : 'Command'}
              </button>
            )}
            {onOpenAIChat && (
              <button
                onClick={onOpenAIChat}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 px-2 py-1.5 text-[11px] font-semibold hover:bg-slate-500/20 transition-colors"
                title={isPl ? 'Czat AI' : 'AI chat'}
              >
                {isPl ? 'Czat' : 'Chat'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Page meta + actions */}
      {page && (
        <div className="px-3 py-3 border-b border-slate-200 dark:border-navy-800 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {isPl ? 'Strona' : 'Page'}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-300/50 dark:border-white/[0.08] bg-slate-500/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 font-semibold uppercase tracking-wide text-[9px]">
              {page.maturity}
            </span>

            {onSetVisibility && (
              <div className="relative">
                <select
                  value={page.visibility === 'project' && page.projectId ? 'project' : 'private'}
                  onChange={(e) => onSetVisibility(e.target.value as 'private' | 'project')}
                  className="appearance-none pr-6 pl-2 py-0.5 rounded-md bg-transparent border border-slate-200/60 dark:border-white/[0.08] text-[10px] text-slate-600 dark:text-slate-400 font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <option value="private">{isPl ? '🔒 Prywatna' : '🔒 Private'}</option>
                  {page.projectId && <option value="project">{isPl ? '👥 Projekt' : '👥 Project'}</option>}
                </select>
                <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {page.summary ? (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-2">
              {page.summary}
            </div>
          ) : null}

          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Type size={12} />
              {page.wordCount}
            </span>
            {page.updatedAt && getRelativeTime ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock size={12} />
                {getRelativeTime(page.updatedAt)}
              </span>
            ) : null}
          </div>

          {(onAskAI || onDeletePage) && (
            <div className="flex items-center gap-2">
              {onAskAI && (
                <button
                  onClick={onAskAI}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2 py-1.5 text-[11px] font-semibold hover:bg-violet-500/20 transition-colors"
                >
                  <Sparkles size={12} />
                  {isPl ? 'Zapytaj AI' : 'Ask AI'}
                </button>
              )}
              {onDeletePage && (
                <button
                  onClick={onDeletePage}
                  className="inline-flex items-center justify-center rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 px-2 py-1.5 text-[11px] font-semibold hover:bg-red-500/20 transition-colors"
                  title={isPl ? 'Usuń stronę' : 'Delete page'}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Draggable AI block */}
      <div className="p-3 flex-1 flex flex-col min-h-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 px-1 mb-2">
          {isPl ? 'Pisz lub mów — przeciągnij do notatki' : 'Type or speak — drag to note'}
        </div>
        <div
          draggable={!!input.trim()}
          onDragStart={handleDragStart}
          className={`rounded-xl border-2 border-dashed p-3 transition-all ${
            input.trim()
              ? 'border-violet-400/50 dark:border-violet-500/40 bg-violet-50/50 dark:bg-violet-950/30 cursor-grab active:cursor-grabbing'
              : 'border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-900/30'
          }`}
        >
          <div className="flex items-start gap-2">
            {input.trim() ? (
              <GripVertical size={14} className="mt-2.5 shrink-0 text-slate-400" />
            ) : null}
            <div className="flex-1 min-w-0">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isPl ? 'Napisz lub naciśnij mikrofon…' : 'Type or press mic…'}
                rows={3}
                className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={toggleMic}
                  className={`p-2 rounded-lg transition-colors ${
                    isRecording
                      ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400'
                  }`}
                  title={isPl ? 'Mikrofon' : 'Microphone'}
                >
                  {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                  onClick={() => input.trim() && runAIAndInsert(input.trim())}
                  disabled={!input.trim() || isGenerating}
                  className="p-2 rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/30 disabled:opacity-50 transition-colors"
                  title={isPl ? 'Generuj i wstaw' : 'Generate and insert'}
                >
                  <Send size={16} />
                </button>
                {input.trim() && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    {isGenerating && <Loader2 size={10} className="animate-spin" />}
                    {isGenerating
                      ? (isPl ? 'Generowanie…' : 'Generating…')
                      : (isPl ? 'Przeciągnij do notatki' : 'Drag to note')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { AI_BLOCK_MIME };
