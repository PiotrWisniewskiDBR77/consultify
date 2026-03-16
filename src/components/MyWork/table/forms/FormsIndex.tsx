/**
 * FormsIndex — Index page showing all forms for a table.
 * Card grid with status, share links, and CRUD operations.
 */
import {
  Check,
  ClipboardCopy,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Lock,
  Plus,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type { TablePlatformField } from '@/types/tablePlatform';

import FormBuilder from '../FormBuilder';

// ── Types ────────────────────────────────────────────────────────────────────

interface FormRecord {
  id: string;
  table_id: string;
  name: string;
  description: string | null;
  slug: string;
  is_published: boolean;
  config: {
    fields: any[];
    submitMessage?: string;
    redirectUrl?: string;
    allowMultiple?: boolean;
    requireAuth?: boolean;
  };
  submit_count: number;
  created_at?: string;
}

type ShareMode = 'public' | 'organization' | 'authenticated';

export interface FormsIndexProps {
  tableId: string;
  tableFields: TablePlatformField[];
  locked?: boolean;
  baseUrl?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FormsIndex({ tableId, tableFields, locked, baseUrl = window.location.origin }: FormsIndexProps) {
  const { t } = useTranslation();

  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingForm, setEditingForm] = useState<FormRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TablePlatformApi.listForms(tableId);
      setForms(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t('formsIndex.loadError', 'Failed to load forms'));
    } finally {
      setLoading(false);
    }
  }, [tableId, t]);

  useEffect(() => { loadForms(); }, [loadForms]);

  const handleCreate = useCallback(async () => {
    try {
      const slug = `form-${tableId.slice(0, 8)}-${Date.now().toString(36)}`;
      const created = await TablePlatformApi.createForm(tableId, {
        name: t('formsIndex.newFormName', 'New Form'),
        slug,
      });
      if (created) {
        setEditingForm(created);
        await loadForms();
      }
    } catch {
      toast.error(t('formsIndex.createError', 'Failed to create form'));
    }
  }, [tableId, loadForms, t]);

  const handleDelete = useCallback(async (formId: string) => {
    try {
      await TablePlatformApi.deleteForm(formId);
      setForms((prev) => prev.filter((f) => f.id !== formId));
      setDeleteConfirm(null);
      toast.success(t('formsIndex.deleted', 'Form deleted'));
    } catch {
      toast.error(t('formsIndex.deleteError', 'Failed to delete form'));
    }
  }, [t]);

  const handleCopyLink = useCallback((slug: string, formId: string) => {
    navigator.clipboard.writeText(`${baseUrl}/forms/${slug}`);
    setCopiedId(formId);
    setTimeout(() => setCopiedId(null), 2000);
  }, [baseUrl]);

  const handleShareModeChange = useCallback(async (form: FormRecord, mode: ShareMode) => {
    try {
      await TablePlatformApi.updateForm(form.id, {
        is_published: mode !== 'authenticated' || form.is_published,
        config: {
          ...form.config,
          requireAuth: mode === 'authenticated',
        },
      });
      await loadForms();
      setShareMenuId(null);
      toast.success(t('formsIndex.shareUpdated', 'Sharing updated'));
    } catch {
      toast.error(t('formsIndex.shareError', 'Failed to update sharing'));
    }
  }, [loadForms, t]);

  const getShareMode = (form: FormRecord): ShareMode => {
    if (form.config?.requireAuth) return 'authenticated';
    if (form.is_published) return 'public';
    return 'organization';
  };

  const getStatusLabel = (form: FormRecord) => {
    if (form.is_published) return { label: t('formsIndex.active', 'Active'), color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    return { label: t('formsIndex.draft', 'Draft'), color: 'bg-gray-100 text-gray-600 dark:bg-navy-800 dark:text-gray-400' };
  };

  // ── Editing mode ───────────────────────────────────────────────────────────

  if (editingForm) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2 dark:border-navy-700">
          <button
            onClick={() => { setEditingForm(null); loadForms(); }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-navy-800"
          >
            &larr; {t('formsIndex.backToList', 'Back to forms')}
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <FormBuilder
            form={editingForm}
            tableFields={tableFields}
            onSave={async (updates) => {
              if (editingForm.id) {
                await TablePlatformApi.updateForm(editingForm.id, updates);
              } else {
                const created = await TablePlatformApi.createForm(tableId, {
                  name: updates.name ?? 'New Form',
                  description: updates.description,
                  slug: updates.slug,
                  config: updates.config,
                });
                if (created) setEditingForm(created);
              }
              toast.success(t('formsIndex.saved', 'Form saved'));
            }}
            onDelete={async () => {
              if (editingForm.id) {
                await TablePlatformApi.deleteForm(editingForm.id);
              }
              setEditingForm(null);
              loadForms();
            }}
            baseUrl={baseUrl}
          />
        </div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 rounded-2xl bg-purple-50 p-4 dark:bg-purple-900/20">
          <FileText className="h-10 w-10 text-purple-500" />
        </div>
        <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
          {t('formsIndex.emptyTitle', 'Create a form to collect data')}
        </h3>
        <p className="mb-6 max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
          {t('formsIndex.emptyDescription', 'Forms let you collect structured data from anyone — no login required for public forms.')}
        </p>
        {!locked && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            {t('formsIndex.createForm', 'Create Form')}
          </button>
        )}
      </div>
    );
  }

  // ── Card grid ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('formsIndex.title', 'Forms')}
        </h2>
        {!locked && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            {t('formsIndex.createForm', 'Create Form')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => {
          const status = getStatusLabel(form);
          const shareMode = getShareMode(form);

          return (
            <div
              key={form.id}
              className="group relative rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-navy-700 dark:bg-navy-800"
            >
              {/* Status badge */}
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {form.submit_count} {t('formsIndex.responses', 'responses')}
                </span>
              </div>

              {/* Name */}
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                {form.name}
              </h3>
              {form.description && (
                <p className="mb-3 text-xs text-gray-500 line-clamp-2 dark:text-gray-400">
                  {form.description}
                </p>
              )}

              {/* Created date */}
              {form.created_at && (
                <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
                  {t('formsIndex.created', 'Created')}{' '}
                  {new Date(form.created_at).toLocaleDateString()}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Share link */}
                {form.is_published && (
                  <button
                    onClick={() => handleCopyLink(form.slug, form.id)}
                    className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-navy-700 dark:text-gray-300 dark:hover:bg-navy-600"
                  >
                    {copiedId === form.id ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <ClipboardCopy className="h-3 w-3" />
                    )}
                    {copiedId === form.id
                      ? t('formsIndex.copied', 'Copied!')
                      : t('formsIndex.copyLink', 'Copy Link')}
                  </button>
                )}

                {/* Share mode */}
                <div className="relative">
                  <button
                    onClick={() => setShareMenuId(shareMenuId === form.id ? null : form.id)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-navy-700"
                    title={t('formsIndex.sharing', 'Sharing')}
                  >
                    {shareMode === 'public' && <Globe className="h-3.5 w-3.5" />}
                    {shareMode === 'organization' && <Users className="h-3.5 w-3.5" />}
                    {shareMode === 'authenticated' && <Shield className="h-3.5 w-3.5" />}
                  </button>

                  {shareMenuId === form.id && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-navy-700 dark:bg-navy-800">
                      {([
                        { mode: 'public' as ShareMode, icon: Globe, label: t('formsIndex.sharePublic', 'Public') },
                        { mode: 'organization' as ShareMode, icon: Users, label: t('formsIndex.shareOrg', 'Organization only') },
                        { mode: 'authenticated' as ShareMode, icon: Lock, label: t('formsIndex.shareAuth', 'Authenticated users') },
                      ]).map(({ mode, icon: Icon, label }) => (
                        <button
                          key={mode}
                          onClick={() => handleShareModeChange(form, mode)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-gray-50 dark:hover:bg-navy-700 ${
                            shareMode === mode ? 'font-medium text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                          {shareMode === mode && <Check className="ml-auto h-3 w-3" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Preview */}
                {form.is_published && (
                  <a
                    href={`${baseUrl}/forms/${form.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-navy-700"
                    title={t('formsIndex.preview', 'Preview')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                <div className="flex-1" />

                {/* Edit */}
                <button
                  onClick={() => setEditingForm(form)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  {t('formsIndex.edit', 'Edit')}
                </button>

                {/* Delete */}
                {!locked && (
                  <>
                    {deleteConfirm === form.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(form.id)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          {t('formsIndex.confirmDelete', 'Confirm')}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-navy-700"
                        >
                          {t('formsIndex.cancel', 'Cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(form.id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        title={t('formsIndex.delete', 'Delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FormsIndex;
