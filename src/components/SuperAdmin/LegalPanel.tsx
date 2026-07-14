/**
 * LegalPanel - SuperAdmin legal document management
 */

import { CheckCircle2, Loader2, Plus, RefreshCw, ToggleLeft, ToggleRight, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { InfoButton } from '../shared/InfoButton';
import { EmptyState, LoadingState } from '../shared/states';

const DOC_TYPES = [
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
  'DPA',
  'ACCEPTABLE_USE',
  'SLA',
  'COOKIE_POLICY',
];

interface LegalPanelDocument {
  id: string;
  doc_type?: string;
  type?: string;
  title?: string;
  name?: string;
  version?: string;
  effective_from?: string;
  effective_date?: string;
  is_active?: boolean | number;
  isActive?: boolean;
  status?: string;
  change_summary?: string;
}

const normalizeDocs = (data: unknown): LegalPanelDocument[] => {
  if (Array.isArray(data)) return data;
  if (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: LegalPanelDocument[] }).data;
  }
  throw new Error('Legal document list response was not returned by the server');
};

const isActive = (doc: LegalPanelDocument) =>
  doc.is_active === true || doc.is_active === 1 || doc.isActive === true || doc.status === 'active';

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

const matchesPublish = (
  doc: LegalPanelDocument,
  expected: { docType: string; title: string; version: string }
) =>
  String(doc.doc_type || doc.type || '') === expected.docType &&
  String(doc.title || doc.name || '') === expected.title &&
  String(doc.version || '') === expected.version;

const matchesActiveState = (doc: LegalPanelDocument, expected: { id: string; isActive: boolean }) =>
  String(doc.id || '') === expected.id && isActive(doc) === expected.isActive;

export const LegalPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<LegalPanelDocument[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [newDoc, setNewDoc] = useState({
    doc_type: 'TERMS_OF_SERVICE',
    title: '',
    version: '1.0',
    content_url: '',
    content_md: '',
    effective_from: '',
    change_summary: '',
  });

  const fetchDocs = async () => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      const data = await Api.getSuperAdminLegalDocs();
      const nextDocs = normalizeDocs(data);
      setDocs(nextDocs);
      return nextDocs;
    } catch (e: unknown) {
      setDocs([]);
      setLoadError(normalizeApiErrorMessage(e, 'Failed to load legal documents'));
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, LegalPanelDocument[]>();
    for (const d of docs) {
      const type = String(d.doc_type || d.type || 'UNKNOWN').toUpperCase();
      const items = map.get(type) || [];
      items.push(d);
      map.set(type, items);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [docs]);

  const handlePublish = async () => {
    if (!newDoc.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setPublishing(true);
    setActionError(null);
    try {
      const expected = {
        docType: newDoc.doc_type,
        title: newDoc.title,
        version: newDoc.version || '1.0',
      };
      await Api.publishSuperAdminLegalDoc({
        docType: newDoc.doc_type,
        title: newDoc.title,
        version: newDoc.version || '1.0',
        contentMd: newDoc.content_md || newDoc.content_url || '',
        effectiveFrom: newDoc.effective_from || new Date().toISOString().split('T')[0],
        changeSummary: newDoc.change_summary,
      });
      const refreshedDocs = await fetchDocs();
      if (!refreshedDocs.some((doc) => matchesPublish(doc, expected))) {
        throw new Error('Legal document publish was not confirmed by the server');
      }
      toast.success('Document published');
      setShowPublishModal(false);
      setNewDoc({
        doc_type: 'TERMS_OF_SERVICE',
        title: '',
        version: '1.0',
        content_url: '',
        content_md: '',
        effective_from: '',
        change_summary: '',
      });
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Failed to publish document');
      setActionError(message);
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  const handleToggle = async (id: string, nextActive: boolean) => {
    setActionError(null);
    try {
      await Api.toggleSuperAdminLegalDocActive(id, nextActive);
      const refreshedDocs = await fetchDocs();
      if (!refreshedDocs.some((doc) => matchesActiveState(doc, { id, isActive: nextActive }))) {
        throw new Error('Legal document status was not confirmed by the server');
      }
      toast.success(nextActive ? 'Document activated' : 'Document archived');
    } catch (e: unknown) {
      const message = normalizeApiErrorMessage(e, 'Failed to update document');
      setActionError(message);
      toast.error(message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-c-text">Legal Documents</h2>
          <p className="text-sm text-c-text-secondary">
            Manage versions, activation status, and publication of legal documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton cardId="superadmin-legal" showLabel label="Help" />
          <button
            onClick={fetchDocs}
            className="flex items-center gap-2 px-3 py-2 bg-c-surface hover:bg-c-surface-raised border border-c-border-subtle rounded-lg text-sm text-c-text transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowPublishModal(true)}
            disabled={!!loadError}
            title={
              loadError ? 'Legal documents must load before publishing a new version.' : undefined
            }
            className="flex items-center gap-2 px-3 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Publish Document
          </button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="p-4 rounded-lg bg-c-danger/10 text-c-danger">
          {actionError}
        </div>
      )}

      {loading ? (
        <LoadingState template="list" />
      ) : loadError ? (
        <DegradedState title="Legal documents unavailable" description={loadError} />
      ) : docs.length === 0 ? (
        <EmptyState
          variant="new"
          icon={CheckCircle2}
          title="No legal documents"
          description="Publish a document to start tracking legal versions."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([type, items]) => (
            <div
              key={type}
              className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-c-border-subtle flex items-center justify-between">
                <div className="font-medium text-c-text">{type}</div>
                <div className="text-xs text-c-text-secondary">
                  {items.length} version{items.length === 1 ? '' : 's'}
                </div>
              </div>
              <table
                /* §27-exempt: render danych nie-listowy, nie spelnia definicji 1 (przegladana kolekcja encji z akcjami) */ className="w-full text-left text-sm"
              >
                <thead className="bg-c-surface-raised text-c-text-secondary text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Version</th>
                    <th className="px-6 py-3 font-medium">Effective</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-c-border-subtle">
                  {items.map((d) => {
                    const active = isActive(d);
                    return (
                      <tr key={d.id} className="hover:bg-c-surface-raised">
                        <td className="px-6 py-4">
                          <div className="font-medium text-c-text">{d.title || d.name || type}</div>
                          {d.change_summary && (
                            <div className="text-xs text-c-text-secondary mt-0.5">
                              {d.change_summary}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-c-text-secondary">{d.version}</td>
                        <td className="px-6 py-4 text-c-text-secondary">
                          {formatDate(d.effective_from || d.effective_date)}
                        </td>
                        <td className="px-6 py-4">
                          {active ? (
                            <span className="inline-flex items-center gap-1.5 text-c-success">
                              <CheckCircle2 className="w-4 h-4" />
                              Active
                            </span>
                          ) : (
                            <span className="text-c-text-secondary">Archived</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggle(d.id, !active)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-c-border-subtle bg-c-surface hover:bg-c-surface-raised text-c-text transition-colors"
                              title={active ? 'Archive' : 'Activate'}
                            >
                              {active ? (
                                <ToggleRight className="w-4 h-4 text-c-success" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-c-text-secondary" />
                              )}
                              {active ? 'Active' : 'Archived'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showPublishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay p-4">
          <div className="bg-c-surface rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-c-border-subtle flex items-center justify-between">
              <h3 className="text-lg font-semibold text-c-text">Publish Legal Document</h3>
              <button
                onClick={() => setShowPublishModal(false)}
                className="p-1 hover:bg-c-surface-raised rounded-lg"
              >
                <X className="w-5 h-5 text-c-text-secondary" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  Document Type
                </label>
                <select
                  value={newDoc.doc_type}
                  onChange={(e) => setNewDoc({ ...newDoc, doc_type: e.target.value })}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="e.g., Terms of Service v2.0"
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={newDoc.version}
                    onChange={(e) => setNewDoc({ ...newDoc, version: e.target.value })}
                    placeholder="1.0"
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text-secondary mb-1">
                    Effective From
                  </label>
                  <input
                    type="date"
                    value={newDoc.effective_from}
                    onChange={(e) => setNewDoc({ ...newDoc, effective_from: e.target.value })}
                    className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  Content (Markdown)
                </label>
                <textarea
                  value={newDoc.content_md}
                  onChange={(e) => setNewDoc({ ...newDoc, content_md: e.target.value })}
                  placeholder="Enter document content in Markdown format..."
                  rows={4}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text resize-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  Change Summary
                </label>
                <textarea
                  value={newDoc.change_summary}
                  onChange={(e) => setNewDoc({ ...newDoc, change_summary: e.target.value })}
                  placeholder="Brief description of changes in this version..."
                  rows={2}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-c-border-subtle flex justify-end gap-3">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 border border-c-border-subtle rounded-lg text-c-text-secondary hover:bg-c-surface-raised"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !newDoc.title.trim()}
                className="px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg font-medium flex items-center gap-2"
              >
                {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegalPanel;
