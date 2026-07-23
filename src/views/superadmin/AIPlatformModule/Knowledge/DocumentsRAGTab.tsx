/**
 * DocumentsRAGTab - Knowledge > Documents (RAG)
 * Wrapper for AdminKnowledgeView documents tab
 */

import {
  Building2,
  Edit2,
  FileText,
  FolderKanban,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { useAppStore } from '@/store/useAppStore';

import { LoadingState } from '../../../../components/ui/primitives';
import { Api } from '../../../../services/api';

type VaultScope = 'user' | 'project' | 'organization';

interface Document {
  id: string;
  filename: string;
  category?: string;
  tags?: string[];
  ai_visibility?: 'allowed' | 'blocked' | 'requires_approval';
  sensitivity?: 'public' | 'internal' | 'confidential';
  status: string;
  created_at: string;
  chunk_count?: number;
  scope?: VaultScope;
  project_id?: string | null;
  owner_id?: string | null;
}

interface VaultProject {
  id: string;
  name: string;
}

const DOCUMENT_CATEGORIES = ['Best Practices', 'Methodology', 'Standards', 'Templates', 'Other'];
const AI_VISIBILITY_OPTIONS: Array<NonNullable<Document['ai_visibility']>> = [
  'allowed',
  'requires_approval',
  'blocked',
];
const SENSITIVITY_OPTIONS: Array<NonNullable<Document['sensitivity']>> = [
  'public',
  'internal',
  'confidential',
];

// ★ VLT-003 — 3 poziomy zakresu dokumentu Vault (VLT-001 backend). Kolejność
// od najwęższego do najszerszego — tak samo w selektorze uploadu i w filtrze.
const SCOPE_OPTIONS: Array<{ value: VaultScope; label: string; icon: typeof User }> = [
  { value: 'user', label: 'Private (only me)', icon: User },
  { value: 'project', label: 'Project', icon: FolderKanban },
  { value: 'organization', label: 'Organization', icon: Building2 },
];

const scopeMeta = (scope?: VaultScope) =>
  SCOPE_OPTIONS.find((o) => o.value === (scope || 'organization')) || SCOPE_OPTIONS[2];

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const normalizeDocuments = (value: unknown): Document[] => {
  if (!hasListShape(value, ['documents', 'items'])) {
    throw new Error('Knowledge documents response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['documents', 'items'])
    .map((doc) => {
      const ai_visibility: Document['ai_visibility'] =
        doc.ai_visibility === 'allowed' ||
        doc.ai_visibility === 'blocked' ||
        doc.ai_visibility === 'requires_approval'
          ? doc.ai_visibility
          : 'allowed';
      const sensitivity: Document['sensitivity'] =
        doc.sensitivity === 'public' ||
        doc.sensitivity === 'internal' ||
        doc.sensitivity === 'confidential'
          ? doc.sensitivity
          : 'internal';

      const scope: Document['scope'] =
        doc.scope === 'user' || doc.scope === 'project' || doc.scope === 'organization'
          ? doc.scope
          : 'organization';

      return {
        id: asText(doc.id, ''),
        filename: asText(doc.filename, 'Untitled document'),
        category:
          doc.category === null || doc.category === undefined
            ? undefined
            : asText(doc.category, ''),
        tags: Array.isArray(doc.tags) ? doc.tags.map((tag) => asText(tag, '')).filter(Boolean) : [],
        ai_visibility,
        sensitivity,
        status: asText(doc.status, 'unknown'),
        created_at: asText(doc.created_at, ''),
        chunk_count: Number.isFinite(Number(doc.chunk_count)) ? Number(doc.chunk_count) : 0,
        scope,
        project_id:
          doc.project_id === null || doc.project_id === undefined
            ? null
            : asText(doc.project_id, ''),
        owner_id:
          doc.owner_id === null || doc.owner_id === undefined ? null : asText(doc.owner_id, ''),
      };
    })
    .filter((doc) => doc.id);
};

const normalizeProjects = (value: unknown): VaultProject[] => {
  const list = Array.isArray(value)
    ? value
    : getListPayload<Record<string, unknown>>(value, ['projects', 'items']);
  return list
    .map((p) => {
      const rec = p as Record<string, unknown>;
      return { id: asText(rec.id, ''), name: asText(rec.name, 'Untitled project') };
    })
    .filter((p) => p.id);
};

const getUploadedDocumentInfo = (value: unknown) => {
  const payload = getObjectPayload(value);
  const doc = isRecord(payload) && isRecord(payload.document) ? payload.document : payload;
  return {
    id: isRecord(doc) ? asText(doc.id, '') : '',
    chunkCount:
      isRecord(payload) && Number.isFinite(Number(payload.chunkCount))
        ? Number(payload.chunkCount)
        : 0,
  };
};

export interface DocumentsRAGTabProps {
  /**
   * 'superadmin' (default) — pełny panel z governance AI (visibility/sensitivity),
   * wymaga uprawnień superadmina na endpointach AIGovernance.
   * 'client' — Client Vault (HP-22): org-scoped widok WŁASNYCH dokumentów klienta.
   * Backend `/knowledge/documents` jest już org-scoped (organization_id z tokenu),
   * więc wariant klienta reużywa TE SAME wywołania Api bez governance-superadmina.
   */
  variant?: 'superadmin' | 'client';
}

export const DocumentsRAGTab: React.FC<DocumentsRAGTabProps> = ({ variant = 'superadmin' }) => {
  const isClient = variant === 'client';
  const currentUserId = useAppStore((s) => s.currentUser?.id);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadScope, setUploadScope] = useState<VaultScope>('organization');
  const [uploadProjectId, setUploadProjectId] = useState('');
  const [projects, setProjects] = useState<VaultProject[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'' | VaultScope>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editDocCategory, setEditDocCategory] = useState('');
  const [editDocTags, setEditDocTags] = useState('');
  const [editDocVisibility, setEditDocVisibility] =
    useState<NonNullable<Document['ai_visibility']>>('allowed');
  const [editDocSensitivity, setEditDocSensitivity] =
    useState<NonNullable<Document['sensitivity']>>('internal');
  const [editDocScope, setEditDocScope] = useState<VaultScope>('organization');
  const [editDocProjectId, setEditDocProjectId] = useState('');
  const [scopeImpact, setScopeImpact] = useState<{
    checking: boolean;
    becameOrgVisibleCount: number | null;
  }>({ checking: false, becameOrgVisibleCount: null });

  // DOROBKA B (2026-07-23, decyzja Piotra): selektor projektu w Vault (poziom
  // "Projekt") pokazuje tylko projekty, w których wołający jest CZŁONKIEM —
  // spójne z filtrem dokumentów projektowych (backend już liczy
  // memberProjectIds per user, patrz knowledge.routes.ts:38
  // getMemberProjectIds). Wcześniej `Api.getProjects()` ciągnął WSZYSTKIE
  // projekty organizacji niezależnie od członkostwa.
  useEffect(() => {
    Api.getMyProjectMemberships()
      .then((data) => setProjects(normalizeProjects(data)))
      .catch(() => setProjects([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDocuments();
    // Filtr poziomu (scopeFilter) przekazuje ?scope= do GET — przeładowanie z serwera,
    // nie filtrowanie po stronie klienta (patrz KRYTERIUM ODBIORU VLT-003).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeFilter]);

  const loadDocuments = async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading !== false) setLoading(true);
    setLoadError(null);
    try {
      const data = await Api.getKnowledgeDocuments(
        scopeFilter ? { scope: scopeFilter } : undefined
      );
      const nextDocuments = normalizeDocuments(data);
      setDocuments(nextDocuments);
      return nextDocuments;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      setLoadError(message);
      setDocuments([]);
      toast.error(message);
      return null;
    } finally {
      if (options.showLoading !== false) setLoading(false);
    }
  };

  // Czy bieżący user może zmienić poziom TEGO dokumentu — mirror backendu
  // (canEditOwnPrivateDocument w knowledge.routes.ts): tylko własny prywatny
  // dokument, poza tym superadmin-only (poza zakresem klienta).
  const canChangeScope = (doc: Document | null) =>
    !!doc && doc.scope === 'user' && !!currentUserId && doc.owner_id === currentUserId;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    if (uploadScope === 'project' && !uploadProjectId) {
      const message = 'Select a project for project-level documents';
      setActionError(message);
      toast.error(message);
      return;
    }

    setUploading(true);
    setActionError(null);
    try {
      const tagsArray = uploadTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const result = await Api.uploadKnowledgeDocument(
        uploadFile,
        uploadCategory || undefined,
        tagsArray.length > 0 ? tagsArray : undefined,
        uploadScope,
        uploadScope === 'project' ? uploadProjectId : undefined
      );
      const uploaded = getUploadedDocumentInfo(result);
      const refreshed = await loadDocuments({ showLoading: false });
      const confirmed = refreshed?.some((doc) =>
        uploaded.id ? doc.id === uploaded.id : doc.filename === uploadFile.name
      );
      if (!confirmed) {
        throw new Error('Knowledge document upload was not confirmed by the server');
      }
      toast.success(`Uploaded & Indexed! (${uploaded.chunkCount} chunks)`);
      setUploadFile(null);
      setUploadCategory('');
      setUploadTags('');
      setUploadScope('organization');
      setUploadProjectId('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setActionError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateDocument = async (docId: string) => {
    try {
      setActionError(null);
      const tagsArray = editDocTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await Promise.all([
        Api.updateKnowledgeDocument(docId, {
          category: editDocCategory || undefined,
          tags: tagsArray.length > 0 ? tagsArray : undefined,
        }),
        // Governance AI (visibility/sensitivity) jest superadmin-only — w Client
        // Vault pomijamy te wywołania (klient nie ma i nie potrzebuje tych uprawnień).
        ...(isClient
          ? []
          : [
              Api.updateAIGovernanceDocumentVisibility(docId, editDocVisibility),
              Api.updateAIGovernanceDocumentSensitivity(docId, editDocSensitivity),
            ]),
      ]);
      const refreshed = await loadDocuments({ showLoading: false });
      const confirmed = refreshed?.some(
        (doc) =>
          doc.id === docId &&
          (editDocCategory ? doc.category === editDocCategory : true) &&
          (isClient ||
            (doc.ai_visibility === editDocVisibility && doc.sensitivity === editDocSensitivity))
      );
      if (!confirmed) {
        throw new Error('Knowledge document update was not confirmed by the server');
      }
      toast.success('Document updated');
      setEditingDoc(null);
      setEditDocCategory('');
      setEditDocTags('');
      setEditDocVisibility('allowed');
      setEditDocSensitivity('internal');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      setActionError(message);
      toast.error(message);
    }
  };

  // ★ VLT-003 — krok 1/2 zmiany zakresu: dry-run /scope-impact PRZED zapisem,
  // żeby pokazać "X dokumentów stanie się widocznych dla całej organizacji"
  // zanim cokolwiek się zmieni w bazie (warunek DEC-003).
  const handleRequestScopeChange = async (nextScope: VaultScope) => {
    if (!editingDoc) return;
    if (nextScope === editingDoc.scope && nextScope !== 'project') {
      setEditDocScope(nextScope);
      return;
    }
    if (nextScope === 'project' && !editDocProjectId) {
      // brak wyboru projektu jeszcze — nie sprawdzaj wpływu, poczekaj na wybór
      setEditDocScope(nextScope);
      setScopeImpact({ checking: false, becameOrgVisibleCount: null });
      return;
    }
    setEditDocScope(nextScope);
    setScopeImpact({ checking: true, becameOrgVisibleCount: null });
    try {
      const impact = await Api.getKnowledgeDocumentScopeImpact(editingDoc.id, nextScope);
      setScopeImpact({ checking: false, becameOrgVisibleCount: impact.becameOrgVisibleCount });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to check scope impact';
      setActionError(message);
      toast.error(message);
      setScopeImpact({ checking: false, becameOrgVisibleCount: null });
    }
  };

  // ★ VLT-003 — krok 2/2: dopiero PO potwierdzeniu ostrzeżenia woła się faktyczny
  // PATCH .../scope. Anulowanie w UI = po prostu nie wołaj tej funkcji (dokument
  // zostaje bez zmian, patrz KRYTERIUM ODBIORU VLT-003).
  const handleConfirmScopeChange = async () => {
    if (!editingDoc) return;
    if (editDocScope === 'project' && !editDocProjectId) {
      const message = 'Select a project for project-level documents';
      setActionError(message);
      toast.error(message);
      return;
    }
    try {
      setActionError(null);
      await Api.updateKnowledgeDocumentScope(
        editingDoc.id,
        editDocScope,
        editDocScope === 'project' ? editDocProjectId : undefined
      );
      const refreshed = await loadDocuments({ showLoading: false });
      const confirmed = refreshed?.some(
        (doc) => doc.id === editingDoc.id && doc.scope === editDocScope
      );
      if (!confirmed) {
        throw new Error('Knowledge document scope change was not confirmed by the server');
      }
      toast.success('Document level updated');
      setScopeImpact({ checking: false, becameOrgVisibleCount: null });
      setEditingDoc(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update document scope';
      setActionError(message);
      toast.error(message);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesCategory = !categoryFilter || doc.category === categoryFilter;
    const matchesSearch =
      !searchTerm ||
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.tags?.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <DegradedState title="Knowledge documents unavailable" description={loadError} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText size={24} className="text-indigo-500" />
          {isClient ? 'Document Vault' : 'Documents (RAG)'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isClient
            ? 'Upload and search your organization’s documents — AI retrieval is scoped to your workspace'
            : 'Upload and manage knowledge documents for AI retrieval'}
        </p>
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
        >
          {actionError}
        </div>
      ) : null}

      {/* Upload Form */}
      <form
        onSubmit={handleUpload}
        className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Upload size={18} className="text-blue-500" />
          Upload Knowledge Document
        </h3>

        <div className="space-y-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,.docx,.xlsx,.xls,.pptx"
                onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="bg-slate-50 dark:bg-navy-900/50 border border-dashed border-slate-300 dark:border-navy-700 rounded-lg p-4 text-center transition-colors hover:bg-slate-100 dark:hover:bg-navy-900 hover:border-indigo-500">
                {uploadFile ? (
                  <span className="text-indigo-600 dark:text-indigo-300 font-medium flex justify-center items-center gap-2">
                    <FileText size={16} /> {uploadFile.name}
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400 text-sm">
                    Drag & drop PDF, DOCX, XLSX, PPTX, TXT, MD, CSV here or click to select
                  </span>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={!uploadFile || uploading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2"
            >
              {uploading ? <RefreshCw className="animate-spin" size={18} /> : <Upload size={18} />}
              {uploading ? 'Processing...' : 'Upload & Index'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
              >
                <option value="">Select category...</option>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Level
              </label>
              <select
                data-testid="vault-upload-scope"
                value={uploadScope}
                onChange={(e) => {
                  const next = e.target.value as VaultScope;
                  setUploadScope(next);
                  if (next !== 'project') setUploadProjectId('');
                }}
                className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {uploadScope === 'project' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Project
                </label>
                <select
                  data-testid="vault-upload-project"
                  value={uploadProjectId}
                  onChange={(e) => setUploadProjectId(e.target.value)}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                >
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-3">
          Files are automatically chunked, embedded, and added to the vector store for AI retrieval.
        </p>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="">All Categories</option>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          data-testid="vault-scope-filter"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as '' | VaultScope)}
          className="px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="">All Levels</option>
          {SCOPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Documents List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Indexed Documents ({filteredDocuments.length})
        </h3>

        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-500 bg-slate-50 dark:bg-navy-900/50 rounded-xl border border-dashed border-slate-200 dark:border-navy-700">
            {searchTerm || categoryFilter
              ? 'No matching documents found.'
              : 'No documents indexed yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 transition-colors hover:bg-slate-50 dark:hover:bg-navy-700/40"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
                      <FileText className="text-indigo-500" size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-slate-900 dark:text-white font-medium truncate">
                        {doc.filename}
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                      {(() => {
                        const meta = scopeMeta(doc.scope);
                        const ScopeIcon = meta.icon;
                        return (
                          <span
                            data-testid="vault-scope-badge"
                            className="inline-flex items-center gap-1 mt-1 mr-1 text-xs px-2 py-0.5 bg-slate-100 text-slate-700 dark:bg-navy-700/60 dark:text-slate-300 rounded"
                          >
                            <ScopeIcon size={10} /> {meta.label}
                          </span>
                        );
                      })()}
                      {doc.category && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300 rounded">
                          {doc.category}
                        </span>
                      )}
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {doc.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 rounded flex items-center gap-1"
                            >
                              <Tag size={10} /> {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wide ${
                        doc.status === 'indexed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                      }`}
                    >
                      {doc.status}
                    </span>
                    <button
                      onClick={() => {
                        setEditingDoc(doc);
                        setEditDocCategory(doc.category || '');
                        setEditDocTags(doc.tags?.join(', ') || '');
                        setEditDocVisibility(doc.ai_visibility || 'allowed');
                        setEditDocSensitivity(doc.sensitivity || 'internal');
                        setEditDocScope(doc.scope || 'organization');
                        setEditDocProjectId(doc.project_id || '');
                        setScopeImpact({ checking: false, becameOrgVisibleCount: null });
                      }}
                      className="p-1.5 text-slate-600 hover:text-indigo-500 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="p-1.5 text-slate-600 hover:text-danger-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Document</h2>
              <button
                onClick={() => {
                  setEditingDoc(null);
                  setEditDocCategory('');
                  setEditDocTags('');
                  setScopeImpact({ checking: false, becameOrgVisibleCount: null });
                }}
                className="text-slate-600 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Level
                </label>
                {canChangeScope(editingDoc) ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <select
                        data-testid="vault-edit-scope"
                        value={editDocScope}
                        onChange={(e) => handleRequestScopeChange(e.target.value as VaultScope)}
                        className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                      >
                        {SCOPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {editDocScope === 'project' && (
                        <select
                          data-testid="vault-edit-project"
                          value={editDocProjectId}
                          onChange={(e) => {
                            setEditDocProjectId(e.target.value);
                            if (e.target.value) handleRequestScopeChange('project');
                          }}
                          className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                        >
                          <option value="">Select project...</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {scopeImpact.checking && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Checking impact…
                      </p>
                    )}
                    {!scopeImpact.checking &&
                      editDocScope !== editingDoc.scope &&
                      scopeImpact.becameOrgVisibleCount !== null && (
                        <div
                          role="alert"
                          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300"
                        >
                          {scopeImpact.becameOrgVisibleCount > 0 ? (
                            <p>
                              {scopeImpact.becameOrgVisibleCount} document
                              {scopeImpact.becameOrgVisibleCount === 1 ? '' : 's'} will become
                              visible to the whole organization.
                            </p>
                          ) : (
                            <p>
                              This change does not expose any document to the whole organization.
                            </p>
                          )}
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              data-testid="vault-scope-confirm"
                              onClick={handleConfirmScopeChange}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium"
                            >
                              Confirm level change
                            </button>
                            <button
                              type="button"
                              data-testid="vault-scope-cancel"
                              onClick={() => {
                                setEditDocScope(editingDoc.scope || 'organization');
                                setEditDocProjectId(editingDoc.project_id || '');
                                setScopeImpact({ checking: false, becameOrgVisibleCount: null });
                              }}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-navy-700/60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                  </>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {scopeMeta(editingDoc.scope).label}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={editDocCategory}
                  onChange={(e) => setEditDocCategory(e.target.value)}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                >
                  <option value="">No category</option>
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={editDocTags}
                  onChange={(e) => setEditDocTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {!isClient && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      AI visibility
                    </label>
                    <select
                      value={editDocVisibility}
                      onChange={(e) =>
                        setEditDocVisibility(
                          e.target.value as NonNullable<Document['ai_visibility']>
                        )
                      }
                      className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                    >
                      {AI_VISIBILITY_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Sensitivity
                    </label>
                    <select
                      value={editDocSensitivity}
                      onChange={(e) =>
                        setEditDocSensitivity(
                          e.target.value as NonNullable<Document['sensitivity']>
                        )
                      }
                      className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                    >
                      {SENSITIVITY_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDoc(null);
                    setEditDocCategory('');
                    setEditDocTags('');
                    setEditDocVisibility('allowed');
                    setEditDocSensitivity('internal');
                    setScopeImpact({ checking: false, becameOrgVisibleCount: null });
                  }}
                  className="flex-1 py-2 bg-slate-100 dark:bg-navy-900 text-slate-700 dark:text-slate-200 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-navy-700/60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateDocument(editingDoc.id)}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsRAGTab;
