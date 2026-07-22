/**
 * DecisionReadinessBar
 * Shows decision maturity/readiness score with stage progression
 * Professional, compact design replacing childish traffic lights
 */

import { motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  FileText,
  Lightbulb,
  Shield,
  Target,
  Users,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Types for decision readiness calculation
export interface DecisionReadinessData {
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  dueDate: string;
  deciderId: string;
  requesterName: string;
  alternatives: Array<{
    id: string;
    title: string;
    description: string;
    pros: string[];
    cons: string[];
  }>;
  impact: {
    scope: string;
    schedule: string;
    cost: string;
    quality: string;
    description?: string;
  };
  stakeholders: Array<{
    role: string;
    userId: string;
  }>;
  rationale?: string;
}

interface DecisionReadinessBarProps {
  data: DecisionReadinessData;
  compact?: boolean;
  showDetails?: boolean;
}

// Stage definitions with requirements
const STAGES = [
  {
    id: 'draft',
    name: { en: 'Draft', pl: 'Szkic' },
    minScore: 0,
    color: 'slate',
  },
  {
    id: 'scoped',
    name: { en: 'Scoped', pl: 'Określona' },
    minScore: 25,
    color: 'blue',
  },
  {
    id: 'analyzed',
    name: { en: 'Analyzed', pl: 'Przeanalizowana' },
    minScore: 50,
    color: 'amber',
  },
  {
    id: 'reviewed',
    name: { en: 'Reviewed', pl: 'Zrecenzowana' },
    minScore: 70,
    color: 'purple',
  },
  {
    id: 'ready',
    name: { en: 'Ready', pl: 'Gotowa' },
    minScore: 85,
    color: 'emerald',
  },
];

// Requirement definitions with weights
const REQUIREMENTS = [
  {
    id: 'title',
    name: { en: 'Title defined', pl: 'Tytuł określony' },
    icon: FileText,
    weight: 10,
    stage: 'draft',
    check: (d: DecisionReadinessData) => d.title?.trim().length > 3,
  },
  {
    id: 'description',
    name: { en: 'Problem described', pl: 'Problem opisany' },
    icon: FileText,
    weight: 10,
    stage: 'draft',
    check: (d: DecisionReadinessData) => d.description?.trim().length > 20,
  },
  {
    id: 'category',
    name: { en: 'Category set', pl: 'Kategoria wybrana' },
    icon: Target,
    weight: 5,
    stage: 'scoped',
    check: (d: DecisionReadinessData) => !!d.category,
  },
  {
    id: 'priority',
    name: { en: 'Priority set', pl: 'Priorytet określony' },
    icon: Target,
    weight: 5,
    stage: 'scoped',
    check: (d: DecisionReadinessData) => !!d.priority,
  },
  {
    id: 'requester',
    name: { en: 'Requester identified', pl: 'Zgłaszający określony' },
    icon: Users,
    weight: 5,
    stage: 'scoped',
    check: (d: DecisionReadinessData) => !!d.requesterName,
  },
  {
    id: 'impact',
    name: { en: 'Impact assessed', pl: 'Wpływ oceniony' },
    icon: Shield,
    weight: 15,
    stage: 'analyzed',
    check: (d: DecisionReadinessData) =>
      d.impact?.scope && d.impact?.schedule && d.impact?.cost && d.impact?.quality,
  },
  {
    id: 'alternatives_min',
    name: { en: 'Min. 2 alternatives', pl: 'Min. 2 alternatywy' },
    icon: Lightbulb,
    weight: 15,
    stage: 'analyzed',
    check: (d: DecisionReadinessData) => d.alternatives?.filter((a) => a.title?.trim()).length >= 2,
  },
  {
    id: 'alternatives_detailed',
    name: { en: 'Alternatives with pros/cons', pl: 'Alternatywy z za/przeciw' },
    icon: Lightbulb,
    weight: 10,
    stage: 'analyzed',
    check: (d: DecisionReadinessData) =>
      d.alternatives?.some((a) => a.pros?.length > 0 && a.cons?.length > 0),
  },
  {
    id: 'stakeholder_accountable',
    name: { en: 'Accountable assigned', pl: 'Odpowiedzialny przypisany' },
    icon: Users,
    weight: 10,
    stage: 'reviewed',
    check: (d: DecisionReadinessData) => d.stakeholders?.some((s) => s.role === 'accountable'),
  },
  {
    id: 'stakeholder_responsible',
    name: { en: 'Responsible assigned', pl: 'Realizujący przypisany' },
    icon: Users,
    weight: 5,
    stage: 'reviewed',
    check: (d: DecisionReadinessData) => d.stakeholders?.some((s) => s.role === 'responsible'),
  },
  {
    id: 'decider',
    name: { en: 'Decider assigned', pl: 'Decydent przypisany' },
    icon: Users,
    weight: 5,
    stage: 'ready',
    check: (d: DecisionReadinessData) => !!d.deciderId,
  },
  {
    id: 'due_date',
    name: { en: 'Due date set', pl: 'Termin określony' },
    icon: Calendar,
    weight: 5,
    stage: 'ready',
    check: (d: DecisionReadinessData) => !!d.dueDate,
  },
];

export const DecisionReadinessBar: React.FC<DecisionReadinessBarProps> = ({
  data,
  compact = false,
  showDetails = true,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // Calculate readiness score and missing requirements
  const { score, metRequirements, missingRequirements, currentStage, nextStage } = useMemo(() => {
    let totalScore = 0;
    const met: typeof REQUIREMENTS = [];
    const missing: typeof REQUIREMENTS = [];

    REQUIREMENTS.forEach((req) => {
      if (req.check(data)) {
        totalScore += req.weight;
        met.push(req);
      } else {
        missing.push(req);
      }
    });

    // Determine current stage
    let current = STAGES[0];
    let next = STAGES[1];
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (totalScore >= STAGES[i].minScore) {
        current = STAGES[i];
        next = STAGES[i + 1] || null;
        break;
      }
    }

    return {
      score: totalScore,
      metRequirements: met,
      missingRequirements: missing,
      currentStage: current,
      nextStage: next,
    };
  }, [data]);

  // Get color classes based on current stage
  const getColorClasses = (stage: (typeof STAGES)[0]) => {
    const colors: Record<string, { bg: string; text: string; border: string; fill: string }> = {
      slate: {
        bg: 'bg-slate-500',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-300 dark:border-slate-600',
        fill: 'from-slate-400 to-slate-500',
      },
      blue: {
        bg: 'bg-blue-500',
        text: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-300 dark:border-blue-600',
        fill: 'from-blue-400 to-blue-500',
      },
      amber: {
        bg: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-300 dark:border-amber-600',
        fill: 'from-amber-400 to-amber-500',
      },
      purple: {
        bg: 'bg-violet-500',
        text: 'text-violet-600 dark:text-violet-400',
        border: 'border-violet-300 dark:border-violet-600',
        fill: 'from-violet-400 to-violet-500',
      },
      emerald: {
        bg: 'bg-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-300 dark:border-emerald-600',
        fill: 'from-emerald-400 to-emerald-500',
      },
    };
    return colors[stage.color] || colors.slate;
  };

  const colorClasses = getColorClasses(currentStage);

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${colorClasses.fill}`}
          />
        </div>
        <span className={`text-sm font-semibold ${colorClasses.text} min-w-[3rem] text-right`}>
          {score}%
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-navy-700/50 shadow-md overflow-hidden"
    >
      {/* Header with score */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('myWork.decisionReadiness.decisionReadiness', 'Decision Readiness')}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses.bg} text-white`}
            >
              {isPolish ? currentStage.name.pl : currentStage.name.en}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${colorClasses.text}`}>{score}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">/100</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full bg-gradient-to-r ${colorClasses.fill} relative`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
            </motion.div>
          </div>

          {/* Stage markers */}
          <div className="absolute top-0 left-0 right-0 h-3 flex items-center">
            {STAGES.slice(1).map((stage) => (
              <div
                key={stage.id}
                className="absolute h-3 w-0.5 bg-slate-50 dark:bg-white/50 dark:bg-navy-600/50"
                style={{ left: `${stage.minScore}%` }}
              />
            ))}
          </div>
        </div>

        {/* Stage labels */}
        <div className="flex justify-between mt-2">
          {STAGES.map((stage, index) => (
            <div
              key={stage.id}
              className={`text-xs ${
                score >= stage.minScore
                  ? getColorClasses(stage).text
                  : 'text-slate-500 dark:text-slate-400'
              }`}
              style={{
                width: index === 0 ? 'auto' : index === STAGES.length - 1 ? 'auto' : undefined,
              }}
            >
              {isPolish ? stage.name.pl : stage.name.en}
            </div>
          ))}
        </div>
      </div>

      {/* Requirements checklist */}
      {showDetails && (
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {REQUIREMENTS.map((req) => {
              const isMet = metRequirements.includes(req);
              const Icon = req.icon;
              return (
                <div
                  key={req.id}
                  className={`flex items-center gap-2 text-xs ${
                    isMet
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {isMet ? (
                    <CheckCircle2 size={14} className="flex-shrink-0" />
                  ) : (
                    <Circle size={14} className="flex-shrink-0" />
                  )}
                  <span className="truncate">{isPolish ? req.name.pl : req.name.en}</span>
                </div>
              );
            })}
          </div>

          {/* Next step hint */}
          {nextStage && missingRequirements.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-navy-700">
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">
                    {t('myWork.decisionReadiness.toReach', 'To reach')} "
                    {isPolish ? nextStage.name.pl : nextStage.name.en}":
                  </span>
                  <ul className="mt-1 space-y-0.5">
                    {missingRequirements
                      .filter((r) => {
                        const stageIndex = STAGES.findIndex((s) => s.id === r.stage);
                        const nextStageIndex = STAGES.findIndex((s) => s.id === nextStage.id);
                        return stageIndex <= nextStageIndex;
                      })
                      .slice(0, 3)
                      .map((req) => (
                        <li key={req.id}>• {isPolish ? req.name.pl : req.name.en}</li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default DecisionReadinessBar;
