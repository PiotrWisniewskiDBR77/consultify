/**
 * RecordTemplateManager — Create, manage, and use record templates.
 * Templates are pre-filled field values stored as special records.
 */
import { Copy, Edit3, FileText, Loader2, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type { TablePlatformField } from '@/types/tablePlatform';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordTemplate {
  id: string;
  name: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface RecordTemplateManagerProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  fields: TablePlatformField[];
  onUseTemplate: (data: Record<string, unknown>) => void;
  locked?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RecordTemplateManager: React.FC<RecordTemplateManagerProps> = ({
  open,
  onClose,
  tableId,
  fields,
  onUseTemplate,
  locked = false,
}) => {
  const { t } = useTranslation();

  const [templates, setTemplates] = useState<RecordTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecordTemplate | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Suspend this dialog's own Escape/focus-trap while the nested
  // `TemplateEditor` dialog is showing — two simultaneously-open
  // `useDialogA11y` document Escape listeners would both fire on a single
  // Escape press (stopPropagation doesn't stop sibling listeners on the
  // same `document` target), closing both dialogs instead of just the top
  // one.
  useDialogA11y({ open: open && !showCreate, onClose, containerRef: dialogRef });

  const loadTemplates = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const result = await TablePlatformApi.listRecordTemplates(tableId);
      setTemplates(result.templates ?? []);
    } catch {
      toast.error(
        t('ideas.table.recordTemplates.failedToLoadTemplates', 'Failed to load templates')
      );
    } finally {
      setLoading(false);
    }
  }, [tableId, t]);

  useEffect(() => {
    if (open) loadTemplates();
  }, [open, loadTemplates]);

  // Program B (E02) — klik człowieka = `ctx.params.run` (rejestr wykonuje
  // ORYGINALNY callback wprost); Teresa = ta sama funkcja rejestru woła REST
  // bezpośrednio (`runTableRecordTemplateDeleteCallback` w `ideaActionRegistry.ts`).
  const handleDelete = useCallback(
    (templateId: string) => {
      const ctx: ActionContext = {
        ideaId: tableId,
        tool: 'table',
        selection: EMPTY_SELECTION,
        surface: 'panel',
        source: 'ui',
        params: {
          templateId,
          run: async () => {
            try {
              await TablePlatformApi.deleteRecordTemplate(templateId);
              setTemplates((prev) => prev.filter((t) => t.id !== templateId));
              toast.success(t('ideas.table.recordTemplates.templateDeleted', 'Template deleted'));
            } catch {
              toast.error(
                t('ideas.table.recordTemplates.failedToDeleteTemplate', 'Failed to delete template')
              );
            }
          },
        },
      };
      void runIdeaAction('table.record_template.delete', ctx);
    },
    [t, tableId]
  );

  const handleUse = useCallback(
    (template: RecordTemplate) => {
      const data = { ...template.data };
      delete data._is_template;
      delete data._template_name;
      onUseTemplate(data);
      onClose();
    },
    [onUseTemplate, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-[color-mix(in_srgb,var(--c-text)_20%,transparent)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-template-manager-title"
        tabIndex={-1}
        className="w-[520px] max-w-[95vw] max-h-[80vh] flex flex-col rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <h3 id="record-template-manager-title" className="text-sm font-bold text-c-text">
            {t('ideas.table.recordTemplates.recordTemplatesTitle', 'Record Templates')}
          </h3>
          <div className="flex items-center gap-1">
            {!locked && (
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowCreate(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text transition-colors"
              >
                <Plus size={12} />
                {t('ideas.table.new', 'New')}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
            >
              <X size={16} className="text-c-text-muted" />
            </button>
          </div>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-c-text-muted" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={32} className="mx-auto text-c-text-muted mb-3" />
              <p className="text-[11px] text-c-text-muted">
                {t(
                  'ideas.table.recordTemplates.noTemplatesYetLong',
                  'No templates yet. Create one to quickly add pre-filled records.'
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="group rounded-xl border border-c-border-subtle hover:border-c-border-subtle transition-colors"
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-c-surface-raised flex items-center justify-center flex-shrink-0">
                      <FileText size={14} className="text-c-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-c-text-secondary truncate">
                        {tpl.name}
                      </div>
                      <div className="text-[9px] text-c-text-muted mt-0.5">
                        {Object.keys(tpl.data).filter((k) => !k.startsWith('_')).length}{' '}
                        {t('ideas.table.recordTemplates.fieldsPreFilled', 'fields pre-filled')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleUse(tpl)}
                        className="p-1.5 rounded-lg text-c-text-muted hover:text-c-success hover:bg-[color-mix(in_srgb,var(--c-success)_12%,transparent)] transition-colors"
                        title={t('ideas.table.recordTemplates.useTemplateTitle', 'Use template')}
                      >
                        <Copy size={12} />
                      </button>
                      {!locked && (
                        <>
                          <button
                            onClick={() => {
                              setEditingTemplate(tpl);
                              setShowCreate(true);
                            }}
                            className="p-1.5 rounded-lg text-c-text-muted hover:text-c-info hover:bg-[color-mix(in_srgb,var(--c-info)_12%,transparent)] transition-colors"
                            title={t('ideas.table.edit', 'Edit')}
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(tpl.id)}
                            className="p-1.5 rounded-lg text-c-text-muted hover:text-c-danger hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] transition-colors"
                            title={t('ideas.table.delete', 'Delete')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Preview of pre-filled values */}
                  <div className="px-4 pb-3">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(tpl.data)
                        .filter(([k]) => !k.startsWith('_'))
                        .slice(0, 5)
                        .map(([key, value]) => {
                          const field = fields.find((f) => f.id === key || f.name === key);
                          const displayName = field?.name ?? key;
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-c-surface-raised text-[9px] text-c-text-muted"
                            >
                              <span className="font-medium">{displayName}:</span>
                              <span className="truncate max-w-[80px]">{String(value ?? '')}</span>
                            </span>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Template Dialog */}
      {showCreate && (
        <TemplateEditor
          fields={fields}
          template={editingTemplate}
          tableId={tableId}
          onClose={() => {
            setShowCreate(false);
            setEditingTemplate(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditingTemplate(null);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// TemplateEditor — create or edit a template
// ---------------------------------------------------------------------------

interface TemplateEditorProps {
  fields: TablePlatformField[];
  template: RecordTemplate | null;
  tableId: string;
  onClose: () => void;
  onSaved: () => void;
}

const EDITABLE_FIELD_TYPES = new Set([
  'singleLineText',
  'longText',
  'number',
  'currency',
  'percent',
  'checkbox',
  'date',
  'singleSelect',
  'multiSelect',
  'url',
  'email',
  'phone',
  'rating',
]);

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  fields,
  template,
  tableId,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(template?.name ?? '');
  const [data, setData] = useState<Record<string, unknown>>(() => {
    if (!template?.data) return {};
    const d = { ...template.data };
    delete d._is_template;
    delete d._template_name;
    return d;
  });
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useDialogA11y({ open: true, onClose, containerRef: dialogRef, initialFocusRef: nameInputRef });

  const editableFields = fields.filter(
    (f) => EDITABLE_FIELD_TYPES.has(f.fieldType) && !f.isComputed
  );

  const handleFieldValue = (fieldId: string, value: unknown) => {
    setData((prev) => {
      if (value === '' || value === null || value === undefined) {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      }
      return { ...prev, [fieldId]: value };
    });
  };

  // Program B (E02) — klik człowieka = `ctx.params.run` (rejestr wykonuje
  // ORYGINALNY callback wprost, obsługuje ZARÓWNO tworzenie jak i edycję —
  // rozróżnia je obecność `template`, dokładnie jak dziś); Teresa = ta sama
  // funkcja rejestru woła REST bezpośrednio, rozróżniając po `templateId`
  // (`runTableRecordTemplateSaveCallback` w `ideaActionRegistry.ts`).
  const handleSave = () => {
    if (!name.trim()) return;
    const ctx: ActionContext = {
      ideaId: tableId,
      tool: 'table',
      selection: EMPTY_SELECTION,
      surface: 'panel',
      source: 'ui',
      params: {
        tableId,
        templateId: template?.id,
        name: name.trim(),
        data,
        run: async () => {
          setSaving(true);
          try {
            if (template) {
              await TablePlatformApi.updateRecordTemplate(template.id, { name: name.trim(), data });
              toast.success(t('ideas.table.recordTemplates.templateUpdated', 'Template updated'));
            } else {
              await TablePlatformApi.createRecordTemplate(tableId, name.trim(), data);
              toast.success(t('ideas.table.recordTemplates.templateCreated', 'Template created'));
            }
            onSaved();
          } catch {
            toast.error(
              t('ideas.table.recordTemplates.failedToSaveTemplate', 'Failed to save template')
            );
          } finally {
            setSaving(false);
          }
        },
      },
    };
    void runIdeaAction('table.record_template.save', ctx);
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-[color-mix(in_srgb,var(--c-text)_30%,transparent)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-template-editor-title"
        tabIndex={-1}
        className="w-[480px] max-w-[95vw] max-h-[80vh] flex flex-col rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <h3 id="record-template-editor-title" className="text-sm font-bold text-c-text">
            {template
              ? t('ideas.table.recordTemplates.editTemplateTitle', 'Edit Template')
              : t('ideas.table.recordTemplates.newTemplateTitle', 'New Template')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={16} className="text-c-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Template name */}
          <div>
            <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
              {t('ideas.table.recordTemplates.templateNameLabel', 'Template name')}
            </label>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                'ideas.table.recordTemplates.templateNamePlaceholder',
                'e.g. Standard Task'
              )}
              className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-c-focus"
            />
          </div>

          {/* Field values */}
          <div>
            <label className="block text-[11px] font-bold text-c-text-secondary mb-2">
              {t('ideas.table.recordTemplates.defaultValuesLabel', 'Default values')}
            </label>
            <div className="space-y-2">
              {editableFields.map((field) => (
                <TemplateFieldInput
                  key={field.id}
                  field={field}
                  value={data[field.id] ?? data[field.name]}
                  onChange={(val) => handleFieldValue(field.id, val)}
                />
              ))}
              {editableFields.length === 0 && (
                <p className="text-[10px] text-c-text-muted italic">
                  {t('ideas.table.recordTemplates.noEditableFields', 'No editable fields')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            {t('ideas.table.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-c-text text-c-surface hover:brightness-95 transition-colors disabled:opacity-40"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : template ? (
              t('ideas.table.save', 'Save')
            ) : (
              t('ideas.table.recordTemplates.create', 'Create')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TemplateFieldInput — renders appropriate input for each field type
// ---------------------------------------------------------------------------

interface TemplateFieldInputProps {
  field: TablePlatformField;
  value: unknown;
  onChange: (value: unknown) => void;
}

const TemplateFieldInput: React.FC<TemplateFieldInputProps> = ({ field, value, onChange }) => {
  const { t } = useTranslation();
  const inputClass =
    'w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2.5 py-1.5 text-[11px] text-c-text-secondary outline-none focus:ring-2 focus:ring-c-focus';

  const renderInput = () => {
    switch (field.fieldType) {
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-c-border-subtle text-c-focus-solid focus:ring-c-focus"
            />
            <span className="text-[11px] text-c-text-muted">
              {t('ideas.table.recordTemplates.checkedLabel', 'Checked')}
            </span>
          </label>
        );

      case 'number':
      case 'currency':
      case 'percent':
      case 'rating':
        return (
          <input
            type="number"
            value={value != null ? String(value) : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="0"
            className={inputClass}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => onChange(e.target.value || null)}
            className={inputClass}
          />
        );

      case 'singleSelect': {
        const opts =
          (field.options as { options?: Array<{ name?: string; id?: string }> })?.options ?? [];
        return (
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || null)}
            className={inputClass}
          >
            <option value="">{t('ideas.table.recordTemplates.selectDash', '— select —')}</option>
            {opts.map((o) => (
              <option key={o.id ?? o.name} value={o.name ?? o.id}>
                {o.name ?? o.id}
              </option>
            ))}
          </select>
        );
      }

      case 'longText':
        return (
          <textarea
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || null)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        );

      default:
        return (
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={t('ideas.table.recordTemplates.valueEllipsis', 'Value...')}
            className={inputClass}
          />
        );
    }
  };

  return (
    <div className="flex items-start gap-3">
      <span className="text-[10px] font-medium text-c-text-muted w-28 flex-shrink-0 pt-1.5 truncate">
        {field.name}
      </span>
      <div className="flex-1">{renderInput()}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TemplateDropdown — small dropdown for "Add row from template"
// ---------------------------------------------------------------------------

interface TemplateDropdownProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  onUseTemplate: (data: Record<string, unknown>) => void;
  onManageTemplates: () => void;
  anchorRect?: DOMRect | null;
}

export const TemplateDropdown: React.FC<TemplateDropdownProps> = ({
  open,
  onClose,
  tableId,
  onUseTemplate,
  onManageTemplates,
  anchorRect,
}) => {
  const { t } = useTranslation();

  const [templates, setTemplates] = useState<RecordTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !tableId) return;
    setLoading(true);
    TablePlatformApi.listRecordTemplates(tableId)
      .then((res: any) => setTemplates(res.templates ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, tableId]);

  if (!open) return null;

  const style: React.CSSProperties = {};
  if (anchorRect) {
    style.position = 'fixed';
    style.left = anchorRect.left;
    style.top = anchorRect.bottom + 4;
    if ((style.top as number) > window.innerHeight - 300) {
      style.top = anchorRect.top - 300;
    }
  } else {
    style.position = 'fixed';
    style.right = 16;
    style.top = 100;
  }

  return (
    <div className="fixed inset-0 z-[150]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[240px] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden"
        style={style}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
            {t('ideas.table.recordTemplates.fromTemplate', 'From Template')}
          </span>
          <button onClick={onClose} className="p-0.5 rounded hover:bg-c-surface-raised">
            <X size={11} className="text-c-text-muted" />
          </button>
        </div>

        <div className="max-h-[260px] overflow-auto p-1.5">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={14} className="animate-spin text-c-text-muted" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-center py-4 text-[10px] text-c-text-muted">
              {t('ideas.table.recordTemplates.noTemplatesShort', 'No templates')}
            </p>
          ) : (
            templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  const data = { ...tpl.data };
                  delete data._is_template;
                  delete data._template_name;
                  onUseTemplate(data);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-c-surface-raised transition-colors text-left"
              >
                <FileText size={12} className="text-c-text-secondary flex-shrink-0" />
                <span className="text-[11px] font-medium text-c-text-secondary truncate">
                  {tpl.name}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-c-border-subtle p-1.5">
          <button
            onClick={() => {
              onClose();
              onManageTemplates();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[10px] font-semibold text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text transition-colors"
          >
            <Edit3 size={11} />
            {t('ideas.table.recordTemplates.manageTemplates', 'Manage templates')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordTemplateManager;
