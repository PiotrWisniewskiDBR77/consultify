import { Check, Copy, MessageCircle, MoreVertical, Send, Sparkles, X, Zap } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { KEBAB_BACKDROP, KEBAB_ITEM, PREVIEW_HINT_CHIP } from './previewStyles';

export interface PreviewAIHintStripProps {
  hints: string[];
  /** Context-aware hints generated dynamically by the backend (rendered first with a Zap icon) */
  dynamicHints?: string[];
  loading?: boolean;
  /** Plain text result from AI (displayed below chips) */
  result?: string | null;
  error?: string | null;
  /** Called when a hint chip is clicked; receives the hint label */
  onRunHint?: (hint: string) => void;
  onRegenerate?: () => void;
  onCopy?: () => void;
  onClear?: () => void;
  /** Optional "apply" button shown next to kebab when result is present */
  applyButton?: { label: string; onClick: () => void };
  /** Disable all hint chips (e.g. session not completed) */
  disabled?: boolean;
  disabledTooltip?: string;
  /** Enable inline "Ask about this..." input below hint chips */
  inlineChat?: boolean;
  /** Called when user submits a free-form question via inline chat */
  onAskQuestion?: (question: string) => void;
  /** Response to the inline chat question */
  chatAnswer?: string | null;
  chatLoading?: boolean;
}

export const PreviewAIHintStrip: React.FC<PreviewAIHintStripProps> = ({
  hints,
  dynamicHints,
  loading,
  result,
  error,
  onRunHint,
  onRegenerate,
  onCopy,
  onClear,
  applyButton,
  disabled,
  disabledTooltip,
  inlineChat,
  onAskQuestion,
  chatAnswer,
  chatLoading,
}) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const handleChatSubmit = useCallback(() => {
    const q = chatInput.trim();
    if (!q || !onAskQuestion) return;
    onAskQuestion(q);
    setChatInput('');
  }, [chatInput, onAskQuestion]);

  const hasKebab = onRegenerate || onCopy || onClear;

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard
      .writeText(result)
      .then(() => toast.success(t('sharedComponents.previewAIHintStrip.copied')))
      .catch(() => toast.error(t('sharedComponents.previewAIHintStrip.copyFailed')));
  };

  return (
    /**
     * RAMKA BLOKU 4 MIESZKA TUTAJ — jeden raz w całej aplikacji.
     *
     * ── CO BYŁO ZMIERZONE (dyżur rodziny podglądu, 2026-09-01) ───────────────
     * Kanon (`TABLE_AND_PREVIEW_CANON.md` §7.0/§7.3 pkt 4.1) mówi, że blok AI to
     * RAMKA z chipami — opcjonalna karta stopki. Ale sama ramka nie mieszkała
     * nigdzie: każdy z 14 wołaczy doklejał ją sobie sam w `<div>` opakowującym.
     * Po policzeniu wyszły CZTERY różne ramki i dwa ekrany bez ramki w ogóle:
     *
     *   · kanon      `rounded-xl border-c-border-subtle bg-c-surface-raised p-2.5`
     *                — StandardPreview, DecisionPreviewPanel, InitiativePreviewV3
     *   · inne tło   `… bg-slate-50/60 dark:bg-white/[0.03] …`  — MyTasksListContent
     *   · inny token `rounded-token-md border-[var(--c-border-subtle)] …`
     *                — pięć podglądów Wywiadu
     *   · surowy slate `border-slate-200/70 dark:border-white/[0.08] …`
     *                — FinancePreviewPanel, ToolSessionPreviewV3,
     *                  KnownToolPreviewV3 (ten dodatkowo `p-2`, nie `p-2.5`)
     *   · BRAK RAMKI — IdeasTableContent, MyIdeasListContent
     *
     * To jest dokładnie to, co właściciel zobaczył na ekranie porównawczym:
     * „pokazuje, jak nieporównywalne są podglądy, które powinny być takie same"
     * (30.08) i zgłosił drugi raz na `idea-table` (01.09). Poprzednia naprawa
     * poszła do PRZYRZĄDU (`preview-4-zakladki` przepięty na `StandardPreview`),
     * a nie do produktu — `IdeasTableContent` dalej składał blok ręcznie.
     *
     * Zasada właściciela (`KANON_Z_ODBIOROW.md`): **sekcja mieszka w jednym
     * miejscu w całej aplikacji.** Ramka jest częścią bloku, nie częścią ekranu,
     * więc jej miejsce jest tu. Wołacze NIE opakowują — opakowanie u wołacza
     * daje podwójną ramkę.
     */
    <div
      data-preview-block="ai"
      className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <Sparkles size={12} />
          <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
        </div>

        <div className="relative flex items-center gap-1">
          {applyButton && result ? (
            <button
              onClick={applyButton.onClick}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium border border-c-info/30 dark:border-c-info/20 bg-transparent text-c-info hover:bg-[color-mix(in_srgb,var(--c-info)_8%,transparent)] transition-colors"
            >
              <Check size={11} />
              {applyButton.label}
            </button>
          ) : null}

          {hasKebab ? (
            <>
              {/* aria-label: trigger ikony bez widocznego tekstu (axe: button-name,
                  zmierzone na tools-outputs-insights-tab po otwarciu podglądu). */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={t('common.moreOptions', 'More options')}
                className="p-1 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/[0.06] transition-colors"
              >
                <MoreVertical size={13} />
              </button>
              {menuOpen ? (
                <>
                  <div className={KEBAB_BACKDROP} onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 bottom-full mb-1 z-50 min-w-[170px] rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden">
                    {onRegenerate ? (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onRegenerate();
                        }}
                        className={KEBAB_ITEM}
                      >
                        <Sparkles size={12} className="text-c-info" />
                        {t('sharedComponents.previewAIHintStrip.regenerate')}
                      </button>
                    ) : null}
                    {onCopy ? (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onCopy();
                        }}
                        disabled={!result}
                        className={`${KEBAB_ITEM}${!result ? ' opacity-40' : ''}`}
                      >
                        <Copy size={12} />
                        {t('sharedComponents.previewAIHintStrip.copy')}
                      </button>
                    ) : null}
                    {onClear ? (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onClear();
                        }}
                        disabled={!result}
                        className={`${KEBAB_ITEM}${!result ? ' opacity-40' : ''}`}
                      >
                        <X size={12} />
                        {t('sharedComponents.previewAIHintStrip.clear')}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(dynamicHints ?? []).map((hint, idx) => (
          <button
            key={`dyn-${idx}`}
            onClick={() => {
              if (disabled && disabledTooltip) {
                toast(disabledTooltip, { duration: 2500 });
                return;
              }
              onRunHint?.(hint);
            }}
            disabled={loading}
            // `opacity-50` na `PREVIEW_HINT_CHIP` (text-slate-600 dark:text-slate-300,
            // sam w sobie zgodny) rozmywał tekst poniżej 4,5:1 (axe: color-contrast,
            // zmierzone na interview-sessions-status po otwarciu podglądu — 2.29:1
            // light / 3.74:1 dark) — przycisk zostaje w pełni klikalny (disabled
            // wiąże się z `loading`, nie z tym stanem, pokazuje toast), więc axe
            // NIE traktuje go jak wyłączony. cursor-not-allowed niesie ten sam sygnał
            // bez zjadania kontrastu tekstu.
            className={`${PREVIEW_HINT_CHIP} border-c-info/30 dark:border-c-info/20${disabled ? ' cursor-not-allowed' : ''}`}
          >
            <Zap size={10} className="text-c-info" />
            {hint}
          </button>
        ))}
        {hints.map((hint, idx) => (
          <button
            key={`static-${idx}`}
            onClick={() => {
              if (disabled && disabledTooltip) {
                toast(disabledTooltip, { duration: 2500 });
                return;
              }
              onRunHint?.(hint);
            }}
            disabled={loading}
            className={`${PREVIEW_HINT_CHIP}${disabled ? ' cursor-not-allowed' : ''}`}
          >
            <Sparkles size={10} className="text-c-info/70" />
            {hint}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-2 text-xs text-danger-600 dark:text-danger-400">{error}</div>
      ) : result ? (
        <div className="mt-2 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
          {result}
        </div>
      ) : null}

      {chatAnswer ? (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-200">
          <MessageCircle size={11} className="text-c-info shrink-0 mt-0.5" />
          <span className="whitespace-pre-wrap">{chatAnswer}</span>
        </div>
      ) : null}

      {inlineChat && onAskQuestion ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleChatSubmit();
              }
            }}
            placeholder={t('sharedComponents.previewAIHintStrip.askPlaceholder')}
            disabled={chatLoading}
            className="flex-1 h-7 px-2.5 rounded-lg border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-c-focus/40"
          />
          <button
            onClick={handleChatSubmit}
            disabled={!chatInput.trim() || chatLoading}
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-c-info hover:bg-[color-mix(in_srgb,var(--c-info)_8%,transparent)] transition-colors disabled:opacity-40"
          >
            {chatLoading ? (
              <span className="h-3 w-3 rounded-full border-2 border-c-info border-t-transparent animate-spin" />
            ) : (
              <Send size={12} />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default PreviewAIHintStrip;
