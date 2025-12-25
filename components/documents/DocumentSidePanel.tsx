import React, { useState, useEffect } from 'react';
import {
    FileText, FolderOpen, User, ChevronRight, ChevronDown,
    Upload, Download, Trash2, ArrowRight, X, File, FileImage,
    FileSpreadsheet, Loader2, FolderUp
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Api } from '../../services/api';
import { Document } from '../../types';
import { useAIContext } from '../../contexts/AIContext';

interface DocumentSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId?: string;
}

export const DocumentSidePanel: React.FC<DocumentSidePanelProps> = ({
    isOpen,
    onClose,
    projectId
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'project' | 'user'>('project');
    const [projectDocs, setProjectDocs] = useState<Document[]>([]);
    const [userDocs, setUserDocs] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recent']));

    // Load documents
    useEffect(() => {
        if (isOpen) {
            loadDocuments();
        }
    }, [isOpen, projectId, activeTab]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            if (activeTab === 'project' && projectId) {
                const docs = await Api.getProjectDocuments(projectId);
                setProjectDocs(docs);
            } else if (activeTab === 'user') {
                const docs = await Api.getUserDocuments();
                setUserDocs(docs);
            }
        } catch (error) {
            console.error('Error loading documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            await Api.uploadDocumentToLibrary(file, {
                scope: activeTab,
                projectId: activeTab === 'project' ? projectId : undefined
            });
            await loadDocuments();
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleMoveToProject = async (docId: string) => {
        if (!projectId) return;
        try {
            await Api.moveDocumentToProject(docId, projectId);
            await loadDocuments();
            // Also reload project docs
            setActiveTab('project');
        } catch (error) {
            console.error('Move error:', error);
        }
    };

    const handleDelete = async (docId: string) => {
        if (!confirm(t('documents.confirmDelete', 'Are you sure you want to delete this document?'))) return;
        try {
            await Api.deleteDocument(docId);
            await loadDocuments();
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const handleDownload = async (doc: Document) => {
        try {
            const blob = await Api.downloadDocument(doc.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.originalName || doc.filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
        }
    };

    const getFileIcon = (fileType: string) => {
        const type = fileType?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) return <FileImage size={16} className="text-pink-500" />;
        if (['xls', 'xlsx', 'csv'].includes(type)) return <FileSpreadsheet size={16} className="text-green-500" />;
        if (['pdf'].includes(type)) return <FileText size={16} className="text-red-500" />;
        return <File size={16} className="text-slate-400" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const toggleSection = (section: string) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(section)) {
            newSet.delete(section);
        } else {
            newSet.add(section);
        }
        setExpandedSections(newSet);
    };

    const currentDocs = activeTab === 'project' ? projectDocs : userDocs;

    if (!isOpen) return null;

    return (
        <div className="fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-80 bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-white/10 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/10 shrink-0">
                <h2 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                    <FolderOpen size={18} className="text-purple-500" />
                    {t('documents.library', 'Biblioteka Dokumentów')}
                </h2>
                <button
                    onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-slate-300 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Zamknij"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 shrink-0">
                <button
                    onClick={() => setActiveTab('project')}
                    className={`flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'project'
                        ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <FolderOpen size={14} />
                    {t('documents.projectDocs', 'Projekt')}
                </button>
                <button
                    onClick={() => setActiveTab('user')}
                    className={`flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'user'
                        ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <User size={14} />
                    {t('documents.myDocs', 'Moje')}
                </button>
            </div>

            {/* Upload Button */}
            <div className="p-3 border-b border-slate-200 dark:border-white/10 shrink-0">
                <label className="flex items-center justify-center gap-2 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors">
                    {uploading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Upload size={14} />
                    )}
                    {uploading ? t('documents.uploading', 'Przesyłanie...') : t('documents.upload', 'Dodaj dokument')}
                    <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        accept=".pdf,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                    />
                </label>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-purple-500" />
                    </div>
                ) : currentDocs.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <FileText size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {activeTab === 'project'
                                ? t('documents.noProjectDocs', 'Brak dokumentów projektu')
                                : t('documents.noUserDocs', 'Brak Twoich dokumentów')
                            }
                        </p>
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {currentDocs.map((doc) => (
                            <div
                                key={doc.id}
                                className="group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-start gap-2">
                                    {getFileIcon(doc.fileType)}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-navy-900 dark:text-white truncate">
                                            {doc.originalName || doc.filename}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDownload(doc)}
                                        className="p-1.5 text-slate-400 hover:text-blue-500 rounded transition-colors"
                                        title={t('documents.download', 'Pobierz')}
                                    >
                                        <Download size={12} />
                                    </button>
                                    {activeTab === 'user' && projectId && (
                                        <button
                                            onClick={() => handleMoveToProject(doc.id)}
                                            className="p-1.5 text-slate-400 hover:text-green-500 rounded transition-colors"
                                            title={t('documents.moveToProject', 'Przenieś do projektu')}
                                        >
                                            <FolderUp size={12} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(doc.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                                        title={t('documents.delete', 'Usuń')}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer hint */}
            <div className="p-3 border-t border-slate-200 dark:border-white/10 text-center shrink-0">
                <p className="text-[10px] text-slate-400">
                    {activeTab === 'project'
                        ? t('documents.projectHint', 'Dokumenty dostępne dla wszystkich w projekcie')
                        : t('documents.userHint', 'Twoje prywatne dokumenty')
                    }
                </p>
            </div>
        </div>
    );
};

export default DocumentSidePanel;
