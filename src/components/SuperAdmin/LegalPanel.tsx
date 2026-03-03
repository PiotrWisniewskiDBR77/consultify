/**
 * LegalPanel - SuperAdmin legal document management
 */

import { CheckCircle2, Loader2, Plus, RefreshCw, ToggleLeft, ToggleRight, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { InfoButton } from '../shared/InfoButton';

const DOC_TYPES = ['TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'DPA', 'ACCEPTABLE_USE', 'SLA', 'COOKIE_POLICY'];

export const LegalPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<any[]>([]);
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
    try {
      const data = await Api.getSuperAdminLegalDocs();
      setDocs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load legal documents');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of docs) {
      const type = String(d.doc_type || d.type || 'UNKNOWN').toUpperCase();
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [docs]);

  const isActive = (d: any) => d?.is_active === true || d?.is_active === 1 || d?.status === 'active';

  const handlePublish = async () => {
    if (!newDoc.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setPublishing(true);
    try {
      await (Api as any).publishSuperAdminLegalDoc({
        docType: newDoc.doc_type,
        title: newDoc.title,
        version: newDoc.version || '1.0',
        contentMd: newDoc.content_md || newDoc.content_url || '',
        effectiveFrom: newDoc.effective_from || new Date().toISOString().split('T')[0],
        changeSummary: newDoc.change_summary,
      });
      toast.success('Document published');
      setShowPublishModal(false);
      setNewDoc({ doc_type: 'TERMS_OF_SERVICE', title: '', version: '1.0', content_url: '', content_md: '', effective_from: '', change_summary: '' });
      fetchDocs();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to publish document');
    } finally {
      setPublishing(false);
    }
  };

  const handleToggle = async (id: string, nextActive: boolean) => {
    try {
      await Api.toggleSuperAdminLegalDocActive(id, nextActive);
      toast.success(nextActive ? 'Document activated' : 'Document archived');
      fetchDocs();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update document');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Legal Documents
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage versions, activation status, and publication of legal documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton cardId="superadmin-legal" showLabel label="Help" />
          <button
            onClick={fetchDocs}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800/30 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowPublishModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Publish Document
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-600 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-10 text-center">
          <div className="text-slate-900 dark:text-slate-100 font-medium">No legal documents</div>
          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Publish a document to start tracking legal versions.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([type, items]) => (
            <div
              key={type}
              className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="font-medium text-slate-900 dark:text-slate-100">{type}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {items.length} version{items.length === 1 ? '' : 's'}
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-navy-950 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Version</th>
                    <th className="px-6 py-3 font-medium">Effective</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {items.map((d) => {
                    const active = isActive(d);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {d.title || d.name || type}
                          </div>
                          {d.change_summary && (
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                              {d.change_summary}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">
                          {d.version}
                        </td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                          {d.effective_from || d.effective_date
                            ? new Date(d.effective_from || d.effective_date).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-6 py-4">
                          {active ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                              Active
                            </span>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400">Archived</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggle(d.id, !active)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-950 hover:bg-slate-50 dark:hover:bg-navy-800/30 text-slate-900 dark:text-slate-100 transition-colors"
                              title={active ? 'Archive' : 'Activate'}
                            >
                              {active ? (
                                <ToggleRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Publish Legal Document</h3>
              <button onClick={() => setShowPublishModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Document Type</label>
                <select
                  value={newDoc.doc_type}
                  onChange={(e) => setNewDoc({ ...newDoc, doc_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="e.g., Terms of Service v2.0"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Version</label>
                  <input
                    type="text"
                    value={newDoc.version}
                    onChange={(e) => setNewDoc({ ...newDoc, version: e.target.value })}
                    placeholder="1.0"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Effective From</label>
                  <input
                    type="date"
                    value={newDoc.effective_from}
                    onChange={(e) => setNewDoc({ ...newDoc, effective_from: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content (Markdown)</label>
                <textarea
                  value={newDoc.content_md}
                  onChange={(e) => setNewDoc({ ...newDoc, content_md: e.target.value })}
                  placeholder="Enter document content in Markdown format..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white resize-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Change Summary</label>
                <textarea
                  value={newDoc.change_summary}
                  onChange={(e) => setNewDoc({ ...newDoc, change_summary: e.target.value })}
                  placeholder="Brief description of changes in this version..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/20"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !newDoc.title.trim()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
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
