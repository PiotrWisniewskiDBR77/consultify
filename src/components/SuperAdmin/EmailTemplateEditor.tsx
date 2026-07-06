import DOMPurify from 'dompurify';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Code,
  Eye,
  History,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  Sparkles,
  Tablet,
  Type,
  Variable,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type { ContentCategory, ContentTag, EmailTemplate, EmailTemplateStatus } from '../../types';

interface EmailTemplateEditorProps {
  template: EmailTemplate | null;
  categories: ContentCategory[];
  tags: ContentTag[];
  onClose: () => void;
  onSave: () => void;
}

type ViewMode = 'html' | 'preview' | 'code';
type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

export const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  template,
  categories,
  tags,
  onClose,
  onSave,
}) => {
  const token = localStorage.getItem('token');
  const isNew = !template;

  // Form state
  const [formData, setFormData] = useState({
    templateKey: template?.templateKey || '',
    name: template?.name || '',
    description: template?.description || '',
    subject: template?.subject || '',
    htmlContent: template?.htmlContent || getDefaultHtmlTemplate(),
    textContent: template?.textContent || '',
    categoryId: template?.categoryId || '',
    languageCode: template?.languageCode || 'en',
  });

  const [availableVariables, setAvailableVariables] = useState<string[]>(
    template?.availableVariables || ['firstName', 'lastName', 'email']
  );

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('html');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [testData, setTestData] = useState<Record<string, string>>({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
  });
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');

  // Action states
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  // Test send modal
  const [showTestSend, setShowTestSend] = useState(false);
  const [testEmails, setTestEmails] = useState('');

  // Variable picker
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [newVariable, setNewVariable] = useState('');

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Generate preview
  useEffect(() => {
    const resolveVariables = (content: string) => {
      return content.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
        const value = path.split('.').reduce(
          (obj: Record<string, unknown>, key: string) => {
            return obj && (obj as Record<string, unknown>)[key] !== undefined
              ? (obj as Record<string, unknown>)[key]
              : null;
          },
          testData as Record<string, unknown>
        );
        return value !== null ? String(value) : match;
      });
    };

    setPreviewHtml(resolveVariables(formData.htmlContent));
    setPreviewSubject(resolveVariables(formData.subject));
  }, [formData.htmlContent, formData.subject, testData]);

  // Save template
  const handleSave = async () => {
    const validationErrors: string[] = [];

    if (!formData.templateKey.trim()) validationErrors.push('Template key is required');
    if (!formData.name.trim()) validationErrors.push('Name is required');
    if (!formData.subject.trim()) validationErrors.push('Subject is required');
    if (!formData.htmlContent.trim()) validationErrors.push('HTML content is required');

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors([]);

    try {
      const url = isNew
        ? '/api/content/emails/templates'
        : `/api/content/emails/templates/${template.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          availableVariables,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save template');
      }

      setSuccess('Template saved successfully!');
      setTimeout(() => {
        onSave();
      }, 1000);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
      setErrors([errorMessage]);
    } finally {
      setSaving(false);
    }
  };

  // Send test email
  const handleTestSend = async () => {
    if (!testEmails.trim()) {
      setErrors(['Please enter at least one email address']);
      return;
    }

    const emails = testEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e);

    if (emails.length === 0) {
      setErrors(['Please enter at least one valid email address']);
      return;
    }

    if (!template) {
      setErrors(['Please save the template first before sending tests']);
      return;
    }

    setSendingTest(true);
    setErrors([]);

    try {
      const res = await fetch(`/api/content/emails/templates/${template.id}/test-send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientEmails: emails,
          testData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send test email');
      }

      const result = await res.json();
      setSuccess(`Test emails sent! ${result.sent} delivered, ${result.failed} failed.`);
      setShowTestSend(false);
      setTestEmails('');
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send test email';
      setErrors([errorMessage]);
    } finally {
      setSendingTest(false);
    }
  };

  // Insert variable at cursor
  const insertVariable = (varName: string) => {
    if (editorRef.current) {
      const textarea = editorRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.htmlContent;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = `${before}{{${varName}}}${after}`;

      setFormData((prev) => ({ ...prev, htmlContent: newText }));

      // Reset cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + varName.length + 4;
        textarea.focus();
      }, 0);
    }

    setShowVariablePicker(false);
  };

  // Add new variable
  const addVariable = () => {
    if (newVariable.trim() && !availableVariables.includes(newVariable.trim())) {
      setAvailableVariables((prev) => [...prev, newVariable.trim()]);
      setTestData((prev) => ({ ...prev, [newVariable.trim()]: `{{${newVariable.trim()}}}` }));
      setNewVariable('');
    }
  };

  const getPreviewWidth = () => {
    switch (previewDevice) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      default:
        return '100%';
    }
  };

  return (
    <div className="fixed inset-0 bg-c-bg z-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle bg-c-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-white hover:bg-c-surface-raised rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-c-text">
              {isNew ? 'Create Email Template' : `Edit: ${template.name}`}
            </h1>
            {!isNew && (
              <span className="text-sm text-slate-400 dark:text-slate-500">
                v{template.version} • {template.status}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isNew && (
            <button
              onClick={() => setShowTestSend(true)}
              className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white border border-c-border-subtle rounded-lg hover:bg-c-surface-raised transition-colors"
            >
              <Send size={16} />
              Test Send
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 p-4 py-2 bg-gradient-to-r from-pink-500 to-danger-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-danger-700 transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Alerts */}
      {errors.length > 0 && (
        <div className="px-6 py-3 bg-danger-500/10 border-b border-danger-500/30">
          <div className="flex items-center gap-2 text-danger-400">
            <AlertCircle size={16} />
            <span>{errors.join(', ')}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Form */}
        <div className="w-96 border-c-border-subtle flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Basic Information
              </h3>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Template Key *
                </label>
                <input
                  type="text"
                  value={formData.templateKey}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      templateKey: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    }))
                  }
                  placeholder="welcome-email"
                  className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-mono text-sm"
                  disabled={!isNew}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Welcome Email"
                  className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Brief description of this template..."
                  rows={2}
                  className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
                />
              </div>
            </div>

            {/* Email Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Email Details
              </h3>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Subject Line *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="Welcome to {{organizationName}}, {{firstName}}!"
                  className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Use {'{{variableName}}'} for dynamic content
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/50"
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
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Language</label>
                <select
                  value={formData.languageCode}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, languageCode: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                >
                  <option value="en">English</option>
                  <option value="pl">Polish</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
            </div>

            {/* Variables */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Template Variables
              </h3>

              <div className="flex flex-wrap gap-2">
                {availableVariables.map((varName) => (
                  <button
                    key={varName}
                    onClick={() => insertVariable(varName)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary-500/10 border border-primary-500/30 text-primary-400 rounded-lg text-xs font-mono hover:bg-primary-500/20 transition-colors"
                  >
                    <Variable size={12} />
                    {varName}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVariable}
                  onChange={(e) => setNewVariable(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  placeholder="Add variable..."
                  className="flex-1 px-3 py-1.5 bg-c-text text-c-bg border border-c-border-subtle rounded-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 text-sm font-mono"
                />
                <button
                  onClick={addVariable}
                  disabled={!newVariable.trim()}
                  className="px-3 py-1.5 bg-c-surface-raised border border-c-border-subtle text-slate-300 rounded-lg hover:bg-c-surface-raised transition-colors disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Test Data */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Test Data (Preview)
              </h3>

              <div className="space-y-3">
                {availableVariables.map((varName) => (
                  <div key={varName}>
                    <label className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
                      {varName}
                    </label>
                    <input
                      type="text"
                      value={testData[varName] || ''}
                      onChange={(e) =>
                        setTestData((prev) => ({
                          ...prev,
                          [varName]: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Editor/Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View Tabs */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle bg-c-surface/50">
            <div className="flex items-center gap-1 bg-c-surface-raised/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('html')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'html'
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-white'
                }`}
              >
                <Type size={14} />
                HTML
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-white'
                }`}
              >
                <Eye size={14} />
                Preview
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'code'
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-white'
                }`}
              >
                <Code size={14} />
                Code
              </button>
            </div>

            {viewMode === 'preview' && (
              <div className="flex items-center gap-1 bg-c-surface-raised/50 rounded-lg p-1">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-2 rounded-md transition-colors ${
                    previewDevice === 'desktop'
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'text-slate-400 dark:text-slate-500 hover:text-white'
                  }`}
                  title="Desktop"
                >
                  <Monitor size={14} />
                </button>
                <button
                  onClick={() => setPreviewDevice('tablet')}
                  className={`p-2 rounded-md transition-colors ${
                    previewDevice === 'tablet'
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'text-slate-400 dark:text-slate-500 hover:text-white'
                  }`}
                  title="Tablet"
                >
                  <Tablet size={14} />
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-2 rounded-md transition-colors ${
                    previewDevice === 'mobile'
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'text-slate-400 dark:text-slate-500 hover:text-white'
                  }`}
                  title="Mobile"
                >
                  <Smartphone size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Editor Content */}
          <div className="flex-1 overflow-hidden">
            {viewMode === 'html' && (
              <div className="h-full flex flex-col">
                <textarea
                  ref={editorRef}
                  value={formData.htmlContent}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, htmlContent: e.target.value }))
                  }
                  className="flex-1 w-full p-4 bg-c-bg text-slate-300 font-mono text-sm resize-none focus:outline-none"
                  placeholder="Enter your HTML email content here..."
                  spellCheck={false}
                />
              </div>
            )}

            {viewMode === 'preview' && (
              <div className="h-full overflow-auto bg-slate-200 dark:bg-navy-700/50 p-4">
                <div
                  className="mx-auto bg-white dark:bg-navy-900 shadow-lg rounded-lg overflow-hidden"
                  style={{ maxWidth: getPreviewWidth() }}
                >
                  {/* Subject preview */}
                  <div className="px-4 py-3 bg-slate-100 dark:bg-navy-800/40 border-b border-slate-200 dark:border-navy-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Subject:</div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {previewSubject || '(no subject)'}
                    </div>
                  </div>
                  {/* Email body */}
                  <div
                    className="email-preview"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
                  />
                </div>
              </div>
            )}

            {viewMode === 'code' && (
              <div className="h-full overflow-auto p-4 bg-c-bg">
                <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
                  {formData.htmlContent}
                </pre>
              </div>
            )}
          </div>

          {/* Plain Text (optional) */}
          <div className="border-t border-c-border-subtle">
            <details className="group">
              <summary className="px-4 py-3 text-sm font-medium text-slate-400 dark:text-slate-500 cursor-pointer hover:text-white flex items-center gap-2">
                <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
                Plain Text Version (optional)
              </summary>
              <div className="px-4 pb-4">
                <textarea
                  value={formData.textContent}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, textContent: e.target.value }))
                  }
                  className="w-full h-32 p-3 bg-c-text text-c-bg border border-c-border-subtle rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  placeholder="Plain text fallback for email clients that don't support HTML..."
                />
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Test Send Modal */}
      {showTestSend && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-c-surface border border-c-border-subtle rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-c-text mb-4">Send Test Email</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Recipient Email(s)
                </label>
                <textarea
                  value={testEmails}
                  onChange={(e) => setTestEmails(e.target.value)}
                  placeholder="Enter email addresses (comma-separated)"
                  rows={3}
                  className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              <p className="text-sm text-slate-400 dark:text-slate-500">
                The email will be sent with [TEST] prefix in the subject line.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTestSend(false)}
                className="px-4 py-2 text-slate-400 dark:text-slate-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTestSend}
                disabled={sendingTest || !testEmails.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-danger-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-danger-700 transition-all disabled:opacity-50"
              >
                {sendingTest ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {sendingTest ? 'Sending...' : 'Send Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Default HTML template for new emails
function getDefaultHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #6366F1 0%, #6366F1 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Email Title</h1>
        </div>
        <div style="background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <p style="font-size: 16px; color: #1F2937; margin-bottom: 24px;">Hi <strong>{{firstName}}</strong>,</p>
            <p style="margin-bottom: 24px;">Your email content goes here...</p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="{{actionUrl}}" style="display: inline-block; background: linear-gradient(135deg, #6366F1 0%, #6366F1 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Call to Action</a>
            </div>
            <p style="margin-top: 24px;">Best regards,<br><strong>The Team</strong></p>
        </div>
        <div style="text-align: center; padding: 24px; color: #9CA3AF; font-size: 12px;">
            <p style="margin: 0;">© 2025 Your Company. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
}

export default EmailTemplateEditor;
