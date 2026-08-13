/**
 * FieldManager — Slide-out panel for managing table fields (add/edit/delete/reorder).
 * Supports all 20+ field types from the Table Platform.
 */
import {
  AlignLeft,
  ArrowRight,
  BarChart,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  GripVertical,
  Hash,
  Link,
  Loader2,
  Mail,
  Paperclip,
  Percent,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  Type,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import type { FieldType, TablePlatformField } from '@/types/tablePlatform';

import { DateDependencyConfig } from './DateDependencyConfig';

// ---------------------------------------------------------------------------
// Field type → icon mapping
// ---------------------------------------------------------------------------

const FIELD_TYPE_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  singleLineText: Type,
  longText: AlignLeft,
  number: Hash,
  currency: DollarSign,
  percent: Percent,
  checkbox: CheckCircle,
  date: Calendar,
  singleSelect: ChevronDown,
  multiSelect: CheckSquare,
  url: Link,
  email: Mail,
  phone: Phone,
  attachment: Paperclip,
  linkedRecord: ArrowRight,
  count: Hash,
  lookup: Search,
  rollup: BarChart,
  createdTime: Clock,
  createdBy: User,
  lastModifiedTime: Clock,
  lastModifiedBy: User,
  autoNumber: Hash,
  formula: Hash,
  button: ChevronRight,
  rating: Star,
  duration: Clock,
  barcode: BarChart,
};

function getFieldIcon(fieldType: string) {
  return FIELD_TYPE_ICONS[fieldType] ?? Type;
}

// ---------------------------------------------------------------------------
// Field type labels (PL + EN)
// ---------------------------------------------------------------------------

const FIELD_TYPE_LABELS: Record<string, { en: string; pl: string }> = {
  singleLineText: { en: 'Single line text', pl: 'Tekst jednoliniowy' },
  longText: { en: 'Long text', pl: 'Długi tekst' },
  number: { en: 'Number', pl: 'Liczba' },
  currency: { en: 'Currency', pl: 'Waluta' },
  percent: { en: 'Percent', pl: 'Procent' },
  checkbox: { en: 'Checkbox', pl: 'Checkbox' },
  date: { en: 'Date', pl: 'Data' },
  singleSelect: { en: 'Single select', pl: 'Wybór pojedynczy' },
  multiSelect: { en: 'Multi select', pl: 'Wybór wielokrotny' },
  url: { en: 'URL', pl: 'URL' },
  email: { en: 'Email', pl: 'Email' },
  phone: { en: 'Phone', pl: 'Telefon' },
  attachment: { en: 'Attachment', pl: 'Załącznik' },
  linkedRecord: { en: 'Linked record', pl: 'Powiązany rekord' },
  count: { en: 'Count', pl: 'Licznik' },
  lookup: { en: 'Lookup', pl: 'Wyszukiwanie' },
  rollup: { en: 'Rollup', pl: 'Podsumowanie' },
  createdTime: { en: 'Created time', pl: 'Czas utworzenia' },
  createdBy: { en: 'Created by', pl: 'Utworzony przez' },
  lastModifiedTime: { en: 'Last modified time', pl: 'Czas modyfikacji' },
  lastModifiedBy: { en: 'Last modified by', pl: 'Zmodyfikowany przez' },
  autoNumber: { en: 'Auto number', pl: 'Autonumeracja' },
  formula: { en: 'Formula', pl: 'Formuła' },
  button: { en: 'Button', pl: 'Przycisk' },
  rating: { en: 'Rating', pl: 'Ocena' },
  duration: { en: 'Duration', pl: 'Czas trwania' },
  barcode: { en: 'Barcode', pl: 'Kod kreskowy' },
};

const CREATABLE_FIELD_TYPES: FieldType[] = [
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
  'attachment',
  'linkedRecord',
  'formula',
  'rating',
  'duration',
  'barcode',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FieldManagerProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  fields: TablePlatformField[];
  primaryFieldId?: string;
  onFieldsChanged: () => void;
  locked?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FieldManager: React.FC<FieldManagerProps> = ({
  open,
  onClose,
  tableId,
  fields,
  primaryFieldId,
  onFieldsChanged,
  locked = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateDepsExpanded, setDateDepsExpanded] = useState(false);

  const dateFieldCount = useMemo(
    () =>
      fields.filter((f) => ['date', 'createdTime', 'lastModifiedTime'].includes(f.fieldType))
        .length,
    [fields]
  );
  const showDateDependencies = dateFieldCount >= 2;

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const sortedFields = useMemo(() => {
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (f) => f.name.toLowerCase().includes(q) || f.fieldType.toLowerCase().includes(q)
    );
  }, [fields, searchQuery]);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== idx) {
        setOverIdx(idx);
      }
    },
    [dragIdx]
  );

  const handleDrop = useCallback(async () => {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const reordered = [...sortedFields];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(overIdx, 0, moved);
    const newOrder = reordered.map((f) => f.id);
    setDragIdx(null);
    setOverIdx(null);
    try {
      await TablePlatformApi.reorderFields(tableId, newOrder);
      onFieldsChanged();
    } catch {
      toast.error(t('myWorkTable.fieldManager.failedToReorderFields'));
    }
  }, [dragIdx, overIdx, sortedFields, tableId, onFieldsChanged, isPl]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);
  // Suspend this drawer's own Escape/focus-trap while the nested
  // `AddFieldDialog` is showing — two simultaneously-open `useDialogA11y`
  // document Escape listeners would both fire on a single Escape press
  // (stopPropagation doesn't stop sibling listeners on the same `document`
  // target), closing both dialogs instead of just the top one.
  useDialogA11y({ open: open && !showAddField, onClose, containerRef: dialogRef });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-stretch justify-end bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-manager-title"
        tabIndex={-1}
        className="w-[380px] max-w-[90vw] h-full bg-c-surface border-l border-c-border-subtle shadow-2xl flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
          <h3 id="field-manager-title" className="text-sm font-bold text-c-text">
            {t('myWorkTable.fieldManager.fields')}
          </h3>
          <div className="flex items-center gap-1">
            {!locked && (
              <button
                onClick={() => setShowAddField(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text transition-colors"
              >
                <Plus size={12} />
                {t('myWorkTable.fieldManager.add')}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
            >
              <X size={16} className="text-c-text-secondary" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-c-text-secondary"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('myWorkTable.fieldManager.searchFields')}
              className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* Field list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {sortedFields.map((field, idx) => {
            const Icon = getFieldIcon(field.fieldType);
            const isPrimary = field.id === primaryFieldId;
            const isExpanded = expandedFieldId === field.id;
            const label = FIELD_TYPE_LABELS[field.fieldType];

            return (
              <div
                key={field.id}
                draggable={!locked && !searchQuery}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                className={`mb-0.5 rounded-xl border transition-all ${
                  overIdx === idx && dragIdx !== null
                    ? 'border-c-focus bg-c-surface-raised'
                    : 'border-transparent hover:border-c-border-subtle'
                } ${dragIdx === idx ? 'opacity-40' : ''}`}
              >
                <div
                  className="flex items-center gap-2 px-2 py-2 cursor-pointer"
                  onClick={() => setExpandedFieldId(isExpanded ? null : field.id)}
                >
                  {!locked && !searchQuery && (
                    <GripVertical
                      size={12}
                      className="text-c-text-secondary cursor-grab flex-shrink-0"
                    />
                  )}
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-c-surface-raised flex-shrink-0">
                    <Icon size={12} className="text-c-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-c-text truncate">
                        {field.name}
                      </span>
                      {isPrimary && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {t('ideas.table.fieldManager.primary', 'Primary')}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-c-text-secondary">
                      {isPl ? label?.pl : label?.en}
                    </span>
                  </div>
                  <ChevronRight
                    size={12}
                    className={`text-c-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>

                {/* Expanded edit panel */}
                {isExpanded && (
                  <FieldEditPanel
                    field={field}
                    isPrimary={isPrimary}
                    isPl={!!isPl}
                    locked={locked}
                    onSave={async (updates) => {
                      try {
                        await TablePlatformApi.updateField(field.id, updates);
                        onFieldsChanged();
                        toast.success(t('myWorkTable.fieldManager.fieldUpdated'));
                      } catch {
                        toast.error(t('myWorkTable.fieldManager.failedToUpdateField'));
                      }
                    }}
                    onDelete={async () => {
                      try {
                        await TablePlatformApi.deleteField(field.id);
                        onFieldsChanged();
                        setExpandedFieldId(null);
                        toast.success(t('myWorkTable.fieldManager.fieldDeleted'));
                      } catch {
                        toast.error(t('myWorkTable.fieldManager.failedToDeleteField'));
                      }
                    }}
                  />
                )}
              </div>
            );
          })}

          {sortedFields.length === 0 && (
            <div className="text-center py-8 text-[11px] text-c-text-secondary">
              {t('myWorkTable.fieldManager.noFields')}
            </div>
          )}

          {showDateDependencies && (
            <div className="mt-4 pt-3 border-t border-c-border-subtle">
              <button
                type="button"
                onClick={() => setDateDepsExpanded(!dateDepsExpanded)}
                className="flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5 hover:bg-c-surface-raised transition-colors"
              >
                <ChevronRight
                  size={12}
                  className={`text-c-text-secondary transition-transform ${dateDepsExpanded ? 'rotate-90' : ''}`}
                />
                <Calendar size={12} className="text-c-text-muted" />
                <span className="text-[11px] font-semibold text-c-text">
                  {t('myWorkTable.fieldManager.dateDependencies')}
                </span>
              </button>
              {dateDepsExpanded && (
                <div className="mt-2 pl-4">
                  <DateDependencyConfig
                    tableId={tableId}
                    fields={fields}
                    onConfigSaved={onFieldsChanged}
                    onRecordsUpdated={onFieldsChanged}
                    locked={locked}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Field Dialog */}
      {showAddField && (
        <AddFieldDialog
          isPl={!!isPl}
          onClose={() => setShowAddField(false)}
          onAdd={async (name, fieldType, options) => {
            try {
              await TablePlatformApi.createField(tableId, name, fieldType, options);
              onFieldsChanged();
              setShowAddField(false);
              toast.success(t('myWorkTable.fieldManager.fieldAdded'));
            } catch {
              toast.error(t('myWorkTable.fieldManager.failedToAddField'));
            }
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FieldEditPanel — inline edit form for a single field
// ---------------------------------------------------------------------------

interface FieldEditPanelProps {
  field: TablePlatformField;
  isPrimary: boolean;
  isPl: boolean;
  locked: boolean;
  onSave: (updates: { name?: string; options?: Record<string, unknown> }) => Promise<void>;
  onDelete: () => Promise<void>;
}

const FieldEditPanel: React.FC<FieldEditPanelProps> = ({
  field,
  isPrimary,
  isPl,
  locked,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(field.name);
  const [description, setDescription] = useState(
    ((field.options as Record<string, unknown>)?.description as string) ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasChanges =
    name !== field.name ||
    description !== ((field.options as Record<string, unknown>)?.description ?? '');

  const handleSave = async () => {
    if (!hasChanges || locked) return;
    setSaving(true);
    const updates: { name?: string; options?: Record<string, unknown> } = {};
    if (name !== field.name) updates.name = name;
    if (description !== ((field.options as Record<string, unknown>)?.description ?? '')) {
      updates.options = { ...(field.options as Record<string, unknown>), description };
    }
    await onSave(updates);
    setSaving(false);
  };

  return (
    <div className="px-3 pb-3 space-y-2">
      {/* Name */}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-0.5">
          {t('myWorkTable.fieldManager.name')}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={locked}
          className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2.5 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-0.5">
          {t('myWorkTable.fieldManager.description')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={locked}
          rows={2}
          placeholder={t('myWorkTable.fieldManager.optionalFieldDescription')}
          className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-2.5 py-1.5 text-[11px] text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 resize-none disabled:opacity-50"
        />
      </div>

      {/* Type-specific options display */}
      <FieldOptionsDisplay field={field} isPl={isPl} />

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        {!locked && !isPrimary && (
          <>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-danger-500 font-medium">
                  {t('myWorkTable.fieldManager.areYouSure')}
                </span>
                <button
                  onClick={onDelete}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-danger-500 hover:bg-danger-600 transition-colors"
                >
                  {t('myWorkTable.fieldManager.yes')}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold text-c-text-muted hover:bg-c-surface-raised transition-colors"
                >
                  {t('myWorkTable.fieldManager.no')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-danger-500 hover:text-danger-600 transition-colors"
              >
                <Trash2 size={10} />
                {t('myWorkTable.fieldManager.delete')}
              </button>
            )}
          </>
        )}
        {isPrimary && (
          <span className="text-[9px] text-c-text-secondary italic">
            {t('myWorkTable.fieldManager.primaryFieldCannotBeDeleted')}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={!hasChanges || locked || saving}
          className="ml-auto px-3 py-1 rounded-lg text-[10px] font-semibold bg-c-text text-c-bg hover:bg-c-text-secondary transition-colors disabled:opacity-40"
        >
          {saving ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            t('myWorkTable.fieldManager.save')
          )}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// FieldOptionsDisplay — read-only display of type-specific options
// ---------------------------------------------------------------------------

const FieldOptionsDisplay: React.FC<{ field: TablePlatformField; isPl: boolean }> = ({
  field,
  isPl,
}) => {
  const { t } = useTranslation();
  const opts = field.options as Record<string, unknown>;
  if (!opts || Object.keys(opts).length === 0) return null;

  const items: Array<{ label: string; value: string }> = [];

  if (field.fieldType === 'singleSelect' || field.fieldType === 'multiSelect') {
    const options = (opts.options as Array<{ name?: string; value?: string }>) ?? [];
    if (options.length > 0) {
      items.push({
        label: t('myWorkTable.fieldManager.options'),
        value: options.map((o) => o.name ?? o.value ?? '').join(', '),
      });
    }
  }

  if (field.fieldType === 'linkedRecord') {
    if (opts.linkedTableId) {
      items.push({
        label: t('myWorkTable.fieldManager.linkedTable'),
        value: String(opts.linkedTableId),
      });
    }
  }

  if (field.fieldType === 'formula') {
    if (opts.expression || opts.formula) {
      items.push({
        label: t('myWorkTable.fieldManager.formula'),
        value: String(opts.expression ?? opts.formula),
      });
    }
  }

  if (field.fieldType === 'currency') {
    if (opts.currencySymbol) {
      items.push({
        label: t('myWorkTable.fieldManager.symbol'),
        value: String(opts.currencySymbol),
      });
    }
  }

  if (field.fieldType === 'rating') {
    items.push({ label: 'Max', value: String(opts.max ?? 5) });
  }

  if (field.fieldType === 'duration') {
    if (opts.format) {
      items.push({ label: t('myWorkTable.fieldManager.format'), value: String(opts.format) });
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg bg-c-surface-raised p-2 space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-[9px] font-bold text-c-text-secondary whitespace-nowrap">
            {item.label}:
          </span>
          <span className="text-[9px] text-c-text-secondary break-all">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// AddFieldDialog — modal for creating a new field
// ---------------------------------------------------------------------------

interface AddFieldDialogProps {
  isPl: boolean;
  onClose: () => void;
  onAdd: (name: string, fieldType: string, options?: Record<string, unknown>) => Promise<void>;
}

const AddFieldDialog: React.FC<AddFieldDialogProps> = ({ isPl, onClose, onAdd }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('singleLineText');
  const [selectOptions, setSelectOptions] = useState('');
  const [linkedTableId, setLinkedTableId] = useState('');
  const [formulaExpr, setFormulaExpr] = useState('');
  const [ratingMax, setRatingMax] = useState(5);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [adding, setAdding] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useDialogA11y({ open: true, onClose, containerRef: dialogRef, initialFocusRef: nameInputRef });

  const handleCreate = async () => {
    if (!name.trim()) return;
    setAdding(true);
    const options: Record<string, unknown> = {};

    if (fieldType === 'singleSelect' || fieldType === 'multiSelect') {
      const opts = selectOptions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      options.options = opts.map((o, i) => ({ id: `opt_${i}`, name: o }));
    }
    if (fieldType === 'linkedRecord' && linkedTableId) {
      options.linkedTableId = linkedTableId;
    }
    if (fieldType === 'formula' && formulaExpr) {
      options.formula = formulaExpr;
      options.expression = formulaExpr;
    }
    if (fieldType === 'rating') {
      options.max = ratingMax;
    }
    if (fieldType === 'currency') {
      options.currencySymbol = currencySymbol;
    }

    await onAdd(name.trim(), fieldType, Object.keys(options).length > 0 ? options : undefined);
    setAdding(false);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-field-dialog-title"
        tabIndex={-1}
        className="w-[420px] max-h-[80vh] overflow-auto rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <h3 id="add-field-dialog-title" className="text-sm font-bold text-c-text">
            {t('myWorkTable.fieldManager.newField')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={16} className="text-c-text-secondary" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
              {t('myWorkTable.fieldManager.name')}
            </label>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('myWorkTable.fieldManager.eGStatusPriority')}
              className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-[11px] font-bold text-c-text-secondary mb-1.5">
              {t('myWorkTable.fieldManager.type')}
            </label>
            <div className="grid grid-cols-4 gap-1 max-h-[200px] overflow-y-auto">
              {CREATABLE_FIELD_TYPES.map((ft) => {
                const Icon = getFieldIcon(ft);
                const label = FIELD_TYPE_LABELS[ft];
                const isActive = fieldType === ft;
                return (
                  <button
                    key={ft}
                    onClick={() => setFieldType(ft)}
                    className={`flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-xl text-[9px] font-medium transition-all ${
                      isActive
                        ? 'bg-c-surface-raised text-c-text ring-1 ring-c-focus'
                        : 'text-c-text-secondary hover:bg-c-surface-raised'
                    }`}
                  >
                    <Icon size={14} />
                    {isPl ? label?.pl : label?.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type-specific config */}
          {(fieldType === 'singleSelect' || fieldType === 'multiSelect') && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.fieldManager.optionsCommaSeparated')}
              </label>
              <input
                value={selectOptions}
                onChange={(e) => setSelectOptions(e.target.value)}
                placeholder={t(
                  'ideas.table.addColumn.optionsPlaceholder',
                  'Option 1, Option 2, Option 3'
                )}
                className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          )}

          {fieldType === 'linkedRecord' && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.fieldManager.linkedTableId')}
              </label>
              <input
                value={linkedTableId}
                onChange={(e) => setLinkedTableId(e.target.value)}
                placeholder="table-uuid..."
                className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          )}

          {fieldType === 'formula' && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.fieldManager.formulaExpression')}
              </label>
              <input
                value={formulaExpr}
                onChange={(e) => setFormulaExpr(e.target.value)}
                placeholder="IF({Status} = 'Done', 1, 0)"
                className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs font-mono text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          )}

          {fieldType === 'rating' && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('ideas.table.fieldManager.max', 'Max')}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={ratingMax}
                onChange={(e) => setRatingMax(Number(e.target.value))}
                className="w-20 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          )}

          {fieldType === 'currency' && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.fieldManager.currencySymbol')}
              </label>
              <select
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {['$', '€', 'zł', '£', '¥', 'CHF'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            {t('myWorkTable.fieldManager.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || adding}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-c-text text-c-bg hover:bg-c-text-secondary transition-colors disabled:opacity-40"
          >
            {adding ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              t('myWorkTable.fieldManager.createField')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FieldManager;
