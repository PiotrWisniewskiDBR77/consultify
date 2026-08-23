/**
 * SettingsTemplates - Predefined settings configurations
 */

import { Check, Layout, Loader2, Plus, Star, Trash2, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';

interface SettingsTemplatesProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'system' | 'custom';
  categories: string[];
  isRecommended?: boolean;
  createdAt?: string;
}

interface SettingsTemplatesSnapshot {
  systemTemplates: Template[];
  customTemplates: Template[];
}

const normalizeTemplates = (response: unknown): SettingsTemplatesSnapshot => {
  const templates = (response as { templates?: unknown })?.templates;
  if (!Array.isArray(templates)) {
    throw new Error('Settings templates response was invalid');
  }

  const normalizedTemplates = (templates as Template[]).map((template) => ({
    ...template,
    categories: Array.isArray(template.categories) ? template.categories : ['All'],
  }));

  return {
    systemTemplates: normalizedTemplates.filter((template) => template.type === 'system'),
    customTemplates: normalizedTemplates.filter((template) => template.type === 'custom'),
  };
};

const templateMatchesCreate = (templates: Template[], expected: Template) =>
  templates.some((template) => template.id === expected.id || template.name === expected.name);

const normalizeTemplateKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

export const SettingsTemplates: React.FC<SettingsTemplatesProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setLoadError(null);
      const response = await Api.getSettingsTemplates();
      const snapshot = normalizeTemplates(response);
      setTemplates(snapshot.systemTemplates);
      setCustomTemplates(snapshot.customTemplates);
      return snapshot;
    } catch (error: unknown) {
      setTemplates([]);
      setCustomTemplates([]);
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load settings templates'));
      return null;
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [currentUser.id, loadData]);

  const handleApplyTemplate = async (template: Template) => {
    if (
      !window.confirm(
        t('settings.templates.applyConfirm', {
          defaultValue: 'Apply "{{name}}" template? This will overwrite your current settings.',
          name: getTemplateLabel(template, 'name'),
        })
      )
    )
      return;

    try {
      setApplying(template.id);
      await Api.applySettingsTemplate(template.id);
      toast.success(
        t('settings.templates.applied', {
          defaultValue: 'Applied "{{name}}" template',
          name: getTemplateLabel(template, 'name'),
        })
      );
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(
          error,
          t('settings.templates.applyError', 'Failed to apply template')
        )
      );
    } finally {
      setApplying(null);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;

    try {
      setActionError(null);
      // Get current settings to save as template
      const exportResponse = await Api.exportSettings();
      const settingsData = exportResponse?.data?.settings || {};

      const response = await Api.createSettingsTemplate({
        name: newTemplateName,
        description:
          newTemplateDesc ||
          t('settings.templates.customDescriptionFallback', 'Custom settings template'),
        icon: '📋',
        settingsData,
      });

      if (!response?.template) {
        throw new Error('Template creation response was invalid');
      }
      const template = response.template as unknown as Template;
      const snapshot = await loadData(false);
      if (!snapshot || !templateMatchesCreate(snapshot.customTemplates, template)) {
        throw new Error('Settings template creation was not confirmed by the server');
      }

      setShowCreateModal(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
      toast.success(t('settings.templates.created', 'Template created from current settings'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.templates.createError', 'Failed to create template')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm(t('settings.templates.deleteConfirm', 'Delete this template?'))) return;

    try {
      await Api.deleteSettingsTemplate(id);
      const snapshot = await loadData(false);
      if (!snapshot || snapshot.customTemplates.some((template) => template.id === id)) {
        throw new Error('Settings template deletion was not confirmed by the server');
      }
      toast.success(t('settings.templates.deleted', 'Template deleted'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.templates.deleteError', 'Failed to delete template')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const getTemplateLabel = (template: Template, field: 'name' | 'description') => {
    if (template.type !== 'system') return template[field];
    const key = normalizeTemplateKey(template.id || template.name);
    return t(`settings.templates.system.${key}.${field}`, template[field]);
  };

  const getCategoryLabel = (category: string) =>
    t(`settings.templates.categories.${normalizeTemplateKey(category)}`, category);

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Layout size={28} className="text-indigo-500" />
            {t('settings.templates.title', 'Settings Templates')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.templates.subtitle', 'Apply predefined configurations or save your own')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!!loadError}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
        >
          <Plus size={16} />
          {t('settings.templates.saveCurrent', 'Save Current as Template')}
        </button>
      </div>

      {loadError && (
        <DegradedState title="Settings templates unavailable" description={loadError} />
      )}

      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
        >
          {actionError}
        </div>
      )}

      {/* System Templates */}
      {!loadError && (
        <div>
          <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
            <Zap size={18} className="text-amber-500" />
            {t('settings.templates.systemTemplates', 'System Templates')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`bg-c-surface border rounded-xl p-4 hover:shadow-md transition-shadow ${template.isRecommended ? 'border-indigo-300 dark:border-indigo-500/50' : 'border-c-border-subtle dark:border-navy-700'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{template.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-c-text">
                          {getTemplateLabel(template, 'name')}
                        </h4>
                        {template.isRecommended && (
                          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-medium">
                            {t('settings.templates.recommended', 'Recommended')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-c-text-muted mt-1">
                        {getTemplateLabel(template, 'description')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {template.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 bg-c-surface-raised rounded text-xs text-c-text-secondary"
                    >
                      {getCategoryLabel(cat)}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleApplyTemplate(template)}
                  disabled={applying === template.id}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg disabled:opacity-50"
                >
                  {applying === template.id ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />{' '}
                      {t('settings.templates.applying', 'Applying...')}
                    </>
                  ) : (
                    <>
                      <Check size={16} /> {t('settings.templates.applyTemplate', 'Apply Template')}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Templates */}
      {!loadError && (
        <div>
          <h3 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
            <Star size={18} className="text-amber-500" />
            {t('settings.templates.myTemplates', 'My Templates')}
          </h3>
          {customTemplates.length === 0 ? (
            <div className="bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-xl p-8 text-center">
              <Layout size={48} className="mx-auto mb-3 text-c-text-secondary" />
              <p className="text-c-text-muted">
                {t('settings.templates.noCustomTemplates', 'No custom templates yet')}
              </p>
              <p className="text-sm text-c-text-secondary mt-1">
                {t(
                  'settings.templates.noCustomTemplatesHint',
                  'Save your current settings as a template to use later'
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{template.icon}</span>
                    <div>
                      <h4 className="font-semibold text-c-text">{template.name}</h4>
                      <p className="text-sm text-c-text-muted">{template.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApplyTemplate(template)}
                      disabled={applying === template.id}
                      className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg text-sm"
                    >
                      {t('settings.templates.apply', 'Apply')}
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-2 text-c-text-secondary hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-c-surface rounded-xl p-6 w-full max-w-md mx-4 animate-in zoom-in-95">
            <h3 className="text-lg font-semibold text-c-text mb-4">
              {t('settings.templates.saveAsTemplate', 'Save as Template')}
            </h3>

            <div className="space-y-4">
              {actionError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-sm"
                >
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('settings.templates.templateName', 'Template Name')}
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={t('settings.templates.namePlaceholder', 'My Settings Template')}
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('settings.templates.descriptionOptional', 'Description (optional)')}
                </label>
                <textarea
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  placeholder={t(
                    'settings.templates.descriptionPlaceholder',
                    'Describe this template...'
                  )}
                  rows={3}
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800 rounded-lg"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50"
              >
                {t('settings.templates.saveTemplate', 'Save Template')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsTemplates;
