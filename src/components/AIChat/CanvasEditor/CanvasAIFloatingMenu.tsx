/**
 * Floating AI menu that appears above text selection in Canvas editor.
 * Allows user to ask Teresa to modify selected text.
 */

import type { Editor } from '@tiptap/react';
import { Check, ChevronDown, Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSelection } from './CanvasRichEditor';

interface CanvasAIFloatingMenuProps {
  editor: Editor;
  selection: CanvasSelection | null;
  onAIRequest: (prompt: string, selectedText: string) => Promise<string | null>;
  isProcessing: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
}

const QUICK_ACTIONS = [
  {
    id: 'expand',
    labelEn: 'Expand',
    labelPl: 'Rozwiń',
    prompt: 'Expand this text with more detail.',
  },
  {
    id: 'shorten',
    labelEn: 'Shorten',
    labelPl: 'Skróć',
    prompt: 'Make this text shorter and more concise.',
  },
  {
    id: 'rewrite',
    labelEn: 'Rewrite',
    labelPl: 'Przepisz',
    prompt: 'Rewrite this text to be clearer and more professional.',
  },
  // C5 — parity-with-ChatGPT-Canvas presets. Each is a single prompt the
  // backend already handles via /chat/quick; the value is in the labels (the
  // user shouldn't need to know the exact phrasing).
  {
    id: 'final_polish',
    labelEn: 'Final polish',
    labelPl: 'Doszlifuj',
    prompt:
      'Polish this text: fix grammar and spelling, smooth awkward phrasing, keep meaning + tone identical, preserve markdown structure.',
  },
  {
    id: 'length_concise',
    labelEn: 'Length: concise',
    labelPl: 'Długość: zwięzła',
    prompt:
      'Compress this text by about 40%. Keep every key fact and the structure. Cut filler and redundancy.',
  },
  {
    id: 'length_detailed',
    labelEn: 'Length: detailed',
    labelPl: 'Długość: rozbudowana',
    prompt:
      'Expand this text by about 60%. Add concrete examples, supporting detail, and clearer transitions. Do not invent facts.',
  },
  {
    id: 'level_exec',
    labelEn: 'For: executive',
    labelPl: 'Dla: zarządu',
    prompt:
      'Rewrite for an executive reader: scannable, decision-oriented, lead with the so-what, drop jargon, max 1 idea per sentence.',
  },
  {
    id: 'level_expert',
    labelEn: 'For: expert',
    labelPl: 'Dla: eksperta',
    prompt:
      'Rewrite for a domain expert: precise terminology, mention trade-offs and assumptions, avoid over-simplifying.',
  },
  {
    id: 'level_beginner',
    labelEn: 'For: beginner',
    labelPl: 'Dla: laika',
    prompt:
      'Rewrite for someone new to this topic: explain terms, use analogies, short paragraphs, friendly tone.',
  },
  {
    id: 'translate_en',
    labelEn: 'Translate → EN',
    labelPl: 'Tłumacz → EN',
    prompt: 'Translate this text to English.',
  },
  {
    id: 'translate_pl',
    labelEn: 'Translate → PL',
    labelPl: 'Tłumacz → PL',
    prompt: 'Translate this text to Polish.',
  },
] as const;

export const CanvasAIFloatingMenu: React.FC<CanvasAIFloatingMenuProps> = ({
  editor,
  selection,
  onAIRequest,
  isProcessing,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Position the menu above the selection
  useEffect(() => {
    if (!selection || !editor) {
      setPosition(null);
      setShowPromptInput(false);
      setShowQuickActions(false);
      return;
    }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setPosition(null);
      return;
    }

    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setPosition(null);
      return;
    }

    // P1 — viewport-clamp. The menu is ~300px wide and 48px tall; if the
    // selection is near a viewport edge, the unclamped position made it spill
    // off-screen (especially on iPad / narrow laptop). Clamp horizontally
    // with margin and flip below the selection when the top edge is too high.
    const MENU_HALF_W = 160; // approx half the toolbar width
    const MENU_H = 48;
    const MARGIN = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const idealLeft = rect.left + rect.width / 2;
    const clampedLeft = Math.min(
      Math.max(MENU_HALF_W + MARGIN, idealLeft),
      vw - MENU_HALF_W - MARGIN
    );

    const idealTop = rect.top - MENU_H;
    // Flip the menu below the selection if it would overlap the top of the
    // viewport (e.g. user selects text in the first visible line).
    const clampedTop =
      idealTop < MARGIN
        ? Math.min(rect.bottom + 8, vh - MENU_H - MARGIN)
        : Math.min(idealTop, vh - MENU_H - MARGIN);

    setPosition({ top: clampedTop, left: clampedLeft });
  }, [selection, editor]);

  useEffect(() => {
    if (showPromptInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showPromptInput]);

  const handleQuickAction = useCallback(
    async (prompt: string) => {
      if (!selection || isProcessing) return;
      setShowQuickActions(false);
      await onAIRequest(prompt, selection.selectedText);
    },
    [selection, isProcessing, onAIRequest]
  );

  const handleCustomPrompt = useCallback(async () => {
    if (!selection || !customPrompt.trim() || isProcessing) return;
    setShowPromptInput(false);
    await onAIRequest(customPrompt.trim(), selection.selectedText);
    setCustomPrompt('');
  }, [selection, customPrompt, isProcessing, onAIRequest]);

  if (!position || !selection) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] flex flex-col items-center"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Prompt input */}
      {showPromptInput && (
        <div className="mb-1 flex items-center gap-1 rounded-lg border border-primary-200 dark:border-primary-500/30 bg-white dark:bg-navy-800 px-2 py-1 shadow-lg">
          <Sparkles size={14} className="text-primary-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomPrompt();
              if (e.key === 'Escape') {
                setShowPromptInput(false);
                setCustomPrompt('');
              }
            }}
            placeholder={
              isPolish
                ? 'Co Teresa ma zrobić z tym tekstem?'
                : 'What should Teresa do with this text?'
            }
            className="w-64 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
          />
          <button
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim() || isProcessing}
            className="p-1 rounded text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10 disabled:opacity-40"
          >
            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
        </div>
      )}

      {/* Quick actions dropdown */}
      {showQuickActions && (
        <div className="mb-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 py-1 shadow-lg min-w-[160px]">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.prompt)}
              disabled={isProcessing}
              className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40"
            >
              {isPolish ? action.labelPl : action.labelEn}
            </button>
          ))}
        </div>
      )}

      {/* Main toolbar */}
      <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 px-1 py-0.5 shadow-lg">
        <button
          onClick={() => {
            setShowPromptInput(!showPromptInput);
            setShowQuickActions(false);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors"
          title={isPolish ? 'Zapytaj Teresę' : 'Ask Teresa'}
        >
          <Sparkles size={14} />
          <span>{isPolish ? 'Teresa' : 'Ask AI'}</span>
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
        <button
          onClick={() => {
            setShowQuickActions(!showQuickActions);
            setShowPromptInput(false);
          }}
          className="flex items-center gap-0.5 px-1.5 py-1 rounded text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          title={isPolish ? 'Szybkie akcje' : 'Quick actions'}
        >
          <span>{isPolish ? 'Akcje' : 'Actions'}</span>
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
};

/**
 * Accept/Reject bar shown after AI generates a suggestion.
 */
interface AIAcceptRejectBarProps {
  onAccept: () => void;
  onReject: () => void;
  isPolish?: boolean;
}

export const AIAcceptRejectBar: React.FC<AIAcceptRejectBarProps> = ({
  onAccept,
  onReject,
  isPolish,
}) => (
  <div className="sticky bottom-4 flex justify-center z-50 pointer-events-none">
    <div className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 px-3 py-1.5 shadow-lg pointer-events-auto">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {isPolish ? 'Propozycja Teresy' : 'Teresa suggestion'}
      </span>
      <button
        onClick={onAccept}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
      >
        <Check size={12} />
        {isPolish ? 'Akceptuj' : 'Accept'}
      </button>
      <button
        onClick={onReject}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
      >
        <X size={12} />
        {isPolish ? 'Odrzuć' : 'Reject'}
      </button>
    </div>
  </div>
);
