/**
 * Invoice Template Editor
 * Create and customize invoice templates with live preview
 */

import {
    Check,
    Copy,
    Edit2,
    Eye,
    FileText,
    Layout,
    Palette,
    Plus,
    RefreshCw,
    Save,
    Settings2,
    Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Api } from '../../services/api';

interface InvoiceTemplate {
    id: string;
    organization_id?: string;
    name: string;
    description?: string;
    template_type: string;
    is_default: boolean;
    is_system: boolean;
    layout_type: string;
    paper_size: string;
    primary_color: string;
    secondary_color: string;
    text_color: string;
    background_color: string;
    logo_url?: string;
    payment_terms_days: number;
    default_currency: string;
    default_tax_rate?: number;
    locale: string;
    show_company_info: boolean;
    show_customer_info: boolean;
    show_payment_terms: boolean;
    show_due_date: boolean;
    show_tax_breakdown: boolean;
}

interface InvoiceTemplateEditorProps {
    organizationId?: string;
}

const LAYOUT_TYPES = [
    { value: 'modern', label: 'Modern', desc: 'Clean, contemporary design' },
    { value: 'classic', label: 'Classic', desc: 'Traditional business style' },
    { value: 'minimal', label: 'Minimal', desc: 'Simple, focused layout' },
    { value: 'detailed', label: 'Detailed', desc: 'Comprehensive breakdown' },
];

const TEMPLATE_TYPES = [
    { value: 'standard', label: 'Standard Invoice' },
    { value: 'recurring', label: 'Recurring Invoice' },
    { value: 'usage', label: 'Usage-Based Invoice' },
    { value: 'credit_note', label: 'Credit Note' },
    { value: 'proforma', label: 'Proforma Invoice' },
];

export const InvoiceTemplateEditor: React.FC<InvoiceTemplateEditorProps> = ({ organizationId }) => {
    const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await Api.get('/billing/templates');
            setTemplates(res.templates || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async (templateId: string) => {
        try {
            const res = await Api.get(`/billing/templates/${templateId}/preview`);
            setPreviewHtml(res.preview?.html || '');
        } catch (err: any) {
            setError('Failed to generate preview');
        }
    };

    const handleSave = async () => {
        if (!selectedTemplate) return;
        setSaving(true);
        try {
            if (selectedTemplate.id.startsWith('new-')) {
                await Api.post('/billing/templates', selectedTemplate);
            } else {
                await Api.put(`/billing/templates/${selectedTemplate.id}`, selectedTemplate);
            }
            setEditMode(false);
            fetchTemplates();
        } catch (err: any) {
            setError(err.message || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (templateId: string) => {
        if (!window.confirm('Delete this template?')) return;
        try {
            await Api.delete(`/billing/templates/${templateId}`);
            fetchTemplates();
            if (selectedTemplate?.id === templateId) setSelectedTemplate(null);
        } catch (err: any) {
            setError(err.message || 'Failed to delete template');
        }
    };

    const handleClone = async (templateId: string) => {
        try {
            await Api.post(`/billing/templates/${templateId}/clone`, { name: 'Copy of Template' });
            fetchTemplates();
        } catch (err: any) {
            setError(err.message || 'Failed to clone template');
        }
    };

    const createNewTemplate = () => {
        setSelectedTemplate({
            id: `new-${Date.now()}`,
            name: 'New Template',
            template_type: 'standard',
            is_default: false,
            is_system: false,
            layout_type: 'modern',
            paper_size: 'A4',
            primary_color: '#8B5CF6',
            secondary_color: '#10B981',
            text_color: '#1F2937',
            background_color: '#FFFFFF',
            payment_terms_days: 30,
            default_currency: 'USD',
            locale: 'en',
            show_company_info: true,
            show_customer_info: true,
            show_payment_terms: true,
            show_due_date: true,
            show_tax_breakdown: true,
        });
        setEditMode(true);
    };

    const updateTemplate = (field: string, value: any) => {
        if (!selectedTemplate) return;
        setSelectedTemplate({ ...selectedTemplate, [field]: value });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Templates List */}
            <div className="lg:col-span-1 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Templates</h3>
                    <button
                        onClick={createNewTemplate}
                        className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/10 max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No templates</div>
                    ) : (
                        templates.map((tpl) => (
                            <div
                                key={tpl.id}
                                onClick={() => {
                                    setSelectedTemplate(tpl);
                                    setEditMode(false);
                                }}
                                className={`p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${
                                    selectedTemplate?.id === tpl.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-white text-sm">{tpl.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {tpl.template_type} • {tpl.layout_type}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {tpl.is_default && (
                                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                                Default
                                            </span>
                                        )}
                                        {tpl.is_system && (
                                            <span className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                                                System
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Editor / Details */}
            <div className="lg:col-span-2 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                {!selectedTemplate ? (
                    <div className="h-full flex items-center justify-center text-slate-500">
                        <div className="text-center">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                            <p>Select a template to view or edit</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900 dark:text-white">{selectedTemplate.name}</h3>
                            <div className="flex items-center gap-2">
                                {!selectedTemplate.is_system && (
                                    <>
                                        {editMode ? (
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
                                            >
                                                {saving ? (
                                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Save className="w-3 h-3" />
                                                )}
                                                Save
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setEditMode(true)}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                                            >
                                                <Edit2 className="w-3 h-3" /> Edit
                                            </button>
                                        )}
                                    </>
                                )}
                                <button
                                    onClick={() => handlePreview(selectedTemplate.id)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                                >
                                    <Eye className="w-3 h-3" /> Preview
                                </button>
                                {!selectedTemplate.is_system && (
                                    <>
                                        <button
                                            onClick={() => handleClone(selectedTemplate.id)}
                                            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(selectedTemplate.id)}
                                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="p-4 space-y-6 max-h-[500px] overflow-y-auto">
                            {editMode ? (
                                <>
                                    {/* Basic Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Template Name
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedTemplate.name}
                                                onChange={(e) => updateTemplate('name', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Type
                                            </label>
                                            <select
                                                value={selectedTemplate.template_type}
                                                onChange={(e) => updateTemplate('template_type', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 text-sm"
                                            >
                                                {TEMPLATE_TYPES.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Layout */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Layout Style
                                        </label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {LAYOUT_TYPES.map((l) => (
                                                <button
                                                    key={l.value}
                                                    type="button"
                                                    onClick={() => updateTemplate('layout_type', l.value)}
                                                    className={`p-3 rounded-lg border text-center transition-all ${selectedTemplate.layout_type === l.value ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-white/10 hover:border-slate-300'}`}
                                                >
                                                    <Layout className="w-5 h-5 mx-auto mb-1" />
                                                    <span className="text-xs font-medium">{l.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Colors */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Colors
                                        </label>
                                        <div className="grid grid-cols-4 gap-4">
                                            {['primary_color', 'secondary_color', 'text_color', 'background_color'].map(
                                                (field) => (
                                                    <div key={field}>
                                                        <label className="block text-xs text-slate-500 mb-1 capitalize">
                                                            {field.replace('_', ' ')}
                                                        </label>
                                                        <input
                                                            type="color"
                                                            value={(selectedTemplate as any)[field]}
                                                            onChange={(e) => updateTemplate(field, e.target.value)}
                                                            className="w-full h-8 rounded cursor-pointer"
                                                        />
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>

                                    {/* Display Options */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Display Options
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { field: 'show_company_info', label: 'Company Info' },
                                                { field: 'show_customer_info', label: 'Customer Info' },
                                                { field: 'show_payment_terms', label: 'Payment Terms' },
                                                { field: 'show_due_date', label: 'Due Date' },
                                                { field: 'show_tax_breakdown', label: 'Tax Breakdown' },
                                                { field: 'is_default', label: 'Set as Default' },
                                            ].map((opt) => (
                                                <label
                                                    key={opt.field}
                                                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={(selectedTemplate as any)[opt.field]}
                                                        onChange={(e) => updateTemplate(opt.field, e.target.checked)}
                                                        className="w-4 h-4 rounded"
                                                    />
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                                        {opt.label}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Defaults */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Payment Terms (days)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={selectedTemplate.payment_terms_days}
                                                onChange={(e) =>
                                                    updateTemplate('payment_terms_days', parseInt(e.target.value) || 30)
                                                }
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Currency
                                            </label>
                                            <select
                                                value={selectedTemplate.default_currency}
                                                onChange={(e) => updateTemplate('default_currency', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 text-sm"
                                            >
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="GBP">GBP</option>
                                                <option value="PLN">PLN</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                Paper Size
                                            </label>
                                            <select
                                                value={selectedTemplate.paper_size}
                                                onChange={(e) => updateTemplate('paper_size', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 text-sm"
                                            >
                                                <option value="A4">A4</option>
                                                <option value="Letter">Letter</option>
                                                <option value="Legal">Legal</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* View Mode */
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-xs text-slate-500">Type</span>
                                            <p className="font-medium">{selectedTemplate.template_type}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500">Layout</span>
                                            <p className="font-medium">{selectedTemplate.layout_type}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500">Currency</span>
                                            <p className="font-medium">{selectedTemplate.default_currency}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500">Payment Terms</span>
                                            <p className="font-medium">{selectedTemplate.payment_terms_days} days</p>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500">Colors</span>
                                        <div className="flex gap-2 mt-1">
                                            <div
                                                className="w-8 h-8 rounded"
                                                style={{ backgroundColor: selectedTemplate.primary_color }}
                                                title="Primary"
                                            />
                                            <div
                                                className="w-8 h-8 rounded"
                                                style={{ backgroundColor: selectedTemplate.secondary_color }}
                                                title="Secondary"
                                            />
                                            <div
                                                className="w-8 h-8 rounded border"
                                                style={{ backgroundColor: selectedTemplate.background_color }}
                                                title="Background"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Preview Modal */}
            {previewHtml && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setPreviewHtml('')}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-3 border-b flex items-center justify-between">
                            <span className="font-medium">Invoice Preview</span>
                            <button onClick={() => setPreviewHtml('')} className="text-slate-500 hover:text-slate-700">
                                ×
                            </button>
                        </div>
                        <iframe srcDoc={previewHtml} className="w-full h-[800px] border-0" title="Invoice Preview" />
                    </div>
                </div>
            )}

            {error && (
                <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-lg">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 font-bold">
                        ×
                    </button>
                </div>
            )}
        </div>
    );
};

export default InvoiceTemplateEditor;




