/**
 * AIInsightSection
 * AI-generated insights and recommendations for tasks
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  Clock,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface AIInsight {
  id: string;
  type: 'recommendation' | 'warning' | 'prediction' | 'optimization';
  title: string;
  description: string;
  confidence: 'low' | 'medium' | 'high';
  createdAt: string;
  actionable?: boolean;
  actionText?: string;
}

interface AIInsightSectionProps {
  insights: AIInsight[];
  onGenerateInsights?: () => void;
  onDismissInsight?: (id: string) => void;
  onActionInsight?: (id: string) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  isGenerating?: boolean;
  lastGeneratedAt?: string;
}

const INSIGHT_TYPES = {
  recommendation: {
    label: { en: 'Recommendation', pl: 'Rekomendacja' },
    icon: Lightbulb,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
  },
  warning: {
    label: { en: 'Warning', pl: 'Ostrzeżenie' },
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    borderColor: 'border-amber-200 dark:border-amber-500/30',
  },
  prediction: {
    label: { en: 'Prediction', pl: 'Predykcja' },
    icon: TrendingUp,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
  },
  optimization: {
    label: { en: 'Optimization', pl: 'Optymalizacja' },
    icon: Zap,
    color: 'text-primary-500',
    bgColor: 'bg-primary-500/10 dark:bg-primary-500/20',
    borderColor: 'border-primary-200 dark:border-primary-500/30',
  },
};

const CONFIDENCE_CONFIG = {
  low: {
    label: { en: 'Low confidence', pl: 'Niska pewność' },
    color: 'text-slate-500 dark:text-slate-400',
    dots: 1,
  },
  medium: {
    label: { en: 'Medium confidence', pl: 'Średnia pewność' },
    color: 'text-amber-500',
    dots: 2,
  },
  high: {
    label: { en: 'High confidence', pl: 'Wysoka pewność' },
    color: 'text-emerald-500',
    dots: 3,
  },
};

export const AIInsightSection: React.FC<AIInsightSectionProps> = ({
  insights,
  onGenerateInsights,
  onDismissInsight,
  onActionInsight,
  expanded = false,
  onToggleExpand,
  isGenerating = false,
  lastGeneratedAt,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const warningsCount = insights.filter((i) => i.type === 'warning').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Collapsible Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500/10 to-crimson-500/10 dark:from-primary-500/20 dark:to-crimson-500/20">
            <Brain size={18} className="text-primary-500 dark:text-primary-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('myWork.aiInsight.aIInsights', 'AI Insights')}
          </span>
          {warningsCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={10} />
              {warningsCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {insights.length > 0 && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {insights.length}
            </span>
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* Generate Button */}
              {onGenerateInsights && (
                <div className="flex items-center justify-between">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onGenerateInsights}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-500 to-crimson-500 text-white text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20"
                  >
                    {isGenerating ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    <span>
                      {isGenerating
                        ? t('myWork.aiInsight.analyzing', 'Analyzing...')
                        : t('myWork.aiInsight.generateInsights', 'Generate Insights')}
                    </span>
                  </motion.button>
                  {lastGeneratedAt && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(lastGeneratedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}

              {/* Insights List */}
              {insights.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                  <Brain
                    size={32}
                    className="mx-auto mb-2 text-slate-700 dark:text-slate-400"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {t('myWork.aiInsight.noAIInsightsYet', 'No AI insights yet')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
                    {t('myWork.aiInsight.clickGenerateInsightsTo', 'Click "Generate Insights" to get recommendations')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {insights.map((insight) => {
                    const typeConfig = INSIGHT_TYPES[insight.type];
                    const confidenceConfig = CONFIDENCE_CONFIG[insight.confidence];
                    const Icon = typeConfig.icon;

                    return (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`rounded-xl border ${typeConfig.borderColor} ${typeConfig.bgColor} overflow-hidden`}
                      >
                        <div className="px-4 py-3">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Icon size={16} className={typeConfig.color} />
                              <span className={`text-xs font-medium ${typeConfig.color}`}>
                                {isPolish ? typeConfig.label.pl : typeConfig.label.en}
                              </span>
                            </div>
                            {/* Confidence indicator */}
                            <div
                              className="flex items-center gap-1"
                              title={
                                isPolish ? confidenceConfig.label.pl : confidenceConfig.label.en
                              }
                            >
                              {[1, 2, 3].map((dot) => (
                                <div
                                  key={dot}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    dot <= confidenceConfig.dots
                                      ? confidenceConfig.color.replace('text-', 'bg-')
                                      : 'bg-slate-300 dark:bg-slate-600'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Title */}
                          <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-1">
                            {insight.title}
                          </h4>

                          {/* Description */}
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {insight.description}
                          </p>

                          {/* Actions */}
                          {(insight.actionable || onDismissInsight) && (
                            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200 dark:border-navy-600/50">
                              {insight.actionable && onActionInsight && (
                                <button
                                  onClick={() => onActionInsight(insight.id)}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${typeConfig.bgColor} ${typeConfig.color} hover:brightness-95 transition-colors`}
                                >
                                  <Target size={12} />
                                  {insight.actionText || (t('myWork.aiInsight.apply', 'Apply'))}
                                </button>
                              )}
                              {onDismissInsight && (
                                <button
                                  onClick={() => onDismissInsight(insight.id)}
                                  className="px-3 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                                >
                                  {t('myWork.aiInsight.dismiss', 'Dismiss')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* AI Disclaimer */}
              <div className="text-center pt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  {t('myWork.aiInsight.aIGeneratedInsightsVerify', 'AI-generated insights. Verify before applying.')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AIInsightSection;
