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

import { EmptyState } from '@/components/ui/composed/EmptyState';

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
    return <Icon size={14} className="text-[var(--c-text-muted)]" />;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--c-text)] flex items-center gap-2">
              <Sparkles size={20} className="text-[var(--c-accent)]" />
              Interview Summary
            </h2>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--c-text)] text-[var(--c-surface)] hover:brightness-110 disabled:opacity-50 text-sm font-medium rounded-token-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
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
          <div className="p-4 bg-[var(--c-surface-raised)] rounded-token-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--c-text-secondary)]">Interview Progress</span>
              <span className="text-sm font-medium text-[var(--c-text)]">
                {session.answeredQuestions} / {session.totalQuestions} questions answered
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--c-border-subtle)] rounded-token-pill overflow-hidden">
              <div
                className={`h-full rounded-token-pill transition-all ${
                  progress >= 80
                    ? 'bg-[var(--c-success)]'
                    : progress >= 50
                      ? 'bg-[var(--c-warning)]'
                      : 'bg-[var(--c-text)]'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Important notice */}
          <div className="mt-4 p-3 bg-c-warning/8 border border-c-warning/20 rounded-token-md">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-[var(--c-warning)] mt-0.5" />
              <div className="text-sm text-[var(--c-text-secondary)]">
                <strong>Note:</strong> This summary contains only facts and observations (as-is
                state). It does not include recommendations, action plans, or next steps. Those will
                be generated in the Tools and Assessment modules.
              </div>
            </div>
          </div>
        </div>

        {!hasSummary ? (
          <EmptyState
            icon={<FileText />}
            title="No summary generated yet"
            description='Click "Generate Summary" to create a summary from your answers.'
          />
        ) : (
          <div className="space-y-6">
            {/* Key Facts */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-3">
                <CheckCircle2 size={16} className="text-[var(--c-success)]" />
                Key Facts (As-Is)
              </h3>
              {session.summaryFacts.length === 0 ? (
                <p className="text-sm text-[var(--c-text-muted)] italic">No facts extracted yet.</p>
              ) : (
                <div className="space-y-2">
                  {session.summaryFacts.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-c-success/8 border border-c-success/20 rounded-token-md"
                    >
                      <div className="mt-0.5">{getCategoryIcon(item.category)}</div>
                      <div className="flex-1">
                        <span className="text-xs text-[var(--c-text-muted)] uppercase">
                          {item.category}
                        </span>
                        <p className="text-sm text-[var(--c-text)]">{item.fact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Information Gaps */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-3">
                <HelpCircle size={16} className="text-[var(--c-info)]" />
                Information Gaps
              </h3>
              {session.summaryGaps.length === 0 ? (
                <p className="text-sm text-[var(--c-text-muted)] italic">No gaps identified.</p>
              ) : (
                <div className="space-y-2">
                  {session.summaryGaps.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-c-info/8 border border-c-info/20 rounded-token-md"
                    >
                      <div className="mt-0.5">{getCategoryIcon(item.category)}</div>
                      <div className="flex-1">
                        <span className="text-xs text-[var(--c-text-muted)] uppercase">
                          {item.category}
                        </span>
                        <p className="text-sm text-[var(--c-text)]">{item.gap}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Constraints */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-3">
                <AlertTriangle size={16} className="text-[var(--c-warning)]" />
                Constraints & Limitations
              </h3>
              {session.summaryConstraints.length === 0 ? (
                <p className="text-sm text-[var(--c-text-muted)] italic">
                  No constraints identified.
                </p>
              ) : (
                <div className="space-y-2">
                  {session.summaryConstraints.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-c-warning/8 border border-c-warning/20 rounded-token-md"
                    >
                      <div className="mt-0.5">{getCategoryIcon(item.category)}</div>
                      <div className="flex-1">
                        <span className="text-xs text-[var(--c-text-muted)] uppercase">
                          {item.category}
                        </span>
                        <p className="text-sm text-[var(--c-text)]">{item.constraint}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pain Points */}
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--c-text-secondary)] uppercase tracking-wider mb-3">
                <XCircle size={16} className="text-[var(--c-danger)]" />
                Current Pain Points
              </h3>
              {session.summaryPainPoints.length === 0 ? (
                <p className="text-sm text-[var(--c-text-muted)] italic">
                  No pain points identified.
                </p>
              ) : (
                <div className="space-y-2">
                  {session.summaryPainPoints.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-c-danger/8 border border-c-danger/20 rounded-token-md"
                    >
                      <div className="mt-0.5">{getCategoryIcon(item.category)}</div>
                      <div className="flex-1">
                        <span className="text-xs text-[var(--c-text-muted)] uppercase">
                          {item.category}
                        </span>
                        <p className="text-sm text-[var(--c-text)]">{item.painPoint}</p>
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
