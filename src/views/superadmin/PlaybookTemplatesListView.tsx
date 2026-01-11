// @ts-nocheck
import {
  AlertCircle,
  Archive,
  Check,
  Download,
  Edit3,
  Eye,
  FileText,
  Plus,
  Copy,
  Upload,
  Search,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { AppView, PlaybookTemplateVersion, TemplateStatus } from '../../types';

/**
 * PlaybookTemplatesListView
 * Step 13: Visual Playbook Editor
 *
 * SuperAdmin view for managing playbook templates.
 * Lists all templates with status badges and action buttons.
 */
export const PlaybookTemplatesListView: React.FC = () => {
  const token = localStorage.getItem('token');
  const [templates, setTemplates] = useState<PlaybookTemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [validating, setValidating] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fallbackTemplates: PlaybookTemplateVersion[] = [
    {
      id: 'tmpl-1',
      title: 'Test Playbook Template',
      key: 'test_template',
      triggerSignal: 'project_risk_high',
      version: 1,
      status: TemplateStatus.PUBLISHED,
    },
    {
      id: 'tmpl-2',
      title: 'Draft Playbook Template',
      key: 'draft_template',
      triggerSignal: 'project_risk_low',
      version: 1,
      status: TemplateStatus.DRAFT,
    },
  ];

  useEffect(() => {
    loadTemplates();
  }, [statusFilter]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/api/ai/playbooks/templates?status=${statusFilter}`
        : '/api/ai/playbooks/templates';

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load templates');

      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error('Error loading templates:', err);
      toast.error('Failed to load templates, showing sample data');
      setTemplates(fallbackTemplates);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (templateId: string) => {
    try {
      setValidating(templateId);
      const res = await fetch(`/api/ai/playbooks/templates/${templateId}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.ok) {
        toast.success('Template is valid ✓');
      } else {
        toast.error(`Validation failed: ${data.errors.length} error(s)`);
      }
    } catch (err) {
      toast.error('Validation failed');
    } finally {
      setValidating(null);
    }
  };

  const handlePublish = async (templateId: string) => {
    try {
      const res = await fetch(`/api/ai/playbooks/templates/${templateId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.validationErrors) {
          toast.error(`Cannot publish: ${data.validationErrors.length} validation error(s)`);
        } else {
          throw new Error(data.error);
        }
        return;
      }

      toast.success('Template published successfully');
      loadTemplates();
    } catch (err) {
      toast.error('Failed to publish template');
    }
  };

  const handleDeprecate = async (templateId: string) => {
    if (!confirm('Are you sure you want to deprecate this template?')) return;

    try {
      const res = await fetch(`/api/ai/playbooks/templates/${templateId}/deprecate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to deprecate');

      toast.success('Template deprecated');
      loadTemplates();
    } catch (err) {
      toast.error('Failed to deprecate template');
    }
  };

  const handleExport = async (templateId: string) => {
    try {
      const res = await fetch(`/api/ai/playbooks/templates/${templateId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Export failed');

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playbook-${templateId}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Template exported');
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const handleDuplicate = (templateId: string) => {
    const original = templates.find((t) => t.id === templateId);
    if (!original) return;
    const clone: PlaybookTemplateVersion = {
      ...original,
      id: `${templateId}-copy-${Date.now()}`,
      title: `${original.title} (Copy)`,
      status: TemplateStatus.DRAFT,
      version: (original.version || 1) + 1,
    };
    setTemplates([clone, ...templates]);
    toast.success('Template duplicated as draft');
  };

  const handleImport = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(String(e.target?.result || '{}'));
        const imported: PlaybookTemplateVersion = {
          id: json.id || `import-${Date.now()}`,
          title: json.title || 'Imported Template',
          key: json.key || `import_${Date.now()}`,
          triggerSignal: json.triggerSignal || json.trigger || 'unknown',
          version: json.version || 1,
          status: json.status || TemplateStatus.DRAFT,
        };
        setTemplates([imported, ...templates]);
        toast.success('Template imported');
      } catch {
        toast.error('Invalid template JSON');
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Playbook Templates</h1>
          <p className="text-slate-400 dark:text-slate-500 mt-1">
            Create and manage AI playbook templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 dark:bg-navy-900/30 border border-white/20 text-slate-200 rounded-lg hover:bg-white/20 transition"
          >
            <Upload size={16} />
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleImport(e.target.files)}
          />
          <button
            onClick={() => toast('Create template UI coming soon')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={18} />
            New Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 items-center">
        <div className="flex items-center px-3 py-1.5 bg-white/10 dark:bg-navy-900/30 border border-white/20 rounded-lg w-64">
          <Search size={14} className="text-slate-400 dark:text-slate-500 mr-2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates..."
            className="w-full text-sm outline-none bg-transparent text-white placeholder:text-slate-500 dark:text-slate-400"
          />
        </div>
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${!statusFilter ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50' : 'bg-white/5 text-slate-400 dark:text-slate-500 border-white/10 hover:bg-slate-100 dark:hover:bg-navy-800/40'}`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter('DRAFT')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${statusFilter === 'DRAFT' ? 'bg-yellow-600/30 text-yellow-300 border-yellow-500/50' : 'bg-white/5 text-slate-400 dark:text-slate-500 border-white/10 hover:bg-slate-100 dark:hover:bg-navy-800/40'}`}
        >
          Drafts
        </button>
        <button
          onClick={() => setStatusFilter('PUBLISHED')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${statusFilter === 'PUBLISHED' ? 'bg-green-600/30 text-green-300 border-green-500/50' : 'bg-white/5 text-slate-400 dark:text-slate-500 border-white/10 hover:bg-slate-100 dark:hover:bg-navy-800/40'}`}
        >
          Published
        </button>
        <button
          onClick={() => setStatusFilter('DEPRECATED')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${statusFilter === 'DEPRECATED' ? 'bg-slate-600/30 text-slate-300 border-slate-500/50' : 'bg-white/5 text-slate-400 dark:text-slate-500 border-white/10 hover:bg-slate-100 dark:hover:bg-navy-800/40'}`}
        >
          Deprecated
        </button>
      </div>

      {/* Template List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white/5 dark:bg-navy-900/20 rounded-lg border border-white/10 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-500 dark:text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No templates found</h3>
          <p className="text-slate-400 dark:text-slate-500 mb-4">
            Get started by creating your first playbook template.
          </p>
          <button
            onClick={() => toast('Create template UI coming soon')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus size={18} />
            Create Template
          </button>
        </div>
      ) : (
        <div className="bg-white/5 dark:bg-navy-900/20 rounded-lg border border-white/10 overflow-hidden">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5 dark:bg-navy-900/20">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Trigger
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredTemplates.map((template) => (
                <tr
                  key={template.id}
                  className="hover:bg-slate-50 dark:hover:bg-navy-800/20 transition"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-white">{template.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {template.key}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300 font-mono">
                      {template.triggerSignal || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">v{template.version}</span>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(template.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {/* View/Edit */}
                      {template.status === TemplateStatus.DRAFT ? (
                        <button
                          onClick={() => toast('Edit UI coming soon')}
                          title="Edit"
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/20 rounded transition"
                        >
                          <Edit3 size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => toast('Preview UI coming soon')}
                          title="View"
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/20 rounded transition"
                        >
                          <Eye size={16} />
                        </button>
                      )}

                      {/* Validate */}
                      <button
                        onClick={() => handleValidate(template.id)}
                        disabled={validating === template.id}
                        title="Validate"
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-400 hover:bg-blue-500/20 rounded transition disabled:opacity-50"
                      >
                        <AlertCircle size={16} />
                      </button>

                      {/* Publish (only for DRAFT) */}
                      {template.status === TemplateStatus.DRAFT && (
                        <button
                          onClick={() => handlePublish(template.id)}
                          title="Publish"
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-green-400 hover:bg-green-500/20 rounded transition"
                        >
                          <Check size={16} />
                        </button>
                      )}

                      {/* Duplicate */}
                      <button
                        onClick={() => handleDuplicate(template.id)}
                        title="Duplicate"
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/20 rounded transition"
                      >
                        <Copy size={16} />
                      </button>

                      {/* Export */}
                      <button
                        onClick={() => handleExport(template.id)}
                        title="Export JSON"
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded transition"
                      >
                        <Download size={16} />
                      </button>

                      {/* Deprecate (only for PUBLISHED) */}
                      {template.status === TemplateStatus.PUBLISHED && (
                        <button
                          onClick={() => handleDeprecate(template.id)}
                          title="Deprecate"
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-orange-400 hover:bg-orange-500/20 rounded transition"
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
    </div>
  );
};

export default PlaybookTemplatesListView;
