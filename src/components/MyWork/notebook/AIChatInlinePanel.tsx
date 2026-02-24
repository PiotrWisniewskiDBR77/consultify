/**
 * AIChatInlinePanel — Notebook tools panel.
 * Premium "Tech Sexy" design: glassmorphism, gradient accents, invisible borders.
 * Sections: Insert blocks, AI, Actions (convert), Transform (AI text ops), Page, Compose.
 */
import type { Editor } from '@tiptap/react';
import {
  AlertTriangle,
  ArrowDownFromLine,
  ArrowUpFromLine,
  CheckSquare,
  ChevronDown,
  Clock,
  Columns3,
  FileBarChart,
  GripVertical,
  Info,
  Languages,
  Lightbulb,
  ListChecks,
  Loader2,
  Mail,
  Mic,
  MicOff,
  Minus,
  PenLine,
  Presentation,
  Scale,
  Send,
  Sparkles,
  Target,
  ToggleRight,
  Trash2,
  Type,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

const AI_BLOCK_MIME = 'application/x-notebook-ai-block';

type ConvertTarget = 'initiative' | 'task' | 'decision' | 'idea' | 'assessment' | 'report' | 'presentation';

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
}

const MATURITY_STYLE: Record<string, { gradient: string; text: string; glow: string }> = {
  seed: { gradient: 'from-slate-400/20 to-slate-500/10', text: 'text-slate-500', glow: 'shadow-slate-400/10' },
  growing: { gradient: 'from-emerald-400/20 to-emerald-500/10', text: 'text-emerald-500', glow: 'shadow-emerald-400/10' },
  mature: { gradient: 'from-blue-400/20 to-blue-500/10', text: 'text-blue-500', glow: 'shadow-blue-400/10' },
  actionable: { gradient: 'from-amber-400/20 to-amber-500/10', text: 'text-amber-500', glow: 'shadow-amber-400/10' },
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400/80 dark:text-slate-500/80 mb-2">
    {children}
  </div>
);

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
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const { setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const recognitionRef = useRef<any>(null);

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
      try { rec.abort(); } catch {}
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

  /* ---- AI Transform helpers ---- */
  const sendToChatWithPrompt = useCallback(
    (prompt: string) => {
      setChatKickoffMessage(prompt);
      if (isChatCollapsed) toggleChatCollapse();
    },
    [setChatKickoffMessage, isChatCollapsed, toggleChatCollapse]
  );

  const handleTranslate = useCallback(() => {
    const targetLang = isPl ? 'English' : 'Polish';
    const excerpt = (noteContent || '').trim().slice(0, 2000);
    sendToChatWithPrompt(
      isPl
        ? `Przetłumacz poniższą notatkę na język ${targetLang}. Zachowaj formatowanie i styl.\n\nTytuł: "${noteTitle}"\n\nTreść:\n${excerpt}`
        : `Translate the following note into ${targetLang}. Preserve formatting and style.\n\nTitle: "${noteTitle}"\n\nContent:\n${excerpt}`
    );
    trackFunnelEvent('notebook_transform_used', {});
    toast.success(isPl ? `Wysłano do czata → ${targetLang}` : `Sent to chat → ${targetLang}`);
  }, [isPl, noteTitle, noteContent, sendToChatWithPrompt]);

  const handleChangeStyle = useCallback(
    (style: string) => {
      const excerpt = (noteContent || '').trim().slice(0, 2000);
      const styleMap: Record<string, { pl: string; en: string }> = {
        formal: { pl: 'formalny, profesjonalny', en: 'formal, professional' },
        casual: { pl: 'swobodny, konwersacyjny', en: 'casual, conversational' },
        concise: { pl: 'zwięzły, skrócony do esencji', en: 'concise, distilled to essentials' },
        creative: { pl: 'kreatywny, barwny, inspirujący', en: 'creative, colorful, inspiring' },
      };
      const s = styleMap[style] || styleMap.formal;
      sendToChatWithPrompt(
        isPl
          ? `Przepisz poniższą notatkę w stylu: ${s.pl}. Zachowaj treść, zmień formę.\n\nTytuł: "${noteTitle}"\nTagi: ${noteTags.join(', ') || 'brak'}\n\nTreść:\n${excerpt}`
          : `Rewrite the following note in ${s.en} style. Keep the content, change the form.\n\nTitle: "${noteTitle}"\nTags: ${noteTags.join(', ') || 'none'}\n\nContent:\n${excerpt}`
      );
      trackFunnelEvent('notebook_transform_used', {});
      toast.success(isPl ? 'Wysłano do czata' : 'Sent to chat');
    },
    [isPl, noteTitle, noteContent, noteTags, sendToChatWithPrompt]
  );

  const handleChangeLength = useCallback(
    (direction: 'shorter' | 'longer') => {
      const excerpt = (noteContent || '').trim().slice(0, 2000);
      sendToChatWithPrompt(
        isPl
          ? `${direction === 'shorter' ? 'Skróć' : 'Rozwiń'} poniższą notatkę. ${direction === 'shorter' ? 'Zachowaj kluczowe punkty, usuń powtórzenia.' : 'Dodaj szczegóły, przykłady i kontekst.'}\n\nTytuł: "${noteTitle}"\n\nTreść:\n${excerpt}`
          : `${direction === 'shorter' ? 'Shorten' : 'Expand'} the following note. ${direction === 'shorter' ? 'Keep key points, remove repetition.' : 'Add details, examples and context.'}\n\nTitle: "${noteTitle}"\n\nContent:\n${excerpt}`
      );
      trackFunnelEvent('notebook_transform_used', {});
      toast.success(isPl ? 'Wysłano do czata' : 'Sent to chat');
    },
    [isPl, noteTitle, noteContent, sendToChatWithPrompt]
  );

  const handleEmailNote = useCallback(() => {
    const subject = encodeURIComponent(noteTitle || (isPl ? 'Notatka' : 'Note'));
    const body = encodeURIComponent(
      `${noteTitle}\n${'—'.repeat(30)}\n\n${(noteContent || '').trim().slice(0, 5000)}\n\n—\n${isPl ? 'Wysłano z Consultify Notebook' : 'Sent from Consultify Notebook'}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    trackFunnelEvent('notebook_share_email', {});
    toast.success(isPl ? 'Otwarto klienta email' : 'Email client opened');
  }, [noteTitle, noteContent, isPl]);

  const handleAssessment = useCallback(() => {
    const excerpt = (noteContent || '').trim().slice(0, 2000);
    sendToChatWithPrompt(
      isPl
        ? `Na podstawie poniższej notatki wygeneruj listę 8-12 pytań do oceny (assessment). Pytania powinny weryfikować: kompletność, ryzyka, zależności, KPI, stakeholderów i wykonalność.\n\nTytuł: "${noteTitle}"\nTagi: ${noteTags.join(', ') || 'brak'}\n\nTreść:\n${excerpt}`
        : `Based on the note below, generate a list of 8-12 assessment questions. Questions should verify: completeness, risks, dependencies, KPIs, stakeholders and feasibility.\n\nTitle: "${noteTitle}"\nTags: ${noteTags.join(', ') || 'none'}\n\nContent:\n${excerpt}`
    );
    toast.success(isPl ? 'Generowanie pytań…' : 'Generating questions…');
  }, [isPl, noteTitle, noteContent, noteTags, sendToChatWithPrompt]);

  const handleReport = useCallback(() => {
    const excerpt = (noteContent || '').trim().slice(0, 2000);
    sendToChatWithPrompt(
      isPl
        ? `Na podstawie poniższej notatki przygotuj profesjonalny raport. Struktura: streszczenie wykonawcze, kontekst, analiza, wnioski, rekomendacje, kolejne kroki.\n\nTytuł: "${noteTitle}"\nTagi: ${noteTags.join(', ') || 'brak'}\n\nTreść:\n${excerpt}`
        : `Based on the note below, prepare a professional report. Structure: executive summary, context, analysis, conclusions, recommendations, next steps.\n\nTitle: "${noteTitle}"\nTags: ${noteTags.join(', ') || 'none'}\n\nContent:\n${excerpt}`
    );
    toast.success(isPl ? 'Tworzenie raportu…' : 'Creating report…');
  }, [isPl, noteTitle, noteContent, noteTags, sendToChatWithPrompt]);

  const handlePresentation = useCallback(() => {
    const excerpt = (noteContent || '').trim().slice(0, 2000);
    sendToChatWithPrompt(
      isPl
        ? `Na podstawie poniższej notatki przygotuj zarys prezentacji (10-15 slajdów). Każdy slajd: tytuł + 3-5 bullet pointów. Dodaj notki prelegenta.\n\nTytuł: "${noteTitle}"\nTagi: ${noteTags.join(', ') || 'brak'}\n\nTreść:\n${excerpt}`
        : `Based on the note below, prepare a presentation outline (10-15 slides). Each slide: title + 3-5 bullet points. Add speaker notes.\n\nTitle: "${noteTitle}"\nTags: ${noteTags.join(', ') || 'none'}\n\nContent:\n${excerpt}`
    );
    toast.success(isPl ? 'Tworzenie prezentacji…' : 'Creating presentation…');
  }, [isPl, noteTitle, noteContent, noteTags, sendToChatWithPrompt]);

  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  if (!open) return null;

  const insertButtons = [
    { icon: Info, label: 'Callout', labelPl: 'Wyróżnienie', action: () => (editor?.commands as any)?.setCallout({ variant: 'info' }), color: 'from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400' },
    { icon: AlertTriangle, label: 'Warning', labelPl: 'Ostrzeżenie', action: () => (editor?.commands as any)?.setCallout({ variant: 'warning' }), color: 'from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400' },
    { icon: ToggleRight, label: 'Toggle', labelPl: 'Rozwijane', action: () => (editor?.commands as any)?.setDetails(), color: 'from-slate-500/15 to-slate-600/8 text-slate-600 dark:text-slate-400' },
    { icon: Columns3, label: 'Table', labelPl: 'Tabela', action: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), color: 'from-indigo-500/15 to-indigo-600/8 text-indigo-600 dark:text-indigo-400' },
    { icon: Minus, label: 'Divider', labelPl: 'Separator', action: () => editor?.chain().focus().setHorizontalRule().run(), color: 'from-slate-500/15 to-slate-600/8 text-slate-600 dark:text-slate-400' },
  ];

  const convertActions: { id: ConvertTarget; icon: React.ComponentType<any>; labelPl: string; labelEn: string; gradient: string; textColor: string }[] = [
    { id: 'initiative', icon: Target, labelPl: 'Inicjatywa', labelEn: 'Initiative', gradient: 'from-blue-500/15 to-cyan-500/10', textColor: 'text-blue-600 dark:text-blue-400' },
    { id: 'task', icon: CheckSquare, labelPl: 'Task', labelEn: 'Task', gradient: 'from-emerald-500/15 to-green-500/10', textColor: 'text-emerald-600 dark:text-emerald-400' },
    { id: 'decision', icon: Scale, labelPl: 'Decyzja', labelEn: 'Decision', gradient: 'from-amber-500/15 to-yellow-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
    { id: 'idea', icon: Lightbulb, labelPl: 'Idea', labelEn: 'Idea', gradient: 'from-violet-500/15 to-purple-500/10', textColor: 'text-violet-600 dark:text-violet-400' },
    { id: 'assessment', icon: ListChecks, labelPl: 'Assessment', labelEn: 'Assessment', gradient: 'from-rose-500/15 to-pink-500/10', textColor: 'text-rose-600 dark:text-rose-400' },
    { id: 'report', icon: FileBarChart, labelPl: 'Raport', labelEn: 'Report', gradient: 'from-indigo-500/15 to-blue-500/10', textColor: 'text-indigo-600 dark:text-indigo-400' },
    { id: 'presentation', icon: Presentation, labelPl: 'Prezentacja', labelEn: 'Presentation', gradient: 'from-fuchsia-500/15 to-pink-500/10', textColor: 'text-fuchsia-600 dark:text-fuchsia-400' },
  ];

  const handleConvertAction = (target: ConvertTarget) => {
    if (target === 'assessment') { handleAssessment(); return; }
    if (target === 'report') { handleReport(); return; }
    if (target === 'presentation') { handlePresentation(); return; }
    onConvert?.(target);
  };

  const styleOptions = [
    { id: 'formal', labelPl: 'Formalny', labelEn: 'Formal', icon: '📋' },
    { id: 'casual', labelPl: 'Swobodny', labelEn: 'Casual', icon: '💬' },
    { id: 'concise', labelPl: 'Zwięzły', labelEn: 'Concise', icon: '✂️' },
    { id: 'creative', labelPl: 'Kreatywny', labelEn: 'Creative', icon: '🎨' },
  ];

  const matStyle = page ? (MATURITY_STYLE[page.maturity] || MATURITY_STYLE.seed) : MATURITY_STYLE.seed;

  return (
    <div className="w-80 shrink-0 border-l border-white/[0.06] bg-gradient-to-b from-white via-white to-slate-50/30 dark:from-navy-950 dark:via-navy-950 dark:to-navy-900/20 flex flex-col backdrop-blur-sm">
      {/* ─── Header ─── */}
      <div className="relative px-4 py-3 border-b border-slate-200/40 dark:border-white/[0.04] shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/[0.04] via-indigo-500/[0.02] to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-violet-500/20">
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                {isPl ? 'Narzędzia' : 'Tools'}
              </div>
              <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {isPl ? 'Notatnik' : 'Notebook'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-600 dark:hover:text-slate-300 transition-all">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ─── Scrollable content ─── */}
      <div className="flex-1 overflow-y-auto nb-scroll">

        {/* ─── Insert blocks ─── */}
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Wstaw blok' : 'Insert block'}</SectionLabel>
          <div className="grid grid-cols-5 gap-1.5">
            {insertButtons.map(({ icon: Icon, label, labelPl, action, color }) => (
              <button
                key={label}
                onClick={() => insertElement(action)}
                disabled={!editor}
                className={`group relative flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-gradient-to-b ${color} border border-transparent hover:border-current/10 hover:shadow-sm disabled:opacity-40 transition-all duration-200`}
                title={isPl ? labelPl : label}
              >
                <Icon size={16} />
                <span className="text-[8px] font-semibold uppercase tracking-wider opacity-70 group-hover:opacity-100 transition-opacity">
                  {isPl ? labelPl : label}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={deleteContainingBlock}
            disabled={!editor}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500/[0.06] text-red-500/70 hover:bg-red-500/[0.12] hover:text-red-600 dark:hover:text-red-400 text-[10px] font-medium disabled:opacity-40 transition-all"
            title={isPl ? 'Usuń blok (⌘⇧⌫)' : 'Delete block (⌘⇧⌫)'}
          >
            <Trash2 size={11} />
            {isPl ? 'Usuń blok' : 'Delete block'}
          </button>
        </div>

        {/* ─── AI Quick actions ─── */}
        {(onFocusAICommand || onOpenAIChat) && (
          <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
            <SectionLabel>AI</SectionLabel>
            <div className="flex gap-2">
              {onFocusAICommand && (
                <button
                  onClick={onFocusAICommand}
                  className="flex-1 group relative overflow-hidden rounded-xl py-2.5 px-3 transition-all duration-200 hover:shadow-md"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-indigo-500/15 group-hover:from-violet-500/25 group-hover:to-indigo-500/25 transition-all" />
                  <div className="absolute inset-0 border border-violet-500/10 group-hover:border-violet-500/20 rounded-xl transition-colors" />
                  <div className="relative flex flex-col items-center gap-1">
                    <Sparkles size={16} className="text-violet-600 dark:text-violet-400" />
                    <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300">
                      {isPl ? 'Polecenie' : 'Command'}
                    </span>
                    <span className="text-[8px] text-violet-500/60 font-medium">⌘⇧A</span>
                  </div>
                </button>
              )}
              {onOpenAIChat && (
                <button
                  onClick={onOpenAIChat}
                  className="flex-1 group relative overflow-hidden rounded-xl py-2.5 px-3 transition-all duration-200 hover:shadow-md"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-500/10 via-slate-400/8 to-slate-500/10 group-hover:from-slate-500/20 group-hover:to-slate-500/15 transition-all" />
                  <div className="absolute inset-0 border border-slate-500/10 group-hover:border-slate-500/20 rounded-xl transition-colors" />
                  <div className="relative flex flex-col items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-slate-400">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {isPl ? 'Czat AI' : 'AI Chat'}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── Actions (convert note) ─── */}
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Utwórz z notatki' : 'Create from note'}</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {convertActions.map(({ id, icon: Icon, labelPl, labelEn, gradient, textColor }) => (
              <button
                key={id}
                onClick={() => handleConvertAction(id)}
                disabled={!page}
                className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md disabled:opacity-40`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} group-hover:opacity-150 transition-opacity`} />
                <div className="absolute inset-0 border border-current/[0.06] group-hover:border-current/[0.12] rounded-xl transition-colors" />
                <div className={`relative w-6 h-6 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${textColor}`}>
                  <Icon size={13} />
                </div>
                <div className="relative flex-1 min-w-0 text-left">
                  <div className={`text-[10px] font-bold ${textColor} truncate`}>
                    {isPl ? labelPl : labelEn}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Transform (AI text operations) ─── */}
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Transformuj tekst' : 'Transform text'}</SectionLabel>

          <div className="space-y-1.5">
            {/* Translate */}
            <button
              onClick={handleTranslate}
              className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:shadow-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-sky-500/[0.06] to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500/20 to-cyan-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                <Languages size={14} />
              </div>
              <div className="relative flex-1 min-w-0 text-left">
                <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  {isPl ? 'Przetłumacz' : 'Translate'}
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500">
                  {isPl ? `→ English` : `→ Polski`}
                </div>
              </div>
            </button>

            {/* Change style */}
            <div className="relative">
              <button
                onClick={() => setStyleMenuOpen(!styleMenuOpen)}
                className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:shadow-sm"
              >
                <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                  <PenLine size={14} />
                </div>
                <div className="relative flex-1 min-w-0 text-left">
                  <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {isPl ? 'Zmień styl' : 'Change style'}
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">
                    {isPl ? 'Formalny, swobodny, zwięzły…' : 'Formal, casual, concise…'}
                  </div>
                </div>
                <ChevronDown size={12} className={`text-slate-400 transition-transform ${styleMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {styleMenuOpen && (
                <div className="mt-1 ml-9 grid grid-cols-2 gap-1">
                  {styleOptions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { handleChangeStyle(s.id); setStyleMenuOpen(false); }}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50/80 dark:bg-white/[0.04] border border-slate-200/30 dark:border-white/[0.06] hover:bg-violet-500/10 hover:border-violet-500/15 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300 transition-all"
                    >
                      <span>{s.icon}</span>
                      {isPl ? s.labelPl : s.labelEn}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Change length */}
            <div className="flex gap-1.5">
              <button
                onClick={() => handleChangeLength('shorter')}
                className="group flex-1 flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-200 hover:shadow-sm"
              >
                <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                  <ArrowDownFromLine size={14} />
                </div>
                <div className="relative text-left">
                  <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {isPl ? 'Skróć' : 'Shorter'}
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleChangeLength('longer')}
                className="group flex-1 flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-200 hover:shadow-sm"
              >
                <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                  <ArrowUpFromLine size={14} />
                </div>
                <div className="relative text-left">
                  <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {isPl ? 'Rozwiń' : 'Expand'}
                  </div>
                </div>
              </button>
            </div>

            {/* AI Magic Wand — general rewrite */}
            <button
              onClick={() => {
                const excerpt = (noteContent || '').trim().slice(0, 2000);
                sendToChatWithPrompt(
                  isPl
                    ? `Popraw i ulepsz poniższą notatkę. Popraw styl, gramatykę, strukturę. Zasugeruj lepsze nagłówki i formatowanie.\n\nTytuł: "${noteTitle}"\n\nTreść:\n${excerpt}`
                    : `Improve and polish the following note. Fix style, grammar, structure. Suggest better headings and formatting.\n\nTitle: "${noteTitle}"\n\nContent:\n${excerpt}`
                );
                toast.success(isPl ? 'Wysłano do czata' : 'Sent to chat');
              }}
              className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:shadow-sm"
            >
              <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-pink-500/10 flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400 shrink-0">
                <Wand2 size={14} />
              </div>
              <div className="relative flex-1 min-w-0 text-left">
                <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  {isPl ? 'Popraw całość' : 'Polish & improve'}
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500">
                  {isPl ? 'Styl, gramatyka, struktura' : 'Style, grammar, structure'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ─── Share ─── */}
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Udostępnij' : 'Share'}</SectionLabel>
          <button
            onClick={handleEmailNote}
            className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:shadow-sm"
          >
            <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-slate-500/15 to-slate-600/8 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
              <Mail size={14} />
            </div>
            <div className="relative flex-1 min-w-0 text-left">
              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                {isPl ? 'Wyślij mailem' : 'Send via email'}
              </div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500">
                {isPl ? 'Otwiera klienta email z treścią' : 'Opens email client with content'}
              </div>
            </div>
          </button>
        </div>

        {/* ─── Page metadata ─── */}
        {page && (
          <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
            <SectionLabel>{isPl ? 'Strona' : 'Page'}</SectionLabel>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r ${matStyle.gradient} ${matStyle.text} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${matStyle.glow}`}>
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
                      {page.projectId && <option value="project">{isPl ? '👥 Projekt' : '👥 Project'}</option>}
                    </select>
                    <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {page.summary && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 italic leading-relaxed line-clamp-2 pl-0.5">
                  {page.summary}
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 tabular-nums font-medium">
                  <Type size={11} className="opacity-60" />
                  {page.wordCount} {isPl ? 'słów' : 'words'}
                </span>
                {page.updatedAt && getRelativeTime && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 tabular-nums font-medium">
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
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold bg-gradient-to-r from-violet-500/12 to-indigo-500/8 text-violet-700 dark:text-violet-300 hover:from-violet-500/20 hover:to-indigo-500/15 border border-violet-500/10 hover:border-violet-500/20 transition-all"
                    >
                      <Sparkles size={11} />
                      {isPl ? 'Zapytaj AI' : 'Ask AI'}
                    </button>
                  )}
                  {onDeletePage && (
                    <button
                      onClick={onDeletePage}
                      className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-[10px] font-medium bg-red-500/[0.06] text-red-400/70 hover:bg-red-500/[0.12] hover:text-red-500 border border-red-500/[0.06] hover:border-red-500/10 transition-all"
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

        {/* ─── Draggable AI compose strip ─── */}
        <div className="p-3">
          <SectionLabel>{isPl ? 'Pisz lub mów' : 'Type or speak'}</SectionLabel>
          <div
            draggable={!!input.trim()}
            onDragStart={handleDragStart}
            className={`group relative rounded-2xl border transition-all duration-300 ${
              input.trim()
                ? 'border-violet-400/30 dark:border-violet-500/20 bg-gradient-to-br from-violet-50/60 via-white to-indigo-50/40 dark:from-violet-950/30 dark:via-navy-950 dark:to-indigo-950/20 shadow-lg shadow-violet-500/[0.06] cursor-grab active:cursor-grabbing'
                : 'border-slate-200/40 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.02]'
            }`}
          >
            {input.trim() && (
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-violet-500/10 via-transparent to-indigo-500/10 pointer-events-none" />
            )}
            <div className="relative p-3">
              <div className="flex items-start gap-2">
                {input.trim() && (
                  <div className="mt-2.5 shrink-0 flex flex-col items-center gap-0.5">
                    <GripVertical size={14} className="text-violet-400/60 group-hover:text-violet-500 transition-colors" />
                    <div className="w-0.5 h-4 rounded-full bg-gradient-to-b from-violet-400/40 to-transparent" />
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
                      className={`relative p-2 rounded-xl transition-all duration-200 ${
                        isRecording
                          ? 'bg-red-500/15 text-red-500 shadow-sm shadow-red-500/10'
                          : 'bg-slate-100/80 dark:bg-white/[0.06] text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10'
                      }`}
                      title={isPl ? 'Mikrofon' : 'Microphone'}
                    >
                      {isRecording && (
                        <span className="absolute inset-0 rounded-xl animate-ping bg-red-500/10" />
                      )}
                      <span className="relative">
                        {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                      </span>
                    </button>

                    {input.trim() && (
                      <span className="flex items-center gap-1.5 text-[10px] font-medium">
                        {isGenerating ? (
                          <>
                            <Loader2 size={10} className="animate-spin text-violet-500" />
                            <span className="text-violet-500">{isPl ? 'Generowanie…' : 'Generating…'}</span>
                          </>
                        ) : (
                          <span className="text-slate-400/70 dark:text-slate-500/70">
                            {isPl ? '← Przeciągnij' : '← Drag'}
                          </span>
                        )}
                      </span>
                    )}

                    <button
                      onClick={() => input.trim() && runAIAndInsert(input.trim())}
                      disabled={!input.trim() || isGenerating}
                      className="relative p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/15 text-violet-600 dark:text-violet-400 hover:from-violet-500/30 hover:to-indigo-500/25 hover:shadow-sm disabled:opacity-30 transition-all duration-200"
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

      </div>
    </div>
  );
};

export { AI_BLOCK_MIME };
export type { ConvertTarget };
