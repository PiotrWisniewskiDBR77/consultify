/**
 * ImpactAssessmentCompact
 * Professional, compact impact assessment with numerical values
 * Replaces childish traffic light emoji design
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Info,
  Layers,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ImpactValues {
  scope: 'low' | 'medium' | 'high';
  schedule: 'low' | 'medium' | 'high';
  cost: 'low' | 'medium' | 'high';
  quality: 'low' | 'medium' | 'high';
  description?: string;
  // Extended fields for professional assessment
  financialEstimate?: {
    min: number;
    max: number;
    currency: string;
    confidence: 'low' | 'medium' | 'high';
  };
  timelineEstimate?: {
    value: number;
    unit: 'days' | 'weeks' | 'months';
    confidence: 'low' | 'medium' | 'high';
  };
  resourceEstimate?: {
    fte: number;
    duration: string;
    confidence: 'low' | 'medium' | 'high';
  };
}

interface ImpactAssessmentCompactProps {
  impact: ImpactValues;
  onChange: (impact: ImpactValues) => void;
  readOnly?: boolean;
}

// Impact level to numeric score mapping
const IMPACT_SCORES: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const IMPACT_LABELS = {
  low: { en: 'Low', pl: 'Niski' },
  medium: { en: 'Medium', pl: 'Średni' },
  high: { en: 'High', pl: 'Wysoki' },
};

type ImpactLevel = keyof typeof IMPACT_LABELS;

const normalizeImpactLevel = (value?: string | null): ImpactLevel => {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
};

const getImpactScore = (value?: string | null): number => {
  return IMPACT_SCORES[normalizeImpactLevel(value)] ?? IMPACT_SCORES.medium;
};

const CONFIDENCE_LABELS = {
  low: { en: 'Low confidence', pl: 'Niska pewność' },
  medium: { en: 'Medium confidence', pl: 'Średnia pewność' },
  high: { en: 'High confidence', pl: 'Wysoka pewność' },
};

const DIMENSIONS = [
  {
    id: 'scope' as const,
    name: { en: 'Scope', pl: 'Zakres' },
    icon: Layers,
    description: { en: 'Impact on project scope', pl: 'Wpływ na zakres projektu' },
    color: 'blue',
  },
  {
    id: 'schedule' as const,
    name: { en: 'Schedule', pl: 'Harmonogram' },
    icon: Clock,
    description: { en: 'Impact on timeline', pl: 'Wpływ na harmonogram' },
    color: 'purple',
  },
  {
    id: 'cost' as const,
    name: { en: 'Cost', pl: 'Koszt' },
    icon: DollarSign,
    description: { en: 'Financial impact', pl: 'Wpływ finansowy' },
    color: 'emerald',
  },
  {
    id: 'quality' as const,
    name: { en: 'Quality', pl: 'Jakość' },
    icon: Award,
    description: { en: 'Impact on quality', pl: 'Wpływ na jakość' },
    color: 'amber',
  },
];

export const ImpactAssessmentCompact: React.FC<ImpactAssessmentCompactProps> = ({
  impact,
  onChange,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);
  const [showEstimates, setShowEstimates] = useState(false);

  // Calculate overall impact score (1-10 scale)
  const overallScore = React.useMemo(() => {
    const scores = DIMENSIONS.map((d) => getImpactScore(impact[d.id]));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round((avg / 3) * 10 * 10) / 10; // Scale to 1-10 with 1 decimal
  }, [impact]);

  // Get color based on impact level
  const getImpactColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-emerald-500 text-emerald-500 border-emerald-500';
      case 'medium':
        return 'bg-amber-500 text-amber-500 border-amber-500';
      case 'high':
        return 'bg-danger-500 text-danger-500 border-danger-500';
      default:
        return 'bg-slate-500 text-slate-500 border-slate-500';
    }
  };

  // Get overall score color
  const getScoreColor = (score: number) => {
    if (score <= 3.3) return 'text-emerald-500';
    if (score <= 6.6) return 'text-amber-500';
    return 'text-danger-500';
  };

  // Get overall label
  const getOverallLabel = (score: number) => {
    if (score <= 3.3) return t('myWork.impactAssessment.low', 'Low');
    if (score <= 6.6) return t('myWork.impactAssessment.medium', 'Medium');
    return t('myWork.impactAssessment.high', 'High');
  };

  const handleDimensionChange = (
    dimension: keyof ImpactValues,
    value: 'low' | 'medium' | 'high'
  ) => {
    if (readOnly) return;
    onChange({ ...impact, [dimension]: value });
  };

  return (
    <div className="space-y-4">
      {/* Summary Row */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800 rounded-xl">
        <div className="flex items-center gap-6">
          {DIMENSIONS.map((dim) => {
            const Icon = dim.icon;
            const level = normalizeImpactLevel(impact[dim.id]);
            const colorClass = getImpactColor(level);
            return (
              <div key={dim.id} className="flex items-center gap-2">
                <Icon size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  {isPolish ? dim.name.pl : dim.name.en}
                </span>
                <div
                  className={`w-2 h-2 rounded-full ${colorClass.split(' ')[0]}`}
                  title={`${isPolish ? dim.name.pl : dim.name.en}: ${
                    isPolish ? IMPACT_LABELS[level].pl : IMPACT_LABELS[level].en
                  }`}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('myWork.impactAssessment.overallImpact', 'Overall Impact')}
            </div>
            <div className={`text-lg font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}/10
              <span className="text-xs font-normal ml-1">({getOverallLabel(overallScore)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {DIMENSIONS.map((dim) => {
          const Icon = dim.icon;
          const level = normalizeImpactLevel(impact[dim.id]);
          const isExpanded = expandedDimension === dim.id;

          return (
            <div
              key={dim.id}
              className={`relative rounded-xl border transition-all ${
                isExpanded
                  ? 'border-c-border-strong bg-c-surface-raised'
                  : 'border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900'
              }`}
            >
              <button
                onClick={() => setExpandedDimension(isExpanded ? null : dim.id)}
                className="w-full p-3 text-left"
                disabled={readOnly}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-slate-500 dark:text-slate-400" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {isPolish ? dim.name.pl : dim.name.en}
                    </span>
                  </div>
                  {!readOnly && (
                    <ChevronDown
                      size={14}
                      className={`text-slate-500 dark:text-slate-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </div>

                {/* Level indicator */}
                <div className="flex items-center gap-1">
                  {(['low', 'medium', 'high'] as const).map((l) => (
                    <div
                      key={l}
                      className={`flex-1 h-2 rounded-full transition-all ${
                        getImpactScore(level) >= getImpactScore(l)
                          ? getImpactColor(level).split(' ')[0]
                          : 'bg-slate-200 dark:bg-navy-700'
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? IMPACT_LABELS[level].pl : IMPACT_LABELS[level].en}
                </div>
              </button>

              {/* Expanded selector */}
              <AnimatePresence>
                {isExpanded && !readOnly && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-200 dark:border-navy-700"
                  >
                    <div className="p-3 space-y-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        {isPolish ? dim.description.pl : dim.description.en}
                      </p>
                      {(['low', 'medium', 'high'] as const).map((l) => (
                        <button
                          key={l}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDimensionChange(dim.id, l);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                            level === l
                              ? `${getImpactColor(l).split(' ')[0]} text-white`
                              : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                          }`}
                        >
                          <span>{isPolish ? IMPACT_LABELS[l].pl : IMPACT_LABELS[l].en}</span>
                          {l === 'low' && <TrendingDown size={14} />}
                          {l === 'medium' && <Minus size={14} />}
                          {l === 'high' && <TrendingUp size={14} />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Optional: Detailed estimates section */}
      <div className="border-t border-slate-200 dark:border-navy-700 pt-4">
        <button
          onClick={() => setShowEstimates(!showEstimates)}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <Info size={14} />
          <span>{t('myWork.impactAssessment.detailedEstimates', 'Detailed estimates')}</span>
          {showEstimates ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <AnimatePresence>
          {showEstimates && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {/* Financial estimate */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign size={16} className="text-emerald-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t('myWork.impactAssessment.financialImpact', 'Financial Impact')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Min</label>
                      <input
                        type="number"
                        value={impact.financialEstimate?.min || ''}
                        onChange={(e) =>
                          onChange({
                            ...impact,
                            financialEstimate: {
                              ...impact.financialEstimate,
                              min: Number(e.target.value),
                              max: impact.financialEstimate?.max || 0,
                              currency: impact.financialEstimate?.currency || 'EUR',
                              confidence: impact.financialEstimate?.confidence || 'medium',
                            },
                          })
                        }
                        placeholder="0"
                        disabled={readOnly}
                        className="w-full px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Max</label>
                      <input
                        type="number"
                        value={impact.financialEstimate?.max || ''}
                        onChange={(e) =>
                          onChange({
                            ...impact,
                            financialEstimate: {
                              ...impact.financialEstimate,
                              min: impact.financialEstimate?.min || 0,
                              max: Number(e.target.value),
                              currency: impact.financialEstimate?.currency || 'EUR',
                              confidence: impact.financialEstimate?.confidence || 'medium',
                            },
                          })
                        }
                        placeholder="0"
                        disabled={readOnly}
                        className="w-full px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <select
                      value={impact.financialEstimate?.confidence || 'medium'}
                      onChange={(e) =>
                        onChange({
                          ...impact,
                          financialEstimate: {
                            ...impact.financialEstimate,
                            min: impact.financialEstimate?.min || 0,
                            max: impact.financialEstimate?.max || 0,
                            currency: impact.financialEstimate?.currency || 'EUR',
                            confidence: e.target.value as 'low' | 'medium' | 'high',
                          },
                        })
                      }
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 focus:outline-none"
                    >
                      <option value="low">
                        {t('myWork.impactAssessment.lowConfidence', 'Low confidence')}
                      </option>
                      <option value="medium">
                        {t('myWork.impactAssessment.mediumConfidence', 'Medium confidence')}
                      </option>
                      <option value="high">
                        {t('myWork.impactAssessment.highConfidence', 'High confidence')}
                      </option>
                    </select>
                  </div>
                </div>

                {/* Timeline estimate */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={16} className="text-c-text" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t('myWork.impactAssessment.timelineImpact', 'Timeline Impact')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={impact.timelineEstimate?.value || ''}
                      onChange={(e) =>
                        onChange({
                          ...impact,
                          timelineEstimate: {
                            ...impact.timelineEstimate,
                            value: Number(e.target.value),
                            unit: impact.timelineEstimate?.unit || 'weeks',
                            confidence: impact.timelineEstimate?.confidence || 'medium',
                          },
                        })
                      }
                      placeholder="0"
                      disabled={readOnly}
                      className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                    />
                    <select
                      value={impact.timelineEstimate?.unit || 'weeks'}
                      onChange={(e) =>
                        onChange({
                          ...impact,
                          timelineEstimate: {
                            ...impact.timelineEstimate,
                            value: impact.timelineEstimate?.value || 0,
                            unit: e.target.value as 'days' | 'weeks' | 'months',
                            confidence: impact.timelineEstimate?.confidence || 'medium',
                          },
                        })
                      }
                      disabled={readOnly}
                      className="px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 focus:outline-none"
                    >
                      <option value="days">{t('myWork.impactAssessment.days', 'days')}</option>
                      <option value="weeks">{t('myWork.impactAssessment.weeks', 'weeks')}</option>
                      <option value="months">
                        {t('myWork.impactAssessment.months', 'months')}
                      </option>
                    </select>
                  </div>
                  <div className="mt-2">
                    <select
                      value={impact.timelineEstimate?.confidence || 'medium'}
                      onChange={(e) =>
                        onChange({
                          ...impact,
                          timelineEstimate: {
                            ...impact.timelineEstimate,
                            value: impact.timelineEstimate?.value || 0,
                            unit: impact.timelineEstimate?.unit || 'weeks',
                            confidence: e.target.value as 'low' | 'medium' | 'high',
                          },
                        })
                      }
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 focus:outline-none"
                    >
                      <option value="low">
                        {t('myWork.impactAssessment.lowConfidence2', 'Low confidence')}
                      </option>
                      <option value="medium">
                        {t('myWork.impactAssessment.mediumConfidence2', 'Medium confidence')}
                      </option>
                      <option value="high">
                        {t('myWork.impactAssessment.highConfidence2', 'High confidence')}
                      </option>
                    </select>
                  </div>
                </div>

                {/* Resource estimate */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers size={16} className="text-blue-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t('myWork.impactAssessment.resources', 'Resources')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">FTE</label>
                      <input
                        type="number"
                        step="0.5"
                        value={impact.resourceEstimate?.fte || ''}
                        onChange={(e) =>
                          onChange({
                            ...impact,
                            resourceEstimate: {
                              ...impact.resourceEstimate,
                              fte: Number(e.target.value),
                              duration: impact.resourceEstimate?.duration || '',
                              confidence: impact.resourceEstimate?.confidence || 'medium',
                            },
                          })
                        }
                        placeholder="0"
                        disabled={readOnly}
                        className="w-full px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        {t('myWork.impactAssessment.duration', 'Duration')}
                      </label>
                      <input
                        type="text"
                        value={impact.resourceEstimate?.duration || ''}
                        onChange={(e) =>
                          onChange({
                            ...impact,
                            resourceEstimate: {
                              ...impact.resourceEstimate,
                              fte: impact.resourceEstimate?.fte || 0,
                              duration: e.target.value,
                              confidence: impact.resourceEstimate?.confidence || 'medium',
                            },
                          })
                        }
                        placeholder="e.g. 3 months"
                        disabled={readOnly}
                        className="w-full px-2 py-1.5 text-sm rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <select
                      value={impact.resourceEstimate?.confidence || 'medium'}
                      onChange={(e) =>
                        onChange({
                          ...impact,
                          resourceEstimate: {
                            ...impact.resourceEstimate,
                            fte: impact.resourceEstimate?.fte || 0,
                            duration: impact.resourceEstimate?.duration || '',
                            confidence: e.target.value as 'low' | 'medium' | 'high',
                          },
                        })
                      }
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 focus:outline-none"
                    >
                      <option value="low">
                        {t('myWork.impactAssessment.lowConfidence3', 'Low confidence')}
                      </option>
                      <option value="medium">
                        {t('myWork.impactAssessment.mediumConfidence3', 'Medium confidence')}
                      </option>
                      <option value="high">
                        {t('myWork.impactAssessment.highConfidence3', 'High confidence')}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mt-4">
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">
                  {t(
                    'myWork.impactAssessment.additionalImpactDescription',
                    'Additional impact description'
                  )}
                </label>
                <textarea
                  value={impact.description || ''}
                  onChange={(e) => onChange({ ...impact, description: e.target.value })}
                  rows={2}
                  disabled={readOnly}
                  placeholder={t(
                    'myWork.impactAssessment.describeImpactDetails',
                    'Describe impact details...'
                  )}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-c-focus resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ImpactAssessmentCompact;
