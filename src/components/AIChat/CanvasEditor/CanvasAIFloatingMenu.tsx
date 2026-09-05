/**
 * Floating AI menu that appears above text selection in Canvas editor.
 * Allows user to ask Teresa to modify selected text.
 */

import type { Editor } from '@tiptap/react';
import {
  Check,
  ChevronDown,
  HelpCircle,
  Loader2,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasSelection } from './CanvasRichEditor';

interface CanvasAIFloatingMenuProps {
  editor: Editor;
  selection: CanvasSelection | null;
  onAIRequest: (prompt: string, selectedText: string) => Promise<string | null>;
  /**
   * E1 — read-only AI request for the "Wyjaśnij" shortcut. Same /chat/quick
   * pipeline as onAIRequest but the result is displayed in a popover instead
   * of being applied to the document as a diff.
   */
  onExplainRequest?: (prompt: string, selectedText: string) => Promise<string | null>;
  isProcessing: boolean;
  errorLine?: string | null;
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

// E1 — ChatGPT-Canvas-style shortcut actions surfaced directly in the toolbar
// (no dropdown hop). All rewrite shortcuts reuse the exact same quick-action +
// diff accept/reject pipeline as the dropdown actions; the prompts are written
// in English (instruction language) but explicitly pin the OUTPUT language to
// the selected text so they are bilingual-safe.
const SHORTCUT_CONDENSE_PROMPT =
  'Rewrite this text about 40% shorter. Keep every key fact and the meaning, preserve the markdown formatting and structure. Respond in the same language as the text.';

const SHORTCUT_EXPAND_PROMPT =
  'Expand this text with concrete, relevant detail in the same tone. Stay under roughly 2x the original length and do not invent facts. Preserve the markdown formatting. Respond in the same language as the text.';

const TONE_OPTIONS = [
  {
    id: 'tone_formal',
    labelEn: 'Formal',
    labelPl: 'Formalny',
    prompt:
      'Rewrite this text in a formal, consulting-grade tone: precise, structured, McKinsey-style clarity and rigor. Keep the meaning and the markdown formatting. Respond in the same language as the text.',
  },
  {
    id: 'tone_simple',
    labelEn: 'Simpler',
    labelPl: 'Prostszy',
    prompt:
      'Rewrite this text in plain, simple language: short sentences, everyday words, no jargon. Keep the meaning and the markdown formatting. Respond in the same language as the text.',
  },
] as const;

const EXPLAIN_PROMPT =
  'Do not rewrite or modify this text. Instead, return a brief explanation of it: what it means, the key terms, and the relevant context. Output only the explanation itself. Respond in the same language as the text.';

type ExplainState = { status: 'loading' } | { status: 'done'; text: string } | { status: 'error' };

export const CanvasAIFloatingMenu: React.FC<CanvasAIFloatingMenuProps> = ({
  editor,
  selection,
  onAIRequest,
  onExplainRequest,
  isProcessing,
  errorLine,
}) => {
  const { t } = useTranslation();
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  // E1 — tone flyout + explain popover state.
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [explainState, setExplainState] = useState<ExplainState | null>(null);
  const [requestErrorVisible, setRequestErrorVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Position the menu above the selection
  useEffect(() => {
    if (!selection || !editor) {
      setPosition(null);
      setShowPromptInput(false);
      setShowQuickActions(false);
      setShowToneMenu(false);
      setExplainState(null);
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

    // P1 — viewport-clamp. The menu is ~460px wide (E1 shortcut buttons) and
    // 48px tall; if the selection is near a viewport edge, the unclamped
    // position made it spill off-screen (especially on iPad / narrow laptop).
    // Clamp horizontally with margin and flip below the selection when the
    // top edge is too high.
    const MENU_HALF_W = 230; // approx half the toolbar width
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
      setShowToneMenu(false);
      setExplainState(null);
      setRequestErrorVisible(false);
      const replacement = await onAIRequest(prompt, selection.selectedText);
      setRequestErrorVisible(!replacement);
    },
    [selection, isProcessing, onAIRequest]
  );

  // E1 — "Wyjaśnij": read-only request, result rendered in a scrollable
  // popover above the toolbar (anchored to the selection like the rest of
  // the menu). Never touches the document — no diff, no accept/reject.
  const handleExplain = useCallback(async () => {
    if (!selection || isProcessing || !onExplainRequest) return;
    setShowPromptInput(false);
    setShowQuickActions(false);
    setShowToneMenu(false);
    setExplainState({ status: 'loading' });
    const text = await onExplainRequest(EXPLAIN_PROMPT, selection.selectedText);
    setExplainState(text ? { status: 'done', text } : { status: 'error' });
  }, [selection, isProcessing, onExplainRequest]);

  const handleCustomPrompt = useCallback(async () => {
    if (!selection || !customPrompt.trim() || isProcessing) return;
    setShowPromptInput(false);
    setRequestErrorVisible(false);
    const replacement = await onAIRequest(customPrompt.trim(), selection.selectedText);
    setRequestErrorVisible(!replacement);
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
      {requestErrorVisible && errorLine && (
        <p role="alert" className="mb-1 max-w-[460px] rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-lg dark:bg-red-950/80 dark:text-red-300">
          {errorLine}
        </p>
      )}
      {showPromptInput && (
        <div className="mb-1 flex items-center gap-1 rounded-lg border border-c-border dark:border-c-border bg-white dark:bg-navy-800 px-2 py-1 shadow-lg">
          <Sparkles size={14} className="text-c-text-secondary shrink-0" />
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
            placeholder={t(
              'canvas.aiMenu.promptPlaceholder',
              'What should Teresa do with this text?'
            )}
            className="w-64 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
          />
          <button
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim() || isProcessing}
            className="p-1 rounded text-c-text-secondary hover:bg-c-surface-hover dark:hover:bg-c-surface-hover disabled:opacity-40"
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
              {t(`canvas.aiMenu.quickAction.${action.id}`, action.labelEn)}
            </button>
          ))}
        </div>
      )}

      {/* E1 — Tone flyout (Zmień ton → Formalny / Prostszy) */}
      {showToneMenu && (
        <div className="mb-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 py-1 shadow-lg min-w-[140px]">
          {TONE_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleQuickAction(option.prompt)}
              disabled={isProcessing}
              className="w-full px-3 py-1.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40"
            >
              {t(`canvas.aiMenu.tone.${option.id}`, option.labelEn)}
            </button>
          ))}
        </div>
      )}

      {/* E1 — Explain popover: read-only AI answer, scrollable, never applied
          to the document. */}
      {explainState && (
        <div className="mb-1 w-80 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 shadow-lg">
          <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
            <HelpCircle size={13} className="text-c-text-secondary shrink-0" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex-1">
              {t('canvas.aiMenu.explanation', 'Explanation')}
            </span>
            <button
              onClick={() => setExplainState(null)}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              title={t('canvas.aiMenu.close', 'Close')}
            >
              <X size={12} />
            </button>
          </div>
          <div className="px-3 pb-2.5 max-h-56 overflow-y-auto">
            {explainState.status === 'loading' && (
              <div className="flex items-center gap-2 py-1 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 size={14} className="animate-spin text-c-text-secondary" />
                <span>{t('canvas.aiMenu.explaining', 'Teresa is explaining...')}</span>
              </div>
            )}
            {explainState.status === 'error' && (
              <p className="py-1 text-sm text-red-600 dark:text-red-400">
                {t('canvas.aiMenu.explainError', 'Could not get an explanation. Please try again.')}
              </p>
            )}
            {explainState.status === 'done' && (
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {explainState.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main toolbar */}
      <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 px-1 py-0.5 shadow-lg">
        <button
          onClick={() => {
            setShowPromptInput(!showPromptInput);
            setShowQuickActions(false);
            setShowToneMenu(false);
            setExplainState(null);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-sm font-medium text-c-text-secondary dark:text-c-text-secondary hover:bg-c-surface-hover dark:hover:bg-c-surface-hover transition-colors"
          title={t('canvas.aiMenu.askTeresaTitle', 'Ask Teresa')}
        >
          <Sparkles size={14} />
          <span>{t('canvas.aiMenu.askTeresa', 'Ask AI')}</span>
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
        {/* E1 — shortcut actions (ChatGPT-Canvas pattern). Rewrites go through
            the same diff accept/reject pipeline as the dropdown actions. */}
        <button
          onClick={() => handleQuickAction(SHORTCUT_CONDENSE_PROMPT)}
          disabled={isProcessing}
          className="flex items-center gap-1 px-1.5 py-1 rounded text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40"
          title={t('canvas.aiMenu.condenseTitle', 'Condense selection ~40%')}
        >
          <Minimize2 size={13} />
          <span>{t('canvas.aiMenu.condense', 'Condense')}</span>
        </button>
        <button
          onClick={() => handleQuickAction(SHORTCUT_EXPAND_PROMPT)}
          disabled={isProcessing}
          className="flex items-center gap-1 px-1.5 py-1 rounded text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40"
          title={t('canvas.aiMenu.expandTitle', 'Expand selection (max 2x)')}
        >
          <Maximize2 size={13} />
          <span>{t('canvas.aiMenu.expand', 'Expand')}</span>
        </button>
        <button
          onClick={() => {
            setShowToneMenu(!showToneMenu);
            setShowPromptInput(false);
            setShowQuickActions(false);
            setExplainState(null);
          }}
          disabled={isProcessing}
          className="flex items-center gap-1 px-1.5 py-1 rounded text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40"
          title={t('canvas.aiMenu.changeToneTitle', 'Change tone')}
        >
          <SlidersHorizontal size={13} />
          <span>{t('canvas.aiMenu.tone.label', 'Tone')}</span>
          <ChevronDown size={12} />
        </button>
        {onExplainRequest && (
          <button
            onClick={handleExplain}
            disabled={isProcessing}
            className="flex items-center gap-1 px-1.5 py-1 rounded text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40"
            title={t(
              'canvas.aiMenu.explainTitle',
              'Explain selection (does not modify the document)'
            )}
          >
            {explainState?.status === 'loading' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <HelpCircle size={13} />
            )}
            <span>{t('canvas.aiMenu.explain', 'Explain')}</span>
          </button>
        )}
        <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
        <button
          onClick={() => {
            setShowQuickActions(!showQuickActions);
            setShowPromptInput(false);
            setShowToneMenu(false);
            setExplainState(null);
          }}
          className="flex items-center gap-0.5 px-1.5 py-1 rounded text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          title={t('canvas.aiMenu.quickActionsTitle', 'Quick actions')}
        >
          <span>{t('canvas.aiMenu.actions', 'Actions')}</span>
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
  /** @deprecated language is now resolved via i18n; prop kept for call-site compat */
  isPolish?: boolean;
}

export const AIAcceptRejectBar: React.FC<AIAcceptRejectBarProps> = ({ onAccept, onReject }) => {
  const { t } = useTranslation();
  return (
    <div className="sticky bottom-4 flex justify-center z-50 pointer-events-none">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 px-3 py-1.5 shadow-lg pointer-events-auto">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t('canvas.aiMenu.teresaSuggestion', 'Teresa suggestion')}
        </span>
        <button
          onClick={onAccept}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
        >
          <Check size={12} />
          {t('canvas.aiMenu.accept', 'Accept')}
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          <X size={12} />
          {t('canvas.aiMenu.reject', 'Reject')}
        </button>
      </div>
    </div>
  );
};
