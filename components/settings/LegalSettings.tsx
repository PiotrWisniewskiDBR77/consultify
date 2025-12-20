import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Check, X, Eye, Clock, Shield } from 'lucide-react';
import { User, LegalDocument, LegalDocType } from '../../types';

interface LegalSettingsProps {
    currentUser: User;
}

interface AcceptanceInfo {
    docType: LegalDocType;
    version: string;
    acceptedAt: string;
}

const DOC_TYPE_INFO: Record<LegalDocType, { icon: React.ReactNode; color: string }> = {
    TOS: { icon: <FileText size={18} />, color: 'text-blue-500' },
    PRIVACY: { icon: <Shield size={18} />, color: 'text-green-500' },
    COOKIES: { icon: <FileText size={18} />, color: 'text-amber-500' },
    AUP: { icon: <FileText size={18} />, color: 'text-purple-500' },
    AI_POLICY: { icon: <FileText size={18} />, color: 'text-indigo-500' },
    DPA: { icon: <Shield size={18} />, color: 'text-red-500' }
};

export const LegalSettings: React.FC<LegalSettingsProps> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [documents, setDocuments] = useState<LegalDocument[]>([]);
    const [acceptances, setAcceptances] = useState<AcceptanceInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
    const [docContent, setDocContent] = useState<string>('');
    const [loadingContent, setLoadingContent] = useState(false);

    useEffect(() => {
        fetchLegalData();
    }, []);

    const fetchLegalData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [docsRes, acceptRes] = await Promise.all([
                fetch('/api/legal/active', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('/api/legal/my-acceptances', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (docsRes.ok && acceptRes.ok) {
                const docs = await docsRes.json();
                const accepts = await acceptRes.json();
                setDocuments(docs);
                setAcceptances(accepts.map((a: any) => ({
                    docType: a.doc_type,
                    version: a.version,
                    acceptedAt: a.accepted_at
                })));
            }
        } catch (err) {
            console.error('Failed to fetch legal data:', err);
        } finally {
            setLoading(false);
        }
    };

    const viewDocument = async (doc: LegalDocument) => {
        setSelectedDoc(doc);
        setLoadingContent(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/legal/active/${doc.docType}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const fullDoc = await res.json();
                setDocContent(fullDoc.content_md || '');
            }
        } catch (err) {
            console.error('Failed to fetch document content:', err);
        } finally {
            setLoadingContent(false);
        }
    };

    const getAcceptanceStatus = (docType: LegalDocType, version: string) => {
        const acceptance = acceptances.find(a => a.docType === docType && a.version === version);
        return acceptance;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                {t('settings.menu.legal', 'Legal Documents')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {t('legal.settings.description', 'View and manage your legal document acceptances.')}
            </p>

            <div className="space-y-3">
                {documents.map(doc => {
                    const acceptance = getAcceptanceStatus(doc.docType as LegalDocType, doc.version);
                    const info = DOC_TYPE_INFO[doc.docType as LegalDocType] || DOC_TYPE_INFO.TOS;

                    return (
                        <div
                            key={doc.id}
                            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`${info.color}`}>
                                    {info.icon}
                                </div>
                                <div>
                                    <h3 className="font-medium text-slate-900 dark:text-white">
                                        {doc.title}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Version {doc.version} • Effective {formatDate(doc.effectiveFrom)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {acceptance ? (
                                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                        <Check size={16} />
                                        <span className="text-sm">
                                            {t('legal.status.accepted', 'Accepted')} {formatDate(acceptance.acceptedAt)}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                        <Clock size={16} />
                                        <span className="text-sm">{t('legal.status.pending', 'Pending')}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => viewDocument(doc)}
                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                    title={t('legal.view', 'View Document')}
                                >
                                    <Eye size={18} className="text-slate-500" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {documents.length === 0 && (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        {t('legal.noDocuments', 'No legal documents available.')}
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
                                    Version {selectedDoc.version}
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
                            {loadingContent ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                </div>
                            ) : (
                                <div className="prose dark:prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap text-sm font-sans">
                                        {docContent}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
