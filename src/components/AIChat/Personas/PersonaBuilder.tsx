/**
 * PersonaBuilder - Create and edit custom AI personas
 * Full-featured editor with preview and testing
 *
 * @version 1.0.0
 */

import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Globe,
  Image,
  Lock,
  MessageSquare,
  Plus,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PersonaBuilderProps {
  initialData?: PersonaFormData;
  onSave: (data: PersonaFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export interface PersonaFormData {
  name: string;
  description: string;
  avatar_url?: string;
  system_prompt: string;
  instructions?: string;
  starter_prompts: string[];
  capabilities: string[];
  model_preference?: string;
  temperature: number;
  visibility: 'private' | 'organization' | 'public';
  category?: string;
  tags: string[];
}

const CATEGORIES = [
  { id: 'business', label: 'Business & Strategy' },
  { id: 'technical', label: 'Technical & Development' },
  { id: 'creative', label: 'Creative & Writing' },
  { id: 'education', label: 'Education & Learning' },
  { id: 'productivity', label: 'Productivity & Organization' },
  { id: 'research', label: 'Research & Analysis' },
  { id: 'other', label: 'Other' },
];

const CAPABILITIES = [
  { id: 'web_search', label: 'Web Search', description: 'Can search the internet for information' },
  { id: 'code_execution', label: 'Code Execution', description: 'Can run Python code' },
  { id: 'image_generation', label: 'Image Generation', description: 'Can create images with DALL-E' },
  { id: 'file_upload', label: 'File Upload', description: 'Can analyze uploaded files' },
  { id: 'deep_research', label: 'Deep Research', description: 'Multi-query research mode' },
];

const DEFAULT_FORM_DATA: PersonaFormData = {
  name: '',
  description: '',
  system_prompt: '',
  instructions: '',
  starter_prompts: [],
  capabilities: [],
  temperature: 0.7,
  visibility: 'private',
  tags: [],
};

export const PersonaBuilder: React.FC<PersonaBuilderProps> = ({
  initialData,
  onSave,
  onCancel,
  isEditing = false,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<PersonaFormData>(initialData || DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'behavior' | 'advanced'>('basic');
  const [showPreview, setShowPreview] = useState(false);
  const [newStarterPrompt, setNewStarterPrompt] = useState('');
  const [newTag, setNewTag] = useState('');

  const updateField = useCallback(<K extends keyof PersonaFormData>(
    field: K,
    value: PersonaFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('personas.errors.nameRequired', 'Name is required');
    }

    if (!formData.system_prompt.trim()) {
      newErrors.system_prompt = t('personas.errors.promptRequired', 'System prompt is required');
    } else if (formData.system_prompt.length < 50) {
      newErrors.system_prompt = t('personas.errors.promptTooShort', 'System prompt should be at least 50 characters');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save persona:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addStarterPrompt = () => {
    if (newStarterPrompt.trim() && formData.starter_prompts.length < 5) {
      updateField('starter_prompts', [...formData.starter_prompts, newStarterPrompt.trim()]);
      setNewStarterPrompt('');
    }
  };

  const removeStarterPrompt = (index: number) => {
    updateField('starter_prompts', formData.starter_prompts.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag.trim() && formData.tags.length < 10 && !formData.tags.includes(newTag.trim())) {
      updateField('tags', [...formData.tags, newTag.trim().toLowerCase()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    updateField('tags', formData.tags.filter((t) => t !== tag));
  };

  const toggleCapability = (capability: string) => {
    if (formData.capabilities.includes(capability)) {
      updateField('capabilities', formData.capabilities.filter((c) => c !== capability));
    } else {
      updateField('capabilities', [...formData.capabilities, capability]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-navy-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {isEditing
              ? t('personas.editPersona', 'Edit Persona')
              : t('personas.createPersona', 'Create Persona')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('personas.builderDescription', 'Build your custom AI assistant')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showPreview
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
            }`}
          >
            <Eye size={16} />
            {t('common.preview', 'Preview')}
          </button>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-navy-700 px-6">
        {(['basic', 'behavior', 'advanced'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab === 'basic' && t('personas.tabs.basic', 'Basic Info')}
            {tab === 'behavior' && t('personas.tabs.behavior', 'Behavior')}
            {tab === 'advanced' && t('personas.tabs.advanced', 'Advanced')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className={`${showPreview ? 'grid grid-cols-2 divide-x divide-slate-200 dark:divide-navy-700' : ''}`}>
          {/* Form Section */}
          <div className="p-6 space-y-6">
            {activeTab === 'basic' && (
              <>
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.name', 'Name')} *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder={t('personas.placeholders.name', 'e.g., Business Strategy Expert')}
                    className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      errors.name ? 'border-red-500' : 'border-slate-200 dark:border-navy-700'
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={12} />
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.description', 'Description')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder={t('personas.placeholders.description', 'Brief description of what this persona does...')}
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.category', 'Category')}
                  </label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => updateField('category', e.target.value || undefined)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">{t('personas.selectCategory', 'Select category...')}</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.tags', 'Tags')}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 text-xs rounded-full"
                      >
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      placeholder={t('personas.placeholders.addTag', 'Add tag...')}
                      className="flex-1 px-3 py-1.5 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                      onClick={addTag}
                      disabled={!newTag.trim() || formData.tags.length >= 10}
                      className="px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.visibility', 'Visibility')}
                  </label>
                  <div className="flex gap-2">
                    {[
                      { id: 'private', icon: Lock, label: 'Private' },
                      { id: 'organization', icon: Users, label: 'Organization' },
                      { id: 'public', icon: Globe, label: 'Public' },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => updateField('visibility', opt.id as any)}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
                            formData.visibility === opt.id
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                              : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700'
                          }`}
                        >
                          <Icon size={16} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'behavior' && (
              <>
                {/* System Prompt */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.systemPrompt', 'System Prompt')} *
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {t('personas.systemPromptHint', 'Define the personality, expertise, and behavior of your AI assistant')}
                  </p>
                  <textarea
                    value={formData.system_prompt}
                    onChange={(e) => updateField('system_prompt', e.target.value)}
                    placeholder={t('personas.placeholders.systemPrompt', 'You are an expert...')}
                    rows={8}
                    className={`w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono ${
                      errors.system_prompt ? 'border-red-500' : 'border-slate-200 dark:border-navy-700'
                    }`}
                  />
                  {errors.system_prompt && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={12} />
                      {errors.system_prompt}
                    </p>
                  )}
                  <div className="mt-1 text-xs text-slate-400">
                    {formData.system_prompt.length} / 4000 {t('common.characters', 'characters')}
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.instructions', 'Additional Instructions')}
                  </label>
                  <textarea
                    value={formData.instructions || ''}
                    onChange={(e) => updateField('instructions', e.target.value)}
                    placeholder={t('personas.placeholders.instructions', 'Additional guidelines for responses...')}
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Starter Prompts */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.starterPrompts', 'Conversation Starters')}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {t('personas.starterPromptsHint', 'Suggested prompts shown when starting a conversation')}
                  </p>
                  <div className="space-y-2 mb-2">
                    {formData.starter_prompts.map((prompt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-slate-400 shrink-0" />
                        <span className="flex-1 text-sm text-slate-600 dark:text-slate-400">
                          {prompt}
                        </span>
                        <button
                          onClick={() => removeStarterPrompt(idx)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {formData.starter_prompts.length < 5 && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newStarterPrompt}
                        onChange={(e) => setNewStarterPrompt(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && (e.preventDefault(), addStarterPrompt())
                        }
                        placeholder={t('personas.placeholders.starterPrompt', 'e.g., Help me analyze this data...')}
                        className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <button
                        onClick={addStarterPrompt}
                        disabled={!newStarterPrompt.trim()}
                        className="px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'advanced' && (
              <>
                {/* Capabilities */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.capabilities', 'Capabilities')}
                  </label>
                  <div className="space-y-2">
                    {CAPABILITIES.map((cap) => (
                      <label
                        key={cap.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          formData.capabilities.includes(cap.id)
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.capabilities.includes(cap.id)}
                          onChange={() => toggleCapability(cap.id)}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            formData.capabilities.includes(cap.id)
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-slate-300 dark:border-navy-600'
                          }`}
                        >
                          {formData.capabilities.includes(cap.id) && (
                            <Check size={12} className="text-white" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {cap.label}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {cap.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.temperature', 'Temperature')}: {formData.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => updateField('temperature', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>{t('personas.temperaturePrecise', 'Precise')}</span>
                    <span>{t('personas.temperatureCreative', 'Creative')}</span>
                  </div>
                </div>

                {/* Model Preference */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('personas.fields.modelPreference', 'Preferred Model')}
                  </label>
                  <select
                    value={formData.model_preference || ''}
                    onChange={(e) => updateField('model_preference', e.target.value || undefined)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">{t('personas.autoSelect', 'Auto (recommended)')}</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Preview Section */}
          {showPreview && (
            <div className="p-6 bg-slate-50 dark:bg-navy-800/50">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                {t('personas.preview', 'Preview')}
              </h3>
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Bot size={24} className="text-primary-500" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-800 dark:text-white">
                      {formData.name || t('personas.untitled', 'Untitled Persona')}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formData.description || t('personas.noDescription', 'No description')}
                    </p>
                  </div>
                </div>

                {formData.starter_prompts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('personas.suggestedPrompts', 'Suggested Prompts')}
                    </p>
                    {formData.starter_prompts.map((prompt, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 bg-slate-50 dark:bg-navy-800 rounded-lg text-sm text-slate-600 dark:text-slate-400"
                      >
                        {prompt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-lg transition-colors"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('common.saving', 'Saving...')}
            </>
          ) : (
            <>
              <Save size={16} />
              {isEditing ? t('common.saveChanges', 'Save Changes') : t('common.create', 'Create')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PersonaBuilder;
