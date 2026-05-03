import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderUp,
  Loader2,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAIContext } from '../../contexts/AIContext';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { Document } from '../../types';

interface DocumentSidePanelProps {
  projectId?: string;
}

export const DocumentSidePanel: React.FC<DocumentSidePanelProps> = ({ projectId }) => {
  const { t } = useTranslation();
  const { activeSidePanel, closeSidePanel } = useAppStore();
  const isOpen = activeSidePanel === 'DOCUMENTS';

  // Internal state
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
        projectId: activeTab === 'project' ? projectId : undefined,
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
    if (!confirm(t('documents.confirmDelete', 'Are you sure you want to delete this document?')))
      return;
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
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type))
      return <FileImage size={16} className="text-pink-500" />;
    if (['xls', 'xlsx', 'csv'].includes(type))
      return <FileSpreadsheet size={16} className="text-green-500" />;
    if (['pdf'].includes(type)) return <FileText size={16} className="text-red-500" />;
    return <File size={16} className="text-slate-400 dark:text-slate-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status?: string) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'ready' || normalized === 'active') {
      return {
        label: t('documents.ready', 'Ready'),
        className: 'bg-emerald-500/10 text-emerald-500',
      };
    }
    if (normalized === 'processing' || normalized === 'uploaded') {
      return {
        label: t('documents.processing', 'Processing'),
        className: 'bg-amber-500/10 text-amber-500',
      };
    }
    if (normalized === 'ocr_required') {
      return {
        label: t('documents.ocrRequired', 'OCR required'),
        className: 'bg-orange-500/10 text-orange-500',
      };
    }
    if (normalized === 'unreadable' || normalized === 'failed') {
      return {
        label: t('documents.unreadable', 'Unreadable'),
        className: 'bg-rose-500/10 text-rose-500',
      };
    }
    return { label: normalized || 'unknown', className: 'bg-slate-500/10 text-slate-500' };
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
        onClick={closeSidePanel}
      />

      <div className="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] bg-white dark:bg-navy-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-navy-700">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-navy-700 shrink-0 bg-slate-50 dark:bg-navy-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <FolderOpen size={18} className="text-cyan-500" />
            </div>
            {t('documents.library')}
          </h2>
          <button
            onClick={closeSidePanel}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-navy-700 px-2 shrink-0">
          <button
            onClick={() => setActiveTab('project')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
              activeTab === 'project'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FolderOpen size={14} />
            {t('documents.projectDocs')}
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
              activeTab === 'user'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <User size={14} />
            {t('documents.myDocs')}
          </button>
        </div>

        {/* Upload Button */}
        <div className="p-3 border-b border-slate-200 dark:border-navy-700 shrink-0">
          <label className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-br from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md disabled:opacity-50">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? t('documents.uploading') : t('documents.upload')}
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
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                <FileText size={28} className="text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                {activeTab === 'project' ? t('documents.noProjectDocs') : t('documents.noUserDocs')}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t('documents.uploadHint', 'Upload your first document to get started')}
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {currentDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="group p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-white/10 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-2 mb-2">
                    {getFileIcon(doc.fileType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {doc.originalName || doc.filename}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatFileSize(doc.fileSize)} •{' '}
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getStatusBadge(doc.status).className}`}
                        >
                          {getStatusBadge(doc.status).label}
                        </span>
                        {doc.chunkCount !== undefined && doc.chunkCount > 0 && (
                          <span className="text-[10px] text-slate-400">
                            {doc.chunkCount} chunks
                          </span>
                        )}
                      </div>
                      {doc.processingError && (
                        <p className="mt-1 text-[10px] text-rose-500">{doc.processingError}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
                      title={t('documents.download')}
                    >
                      <Download size={12} />
                      Download
                    </button>
                    {activeTab === 'user' && projectId && (
                      <button
                        onClick={() => handleMoveToProject(doc.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title={t('documents.moveToProject')}
                      >
                        <FolderUp size={12} />
                        Move
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t('documents.delete')}
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
        <div className="px-4 py-3 border-t border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 shrink-0">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
            {activeTab === 'project' ? t('documents.projectHint') : t('documents.userHint')}
          </p>
        </div>
      </div>
    </>
  );
};

export default DocumentSidePanel;
