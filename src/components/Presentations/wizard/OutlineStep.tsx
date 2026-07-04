import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Camera,
  ChevronRight,
  Eye,
  GripVertical,
  Image,
  Lightbulb,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type CardIntent, INTENT_COLORS, type IntentInfo, type OutlineItem } from './types';

interface OutlineStepProps {
  outline: OutlineItem[];
  intents: IntentInfo[];
  onOutlineChange: (outline: OutlineItem[]) => void;
  onBack: () => void;
  onGenerate: () => void;
}

const IMAGE_HINT_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  org_photo: Camera,
  ai_image: Sparkles,
  chart: BarChart3,
  diagram: Image,
  none: X,
};

const ALL_INTENTS: CardIntent[] = [
  'cover',
  'executive_summary',
  'section_intro',
  'key_messages',
  'performance_overview',
  'single_insight',
  'comparison',
  'assessment',
  'recommendation_portfolio',
  'initiative_portfolio',
  'prioritization_matrix',
  'roadmap',
  'risk_management',
  'next_steps',
  'appendix',
];

export const OutlineStep: React.FC<OutlineStepProps> = ({
  outline: outlineProp,
  intents,
  onOutlineChange,
  onBack,
  onGenerate,
}) => {
  const { t } = useTranslation();
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const outline = Array.isArray(outlineProp) ? outlineProp : [];

  const enabledSlides = useMemo(() => outline.filter((o) => o.enabled), [outline]);

  const validation = useMemo(() => {
    const warnings: string[] = [];
    if (enabledSlides.length < 2) {
      warnings.push(t('presentations.outline.validation.minSlides', 'Minimum 2 slides required'));
    }
    if (enabledSlides.length > 30) {
      warnings.push(t('presentations.outline.validation.maxSlides', 'Maximum 30 slides exceeded'));
    }
    if (enabledSlides.length > 20) {
      warnings.push(
        t(
          'presentations.outline.validation.tooMany',
          'Consider splitting into two presentations (>20 slides)'
        )
      );
    }
    if (!enabledSlides.some((s) => s.intent === 'cover')) {
      warnings.push(t('presentations.outline.validation.noCover', 'Missing cover slide'));
    }
    return warnings;
  }, [enabledSlides, t]);

  const aiSuggestions = useMemo(() => {
    const suggestions: { intent: CardIntent; labelKey: string }[] = [];
    const hasIntent = (i: CardIntent) => enabledSlides.some((s) => s.intent === i);

    if (!hasIntent('risk_management') && enabledSlides.length > 3) {
      suggestions.push({
        intent: 'risk_management',
        labelKey: 'presentations.outline.suggestions.addRisk',
      });
    }
    if (!hasIntent('performance_overview') && enabledSlides.length > 3) {
      suggestions.push({
        intent: 'performance_overview',
        labelKey: 'presentations.outline.suggestions.addKpi',
      });
    }
    if (!hasIntent('next_steps')) {
      suggestions.push({
        intent: 'next_steps',
        labelKey: 'presentations.outline.suggestions.addNextSteps',
      });
    }
    if (!hasIntent('appendix') && enabledSlides.length > 5) {
      suggestions.push({
        intent: 'appendix',
        labelKey: 'presentations.outline.suggestions.addAppendix',
      });
    }
    return suggestions;
  }, [enabledSlides]);

  const toggleSlide = (index: number) => {
    const updated = outline.map((item, i) =>
      i === index ? { ...item, enabled: !item.enabled } : item
    );
    onOutlineChange(updated);
  };

  const removeSlide = (index: number) => {
    onOutlineChange(outline.filter((_, i) => i !== index));
  };

  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= outline.length) return;
    const arr = [...outline];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    onOutlineChange(arr);
  };

  const addSlide = (intent: CardIntent) => {
    const info = intents.find((i) => i.id === intent);
    onOutlineChange([
      ...outline,
      {
        intent,
        title: info?.label || intent.replace(/_/g, ' '),
        enabled: true,
        imageHint:
          intent === 'performance_overview' || intent === 'single_insight' ? 'chart' : undefined,
      },
    ]);
    setAddMenuOpen(false);
  };

  const updateSlide = (index: number, updates: Partial<OutlineItem>) => {
    const updated = outline.map((item, i) => (i === index ? { ...item, ...updates } : item));
    onOutlineChange(updated);
  };

  const changeIntent = (index: number, newIntent: CardIntent) => {
    const info = intents.find((i) => i.id === newIntent);
    updateSlide(index, {
      intent: newIntent,
      title: info?.label || newIntent.replace(/_/g, ' '),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('presentations.outline.title', 'Deck Outline')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'presentations.outline.header',
              'AI proposed {{count}} slides. Drag to reorder. Click to edit.',
              { count: enabledSlides.length }
            )}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setAddMenuOpen(!addMenuOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-700 dark:text-slate-200 hover:border-slate-400"
          >
            <Plus size={14} /> {t('presentations.outline.addSlide', 'Add slide')}
          </button>
          {addMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
              {ALL_INTENTS.map((intent) => (
                <button
                  key={intent}
                  onClick={() => addSlide(intent)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-700 flex items-center gap-2"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${INTENT_COLORS[intent] || 'bg-slate-400'}`}
                  />
                  <span className="text-slate-700 dark:text-slate-200 capitalize">
                    {intent.replace(/_/g, ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Validation Warnings */}
      {validation.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-3">
          {validation.map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300"
            >
              <AlertTriangle size={14} className="text-yellow-500 flex-shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Outline Cards */}
      <div className="space-y-2">
        {outline.map((item, index) => (
          <div
            key={`${item.intent}-${index}`}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
              item.enabled
                ? 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700'
                : 'bg-slate-50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-800 opacity-60'
            }`}
          >
            {/* Drag handle + reorder */}
            <div className="flex flex-col gap-1 pt-1">
              <GripVertical size={14} className="text-slate-600 cursor-grab" />
              <button
                onClick={() => moveSlide(index, index - 1)}
                disabled={index === 0}
                className="text-slate-600 hover:text-slate-600 disabled:opacity-30"
              >
                <ChevronRight size={14} className="-rotate-90" />
              </button>
              <button
                onClick={() => moveSlide(index, index + 1)}
                disabled={index === outline.length - 1}
                className="text-slate-600 hover:text-slate-600 disabled:opacity-30"
              >
                <ChevronRight size={14} className="rotate-90" />
              </button>
            </div>

            {/* Card number */}
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500/10 text-primary-500 text-xs font-bold flex-shrink-0">
              {index + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Editable title */}
                <input
                  value={item.title}
                  onChange={(e) => updateSlide(index, { title: e.target.value })}
                  className="font-medium text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-1 focus:ring-c-focus text-sm flex-1 min-w-[120px]"
                />

                {/* Intent badge (dropdown) */}
                <select
                  value={item.intent}
                  onChange={(e) => changeIntent(index, e.target.value as CardIntent)}
                  className={`text-[10px] px-2 py-0.5 rounded-full text-white font-medium ${INTENT_COLORS[item.intent] || 'bg-slate-500'} border-none cursor-pointer`}
                >
                  {ALL_INTENTS.map((intent) => (
                    <option key={intent} value={intent}>
                      {intent.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>

                {/* Image hint */}
                {item.imageHint &&
                  item.imageHint !== 'none' &&
                  (() => {
                    const HintIcon = IMAGE_HINT_ICONS[item.imageHint] || Image;
                    return (
                      <span className="text-slate-600" title={`Image: ${item.imageHint}`}>
                        <HintIcon size={12} />
                      </span>
                    );
                  })()}
              </div>

              {/* Content hint (editable) */}
              <input
                value={item.contentHint || ''}
                onChange={(e) => updateSlide(index, { contentHint: e.target.value })}
                placeholder={t(
                  'presentations.outline.contentHintPlaceholder',
                  'Content hint: describe what this slide should contain...'
                )}
                className="text-xs text-slate-500 dark:text-slate-400 mt-1 bg-transparent border-none outline-none focus:ring-1 focus:ring-c-focus w-full"
              />

              <input
                value={item.keyMessage || ''}
                onChange={(e) => updateSlide(index, { keyMessage: e.target.value })}
                placeholder={t(
                  'presentations.outline.keyMessagePlaceholder',
                  'Key message for this slide...'
                )}
                className="text-xs text-slate-600 dark:text-slate-300 mt-1 bg-transparent border-none outline-none focus:ring-1 focus:ring-c-focus w-full"
              />

              {/* Source references */}
              {(item.sourceRef ||
                item.layoutHint ||
                item.visualPolicy ||
                item.confidence !== undefined) && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {item.sourceRef && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      source: {item.sourceRef}
                    </span>
                  )}
                  {item.confidence !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      confidence: {Math.round(item.confidence * 100)}%
                    </span>
                  )}
                  {item.layoutHint && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300">
                      {item.layoutHint}
                    </span>
                  )}
                  {item.visualPolicy && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300">
                      {item.visualPolicy}
                    </span>
                  )}
                </div>
              )}
              {Array.isArray(item.warnings) && item.warnings.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {item.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300"
                    >
                      <AlertTriangle size={11} />
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => toggleSlide(index)}
                className={`p-1.5 rounded-lg transition-colors ${
                  item.enabled
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-slate-200 dark:bg-navy-700 text-slate-600'
                }`}
              >
                {item.enabled ? <Eye size={14} /> : <X size={14} />}
              </button>
              <button
                onClick={() => removeSlide(index)}
                className="p-1.5 rounded-lg text-danger-400 hover:bg-danger-500/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* AI Suggestions Strip */}
      {aiSuggestions.length > 0 && (
        <div className="bg-primary-50 dark:bg-primary-500/5 border border-primary-200 dark:border-primary-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={14} className="text-primary-500" />
            <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {t('presentations.outline.aiRecommends', 'AI recommends adding:')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiSuggestions.map((suggestion) => (
              <button
                key={suggestion.intent}
                onClick={() => addSlide(suggestion.intent)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-primary-200 dark:border-primary-500/30 text-sm text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors"
              >
                <Plus size={12} />
                <span className="capitalize">{suggestion.intent.replace(/_/g, ' ')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft size={16} /> {t('common.back', 'Back')}
        </button>
        <button
          onClick={onGenerate}
          disabled={enabledSlides.length < 2}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-blue-600 text-white font-medium rounded-xl hover:from-primary-500 hover:to-blue-500 disabled:opacity-50 shadow-lg shadow-primary-500/25"
        >
          <Play size={16} /> {t('presentations.outline.generate', 'Generate Deck')} (
          {enabledSlides.length} {t('presentations.outline.slides', 'slides')})
        </button>
      </div>
    </div>
  );
};
