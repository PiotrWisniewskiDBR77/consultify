import {
  ArrowRight,
  CheckSquare,
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
import { type IdempotencyState, resolveIdempotencyKey } from '../../utils/createIdempotencyKey';

interface DocumentSidePanelProps {
  projectId?: string;
}

const UPLOAD_READBACK_GRACE_MS = 60_000;
const CONFIRMED_UPLOAD_STATUSES = new Set([
  'ready',
  'active',
  'processing',
  'uploaded',
  'ocr_required',
  'unreadable',
  'failed',
  'partial_ready',
  'policy_blocked',
]);

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
  const [activeTab, setActiveTab] = useState<'project' | 'user'>(projectId ? 'project' : 'user');
  const [projectDocs, setProjectDocs] = useState<Document[]>([]);
  const [userDocs, setUserDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pendingUploadIdsRef = React.useRef<Map<string, number>>(new Map());
  /**
   * ★ P-P05 (pilotaż Pawła 14.09: „Document upload finishes silently but the
   * file never appears"). Wynik wysyłki szedł WYŁĄCZNIE do `console.error` —
   * człowiek nie dostawał ani potwierdzenia, ani powodu odmowy. Serwer
   * odrzuca m.in. wysyłkę do zakładki „Dokumenty projektu" bez projektu
   * (`DOCUMENTS_PROJECT_ID_REQUIRED`, 400) i przekroczony limit miejsca (429)
   * — obie odpowiedzi ginęły w ciszy.
   */
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [acknowledgingDocId, setAcknowledgingDocId] = useState<string | null>(null);
  const [creatingTaskDocId, setCreatingTaskDocId] = useState<string | null>(null);
  const [createdTaskByDocId, setCreatedTaskByDocId] = useState<Record<string, string>>({});
  const [taskErrorByDocId, setTaskErrorByDocId] = useState<Record<string, string>>({});
  const taskIdempotencyByDocId = React.useRef<Record<string, IdempotencyState | null>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['recent']));

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'project' && projectId) {
        const docs = await Api.getProjectDocuments(projectId);
        setProjectDocs((current) => {
          const serverIds = new Set(docs.map((doc) => String(doc.id)));
          const pending = current.filter(
            (doc) =>
              (pendingUploadIdsRef.current.get(String(doc.id)) || 0) > Date.now() &&
              !serverIds.has(String(doc.id))
          );
          for (const [id, expiresAt] of pendingUploadIdsRef.current) {
            if (expiresAt <= Date.now()) pendingUploadIdsRef.current.delete(id);
          }
          return [...pending, ...docs];
        });
      } else if (activeTab === 'user') {
        const docs = await Api.getUserDocuments();
        setUserDocs((current) => {
          const serverIds = new Set(docs.map((doc) => String(doc.id)));
          const pending = current.filter(
            (doc) =>
              (pendingUploadIdsRef.current.get(String(doc.id)) || 0) > Date.now() &&
              !serverIds.has(String(doc.id))
          );
          for (const [id, expiresAt] of pendingUploadIdsRef.current) {
            if (expiresAt <= Date.now()) pendingUploadIdsRef.current.delete(id);
          }
          return [...pending, ...docs];
        });
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

    setUploadError(null);
    setUploadSuccess(null);

    // Serwer odmówi (400 DOCUMENTS_PROJECT_ID_REQUIRED) — powiedz to od razu i
    // wskaż wyjście, zamiast wysyłać plik w próżnię.
    if (activeTab === 'project' && !projectId) {
      setUploadError(
        t(
          'documents.uploadNeedsProject',
          'This view has no project selected, so the file cannot be added to project documents. Upload it under “My documents”, or open the panel from a project.'
        )
      );
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const result = await Api.uploadDocumentToLibrary(file, {
        scope: activeTab,
        projectId: activeTab === 'project' ? projectId : undefined,
      });
      const candidate = (result as any)?.document;
      const confirmedId = typeof candidate?.id === 'string' ? candidate.id.trim() : '';
      const confirmedOriginalName =
        typeof candidate?.originalName === 'string' ? candidate.originalName.trim() : '';
      const confirmedFilename =
        typeof candidate?.filename === 'string' ? candidate.filename.trim() : '';
      const confirmedName = confirmedOriginalName || confirmedFilename;
      const confirmedStatus =
        typeof candidate?.status === 'string' ? candidate.status.trim().toLowerCase() : '';
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        !confirmedId ||
        !confirmedName ||
        !CONFIRMED_UPLOAD_STATUSES.has(confirmedStatus)
      ) {
        throw new Error(
          t(
            'documents.uploadNotConfirmed',
            'The server did not confirm the uploaded document. Try again.'
          )
        );
      }
      const uploadedDocument = {
        ...candidate,
        id: confirmedId,
        originalName: confirmedOriginalName || confirmedFilename,
        filename: confirmedFilename || confirmedOriginalName,
        status: confirmedStatus,
      } as Document;
      pendingUploadIdsRef.current.set(confirmedId, Date.now() + UPLOAD_READBACK_GRACE_MS);
      const upsertUploaded = (documents: Document[]) => {
        const withoutUploaded = documents.filter(
          (doc) => String(doc.id) !== String(uploadedDocument.id)
        );
        return [uploadedDocument, ...withoutUploaded];
      };
      const reconcileUpload = (readback: Document[], current: Document[]) => {
        const confirmedByReadback = readback.some(
          (doc) => String(doc.id) === String(uploadedDocument.id)
        );
        return confirmedByReadback ? readback : upsertUploaded(current);
      };
      // Prefer the richer GET record when it already exists. A stale/empty GET
      // keeps the confirmed POST record for the bounded readback grace window.
      try {
        if (activeTab === 'project' && projectId) {
          const readback = await Api.getProjectDocuments(projectId);
          setProjectDocs((current) => reconcileUpload(readback, current));
        } else {
          const readback = await Api.getUserDocuments();
          setUserDocs((current) => reconcileUpload(readback, current));
        }
        setLastRefreshedAt(new Date().toISOString());
      } catch (readbackError) {
        console.error('Error reconciling uploaded document:', readbackError);
        if (activeTab === 'project') {
          setProjectDocs(upsertUploaded);
        } else {
          setUserDocs(upsertUploaded);
        }
      }
      const normalizedStatus = String(uploadedDocument.status || '').toLowerCase();
      const statusLabel =
        normalizedStatus === 'ready' || normalizedStatus === 'active'
          ? t('documents.ready', 'Ready')
          : normalizedStatus === 'ocr_required'
            ? t('documents.ocrRequired', 'OCR required')
            : normalizedStatus === 'unreadable' || normalizedStatus === 'failed'
              ? t('documents.unreadable', 'Unreadable')
              : normalizedStatus === 'partial_ready'
                ? t('documents.partialReady', 'Partially ready')
                : normalizedStatus === 'policy_blocked'
                  ? t('documents.policyBlocked', 'Blocked by policy')
                  : normalizedStatus === 'processing' || normalizedStatus === 'uploaded'
                    ? t('documents.processing', 'Processing')
                    : normalizedStatus;
      setUploadSuccess(
        t('documents.uploadAccepted', '“{{name}}” was uploaded. Status: {{status}}.', {
          name: uploadedDocument.originalName || uploadedDocument.filename || file.name,
          status: statusLabel,
        })
      );
    } catch (error) {
      console.error('Upload error:', error);
      const reason = error instanceof Error && error.message ? error.message : null;
      setUploadError(
        reason
          ? t('documents.uploadFailedWithReason', 'Upload of “{{name}}” failed: {{reason}}', {
              name: file.name,
              reason,
            })
          : t('documents.uploadFailed', 'Upload of “{{name}}” failed. The file was not saved.', {
              name: file.name,
            })
      );
    } finally {
      setUploading(false);
      // Bez tego ponowny wybór TEGO SAMEGO pliku nie odpala `onChange`, więc
      // po nieudanej próbie nie dałoby się spróbować jeszcze raz.
      event.target.value = '';
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

  const handleCreateTask = async (doc: Document) => {
    if (creatingTaskDocId) return;
    const title = t('documents.reviewTaskTitle', 'Review document: {{name}}', {
      name: doc.originalName || doc.filename,
    });
    const payload = {
      title,
      description: t(
        'documents.reviewTaskDescription',
        'Review the source document and record the required follow-up.'
      ),
      tags: ['from-document'],
      sourceType: 'document',
      sourceId: doc.id,
    };
    const idempotency = resolveIdempotencyKey(
      taskIdempotencyByDocId.current[doc.id] || null,
      payload
    );
    taskIdempotencyByDocId.current[doc.id] = idempotency;
    setCreatingTaskDocId(doc.id);
    setTaskErrorByDocId((current) => ({ ...current, [doc.id]: '' }));
    try {
      const created = await Api.createPersonalTask({ ...payload, idempotencyKey: idempotency.key });
      const taskId = String(created?.id || '').trim();
      if (!taskId) throw new Error('Task response did not include an id');
      setCreatedTaskByDocId((current) => ({ ...current, [doc.id]: taskId }));
      taskIdempotencyByDocId.current[doc.id] = null;
    } catch (error) {
      console.error('Document task creation error:', error);
      setTaskErrorByDocId((current) => ({
        ...current,
        [doc.id]:
          error instanceof Error && error.message
            ? error.message
            : t('documents.taskCreateFailed', 'The task could not be created.'),
      }));
    } finally {
      setCreatingTaskDocId(null);
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
    if (normalized === 'partial_ready') {
      return {
        label: t('documents.partialReady', 'Partially ready'),
        className: 'bg-amber-500/10 text-amber-500',
      };
    }
    if (normalized === 'policy_blocked') {
      return {
        label: t('documents.policyBlocked', 'Blocked by policy'),
        className: 'bg-danger-500/10 text-danger-500',
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
            type="button"
            onClick={() => setActiveTab('project')}
            disabled={!projectId}
            aria-describedby={!projectId ? 'documents-project-tab-hint' : undefined}
            title={
              projectId
                ? undefined
                : t(
                    'documents.projectTabNeedsProject',
                    'Open Documents from a project to add project documents.'
                  )
            }
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
              activeTab === 'project'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            } disabled:cursor-not-allowed disabled:opacity-50`}
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
        {!projectId && (
          <p
            id="documents-project-tab-hint"
            className="border-b border-slate-200 px-3 py-1.5 text-[10px] text-slate-600 dark:border-navy-700 dark:text-slate-400"
          >
            {t(
              'documents.projectTabNeedsProject',
              'Open Documents from a project to add project documents.'
            )}
          </p>
        )}

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
          {uploadError && (
            <p
              role="alert"
              data-testid="document-upload-error"
              className="mt-2 rounded-lg border border-c-danger/40 bg-c-danger/10 px-2 py-1.5 text-[11px] text-c-danger"
            >
              {uploadError}
            </p>
          )}
          {uploadSuccess && (
            <p
              role="status"
              data-testid="document-upload-success"
              className="mt-2 rounded-lg border border-c-success/40 bg-c-success/10 px-2 py-1.5 text-[11px] text-c-success"
            >
              {uploadSuccess}
            </p>
          )}
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
                      type="button"
                      onClick={() => void handleCreateTask(doc)}
                      disabled={creatingTaskDocId !== null || Boolean(createdTaskByDocId[doc.id])}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors disabled:opacity-60"
                      title={t('documents.createTask', 'Create task')}
                    >
                      {creatingTaskDocId === doc.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckSquare size={12} />
                      )}
                      {createdTaskByDocId[doc.id]
                        ? t('documents.taskCreated', 'Task created')
                        : t('documents.createTask', 'Create task')}
                    </button>
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
                  {taskErrorByDocId[doc.id] ? (
                    <p role="alert" className="mt-1 text-[10px] text-c-danger">
                      {t(
                        'documents.taskCreateFailedWithReason',
                        'Task creation failed: {{reason}}',
                        {
                          reason: taskErrorByDocId[doc.id],
                        }
                      )}
                    </p>
                  ) : null}
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
