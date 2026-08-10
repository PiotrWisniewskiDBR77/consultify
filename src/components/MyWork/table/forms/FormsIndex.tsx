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
  KeyRound,
  Lock,
  Plus,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState } from '@/components/ui/primitives';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type { TablePlatformField } from '@/types/tablePlatform';
import { isTabeleFormIntakeEnabled } from '@/utils/tabeleFormIntakeFlag';

import FormBuilder from '../FormBuilder';
import { IntakeJwtPanel } from './IntakeJwtPanel';

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

export function FormsIndex({
  tableId,
  tableFields,
  locked,
  baseUrl = window.location.origin,
}: FormsIndexProps) {
  const { t } = useTranslation();

  const [forms, setForms] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingForm, setEditingForm] = useState<FormRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [intakeFormId, setIntakeFormId] = useState<string | null>(null);
  const intakeEnabled = isTabeleFormIntakeEnabled();

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

  useEffect(() => {
    loadForms();
  }, [loadForms]);

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

  // Program B (E02) — klik człowieka = `ctx.params.run` (rejestr wykonuje
  // ORYGINALNY callback wprost); Teresa = ta sama funkcja rejestru woła REST
  // bezpośrednio (`runTableFormDeleteCallback` w `ideaActionRegistry.ts`).
  const handleDelete = useCallback(
    (formId: string) => {
      const ctx: ActionContext = {
        ideaId: tableId,
        tool: 'table',
        selection: EMPTY_SELECTION,
        surface: 'panel',
        source: 'ui',
        params: {
          formId,
          run: async () => {
            try {
              await TablePlatformApi.deleteForm(formId);
              setForms((prev) => prev.filter((f) => f.id !== formId));
              setDeleteConfirm(null);
              toast.success(t('formsIndex.deleted', 'Form deleted'));
            } catch {
              toast.error(t('formsIndex.deleteError', 'Failed to delete form'));
            }
          },
        },
      };
      void runIdeaAction('table.form.delete', ctx);
    },
    [t, tableId]
  );

  const handleCopyLink = useCallback(
    (slug: string, formId: string) => {
      navigator.clipboard.writeText(`${baseUrl}/forms/${slug}`);
      setCopiedId(formId);
      setTimeout(() => setCopiedId(null), 2000);
    },
    [baseUrl]
  );

  // Program B (E02) — klik człowieka = `ctx.params.run` (rejestr wykonuje
  // ORYGINALNY callback wprost); Teresa = ta sama funkcja rejestru pobiera
  // bieżący rekord formularza (nie ma lokalnego stanu `forms`) i woła REST
  // (`runTableFormShareModeChangeCallback` w `ideaActionRegistry.ts`).
  const handleShareModeChange = useCallback(
    (form: FormRecord, mode: ShareMode) => {
      const ctx: ActionContext = {
        ideaId: tableId,
        tool: 'table',
        selection: EMPTY_SELECTION,
        surface: 'panel',
        source: 'ui',
        params: {
          formId: form.id,
          mode,
          run: async () => {
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
          },
        },
      };
      void runIdeaAction('table.form.share_mode_change', ctx);
    },
    [loadForms, t, tableId]
  );

  const getShareMode = (form: FormRecord): ShareMode => {
    if (form.config?.requireAuth) return 'authenticated';
    if (form.is_published) return 'public';
    return 'organization';
  };

  const getStatusLabel = (form: FormRecord) => {
    if (form.is_published)
      return {
        label: t('formsIndex.active', 'Active'),
        color: 'bg-c-success text-c-success bg-c-success text-c-success',
      };
    return {
      label: t('formsIndex.draft', 'Draft'),
      color: 'bg-c-surface-raised text-c-text-secondary bg-c-surface-raised text-c-text-muted',
    };
  };

  // ── Editing mode ───────────────────────────────────────────────────────────

  if (editingForm) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-c-border-subtle px-4 py-2 border-c-border-subtle">
          <button
            onClick={() => {
              setEditingForm(null);
              loadForms();
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised"
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
    return <LoadingState variant="spinner" className="py-20" />;
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (forms.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title={t('formsIndex.emptyTitle', 'Create a form to collect data')}
        description={t(
          'formsIndex.emptyDescription',
          'Forms let you collect structured data from anyone — no login required for public forms.'
        )}
        action={
          !locked
            ? {
                label: t('formsIndex.createForm', 'Create Form'),
                onClick: handleCreate,
              }
            : undefined
        }
      />
    );
  }

  // ── Card grid ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-c-text">{t('formsIndex.title', 'Forms')}</h2>
        {!locked && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 rounded-xl bg-c-text px-4 py-2 text-sm font-medium text-c-surface transition-colors hover:opacity-90"
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
              className="group relative rounded-2xl border border-c-border-subtle bg-c-surface p-5 transition-shadow hover:shadow-md border-c-border-subtle bg-c-surface-raised"
            >
              {/* Status badge */}
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
                <span className="text-xs text-c-text-muted">
                  {form.submit_count} {t('formsIndex.responses', 'responses')}
                </span>
              </div>

              {/* Name */}
              <h3 className="mb-1 text-sm font-semibold text-c-text">{form.name}</h3>
              {form.description && (
                <p className="mb-3 text-xs text-c-text-muted line-clamp-2 text-c-text-muted">
                  {form.description}
                </p>
              )}

              {/* Created date */}
              {form.created_at && (
                <p className="mb-4 text-xs text-c-text-muted">
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
                    className="flex items-center gap-1 rounded-lg bg-c-surface-raised px-2.5 py-1.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised"
                  >
                    {copiedId === form.id ? (
                      <Check className="h-3 w-3 text-c-success" />
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
                    className="rounded-lg p-1.5 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text-secondary hover:bg-c-surface-raised"
                    title={t('formsIndex.sharing', 'Sharing')}
                  >
                    {shareMode === 'public' && <Globe className="h-3.5 w-3.5" />}
                    {shareMode === 'organization' && <Users className="h-3.5 w-3.5" />}
                    {shareMode === 'authenticated' && <Shield className="h-3.5 w-3.5" />}
                  </button>

                  {shareMenuId === form.id && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-c-border-subtle bg-c-surface py-1 shadow-lg border-c-border-subtle bg-c-surface-raised">
                      {[
                        {
                          mode: 'public' as ShareMode,
                          icon: Globe,
                          label: t('formsIndex.sharePublic', 'Public'),
                        },
                        {
                          mode: 'organization' as ShareMode,
                          icon: Users,
                          label: t('formsIndex.shareOrg', 'Organization only'),
                        },
                        {
                          mode: 'authenticated' as ShareMode,
                          icon: Lock,
                          label: t('formsIndex.shareAuth', 'Authenticated users'),
                        },
                      ].map(({ mode, icon: Icon, label }) => (
                        <button
                          key={mode}
                          onClick={() => handleShareModeChange(form, mode)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-c-surface-raised ${
                            shareMode === mode ? 'font-medium text-c-text' : 'text-c-text-muted'
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
                    className="rounded-lg p-1.5 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text-secondary hover:bg-c-surface-raised"
                    title={t('formsIndex.preview', 'Preview')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                {/* Manage intake (private JWT links) — gated by Tabele form-intake flag */}
                {intakeEnabled && (
                  <button
                    onClick={() => setIntakeFormId(form.id)}
                    className="rounded-lg p-1.5 text-c-text-secondary transition-colors hover:bg-c-success hover:text-c-success hover:bg-c-success hover:text-c-success"
                    title={t('formsIndex.manageIntake', 'Manage intake (private link)')}
                    data-testid={`forms-index-manage-intake-${form.id}`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                )}

                <div className="flex-1" />

                {/* Edit */}
                <button
                  onClick={() => setEditingForm(form)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-c-info transition-colors hover:bg-c-info text-c-info hover:bg-c-info"
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
                          className="rounded-lg px-2 py-1 text-xs font-medium text-c-danger transition-colors hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)]"
                        >
                          {t('formsIndex.confirmDelete', 'Confirm')}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="rounded-lg px-2 py-1 text-xs text-c-text-muted transition-colors hover:bg-c-surface-raised"
                        >
                          {t('formsIndex.cancel', 'Cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(form.id)}
                        className="rounded-lg p-1.5 text-c-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] hover:text-c-danger dark:hover:bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)]"
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

      {intakeFormId
        ? (() => {
            const form = forms.find((f) => f.id === intakeFormId);
            if (!form) return null;
            const configuredFields = (form.config?.fields ?? [])
              .map((fc: any) => {
                const fieldId = String(fc?.fieldId ?? '');
                if (!fieldId) return null;
                const platformField = tableFields.find((tf) => tf.id === fieldId);
                return {
                  fieldId,
                  label: String(fc?.label ?? platformField?.name ?? fieldId),
                };
              })
              .filter((entry): entry is { fieldId: string; label: string } => entry != null);
            return (
              <IntakeJwtPanel
                formId={form.id}
                configuredFields={configuredFields}
                baseUrl={baseUrl}
                onClose={() => setIntakeFormId(null)}
              />
            );
          })()
        : null}
    </div>
  );
}

export default FormsIndex;
