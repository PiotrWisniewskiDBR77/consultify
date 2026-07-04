/**
 * RiskAssessmentCompact
 * Compact risk assessment component for decision detail view
 * Supports multiple risks with AI generation
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface RiskItem {
  id: string;
  title: string;
  probability: 'low' | 'medium' | 'high' | 'critical';
  impact: 'low' | 'medium' | 'high' | 'critical';
  category: 'technical' | 'business' | 'operational' | 'financial' | 'legal' | 'other';
  mitigation: string;
  contingency: string;
}

interface RiskAssessmentCompactProps {
  risks: RiskItem[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<RiskItem>) => void;
  onRemove: (id: string) => void;
  onGenerateAI?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  readOnly?: boolean;
  isGenerating?: boolean;
}

const RISK_LEVELS = {
  low: {
    label: { en: 'Low', pl: 'Niskie' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    score: 1,
  },
  medium: {
    label: { en: 'Medium', pl: 'Średnie' },
    color: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    score: 2,
  },
  high: {
    label: { en: 'High', pl: 'Wysokie' },
    color: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    score: 3,
  },
  critical: {
    label: { en: 'Critical', pl: 'Krytyczne' },
    color: 'bg-danger-500',
    textColor: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-500/10 dark:bg-danger-500/20',
    score: 4,
  },
};

const RISK_CATEGORIES = {
  technical: { label: { en: 'Technical', pl: 'Techniczne' }, color: 'text-blue-500' },
  business: { label: { en: 'Business', pl: 'Biznesowe' }, color: 'text-primary-500' },
  operational: { label: { en: 'Operational', pl: 'Operacyjne' }, color: 'text-blue-500' },
  financial: { label: { en: 'Financial', pl: 'Finansowe' }, color: 'text-emerald-500' },
  legal: { label: { en: 'Legal', pl: 'Prawne' }, color: 'text-amber-500' },
  other: { label: { en: 'Other', pl: 'Inne' }, color: 'text-slate-500' },
};

export const RiskAssessmentCompact: React.FC<RiskAssessmentCompactProps> = ({
  risks,
  onAdd,
  onUpdate,
  onRemove,
  onGenerateAI,
  expanded = false,
  onToggleExpand,
  readOnly = false,
  isGenerating = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [editingId, setEditingId] = useState<string | null>(null);

  // Calculate overall risk level based on all risks
  const overallRisk = useMemo(() => {
    if (risks.length === 0) return 'low';

    const maxScore = Math.max(
      ...risks.map((r) => {
        const probScore = RISK_LEVELS[r.probability]?.score || 1;
        const impactScore = RISK_LEVELS[r.impact]?.score || 1;
        return probScore * impactScore;
      })
    );

    if (maxScore <= 2) return 'low';
    if (maxScore <= 6) return 'medium';
    if (maxScore <= 12) return 'high';
    return 'critical';
  }, [risks]);

  const riskConfig = RISK_LEVELS[overallRisk];

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low':
        return <ShieldCheck size={16} className="text-emerald-500" />;
      case 'medium':
        return <Shield size={16} className="text-amber-500" />;
      case 'high':
        return <ShieldAlert size={16} className="text-amber-500" />;
      case 'critical':
        return <AlertTriangle size={16} className="text-danger-500" />;
      default:
        return <Shield size={16} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  const calculateRiskScore = (risk: RiskItem) => {
    const probScore = RISK_LEVELS[risk.probability]?.score || 1;
    const impactScore = RISK_LEVELS[risk.impact]?.score || 1;
    return probScore * impactScore;
  };

  const getRiskLevelFromScore = (score: number) => {
    if (score <= 2) return 'low';
    if (score <= 6) return 'medium';
    if (score <= 12) return 'high';
    return 'critical';
  };

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
          <div className={`p-2 rounded-xl ${riskConfig.bgColor}`}>{getRiskIcon(overallRisk)}</div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {isPolish ? 'Analiza ryzyka' : 'Risk Analysis'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {risks.length > 0 && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {risks.length}
            </span>
          )}
          {/* AI Button - visible only when expanded */}
          <AnimatePresence>
            {expanded && onGenerateAI && !readOnly && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateAI();
                }}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 dark:hover:bg-primary-500/30 text-xs font-medium transition-all disabled:opacity-50"
                title={isPolish ? 'Generuj AI' : 'Generate AI'}
              >
                {isGenerating ? (
                  <Sparkles size={14} className="animate-pulse" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>AI</span>
              </motion.button>
            )}
          </AnimatePresence>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* Risk List */}
              {risks.length === 0 ? (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  <Shield size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {isPolish ? 'Brak zidentyfikowanych ryzyk' : 'No risks identified'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {risks.map((risk) => {
                    const score = calculateRiskScore(risk);
                    const riskLevel = getRiskLevelFromScore(score);
                    const levelConfig = RISK_LEVELS[riskLevel];
                    const isEditing = editingId === risk.id;

                    return (
                      <motion.div
                        key={risk.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`rounded-xl border ${
                          isEditing
                            ? 'border-primary-300 dark:border-primary-500/50 bg-primary-50/50 dark:bg-primary-500/5'
                            : 'border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-800/50'
                        } overflow-hidden`}
                      >
                        {/* Risk Header */}
                        <div
                          className="flex items-center justify-between px-4 py-3 cursor-pointer"
                          onClick={() => setEditingId(isEditing ? null : risk.id)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-3 h-3 rounded-full ${levelConfig.color}`} />
                            <input
                              type="text"
                              value={risk.title}
                              onChange={(e) => {
                                e.stopPropagation();
                                onUpdate(risk.id, { title: e.target.value });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 text-sm font-medium bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none truncate"
                              placeholder={isPolish ? 'Nazwa ryzyka...' : 'Risk name...'}
                              readOnly={readOnly}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${levelConfig.bgColor} ${levelConfig.textColor}`}
                            >
                              {isPolish ? levelConfig.label.pl : levelConfig.label.en}
                            </span>
                            {!readOnly && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemove(risk.id);
                                }}
                                className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-500/20 text-slate-500 dark:text-slate-400 hover:text-danger-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            <ChevronDown
                              size={16}
                              className={`text-slate-500 dark:text-slate-400 transition-transform ${isEditing ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </div>

                        {/* Risk Details (Expanded) */}
                        <AnimatePresence>
                          {isEditing && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 space-y-3 border-t border-slate-200 dark:border-navy-600 pt-3">
                                {/* Category & Probability & Impact */}
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                      {isPolish ? 'Kategoria' : 'Category'}
                                    </label>
                                    <select
                                      value={risk.category}
                                      onChange={(e) =>
                                        onUpdate(risk.id, {
                                          category: e.target.value as RiskItem['category'],
                                        })
                                      }
                                      disabled={readOnly}
                                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus-solid"
                                    >
                                      {Object.entries(RISK_CATEGORIES).map(([key, config]) => (
                                        <option key={key} value={key}>
                                          {isPolish ? config.label.pl : config.label.en}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                      <TrendingUp size={10} />
                                      {isPolish ? 'Prawdop.' : 'Probability'}
                                    </label>
                                    <select
                                      value={risk.probability}
                                      onChange={(e) =>
                                        onUpdate(risk.id, {
                                          probability: e.target.value as RiskItem['probability'],
                                        })
                                      }
                                      disabled={readOnly}
                                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus-solid"
                                    >
                                      {Object.entries(RISK_LEVELS).map(([key, config]) => (
                                        <option key={key} value={key}>
                                          {isPolish ? config.label.pl : config.label.en}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                      <TrendingDown size={10} />
                                      {isPolish ? 'Wpływ' : 'Impact'}
                                    </label>
                                    <select
                                      value={risk.impact}
                                      onChange={(e) =>
                                        onUpdate(risk.id, {
                                          impact: e.target.value as RiskItem['impact'],
                                        })
                                      }
                                      disabled={readOnly}
                                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-focus-solid"
                                    >
                                      {Object.entries(RISK_LEVELS).map(([key, config]) => (
                                        <option key={key} value={key}>
                                          {isPolish ? config.label.pl : config.label.en}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* Mitigation */}
                                <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    {isPolish ? 'Plan mitygacji' : 'Mitigation Plan'}
                                  </label>
                                  <textarea
                                    value={risk.mitigation}
                                    onChange={(e) =>
                                      onUpdate(risk.id, { mitigation: e.target.value })
                                    }
                                    rows={2}
                                    disabled={readOnly}
                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-c-focus-solid resize-none"
                                    placeholder={
                                      isPolish
                                        ? 'Działania minimalizujące ryzyko...'
                                        : 'Actions to minimize risk...'
                                    }
                                  />
                                </div>

                                {/* Contingency */}
                                <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    {isPolish ? 'Plan awaryjny' : 'Contingency Plan'}
                                  </label>
                                  <textarea
                                    value={risk.contingency}
                                    onChange={(e) =>
                                      onUpdate(risk.id, { contingency: e.target.value })
                                    }
                                    rows={2}
                                    disabled={readOnly}
                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-c-focus-solid resize-none"
                                    placeholder={
                                      isPolish
                                        ? 'Plan na wypadek materializacji...'
                                        : 'Plan if risk materializes...'
                                    }
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Add Risk Button */}
              {!readOnly && (
                <div className="pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onAdd}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  >
                    <Plus size={18} />
                    <span className="text-sm font-medium">
                      {isPolish ? 'Dodaj ryzyko' : 'Add risk'}
                    </span>
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RiskAssessmentCompact;
