/**
 * TaskTemplates
 * Component for managing task templates and recurring tasks
 * ClickUp-style design following Golden Standard
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  Edit,
  FileText,
  Flag,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Template interface
export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;

  // Task fields
  title: string;
  taskDescription?: string;
  priority: string;
  estimatedHours?: number;
  tags?: string[];
  checklist?: { id: string; text: string; completed: boolean }[];

  // Recurring settings
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;

  // Metadata
  usageCount: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number; // e.g., every 2 weeks
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  endDate?: string;
  maxOccurrences?: number;
}

interface TaskTemplatesProps {
  templates: TaskTemplate[];
  onCreateFromTemplate: (template: TaskTemplate) => void;
  onSaveTemplate: (
    template: Omit<TaskTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateTemplate: (id: string, updates: Partial<TaskTemplate>) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  // Pre-fill from current task (for "Save as Template")
  initialTask?: {
    title: string;
    description?: string;
    priority: string;
    estimatedHours?: number;
    tags?: string[];
    checklist?: { id: string; text: string; completed: boolean }[];
  };
}

// Frequency labels
const FREQUENCY_OPTIONS = [
  { value: 'daily', label: { en: 'Daily', pl: 'Codziennie' } },
  { value: 'weekly', label: { en: 'Weekly', pl: 'Co tydzień' } },
  { value: 'biweekly', label: { en: 'Bi-weekly', pl: 'Co 2 tygodnie' } },
  { value: 'monthly', label: { en: 'Monthly', pl: 'Co miesiąc' } },
  { value: 'quarterly', label: { en: 'Quarterly', pl: 'Co kwartał' } },
  { value: 'yearly', label: { en: 'Yearly', pl: 'Co rok' } },
];

const DAYS_OF_WEEK = [
  { value: 0, label: { en: 'Sun', pl: 'Nd' } },
  { value: 1, label: { en: 'Mon', pl: 'Pn' } },
  { value: 2, label: { en: 'Tue', pl: 'Wt' } },
  { value: 3, label: { en: 'Wed', pl: 'Śr' } },
  { value: 4, label: { en: 'Thu', pl: 'Cz' } },
  { value: 5, label: { en: 'Fri', pl: 'Pt' } },
  { value: 6, label: { en: 'Sat', pl: 'So' } },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: { en: 'Low', pl: 'Niski' }, color: 'text-slate-500' },
  { value: 'medium', label: { en: 'Medium', pl: 'Średni' }, color: 'text-blue-500' },
  { value: 'high', label: { en: 'High', pl: 'Wysoki' }, color: 'text-amber-500' },
  { value: 'critical', label: { en: 'Critical', pl: 'Krytyczny' }, color: 'text-danger-500' },
];

export const TaskTemplates: React.FC<TaskTemplatesProps> = ({
  templates,
  onCreateFromTemplate,
  onSaveTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onToggleFavorite,
  isOpen,
  onClose,
  initialTask,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // View mode: 'list' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<TaskTemplate>>({
    name: '',
    description: '',
    category: '',
    title: '',
    taskDescription: '',
    priority: 'medium',
    estimatedHours: undefined,
    tags: [],
    checklist: [],
    isRecurring: false,
    recurringPattern: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1], // Monday by default
    },
    isFavorite: false,
  });

  // Initialize form from initialTask when creating
  useEffect(() => {
    if (isOpen && initialTask && viewMode === 'create') {
      setFormData((prev) => ({
        ...prev,
        title: initialTask.title,
        taskDescription: initialTask.description || '',
        priority: initialTask.priority,
        estimatedHours: initialTask.estimatedHours,
        tags: initialTask.tags || [],
        checklist: initialTask.checklist || [],
        name: `Template: ${initialTask.title}`,
      }));
    }
  }, [isOpen, initialTask, viewMode]);

  // Reset when opening for "Save as Template"
  useEffect(() => {
    if (isOpen && initialTask) {
      setViewMode('create');
    } else if (isOpen) {
      setViewMode('list');
    }
  }, [isOpen, initialTask]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      category: '',
      title: '',
      taskDescription: '',
      priority: 'medium',
      estimatedHours: undefined,
      tags: [],
      checklist: [],
      isRecurring: false,
      recurringPattern: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1],
      },
      isFavorite: false,
    });
    setEditingTemplate(null);
  }, []);

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast.error(isPolish ? 'Nazwa szablonu jest wymagana' : 'Template name is required');
      return;
    }
    if (!formData.title?.trim()) {
      toast.error(isPolish ? 'Tytuł zadania jest wymagany' : 'Task title is required');
      return;
    }

    try {
      setSaving(true);

      if (viewMode === 'edit' && editingTemplate) {
        await onUpdateTemplate(editingTemplate.id, formData);
        toast.success(isPolish ? 'Szablon zaktualizowany' : 'Template updated');
      } else {
        await onSaveTemplate({
          name: formData.name!,
          description: formData.description,
          category: formData.category,
          title: formData.title!,
          taskDescription: formData.taskDescription,
          priority: formData.priority || 'medium',
          estimatedHours: formData.estimatedHours,
          tags: formData.tags,
          checklist: formData.checklist,
          isRecurring: formData.isRecurring || false,
          recurringPattern: formData.recurringPattern,
          isFavorite: formData.isFavorite || false,
        });
        toast.success(isPolish ? 'Szablon zapisany' : 'Template saved');
      }

      resetForm();
      setViewMode('list');
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się zapisać szablonu' : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      title: template.title,
      taskDescription: template.taskDescription,
      priority: template.priority,
      estimatedHours: template.estimatedHours,
      tags: template.tags,
      checklist: template.checklist,
      isRecurring: template.isRecurring,
      recurringPattern: template.recurringPattern,
      isFavorite: template.isFavorite,
    });
    setViewMode('edit');
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        isPolish
          ? 'Czy na pewno chcesz usunąć ten szablon?'
          : 'Are you sure you want to delete this template?'
      )
    ) {
      return;
    }
    try {
      await onDeleteTemplate(id);
      toast.success(isPolish ? 'Szablon usunięty' : 'Template deleted');
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się usunąć szablonu' : 'Failed to delete template');
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(query) ||
      t.title.toLowerCase().includes(query) ||
      t.category?.toLowerCase().includes(query)
    );
  });

  // Sort: favorites first, then by usage
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return b.usageCount - a.usageCount;
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-500/10">
                <Layers size={20} className="text-primary-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {viewMode === 'list'
                    ? isPolish
                      ? 'Szablony zadań'
                      : 'Task Templates'
                    : viewMode === 'create'
                      ? isPolish
                        ? 'Nowy szablon'
                        : 'New Template'
                      : isPolish
                        ? 'Edytuj szablon'
                        : 'Edit Template'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {viewMode === 'list'
                    ? isPolish
                      ? 'Szybkie tworzenie zadań z szablonów'
                      : 'Quickly create tasks from templates'
                    : isPolish
                      ? 'Zdefiniuj szczegóły szablonu'
                      : 'Define template details'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {viewMode !== 'list' && (
                <button
                  onClick={() => {
                    resetForm();
                    setViewMode('list');
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <X size={20} className="text-slate-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {viewMode === 'list' ? (
              <>
                {/* Search & Create */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isPolish ? 'Szukaj szablonów...' : 'Search templates...'}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-primary-500"
                    />
                  </div>
                  <button
                    onClick={() => {
                      resetForm();
                      setViewMode('create');
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text text-c-bg text-sm font-medium hover:bg-c-text-secondary transition-colors"
                  >
                    <Plus size={16} />
                    <span>{isPolish ? 'Nowy' : 'New'}</span>
                  </button>
                </div>

                {/* Templates List */}
                {sortedTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <Layers size={48} className="mx-auto mb-4 text-slate-600 dark:text-navy-600" />
                    <p className="text-slate-500 dark:text-slate-400">
                      {searchQuery
                        ? isPolish
                          ? 'Nie znaleziono szablonów'
                          : 'No templates found'
                        : isPolish
                          ? 'Brak szablonów'
                          : 'No templates yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedTemplates.map((template) => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-primary-300 dark:hover:border-primary-500/50 transition-all"
                      >
                        {/* Favorite */}
                        <button
                          onClick={() => onToggleFavorite(template.id)}
                          className={`p-1 rounded ${
                            template.isFavorite
                              ? 'text-amber-500'
                              : 'text-slate-600 dark:text-navy-500 hover:text-amber-400'
                          }`}
                        >
                          <Star size={16} className={template.isFavorite ? 'fill-current' : ''} />
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 dark:text-white truncate">
                              {template.name}
                            </span>
                            {template.isRecurring && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-500">
                                <RefreshCw size={10} />
                                {isPolish ? 'Powtarzalne' : 'Recurring'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <CheckSquare size={10} />
                              {template.title}
                            </span>
                            {template.category && (
                              <>
                                <span>•</span>
                                <span>{template.category}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>
                              {template.usageCount}x {isPolish ? 'użyto' : 'used'}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onCreateFromTemplate(template)}
                            className="p-2 rounded-lg bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 transition-colors"
                            title={isPolish ? 'Użyj szablonu' : 'Use template'}
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-500 transition-colors"
                            title={isPolish ? 'Edytuj' : 'Edit'}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/10 text-slate-600 hover:text-danger-500 transition-colors"
                            title={isPolish ? 'Usuń' : 'Delete'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Create / Edit Form */
              <div className="space-y-4">
                {/* Template Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isPolish ? 'Nazwa szablonu' : 'Template Name'} *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500"
                    placeholder={isPolish ? 'np. Tygodniowy raport' : 'e.g., Weekly report'}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isPolish ? 'Kategoria' : 'Category'}
                  </label>
                  <input
                    type="text"
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500"
                    placeholder={isPolish ? 'np. Raporty' : 'e.g., Reports'}
                  />
                </div>

                <div className="border-t border-slate-200 dark:border-navy-700 pt-4">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    {isPolish ? 'Szczegóły zadania' : 'Task Details'}
                  </h3>

                  {/* Task Title */}
                  <div className="mb-3">
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {isPolish ? 'Tytuł zadania' : 'Task Title'} *
                    </label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500"
                    />
                  </div>

                  {/* Priority & Estimated Time */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {isPolish ? 'Priorytet' : 'Priority'}
                      </label>
                      <select
                        value={formData.priority || 'medium'}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500"
                      >
                        {PRIORITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {isPolish ? opt.label.pl : opt.label.en}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {isPolish ? 'Szacowany czas (h)' : 'Estimated Hours'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.estimatedHours || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            estimatedHours: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Recurring Settings */}
                <div className="border-t border-slate-200 dark:border-navy-700 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRecurring || false}
                      onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                      className="rounded border-slate-300 dark:border-navy-600 text-primary-500"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <RefreshCw size={14} />
                      {isPolish ? 'Zadanie powtarzalne' : 'Recurring Task'}
                    </span>
                  </label>

                  {formData.isRecurring && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-800 space-y-3"
                    >
                      {/* Frequency */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Częstotliwość' : 'Frequency'}
                          </label>
                          <select
                            value={formData.recurringPattern?.frequency || 'weekly'}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                recurringPattern: {
                                  ...formData.recurringPattern!,
                                  frequency: e.target.value as RecurringPattern['frequency'],
                                },
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                          >
                            {FREQUENCY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {isPolish ? opt.label.pl : opt.label.en}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {isPolish ? 'Co ile' : 'Every'}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={formData.recurringPattern?.interval || 1}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                recurringPattern: {
                                  ...formData.recurringPattern!,
                                  interval: parseInt(e.target.value) || 1,
                                },
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Days of Week (for weekly) */}
                      {formData.recurringPattern?.frequency === 'weekly' && (
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">
                            {isPolish ? 'Dni tygodnia' : 'Days of week'}
                          </label>
                          <div className="flex gap-1">
                            {DAYS_OF_WEEK.map((day) => (
                              <button
                                key={day.value}
                                onClick={() => {
                                  const currentDays = formData.recurringPattern?.daysOfWeek || [];
                                  const newDays = currentDays.includes(day.value)
                                    ? currentDays.filter((d) => d !== day.value)
                                    : [...currentDays, day.value];
                                  setFormData({
                                    ...formData,
                                    recurringPattern: {
                                      ...formData.recurringPattern!,
                                      daysOfWeek: newDays,
                                    },
                                  });
                                }}
                                className={`
                                  px-2 py-1 rounded text-xs font-medium transition-colors
                                  ${
                                    formData.recurringPattern?.daysOfWeek?.includes(day.value)
                                      ? 'bg-navy-900 text-white'
                                      : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-600'
                                  }
                                `}
                              >
                                {isPolish ? day.label.pl : day.label.en}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {viewMode !== 'list' && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    resetForm();
                    setViewMode('list');
                  }}
                  className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                >
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text text-c-bg font-medium hover:bg-c-text-secondary disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>
                    {viewMode === 'edit'
                      ? isPolish
                        ? 'Aktualizuj'
                        : 'Update'
                      : isPolish
                        ? 'Zapisz szablon'
                        : 'Save Template'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TaskTemplates;
