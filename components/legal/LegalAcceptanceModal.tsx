import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Shield, Loader2 } from 'lucide-react';
import { LegalDocument, LegalDocType } from '../../types';

interface LegalAcceptanceModalProps {
    onAccepted: () => void;
    userId: string;
    userRole: string;
}

const DOC_TYPE_LABELS: Record<LegalDocType, string> = {
    TOS: 'Terms of Service',
    PRIVACY: 'Privacy Policy',
    COOKIES: 'Cookie Policy',
    AUP: 'Acceptable Use Policy',
    AI_POLICY: 'AI Usage Policy',
    DPA: 'Data Processing Addendum'
};

export const LegalAcceptanceModal: React.FC<LegalAcceptanceModalProps> = ({ onAccepted, userId, userRole }) => {
    const { t } = useTranslation();
    const [pendingDocs, setPendingDocs] = useState<LegalDocument[]>([]);
    const [dpaPending, setDpaPending] = useState(false);
    const [dpaDoc, setDpaDoc] = useState<LegalDocument | null>(null);
    const [isOrgAdmin, setIsOrgAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
    const [docContents, setDocContents] = useState<Record<string, string>>({});
    const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPendingDocs();
    }, []);

    const fetchPendingDocs = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/legal/pending', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setPendingDocs(data.required || []);
                setDpaPending(data.dpaPending);
                setDpaDoc(data.dpaDoc);
                setIsOrgAdmin(data.isOrgAdmin);
            }
        } catch (err) {
            console.error('Failed to fetch pending docs:', err);
            setError('Failed to load legal documents');
        } finally {
            setLoading(false);
        }
    };

    const fetchDocContent = async (docType: string) => {
        if (docContents[docType]) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/legal/active/${docType}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const doc = await res.json();
                setDocContents(prev => ({ ...prev, [docType]: doc.content_md || '' }));
            }
        } catch (err) {
            console.error('Failed to fetch document content:', err);
        }
    };

    const toggleExpand = (docType: string) => {
        if (expandedDoc === docType) {
            setExpandedDoc(null);
        } else {
            setExpandedDoc(docType);
            fetchDocContent(docType);
        }
    };

    const toggleCheck = (docType: string) => {
        setCheckedDocs(prev => {
            const next = new Set(prev);
            if (next.has(docType)) {
                next.delete(docType);
            } else {
                next.add(docType);
            }
            return next;
        });
    };

    const allChecked = () => {
        const requiredTypes = pendingDocs.map(d => d.docType);
        if (dpaPending && isOrgAdmin && dpaDoc) {
            requiredTypes.push(dpaDoc.docType);
        }
        return requiredTypes.every(t => checkedDocs.has(t));
    };

    const handleAccept = async () => {
        setAccepting(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const docTypes = pendingDocs.map(d => d.docType);

            // Accept user-level docs
            if (docTypes.length > 0) {
                const userRes = await fetch('/api/legal/accept', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ docTypes, scope: 'USER' })
                });

                if (!userRes.ok) {
                    throw new Error('Failed to accept documents');
                }
            }

            // Accept DPA if org admin
            if (dpaPending && isOrgAdmin && dpaDoc) {
                const dpaRes = await fetch('/api/legal/accept', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ docTypes: ['DPA'], scope: 'ORG_ADMIN' })
                });

                if (!dpaRes.ok) {
                    throw new Error('Failed to accept DPA');
                }
            }

            onAccepted();
        } catch (err: any) {
            setError(err.message || 'Failed to accept documents');
        } finally {
            setAccepting(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    const allDocs = [...pendingDocs];
    if (dpaPending && isOrgAdmin && dpaDoc) {
        allDocs.push(dpaDoc as LegalDocument);
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-4">
            <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                {t('legal.modal.title', 'Legal Updates Required')}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('legal.modal.subtitle', 'Please review and accept the following documents to continue.')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Documents List */}
                <div className="flex-1 overflow-auto p-6 space-y-3">
                    {allDocs.map(doc => {
                        const docType = doc.docType as LegalDocType;
                        const isExpanded = expandedDoc === docType;
                        const isChecked = checkedDocs.has(docType);
                        const isDPA = docType === 'DPA';

                        return (
                            <div
                                key={doc.id}
                                className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                            >
                                <div
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5"
                                    onClick={() => toggleExpand(docType)}
                                >
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleCheck(docType); }}
                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isChecked
                                                ? 'bg-blue-500 border-blue-500 text-white'
                                                : 'border-slate-300 dark:border-slate-600'
                                                }`}
                                        >
                                            {isChecked && <CheckCircle size={14} />}
                                        </button>
                                        <div>
                                            <span className="font-medium text-slate-900 dark:text-white">
                                                {DOC_TYPE_LABELS[docType] || doc.title}
                                            </span>
                                            {isDPA && (
                                                <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                                                    {t('legal.orgAdmin', 'Organization Agreement')}
                                                </span>
                                            )}
                                            <p className="text-xs text-slate-500">
                                                Version {doc.version}
                                            </p>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>

                                {isExpanded && (
                                    <div className="p-4 bg-slate-50 dark:bg-navy-800 border-t border-slate-200 dark:border-slate-700">
                                        {docContents[docType] ? (
                                            <div className="prose dark:prose-invert prose-sm max-w-none max-h-64 overflow-auto">
                                                <pre className="whitespace-pre-wrap text-xs font-sans">
                                                    {docContents[docType]}
                                                </pre>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="animate-spin h-5 w-5 text-slate-400" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {dpaPending && !isOrgAdmin && (
                        <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={18} />
                            <span className="text-sm">
                                {t('legal.dpaPendingOrgAdmin', 'The Data Processing Addendum requires acceptance by an organization administrator.')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-700">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    <button
                        onClick={handleAccept}
                        disabled={!allChecked() || accepting}
                        className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${allChecked() && !accepting
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {accepting ? (
                            <>
                                <Loader2 className="animate-spin h-5 w-5" />
                                {t('legal.accepting', 'Processing...')}
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                {t('legal.modal.accept', 'Accept and Continue')}
                            </>
                        )}
                    </button>
                    <p className="mt-3 text-xs text-center text-slate-500 dark:text-slate-400">
                        {t('legal.modal.disclaimer', 'By clicking Accept, you agree to be bound by these documents.')}
                    </p>
                </div>
            </div>
        </div>
    );
};
