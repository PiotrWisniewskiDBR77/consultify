/**
 * FormBuilder — Drag-and-drop form builder for Table Platform forms.
 * Allows configuring field visibility, ordering, validation, and form settings.
 */

import {
  AlignLeft,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  GripVertical,
  Hash,
  Link2,
  List,
  Loader2,
  Mail,
  Paperclip,
  Percent,
  Phone,
  Save,
  Trash2,
  Type,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FieldType, TablePlatformField } from '@/types/tablePlatform';

// ── Types ────────────────────────────────────────────────────────────────────

interface ConditionalVisibility {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty';
  value?: unknown;
}

interface FormFieldConfig {
  fieldId: string;
  label?: string;
  required?: boolean;
  helpText?: string;
  defaultValue?: unknown;
  hidden?: boolean;
  conditionalVisibility?: ConditionalVisibility;
}

interface FormConfig {
  fields: FormFieldConfig[];
  submitMessage?: string;
  redirectUrl?: string;
  allowMultiple?: boolean;
  requireAuth?: boolean;
  notificationEmail?: string;
  styling?: Record<string, unknown>;
}

interface FormData {
  id: string;
  table_id: string;
  name: string;
  description: string | null;
  slug: string;
  is_published: boolean;
  config: FormConfig;
  submit_count: number;
}

export interface FormBuilderProps {
  form: FormData;
  tableFields: TablePlatformField[];
  onSave: (updates: {
    name?: string;
    description?: string;
    slug?: string;
    is_published?: boolean;
    config?: Partial<FormConfig>;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  baseUrl?: string;
}

// ── Field type icons ─────────────────────────────────────────────────────────

const FIELD_TYPE_ICON: Record<string, React.ReactNode> = {
  singleLineText: <Type className="h-4 w-4" />,
  longText: <AlignLeft className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  currency: <DollarSign className="h-4 w-4" />,
  percent: <Percent className="h-4 w-4" />,
  checkbox: <CheckSquare className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  singleSelect: <List className="h-4 w-4" />,
  multiSelect: <List className="h-4 w-4" />,
  url: <Globe className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  attachment: <Paperclip className="h-4 w-4" />,
  linkedRecord: <Link2 className="h-4 w-4" />,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function FormBuilder({
  form,
  tableFields,
  onSave,
  onDelete,
  baseUrl = window.location.origin,
}: FormBuilderProps) {
  const { t } = useTranslation();

  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description ?? '');
  const [slug, setSlug] = useState(form.slug);
  const [isPublished, setIsPublished] = useState(form.is_published);
  const [submitMessage, setSubmitMessage] = useState(
    form.config?.submitMessage ?? 'Thank you for your submission!'
  );
  const [redirectUrl, setRedirectUrl] = useState(form.config?.redirectUrl ?? '');
  const [allowMultiple, setAllowMultiple] = useState(form.config?.allowMultiple ?? true);
  const [requireAuth, setRequireAuth] = useState(form.config?.requireAuth ?? false);
  const [notificationEmail, setNotificationEmail] = useState(form.config?.notificationEmail ?? '');

  const [fieldConfigs, setFieldConfigs] = useState<FormFieldConfig[]>(() => {
    const existing = form.config?.fields ?? [];
    const existingMap = new Map(existing.map((f) => [f.fieldId, f]));
    return tableFields
      .filter((f) => !isComputedField(f.fieldType))
      .map((f) => existingMap.get(f.id) ?? { fieldId: f.id, required: false, hidden: false });
  });

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'settings' | 'preview'>('fields');

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fieldMap = useMemo(() => new Map(tableFields.map((f) => [f.id, f])), [tableFields]);

  const publicUrl = `${baseUrl}/forms/${slug}`;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        name,
        description: description || undefined,
        slug,
        is_published: isPublished,
        config: {
          fields: fieldConfigs,
          submitMessage,
          redirectUrl: redirectUrl || undefined,
          allowMultiple,
          requireAuth,
          notificationEmail: notificationEmail || undefined,
        },
      });
    } finally {
      setSaving(false);
    }
  }, [
    name,
    description,
    slug,
    isPublished,
    fieldConfigs,
    submitMessage,
    redirectUrl,
    allowMultiple,
    requireAuth,
    notificationEmail,
    onSave,
  ]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [publicUrl]);

  const updateFieldConfig = useCallback((fieldId: string, updates: Partial<FormFieldConfig>) => {
    setFieldConfigs((prev) =>
      prev.map((fc) => (fc.fieldId === fieldId ? { ...fc, ...updates } : fc))
    );
  }, []);

  const moveField = useCallback((fromIdx: number, toIdx: number) => {
    setFieldConfigs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback(
    (idx: number) => {
      if (dragIdx !== null && dragIdx !== idx) {
        moveField(dragIdx, idx);
      }
      setDragIdx(null);
      setDragOverIdx(null);
    },
    [dragIdx, moveField]
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  return (
    <div className="flex h-full flex-col bg-c-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-c-border-subtle px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-c-text">
            {t('formBuilder.title', 'Form Builder')}
          </h2>
          <span className="text-sm text-c-text-muted">
            {form.submit_count} {t('formBuilder.submissions', 'submissions')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Publish toggle */}
          <button
            onClick={() => setIsPublished(!isPublished)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isPublished
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-c-surface-raised text-c-text-secondary'
            }`}
          >
            {isPublished
              ? t('formBuilder.published', 'Published')
              : t('formBuilder.draft', 'Draft')}
          </button>

          {/* Share button */}
          {isPublished && (
            <button
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 rounded-lg bg-c-surface-raised px-3 py-1.5 text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised/80"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <ClipboardCopy className="h-3.5 w-3.5" />
              )}
              {copied
                ? t('formBuilder.copied', 'Copied!')
                : t('formBuilder.shareLink', 'Share link')}
            </button>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {t('formBuilder.save', 'Save')}
          </button>

          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-lg p-1.5 text-c-text-secondary transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/20"
              title={t('formBuilder.delete', 'Delete form')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-c-border-subtle px-6">
        {(['fields', 'settings', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-c-text-muted hover:text-c-text'
            }`}
          >
            {tab === 'fields' && t('formBuilder.tabFields', 'Fields')}
            {tab === 'settings' && t('formBuilder.tabSettings', 'Settings')}
            {tab === 'preview' && t('formBuilder.tabPreview', 'Preview')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'fields' && (
          <FieldListPanel
            fieldConfigs={fieldConfigs}
            fieldMap={fieldMap}
            onUpdate={updateFieldConfig}
            onMoveUp={(idx) => {
              if (idx > 0) moveField(idx, idx - 1);
            }}
            onMoveDown={(idx) => {
              if (idx < fieldConfigs.length - 1) moveField(idx, idx + 1);
            }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            dragIdx={dragIdx}
            dragOverIdx={dragOverIdx}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            name={name}
            description={description}
            slug={slug}
            submitMessage={submitMessage}
            redirectUrl={redirectUrl}
            notificationEmail={notificationEmail}
            allowMultiple={allowMultiple}
            requireAuth={requireAuth}
            publicUrl={publicUrl}
            isPublished={isPublished}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onSlugChange={setSlug}
            onSubmitMessageChange={setSubmitMessage}
            onRedirectUrlChange={setRedirectUrl}
            onNotificationEmailChange={setNotificationEmail}
            onAllowMultipleChange={setAllowMultiple}
            onRequireAuthChange={setRequireAuth}
          />
        )}

        {activeTab === 'preview' && (
          <FormPreview
            name={name}
            description={description}
            fieldConfigs={fieldConfigs}
            fieldMap={fieldMap}
            submitMessage={submitMessage}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function isComputedField(fieldType: FieldType | string): boolean {
  return [
    'createdTime',
    'createdBy',
    'lastModifiedTime',
    'lastModifiedBy',
    'autoNumber',
    'formula',
    'count',
    'lookup',
    'rollup',
  ].includes(fieldType);
}

interface FieldListPanelProps {
  fieldConfigs: FormFieldConfig[];
  fieldMap: Map<string, TablePlatformField>;
  onUpdate: (fieldId: string, updates: Partial<FormFieldConfig>) => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (idx: number) => void;
  onDragEnd: () => void;
  dragIdx: number | null;
  dragOverIdx: number | null;
}

function FieldListPanel({
  fieldConfigs,
  fieldMap,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragIdx,
  dragOverIdx,
}: FieldListPanelProps) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="mb-4 text-sm text-c-text-muted">
        {t(
          'formBuilder.fieldListHint',
          'Drag to reorder. Toggle visibility and configure each field.'
        )}
      </p>
      {fieldConfigs.map((fc, idx) => {
        const field = fieldMap.get(fc.fieldId);
        if (!field) return null;
        const isExpanded = expandedId === fc.fieldId;
        const isDragging = dragIdx === idx;
        const isDragOver = dragOverIdx === idx;

        return (
          <div
            key={fc.fieldId}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDrop={() => onDrop(idx)}
            onDragEnd={onDragEnd}
            className={`rounded-xl border transition-all ${
              isDragging
                ? 'opacity-50'
                : isDragOver
                  ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
                  : fc.hidden
                    ? 'border-c-border-subtle bg-c-surface-raised'
                    : 'border-c-border-subtle bg-c-surface'
            }`}
          >
            {/* Field row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp(idx);
                  }}
                  disabled={idx === 0}
                  className="rounded p-0.5 text-c-text-secondary transition-colors hover:text-c-text-secondary disabled:opacity-30"
                  title={t('formBuilder.moveUp', 'Move up')}
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown(idx);
                  }}
                  disabled={idx === fieldConfigs.length - 1}
                  className="rounded p-0.5 text-c-text-secondary transition-colors hover:text-c-text-secondary disabled:opacity-30"
                  title={t('formBuilder.moveDown', 'Move down')}
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-c-text-secondary" />
              <span className="shrink-0 text-c-text-muted">
                {FIELD_TYPE_ICON[field.fieldType] ?? <Type className="h-4 w-4" />}
              </span>
              <span
                className={`flex-1 text-sm font-medium ${
                  fc.hidden ? 'text-c-text-secondary line-through' : 'text-c-text'
                }`}
              >
                {fc.label || field.name}
              </span>

              {/* Required toggle */}
              <button
                onClick={() => onUpdate(fc.fieldId, { required: !fc.required })}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  fc.required
                    ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
                    : 'bg-c-surface-raised text-c-text-muted'
                }`}
                title={t('formBuilder.toggleRequired', 'Toggle required')}
              >
                {fc.required
                  ? t('formBuilder.required', 'Required')
                  : t('formBuilder.optional', 'Optional')}
              </button>

              {/* Visibility toggle */}
              <button
                onClick={() => onUpdate(fc.fieldId, { hidden: !fc.hidden })}
                className="rounded p-1 text-c-text-secondary transition-colors hover:text-c-text-secondary"
                title={
                  fc.hidden
                    ? t('formBuilder.showField', 'Show field')
                    : t('formBuilder.hideField', 'Hide field')
                }
              >
                {fc.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>

              {/* Expand/collapse */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : fc.fieldId)}
                className="rounded p-1 text-c-text-secondary transition-colors hover:text-c-text-secondary"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Expanded config */}
            {isExpanded && (
              <div className="border-t border-c-border-subtle px-4 py-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                      {t('formBuilder.customLabel', 'Custom label')}
                    </label>
                    <input
                      type="text"
                      value={fc.label ?? ''}
                      onChange={(e) => onUpdate(fc.fieldId, { label: e.target.value || undefined })}
                      placeholder={field.name}
                      className="w-full rounded-lg border border-c-border-subtle px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                      {t('formBuilder.helpText', 'Help text')}
                    </label>
                    <input
                      type="text"
                      value={fc.helpText ?? ''}
                      onChange={(e) =>
                        onUpdate(fc.fieldId, { helpText: e.target.value || undefined })
                      }
                      placeholder={t(
                        'formBuilder.helpTextPlaceholder',
                        'Instructions for this field...'
                      )}
                      className="w-full rounded-lg border border-c-border-subtle px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>

                {/* Default value */}
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                    {t('formBuilder.defaultValue', 'Default value')}
                  </label>
                  <input
                    type="text"
                    value={String(fc.defaultValue ?? '')}
                    onChange={(e) =>
                      onUpdate(fc.fieldId, {
                        defaultValue: e.target.value || undefined,
                      })
                    }
                    className="w-full rounded-lg border border-c-border-subtle px-3 py-1.5 text-sm"
                  />
                </div>

                {/* Conditional visibility */}
                <div className="mt-3">
                  <label className="mb-1 flex items-center gap-2 text-xs font-medium text-c-text-secondary">
                    {t('formBuilder.conditionalVisibility', 'Conditional visibility')}
                    <input
                      type="checkbox"
                      checked={!!fc.conditionalVisibility}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onUpdate(fc.fieldId, {
                            conditionalVisibility: { fieldId: '', operator: 'equals', value: '' },
                          });
                        } else {
                          onUpdate(fc.fieldId, { conditionalVisibility: undefined });
                        }
                      }}
                      className="h-3.5 w-3.5 rounded border-c-border-subtle"
                    />
                  </label>
                  {fc.conditionalVisibility && (
                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
                      <select
                        value={fc.conditionalVisibility.fieldId}
                        onChange={(e) =>
                          onUpdate(fc.fieldId, {
                            conditionalVisibility: {
                              ...fc.conditionalVisibility!,
                              fieldId: e.target.value,
                            },
                          })
                        }
                        className="rounded border border-c-border-subtle px-2 py-1 text-xs"
                      >
                        <option value="">{t('formBuilder.selectField', 'Select field...')}</option>
                        {fieldConfigs
                          .filter((other) => other.fieldId !== fc.fieldId)
                          .map((other) => {
                            const otherField = fieldMap.get(other.fieldId);
                            return (
                              <option key={other.fieldId} value={other.fieldId}>
                                {other.label || otherField?.name || other.fieldId}
                              </option>
                            );
                          })}
                      </select>
                      <select
                        value={fc.conditionalVisibility.operator}
                        onChange={(e) =>
                          onUpdate(fc.fieldId, {
                            conditionalVisibility: {
                              ...fc.conditionalVisibility!,
                              operator: e.target.value as ConditionalVisibility['operator'],
                            },
                          })
                        }
                        className="rounded border border-c-border-subtle px-2 py-1 text-xs"
                      >
                        <option value="equals">{t('formBuilder.opEquals', 'equals')}</option>
                        <option value="not_equals">
                          {t('formBuilder.opNotEquals', 'not equals')}
                        </option>
                        <option value="is_empty">{t('formBuilder.opIsEmpty', 'is empty')}</option>
                        <option value="is_not_empty">
                          {t('formBuilder.opIsNotEmpty', 'is not empty')}
                        </option>
                      </select>
                      {fc.conditionalVisibility.operator !== 'is_empty' &&
                        fc.conditionalVisibility.operator !== 'is_not_empty' && (
                          <input
                            type="text"
                            value={String(fc.conditionalVisibility.value ?? '')}
                            onChange={(e) =>
                              onUpdate(fc.fieldId, {
                                conditionalVisibility: {
                                  ...fc.conditionalVisibility!,
                                  value: e.target.value,
                                },
                              })
                            }
                            placeholder={t('formBuilder.condValue', 'Value...')}
                            className="rounded border border-c-border-subtle px-2 py-1 text-xs"
                          />
                        )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SettingsPanelProps {
  name: string;
  description: string;
  slug: string;
  submitMessage: string;
  redirectUrl: string;
  notificationEmail: string;
  allowMultiple: boolean;
  requireAuth: boolean;
  publicUrl: string;
  isPublished: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onSubmitMessageChange: (v: string) => void;
  onRedirectUrlChange: (v: string) => void;
  onNotificationEmailChange: (v: string) => void;
  onAllowMultipleChange: (v: boolean) => void;
  onRequireAuthChange: (v: boolean) => void;
}

function SettingsPanel({
  name,
  description,
  slug,
  submitMessage,
  redirectUrl,
  notificationEmail,
  allowMultiple,
  requireAuth,
  publicUrl,
  isPublished,
  onNameChange,
  onDescriptionChange,
  onSlugChange,
  onSubmitMessageChange,
  onRedirectUrlChange,
  onNotificationEmailChange,
  onAllowMultipleChange,
  onRequireAuthChange,
}: SettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Form name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-c-text">
          {t('formBuilder.formName', 'Form name')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full rounded-xl border border-c-border-subtle px-4 py-2.5 text-sm"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-c-text">
          {t('formBuilder.formDescription', 'Description')}
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-c-border-subtle px-4 py-2.5 text-sm"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-c-text">
          {t('formBuilder.slug', 'URL slug')}
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
          className="w-full rounded-xl border border-c-border-subtle px-4 py-2.5 text-sm font-mono"
        />
        {isPublished && (
          <p className="mt-1 flex items-center gap-1 text-xs text-c-text-muted">
            <ExternalLink className="h-3 w-3" />
            {publicUrl}
          </p>
        )}
      </div>

      {/* Submit message */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-c-text">
          {t('formBuilder.submitMessage', 'Success message')}
        </label>
        <input
          type="text"
          value={submitMessage}
          onChange={(e) => onSubmitMessageChange(e.target.value)}
          className="w-full rounded-xl border border-c-border-subtle px-4 py-2.5 text-sm"
        />
      </div>

      {/* Redirect URL */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-c-text">
          {t('formBuilder.redirectUrl', 'Redirect URL (optional)')}
        </label>
        <input
          type="url"
          value={redirectUrl}
          onChange={(e) => onRedirectUrlChange(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-xl border border-c-border-subtle px-4 py-2.5 text-sm"
        />
      </div>

      {/* Notification email */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-c-text">
          {t('formBuilder.notificationEmail', 'Notification email (optional)')}
        </label>
        <input
          type="email"
          value={notificationEmail}
          onChange={(e) => onNotificationEmailChange(e.target.value)}
          placeholder="notify@example.com"
          className="w-full rounded-xl border border-c-border-subtle px-4 py-2.5 text-sm"
        />
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(
            'formBuilder.notificationEmailHint',
            'Receive an email when a new response is submitted'
          )}
        </p>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <ToggleRow
          label={t('formBuilder.allowMultiple', 'Allow multiple submissions')}
          checked={allowMultiple}
          onChange={onAllowMultipleChange}
        />
        <ToggleRow
          label={t('formBuilder.requireAuth', 'Require authentication')}
          checked={requireAuth}
          onChange={onRequireAuthChange}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-c-border-subtle px-4 py-3">
      <span className="text-sm text-c-text">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-c-surface'
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-c-surface shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
    </label>
  );
}

// ── Form Preview ─────────────────────────────────────────────────────────────

interface FormPreviewProps {
  name: string;
  description: string;
  fieldConfigs: FormFieldConfig[];
  fieldMap: Map<string, TablePlatformField>;
  submitMessage: string;
}

function FormPreview({
  name,
  description,
  fieldConfigs,
  fieldMap,
  submitMessage,
}: FormPreviewProps) {
  const { t } = useTranslation();
  const visibleFields = fieldConfigs.filter((fc) => !fc.hidden);

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-8 shadow-sm">
        <h3 className="mb-1 text-xl font-semibold text-c-text">{name}</h3>
        {description && <p className="mb-6 text-sm text-c-text-muted">{description}</p>}

        <div className="space-y-5">
          {visibleFields.map((fc) => {
            const field = fieldMap.get(fc.fieldId);
            if (!field) return null;
            return <PreviewField key={fc.fieldId} field={field} config={fc} />;
          })}
        </div>

        <button
          disabled
          className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white opacity-80"
        >
          {t('formBuilder.submit', 'Submit')}
        </button>
      </div>
    </div>
  );
}

function PreviewField({ field, config }: { field: TablePlatformField; config: FormFieldConfig }) {
  const { t } = useTranslation();
  const label = config.label || field.name;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-c-text">
        {label}
        {config.required && <span className="ml-1 text-danger-500">*</span>}
      </label>
      {config.helpText && <p className="mb-1 text-xs text-c-text-secondary">{config.helpText}</p>}
      {renderPreviewInput(field.fieldType, t)}
    </div>
  );
}

function renderPreviewInput(
  fieldType: FieldType | string,
  t: (key: string, fallback: string) => string
) {
  const base = 'w-full rounded-lg border border-c-border-subtle px-3 py-2 text-sm';

  switch (fieldType) {
    case 'longText':
      return <textarea disabled rows={3} className={base} />;
    case 'checkbox':
      return <input type="checkbox" disabled className="h-4 w-4 rounded border-c-border-subtle" />;
    case 'date':
      return <input type="date" disabled className={base} />;
    case 'number':
    case 'currency':
    case 'percent':
      return <input type="number" disabled className={base} />;
    case 'email':
      return <input type="email" disabled placeholder="email@example.com" className={base} />;
    case 'url':
      return <input type="url" disabled placeholder="https://..." className={base} />;
    case 'phone':
      return <input type="tel" disabled placeholder="+1..." className={base} />;
    case 'singleSelect':
      return (
        <select disabled className={base}>
          <option>{t('ideas.table.formBuilder.selectPlaceholder', 'Select...')}</option>
        </select>
      );
    case 'multiSelect':
      return (
        <select disabled multiple className={base}>
          <option>{t('ideas.table.formBuilder.selectPlaceholder', 'Select...')}</option>
        </select>
      );
    default:
      return <input type="text" disabled className={base} />;
  }
}
