// @ts-nocheck
import {
  Check,
  Copy,
  Edit3,
  Eye,
  Mail,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { API_URL, getHeaders } from '../../services/api';
import { InfoButton } from '../shared/InfoButton';

type EmailStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';

interface EmailTemplate {
  id: string;
  name: string;
  templateKey: string;
  subject: string;
  status: EmailStatus;
  version: number;
  updatedAt: string;
  createdAt: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    color: string;
  };
  usageCount?: number;
  htmlContent?: string;
  textContent?: string;
  availableVariables?: string[];
}

interface ContentCategory {
  id: string;
  name: string;
  color: string;
  contentType: string;
}

const sampleTemplates: EmailTemplate[] = [
  {
    id: 'welcome-1',
    name: 'Welcome Email',
    templateKey: 'welcome_email',
    subject: 'Welcome to Consultinity!',
    status: 'PUBLISHED',
    version: 1,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    category: { id: 'cat_email_welcome', name: 'Onboarding', color: '#10B981' },
    htmlContent: '<p>Hi {{user.name}}, welcome aboard!</p>',
  },
  {
    id: 'alert-1',
    name: 'System Alert',
    templateKey: 'system_alert',
    subject: '[Action Required] System Alert',
    status: 'DRAFT',
    version: 1,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    category: { id: 'cat_email_notifications', name: 'Alerts', color: '#F59E0B' },
    htmlContent: '<p>Alert details: {{alert.details}}</p>',
  },
];

export const EmailTemplatesPanel: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<ContentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<EmailStatus | ''>('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load templates from API
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`${API_URL}/content/emails/templates?${params.toString()}`, {
        headers: getHeaders(),
      });

      if (!res.ok) throw new Error('Failed to load templates');

      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err: any) {
      console.error('Error loading templates:', err);
      // Use fallback data
      toast.error('Using demo data - backend not connected');
      setTemplates(sampleTemplates);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/content/categories?contentType=EMAIL`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, [loadTemplates, loadCategories]);

  // Filter templates
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((t) => {
      const statusOk = !statusFilter || t.status === statusFilter;
      const text =
        `${t.name} ${t.templateKey} ${t.subject} ${t.category?.name || ''}`.toLowerCase();
      const searchOk = !term || text.includes(term);
      return statusOk && searchOk;
    });
  }, [templates, statusFilter, search]);

  const startCreate = () => {
    setEditing({
      id: '',
      name: '',
      templateKey: '',
      subject: '',
      status: 'DRAFT',
      version: 1,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      htmlContent: '',
    });
    setShowModal(true);
  };

  const startEdit = (t: EmailTemplate) => {
    setEditing({ ...t });
    setShowModal(true);
  };

  const saveTemplate = async () => {
    if (!editing) return;
    if (!editing.name || !editing.templateKey || !editing.subject) {
      toast.error('Name, key, and subject are required');
      return;
    }

    setSaving(true);
    try {
      const isNew = !editing.id;
      const url = isNew
        ? `${API_URL}/content/emails/templates`
        : `${API_URL}/content/emails/templates/${editing.id}`;

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateKey: editing.templateKey,
          name: editing.name,
          subject: editing.subject,
          htmlContent: editing.htmlContent,
          textContent: editing.textContent,
          categoryId: editing.categoryId,
          availableVariables: editing.availableVariables,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      toast.success(isNew ? 'Template created' : 'Template saved');
      setShowModal(false);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/content/emails/templates/${id}/clone`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error('Clone failed');

      toast.success('Duplicated as draft');
      loadTemplates();
    } catch (err: any) {
      toast.error('Failed to duplicate template');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const res = await fetch(`${API_URL}/content/emails/templates/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!res.ok) throw new Error('Delete failed');

      toast.success('Template deleted');
      loadTemplates();
    } catch (err: any) {
      toast.error('Failed to delete template');
    }
  };

  const togglePublish = async (id: string, currentStatus: EmailStatus) => {
    try {
      const endpoint = currentStatus === 'PUBLISHED' ? 'deprecate' : 'publish';
      const res = await fetch(`${API_URL}/content/emails/templates/${id}/${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
      });

      if (!res.ok) throw new Error('Status update failed');

      toast.success('Status updated');
      loadTemplates();
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  const exportTemplate = (t: EmailTemplate) => {
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.templateKey || t.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(String(e.target?.result || '{}'));
        const imported: EmailTemplate = {
          id: '',
          name: json.name || 'Imported Email',
          templateKey: json.templateKey || `import_${Date.now()}`,
          subject: json.subject || '(no subject)',
          status: 'DRAFT',
          version: 1,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          htmlContent: json.htmlContent || json.body || '',
        };
        setEditing(imported);
        setShowModal(true);
        toast.success('Template imported - review and save');
      } catch {
        toast.error('Invalid email template JSON');
      }
    };
    reader.readAsText(file);
  };

  const sendTest = async (t: EmailTemplate) => {
    const email = prompt('Enter test email address:');
    if (!email) return;

    try {
      const res = await fetch(`${API_URL}/content/emails/templates/${t.id}/test-send`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipientEmails: [email], testData: {} }),
      });

      if (!res.ok) throw new Error('Test send failed');

      const data = await res.json();
      toast.success(`Test email sent: ${data.sent} delivered`);
    } catch (err: any) {
      toast.error('Failed to send test email');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto text-slate-900 dark:text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Email Templates</h2>
            <p className="text-slate-400 dark:text-slate-500 mt-1">
              Manage notification emails, alerts, and reports
            </p>
          </div>
          <InfoButton cardId="superadmin-email-templates" size="sm" variant="ghost" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadTemplates()}
            disabled={loading}
            className="p-2 bg-slate-50/50 dark:bg-navy-950/30 border border-white/10 text-white rounded-lg hover:bg-white/15 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-50/50 dark:bg-navy-950/30 border border-white/10 text-white rounded-lg hover:bg-white/15"
          >
            <Upload size={16} />
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => importTemplate(e.target.files)}
          />
          <button
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
          >
            <Plus size={16} />
            New Template
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center px-3 py-1.5 bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 rounded-lg w-64">
          <Search size={14} className="text-slate-400 dark:text-slate-500 mr-2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full text-sm bg-transparent outline-none text-white placeholder:text-slate-500 dark:text-slate-400"
          />
        </div>
        {(['', 'DRAFT', 'PUBLISHED'] as Array<EmailStatus | ''>).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              statusFilter === s
                ? 'bg-pink-500/20 text-pink-200 border border-pink-500/30'
                : 'bg-white/5 text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800/40'
            }`}
          >
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-slate-400 dark:text-slate-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-400 dark:text-slate-500">Loading templates...</p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-white/5 text-slate-300 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Template</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    No templates found
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="text-sm text-white font-medium">{t.name}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                      {t.templateKey}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-200">{t.subject}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 capitalize">
                    {t.category?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        t.status === 'PUBLISHED'
                          ? 'bg-green-500/20 text-green-300'
                          : t.status === 'DEPRECATED'
                            ? 'bg-slate-500/20 text-slate-300'
                            : 'bg-yellow-500/20 text-yellow-200'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => startEdit(t)}
                        title="Edit"
                        className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => duplicate(t.id)}
                        title="Duplicate"
                        className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => exportTemplate(t)}
                        title="Export JSON"
                        className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        onClick={() => sendTest(t)}
                        title="Send test"
                        className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded"
                      >
                        <Send size={16} />
                      </button>
                      <button
                        onClick={() => togglePublish(t.id, t.status)}
                        title={t.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                        className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        title="Delete"
                        className="p-1.5 text-slate-300 hover:text-red-300 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {editing.id ? 'Edit Template' : 'New Template'}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Name, key, and subject are required
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-white"
              >
                <Eye size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500">Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500">Key</label>
                <input
                  value={editing.templateKey}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      templateKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 text-white mt-1 font-mono"
                  disabled={!!editing.id}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 dark:text-slate-500">Subject</label>
                <input
                  value={editing.subject}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500">Category</label>
                <select
                  value={editing.categoryId || ''}
                  onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 text-white mt-1"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as EmailStatus })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 text-white mt-1"
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 dark:text-slate-500">
                  Body (HTML / placeholders)
                </label>
                <textarea
                  value={editing.htmlContent}
                  onChange={(e) => setEditing({ ...editing, htmlContent: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50/30 dark:bg-navy-950/20 border border-white/10 text-white mt-1 font-mono text-sm"
                  placeholder="<p>Hello {{user.name}}</p>"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-50/30 dark:bg-navy-950/20 text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800/40"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTemplatesPanel;
