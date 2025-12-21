import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { PlaybookTemplateVersion, TemplateStatus, AppView } from '../../types';
import {
    FileText,
    Plus,
    Edit3,
    Check,
    Download,
    Archive,
    AlertCircle,
    Eye,
    ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

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
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to load templates');

            const data = await res.json();
            setTemplates(data);
        } catch (err) {
            console.error('Error loading templates:', err);
            toast.error('Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async (templateId: string) => {
        try {
            setValidating(templateId);
            const res = await fetch(`/api/ai/playbooks/templates/${templateId}/validate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
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
                headers: { Authorization: `Bearer ${token}` }
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
                headers: { Authorization: `Bearer ${token}` }
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
                headers: { Authorization: `Bearer ${token}` }
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

    const getStatusBadge = (status: TemplateStatus) => {
        const styles = {
            [TemplateStatus.DRAFT]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            [TemplateStatus.PUBLISHED]: 'bg-green-100 text-green-800 border-green-300',
            [TemplateStatus.DEPRECATED]: 'bg-gray-100 text-gray-600 border-gray-300'
        };

        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || styles[TemplateStatus.DRAFT]}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Playbook Templates</h1>
                    <p className="text-gray-600 mt-1">Create and manage AI playbook templates</p>
                </div>
                <button
                    onClick={() => {
                        // Navigate to create new template
                        toast('Create template UI coming soon');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                    <Plus size={18} />
                    New Template
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setStatusFilter('')}
                    className={`px-3 py-1.5 text-sm rounded-lg ${!statusFilter ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    All
                </button>
                <button
                    onClick={() => setStatusFilter('DRAFT')}
                    className={`px-3 py-1.5 text-sm rounded-lg ${statusFilter === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    Drafts
                </button>
                <button
                    onClick={() => setStatusFilter('PUBLISHED')}
                    className={`px-3 py-1.5 text-sm rounded-lg ${statusFilter === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    Published
                </button>
                <button
                    onClick={() => setStatusFilter('DEPRECATED')}
                    className={`px-3 py-1.5 text-sm rounded-lg ${statusFilter === 'DEPRECATED' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    Deprecated
                </button>
            </div>

            {/* Template List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : templates.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                    <p className="text-gray-500 mb-4">Get started by creating your first playbook template.</p>
                    <button
                        onClick={() => toast('Create template UI coming soon')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        <Plus size={18} />
                        Create Template
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trigger</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {templates.map((template) => (
                                <tr key={template.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <FileText className="h-5 w-5 text-gray-400 mr-3" />
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{template.title}</div>
                                                <div className="text-xs text-gray-500 font-mono">{template.key}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-600 font-mono">{template.triggerSignal || '—'}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-600">v{template.version}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(template.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            {/* View/Edit */}
                                            {template.status === TemplateStatus.DRAFT ? (
                                                <button
                                                    onClick={() => toast('Edit UI coming soon')}
                                                    title="Edit"
                                                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => toast('Preview UI coming soon')}
                                                    title="View"
                                                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            )}

                                            {/* Validate */}
                                            <button
                                                onClick={() => handleValidate(template.id)}
                                                disabled={validating === template.id}
                                                title="Validate"
                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                                            >
                                                <AlertCircle size={16} />
                                            </button>

                                            {/* Publish (only for DRAFT) */}
                                            {template.status === TemplateStatus.DRAFT && (
                                                <button
                                                    onClick={() => handlePublish(template.id)}
                                                    title="Publish"
                                                    className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                                                >
                                                    <Check size={16} />
                                                </button>
                                            )}

                                            {/* Export */}
                                            <button
                                                onClick={() => handleExport(template.id)}
                                                title="Export JSON"
                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                            >
                                                <Download size={16} />
                                            </button>

                                            {/* Deprecate (only for PUBLISHED) */}
                                            {template.status === TemplateStatus.PUBLISHED && (
                                                <button
                                                    onClick={() => handleDeprecate(template.id)}
                                                    title="Deprecate"
                                                    className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded"
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
