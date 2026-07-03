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
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAIContext } from '../../contexts/AIContext';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView, Document } from '../../types';

interface DocumentSidePanelProps {
  projectId?: string;
}

export const DocumentSidePanel: React.FC<DocumentSidePanelProps> = ({ projectId }) => {
  const { t } = useTranslation();
  const { activeSidePanel, closeSidePanel, currentUser, setCurrentView } = useAppStore();
  const isOpen = activeSidePanel === 'DOCUMENTS';
  const currentUserRole = String(
    (currentUser as any)?.role || (currentUser as any)?.userRole || ''
  );
  const canOpenAdminOperations = ['admin', 'owner', 'superadmin', 'super_admin'].includes(
    currentUserRole.toLowerCase()
  );

  // Internal state
  const [activeTab, setActiveTab] = useState<'project' | 'user'>('project');
  const [projectDocs, setProjectDocs] = useState<Document[]>([]);
  const [userDocs, setUserDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [acknowledgingDocId, setAcknowledgingDocId] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recent']));

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'project' && projectId) {
        const docs = await Api.getProjectDocuments(projectId);
        setProjectDocs(docs);
      } else if (activeTab === 'user') {
        const docs = await Api.getUserDocuments();
        setUserDocs(docs);
      }
      setLastRefreshedAt(new Date().toISOString());
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, projectId]);

  // Load documents
  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, loadDocuments]);

  const hasProcessingDocuments = [...projectDocs, ...userDocs].some(
    (doc) => doc.status === 'processing'
  );

  useEffect(() => {
    if (!isOpen || !hasProcessingDocuments) return undefined;
    const interval = window.setInterval(() => {
      void loadDocuments();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isOpen, hasProcessingDocuments, loadDocuments]);

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

  const handleAcknowledgeProcessingAttention = async (docId: string) => {
    setAcknowledgingDocId(docId);
    try {
      await Api.acknowledgeDocumentProcessingAttention(docId);
      await loadDocuments();
    } catch (error) {
      console.error('Processing attention acknowledgement error:', error);
    } finally {
      setAcknowledgingDocId(null);
    }
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type))
      return <FileImage size={16} className="text-pink-500" />;
    if (['xls', 'xlsx', 'csv'].includes(type))
      return <FileSpreadsheet size={16} className="text-green-500" />;
    if (['pdf'].includes(type)) return <FileText size={16} className="text-danger-500" />;
    return <File size={16} className="text-slate-600 dark:text-slate-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes < 0) return t('documents.unknownSize', 'Unknown size');
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocumentFileType = (doc: Document) => {
    const explicitType = String(doc.fileType || '').toLowerCase();
    if (explicitType) return explicitType;
    const name = doc.originalName || doc.filename || '';
    const extension = name.includes('.') ? name.split('.').pop() : '';
    return String(extension || '').toLowerCase();
  };

  const getDocumentFileSize = (doc: Document) => {
    return Number((doc as any).fileSize ?? (doc as any).fileSizeBytes ?? 0);
  };

  const getOwnerDisplayName = (doc: Document) => {
    const name = String(doc.ownerName || '').trim();
    if (name) return name;
    const ownerId = String(doc.ownerId || '').trim();
    if (ownerId) return ownerId.length > 8 ? `${ownerId.slice(0, 8)}…` : ownerId;
    return '—';
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
        className: 'bg-amber-500/10 text-amber-500',
      };
    }
    if (normalized === 'unreadable' || normalized === 'failed') {
      return {
        label: t('documents.unreadable', 'Unreadable'),
        className: 'bg-danger-500/10 text-danger-500',
      };
    }
    return { label: normalized || 'unknown', className: 'bg-slate-500/10 text-slate-500' };
  };

  const getProcessingHint = (doc: Document) => {
    const state = doc.processingState;
    if (!state || state.status === 'not_processing') return null;
    if (state.status === 'queued') {
      return t('documents.processingQueued', 'Queued for organization context processing.');
    }
    if (state.status === 'claimed' || state.status === 'processing') {
      return t('documents.processingActive', 'Worker is processing this document.');
    }
    if (state.status === 'retry_scheduled') {
      return t('documents.processingRetry', 'Processing will retry automatically.');
    }
    if (state.status === 'stale_processing') {
      return t(
        'documents.processingStale',
        'Processing is taking longer than expected. An admin may need to check the worker.'
      );
    }
    return t(
      'documents.processingAttention',
      'Processing status needs attention because no active job was found.'
    );
  };

  const formatSafeDateTime = (value?: string | null) => {
    if (!value) return t('documents.unknownDate', 'Unknown date');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('documents.unknownDate', 'Unknown date');
    return date.toLocaleString();
  };

  const handleOpenAdminOperations = () => {
    closeSidePanel();
    setCurrentView(AppView.ADMIN_BULK_OPERATIONS);
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
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-dropdown transition-opacity"
        onClick={closeSidePanel}
      />

      <div className="fixed right-0 top-0 h-full w-[380px] max-w-[90vw] bg-white dark:bg-navy-950 shadow-2xl z-overlay flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-navy-700">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-navy-700 shrink-0 bg-slate-50 dark:bg-navy-900">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <FolderOpen size={18} className="text-blue-500" />
            </div>
            {t('documents.library')}
          </h2>
          <button
            onClick={closeSidePanel}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-danger-500 dark:text-slate-400 dark:hover:text-danger-400 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
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
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <User size={14} />
            {t('documents.myDocs')}
          </button>
        </div>

        {/* Upload Button */}
        <div className="p-3 border-b border-slate-200 dark:border-navy-700 shrink-0">
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md disabled:opacity-50">
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
            <button
              type="button"
              onClick={() => void loadDocuments()}
              disabled={loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:border-navy-700 dark:text-slate-400 dark:hover:bg-navy-800"
              title={t('documents.refreshStatus', 'Refresh document status')}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          {hasProcessingDocuments && (
            <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-400">
              {t(
                'documents.processingRefreshLoop',
                'Processing documents refresh every 15 seconds while this panel is open.'
              )}
            </p>
          )}
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary-500" />
            </div>
          ) : currentDocs.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                <FileText size={28} className="text-slate-600 dark:text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                {activeTab === 'project' ? t('documents.noProjectDocs') : t('documents.noUserDocs')}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-500">
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
                    {getFileIcon(getDocumentFileType(doc))}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {doc.originalName || doc.filename}
                      </p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-500">
                        {formatFileSize(getDocumentFileSize(doc))} •{' '}
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-500">
                        {t('documents.owner', 'Owner')}: {getOwnerDisplayName(doc)}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getStatusBadge(doc.status).className}`}
                        >
                          {getStatusBadge(doc.status).label}
                        </span>
                        {doc.chunkCount !== undefined && doc.chunkCount > 0 && (
                          <span className="text-[10px] text-slate-600">
                            {t('documents.chunks', '{{count}} chunks', { count: doc.chunkCount })}
                          </span>
                        )}
                      </div>
                      {doc.processingError && (
                        <p className="mt-1 text-[10px] text-danger-500">{doc.processingError}</p>
                      )}
                      {getProcessingHint(doc) && (
                        <p
                          className={`mt-1 text-[10px] ${
                            doc.processingState?.attentionRequired
                              ? 'text-danger-500'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {getProcessingHint(doc)}
                        </p>
                      )}
                      {doc.processingState?.attentionRequired && (
                        <div className="mt-2 rounded-lg border border-danger-200 bg-danger-50/80 p-2 text-[10px] text-danger-700 dark:border-danger-500/30 dark:bg-danger-900/20 dark:text-danger-300">
                          <div className="flex items-start gap-1.5">
                            <ShieldAlert size={12} className="mt-0.5 shrink-0" />
                            <div className="space-y-1">
                              <p className="font-medium">
                                {t(
                                  'documents.processingRecoveryTitle',
                                  'Processing needs admin review'
                                )}
                              </p>
                              <p>
                                {canOpenAdminOperations
                                  ? t(
                                      'documents.processingAdminRecoveryHint',
                                      'Open Admin Operations to review worker jobs, stale locks, and safe recovery actions.'
                                    )
                                  : t(
                                      'documents.processingUserRecoveryHint',
                                      'Ask an organization admin to review worker jobs in Admin Operations.'
                                    )}
                              </p>
                              {doc.processingState?.attentionReadBack?.status ===
                                'visible_to_user' && (
                                <p className="text-danger-600/80 dark:text-danger-200/80">
                                  {t(
                                    'documents.processingAttentionReadBack',
                                    'Attention visible since {{time}}.',
                                    {
                                      time: formatSafeDateTime(
                                        doc.processingState.attentionReadBack.observedAt
                                      ),
                                    }
                                  )}
                                </p>
                              )}
                              {doc.processingState?.recoveryAuditReadBack?.status === 'found' ? (
                                <p className="text-emerald-700 dark:text-emerald-300">
                                  {t(
                                    'documents.processingRecoveryAuditFound',
                                    'Recovery audit found: {{action}} at {{time}}.',
                                    {
                                      action:
                                        doc.processingState.recoveryAuditReadBack.actionType ||
                                        'organization_context.recovery_event',
                                      time: formatSafeDateTime(
                                        doc.processingState.recoveryAuditReadBack.recordedAt
                                      ),
                                    }
                                  )}
                                </p>
                              ) : (
                                <p className="text-danger-600/80 dark:text-danger-200/80">
                                  {t(
                                    'documents.processingRecoveryAuditMissing',
                                    'No audited recovery action found yet.'
                                  )}
                                </p>
                              )}
                              {doc.processingState?.acknowledgement?.status === 'acknowledged' ? (
                                <p className="text-emerald-700 dark:text-emerald-300">
                                  {t(
                                    'documents.processingAttentionAcknowledged',
                                    'Acknowledged by you at {{time}}.',
                                    {
                                      time: formatSafeDateTime(
                                        doc.processingState.acknowledgement.acknowledgedAt
                                      ),
                                    }
                                  )}
                                </p>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleAcknowledgeProcessingAttention(doc.id)}
                                  disabled={acknowledgingDocId === doc.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-danger-200 bg-white px-2 py-1 font-semibold text-danger-700 hover:bg-danger-50 disabled:opacity-60 dark:border-danger-500/30 dark:bg-danger-900/30 dark:text-danger-200 dark:hover:bg-danger-900/50"
                                >
                                  {acknowledgingDocId === doc.id && (
                                    <Loader2 size={10} className="animate-spin" />
                                  )}
                                  {t(
                                    'documents.acknowledgeProcessingAttention',
                                    'Acknowledge attention'
                                  )}
                                </button>
                              )}
                              {canOpenAdminOperations && (
                                <button
                                  type="button"
                                  onClick={handleOpenAdminOperations}
                                  className="inline-flex items-center gap-1 rounded-md border border-danger-200 bg-white px-2 py-1 font-semibold text-danger-700 hover:bg-danger-50 dark:border-danger-500/30 dark:bg-danger-900/30 dark:text-danger-200 dark:hover:bg-danger-900/50"
                                >
                                  {t('documents.openAdminOperations', 'Open Admin Operations')}
                                  <ArrowRight size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title={t('documents.download')}
                    >
                      <Download size={12} />
                      {t('documents.download', 'Download')}
                    </button>
                    {activeTab === 'user' && projectId && (
                      <button
                        onClick={() => handleMoveToProject(doc.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title={t('documents.moveToProject')}
                      >
                        <FolderUp size={12} />
                        {t('documents.moveToProject', 'Move')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-danger-500 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
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
        <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 shrink-0">
          <p className="text-[10px] text-slate-600 dark:text-slate-500 text-center">
            {lastRefreshedAt
              ? t('documents.lastStatusRefresh', 'Last status refresh: {{time}}', {
                  time: new Date(lastRefreshedAt).toLocaleTimeString(),
                })
              : activeTab === 'project'
                ? t('documents.projectHint')
                : t('documents.userHint')}
          </p>
        </div>
      </div>
    </>
  );
};

export default DocumentSidePanel;
