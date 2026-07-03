/**
 * EmailSignatureSettings - Manage email signatures
 *
 * Features:
 * - Create multiple signatures
 * - Rich text editing
 * - Set default signature
 * - Preview
 */

import {
  AlertCircle,
  Check,
  Copy,
  Edit2,
  Eye,
  FileText,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface EmailSignatureSettingsProps {
  currentUser: User;
}

interface EmailSignature {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
}

export const EmailSignatureSettings: React.FC<EmailSignatureSettingsProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // New/Edit form state
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadSignatures();
  }, []);

  const loadSignatures = async () => {
    setLoading(true);
    try {
      const response = await Api.get('/api/settings/signatures');
      setSignatures(response.signatures || []);
    } catch (error) {
      console.error('Failed to load signatures:', error);
      // Use empty array
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormName('');
    setFormContent(getDefaultTemplate());
  };

  const handleEdit = (signature: EmailSignature) => {
    setEditingId(signature.id);
    setIsCreating(false);
    setFormName(signature.name);
    setFormContent(signature.content);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormName('');
    setFormContent('');
  };

  const handleSave = async () => {
    if (!formName.trim() || !formContent.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        const response = await Api.post('/api/settings/signatures', {
          name: formName,
          content: formContent,
          isDefault: signatures.length === 0,
        });
        setSignatures([...signatures, response.signature]);
        toast.success('Signature created');
      } else if (editingId) {
        await Api.put(`/api/settings/signatures/${editingId}`, {
          name: formName,
          content: formContent,
        });
        setSignatures(
          signatures.map((s) =>
            s.id === editingId ? { ...s, name: formName, content: formContent } : s
          )
        );
        toast.success('Signature updated');
      }
      handleCancel();
    } catch (error) {
      toast.error('Failed to save signature');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this signature?')) return;

    try {
      await Api.delete(`/api/settings/signatures/${id}`);
      setSignatures(signatures.filter((s) => s.id !== id));
      toast.success('Signature deleted');
    } catch (error) {
      toast.error('Failed to delete signature');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await Api.put(`/api/settings/signatures/${id}/default`, {});
      setSignatures(
        signatures.map((s) => ({
          ...s,
          isDefault: s.id === id,
        }))
      );
      toast.success('Default signature updated');
    } catch (error) {
      toast.error('Failed to set default');
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content.replace(/<[^>]*>/g, ''));
    toast.success('Copied to clipboard');
  };

  const getDefaultTemplate = () => {
    return `Best regards,
${currentUser.firstName} ${currentUser.lastName}
${currentUser.jobTitle || 'Team Member'}
${currentUser.companyName || ''}

${currentUser.phone ? `📞 ${currentUser.phone}` : ''}
${currentUser.email ? `✉️ ${currentUser.email}` : ''}`;
  };

  // Styles
  const cardClass =
    'bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl';
  const inputClass =
    'w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none transition-all';
  const textareaClass =
    'w-full px-4 py-3 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none transition-all resize-none font-mono text-sm';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {t('settings.signature.title', 'Email Signatures')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('settings.signature.description', 'Create and manage your email signatures')}
            </p>
          </div>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            New Signature
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className={cardClass + ' p-6'}>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            {isCreating ? 'Create New Signature' : 'Edit Signature'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Signature Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Default, Formal, Casual"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Signature Content
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={10}
                className={textareaClass}
                placeholder="Enter your signature..."
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Tip: You can use emojis and basic formatting. HTML is not supported.
              </p>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Preview
              </label>
              <div className="p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-navy-700">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans">
                  {formContent || 'Your signature will appear here...'}
                </pre>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Signature'}
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-2 bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signatures List */}
      {signatures.length === 0 && !isCreating ? (
        <div className={cardClass + ' p-8 text-center'}>
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No signatures yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Create your first email signature to use across your communications.
          </p>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
          >
            <Plus size={16} />
            Create First Signature
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {signatures.map((signature) => (
            <div key={signature.id} className={cardClass + ' overflow-hidden'}>
              {/* Header */}
              <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-navy-700">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {signature.name}
                  </span>
                  {signature.isDefault && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full flex items-center gap-1">
                      <Star size={12} />
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewId(previewId === signature.id ? null : signature.id)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    title="Preview"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleCopy(signature.content)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    title="Copy"
                  >
                    <Copy size={16} />
                  </button>
                  {!signature.isDefault && (
                    <button
                      onClick={() => handleSetDefault(signature.id)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="Set as default"
                    >
                      <Star size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(signature)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(signature.id)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              {previewId === signature.id && (
                <div className="p-4 bg-slate-50 dark:bg-navy-950/50">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans">
                    {signature.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/30">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Tips for effective signatures:</strong>
            </p>
            <ul className="text-sm text-blue-600 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
              <li>Keep it concise - include only essential contact information</li>
              <li>Use a consistent format across all your signatures</li>
              <li>Include your role and company for professional context</li>
              <li>Add relevant social links or portfolio URLs if appropriate</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailSignatureSettings;
