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

// ── Fallback local refinement (when API unavailable) ─────────────────────────

function fallbackRefineText(
  input: string,
  mode: AIEnhanceMode,
  outputFormat: AIEnhancerOutputFormat
): string {
  if (outputFormat === 'list') {
    const lines = String(input || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return input;
    const refined = lines.map((l) => fallbackRefineText(l, mode, 'short'));
    return refined.join('\n');
  }

  const normalized = input
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return input;

  if (outputFormat === 'short') {
    if (mode === 'shorten') {
      return normalized.length > 90 ? `${normalized.slice(0, 87).trim()}...` : normalized;
    }
    if (mode === 'formal') {
      return normalized.replace(/(^\w)/, (m) => m.toUpperCase());
    }
    // improve / expand (fallback): basic cleanup only
    return normalized
      .replace(/\s{2,}/g, ' ')
      .replace(/\.\s*\./g, '.')
      .replace(/(^\w)/, (m) => m.toUpperCase());
  }

  if (mode === 'shorten') {
    const target = Math.max(120, Math.floor(normalized.length * 0.65));
    const compact = normalized.slice(0, target).trim();
    return compact.endsWith('.') || compact.endsWith('!') || compact.endsWith('?')
      ? compact
      : `${compact}...`;
  }

  if (mode === 'expand') {
    const appendix =
      '\n\nBusiness rationale: this item affects delivery timing, operational risk, and outcome quality. It is recommended to define an implementation owner and key control checkpoints.';
    return `${normalized}${appendix}`;
  }

  if (mode === 'formal') {
    return `It is hereby noted that ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
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
  const { t } = useTranslation();
  // UI language stays localized, but AI output is standardized to English for international teams.
  const targetLanguageName = 'English';
  const aiLanguage = 'en';

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

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setIsOpen(false);

    try {
      const formatInstruction =
        outputFormat === 'list'
          ? [
              `Format: return 5–8 distinct items.`,
              `- ONE item per line`,
              `- No bullets, no numbering, no markdown`,
              `- No empty lines`,
            ].join('\n')
          : outputFormat === 'short'
            ? [
                `Format: return ONE concise line (max ~12–16 words).`,
                `- No quotes, no markdown, no prefixes.`,
              ].join('\n')
            : `Length: 2–4 sentences. Style: concrete, delivery-oriented, executive/PMO.`;

      const systemInstruction = [
        `You are a senior PMO consultant and an expert business writer.`,
        `Generate professional content for the field "${sectionLabel}" in the context of the artifact "${artifactContext.title || 'initiative'}".`,
        `Rules:`,
        `- Output language MUST be ${targetLanguageName}. If the input/context is in another language, translate as needed.`,
        `- Do NOT invent new facts, numbers, dates, systems, or KPI values that are not present in the provided context. If information is missing, keep it generic and/or explicitly mark what needs confirmation in a single short sentence.`,
        `- Return ONLY the final field text. No commentary, no quotes, no prefixes, no markdown.`,
        formatInstruction,
      ].join('\n');

      let generatedText = '';
      try {
        const aiRes = await Api.post('/ai/refine-text', {
          text: [
            `[GENERATE FROM SCRATCH]`,
            `Field: ${sectionLabel}`,
            `Artifact: ${artifactContext.title || 'initiative'} (${artifactContext.type})`,
            `Status: ${artifactContext.status || 'draft'}`,
            `Priority: ${artifactContext.priority || 'medium'}`,
          ].join('\n'),
          mode: 'generate',
          systemInstruction,
          fieldLabel: sectionLabel,
          artifactContext,
          language: aiLanguage,
        });
        generatedText = String(aiRes?.text || '').trim();
      } catch {
        generatedText = '';
      }

      if (!generatedText) {
        throw new Error('Empty AI response');
      }

      setUndoValue(currentValue);
      onApply(generatedText);
      toast.success(t('sharedComponents.aiFieldEnhancer.generateSuccess'));
    } catch {
      toast.error(t('sharedComponents.aiFieldEnhancer.generateError'));
    } finally {
      setLoading(false);
    }
  }, [currentValue, onApply, t, sectionLabel, artifactContext, outputFormat]);

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

        // Keep AI instructions in English (international team standard).
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

        let refinedText = '';
        try {
          const aiRes = await Api.post('/ai/refine-text', {
            text: currentValue,
            mode,
            systemInstruction,
            fieldLabel: sectionLabel,
            artifactContext,
            language: aiLanguage,
          });
          refinedText = String(aiRes?.text || '').trim();
        } catch {
          refinedText = '';
        }

        // Fallback only when API is truly unavailable
        if (!refinedText) {
          refinedText = fallbackRefineText(currentValue, mode, outputFormat);
          toast(t('sharedComponents.aiFieldEnhancer.fallbackApplied'), { icon: '⚠️' });
        }

        if (!refinedText) {
          throw new Error('Empty AI response');
        }

        setUndoValue(currentValue);
        onApply(refinedText);
        toast.success(t('sharedComponents.aiFieldEnhancer.enhanceSuccess'));
      } catch {
        toast.error(t('sharedComponents.aiFieldEnhancer.enhanceError'));
      } finally {
        setLoading(false);
      }
    },
    [currentValue, onApply, t, sectionLabel, artifactContext, handleGenerate, outputFormat]
  );

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
      {/* AI trigger button */}
      <button
        onClick={() => !disabled && !loading && setIsOpen((prev) => !prev)}
        disabled={disabled || loading}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={disabledTooltip || t('sharedComponents.aiFieldEnhancer.triggerTitle')}
        aria-label="AI"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {!iconOnly && 'AI'}
      </button>

      {/* Dropdown menu */}
      {isOpen && !disabled && !loading && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-44 rounded-lg border border-slate-200/70 dark:border-navy-700/70 bg-white/95 dark:bg-navy-900/95 backdrop-blur p-1 shadow-xl">
          {MENU_ITEMS.map(({ mode, labelKey }) => {
            const isGenerate = mode === 'generate';
            return (
              <button
                key={mode}
                onClick={() => handleEnhance(mode)}
                className={
                  isGenerate
                    ? 'w-full text-left px-2.5 py-1.5 text-xs text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-md transition-colors font-medium flex items-center gap-1.5'
                    : 'w-full text-left px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-md transition-colors'
                }
              >
                {isGenerate ? <Sparkles size={14} /> : null}
                {t(labelKey)}
              </button>
            );
          })}
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
