import { Check, Copy, Edit3, Eye, Mail, Plus, Save, Search, Send, Trash2, Upload } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

type EmailStatus = 'DRAFT' | 'PUBLISHED';

interface EmailTemplate {
    id: string;
    name: string;
    key: string;
    subject: string;
    status: EmailStatus;
    updatedAt: string;
    category: string;
    branding?: { primaryColor?: string };
    body?: string;
}

const sampleTemplates: EmailTemplate[] = [
    {
        id: 'welcome-1',
        name: 'Welcome Email',
        key: 'welcome_email',
        subject: 'Welcome to Consultinity!',
        status: 'PUBLISHED',
        updatedAt: new Date().toISOString(),
        category: 'onboarding',
        branding: { primaryColor: '#6366F1' },
        body: '<p>Hi {{user.name}}, welcome aboard!</p>',
    },
    {
        id: 'alert-1',
        name: 'System Alert',
        key: 'system_alert',
        subject: '[Action Required] System Alert',
        status: 'DRAFT',
        updatedAt: new Date().toISOString(),
        category: 'alerts',
        branding: { primaryColor: '#F59E0B' },
        body: '<p>Alert details: {{alert.details}}</p>',
    },
];

export const EmailTemplatesPanel: React.FC = () => {
    const [templates, setTemplates] = useState<EmailTemplate[]>(sampleTemplates);
    const [statusFilter, setStatusFilter] = useState<EmailStatus | ''>('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<EmailTemplate | null>(null);
    const [showModal, setShowModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return templates.filter((t) => {
            const statusOk = !statusFilter || t.status === statusFilter;
            const text = `${t.name} ${t.key} ${t.subject} ${t.category}`.toLowerCase();
            const searchOk = !term || text.includes(term);
            return statusOk && searchOk;
        });
    }, [templates, statusFilter, search]);

    const startCreate = () => {
        setEditing({
            id: `email-${Date.now()}`,
            name: '',
            key: '',
            subject: '',
            status: 'DRAFT',
            updatedAt: new Date().toISOString(),
            category: 'general',
            body: '',
        });
        setShowModal(true);
    };

    const startEdit = (t: EmailTemplate) => {
        setEditing({ ...t });
        setShowModal(true);
    };

    const saveTemplate = () => {
        if (!editing) return;
        if (!editing.name || !editing.key || !editing.subject) {
            toast.error('Name, key, and subject are required');
            return;
        }
        setTemplates((prev) => {
            const existing = prev.find((t) => t.id === editing.id);
            if (existing) {
                return prev.map((t) => (t.id === editing.id ? { ...editing, updatedAt: new Date().toISOString() } : t));
            }
            return [{ ...editing, updatedAt: new Date().toISOString() }, ...prev];
        });
        setShowModal(false);
        toast.success('Template saved');
    };

    const duplicate = (id: string) => {
        const src = templates.find((t) => t.id === id);
        if (!src) return;
        const copy: EmailTemplate = {
            ...src,
            id: `${id}-copy-${Date.now()}`,
            name: `${src.name} (Copy)`,
            status: 'DRAFT',
            updatedAt: new Date().toISOString(),
        };
        setTemplates([copy, ...templates]);
        toast.success('Duplicated as draft');
    };

    const remove = (id: string) => {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success('Template deleted');
    };

    const togglePublish = (id: string) => {
        setTemplates((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: t.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' } : t)),
        );
        toast.success('Status updated');
    };

    const exportTemplate = (t: EmailTemplate) => {
        const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${t.key || t.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importTemplate = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(String(e.target?.result || '{}'));
                const imported: EmailTemplate = {
                    id: json.id || `import-${Date.now()}`,
                    name: json.name || 'Imported Email',
                    key: json.key || `import_${Date.now()}`,
                    subject: json.subject || '(no subject)',
                    status: json.status || 'DRAFT',
                    updatedAt: new Date().toISOString(),
                    category: json.category || 'general',
                    body: json.body || '',
                };
                setTemplates((prev) => [imported, ...prev]);
                toast.success('Template imported');
            } catch {
                toast.error('Invalid email template JSON');
            }
        };
        reader.readAsText(file);
    };

    const sendTest = (t: EmailTemplate) => {
        toast.success(`Test email queued: ${t.subject}`);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto text-slate-900">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Email Templates</h2>
                    <p className="text-slate-400 mt-1">Manage notification emails, alerts, and reports</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/10 text-white rounded-lg hover:bg-white/15"
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
                <div className="flex items-center px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg w-64">
                    <Search size={14} className="text-slate-400 mr-2" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search templates..."
                        className="w-full text-sm bg-transparent outline-none text-white placeholder:text-slate-500"
                    />
                </div>
                {(['', 'DRAFT', 'PUBLISHED'] as Array<EmailStatus | ''>).map((s) => (
                    <button
                        key={s || 'all'}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 text-sm rounded-lg ${
                            statusFilter === s
                                ? 'bg-pink-500/20 text-pink-200 border border-pink-500/30'
                                : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                        {s === '' ? 'All' : s}
                    </button>
                ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
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
                                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                                    No templates found
                                </td>
                            </tr>
                        )}
                        {filtered.map((t) => (
                            <tr key={t.id} className="hover:bg-white/5">
                                <td className="px-4 py-3">
                                    <div className="text-sm text-white font-medium">{t.name}</div>
                                    <div className="text-xs text-slate-400 font-mono">{t.key}</div>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-200">{t.subject}</td>
                                <td className="px-4 py-3 text-xs text-slate-400 capitalize">{t.category}</td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`px-2 py-0.5 text-xs rounded-full ${
                                            t.status === 'PUBLISHED'
                                                ? 'bg-green-500/20 text-green-300'
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
                                            className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-white/10 rounded"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        <button
                                            onClick={() => duplicate(t.id)}
                                            title="Duplicate"
                                            className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-white/10 rounded"
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button
                                            onClick={() => exportTemplate(t)}
                                            title="Export JSON"
                                            className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-white/10 rounded"
                                        >
                                            <Save size={16} />
                                        </button>
                                        <button
                                            onClick={() => sendTest(t)}
                                            title="Send test"
                                            className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-white/10 rounded"
                                        >
                                            <Send size={16} />
                                        </button>
                                        <button
                                            onClick={() => togglePublish(t.id)}
                                            title={t.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                                            className="p-1.5 text-slate-300 hover:text-pink-200 hover:bg-white/10 rounded"
                                        >
                                            <Check size={16} />
                                        </button>
                                        <button
                                            onClick={() => remove(t.id)}
                                            title="Delete"
                                            className="p-1.5 text-slate-300 hover:text-red-300 hover:bg-white/10 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-2xl shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white">
                                    {templates.find((t) => t.id === editing.id) ? 'Edit Template' : 'New Template'}
                                </h3>
                                <p className="text-xs text-slate-400">Name, key, and subject are required</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <Eye size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-400">Name</label>
                                <input
                                    value={editing.name}
                                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Key</label>
                                <input
                                    value={editing.key}
                                    onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white mt-1 font-mono"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-slate-400">Subject</label>
                                <input
                                    value={editing.subject}
                                    onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Category</label>
                                <input
                                    value={editing.category}
                                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Status</label>
                                <select
                                    value={editing.status}
                                    onChange={(e) =>
                                        setEditing({ ...editing, status: e.target.value as EmailStatus })
                                    }
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white mt-1"
                                >
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="PUBLISHED">PUBLISHED</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-slate-400">Body (HTML / placeholders)</label>
                                <textarea
                                    value={editing.body}
                                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                                    rows={6}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white mt-1 font-mono text-sm"
                                    placeholder="<p>Hello {{user.name}}</p>"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 rounded-lg bg-white/5 text-slate-200 hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveTemplate}
                                className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailTemplatesPanel;
