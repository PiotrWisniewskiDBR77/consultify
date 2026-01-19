/**
 * InitiativeComposer - Modal for creating initiatives from tool outputs
 *
 * Pre-fills initiative form with data from strategic analysis tools.
 * Supports linking to source tool findings and AI-generated rationale.
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Lightbulb,
  Target,
  TrendingUp,
  Shield,
  Rocket,
  AlertTriangle,
  Check,
  Loader2,
  Link2,
  Sparkles,
} from 'lucide-react';

import { InitiativeDraft, ToolType, SWOTItem, SWOTCorrelation } from '@/store/useToolStore';
import { InitiativeApi, Initiative } from '@/services/api/initiatives.api';

// ==================== TYPES ====================

interface InitiativeComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (initiative: Initiative) => void;
  toolType: ToolType;
  sessionId: string;
  prefillData?: InitiativeDraft;
  linkedItems?: Array<SWOTItem | SWOTCorrelation>;
  projectId?: string;
  isPolish: boolean;
}

type InitiativeType = 'strategic' | 'operational' | 'defensive' | 'growth';
type Priority = 'low' | 'medium' | 'high' | 'critical';
type Impact = 'low' | 'medium' | 'high';
type Effort = 'low' | 'medium' | 'high';

interface FormData {
  title: string;
  description: string;
  type: InitiativeType;
  priority: Priority;
  estimatedImpact: Impact;
  estimatedEffort: Effort;
  rationale: string;
  owner: string;
  category: string;
  tags: string[];
}

// ==================== CONSTANTS ====================

const TYPE_CONFIG: Record<InitiativeType, { icon: React.ElementType; color: string; label: { en: string; pl: string } }> = {
  strategic: {
    icon: Target,
    color: 'purple',
    label: { en: 'Strategic', pl: 'Strategiczna' },
  },
  operational: {
    icon: TrendingUp,
    color: 'blue',
    label: { en: 'Operational', pl: 'Operacyjna' },
  },
  defensive: {
    icon: Shield,
    color: 'amber',
    label: { en: 'Defensive', pl: 'Defensywna' },
  },
  growth: {
    icon: Rocket,
    color: 'emerald',
    label: { en: 'Growth', pl: 'Wzrostowa' },
  },
};

const PRIORITY_CONFIG: Record<Priority, { color: string; label: { en: string; pl: string } }> = {
  low: { color: 'slate', label: { en: 'Low', pl: 'Niski' } },
  medium: { color: 'blue', label: { en: 'Medium', pl: 'Średni' } },
  high: { color: 'amber', label: { en: 'High', pl: 'Wysoki' } },
  critical: { color: 'red', label: { en: 'Critical', pl: 'Krytyczny' } },
};

const IMPACT_EFFORT_LABELS = {
  low: { en: 'Low', pl: 'Niski' },
  medium: { en: 'Medium', pl: 'Średni' },
  high: { en: 'High', pl: 'Wysoki' },
};

// ==================== COMPONENT ====================

export const InitiativeComposer: React.FC<InitiativeComposerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  toolType,
  sessionId,
  prefillData,
  linkedItems = [],
  projectId,
  isPolish,
}) => {
  const { t } = useTranslation();
  const lang = isPolish ? 'pl' : 'en';

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: prefillData?.title || '',
    description: prefillData?.description || '',
    type: prefillData?.type || 'strategic',
    priority: 'medium',
    estimatedImpact: prefillData?.estimatedImpact || 'medium',
    estimatedEffort: prefillData?.estimatedEffort || 'medium',
    rationale: prefillData?.rationale || '',
    owner: '',
    category: '',
    tags: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Update form field
  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Add tag
  const addTag = useCallback(() => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      updateField('tags', [...formData.tags, tagInput.trim()]);
      setTagInput('');
    }
  }, [tagInput, formData.tags, updateField]);

  // Remove tag
  const removeTag = useCallback((tag: string) => {
    updateField('tags', formData.tags.filter((t) => t !== tag));
  }, [formData.tags, updateField]);

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError(isPolish ? 'Tytuł jest wymagany' : 'Title is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const initiativeData: Partial<Initiative> = {
        projectId: projectId || 'default',
        title: formData.title,
        description: formData.description,
        status: 'draft',
        priority: formData.priority,
        category: formData.category || `${toolType}-analysis`,
        tags: [
          ...formData.tags,
          `source:${toolType}`,
          `session:${sessionId}`,
          `type:${formData.type}`,
        ],
        // Store metadata as part of description for now
        // In a real implementation, these would be stored in dedicated fields
      };

      const created = await InitiativeApi.createInitiative(initiativeData);

      if (onSuccess) {
        onSuccess(created);
      }

      onClose();
    } catch (err) {
      console.error('[InitiativeComposer] Error creating initiative:', err);
      setError(isPolish ? 'Nie udało się utworzyć inicjatywy' : 'Failed to create initiative');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white dark:bg-navy-900 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Utwórz inicjatywę' : 'Create Initiative'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isPolish ? 'Z analizy strategicznej' : 'From strategic analysis'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Linked items info */}
            {linkedItems.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Link2 className="w-4 h-4" />
                  <span>
                    {isPolish
                      ? `Powiązane z ${linkedItems.length} elementami analizy`
                      : `Linked to ${linkedItems.length} analysis items`}
                  </span>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPolish ? 'Tytuł inicjatywy' : 'Initiative Title'} *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder={isPolish ? 'Np. Wdrożenie systemu CRM' : 'E.g., Implement CRM system'}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPolish ? 'Opis' : 'Description'}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={isPolish ? 'Opisz cel i zakres inicjatywy...' : 'Describe the goal and scope...'}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Type selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPolish ? 'Typ inicjatywy' : 'Initiative Type'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(TYPE_CONFIG) as InitiativeType[]).map((type) => {
                  const config = TYPE_CONFIG[type];
                  const Icon = config.icon;
                  const isSelected = formData.type === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateField('type', type)}
                      className={`
                        flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                        ${isSelected
                          ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20`
                          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? `text-${config.color}-600 dark:text-${config.color}-400` : 'text-slate-400'}`} />
                      <span className={`text-xs font-medium ${isSelected ? `text-${config.color}-700 dark:text-${config.color}-300` : 'text-slate-600 dark:text-slate-400'}`}>
                        {config.label[lang]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPolish ? 'Priorytet' : 'Priority'}
              </label>
              <div className="flex gap-2">
                {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((priority) => {
                  const config = PRIORITY_CONFIG[priority];
                  const isSelected = formData.priority === priority;

                  return (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => updateField('priority', priority)}
                      className={`
                        flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                        ${isSelected
                          ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20 text-${config.color}-700 dark:text-${config.color}-300`
                          : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }
                      `}
                    >
                      {config.label[lang]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Impact & Effort */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {isPolish ? 'Szacowany wpływ' : 'Estimated Impact'}
                </label>
                <select
                  value={formData.estimatedImpact}
                  onChange={(e) => updateField('estimatedImpact', e.target.value as Impact)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {(['low', 'medium', 'high'] as Impact[]).map((level) => (
                    <option key={level} value={level}>
                      {IMPACT_EFFORT_LABELS[level][lang]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {isPolish ? 'Szacowany wysiłek' : 'Estimated Effort'}
                </label>
                <select
                  value={formData.estimatedEffort}
                  onChange={(e) => updateField('estimatedEffort', e.target.value as Effort)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {(['low', 'medium', 'high'] as Effort[]).map((level) => (
                    <option key={level} value={level}>
                      {IMPACT_EFFORT_LABELS[level][lang]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rationale */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-500" />
                  {isPolish ? 'Uzasadnienie strategiczne' : 'Strategic Rationale'}
                </span>
              </label>
              <textarea
                value={formData.rationale}
                onChange={(e) => updateField('rationale', e.target.value)}
                placeholder={isPolish ? 'Dlaczego ta inicjatywa jest ważna...' : 'Why this initiative matters...'}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Owner */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPolish ? 'Właściciel' : 'Owner'}
              </label>
              <input
                type="text"
                value={formData.owner}
                onChange={(e) => updateField('owner', e.target.value)}
                placeholder={isPolish ? 'Np. Jan Kowalski' : 'E.g., John Smith'}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPolish ? 'Tagi' : 'Tags'}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder={isPolish ? 'Dodaj tag...' : 'Add tag...'}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                >
                  {isPolish ? 'Dodaj' : 'Add'}
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-primary-900 dark:hover:text-primary-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isPolish ? 'Tworzenie...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {isPolish ? 'Utwórz inicjatywę' : 'Create Initiative'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InitiativeComposer;
