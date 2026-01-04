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

import { EmailTemplateEditor } from '../../components/SuperAdmin/EmailTemplateEditor';
import type { ContentCategory, ContentTag, EmailTemplate, EmailTemplateStatus } from '../../types';

interface EmailTemplatesViewProps {
    onBack?: () => void;
}

export const EmailTemplatesView: React.FC<EmailTemplatesViewProps> = ({ onBack }) => {
    const token = localStorage.getItem('token');

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

            const res = await fetch(`/api/content/emails/templates?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('Failed to load templates');

            const data = await res.json();
            setTemplates(data.templates || []);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load templates';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [token, searchQuery, statusFilter, categoryFilter]);

    // Load categories and tags
    const loadMetadata = useCallback(async () => {
        try {
            const [catRes, tagRes] = await Promise.all([
                fetch('/api/content/categories?contentType=EMAIL', {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch('/api/content/tags?contentType=EMAIL', {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (catRes.ok) {
                const catData = await catRes.json();
                setCategories(catData.categories || []);
            }

            if (tagRes.ok) {
                const tagData = await tagRes.json();
                setTags(tagData.tags || []);
            }
        } catch (err) {
            console.error('Failed to load metadata:', err);
        }
    }, [token]);

    useEffect(() => {
        loadTemplates();
        loadMetadata();
    }, [loadTemplates, loadMetadata]);

    // Actions
    const handlePublish = async (templateId: string) => {
        setActionLoading(templateId);
        try {
            const res = await fetch(`/api/content/emails/templates/${templateId}/publish`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('Failed to publish template');

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
            const res = await fetch(`/api/content/emails/templates/${templateId}/deprecate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('Failed to deprecate template');

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
            const res = await fetch(`/api/content/emails/templates/${templateId}/clone`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            });

            if (!res.ok) throw new Error('Failed to clone template');

            await loadTemplates();
        } catch (err) {
            console.error('Clone error:', err);
        } finally {
            setActionLoading(null);
            setActionMenuOpen(null);
        }
    };

    const handleDelete = async (templateId: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        setActionLoading(templateId);
        try {
            const res = await fetch(`/api/content/emails/templates/${templateId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('Failed to delete template');

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
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={12} />
                        Published
                    </span>
                );
            case 'DRAFT':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Edit size={12} />
                        Draft
                    </span>
                );
            case 'DEPRECATED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        <Archive size={12} />
                        Deprecated
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-600/20 border border-pink-500/20">
                            <Mail className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Email Templates</h1>
                            <p className="text-slate-400 text-sm">
                                Manage email templates for notifications and communications
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-rose-700 transition-all duration-200 shadow-lg shadow-pink-500/25"
                    >
                        <Plus size={18} />
                        New Template
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Search */}
                        <div className="flex-1 min-w-[280px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search templates..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    aria-label="Search templates"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
                                />
                            </div>
                        </div>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as EmailTemplateStatus | '')}
                            aria-label="Filter by status"
                            className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                        >
                            <option value="">All Statuses</option>
                            <option value="DRAFT">Draft</option>
                            <option value="PUBLISHED">Published</option>
                            <option value="DEPRECATED">Deprecated</option>
                        </select>

                        {/* Category Filter */}
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            aria-label="Filter by category"
                            className="px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                        >
                            <option value="">All Categories</option>
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
                                    ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                                    : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                            <Filter size={18} />
                            Filters
                        </button>

                        {/* Refresh */}
                        <button
                            onClick={loadTemplates}
                            disabled={loading}
                            aria-label="Refresh templates"
                            className="p-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <span className="text-red-400">{error}</span>
                    </div>
                )}

                {/* Templates List */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center">
                            <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-4" />
                            <p className="text-slate-400">Loading templates...</p>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="p-12 text-center">
                            <Mail className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-white mb-2">No templates found</h3>
                            <p className="text-slate-400 mb-6">
                                {searchQuery || statusFilter || categoryFilter
                                    ? 'Try adjusting your filters'
                                    : 'Get started by creating your first email template'}
                            </p>
                            {!searchQuery && !statusFilter && !categoryFilter && (
                                <button
                                    onClick={handleCreateNew}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-lg hover:bg-pink-500/20 transition-colors"
                                >
                                    <Plus size={18} />
                                    Create Template
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700/50">
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Template
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Version
                                    </th>
                                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Usage
                                    </th>
                                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/30">
                                {templates.map((template) => (
                                    <tr key={template.id} className="hover:bg-slate-700/20 transition-colors">
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
                                                    <div className="font-medium text-white">{template.name}</div>
                                                    <div className="text-sm text-slate-400 font-mono">
                                                        {template.templateKey}
                                                    </div>
                                                    {template.description && (
                                                        <div className="text-xs text-slate-500 mt-1 line-clamp-1">
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
                                                <span className="text-slate-500 text-sm">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(template.status)}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-300">v{template.version}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-300">{template.usageCount || 0}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Quick actions */}
                                                <button
                                                    onClick={() => handleEdit(template)}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit size={16} />
                                                </button>

                                                {/* More actions menu */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() =>
                                                            setActionMenuOpen(
                                                                actionMenuOpen === template.id ? null : template.id,
                                                            )
                                                        }
                                                        aria-label="More actions"
                                                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>

                                                    {actionMenuOpen === template.id && (
                                                        <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 py-1">
                                                            <button
                                                                onClick={() => handleEdit(template)}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white"
                                                            >
                                                                <Edit size={14} />
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleClone(template.id)}
                                                                disabled={actionLoading === template.id}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white disabled:opacity-50"
                                                            >
                                                                <Copy size={14} />
                                                                Clone
                                                            </button>
                                                            <a
                                                                href={`/api/content/emails/templates/${template.id}/preview`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white"
                                                            >
                                                                <Eye size={14} />
                                                                Preview
                                                            </a>
                                                            <div className="border-t border-slate-700 my-1" />
                                                            {template.status === 'DRAFT' && (
                                                                <button
                                                                    onClick={() => handlePublish(template.id)}
                                                                    disabled={actionLoading === template.id}
                                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                                                                >
                                                                    <CheckCircle2 size={14} />
                                                                    Publish
                                                                </button>
                                                            )}
                                                            {template.status === 'PUBLISHED' && (
                                                                <button
                                                                    onClick={() => handleDeprecate(template.id)}
                                                                    disabled={actionLoading === template.id}
                                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                                                                >
                                                                    <Archive size={14} />
                                                                    Deprecate
                                                                </button>
                                                            )}
                                                            <div className="border-t border-slate-700 my-1" />
                                                            <button
                                                                onClick={() => handleDelete(template.id)}
                                                                disabled={actionLoading === template.id}
                                                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                                            >
                                                                <Trash2 size={14} />
                                                                Delete
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
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <div className="text-2xl font-bold text-white">{templates.length}</div>
                        <div className="text-sm text-slate-400">Total Templates</div>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <div className="text-2xl font-bold text-emerald-400">
                            {templates.filter((t) => t.status === 'PUBLISHED').length}
                        </div>
                        <div className="text-sm text-slate-400">Published</div>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <div className="text-2xl font-bold text-amber-400">
                            {templates.filter((t) => t.status === 'DRAFT').length}
                        </div>
                        <div className="text-sm text-slate-400">Drafts</div>
                    </div>
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                        <div className="text-2xl font-bold text-slate-400">
                            {templates.reduce((sum, t) => sum + (t.usageCount || 0), 0)}
                        </div>
                        <div className="text-sm text-slate-400">Total Sends</div>
                    </div>
                </div>
            </div>

            {/* Click away handler for menus */}
            {actionMenuOpen && <div className="fixed inset-0 z-0" onClick={() => setActionMenuOpen(null)} />}
        </div>
    );
};

export default EmailTemplatesView;
