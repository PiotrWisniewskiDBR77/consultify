/**
 * AIFieldEnhancer
 *
 * Shared AI-powered text enhancement dropdown for any text field.
 * Provides: Improve, Shorten, Expand, Formal tone actions + Undo.
 *
 * Used in N-mode artifact detail views (Decision, Task, etc.)
 * for all textarea / text input fields that support AI editing.
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

import { Api } from '@/services/api';

// ── Types ────────────────────────────────────────────────────────────────────

export type AIEnhanceMode = 'improve' | 'shorten' | 'expand' | 'formal';

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
}

// ── Fallback local refinement (when API unavailable) ─────────────────────────

function fallbackRefineText(input: string, mode: AIEnhanceMode, isPolish: boolean): string {
  const normalized = input
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return input;

  if (mode === 'shorten') {
    const target = Math.max(120, Math.floor(normalized.length * 0.65));
    const compact = normalized.slice(0, target).trim();
    return compact.endsWith('.') || compact.endsWith('!') || compact.endsWith('?')
      ? compact
      : `${compact}...`;
  }

  if (mode === 'expand') {
    const appendix = isPolish
      ? '\n\nUzasadnienie biznesowe: ta pozycja wpływa na terminowość, ryzyko operacyjne i jakość dostarczanych rezultatów. Rekomendowane jest określenie właściciela wdrożenia oraz punktów kontrolnych.'
      : '\n\nBusiness rationale: this item affects delivery timing, operational risk, and outcome quality. It is recommended to define an implementation owner and key control checkpoints.';
    return `${normalized}${appendix}`;
  }

  if (mode === 'formal') {
    return isPolish
      ? `Niniejszym wskazuje się, że ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`
      : `It is hereby noted that ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
  }

  // improve — basic cleanup (real AI does the heavy lifting)
  let improved = normalized
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/(^\w)/, (m) => m.toUpperCase());
  // Ensure ends with period
  if (improved && !/[.!?]$/.test(improved)) {
    improved += '.';
  }
  return improved;
}

// ── Menu items configuration ─────────────────────────────────────────────────

const MENU_ITEMS: { mode: AIEnhanceMode; label: { en: string; pl: string } }[] = [
  { mode: 'improve', label: { en: 'Improve', pl: 'Popraw' } },
  { mode: 'shorten', label: { en: 'Shorten', pl: 'Skróć' } },
  { mode: 'expand', label: { en: 'Expand', pl: 'Rozwiń' } },
  { mode: 'formal', label: { en: 'Formal tone', pl: 'Formalny ton' } },
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
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [undoValue, setUndoValue] = useState<string | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
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

  const handleEnhance = useCallback(
    async (mode: AIEnhanceMode) => {
      if (!currentValue.trim()) {
        toast.error(
          isPolish
            ? 'Najpierw wpisz treść do edycji AI'
            : 'Enter some content first to edit with AI'
        );
        return;
      }

      setLoading(true);
      setIsOpen(false);

      try {
        const instructionByMode: Record<AIEnhanceMode, string> = {
          improve: isPolish
            ? [
                'Popraw tekst wykonując WSZYSTKIE poniższe kroki:',
                '1. Literówki i ortografia — napraw WSZYSTKIE błędy',
                '2. Gramatyka i interpunkcja — popraw składnię',
                '3. Język — zachowaj oryginalny język (polski/angielski)',
                '4. Skróty myślowe — rozwiń w pełne zdania',
                '5. Czytelność — popraw strukturę',
                '6. Profesjonalizm — ton odpowiedni do dokumentacji PMO',
                '',
                'WAŻNE: Zwróć TYLKO poprawiony tekst. Zachowaj cały oryginalny sens.',
              ].join('\n')
            : [
                'Improve the text by performing ALL of the following steps:',
                '1. Typos & spelling — fix ALL errors',
                '2. Grammar & punctuation — fix syntax',
                '3. Language — keep the original language (Polish/English)',
                '4. Shorthand notes — expand into full sentences',
                '5. Readability — improve structure',
                '6. Professionalism — PMO documentation tone',
                '',
                'IMPORTANT: Return ONLY the corrected text. Keep all original meaning.',
              ].join('\n'),
          shorten: isPolish
            ? 'Skróć tekst o 30-40%, zachowując kluczowy sens i decyzjotwórcze informacje. Napraw po drodze wszelkie literówki i błędy.'
            : 'Shorten the text by about 30-40% while keeping key meaning and decision-relevant information. Fix any typos and errors along the way.',
          expand: isPolish
            ? 'Rozwiń tekst, dodając istotny kontekst, ryzyka i implikacje biznesowe. Napraw po drodze wszelkie literówki i błędy. NIE dodawaj generycznych frazesów — pisz konkretnie w kontekście tego artefaktu.'
            : 'Expand the text with useful context, risks, and business implications. Fix any typos and errors along the way. Do NOT add generic filler — write specifically in context of this artifact.',
          formal: isPolish
            ? 'Przeredaguj tekst w bardziej formalnym, zarządczym tonie. Napraw po drodze wszelkie literówki, błędy ortograficzne i gramatyczne.'
            : 'Rewrite the text in a more formal executive tone. Fix any typos, spelling errors, and grammar issues along the way.',
        };

        const systemInstruction = isPolish
          ? `Jesteś profesjonalnym redaktorem treści PMO. Twoim zadaniem jest NAPRAWIĆ i POPRAWIĆ istniejący tekst użytkownika. Zwróć TYLKO poprawiony tekst — bez komentarzy, bez wyjaśnień, bez cudzysłowów, bez prefiksów. Zachowaj język oryginału.\n\nInstrukcja trybu "${mode}":\n${instructionByMode[mode]}`
          : `You are a professional PMO content editor. Your job is to FIX and IMPROVE the user's existing text. Return ONLY the corrected text — no commentary, no explanations, no quotes, no prefixes. Keep the original language.\n\nMode "${mode}" instruction:\n${instructionByMode[mode]}`;

        let refinedText = '';
        try {
          const aiRes = await Api.post('/ai/refine-text', {
            text: currentValue,
            mode,
            systemInstruction,
            fieldLabel: sectionLabel,
            artifactContext,
            language: isPolish ? 'pl' : 'en',
          });
          refinedText = String(aiRes?.text || '').trim();
        } catch {
          refinedText = '';
        }

        // Fallback only when API is truly unavailable
        if (!refinedText) {
          refinedText = fallbackRefineText(currentValue, mode, isPolish);
          toast(
            isPolish
              ? 'Użyto trybu awaryjnego edycji lokalnej (AI chwilowo niedostępne).'
              : 'Fallback local edit applied (AI temporarily unavailable).',
            { icon: '⚠️' }
          );
        }

        if (!refinedText) {
          throw new Error('Empty AI response');
        }

        setUndoValue(currentValue);
        onApply(refinedText);
        toast.success(
          isPolish
            ? 'Treść zaktualizowana przez AI. Kliknij Undo AI aby cofnąć.'
            : 'Content updated by AI. Click Undo AI to revert.'
        );
      } catch {
        toast.error(
          isPolish ? 'Nie udało się poprawić treści przez AI' : 'Failed to refine content with AI'
        );
      } finally {
        setLoading(false);
      }
    },
    [currentValue, onApply, isPolish, sectionLabel, artifactContext]
  );

  const handleUndo = useCallback(() => {
    if (undoValue !== undefined) {
      onApply(undoValue);
      setUndoValue(undefined);
      setIsOpen(false);
      toast.success(isPolish ? 'Przywrócono poprzednią wersję tekstu' : 'Previous text restored');
    }
  }, [undoValue, onApply, isPolish]);

  return (
    <div className="relative" ref={menuRef}>
      {/* AI trigger button */}
      <button
        onClick={() => !disabled && !loading && setIsOpen((prev) => !prev)}
        disabled={disabled || loading}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-purple-500 dark:text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={
          disabledTooltip || (isPolish ? 'Akcje AI dla tego pola' : 'AI actions for this field')
        }
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
        AI
      </button>

      {/* Dropdown menu */}
      {isOpen && !disabled && !loading && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-44 rounded-lg border border-slate-200/70 dark:border-navy-700/70 bg-white/95 dark:bg-navy-900/95 backdrop-blur p-1 shadow-xl">
          {MENU_ITEMS.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => handleEnhance(mode)}
              className="w-full text-left px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-md transition-colors"
            >
              {isPolish ? label.pl : label.en}
            </button>
          ))}
          {undoValue !== undefined && (
            <button
              onClick={handleUndo}
              className="mt-1 w-full text-left px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 rounded-md transition-colors"
            >
              Undo AI
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AIFieldEnhancer;
