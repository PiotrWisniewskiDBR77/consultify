/**
 * SummaryView - Summary tab for Interview
 *
 * IMPORTANT: Only facts as-is, NO recommendations
 *
 * Sections:
 * - Key Facts (as-is)
 * - Information Gaps
 * - Constraints
 * - Pain Points
 */

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  DollarSign,
  FileText,
  HelpCircle,
  Loader2,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useState } from 'react';

const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  strategy: Target,
  operations: Settings,
  digital: Cpu,
  people: Users,
  finance: DollarSign,
};

interface InterviewSession {
  id: string;
  summaryFacts: Array<{ category: string; fact: string }>;
  summaryGaps: Array<{ category: string; gap: string }>;
  summaryConstraints: Array<{ category: string; constraint: string }>;
  summaryPainPoints: Array<{ category: string; painPoint: string }>;
  answeredQuestions: number;
  totalQuestions: number;
}

interface Question {
  id: string;
  category: string;
  questionText: string;
  answerText: string;
  status: string;
  confidenceScore: number;
}

interface SummaryViewProps {
  session: InterviewSession;
  questions: Question[];
  onGenerateSummary: () => Promise<void>;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  session,
  questions,
  onGenerateSummary,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerateSummary();
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate progress
  const progress = Math.round((session.answeredQuestions / session.totalQuestions) * 100) || 0;
  const hasSummary = session.summaryFacts.length > 0;

  // Get category icon
  const getCategoryIcon = (category: string) => {
    const Icon = CATEGORY_ICONS[category] || FileText;
    return <Icon size={14} className="text-slate-600" />;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
              <Sparkles size={20} className="text-primary-500" />
              Interview Summary
            </h2>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isGenerating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {hasSummary ? 'Regenerate' : 'Generate'} Summary
            </button>
          </div>

          {/* Progress indicator */}
          <div className="p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Interview Progress</span>
              <span className="text-sm font-medium text-navy-900 dark:text-white">
                {session.answeredQuestions} / {session.totalQuestions} questions answered
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  progress >= 80
                    ? 'bg-emerald-500'
                    : progress >= 50
                      ? 'bg-amber-500'
                      : 'bg-primary-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Important notice */}
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-500 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Note:</strong> This summary contains only facts and observations (as-is
                state). It does not include recommendations, action plans, or next steps. Those will
                be generated in the Tools and Assessment modules.
              </div>
            </div>
          </div>
        </div>

        {!hasSummary ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-500">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No summary generated yet</p>
            <p className="text-sm">
              Click "Generate Summary" to create a summary from your answers.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key Facts */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                <CheckCircle2 size={16} className="text-emerald-500" />
                Key Facts (As-Is)
              </h3>
              {session.summaryFacts.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-500 italic">
                  No facts extracted yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {session.summaryFacts.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-lg"
                    >
                      <div className="mt-0.5">{getCategoryIcon(item.category)}</div>
                      <div className="flex-1">
                        <span className="text-xs text-slate-600 uppercase">{item.category}</span>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{item.fact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Information Gaps */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                <HelpCircle size={16} className="text-blue-500" />
                Information Gaps
              </h3>
              {session.summaryGaps.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-500 italic">
                  No gaps identified.
                </p>
              ) : (
                <div className="space-y-2">
                  {session.summaryGaps.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg"
                    >
                      <div className="mt-0.5">{getCategoryIcon(item.category)}</div>
                      <div className="flex-1">
                        <span className="text-xs text-slate-600 uppercase">{item.category}</span>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{item.gap}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Constraints */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                <AlertTriangle size={16} className="text-amber-500" />
                Constraints & Limitations
              </h3>
              {session.summaryConstraints.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-500 italic">
                  No constraints identified.
                </p>
              ) : (
                <div className="space-y-2">
                  {session.summaryConstraints.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg"
                    >
                      <div className="mt-0.5">{getCategoryIcon(item.category)}</div>
                      <div className="flex-1">
                        <span className="text-xs text-slate-600 uppercase">{item.category}</span>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {item.constraint}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pain Points */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                <XCircle size={16} className="text-rose-500" />
                Current Pain Points
              </h3>
              {session.summaryPainPoints.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-500 italic">
                  No pain points identified.
                </p>
              ) : (
                <div className="space-y-2">
                  {session.summaryPainPoints.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 rounded-lg"
                    >
                      <div className="mt-0.5">{getCategoryIcon(item.category)}</div>
                      <div className="flex-1">
                        <span className="text-xs text-slate-600 uppercase">{item.category}</span>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {item.painPoint}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryView;
