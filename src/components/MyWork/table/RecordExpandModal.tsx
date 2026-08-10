/**
 * RecordExpandModal — Full record details modal/drawer.
 *
 * Features:
 * - Header with primary field as title, table name as subtitle
 * - All fields in form-like layout (label + value)
 * - Nested linked record chips (1 level deep)
 * - Computed fields with "computed" badge
 * - Attachment file thumbnails/icons
 * - Toggle edit mode for inline editing
 * - Link to audit trail
 * - Close via X, Escape, click outside
 */
import { Calculator, Clock, Edit3, Eye, FileText, Image, Link2, Loader2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type { FieldType } from '@/types/tablePlatform';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldDef {
  id: string;
  name: string;
  fieldType: FieldType;
  options: Record<string, unknown>;
  isComputed: boolean;
  order: number;
}

interface RecordExpandModalProps {
  open: boolean;
  onClose: () => void;
  recordId: string;
  tableId: string;
  tableName?: string;
  onOpenLinkedRecord?: (recordId: string, tableId: string) => void;
  onOpenAuditTrail?: (recordId: string) => void;
  locked?: boolean;
}

// ── Computed field types ──────────────────────────────────────────────────────

const COMPUTED_TYPES: Set<string> = new Set([
  'formula',
  'lookup',
  'rollup',
  'count',
  'createdTime',
  'createdBy',
  'lastModifiedTime',
  'lastModifiedBy',
  'autoNumber',
]);

// ── Sub-components ────────────────────────────────────────────────────────────

const FieldValueDisplay: React.FC<{
  value: unknown;
  fieldType: FieldType;
  fieldOptions: Record<string, unknown>;
  isEditing: boolean;
  onChange?: (v: unknown) => void;
}> = ({ value, fieldType, fieldOptions, isEditing, onChange }) => {
  const { t } = useTranslation();
  if (value == null || value === '') {
    return <span className="text-xs text-c-text-muted italic">—</span>;
  }

  if (fieldType === 'checkbox') {
    return <span className="text-xs">{value ? '✓' : '✗'}</span>;
  }

  if (fieldType === 'date' || fieldType === 'createdTime' || fieldType === 'lastModifiedTime') {
    const d = new Date(String(value));
    const str = Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
    return <span className="text-xs tabular-nums text-c-text-secondary">{str}</span>;
  }

  if (fieldType === 'singleSelect') {
    return (
      <span className="inline-flex items-center rounded-md bg-c-surface-raised px-2 py-0.5 text-[10px] font-semibold text-c-text-secondary">
        {String(value)}
      </span>
    );
  }

  if (fieldType === 'multiSelect') {
    const items = Array.isArray(value) ? value : [value];
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,var(--c-tag-1)_16%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-c-tag-1"
          >
            {String(item)}
          </span>
        ))}
      </div>
    );
  }

  if (fieldType === 'url') {
    const url = String(value);
    return (
      <a
        href={url.startsWith('http') ? url : `https://${url}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-c-info underline hover:brightness-110"
      >
        {url}
      </a>
    );
  }

  if (fieldType === 'email') {
    return (
      <a href={`mailto:${value}`} className="text-xs text-c-info underline hover:brightness-110">
        {String(value)}
      </a>
    );
  }

  if (fieldType === 'number' || fieldType === 'currency' || fieldType === 'percent') {
    const num = Number(value);
    if (!Number.isFinite(num))
      return <span className="text-xs text-c-text-secondary">{String(value)}</span>;
    const prefix =
      fieldType === 'currency'
        ? ((fieldOptions as { currencySymbol?: string })?.currencySymbol ?? '$')
        : '';
    const suffix = fieldType === 'percent' ? '%' : '';
    return (
      <span className="text-xs tabular-nums text-c-text-secondary">
        {prefix}
        {num.toLocaleString()}
        {suffix}
      </span>
    );
  }

  if (fieldType === 'attachment') {
    const items = Array.isArray(value) ? value : [value];
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((att, i) => {
          const item = att as Record<string, unknown>;
          const name = String(
            item?.fileName ??
              item?.name ??
              t('ideas.table.fileNumbered', 'File {{n}}', { n: i + 1 })
          );
          const mime = String(item?.mimeType ?? '');
          const isImage = mime.startsWith('image/');
          return (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-lg bg-c-surface-raised px-2 py-1"
            >
              {isImage ? (
                <Image className="h-3.5 w-3.5 text-c-text-muted" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-c-text-muted" />
              )}
              <span className="max-w-[120px] truncate text-[10px] text-c-text-secondary">
                {name}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Default: text
  if (isEditing && onChange) {
    return (
      <input
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2 py-1 text-xs text-c-text outline-none focus:ring-2 focus:ring-c-focus"
      />
    );
  }

  return <span className="text-xs text-c-text-secondary whitespace-pre-wrap">{String(value)}</span>;
};

// ── Linked record chips (nested, 1 level) ─────────────────────────────────────

const NestedLinkedChips: React.FC<{
  value: unknown;
  fieldOptions: Record<string, unknown>;
  onOpenLinkedRecord?: (recordId: string, tableId: string) => void;
}> = React.memo(({ value, fieldOptions, onOpenLinkedRecord }) => {
  const items: string[] = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
  const linkedTableId = (fieldOptions as { linkedTableId?: string })?.linkedTableId ?? '';

  if (items.length === 0) {
    return <span className="text-xs text-c-text-muted italic">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((id) => (
        <button
          key={id}
          onClick={() => onOpenLinkedRecord?.(id, linkedTableId)}
          className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--c-info)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium text-c-info transition-colors hover:bg-[color-mix(in_srgb,var(--c-info)_20%,transparent)]"
        >
          <Link2 className="h-2.5 w-2.5" />
          <span className="max-w-[100px] truncate">{id}</span>
        </button>
      ))}
    </div>
  );
});

NestedLinkedChips.displayName = 'NestedLinkedChips';

// ── Main Component ────────────────────────────────────────────────────────────

export const RecordExpandModal: React.FC<RecordExpandModalProps> = React.memo(
  ({
    open,
    onClose,
    recordId,
    tableId,
    tableName,
    onOpenLinkedRecord,
    onOpenAuditTrail,
    locked = false,
  }) => {
    const { t } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [recordData, setRecordData] = useState<Record<string, unknown>>({});
    const [fields, setFields] = useState<FieldDef[]>([]);
    const [editMode, setEditMode] = useState(false);
    const [editedData, setEditedData] = useState<Record<string, unknown>>({});
    const [saving, setSaving] = useState(false);
    const [resolvedTableName, setResolvedTableName] = useState(tableName ?? '');
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogA11y({ open, onClose, containerRef: dialogRef });

    // Load record and table metadata
    useEffect(() => {
      if (!open || !recordId || !tableId) return;
      let cancelled = false;
      setLoading(true);

      (async () => {
        try {
          const [recRes, tableRes] = await Promise.all([
            TablePlatformApi.getRecord(recordId),
            TablePlatformApi.getTable(tableId),
          ]);

          if (cancelled) return;

          const rec = recRes as Record<string, unknown>;
          const data = (rec?.data as Record<string, unknown>) ?? rec ?? {};
          setRecordData(data);
          setEditedData({ ...data });

          const table = tableRes as Record<string, unknown>;
          if (!tableName && table?.name) {
            setResolvedTableName(String(table.name));
          }

          const rawFields = (table?.fields ?? []) as Array<Record<string, unknown>>;
          const mapped: FieldDef[] = rawFields.map((f) => ({
            id: String(f.id ?? ''),
            name: String(f.name ?? ''),
            fieldType: (f.fieldType ?? f.field_type ?? 'singleLineText') as FieldType,
            options: (f.options ?? {}) as Record<string, unknown>,
            isComputed: Boolean(
              f.isComputed ??
              f.is_computed ??
              COMPUTED_TYPES.has(String(f.fieldType ?? f.field_type ?? ''))
            ),
            order: Number(f.field_order ?? f.order ?? 999),
          }));
          mapped.sort((a, b) => a.order - b.order);
          setFields(mapped);
        } catch {
          if (!cancelled) {
            setRecordData({});
            setFields([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [open, recordId, tableId, tableName]);

    const primaryField = useMemo(() => fields[0], [fields]);
    const primaryValue = useMemo(
      () => (primaryField ? String(recordData[primaryField.id] ?? recordId) : recordId),
      [primaryField, recordData, recordId]
    );

    const handleFieldChange = useCallback((fieldId: string, value: unknown) => {
      setEditedData((prev) => ({ ...prev, [fieldId]: value }));
    }, []);

    const handleSave = useCallback(async () => {
      setSaving(true);
      try {
        await TablePlatformApi.updateRecord(recordId, editedData);
        setRecordData({ ...editedData });
        setEditMode(false);
      } catch {
        // keep edit mode open on error
      } finally {
        setSaving(false);
      }
    }, [recordId, editedData]);

    const handleCancelEdit = useCallback(() => {
      setEditedData({ ...recordData });
      setEditMode(false);
    }, [recordData]);

    if (!open) return null;

    return (
      <div
        className="fixed inset-0 z-context-menu flex items-stretch justify-end bg-[color-mix(in_srgb,var(--c-text)_20%,transparent)] backdrop-blur-[2px]"
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-expand-modal-title"
          tabIndex={-1}
          className="flex h-full w-[560px] max-w-[90vw] flex-col overflow-hidden bg-c-surface shadow-2xl animate-in slide-in-from-right duration-200 outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Accent bar */}
          <div className="h-1 flex-shrink-0 bg-gradient-to-r from-c-info to-c-focus" />

          {/* Header */}
          <div className="flex items-start justify-between border-b border-c-border-subtle px-6 py-4">
            <div className="min-w-0 flex-1">
              {loading ? (
                <div className="h-6 w-48 animate-pulse rounded bg-c-surface-raised" />
              ) : (
                <>
                  <h2 id="record-expand-modal-title" className="truncate text-base font-bold text-c-text">
                    {primaryValue}
                  </h2>
                  {resolvedTableName && (
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-c-text-muted">
                      {resolvedTableName}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-3">
              {!locked && !loading && (
                <button
                  onClick={() => {
                    if (editMode) handleCancelEdit();
                    else setEditMode(true);
                  }}
                  className={`rounded-lg p-2 transition-colors ${
                    editMode
                      ? 'bg-c-surface-raised text-c-text'
                      : 'text-c-text-muted hover:bg-c-surface-raised'
                  }`}
                  title={
                    editMode
                      ? t('ideas.table.cancelEdit', 'Cancel edit')
                      : t('ideas.table.editRecord', 'Edit')
                  }
                >
                  {editMode ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-c-text-muted transition-colors hover:bg-c-surface-raised"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-3 w-20 animate-pulse rounded bg-c-surface-raised" />
                    <div className="h-5 w-full animate-pulse rounded bg-c-surface-raised" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field) => {
                  const isComputed = field.isComputed || COMPUTED_TYPES.has(field.fieldType);
                  const displayData = editMode ? editedData : recordData;
                  const value = displayData[field.id];

                  return (
                    <div
                      key={field.id}
                      className="rounded-xl border border-c-border-subtle px-4 py-3"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
                          {field.name}
                        </span>
                        {isComputed && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-[color-mix(in_srgb,var(--c-warning)_16%,transparent)] px-1 py-0.5 text-[8px] font-bold text-c-warning">
                            <Calculator className="h-2.5 w-2.5" />
                            {field.fieldType === 'formula'
                              ? 'fx'
                              : t('ideas.table.computedField', 'computed')}
                          </span>
                        )}
                      </div>
                      {field.fieldType === 'linkedRecord' ? (
                        <NestedLinkedChips
                          value={value}
                          fieldOptions={field.options}
                          onOpenLinkedRecord={onOpenLinkedRecord}
                        />
                      ) : (
                        <FieldValueDisplay
                          value={value}
                          fieldType={field.fieldType}
                          fieldOptions={field.options}
                          isEditing={editMode && !isComputed}
                          onChange={
                            editMode && !isComputed
                              ? (v) => handleFieldChange(field.id, v)
                              : undefined
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-c-border-subtle px-6 py-3">
            {onOpenAuditTrail && (
              <button
                onClick={() => onOpenAuditTrail(recordId)}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-c-text-muted transition-colors hover:text-c-text-secondary"
              >
                <Clock className="h-3.5 w-3.5" />
                {t('ideas.table.auditTrail', 'Audit trail')}
              </button>
            )}
            {!onOpenAuditTrail && <div />}
            {editMode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="rounded-xl border border-c-border-subtle px-4 py-2 text-xs font-semibold text-c-text-secondary transition-colors hover:bg-c-surface-raised"
                >
                  {t('ideas.table.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-c-text px-4 py-2 text-xs font-semibold text-c-surface transition-colors hover:brightness-95 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    t('ideas.table.save', 'Save')
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

RecordExpandModal.displayName = 'RecordExpandModal';

export default RecordExpandModal;
