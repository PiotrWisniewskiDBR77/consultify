/**
 * AIFieldEnhancer
 *
 * Shared AI-powered text enhancement dropdown for any text field.
 * Provides: Generate, Improve, Shorten, Expand, Formal tone + Undo.
 *
 * Used in N-mode artifact detail views (Decision, Task, etc.)
 * for all textarea / text input fields that support AI editing.
 *
 * ── Standard n-Type (2026-07-23) ─────────────────────────────────────────────
 * SSOT: Harvard/wdrozenie-100/_STANDARD_N_TYPE_2026-07-23/00_STANDARD_N_TYPE.md
 * §4.5/§4.6/§6.4 + 01_DECYZJA_BLEDY_I_ZMIANY §5.2. Dwie reguły wiążące ten plik:
 *
 *  1. KOLOR AI = FIOLET, token `c-ai` (§4.6). Był `teal-*`, czyli surowa
 *     paleta Tailwind kolidująca z tokenami stanu — teal niesie w tym systemie
 *     „gotowe/ok". Token `c-ai` jest jeden dla całego produktu (nagłówek,
 *     „Analizuj z AI", ikony przy polach, panel sugestii).
 *  2. AI NIE NADPISUJE TREŚCI BEZ AKCEPTACJI (§4.5 ostatni punkt, §6.4).
 *     Wynik ląduje najpierw w PROPOZYCJI z akcjami Zastosuj / Odrzuć —
 *     dotąd `onApply` szło prosto w pole i jedynym ratunkiem było „Undo AI"
 *     schowane w menu (a po zamknięciu menu — nic).
 *
 * @example
 * <AIFieldEnhancer
 *   fieldKey="description"
 *   sectionLabel="Task Description"
 *   currentValue={description}
 *   onApply={setDescription}
 *   artifactContext={{ title, status, priority, type: 'task' }}
 * />
 */

import { Loader2, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { generujTrescPola, jezykAIzUI } from '@/services/ai/generujTrescPola';
import { Api } from '@/services/api';

// ── Types ────────────────────────────────────────────────────────────────────

export type AIEnhanceMode = 'improve' | 'shorten' | 'expand' | 'formal' | 'generate';

export type AIEnhancerOutputFormat = 'paragraph' | 'short' | 'list';

interface ArtifactContext {
  /** Artifact title for prompt context */
  title?: string;
  /** Current status */
  status?: string;
  /** Current priority */
  priority?: string;
  /** Artifact type label (e.g. 'task', 'decision') */
  type: string;
}

interface AIFieldEnhancerProps {
  /** Unique key identifying this field (used for loading/undo state) */
  fieldKey: string;
  /** Human-readable section label (sent to AI for context) */
  sectionLabel: string;
  /** Current field value */
  currentValue: string;
  /** Callback to apply the AI-enhanced value */
  onApply: (value: string) => void;
  /** Artifact context for AI prompt */
  artifactContext: ArtifactContext;
  /** Whether the enhancer is disabled (e.g. decision stage locked) */
  disabled?: boolean;
  /** Custom disabled tooltip */
  disabledTooltip?: string;
  /** Render as icon-only trigger (no "AI" label) */
  iconOnly?: boolean;
  /**
   * Output format hint for the AI.
   * - paragraph: 2–4 sentences (default)
   * - short: a single concise line (good for list items / table cells)
   * - list: multiple items, one per line (good for checklist-like lists)
   */
  outputFormat?: AIEnhancerOutputFormat;
}

// ── Awaria AI = komunikat, NIE podmieniona treść (2026-07-23) ────────────────
//
// USUNIĘTO `fallbackRefineText`. Ta funkcja podawała użytkownikowi JAKO
// PROPOZYCJĘ AI treść wyprodukowaną lokalnie: „skróć" ucinało zdanie na 65%
// długości i doklejało „...", „rozwiń" doklejało zawsze ten sam akapit,
// „formalnie" doklejało angielskie „It is hereby noted that…" w polskim UI.
// Komponent jest współdzielony przez ~12 kart, więc atrapa wyciekała wszędzie.
//
// Reguła obowiązująca ten plik: „AI niedostępne" jest poprawnym wynikiem.
// Zmyślona odpowiedź podana jako propozycja AI nim nie jest. Gdy
// `/ai/refine-text` zawiedzie — pokazujemy POWÓD z backendu, a treść pola
// zostaje BIT W BIT nietknięta (żadna gałąź nie woła `onApply`).

type AiError = Error & {
  code?: string;
  status?: number;
  data?: { code?: string; error?: string };
};

/** Kod błędu z odpowiedzi backendu (`err.data.code`) albo z błędu lokalnego. */
function aiErrorCode(err: unknown): string {
  return String((err as AiError)?.data?.code || (err as AiError)?.code || '').toUpperCase();
}

/** Błąd „AI odpowiedziało, ale pusto" — traktowany jak każda inna awaria AI. */
function emptyAiResponseError(): AiError {
  const err = new Error('Empty AI response') as AiError;
  err.code = 'EMPTY_AI_RESPONSE';
  return err;
}

// ── Menu items configuration ─────────────────────────────────────────────────

const MENU_ITEMS: { mode: AIEnhanceMode; labelKey: string }[] = [
  { mode: 'generate', labelKey: 'sharedComponents.aiFieldEnhancer.menuGenerate' },
  { mode: 'improve', labelKey: 'sharedComponents.aiFieldEnhancer.menuImprove' },
  { mode: 'shorten', labelKey: 'sharedComponents.aiFieldEnhancer.menuShorten' },
  { mode: 'expand', labelKey: 'sharedComponents.aiFieldEnhancer.menuExpand' },
  { mode: 'formal', labelKey: 'sharedComponents.aiFieldEnhancer.menuFormal' },
];

// ── Component ────────────────────────────────────────────────────────────────

export const AIFieldEnhancer: React.FC<AIFieldEnhancerProps> = ({
  fieldKey,
  sectionLabel,
  currentValue,
  onApply,
  artifactContext,
  disabled = false,
  disabledTooltip,
  iconOnly = false,
  outputFormat = 'paragraph',
}) => {
  const { t, i18n } = useTranslation();
  // DEC-407 uzupełnienie (2026-09-06): język wyjścia AI = język UI, nie stały
  // angielski. Do 2026-09-06 ten komponent wymuszał English niezależnie od
  // `i18n.language` — propozycja w polskim UI wracała po angielsku (K2, zrzut
  // `09-propozycja-do-zatwierdzenia.png`). `jezykAIzUI` czyta aktualny
  // `i18n.language`; dla anglojęzycznego UI zachowanie jest identyczne jak wcześniej.
  const { kod: aiLanguage, nazwa: targetLanguageName } = jezykAIzUI(i18n.language);

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [undoValue, setUndoValue] = useState<string | undefined>(undefined);
  /**
   * §4.5/§6.4: wynik AI czeka TU na decyzję użytkownika. Dopóki jest ustawiony,
   * pole trzyma swoją treść — akceptacja jest warunkiem nadpisania, nie
   * czynnością naprawczą po fakcie.
   */
  const [proposal, setProposal] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside. Propozycja NIE znika od kliknięcia obok —
  // przypadkowe kliknięcie w tle nie może cicho odrzucić wyniku AI, o który
  // użytkownik poprosił (odrzucenie jest jawną akcją w panelu propozycji).
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  /** Powód awarii AI po polsku — z kodu backendu, a jak brak, to z komunikatu. */
  const aiFailureReason = useCallback(
    (err: unknown): string => {
      switch (aiErrorCode(err)) {
        case 'NO_LLM_PROVIDER':
          return t(
            'sharedComponents.aiFieldEnhancer.errNoProvider',
            'nie skonfigurowano dostawcy AI'
          );
        case 'AI_BUDGET_EXHAUSTED':
          return t('sharedComponents.aiFieldEnhancer.errBudget', 'wyczerpany budżet AI');
        case 'ACCESS_BLOCKED':
          return t(
            'sharedComponents.aiFieldEnhancer.errAccessBlocked',
            'dostęp do AI jest zablokowany dla tej organizacji'
          );
        case 'EMPTY_LLM_RESPONSE':
        case 'EMPTY_AI_RESPONSE':
          return t('sharedComponents.aiFieldEnhancer.errEmpty', 'AI zwróciło pustą odpowiedź');
        case 'LLM_CALL_FAILED':
          return t(
            'sharedComponents.aiFieldEnhancer.errCallFailed',
            'wywołanie AI nie powiodło się'
          );
        default:
          return (
            String((err as Error)?.message || '').trim() ||
            t('sharedComponents.aiFieldEnhancer.errUnavailable', 'AI jest chwilowo niedostępne')
          );
      }
    },
    [t]
  );

  /**
   * Jedyna dozwolona reakcja na brak odpowiedzi AI: powiedz CO się nie udało
   * i DLACZEGO. Żadna gałąź awaryjna nie podmienia treści pola.
   */
  const notifyAiFailure = useCallback(
    (whatFailed: string, err: unknown) => {
      console.error('[AIFieldEnhancer] AI request failed:', whatFailed, err);
      toast.error(
        t('sharedComponents.aiFieldEnhancer.failedWithReason', '{{what}} — {{reason}}.', {
          what: whatFailed,
          reason: aiFailureReason(err),
        })
      );
    },
    [t, aiFailureReason]
  );

  // Prompt i wywołanie `/ai/refine-text` (tryb `generate`) mieszkały do
  // 2026-09-06 W TYM MIEJSCU i były osiągalne wyłącznie stąd. DEC-407 (poziom
  // karty „Pracuj z AI") potrzebuje tego samego generatora, więc kod przeniósł
  // się bit w bit do `src/services/ai/generujTrescPola.ts`. Zachowanie tego
  // przycisku jest identyczne: wynik ląduje w PROPOZYCJI, nie w polu (§4.5).
  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setIsOpen(false);

    try {
      const generatedText = await generujTrescPola({
        etykietaPola: sectionLabel,
        kontekstArtefaktu: artifactContext,
        format: outputFormat,
        language: aiLanguage,
      });

      // §4.5: propozycja, nie nadpisanie — pole zmieni się dopiero po „Zastosuj".
      setProposal(generatedText);
    } catch (err) {
      // Pole zostaje puste/nietknięte — nie podstawiamy żadnej treści zastępczej.
      notifyAiFailure(t('sharedComponents.aiFieldEnhancer.generateError'), err);
    } finally {
      setLoading(false);
    }
  }, [t, notifyAiFailure, sectionLabel, artifactContext, outputFormat, aiLanguage]);

  const handleEnhance = useCallback(
    async (mode: AIEnhanceMode) => {
      // For generate mode or when field is empty, use generate flow
      if (mode === 'generate' || !currentValue.trim()) {
        return handleGenerate();
      }

      setLoading(true);
      setIsOpen(false);

      try {
        const formatRules =
          outputFormat === 'list'
            ? [
                `Formatting requirements:`,
                `- Keep ONE item per line`,
                `- Do NOT add bullets/numbering/markdown`,
                `- Do NOT change the number of lines/items`,
                `- Do NOT add empty lines`,
              ].join('\n')
            : outputFormat === 'short'
              ? [
                  `Formatting requirements:`,
                  `- Return ONE concise line (max ~12–16 words)`,
                  `- No prefixes, no quotes, no markdown`,
                ].join('\n')
              : `Keep a professional paragraph form.`;

        // Instrukcje dla modelu są po angielsku (prompt engineering), ale
        // WYNIK ma wyjść w języku UI — `targetLanguageName`/`aiLanguage`
        // wyżej (DEC-407 uzupełnienie).
        const instructionByMode: Record<string, string> = {
          improve: [
            `Improve the text (keep the meaning) by:`,
            `- fixing typos, spelling, grammar, punctuation`,
            `- making it clearer and more decision-oriented`,
            `- using a professional PMO tone`,
            `- removing filler and ambiguity where possible`,
          ].join('\n'),
          shorten:
            outputFormat === 'list'
              ? 'Shorten each item by ~20–30% while preserving meaning (keep one item per line).'
              : outputFormat === 'short'
                ? 'Shorten the line while preserving meaning (still one line).'
                : 'Shorten the text by ~30–40% while preserving decision-relevant information.',
          expand:
            outputFormat === 'list'
              ? 'Make each item more specific and action-oriented without adding new items (keep one item per line).'
              : outputFormat === 'short'
                ? 'Make the line slightly more specific/actionable without making it long (still one line).'
                : 'Expand the text with useful context, risks, dependencies, and business implications. Do NOT add generic filler.',
          formal:
            outputFormat === 'list'
              ? 'Rewrite each item in a more formal, executive tone (keep one item per line).'
              : outputFormat === 'short'
                ? 'Rewrite the line in a more formal, executive tone (still one line).'
                : 'Rewrite in a more formal, executive tone suitable for a steering committee.',
        };

        const systemInstruction = [
          `You are a professional PMO content editor.`,
          `Your job is to refine the user's text for the field "${sectionLabel}".`,
          `Rules:`,
          `- Output language MUST be ${targetLanguageName}. If the input/context is in another language, translate as needed.`,
          `- Return ONLY the refined text. No commentary, no explanations, no quotes, no prefixes, no markdown.`,
          `- Do NOT invent new facts, numbers, dates, systems, or KPI values. If something is unknown, keep it generic.`,
          formatRules,
          ``,
          `Mode "${mode}" instructions:`,
          instructionByMode[mode] || '',
        ].join('\n');

        // Błąd transportu NIE jest tu połykany — powód z backendu musi dojść
        // do użytkownika (kiedyś `catch { refinedText = '' }` gubił kod błędu,
        // a pusty wynik uruchamiał lokalną atrapę `fallbackRefineText`).
        const aiRes = await Api.post('/ai/refine-text', {
          text: currentValue,
          mode,
          systemInstruction,
          fieldLabel: sectionLabel,
          artifactContext,
          language: aiLanguage,
        });
        const refinedText = String(aiRes?.text || '').trim();

        if (!refinedText) {
          throw emptyAiResponseError();
        }

        // §4.5: propozycja, nie nadpisanie — pole zmieni się po „Zastosuj".
        setProposal(refinedText);
      } catch (err) {
        // Treść pola zostaje BIT W BIT taka, jak ją zostawił użytkownik.
        notifyAiFailure(t('sharedComponents.aiFieldEnhancer.enhanceError'), err);
      } finally {
        setLoading(false);
      }
    },
    [
      currentValue,
      t,
      notifyAiFailure,
      sectionLabel,
      artifactContext,
      handleGenerate,
      outputFormat,
      targetLanguageName,
      aiLanguage,
    ]
  );

  /** Akceptacja propozycji — dopiero tu treść pola zostaje nadpisana. */
  const handleAcceptProposal = useCallback(() => {
    if (proposal === null) return;
    setUndoValue(currentValue);
    onApply(proposal);
    setProposal(null);
    toast.success(t('sharedComponents.aiFieldEnhancer.enhanceSuccess'));
  }, [proposal, currentValue, onApply, t]);

  const handleDiscardProposal = useCallback(() => {
    setProposal(null);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoValue !== undefined) {
      onApply(undoValue);
      setUndoValue(undefined);
      setIsOpen(false);
      toast.success(t('sharedComponents.aiFieldEnhancer.undoSuccess'));
    }
  }, [undoValue, onApply, t]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Wyzwalacz AI — JEDEN rozmiar i JEDEN kolor (`c-ai`) we wszystkich polach
          wszystkich kart N (§4.6). Nigdy crimson, nigdy barwa statusu. */}
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen((prev) => !prev)}
        disabled={disabled || loading}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-c-ai hover:bg-c-ai/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
        title={disabledTooltip || t('sharedComponents.aiFieldEnhancer.triggerTitle')}
        aria-label="AI"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {!iconOnly && 'AI'}
      </button>

      {/* Menu operacji — wspólne dla wszystkich pól (§6.4). */}
      {isOpen && !disabled && !loading && proposal === null && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-44 rounded-lg border border-c-border-subtle bg-c-surface/95 backdrop-blur p-1 shadow-xl">
          {MENU_ITEMS.map(({ mode, labelKey }) => {
            const isGenerate = mode === 'generate';
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleEnhance(mode)}
                className={
                  isGenerate
                    ? 'w-full text-left px-2.5 py-1.5 text-xs text-c-ai hover:bg-c-ai/10 rounded-md transition-colors font-medium flex items-center gap-1.5'
                    : 'w-full text-left px-2.5 py-1.5 text-xs text-c-text-secondary hover:bg-state-hover rounded-md transition-colors'
                }
              >
                {isGenerate ? <Sparkles size={14} /> : null}
                {t(labelKey)}
              </button>
            );
          })}
          {undoValue !== undefined && (
            <button
              type="button"
              onClick={handleUndo}
              className="mt-1 w-full text-left px-2.5 py-1.5 text-xs text-c-warning hover:bg-c-warning/10 rounded-md transition-colors"
            >
              {t('sharedComponents.aiFieldEnhancer.undo', 'Undo AI')}
            </button>
          )}
        </div>
      )}

      {/* Propozycja AI (§4.5/§6.4) — treść pola JESZCZE się nie zmieniła.
          Nadpisanie następuje wyłącznie po „Zastosuj"; „Odrzuć" zamyka bez
          śladu. Panel nie zamyka się kliknięciem obok, żeby przypadkowe
          kliknięcie w tle nie skasowało wyniku, o który użytkownik poprosił. */}
      {proposal !== null && !disabled && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-72 rounded-lg border border-c-ai/40 bg-c-surface/95 backdrop-blur p-2 shadow-xl">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={13} className="text-c-ai" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-c-ai">
              {t('sharedComponents.aiFieldEnhancer.proposalTitle', 'AI proposal')}
            </span>
          </div>
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-c-text">
            {proposal}
          </p>
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={handleDiscardProposal}
              className="inline-flex items-center h-7 px-2.5 rounded-md text-xs font-medium border border-c-border-subtle text-c-text-secondary hover:bg-state-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            >
              {t('sharedComponents.aiFieldEnhancer.discard', 'Discard')}
            </button>
            <button
              type="button"
              onClick={handleAcceptProposal}
              className="inline-flex items-center h-7 px-2.5 rounded-md text-xs font-medium border border-c-ai/50 bg-c-ai/10 text-c-ai hover:bg-c-ai/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
            >
              {t('sharedComponents.aiFieldEnhancer.apply', 'Apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIFieldEnhancer;
