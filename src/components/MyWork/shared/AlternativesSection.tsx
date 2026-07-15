/**
 * AlternativesSection
 * Enhanced alternatives management with comparison view and impact scoring
 * Professional design for decision-making
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  LayoutGrid,
  Lightbulb,
  List,
  Plus,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface Alternative {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  estimatedCost?: number;
  estimatedDuration?: string;
  isRecommended: boolean;
  // Extended fields
  impactScore?: {
    scope: 'low' | 'medium' | 'high';
    schedule: 'low' | 'medium' | 'high';
    cost: 'low' | 'medium' | 'high';
    quality: 'low' | 'medium' | 'high';
  };
  riskLevel?: 'low' | 'medium' | 'high';
  confidence?: 'low' | 'medium' | 'high';
}

interface AlternativesSectionProps {
  alternatives: Alternative[];
  selectedAlternativeId: string;
  status: string;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<Alternative>) => void;
  onRemove: (id: string) => void;
  onSetRecommended: (id: string) => void;
  onSelect: (id: string) => void;
  onGenerateAI?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  isGenerating?: boolean;
  readOnly?: boolean;
}

type ViewMode = 'list' | 'comparison';

export const AlternativesSection: React.FC<AlternativesSectionProps> = ({
  alternatives,
  selectedAlternativeId,
  status,
  onAdd,
  onUpdate,
  onRemove,
  onSetRecommended,
  onSelect,
  onGenerateAI,
  expanded = false,
  onToggleExpand,
  isGenerating = false,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const isPending = status === 'pending';

  // Calculate overall score for an alternative (simplified - based on pros/cons and recommendation)
  const calculateScore = (alt: Alternative): number => {
    const prosScore = alt.pros.filter((p) => p.trim()).length * 2;
    const consScore = alt.cons.filter((c) => c.trim()).length * -1.5;
    const recommendedBonus = alt.isRecommended ? 3 : 0;

    return Math.max(0, Math.min(10, 5 + prosScore + consScore + recommendedBonus));
  };

  // Sort alternatives by score
  const sortedAlternatives = useMemo(() => {
    return [...alternatives].sort((a, b) => calculateScore(b) - calculateScore(a));
  }, [alternatives]);

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-emerald-500';
    if (score >= 4) return 'text-amber-500';
    return 'text-danger-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Collapsible Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20">
            <Lightbulb size={18} className="text-amber-500 dark:text-amber-400" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('myWork.alternatives.alternatives', 'Alternatives')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          {expanded && alternatives.length >= 2 && (
            <div
              className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-navy-800 rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('list');
                }}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-navy-700 shadow-sm text-primary-600 dark:text-primary-400'
                    : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title={t('myWork.alternatives.title', 'List view')}
              >
                <List size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('comparison');
                }}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'comparison'
                    ? 'bg-white dark:bg-navy-700 shadow-sm text-primary-600 dark:text-primary-400'
                    : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title={t('myWork.alternatives.title2', 'Comparison view')}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          )}
          {alternatives.length > 0 && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-500">
              {alternatives.length}
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
                title={t('myWork.alternatives.title3', 'Generate AI')}
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
            <ChevronDown size={18} className="text-slate-600" />
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
            <div className="p-4">
              {viewMode === 'list' ? (
                // List View
                <div className="space-y-3">
                  {sortedAlternatives.map((alt, index) => {
                    const score = calculateScore(alt);
                    const isEditing = editingId === alt.id;

                    return (
                      <motion.div
                        key={alt.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-4 rounded-xl border transition-all ${
                          alt.isRecommended
                            ? 'border-amber-300 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-500/10'
                            : selectedAlternativeId === alt.id
                              ? 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10'
                              : 'border-slate-200 dark:border-navy-600 bg-slate-50/50 dark:bg-navy-800/50'
                        }`}
                      >
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                                index === 0
                                  ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white'
                                  : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={alt.title}
                                onChange={(e) => onUpdate(alt.id, { title: e.target.value })}
                                placeholder={t('myWork.alternatives.placeholder', 'Option name...')}
                                className="w-full font-semibold text-slate-800 dark:text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-primary-500/20 rounded px-1 -mx-1"
                              />
                              <div className="flex items-center gap-2 mt-1">
                                {alt.isRecommended && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                    <Star size={10} className="fill-current" />
                                    {t('myWork.alternatives.recommended', 'Recommended')}
                                  </span>
                                )}
                                {selectedAlternativeId === alt.id && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                    <Check size={10} />
                                    {t('myWork.alternatives.selected', 'Selected')}
                                  </span>
                                )}
                                <span className={`text-xs font-medium ${getScoreColor(score)}`}>
                                  {t('myWork.alternatives.score', 'Score')}: {score.toFixed(1)}/10
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onSetRecommended(alt.id)}
                              className={`p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors ${
                                alt.isRecommended ? 'text-amber-500' : 'text-slate-600'
                              }`}
                              title={t('myWork.alternatives.title4', 'Set as recommended')}
                            >
                              <Star size={16} className={alt.isRecommended ? 'fill-current' : ''} />
                            </button>
                            <button
                              onClick={() => onRemove(alt.id)}
                              className="p-1.5 rounded-lg hover:bg-danger-100 dark:hover:bg-danger-500/20 text-slate-600 hover:text-danger-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <textarea
                          value={alt.description}
                          onChange={(e) => onUpdate(alt.id, { description: e.target.value })}
                          placeholder={t(
                            'myWork.alternatives.placeholder2',
                            'Option description...'
                          )}
                          rows={2}
                          className="w-full mb-3 px-2 py-1.5 rounded-lg text-sm bg-white/50 dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 placeholder-slate-400 focus:outline-none focus:border-primary-400 resize-none"
                        />

                        {/* Pros & Cons */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Pros */}
                          <div>
                            <div className="flex items-center gap-1 mb-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <ThumbsUp size={12} />
                              <span>{t('myWork.alternatives.pros', 'Pros')}</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                ({alt.pros.filter((p) => p.trim()).length})
                              </span>
                            </div>
                            <div className="space-y-1">
                              {alt.pros.map((pro, i) => (
                                <div key={i} className="flex items-center gap-1 group">
                                  <span className="text-emerald-500 text-xs">+</span>
                                  <input
                                    type="text"
                                    value={pro}
                                    onChange={(e) => {
                                      const newPros = [...alt.pros];
                                      newPros[i] = e.target.value;
                                      onUpdate(alt.id, { pros: newPros });
                                    }}
                                    className="flex-1 text-xs bg-transparent text-slate-600 dark:text-slate-400 focus:outline-none"
                                    placeholder={t(
                                      'myWork.alternatives.placeholder3',
                                      'Add pro...'
                                    )}
                                  />
                                  <button
                                    onClick={() => {
                                      onUpdate(alt.id, {
                                        pros: alt.pros.filter((_, idx) => idx !== i),
                                      });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-danger-500 transition-opacity"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => onUpdate(alt.id, { pros: [...alt.pros, ''] })}
                                className="text-xs text-emerald-500 hover:text-emerald-600 flex items-center gap-1"
                              >
                                <Plus size={10} />
                                {t('myWork.alternatives.add', 'Add')}
                              </button>
                            </div>
                          </div>

                          {/* Cons */}
                          <div>
                            <div className="flex items-center gap-1 mb-2 text-xs font-medium text-danger-600 dark:text-danger-400">
                              <ThumbsDown size={12} />
                              <span>{t('myWork.alternatives.cons', 'Cons')}</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                ({alt.cons.filter((c) => c.trim()).length})
                              </span>
                            </div>
                            <div className="space-y-1">
                              {alt.cons.map((con, i) => (
                                <div key={i} className="flex items-center gap-1 group">
                                  <span className="text-danger-500 text-xs">-</span>
                                  <input
                                    type="text"
                                    value={con}
                                    onChange={(e) => {
                                      const newCons = [...alt.cons];
                                      newCons[i] = e.target.value;
                                      onUpdate(alt.id, { cons: newCons });
                                    }}
                                    className="flex-1 text-xs bg-transparent text-slate-600 dark:text-slate-400 focus:outline-none"
                                    placeholder={t(
                                      'myWork.alternatives.placeholder4',
                                      'Add con...'
                                    )}
                                  />
                                  <button
                                    onClick={() => {
                                      onUpdate(alt.id, {
                                        cons: alt.cons.filter((_, idx) => idx !== i),
                                      });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-danger-500 transition-opacity"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => onUpdate(alt.id, { cons: [...alt.cons, ''] })}
                                className="text-xs text-danger-500 hover:text-danger-600 flex items-center gap-1"
                              >
                                <Plus size={10} />
                                {t('myWork.alternatives.add2', 'Add')}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Select as chosen (only when not pending) */}
                        {!isPending && (
                          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-navy-700">
                            <button
                              onClick={() => onSelect(alt.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                selectedAlternativeId === alt.id
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:text-emerald-600 dark:hover:text-emerald-400'
                              }`}
                            >
                              <Check size={14} />
                              {selectedAlternativeId === alt.id
                                ? t('myWork.alternatives.selectedOption', 'Selected option')
                                : t('myWork.alternatives.selectThisOption', 'Select this option')}
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                // Comparison View
                <div className="overflow-x-auto">
                  <table
                    /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */ className="w-full text-sm"
                  >
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-navy-700">
                        <th className="text-left py-3 px-2 text-slate-500 dark:text-slate-400 font-medium">
                          {t('myWork.alternatives.criteria', 'Criteria')}
                        </th>
                        {sortedAlternatives.map((alt, index) => (
                          <th
                            key={alt.id}
                            className={`text-center py-3 px-4 font-semibold ${
                              alt.isRecommended
                                ? 'text-amber-600 dark:text-amber-400'
                                : selectedAlternativeId === alt.id
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                  index === 0
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span className="truncate max-w-[120px]">
                                {alt.title || `Option ${index + 1}`}
                              </span>
                              {alt.isRecommended && (
                                <Star size={12} className="text-amber-500 fill-current" />
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Score row */}
                      <tr className="border-b border-slate-200 dark:border-navy-800">
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                          {t('myWork.alternatives.score2', 'Score')}
                        </td>
                        {sortedAlternatives.map((alt) => {
                          const score = calculateScore(alt);
                          return (
                            <td key={alt.id} className="text-center py-3 px-4">
                              <span className={`text-lg font-bold ${getScoreColor(score)}`}>
                                {score.toFixed(1)}
                              </span>
                              <span className="text-slate-600 text-xs">/10</span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Pros count row */}
                      <tr className="border-b border-slate-200 dark:border-navy-800">
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <ThumbsUp size={14} className="text-emerald-500" />
                          {t('myWork.alternatives.pros2', 'Pros')}
                        </td>
                        {sortedAlternatives.map((alt) => (
                          <td key={alt.id} className="text-center py-3 px-4">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {alt.pros.filter((p) => p.trim()).length}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Cons count row */}
                      <tr>
                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <ThumbsDown size={14} className="text-danger-500" />
                          {t('myWork.alternatives.cons2', 'Cons')}
                        </td>
                        {sortedAlternatives.map((alt) => (
                          <td key={alt.id} className="text-center py-3 px-4">
                            <span className="text-danger-600 dark:text-danger-400 font-medium">
                              {alt.cons.filter((c) => c.trim()).length}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add alternative button */}
              <div className="mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onAdd}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-primary-400 dark:hover:border-primary-500/50 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-500/10 transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                >
                  <Plus size={18} />
                  <span>{t('myWork.alternatives.addAlternative', 'Add alternative')}</span>
                </motion.button>
              </div>

              {/* Recommendation hint */}
              {alternatives.length >= 2 && !alternatives.some((a) => a.isRecommended) && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <Star size={14} />
                    <span>
                      {t(
                        'myWork.alternatives.tipMarkOneAlternative',
                        'Tip: Mark one alternative as recommended'
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AlternativesSection;
