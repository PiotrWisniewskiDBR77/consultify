import { Check, Copy, MoreVertical, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { KEBAB_BACKDROP, KEBAB_ITEM, PREVIEW_HINT_CHIP } from './previewStyles';

export interface PreviewAIHintStripProps {
  hints: string[];
  loading?: boolean;
  /** Plain text result from AI (displayed below chips) */
  result?: string | null;
  error?: string | null;
  /** Called when a hint chip is clicked; receives the hint label */
  onRunHint: (hint: string) => void;
  onRegenerate?: () => void;
  onCopy?: () => void;
  onClear?: () => void;
  /** Optional "apply" button shown next to kebab when result is present */
  applyButton?: { label: string; onClick: () => void };
  /** Disable all hint chips (e.g. session not completed) */
  disabled?: boolean;
  disabledTooltip?: string;
}

export const PreviewAIHintStrip: React.FC<PreviewAIHintStripProps> = ({
  hints,
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
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [menuOpen, setMenuOpen] = useState(false);

  const hasKebab = onRegenerate || onCopy || onClear;

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard
      .writeText(result)
      .then(() => toast.success(isPolish ? 'Skopiowano' : 'Copied'))
      .catch(() => toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed'));
  };

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
          <Sparkles size={12} />
          <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
        </div>

        <div className="relative flex items-center gap-1">
          {applyButton && result ? (
            <button
              onClick={applyButton.onClick}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium border border-purple-400/30 dark:border-purple-500/20 bg-transparent text-purple-600 dark:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-500/10 transition-colors"
            >
              <Check size={11} />
              {applyButton.label}
            </button>
          ) : null}

          {hasKebab ? (
            <>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/[0.06] transition-colors"
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
                        <Sparkles size={12} className="text-purple-500" />
                        {isPolish ? 'Regeneruj' : 'Regenerate'}
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
                        {isPolish ? 'Kopiuj' : 'Copy'}
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
                        {isPolish ? 'Wyczyść' : 'Clear'}
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
        {hints.map((hint, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (disabled && disabledTooltip) {
                toast(disabledTooltip, { duration: 2500 });
                return;
              }
              onRunHint(hint);
            }}
            disabled={loading}
            className={`${PREVIEW_HINT_CHIP}${disabled ? ' opacity-50' : ''}`}
          >
            <Sparkles size={10} className="text-purple-400/70 dark:text-purple-500/70" />
            {hint}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</div>
      ) : result ? (
        <div className="mt-2 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
          {result}
        </div>
      ) : null}
    </div>
  );
};

export default PreviewAIHintStrip;
