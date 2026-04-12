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

import { BookOpen, Copy, Edit3, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
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

const CATEGORY_LABELS: Record<SavedPrompt['category'], string> = {
  interview: 'Interview',
  analysis: 'Analysis',
  report: 'Report',
  general: 'General',
};

const CATEGORY_COLORS: Record<SavedPrompt['category'], string> = {
  interview: 'bg-blue-500/20 text-blue-400',
  analysis: 'bg-emerald-500/20 text-emerald-400',
  report: 'bg-amber-500/20 text-amber-400',
  general: 'bg-violet-500/20 text-violet-400',
};

const BUILT_IN_PROMPTS: SavedPrompt[] = [
  {
    id: 'builtin-professional',
    name: 'Professional',
    category: 'general',
    prompt:
      'I prefer formal, professional responses. Focus on accuracy and clarity. Use industry-standard terminology.',
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-interview-prep',
    name: 'Interview Preparation',
    category: 'interview',
    prompt:
      'Help me prepare structured interview questions. Focus on behavioral and competency-based questions. Suggest follow-ups for each main question.',
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-analysis',
    name: 'Data Analysis',
    category: 'analysis',
    prompt:
      'Analyze data thoroughly. Present findings with clear structure: key metrics, trends, anomalies, and actionable recommendations. Use tables when helpful.',
    createdAt: '2024-01-01',
  },
  {
    id: 'builtin-report',
    name: 'Executive Report',
    category: 'report',
    prompt:
      'Write in executive summary style. Lead with conclusions, then supporting evidence. Keep paragraphs short. Use bullet points for key takeaways.',
    createdAt: '2024-01-01',
  },
];

export const AIPromptLibrarySettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [prompts, setPrompts] = useState<SavedPrompt[]>(BUILT_IN_PROMPTS);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editorName, setEditorName] = useState('');
  const [editorCategory, setEditorCategory] = useState<SavedPrompt['category']>('general');
  const [editorPrompt, setEditorPrompt] = useState('');

  const filteredPrompts =
    filterCategory === 'all'
      ? prompts
      : prompts.filter((p) => p.category === filterCategory);

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        setLoading(true);
        const response = await Api.getPromptLibrary();
        if (Array.isArray(response?.prompts) && response.prompts.length > 0) {
          setPrompts(response.prompts);
        } else {
          setPrompts(BUILT_IN_PROMPTS);
        }
      } catch (error) {
        console.error('Failed to load prompt library:', error);
        setPrompts(BUILT_IN_PROMPTS);
      } finally {
        setLoading(false);
      }
    };

    void loadPrompts();
  }, []);

  const persistPrompts = useCallback(
    async (nextPrompts: SavedPrompt[], successMessage: string) => {
      setSaving(true);
      try {
        await Api.savePromptLibrary(nextPrompts);
        setPrompts(nextPrompts);
        toast.success(successMessage);
        return true;
      } catch (error) {
        console.error('Failed to save prompt library:', error);
        toast.error(t('settings.ai.promptSaveError', 'Failed to save prompt library'));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [t]
  );

  const openEditor = (prompt?: SavedPrompt) => {
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
    { value: 'interview', label: 'Interview' },
    { value: 'analysis', label: 'Analysis' },
    { value: 'report', label: 'Report' },
    { value: 'general', label: 'General' },
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
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            {t('settings.ai.newPrompt', 'New Prompt')}
          </button>
        }
      >
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            {['all', 'interview', 'analysis', 'report', 'general'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  filterCategory === cat
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                )}
              >
                {cat === 'all' ? t('common.all', 'All') : CATEGORY_LABELS[cat as SavedPrompt['category']]}
              </button>
            ))}
          </div>

          {/* Prompt List */}
          <div className="space-y-2">
            {filteredPrompts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                {t('settings.ai.noPrompts', 'No prompts in this category.')}
              </div>
            ) : (
              filteredPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="p-3 bg-navy-900/50 border border-white/5 rounded-lg hover:border-white/10 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{prompt.name}</span>
                        <span
                          className={cn(
                            'px-1.5 py-0.5 text-[10px] font-medium rounded',
                            CATEGORY_COLORS[prompt.category]
                          )}
                        >
                          {CATEGORY_LABELS[prompt.category]}
                        </span>
                        {prompt.id.startsWith('builtin-') && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white/5 text-slate-500 rounded">
                            Built-in
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{prompt.prompt}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => copyPrompt(prompt.prompt)}
                        className="p-1.5 text-slate-500 hover:text-white rounded transition-colors"
                        title="Copy"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => openEditor(prompt)}
                        className="p-1.5 text-slate-500 hover:text-white rounded transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      {!prompt.id.startsWith('builtin-') && (
                        <button
                          onClick={() => deletePrompt(prompt.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
                          title="Delete"
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
              <div className="p-4 bg-navy-900/80 border border-violet-500/20 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">
                    {editingPrompt
                      ? t('settings.ai.editPrompt', 'Edit Prompt')
                      : t('settings.ai.createPrompt', 'Create Prompt')}
                  </h4>
                  <button
                    onClick={closeEditor}
                    className="p-1 text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingsFormRow label={t('settings.ai.promptName', 'Name')}>
                    <SettingsInput
                      value={editorName}
                      onChange={(e) => setEditorName(e.target.value)}
                      placeholder="e.g., Interview Deep-Dive"
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
                    placeholder="Write your reusable prompt here..."
                    rows={4}
                    maxLength={2000}
                  />
                  <div className="text-right text-xs text-slate-500 mt-1">
                    {editorPrompt.length}/2000
                  </div>
                </SettingsFormRow>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeEditor}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    onClick={savePrompt}
                    disabled={saving}
                    className="px-4 py-1.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
                  >
                    {editingPrompt
                      ? t('common.save', 'Save')
                      : t('common.create', 'Create')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </SettingsSection>
    </div>
  );
};

export default AIPromptLibrarySettings;
