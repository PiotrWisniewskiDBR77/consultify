/**
 * ChatLandingLightShell — lightweight, minimal redesign of the /chat landing
 * screen (companion to `FinanceLightShell` / `DRDLightShell` — same doctrine,
 * same "NEW component, old surface untouched" posture).
 *
 * Context (owner note #1 / #86, 2026-07-11): the current chat landing inside
 * `UnifiedChatPanel.tsx` reads as a visual regression versus the benchmark —
 * OpenAI/Gemini/Grok-style start screens are clean, centered, minimal, with
 * the input as the clear focal point. This component is that benchmark
 * applied to Teresa: one wordmark line, one calm greeting, one big input,
 * a handful of suggested starts, a quiet footer. Nothing else.
 *
 * DOCTRINE NOTE (docs/ui-standards/DOKTRYNA_GESTOSCI.md): the density
 * doctrine's "no hero on a working screen" rule (§2) explicitly does NOT
 * apply here — a chat *landing* screen is the one place breathing room is
 * correct: it exists to focus attention on a single input, not to display
 * dense data. Once the user sends a first message, the surface hands off to
 * the real (dense) conversation view — this shell renders the empty state
 * only.
 *
 * COLOR DOCTRINE (hard, identical to DRDLightShell/FinanceLightShell):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics only —
 *     NOT used here. The one accent is the blue focus token
 *     (`--c-focus-solid`) on the input's focus ring and the send button.
 *   - All colors via c-* tokens, never raw hex — both themes adapt.
 *   - Zero decorative stars/sparkle glyphs (owner rule: no "gwiazdki").
 *     Suggestion icons are meaningful lucide glyphs tied to what the
 *     suggestion actually does (diagnosis / initiative / finance / document),
 *     not ornamentation.
 *
 * This component is presentational only (props in, JSX out) — no store, no
 * API calls, no context, no real streaming. `onSend` / `onSuggestionClick`
 * are caller-supplied callbacks; the dev-render harness
 * (`dev-render/screens/chat-landing.tsx`) wires them to no-ops + local state
 * so the harness can show a submitted query without a backend.
 */
import {
  ArrowUp,
  BarChart3,
  FileText,
  LineChart,
  Target,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type ChatLandingSuggestionIcon = 'diagnose' | 'initiative' | 'finance' | 'document';

export interface ChatLandingSuggestionLite {
  id: string;
  label: string;
  /** Full prompt sent to chat when the chip is clicked (may differ from the shorter label). */
  prompt: string;
  icon?: ChatLandingSuggestionIcon;
}

interface ChatLandingLightShellProps {
  /** First name only, e.g. "Piotr" — used in the greeting line. */
  userName?: string;
  /** Overrides the default greeting copy entirely, if the caller wants a custom line. */
  greeting?: string;
  suggestions?: ChatLandingSuggestionLite[];
  placeholder?: string;
  footerNote?: string;
  onSend?: (text: string) => void;
  onSuggestionClick?: (suggestion: ChatLandingSuggestionLite) => void;
}

const SUGGESTION_ICON: Record<ChatLandingSuggestionIcon, React.ReactNode> = {
  diagnose: <Target className="h-[15px] w-[15px]" />,
  initiative: <BarChart3 className="h-[15px] w-[15px]" />,
  finance: <LineChart className="h-[15px] w-[15px]" />,
  document: <FileText className="h-[15px] w-[15px]" />,
};

const DEFAULT_SUGGESTIONS: ChatLandingSuggestionLite[] = [
  {
    id: 'diagnose-drd',
    label: 'Zdiagnozuj firmę DRD',
    prompt: 'Zdiagnozuj gotowość cyfrową firmy DRD — przeprowadź mnie przez 7 osi metody Digital Pathfinder.',
    icon: 'diagnose',
  },
  {
    id: 'build-initiative',
    label: 'Zbuduj inicjatywę',
    prompt: 'Zbuduj nową inicjatywę na bazie ostatniej diagnozy — cel, zakres, kamienie milowe.',
    icon: 'initiative',
  },
  {
    id: 'analyze-finance',
    label: 'Przeanalizuj finanse',
    prompt: 'Przeanalizuj sprawozdania finansowe firmy i wskaż 3 najważniejsze wnioski.',
    icon: 'finance',
  },
  {
    id: 'draft-report',
    label: 'Przygotuj raport',
    prompt: 'Przygotuj szkic raportu z postępu programu na spotkanie z zarządem.',
    icon: 'document',
  },
];

export const ChatLandingLightShell: React.FC<ChatLandingLightShellProps> = ({
  userName,
  greeting,
  suggestions = DEFAULT_SUGGESTIONS,
  placeholder,
  footerNote,
  onSend,
  onSuggestionClick,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [value, setValue] = useState('');

  const defaultGreeting = userName
    ? t(`Dzień dobry, ${userName}`, `Good morning, ${userName}`)
    : t('Cześć, jestem Teresa', "Hi, I'm Teresa");

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(value);
    }
  };

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── centered focus column ─── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-[640px]">
          {/* Wordmark + greeting — quiet, one line, no hero copy block */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-c-border bg-c-surface">
              <span className="text-[15px] font-semibold tracking-tight text-c-text-secondary">T</span>
            </div>
            <h1 className="m-0 text-[26px] font-semibold tracking-tight text-c-text">
              {greeting || defaultGreeting}
            </h1>
            <p className="mt-1.5 text-[14px] text-c-text-muted">
              {t('W czym mogę dziś pomóc?', 'What can I help with today?')}
            </p>
          </div>

          {/* Input — the single focal element on the screen */}
          <div className="rounded-2xl border border-c-border bg-c-surface shadow-sm transition-colors focus-within:border-c-focus">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                placeholder || t('Napisz do Teresy…', 'Message Teresa…')
              }
              className="max-h-[160px] w-full resize-none bg-transparent px-4 pb-1 pt-4 text-[14.5px] leading-relaxed text-c-text placeholder:text-c-text-muted focus:outline-none"
            />
            <div className="flex items-center justify-end px-3 pb-3 pt-1">
              <button
                type="button"
                onClick={() => submit(value)}
                disabled={!value.trim()}
                aria-label={t('Wyślij', 'Send')}
                className="grid h-8 w-8 place-items-center rounded-full bg-c-text text-c-surface transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Suggested starts — one row of chips, not a list, not a grid of cards */}
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSuggestionClick?.(s);
                    onSend?.(s.prompt);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-c-border bg-c-surface px-3 py-1.5 text-[12.5px] font-medium text-c-text-secondary transition-colors hover:border-c-border-strong hover:bg-c-surface-raised"
                >
                  {s.icon && <span className="text-c-text-muted">{SUGGESTION_ICON[s.icon]}</span>}
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── discreet footer ─── */}
      <div className="px-6 pb-5 text-center text-[11.5px] text-c-text-muted">
        {footerNote ||
          t(
            'Teresa opiera się na metodzie i danych Twojej organizacji — sprawdzaj kluczowe liczby przed decyzją.',
            "Teresa relies on your organization's method and data — verify key figures before deciding."
          )}
      </div>
    </div>
  );
};

export default ChatLandingLightShell;
