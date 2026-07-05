// @ts-nocheck
import {
  AlertCircle,
  Archive,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { AppView, PlaybookTemplateVersion, TemplateStatus } from '../../types';
import { PlaybookEditorView } from './PlaybookEditorView';

/**
 * PlaybookTemplatesListView
 * Step 13: Visual Playbook Editor
 *
 * SuperAdmin view for managing playbook templates.
 * Lists all templates with status badges and action buttons.
 */
export const PlaybookTemplatesListView: React.FC = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<PlaybookTemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [validating, setValidating] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    key: '',
    triggerSignal: '',
    description: '',
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, [statusFilter]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/ai/playbooks/templates?status=${statusFilter}`
        : '/ai/playbooks/templates';
      const data = await Api.get(url);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading templates:', err);
      toast.error(t('superadmin.playbookTemplates.toast.loadFailed'));
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (templateId: string) => {
    try {
      setValidating(templateId);
      const data = await Api.post(`/ai/playbooks/templates/${templateId}/validate`, {});

      if (data.ok) {
        toast.success(t('superadmin.playbookTemplates.toast.valid'));
      } else {
        toast.error(
          `${t('superadmin.playbookTemplates.toast.validationFailed')}: ${data.errors.length} error(s)`
        );
      }
    } catch (err) {
      toast.error(t('superadmin.playbookTemplates.toast.validationFailed'));
    } finally {
      setValidating(null);
    }
  };

  const handlePublish = async (templateId: string) => {
    try {
      await Api.post(`/ai/playbooks/templates/${templateId}/publish`, {});
      toast.success(t('superadmin.playbookTemplates.toast.published'));
      loadTemplates();
    } catch (err) {
      toast.error(t('superadmin.playbookTemplates.toast.publishFailed'));
    }
  };

  const handleDeprecate = async (templateId: string) => {
    if (!confirm(t('superadmin.playbookTemplates.actions.deprecate') + '?')) return;

    try {
      await Api.post(`/ai/playbooks/templates/${templateId}/deprecate`, {});
      toast.success(t('superadmin.playbookTemplates.toast.deprecated'));
      loadTemplates();
    } catch (err) {
      toast.error(t('superadmin.playbookTemplates.toast.deprecateFailed'));
    }
  };

  const handleExport = async (templateId: string) => {
    try {
      const data = await Api.get(`/ai/playbooks/templates/${templateId}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playbook-${templateId}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(t('superadmin.playbookTemplates.toast.exported'));
    } catch (err) {
      toast.error(t('superadmin.playbookTemplates.toast.exportFailed'));
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.title.trim() || !newTemplate.key.trim() || !newTemplate.triggerSignal.trim()) {
      toast.error(t('superadmin.playbookTemplates.toast.fieldsRequired'));
      return;
    }
    try {
      setCreating(true);
      await Api.post('/ai/playbooks/templates', {
        title: newTemplate.title,
        key: newTemplate.key,
        triggerSignal: newTemplate.triggerSignal,
        description: newTemplate.description || undefined,
      });
      toast.success(t('superadmin.playbookTemplates.toast.created'));
      setShowCreateModal(false);
      setNewTemplate({ title: '', key: '', triggerSignal: '', description: '' });
      loadTemplates();
    } catch (err) {
      toast.error(t('superadmin.playbookTemplates.toast.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (templateId: string) => {
    try {
      const exportData = await Api.get(`/ai/playbooks/templates/${templateId}/export`);
      const baseKey = String(exportData?.key || `tpl_${Date.now()}`)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      const newKey = `${baseKey}_copy_${Date.now()}`.slice(0, 80);
      const newTitle = `${exportData?.title || 'Template'} (Copy)`;

      await Api.post('/ai/playbooks/templates', {
        key: newKey,
        title: newTitle,
        triggerSignal: exportData?.triggerSignal || exportData?.trigger_signal || 'unknown',
        description: exportData?.description || '',
        templateGraph: exportData?.templateGraph || null,
        estimatedDurationMins: exportData?.estimatedDurationMins || null,
      });

      toast.success(t('superadmin.playbookTemplates.toast.duplicated'));
      loadTemplates();
    } catch (err) {
      console.error('Duplicate failed:', err);
      toast.error(t('superadmin.playbookTemplates.toast.createFailed'));
    }
  };

  const handleImport = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(String(e.target?.result || '{}'));
        const rawKey = String(json.key || `import_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const key = `${rawKey}`.slice(0, 80);
        await Api.post('/ai/playbooks/templates', {
          key,
          title: json.title || 'Imported Template',
          triggerSignal: json.triggerSignal || json.trigger || 'unknown',
          description: json.description || '',
          templateGraph: json.templateGraph || null,
          estimatedDurationMins: json.estimatedDurationMins || null,
        });
        toast.success(t('superadmin.playbookTemplates.toast.imported'));
        loadTemplates();
      } catch {
        toast.error(t('superadmin.playbookTemplates.toast.importInvalid'));
      }
    };
    reader.readAsText(file);
  };

  const filteredTemplates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return templates.filter((t) => {
      const statusOk = !statusFilter || t.status === statusFilter;
      const text = `${t.title} ${t.key} ${t.triggerSignal}`.toLowerCase();
      const searchOk = !term || text.includes(term);
      return statusOk && searchOk;
    });
  }, [templates, statusFilter, searchTerm]);

  const getStatusBadge = (status: TemplateStatus) => {
    const styles = {
      [TemplateStatus.DRAFT]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      [TemplateStatus.PUBLISHED]: 'bg-green-100 text-green-800 border-green-300',
      [TemplateStatus.DEPRECATED]:
        'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-400 border-gray-300',
    };

    return (
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || styles[TemplateStatus.DRAFT]}`}
      >
        {status}
      </span>
    );
  };

  if (editorTemplateId) {
    return (
      <PlaybookEditorView
        templateId={editorTemplateId}
        onBack={() => {
          setEditorTemplateId(null);
          loadTemplates();
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('superadmin.playbookTemplates.title')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t('superadmin.playbookTemplates.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-navy-900/30 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-white/10 transition"
          >
            <Upload size={16} />
            {t('superadmin.playbookTemplates.importJson')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleImport(e.target.files)}
          />
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 transition"
          >
            <Plus size={18} />
            {t('superadmin.playbookTemplates.newTemplate')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 items-center">
        <div className="flex items-center px-3 py-1.5 bg-white dark:bg-navy-900/30 border border-slate-200 dark:border-white/10 rounded-lg w-64">
          <Search size={14} className="text-slate-500 dark:text-slate-400 mr-2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('superadmin.playbookTemplates.searchPlaceholder')}
            className="w-full text-sm outline-none bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${!statusFilter ? 'bg-slate-100 dark:bg-white/[0.08] text-[var(--c-info)] border-c-info/30' : 'bg-white text-slate-600 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10'}`}
        >
          {t('superadmin.playbookTemplates.filters.all')}
        </button>
        <button
          onClick={() => setStatusFilter('DRAFT')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${statusFilter === 'DRAFT' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' : 'bg-white text-slate-600 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10'}`}
        >
          {t('superadmin.playbookTemplates.filters.drafts')}
        </button>
        <button
          onClick={() => setStatusFilter('PUBLISHED')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${statusFilter === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' : 'bg-white text-slate-600 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10'}`}
        >
          {t('superadmin.playbookTemplates.filters.published')}
        </button>
        <button
          onClick={() => setStatusFilter('DEPRECATED')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${statusFilter === 'DEPRECATED' ? 'bg-slate-200 text-slate-800 dark:bg-slate-600/30 dark:text-slate-200 border-slate-300 dark:border-slate-500/50' : 'bg-white text-slate-600 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10'}`}
        >
          {t('superadmin.playbookTemplates.filters.deprecated')}
        </button>
      </div>

      {/* Template List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white dark:bg-navy-900/20 rounded-lg border border-slate-200 dark:border-white/10 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            {t('superadmin.playbookTemplates.empty.title')}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {t('superadmin.playbookTemplates.empty.description')}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800"
          >
            <Plus size={18} />
            {t('superadmin.playbookTemplates.empty.cta')}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-navy-900/20 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
          <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="min-w-full divide-y divide-slate-200 dark:divide-white/10">
            <thead className="bg-slate-50 dark:bg-navy-900/20">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  {t('superadmin.playbookTemplates.table.template')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  {t('superadmin.playbookTemplates.table.trigger')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  {t('superadmin.playbookTemplates.table.version')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  {t('superadmin.playbookTemplates.table.status')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  {t('superadmin.playbookTemplates.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {filteredTemplates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-slate-50 dark:hover:bg-navy-800/20 transition"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {template.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {template.key}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                      {template.triggerSignal || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      v{template.version}
                    </span>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(template.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {/* View/Edit */}
                      {template.status === TemplateStatus.DRAFT ? (
                        <button
                          onClick={() => setEditorTemplateId(template.id)}
                          title={t('superadmin.playbookTemplates.actions.edit')}
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:bg-primary-500/10 rounded transition"
                        >
                          <Edit3 size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditorTemplateId(template.id)}
                          title={t('superadmin.playbookTemplates.actions.view')}
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:bg-primary-500/10 rounded transition"
                        >
                          <Eye size={16} />
                        </button>
                      )}

                      {/* Validate */}
                      <button
                        onClick={() => handleValidate(template.id)}
                        disabled={validating === template.id}
                        title={t('superadmin.playbookTemplates.actions.validate')}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-500/10 rounded transition disabled:opacity-50"
                      >
                        <AlertCircle size={16} />
                      </button>

                      {/* Publish (only for DRAFT) */}
                      {template.status === TemplateStatus.DRAFT && (
                        <button
                          onClick={() => handlePublish(template.id)}
                          title={t('superadmin.playbookTemplates.actions.publish')}
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 hover:bg-emerald-500/10 rounded transition"
                        >
                          <Check size={16} />
                        </button>
                      )}

                      {/* Duplicate */}
                      <button
                        onClick={() => handleDuplicate(template.id)}
                        title={t('superadmin.playbookTemplates.actions.duplicate')}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:bg-primary-500/10 rounded transition"
                      >
                        <Copy size={16} />
                      </button>

                      {/* Export */}
                      <button
                        onClick={() => handleExport(template.id)}
                        title={t('superadmin.playbookTemplates.actions.export')}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded transition"
                      >
                        <Download size={16} />
                      </button>

                      {/* Deprecate (only for PUBLISHED) */}
                      {template.status === TemplateStatus.PUBLISHED && (
                        <button
                          onClick={() => handleDeprecate(template.id)}
                          title={t('superadmin.playbookTemplates.actions.deprecate')}
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-amber-600 hover:bg-amber-500/10 rounded transition"
                        >
                          <Archive size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('superadmin.playbookTemplates.modal.title')}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('superadmin.playbookTemplates.modal.titleField')} *
                </label>
                <input
                  type="text"
                  value={newTemplate.title}
                  onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                  placeholder="e.g. Weekly Summary Report"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('superadmin.playbookTemplates.modal.keyField')} *
                </label>
                <input
                  type="text"
                  value={newTemplate.key}
                  onChange={(e) =>
                    setNewTemplate({
                      ...newTemplate,
                      key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
                    })
                  }
                  placeholder="e.g. weekly_summary"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('superadmin.playbookTemplates.modal.triggerField')} *
                </label>
                <input
                  type="text"
                  value={newTemplate.triggerSignal}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, triggerSignal: e.target.value })
                  }
                  placeholder="e.g. deadline_approaching"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('superadmin.playbookTemplates.modal.descriptionField')}
                </label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  placeholder="Brief description of this playbook template..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                {t('superadmin.playbookTemplates.modal.cancel')}
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={
                  creating ||
                  !newTemplate.title.trim() ||
                  !newTemplate.key.trim() ||
                  !newTemplate.triggerSignal.trim()
                }
                className="px-4 py-2 text-sm bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {creating
                  ? t('superadmin.playbookTemplates.modal.creating')
                  : t('superadmin.playbookTemplates.modal.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaybookTemplatesListView;
