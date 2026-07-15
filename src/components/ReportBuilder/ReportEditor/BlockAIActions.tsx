/**
 * BlockAIActions
 *
 * Inline AI action panel for individual blocks.
 * Provides quick actions for content refinement:
 * - Quick actions (shorten, expand, simplify, change tone)
 * - Custom instruction input
 * - Context-aware suggestions
 * - Per-block regeneration with options
 */

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Loader2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Type,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BlockConfig } from './ReportEditor';

// ==========================================
// TYPES
// ==========================================

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  labelPl: string;
  instruction: string;
  /** Instruction in the context language */
  instructionPl: string;
  category: 'length' | 'tone' | 'content' | 'format';
}

interface BlockAIActionsProps {
  block: BlockConfig;
  onRegenerate: (instruction: string) => Promise<void>;
  onClose: () => void;
  isPl: boolean;
  /** Neighboring blocks context for cross-block awareness */
  previousBlockSummary?: string;
  nextBlockSummary?: string;
}

// ==========================================
// QUICK ACTIONS
// ==========================================

const QUICK_ACTIONS: QuickAction[] = [
  // Length
  {
    id: 'shorten',
    icon: <Minimize2 className="w-4 h-4" />,
    label: 'Make Shorter',
    labelPl: 'Skróć',
    instruction:
      'Make this section significantly shorter. Keep only the most critical points. Remove redundancy.',
    instructionPl:
      'Znacząco skróć tę sekcję. Zachowaj tylko najważniejsze punkty. Usuń powtórzenia.',
    category: 'length',
  },
  {
    id: 'expand',
    icon: <ArrowUpRight className="w-4 h-4" />,
    label: 'Expand & Detail',
    labelPl: 'Rozwiń i uszczegółów',
    instruction:
      'Expand this section with more detail, examples, and supporting evidence. Add depth to each point.',
    instructionPl:
      'Rozwiń tę sekcję z większą ilością szczegółów, przykładów i dowodów. Dodaj głębię do każdego punktu.',
    category: 'length',
  },

  // Tone
  {
    id: 'executive',
    icon: <Target className="w-4 h-4" />,
    label: 'Executive Tone',
    labelPl: 'Ton zarządczy',
    instruction:
      'Rewrite in executive summary style: concise, action-oriented, focused on business impact and strategic decisions.',
    instructionPl:
      'Przepisz w stylu podsumowania zarządczego: zwięźle, nastawione na działanie, fokus na wpływ biznesowy i decyzje strategiczne.',
    category: 'tone',
  },
  {
    id: 'simplify',
    icon: <Type className="w-4 h-4" />,
    label: 'Simplify Language',
    labelPl: 'Uprość język',
    instruction:
      'Simplify the language. Remove jargon. Make it accessible to non-technical stakeholders.',
    instructionPl: 'Uprość język. Usuń żargon. Zrób dostępnym dla nietechnicznych odbiorców.',
    category: 'tone',
  },
  {
    id: 'persuasive',
    icon: <Zap className="w-4 h-4" />,
    label: 'More Persuasive',
    labelPl: 'Bardziej przekonujący',
    instruction:
      'Make the content more persuasive and action-driving. Emphasize urgency, benefits, and competitive advantage.',
    instructionPl:
      'Uczyń treść bardziej przekonującą. Podkreśl pilność, korzyści i przewagę konkurencyjną.',
    category: 'tone',
  },

  // Content
  {
    id: 'add_data',
    icon: <BarChart3 className="w-4 h-4" />,
    label: 'Add More Data',
    labelPl: 'Dodaj więcej danych',
    instruction:
      'Include more specific data points, metrics, percentages, and quantitative evidence. Reference actual assessment scores.',
    instructionPl:
      'Dodaj więcej konkretnych danych, metryk, procentów i ilościowych dowodów. Odwołuj się do wyników oceny.',
    category: 'content',
  },
  {
    id: 'add_examples',
    icon: <BookOpen className="w-4 h-4" />,
    label: 'Add Examples',
    labelPl: 'Dodaj przykłady',
    instruction:
      'Add practical examples and real-world scenarios to illustrate each key point. Make abstract concepts concrete.',
    instructionPl:
      'Dodaj praktyczne przykłady i scenariusze z życia, aby zilustrować każdy kluczowy punkt.',
    category: 'content',
  },
  {
    id: 'add_recommendations',
    icon: <ArrowDownRight className="w-4 h-4" />,
    label: 'Add Actions',
    labelPl: 'Dodaj działania',
    instruction:
      'Add concrete, actionable recommendations or next steps for each finding or observation.',
    instructionPl:
      'Dodaj konkretne, wykonalne rekomendacje lub następne kroki dla każdego wniosku.',
    category: 'content',
  },

  // Format
  {
    id: 'to_bullets',
    icon: <MoreHorizontal className="w-4 h-4" />,
    label: 'Convert to Bullets',
    labelPl: 'Zamień na punkty',
    instruction:
      'Restructure this content into clear bullet points. Each bullet should be self-contained and actionable.',
    instructionPl:
      'Zmień strukturę na przejrzyste punkty. Każdy punkt powinien być samodzielny i wykonalny.',
    category: 'format',
  },
  {
    id: 'to_prose',
    icon: <MessageCircle className="w-4 h-4" />,
    label: 'Convert to Prose',
    labelPl: 'Zamień na tekst ciągły',
    instruction:
      'Rewrite this content in flowing prose paragraphs. Create smooth transitions between ideas.',
    instructionPl:
      'Przepisz jako płynne akapity tekstu ciągłego. Twórz gładkie przejścia między myślami.',
    category: 'format',
  },
];

const CATEGORY_LABELS: Record<string, { label: string; labelPl: string }> = {
  length: { label: 'Length', labelPl: 'Długość' },
  tone: { label: 'Tone & Style', labelPl: 'Ton i styl' },
  content: { label: 'Content', labelPl: 'Treść' },
  format: { label: 'Format', labelPl: 'Format' },
};

// ==========================================
// COMPONENT
// ==========================================

export const BlockAIActions: React.FC<BlockAIActionsProps> = ({
  block,
  onRegenerate,
  onClose,
  isPl,
  previousBlockSummary,
  nextBlockSummary,
}) => {
  const { t } = useTranslation();
  const [customInstruction, setCustomInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleQuickAction = async (action: QuickAction) => {
    setIsProcessing(true);
    setActiveAction(action.id);
    try {
      // Build context-aware instruction
      let instruction = isPl ? action.instructionPl : action.instruction;

      // Add cross-block context
      if (previousBlockSummary) {
        instruction += `\n\nContext: The previous section covers: ${previousBlockSummary}`;
      }
      if (nextBlockSummary) {
        instruction += `\nThe next section will cover: ${nextBlockSummary}`;
      }

      await onRegenerate(instruction);
      onClose();
    } catch (err) {
      console.error('AI action failed:', err);
    } finally {
      setIsProcessing(false);
      setActiveAction(null);
    }
  };

  const handleCustomSubmit = async () => {
    if (!customInstruction.trim()) return;

    setIsProcessing(true);
    setActiveAction('custom');
    try {
      let instruction = customInstruction;

      if (previousBlockSummary) {
        instruction += `\n\nContext: The previous section covers: ${previousBlockSummary}`;
      }

      await onRegenerate(instruction);
      onClose();
    } catch (err) {
      console.error('Custom AI action failed:', err);
    } finally {
      setIsProcessing(false);
      setActiveAction(null);
    }
  };

  // Group actions by category
  const categories = ['length', 'tone', 'content', 'format'];

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 bg-c-surface rounded-xl shadow-2xl border border-slate-200/60 dark:border-white/[0.03] z-30 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-c-border-subtle">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-c-accent" />
          <span className="text-sm font-semibold text-c-text">
            {t('reportBuilder.blockAIActions.aiActions', 'AI Actions')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="max-h-64 overflow-y-auto p-2">
        {categories.map((cat) => {
          const actions = QUICK_ACTIONS.filter((a) => a.category === cat);
          if (actions.length === 0) return null;
          const catLabel = CATEGORY_LABELS[cat] || { label: cat, labelPl: cat };

          return (
            <div key={cat} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider">
                {isPl ? catLabel.labelPl : catLabel.label}
              </div>
              <div className="space-y-0.5">
                {actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    disabled={isProcessing}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg transition-all
                      ${
                        activeAction === action.id
                          ? 'bg-c-accent-soft text-c-accent'
                          : 'text-c-text hover:opacity-90'
                      }
                      ${isProcessing && activeAction !== action.id ? 'opacity-50' : ''}
                    `}
                  >
                    <span className="flex-shrink-0 text-c-text-secondary">
                      {activeAction === action.id && isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin text-c-accent" />
                      ) : (
                        action.icon
                      )}
                    </span>
                    <span className="text-xs font-medium">
                      {isPl ? action.labelPl : action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Full Regenerate */}
        <div className="mt-1 pt-1 border-t border-c-border-subtle">
          <button
            onClick={() =>
              handleQuickAction({
                id: 'regenerate_full',
                icon: <RefreshCw className="w-4 h-4" />,
                label: 'Regenerate Completely',
                labelPl: 'Wygeneruj od nowa',
                instruction:
                  'Regenerate this section completely with fresh content. Keep the same structure and format but write entirely new text.',
                instructionPl:
                  'Wygeneruj tę sekcję całkowicie od nowa. Zachowaj strukturę i format, ale napisz zupełnie nowy tekst.',
                category: 'content',
              })
            }
            disabled={isProcessing}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-c-text hover:bg-danger-50 dark:hover:bg-danger-900/20 hover:text-danger-600 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-c-text-secondary" />
            <span className="text-xs font-medium">
              {t('reportBuilder.blockAIActions.regenerateCompletely', 'Regenerate Completely')}
            </span>
          </button>
        </div>
      </div>

      {/* Custom Instruction */}
      <div className="p-3 bg-c-surface-raised border-t border-c-border-subtle">
        <div className="flex gap-2">
          <input
            type="text"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            placeholder={t('reportBuilder.blockAIActions.customInstruction', 'Custom instruction...')}
            className="flex-1 px-3 py-2 text-xs bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg focus:ring-1 focus:ring-c-focus focus:border-c-accent"
            disabled={isProcessing}
          />
          <button
            onClick={handleCustomSubmit}
            disabled={isProcessing || !customInstruction.trim()}
            className="p-2 bg-c-text text-c-bg rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing && activeAction === 'custom' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockAIActions;
