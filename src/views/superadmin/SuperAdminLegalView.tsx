import { AlertCircle, Check, Eye, Loader2, Plus, RefreshCw, Shield, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '../../components/Admin/AdminState';
import type {
  StandardRowMenu,
  TableColumn,
  TableRow,
} from '../../components/standard/StandardTable';
import { StandardTable } from '../../components/standard/StandardTable';
import { LoadingState } from '../../components/ui/primitives';
import { Api } from '../../services/api';
import { LegalDocType } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';

type SuperAdminLegalViewProps = Record<string, never>;

interface SuperAdminLegalDocument {
  id: string;
  doc_type?: string;
  docType?: string;
  type?: string;
  title?: string;
  version?: string;
  effective_from?: string;
  is_active?: boolean | number;
  isActive?: boolean;
  status?: string;
  content_md?: string;
}

const DOC_TYPE_OPTIONS: { value: LegalDocType; label: string }[] = [
  { value: 'TOS', label: 'Terms of Service' },
  { value: 'PRIVACY', label: 'Privacy Policy' },
  { value: 'COOKIES', label: 'Cookie Policy' },
  { value: 'AUP', label: 'Acceptable Use Policy' },
  { value: 'AI_POLICY', label: 'AI Usage Policy' },
  { value: 'DPA', label: 'Data Processing Addendum' },
];

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

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

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
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

const toBool = (value: unknown, fallback = false) =>
  typeof value === 'boolean'
    ? value
    : value === undefined || value === null
      ? fallback
      : value === 1 || value === '1' || value === 'true';

const normalizeDocs = (data: unknown): SuperAdminLegalDocument[] => {
  const keys = ['documents', 'docs', 'legalDocuments', 'items'];
  const docs = getListPayload<SuperAdminLegalDocument>(data, [
    'documents',
    'docs',
    'legalDocuments',
    'items',
  ]);
  if (hasListShape(data, keys)) {
    return docs;
  }
  throw new Error('Legal document list response was not returned by the server');
};

const documentMatchesPublish = (
  doc: SuperAdminLegalDocument,
  expected: { id: string; docType: LegalDocType; version: string; title: string }
) =>
  String(doc?.id || '') === expected.id &&
  String(doc?.doc_type || doc?.docType || doc?.type || '') === expected.docType &&
  String(doc?.version || '') === expected.version &&
  String(doc?.title || '') === expected.title;

const documentMatchesActiveState = (
  doc: SuperAdminLegalDocument,
  expected: { id: string; isActive: boolean }
) =>
  String(doc?.id || '') === expected.id &&
  toBool(doc?.is_active ?? doc?.isActive ?? doc?.status === 'active') === expected.isActive;

const getDocumentType = (doc: SuperAdminLegalDocument) =>
  String(doc?.doc_type || doc?.docType || doc?.type || '');

const isDocumentActive = (doc: SuperAdminLegalDocument) =>
  toBool(doc?.is_active ?? doc?.isActive ?? doc?.status === 'active');

const getPublishedDocumentId = (result: unknown) => {
  const payload = getObjectPayload(result);
  if (!isRecord(payload)) return '';
  return String(payload.id || (isRecord(payload.document) ? payload.document.id : '') || '');
};

export const SuperAdminLegalView: React.FC<SuperAdminLegalViewProps> = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<SuperAdminLegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<SuperAdminLegalDocument | null>(null);

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
    setLoadError(null);
    setError(null);
    try {
      const data = await Api.getSuperAdminLegalDocs();
      const docs = normalizeDocs(data);
      setDocuments(docs);
      return docs;
    } catch (err: unknown) {
      setDocuments([]);
      setLoadError(normalizeApiErrorMessage(err, 'Failed to load legal documents'));
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true);
    setError(null);

    try {
      const result = await Api.publishSuperAdminLegalDoc({
        docType: formDocType,
        version: formVersion,
        title: formTitle,
        effectiveFrom: formEffectiveFrom,
        contentMd: formContent,
      });
      const expected = {
        id: getPublishedDocumentId(result),
        docType: formDocType,
        version: formVersion,
        title: formTitle,
      };
      if (!expected.id) {
        throw new Error('Legal document publish response was incomplete');
      }

      const refreshedDocs = await fetchDocuments();
      if (!refreshedDocs.some((doc) => documentMatchesPublish(doc, expected))) {
        throw new Error('Legal document publish was not confirmed by the server');
      }

      setShowPublishForm(false);
      setFormDocType('TOS');
      setFormVersion('');
      setFormTitle('');
      setFormEffectiveFrom('');
      setFormContent('');
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to publish legal document'));
    } finally {
      setPublishing(false);
    }
  };

  const toggleActive = async (docId: string, isActive: boolean) => {
    setError(null);
    try {
      await Api.toggleSuperAdminLegalDocActive(docId, isActive);
      const refreshedDocs = await fetchDocuments();
      if (!refreshedDocs.some((doc) => documentMatchesActiveState(doc, { id: docId, isActive }))) {
        throw new Error('Legal document status was not confirmed by the server');
      }
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to update legal document'));
    }
  };

  const viewDocument = async (docId: string) => {
    setError(null);
    try {
      const doc = await Api.getSuperAdminLegalDocById(docId);
      const payload = getObjectPayload(doc);
      setSelectedDoc(
        (isRecord(payload) && isRecord(payload.document)
          ? payload.document
          : payload) as SuperAdminLegalDocument
      );
    } catch (err: unknown) {
      setError(normalizeApiErrorMessage(err, 'Failed to load legal document'));
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Generate default version based on date
  const generateVersion = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const existing = documents.filter(
      (d) => getDocumentType(d) === formDocType && (d.version || '').startsWith(dateStr)
    );
    return `${dateStr}.${existing.length + 1}`;
  };

  // ── Kanon §27: dokumenty prawne → StandardTable ──────────────────────────
  const documentRows: TableRow[] = documents.map((doc) => ({ ...doc, id: String(doc.id) }));

  const documentColumns: TableColumn[] = [
    {
      id: 'type',
      label: 'Type',
      sortable: true,
      sortAccessor: (row: TableRow) => getDocumentType(row as SuperAdminLegalDocument),
      render: (row: TableRow) => (
        <span className="text-sm font-medium text-slate-900 dark:text-white">
          {getDocumentType(row as SuperAdminLegalDocument)}
        </span>
      ),
    },
    {
      id: 'title',
      label: 'Title',
      sortable: true,
      render: (row: TableRow) => (
        <span className="text-sm text-slate-600 dark:text-slate-300">{row.title}</span>
      ),
    },
    {
      id: 'version',
      label: 'Version',
      render: (row: TableRow) => (
        <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
          {row.version}
        </code>
      ),
    },
    {
      id: 'effective_from',
      label: 'Effective',
      sortable: true,
      render: (row: TableRow) => (
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {formatDate((row.effective_from as string) || '')}
        </span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      align: 'center',
      render: (row: TableRow) =>
        isDocumentActive(row as SuperAdminLegalDocument) ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <Check size={12} />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            Inactive
          </span>
        ),
    },
  ];

  const documentRowMenu = (row: TableRow): StandardRowMenu => {
    const doc = row as SuperAdminLegalDocument & TableRow;
    const active = isDocumentActive(doc);
    return {
      primary: [
        {
          id: 'view',
          label: 'View',
          icon: Eye,
          onClick: () => viewDocument(String(doc.id)),
        },
      ],
      statusTransitions: [
        active
          ? {
              id: 'deactivate',
              label: 'Deactivate',
              icon: X,
              onClick: () => toggleActive(String(doc.id), false),
            }
          : {
              id: 'activate',
              label: 'Activate',
              icon: Check,
              onClick: () => toggleActive(String(doc.id), true),
            },
      ],
      universalHandlers: {
        preview: () => viewDocument(String(doc.id)),
      },
      destructive: { note: 'Legal documents are deactivated, not deleted' },
    };
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
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
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('superadmin.legal.subtitle', 'Publish and manage legal documents')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDocuments}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800/40"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => {
              setFormVersion(generateVersion());
              setFormEffectiveFrom(new Date().toISOString().split('T')[0]);
              setShowPublishForm(true);
            }}
            disabled={!!loadError}
            title={
              loadError ? 'Legal documents must load before publishing a new version.' : undefined
            }
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
          >
            <Plus size={16} />
            {t('superadmin.legal.publish', 'Publish New Version')}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 flex items-center gap-2"
        >
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
                  {DOC_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
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
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-navy-800/20 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Documents Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
        {loadError ? (
          <div className="p-6">
            <DegradedState title="Legal documents unavailable" description={loadError} />
          </div>
        ) : (
          <StandardTable
            columns={documentColumns}
            data={documentRows}
            rowMenu={documentRowMenu}
            empty={{
              title: t(
                'superadmin.legal.noDocuments',
                'No legal documents found. Click "Publish New Version" to add one.'
              ),
            }}
            persistKey="superadmin.legalDocuments.list"
          />
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
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {getDocumentType(selectedDoc)} • Version {selectedDoc.version}
                </p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800/40"
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
