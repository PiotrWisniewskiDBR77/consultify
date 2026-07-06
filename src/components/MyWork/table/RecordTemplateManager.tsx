/**
 * RecordTemplateManager — Create, manage, and use record templates.
 * Templates are pre-filled field values stored as special records.
 */
import { Copy, Edit3, FileText, Loader2, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [templates, setTemplates] = useState<RecordTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecordTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const result = await TablePlatformApi.listRecordTemplates(tableId);
      setTemplates(result.templates ?? []);
    } catch {
      toast.error(isPl ? 'Nie udało się załadować szablonów' : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [tableId, isPl]);

  useEffect(() => {
    if (open) loadTemplates();
  }, [open, loadTemplates]);

  const handleDelete = useCallback(
    async (templateId: string) => {
      try {
        await TablePlatformApi.deleteRecordTemplate(templateId);
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        toast.success(isPl ? 'Szablon usunięty' : 'Template deleted');
      } catch {
        toast.error(isPl ? 'Nie udało się usunąć szablonu' : 'Failed to delete template');
      }
    },
    [isPl]
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
        className="w-[520px] max-w-[95vw] max-h-[80vh] flex flex-col rounded-2xl border border-c-border-subtle bg-c-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <h3 className="text-sm font-bold text-c-text">
            {isPl ? 'Szablony rekordów' : 'Record Templates'}
          </h3>
          <div className="flex items-center gap-1">
            {!locked && (
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowCreate(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-c-accent hover:bg-c-accent-soft transition-colors"
              >
                <Plus size={12} />
                {isPl ? 'Nowy' : 'New'}
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
                {isPl
                  ? 'Brak szablonów. Utwórz pierwszy szablon, aby szybko dodawać rekordy.'
                  : 'No templates yet. Create one to quickly add pre-filled records.'}
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
                    <div className="w-8 h-8 rounded-lg bg-c-accent-soft flex items-center justify-center flex-shrink-0">
                      <FileText size={14} className="text-c-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-c-text-secondary truncate">
                        {tpl.name}
                      </div>
                      <div className="text-[9px] text-c-text-muted mt-0.5">
                        {Object.keys(tpl.data).filter((k) => !k.startsWith('_')).length}{' '}
                        {isPl ? 'pól wypełnionych' : 'fields pre-filled'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleUse(tpl)}
                        className="p-1.5 rounded-lg text-c-text-muted hover:text-c-success hover:bg-[color-mix(in_srgb,var(--c-success)_12%,transparent)] transition-colors"
                        title={isPl ? 'Użyj szablonu' : 'Use template'}
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
                            title={isPl ? 'Edytuj' : 'Edit'}
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(tpl.id)}
                            className="p-1.5 rounded-lg text-c-text-muted hover:text-c-danger hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] transition-colors"
                            title={isPl ? 'Usuń' : 'Delete'}
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
          isPl={!!isPl}
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
  isPl: boolean;
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
  isPl,
  fields,
  template,
  tableId,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(template?.name ?? '');
  const [data, setData] = useState<Record<string, unknown>>(() => {
    if (!template?.data) return {};
    const d = { ...template.data };
    delete d._is_template;
    delete d._template_name;
    return d;
  });
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (template) {
        await TablePlatformApi.updateRecordTemplate(template.id, { name: name.trim(), data });
        toast.success(isPl ? 'Szablon zaktualizowany' : 'Template updated');
      } else {
        await TablePlatformApi.createRecordTemplate(tableId, name.trim(), data);
        toast.success(isPl ? 'Szablon utworzony' : 'Template created');
      }
      onSaved();
    } catch {
      toast.error(isPl ? 'Nie udało się zapisać szablonu' : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-[color-mix(in_srgb,var(--c-text)_30%,transparent)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-[95vw] max-h-[80vh] flex flex-col rounded-2xl border border-c-border-subtle bg-c-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <h3 className="text-sm font-bold text-c-text">
            {template
              ? isPl
                ? 'Edytuj szablon'
                : 'Edit Template'
              : isPl
                ? 'Nowy szablon'
                : 'New Template'}
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
              {isPl ? 'Nazwa szablonu' : 'Template name'}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isPl ? 'np. Zadanie standardowe' : 'e.g. Standard Task'}
              className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-c-focus"
              autoFocus
            />
          </div>

          {/* Field values */}
          <div>
            <label className="block text-[11px] font-bold text-c-text-secondary mb-2">
              {isPl ? 'Wartości domyślne' : 'Default values'}
            </label>
            <div className="space-y-2">
              {editableFields.map((field) => (
                <TemplateFieldInput
                  key={field.id}
                  field={field}
                  value={data[field.id] ?? data[field.name]}
                  onChange={(val) => handleFieldValue(field.id, val)}
                  isPl={isPl}
                />
              ))}
              {editableFields.length === 0 && (
                <p className="text-[10px] text-c-text-muted italic">
                  {isPl ? 'Brak edytowalnych pól' : 'No editable fields'}
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
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-c-accent text-white hover:brightness-95 transition-colors disabled:opacity-40"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : template ? (
              isPl ? (
                'Zapisz'
              ) : (
                'Save'
              )
            ) : isPl ? (
              'Utwórz'
            ) : (
              'Create'
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
  isPl: boolean;
}

const TemplateFieldInput: React.FC<TemplateFieldInputProps> = ({
  field,
  value,
  onChange,
  isPl,
}) => {
  const inputClass =
    'w-full rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-[11px] text-c-text-secondary outline-none focus:ring-2 focus:ring-c-focus';

  const renderInput = () => {
    switch (field.fieldType) {
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-c-border-subtle text-c-accent focus:ring-c-focus"
            />
            <span className="text-[11px] text-c-text-muted">
              {isPl ? 'Zaznaczony' : 'Checked'}
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
            <option value="">{isPl ? '— wybierz —' : '— select —'}</option>
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
            placeholder={isPl ? 'Wartość...' : 'Value...'}
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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
        className="w-[240px] rounded-2xl border border-c-border-subtle bg-c-surface shadow-2xl overflow-hidden"
        style={style}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
            {isPl ? 'Z szablonu' : 'From Template'}
          </span>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-c-surface-raised"
          >
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
              {isPl ? 'Brak szablonów' : 'No templates'}
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
                <FileText size={12} className="text-c-accent flex-shrink-0" />
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
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[10px] font-semibold text-c-accent hover:bg-c-accent-soft transition-colors"
          >
            <Edit3 size={11} />
            {isPl ? 'Zarządzaj szablonami' : 'Manage templates'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordTemplateManager;
