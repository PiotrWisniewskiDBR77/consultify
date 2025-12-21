import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Check, X, Eye, Edit, Trash2, RefreshCw, Loader2, AlertCircle, Shield } from 'lucide-react';
import { LegalDocument, LegalDocType } from '../../types';

type SuperAdminLegalViewProps = Record<string, never>;

const DOC_TYPE_OPTIONS: { value: LegalDocType; label: string }[] = [
    { value: 'TOS', label: 'Terms of Service' },
    { value: 'PRIVACY', label: 'Privacy Policy' },
    { value: 'COOKIES', label: 'Cookie Policy' },
    { value: 'AUP', label: 'Acceptable Use Policy' },
    { value: 'AI_POLICY', label: 'AI Usage Policy' },
    { value: 'DPA', label: 'Data Processing Addendum' }
];

export const SuperAdminLegalView: React.FC<SuperAdminLegalViewProps> = () => {
    const { t } = useTranslation();
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showPublishForm, setShowPublishForm] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

    // Form state
    const [formDocType, setFormDocType] = useState<LegalDocType>('TOS');
    const [formVersion, setFormVersion] = useState('');
    const [formTitle, setFormTitle] = useState('');
    const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
    const [formContent, setFormContent] = useState('');

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/superadmin/legal/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch documents');
            const data = await res.json();
            setDocuments(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        setPublishing(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/superadmin/legal/publish', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    docType: formDocType,
                    version: formVersion,
                    title: formTitle,
                    effectiveFrom: formEffectiveFrom,
                    contentMd: formContent
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to publish');
            }

            // Reset form and refresh
            setShowPublishForm(false);
            setFormDocType('TOS');
            setFormVersion('');
            setFormTitle('');
            setFormEffectiveFrom('');
            setFormContent('');
            fetchDocuments();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setPublishing(false);
        }
    };

    const toggleActive = async (docId: string, isActive: boolean) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/superadmin/legal/${docId}/toggle-active`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive })
            });
            fetchDocuments();
        } catch (err) {
            console.error('Failed to toggle:', err);
        }
    };

    const viewDocument = async (docId: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/superadmin/legal/${docId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const doc = await res.json();
                setSelectedDoc(doc);
            }
        } catch (err) {
            console.error('Failed to fetch document:', err);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Generate default version based on date
    const generateVersion = () => {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const existing = documents.filter(d => d.doc_type === formDocType && d.version.startsWith(dateStr));
        return `${dateStr}.${existing.length + 1}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                            {t('superadmin.legal.title', 'Legal Document Management')}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {t('superadmin.legal.subtitle', 'Publish and manage legal documents')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchDocuments}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        onClick={() => {
                            setFormVersion(generateVersion());
                            setFormEffectiveFrom(new Date().toISOString().split('T')[0]);
                            setShowPublishForm(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
                    >
                        <Plus size={16} />
                        {t('superadmin.legal.publish', 'Publish New Version')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Publish Form */}
            {showPublishForm && (
                <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-navy-800">
                    <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
                        {t('superadmin.legal.publishForm', 'Publish New Document Version')}
                    </h3>
                    <form onSubmit={handlePublish} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Document Type
                                </label>
                                <select
                                    value={formDocType}
                                    onChange={(e) => setFormDocType(e.target.value as LegalDocType)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-navy-900"
                                >
                                    {DOC_TYPE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Version
                                </label>
                                <input
                                    type="text"
                                    value={formVersion}
                                    onChange={(e) => setFormVersion(e.target.value)}
                                    placeholder="e.g. 2025-12-20.1"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-navy-900"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    placeholder="e.g. Terms of Service"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-navy-900"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Effective From
                                </label>
                                <input
                                    type="date"
                                    value={formEffectiveFrom}
                                    onChange={(e) => setFormEffectiveFrom(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-navy-900"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Content (Markdown)
                            </label>
                            <textarea
                                value={formContent}
                                onChange={(e) => setFormContent(e.target.value)}
                                rows={12}
                                placeholder="Enter document content in Markdown format..."
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-navy-900 font-mono text-sm"
                                required
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={publishing}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50"
                            >
                                {publishing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                {t('superadmin.legal.publishBtn', 'Publish')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPublishForm(false)}
                                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-white/5 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Documents Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-navy-800">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Version</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Effective</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {documents.map(doc => (
                            <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                <td className="px-4 py-3">
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">{doc.doc_type}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{doc.title}</td>
                                <td className="px-4 py-3">
                                    <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{doc.version}</code>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500">{formatDate(doc.effective_from)}</td>
                                <td className="px-4 py-3 text-center">
                                    {doc.is_active ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                            <Check size={12} />
                                            Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500">
                                            Inactive
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => viewDocument(doc.id)}
                                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10"
                                            title="View"
                                        >
                                            <Eye size={16} className="text-slate-500" />
                                        </button>
                                        {!doc.is_active && (
                                            <button
                                                onClick={() => toggleActive(doc.id, true)}
                                                className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30"
                                                title="Activate"
                                            >
                                                <Check size={16} className="text-green-600" />
                                            </button>
                                        )}
                                        {doc.is_active && (
                                            <button
                                                onClick={() => toggleActive(doc.id, false)}
                                                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                                                title="Deactivate"
                                            >
                                                <X size={16} className="text-red-600" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {documents.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        {t('superadmin.legal.noDocuments', 'No legal documents found. Click "Publish New Version" to add one.')}
                    </div>
                )}
            </div>

            {/* Document Viewer Modal */}
            {selectedDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-navy-900 rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {selectedDoc.title}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {selectedDoc.doc_type} • Version {selectedDoc.version}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedDoc(null)}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="prose dark:prose-invert max-w-none">
                                <pre className="whitespace-pre-wrap text-sm font-sans">
                                    {selectedDoc.content_md}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
