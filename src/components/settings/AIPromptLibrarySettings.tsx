/**
 * AIPromptLibrarySettings - Saved prompts & templates library
 *
 * New card — replaces hardcoded quick templates with a user-managed library.
 *
 * Features:
 *  - Browse saved prompts
 *  - Create / edit / delete prompts
 *  - Categorize by context (interview, analysis, report, general)
 *  - Quick-apply to system prompt
 */

import { TFunction } from 'i18next';
import { BookOpen, Copy, Edit3, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import {
  SettingsDivider,
  SettingsFormRow,
  SettingsInput,
  SettingsSection,
  SettingsSelect,
  SettingsTextarea,
} from './shared';

interface SavedPrompt {
  id: string;
  name: string;
  category: 'interview' | 'analysis' | 'report' | 'general';
  prompt: string;
  createdAt: string;
}

const PROMPT_CATEGORIES = ['interview', 'analysis', 'report', 'general'] as const;

const isPromptCategory = (value: unknown): value is SavedPrompt['category'] =>
  typeof value === 'string' && PROMPT_CATEGORIES.includes(value as SavedPrompt['category']);

const normalizePromptList = (value: unknown): SavedPrompt[] =>
  Array.isArray(value)
    ? value
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const candidate = item as Record<string, unknown>;
          const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
          const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
          const prompt = typeof candidate.prompt === 'string' ? candidate.prompt : '';
          if (!id || !name || !prompt) return null;
          return {
            id,
            name,
            category: isPromptCategory(candidate.category) ? candidate.category : 'general',
            prompt,
            createdAt:
              typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
                ? candidate.createdAt
                : new Date(0).toISOString().split('T')[0],
          };
        })
        .filter((item): item is SavedPrompt => Boolean(item))
    : [];

const promptListsMatch = (left: SavedPrompt[], right: SavedPrompt[]) => {
  if (left.length !== right.length) return false;
  const normalize = (items: SavedPrompt[]) =>
    [...items]
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        prompt: item.prompt,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft.every((item, index) => {
    const other = normalizedRight[index];
    return (
      item.id === other.id &&
      item.name === other.name &&
      item.category === other.category &&
      item.prompt === other.prompt
    );
  });
};

const CATEGORY_COLORS: Record<SavedPrompt['category'], string> = {
  interview: 'bg-blue-500/20 text-blue-400',
  analysis: 'bg-emerald-500/20 text-emerald-400',
  report: 'bg-amber-500/20 text-amber-400',
  general: 'bg-c-accent-soft text-c-accent',
};

const getCategoryLabel = (t: TFunction, category: SavedPrompt['category']) =>
  t(
    `settings.ai.promptCategories.${category}`,
    {
      interview: 'Interview',
      analysis: 'Analysis',
      report: 'Report',
      general: 'General',
    }[category]
  );

const getBuiltInPrompts = (t: TFunction): SavedPrompt[] => [
  {
    id: 'builtin-professional',
    name: t('settings.ai.builtins.professional.name', 'Professional'),
    category: 'general',
    prompt: t(
      'settings.ai.builtins.professional.prompt',
      'I prefer formal, professional responses. Focus on accuracy and clarity. Use industry-standard terminology.'
    ),
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-interview-prep',
    name: t('settings.ai.builtins.interviewPrep.name', 'Interview Preparation'),
    category: 'interview',
    prompt: t(
      'settings.ai.builtins.interviewPrep.prompt',
      'Help me prepare structured interview questions. Focus on behavioral and competency-based questions. Suggest follow-ups for each main question.'
    ),
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-analysis',
    name: t('settings.ai.builtins.dataAnalysis.name', 'Data Analysis'),
    category: 'analysis',
    prompt: t(
      'settings.ai.builtins.dataAnalysis.prompt',
      'Analyze data thoroughly. Present findings with clear structure: key metrics, trends, anomalies, and actionable recommendations. Use tables when helpful.'
    ),
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-report',
    name: t('settings.ai.builtins.executiveReport.name', 'Executive Report'),
    category: 'report',
    prompt: t(
      'settings.ai.builtins.executiveReport.prompt',
      'Write in executive summary style. Lead with conclusions, then supporting evidence. Keep paragraphs short. Use bullet points for key takeaways.'
    ),
    createdAt: '2024-01-01',
  },
];

export const AIPromptLibrarySettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [prompts, setPrompts] = useState<SavedPrompt[]>(() => getBuiltInPrompts(t));
  const [showEditor, setShowEditor] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editorName, setEditorName] = useState('');
  const [editorCategory, setEditorCategory] = useState<SavedPrompt['category']>('general');
  const [editorPrompt, setEditorPrompt] = useState('');

  const filteredPrompts =
    filterCategory === 'all' ? prompts : prompts.filter((p) => p.category === filterCategory);

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await Api.getPromptLibrary();
        const persistedPrompts = normalizePromptList(response?.prompts);
        if (persistedPrompts.length > 0) {
          setPrompts(persistedPrompts);
        } else {
          setPrompts(getBuiltInPrompts(t));
        }
      } catch (error: unknown) {
        const message = normalizeApiErrorMessage(error, 'Failed to load prompt library');
        setLoadError(message);
        setPrompts([]);
      } finally {
        setLoading(false);
      }
    };

    void loadPrompts();
  }, [t]);

  const persistPrompts = useCallback(
    async (nextPrompts: SavedPrompt[], successMessage: string) => {
      setSaving(true);
      try {
        setActionError(null);
        await Api.savePromptLibrary(nextPrompts);
        const response = await Api.getPromptLibrary();
        const persistedPrompts = normalizePromptList(response?.prompts);
        if (!promptListsMatch(persistedPrompts, nextPrompts)) {
          throw new Error('Prompt library save was not confirmed by the server');
        }
        setPrompts(persistedPrompts);
        toast.success(successMessage);
        return true;
      } catch (error: unknown) {
        const message = normalizeApiErrorMessage(
          error,
          t('settings.ai.promptSaveError', 'Failed to save prompt library')
        );
        setActionError(message);
        toast.error(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [t]
  );

  const openEditor = (prompt?: SavedPrompt) => {
    setActionError(null);
    if (prompt) {
      setEditingPrompt(prompt);
      setEditorName(prompt.name);
      setEditorCategory(prompt.category);
      setEditorPrompt(prompt.prompt);
    } else {
      setEditingPrompt(null);
      setEditorName('');
      setEditorCategory('general');
      setEditorPrompt('');
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingPrompt(null);
  };

  const savePrompt = async () => {
    if (!editorName.trim() || !editorPrompt.trim()) {
      toast.error(t('settings.ai.promptRequired', 'Name and prompt text are required'));
      return;
    }

    let nextPrompts: SavedPrompt[];
    if (editingPrompt) {
      nextPrompts = prompts.map((p) =>
        p.id === editingPrompt.id
          ? { ...p, name: editorName, category: editorCategory, prompt: editorPrompt }
          : p
      );
      if (await persistPrompts(nextPrompts, t('settings.ai.promptUpdated', 'Prompt updated'))) {
        closeEditor();
      }
    } else {
      const newPrompt: SavedPrompt = {
        id: `custom-${Date.now()}`,
        name: editorName,
        category: editorCategory,
        prompt: editorPrompt,
        createdAt: new Date().toISOString().split('T')[0],
      };
      nextPrompts = [...prompts, newPrompt];
      if (await persistPrompts(nextPrompts, t('settings.ai.promptCreated', 'Prompt created'))) {
        closeEditor();
      }
    }
  };

  const deletePrompt = async (id: string) => {
    if (id.startsWith('builtin-')) {
      toast.error(t('settings.ai.cantDeleteBuiltin', 'Built-in prompts cannot be deleted'));
      return;
    }

    const nextPrompts = prompts.filter((p) => p.id !== id);
    await persistPrompts(nextPrompts, t('settings.ai.promptDeleted', 'Prompt deleted'));
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast.success(t('settings.ai.promptCopied', 'Prompt copied to clipboard'));
  };

  const categoryOptions = [
    { value: 'interview', label: getCategoryLabel(t, 'interview') },
    { value: 'analysis', label: getCategoryLabel(t, 'analysis') },
    { value: 'report', label: getCategoryLabel(t, 'report') },
    { value: 'general', label: getCategoryLabel(t, 'general') },
  ];

  return (
    <div className={className}>
      <SettingsSection
        icon={BookOpen}
        title={t('settings.ai.promptLibraryTitle', 'Prompt Library')}
        description={t(
          'settings.ai.promptLibraryDesc',
          'Save and organize reusable prompts for different contexts — interviews, analysis, reports, and more.'
        )}
        cardId="settings-ai-prompt-library"
        loading={loading}
        actions={
          <button
            onClick={() => openEditor()}
            disabled={saving || !!loadError}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            {t('settings.ai.newPrompt', 'New Prompt')}
          </button>
        }
      >
        <div className="space-y-4">
          {loadError ? (
            <DegradedState title="Prompt library unavailable" description={loadError} />
          ) : (
            <>
              {actionError && (
                <div
                  role="alert"
                  className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-sm text-danger-200"
                >
                  {actionError}
                </div>
              )}
              {/* Filter */}
              <div className="flex gap-2">
                {['all', 'interview', 'analysis', 'report', 'general'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={cn(
                      'px-3 py-1 text-xs rounded-md transition-colors',
                      filterCategory === cat
                        ? 'bg-navy-900 text-white'
                        : 'bg-c-surface-raised text-c-text-secondary hover:text-white hover:bg-c-surface-raised'
                    )}
                  >
                    {cat === 'all'
                      ? t('common.all', 'All')
                      : getCategoryLabel(t, cat as SavedPrompt['category'])}
                  </button>
                ))}
              </div>

              {/* Prompt List */}
              <div className="space-y-2">
                {filteredPrompts.length === 0 ? (
                  <EmptyState
                    compact
                    preset="noData"
                    title={t('settings.ai.noPrompts', 'No prompts in this category.')}
                  />
                ) : (
                  filteredPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="p-3 bg-c-surface-raised border border-c-border-subtle rounded-lg hover:border-c-border dark:hover:border-c-border-subtle transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-c-text">{prompt.name}</span>
                            <span
                              className={cn(
                                'px-1.5 py-0.5 text-[10px] font-medium rounded',
                                CATEGORY_COLORS[prompt.category]
                              )}
                            >
                              {getCategoryLabel(t, prompt.category)}
                            </span>
                            {prompt.id.startsWith('builtin-') && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-c-surface-raised text-c-text-muted rounded">
                                {t('settings.ai.builtIn', 'Built-in')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-c-text-muted line-clamp-2">{prompt.prompt}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => copyPrompt(prompt.prompt)}
                            className="p-1.5 text-c-text-muted hover:text-white rounded transition-colors"
                            title={t('common.copy', 'Copy')}
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => openEditor(prompt)}
                            className="p-1.5 text-c-text-muted hover:text-white rounded transition-colors"
                            title={t('common.edit', 'Edit')}
                          >
                            <Edit3 size={14} />
                          </button>
                          {!prompt.id.startsWith('builtin-') && (
                            <button
                              onClick={() => deletePrompt(prompt.id)}
                              className="p-1.5 text-c-text-muted hover:text-danger-400 rounded transition-colors"
                              title={t('common.delete', 'Delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Editor Modal (inline) */}
              {showEditor && (
                <>
                  <SettingsDivider />
                  <div className="p-4 bg-c-surface-raised border border-c-accent dark:border-c-accent rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-c-text">
                        {editingPrompt
                          ? t('settings.ai.editPrompt', 'Edit Prompt')
                          : t('settings.ai.createPrompt', 'Create Prompt')}
                      </h4>
                      <button
                        onClick={closeEditor}
                        className="p-1 text-c-text-muted hover:text-white transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SettingsFormRow label={t('settings.ai.promptName', 'Name')}>
                        <SettingsInput
                          value={editorName}
                          onChange={(e) => setEditorName(e.target.value)}
                          placeholder={t(
                            'settings.ai.promptNamePlaceholder',
                            'e.g., Interview Deep-Dive'
                          )}
                          maxLength={100}
                        />
                      </SettingsFormRow>
                      <SettingsFormRow label={t('settings.ai.promptCategory', 'Category')}>
                        <SettingsSelect
                          options={categoryOptions}
                          value={editorCategory}
                          onChange={(e) =>
                            setEditorCategory(e.target.value as SavedPrompt['category'])
                          }
                        />
                      </SettingsFormRow>
                    </div>

                    <SettingsFormRow label={t('settings.ai.promptText', 'Prompt Text')}>
                      <SettingsTextarea
                        value={editorPrompt}
                        onChange={(e) => setEditorPrompt(e.target.value)}
                        placeholder={t(
                          'settings.ai.promptTextPlaceholder',
                          'Write your reusable prompt here...'
                        )}
                        rows={4}
                        maxLength={2000}
                      />
                      <div className="text-right text-xs text-c-text-muted mt-1">
                        {editorPrompt.length}/2000
                      </div>
                    </SettingsFormRow>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={closeEditor}
                        className="px-3 py-1.5 text-sm text-c-text-secondary hover:text-white transition-colors"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                      <button
                        onClick={savePrompt}
                        disabled={saving}
                        className="px-4 py-1.5 text-sm font-medium bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 transition-colors"
                      >
                        {editingPrompt ? t('common.save', 'Save') : t('common.create', 'Create')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SettingsSection>
    </div>
  );
};

export default AIPromptLibrarySettings;
