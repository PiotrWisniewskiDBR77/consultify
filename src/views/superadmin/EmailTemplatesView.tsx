import {
  AlertCircle,
  Archive,
  BarChart2,
  CheckCircle2,
  Copy,
  Edit,
  Eye,
  Filter,
  FolderOpen,
  History,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Send,
  Tag,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmailTemplateEditor } from '../../components/SuperAdmin/EmailTemplateEditor';
import { Api } from '../../services/api';
import type { ContentCategory, ContentTag, EmailTemplate, EmailTemplateStatus } from '../../types';

interface EmailTemplatesViewProps {
  onBack?: () => void;
}

export const EmailTemplatesView: React.FC<EmailTemplatesViewProps> = ({ onBack }) => {
  const { t } = useTranslation();
  // State
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [tags, setTags] = useState<ContentTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmailTemplateStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  // Actions state
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('categoryId', categoryFilter);

      const data = await Api.get(`/content/emails/templates?${params.toString()}`);
      setTemplates((data as any)?.templates || []);
    } catch (err: any) {
      const errorMessage =
        err instanceof Error ? err.message : t('superadmin.emailTemplates.toast.loadFailed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, categoryFilter]);

  // Load categories and tags
  const loadMetadata = useCallback(async () => {
    try {
      const [catData, tagData] = await Promise.all([
        Api.get('/content/categories?contentType=EMAIL'),
        Api.get('/content/tags?contentType=EMAIL'),
      ]);

      setCategories((catData as any)?.categories || []);
      setTags((tagData as any)?.tags || []);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadMetadata();
  }, [loadTemplates, loadMetadata]);

  // Actions
  const handlePublish = async (templateId: string) => {
    setActionLoading(templateId);
    try {
      await Api.post(`/content/emails/templates/${templateId}/publish`, {});
      await loadTemplates();
    } catch (err) {
      console.error('Publish error:', err);
    } finally {
      setActionLoading(null);
      setActionMenuOpen(null);
    }
  };

  const handleDeprecate = async (templateId: string) => {
    setActionLoading(templateId);
    try {
      await Api.post(`/content/emails/templates/${templateId}/deprecate`, {});
      await loadTemplates();
    } catch (err) {
      console.error('Deprecate error:', err);
    } finally {
      setActionLoading(null);
      setActionMenuOpen(null);
    }
  };

  const handleClone = async (templateId: string) => {
    setActionLoading(templateId);
    try {
      await Api.post(`/content/emails/templates/${templateId}/clone`, {});
      await loadTemplates();
    } catch (err) {
      console.error('Clone error:', err);
    } finally {
      setActionLoading(null);
      setActionMenuOpen(null);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm(t('superadmin.emailTemplates.toast.confirmDelete'))) return;

    setActionLoading(templateId);
    try {
      await Api.delete(`/content/emails/templates/${templateId}`);
      await loadTemplates();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setActionLoading(null);
      setActionMenuOpen(null);
    }
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditorOpen(true);
    setActionMenuOpen(null);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setSelectedTemplate(null);
    loadTemplates();
  };

  // Status badge
  const getStatusBadge = (status: EmailTemplateStatus) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={12} />
            {t('superadmin.emailTemplates.status.published')}
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Edit size={12} />
            {t('superadmin.emailTemplates.status.draft')}
          </span>
        );
      case 'DEPRECATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-white/10">
            <Archive size={12} />
            {t('superadmin.emailTemplates.status.deprecated')}
          </span>
        );
      default:
        return null;
    }
  };

  // Editor view
  if (editorOpen) {
    return (
      <EmailTemplateEditor
        template={selectedTemplate}
        categories={categories}
        tags={tags}
        onClose={handleEditorClose}
        onSave={handleEditorClose}
      />
    );
  }

  return (
    <div className="h-full p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary-600/10 border border-primary-500/20">
              <Mail className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('superadmin.emailTemplates.title')}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {t('superadmin.emailTemplates.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium hover:bg-navy-800 transition-colors"
          >
            <Plus size={18} />
            {t('superadmin.emailTemplates.newTemplate')}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-navy-900/20 border border-slate-200 dark:border-navy-800 rounded-xl p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[280px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400" />
                <input
                  type="text"
                  placeholder={t('superadmin.emailTemplates.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search templates"
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-950/20 border border-slate-200 dark:border-navy-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EmailTemplateStatus | '')}
              aria-label="Filter by status"
              className="px-4 py-2.5 bg-white dark:bg-navy-950/20 border border-slate-200 dark:border-navy-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">{t('superadmin.emailTemplates.filters.allStatuses')}</option>
              <option value="DRAFT">{t('superadmin.emailTemplates.status.draft')}</option>
              <option value="PUBLISHED">{t('superadmin.emailTemplates.status.published')}</option>
              <option value="DEPRECATED">{t('superadmin.emailTemplates.status.deprecated')}</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="px-4 py-2.5 bg-white dark:bg-navy-950/20 border border-slate-200 dark:border-navy-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">{t('superadmin.emailTemplates.filters.allCategories')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Toggle Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                showFilters
                  ? 'bg-primary-500/10 border-primary-500/30 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-navy-950/20 border-slate-200 dark:border-navy-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Filter size={18} />
              {t('superadmin.emailTemplates.filters.filtersLabel')}
            </button>

            {/* Refresh */}
            <button
              onClick={loadTemplates}
              disabled={loading}
              aria-label="Refresh templates"
              className="p-2.5 bg-white dark:bg-navy-950/20 border border-slate-200 dark:border-navy-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-danger-400" />
            <span className="text-danger-400">{error}</span>
          </div>
        )}

        {/* Templates List */}
        <div className="bg-white dark:bg-navy-900/20 border border-slate-200 dark:border-navy-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-slate-500 dark:text-slate-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                {t('superadmin.emailTemplates.loading')}
              </p>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {t('superadmin.emailTemplates.empty.title')}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {searchQuery || statusFilter || categoryFilter
                  ? t('superadmin.emailTemplates.empty.withFilters')
                  : t('superadmin.emailTemplates.empty.noFilters')}
              </p>
              {!searchQuery && !statusFilter && !categoryFilter && (
                <button
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600/10 border border-primary-500/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-600/15 transition-colors"
                >
                  <Plus size={18} />
                  {t('superadmin.emailTemplates.empty.cta')}
                </button>
              )}
            </div>
          ) : (
            <table
              /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
            >
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-white/5">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t('superadmin.emailTemplates.table.template')}
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t('superadmin.emailTemplates.table.category')}
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t('superadmin.emailTemplates.table.status')}
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t('superadmin.emailTemplates.table.version')}
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t('superadmin.emailTemplates.table.usage')}
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t('superadmin.emailTemplates.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-navy-800">
                {templates.map((template) => (
                  <tr
                    key={template.id}
                    className="hover:bg-slate-50 dark:hover:bg-navy-800/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{
                            backgroundColor: template.category?.color
                              ? `${template.category.color}20`
                              : '#6366F120',
                          }}
                        >
                          <Mail
                            size={16}
                            style={{
                              color: template.category?.color || '#6366F1',
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {template.name}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                            {template.templateKey}
                          </div>
                          {template.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                              {template.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {template.category ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${template.category.color}20`,
                            color: template.category.color,
                            borderColor: `${template.category.color}40`,
                            borderWidth: '1px',
                          }}
                        >
                          <FolderOpen size={12} />
                          {template.category.name}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(template.status)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        v{template.version}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {template.usageCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Quick actions */}
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                          title={t('superadmin.emailTemplates.actions.edit')}
                        >
                          <Edit size={16} />
                        </button>

                        {/* More actions menu */}
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActionMenuOpen(actionMenuOpen === template.id ? null : template.id)
                            }
                            aria-label="More actions"
                            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {actionMenuOpen === template.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-lg shadow-xl z-10 py-1">
                              <button
                                onClick={() => handleEdit(template)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                              >
                                <Edit size={14} />
                                {t('superadmin.emailTemplates.actions.edit')}
                              </button>
                              <button
                                onClick={() => handleClone(template.id)}
                                disabled={actionLoading === template.id}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
                              >
                                <Copy size={14} />
                                {t('superadmin.emailTemplates.actions.clone')}
                              </button>
                              <a
                                href={`/api/content/emails/templates/${template.id}/preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                              >
                                <Eye size={14} />
                                {t('superadmin.emailTemplates.actions.preview')}
                              </a>
                              <div className="border-t border-slate-200 dark:border-navy-800 my-1" />
                              {template.status === 'DRAFT' && (
                                <button
                                  onClick={() => handlePublish(template.id)}
                                  disabled={actionLoading === template.id}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} />
                                  {t('superadmin.emailTemplates.actions.publish')}
                                </button>
                              )}
                              {template.status === 'PUBLISHED' && (
                                <button
                                  onClick={() => handleDeprecate(template.id)}
                                  disabled={actionLoading === template.id}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                                >
                                  <Archive size={14} />
                                  {t('superadmin.emailTemplates.actions.deprecate')}
                                </button>
                              )}
                              <div className="border-t border-slate-200 dark:border-navy-800 my-1" />
                              <button
                                onClick={() => handleDelete(template.id)}
                                disabled={actionLoading === template.id}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-700 dark:text-danger-400 hover:bg-danger-500/10 disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                {t('superadmin.emailTemplates.actions.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Stats Bar */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-white dark:bg-navy-900/20 border border-slate-200 dark:border-navy-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {templates.length}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {t('superadmin.emailTemplates.stats.total')}
            </div>
          </div>
          <div className="bg-white dark:bg-navy-900/20 border border-slate-200 dark:border-navy-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {templates.filter((tmpl) => tmpl.status === 'PUBLISHED').length}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {t('superadmin.emailTemplates.stats.published')}
            </div>
          </div>
          <div className="bg-white dark:bg-navy-900/20 border border-slate-200 dark:border-navy-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {templates.filter((tmpl) => tmpl.status === 'DRAFT').length}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {t('superadmin.emailTemplates.stats.drafts')}
            </div>
          </div>
          <div className="bg-white dark:bg-navy-900/20 border border-slate-200 dark:border-navy-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-200">
              {templates.reduce((sum, tmpl) => sum + (tmpl.usageCount || 0), 0)}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {t('superadmin.emailTemplates.stats.totalSends')}
            </div>
          </div>
        </div>
      </div>

      {/* Click away handler for menus */}
      {actionMenuOpen && (
        <div className="fixed inset-0 z-0" onClick={() => setActionMenuOpen(null)} />
      )}
    </div>
  );
};

export default EmailTemplatesView;
