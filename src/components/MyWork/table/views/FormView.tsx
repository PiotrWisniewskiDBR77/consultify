/**
 * FormView (Platform) — Single-record form view for the Table Platform.
 * Shows one record at a time as a vertical form with navigation (prev/next),
 * create new, and support for all field types. Layout: single or two-column.
 */
import { ChevronLeft, ChevronRight, FileText, Plus, Star } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from '../tableTypes';
import { COLUMN_TYPE_LABELS, SELECT_COLORS } from '../tableTypes';

export interface FormViewConfig {
  visibleFieldIds?: string[];
  layout?: 'single-column' | 'two-column';
}

export interface FormViewProps {
  records: TableNode[];
  columns: ColumnDef[];
  config: FormViewConfig;
  onRecordUpdate?: (recordId: string, data: Record<string, unknown>) => void;
  onRecordCreate?: (data: Record<string, unknown>) => void;
}

const FieldRenderer: React.FC<{
  col: ColumnDef;
  value: unknown;
  onChange: (val: unknown) => void;
  isPl: boolean;
}> = ({ col, value, onChange, isPl }) => {
  const baseInput =
    'w-full h-9 px-3 rounded-xl text-xs bg-c-surface-raised border border-c-border-subtle text-c-text outline-none focus:ring-2 focus:ring-c-focus transition-all';

  switch (col.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      return (
        <input
          type={
            col.type === 'email'
              ? 'email'
              : col.type === 'url'
                ? 'url'
                : col.type === 'phone'
                  ? 'tel'
                  : 'text'
          }
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
          placeholder={isPl ? 'Wpisz wartość...' : 'Enter value...'}
        />
      );

    case 'number':
    case 'currency':
      return (
        <input
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className={baseInput}
          placeholder="0"
        />
      );

    case 'date':
    case 'created_time':
    case 'last_edited_time':
      return (
        <input
          type="date"
          value={value ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
        />
      );

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-c-border-subtle text-c-accent focus:ring-c-focus"
          />
          <span className="text-xs text-c-text-muted">
            {value ? (isPl ? 'Tak' : 'Yes') : isPl ? 'Nie' : 'No'}
          </span>
        </label>
      );

    case 'select':
    case 'status':
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          className={baseInput}
        >
          <option value="">{isPl ? '— Wybierz —' : '— Select —'}</option>
          {(col.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case 'multiselect': {
      const selected = Array.isArray(value) ? value : value ? String(value).split(',') : [];
      return (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-c-border-subtle bg-c-surface-raised min-h-[36px]">
          {(col.options || []).map((opt, i) => {
            const isSelected = selected.includes(opt);
            const bgColor = col.optionColors?.[opt] || SELECT_COLORS[i % SELECT_COLORS.length];
            return (
              <button
                key={opt}
                onClick={() => {
                  const next = isSelected ? selected.filter((s) => s !== opt) : [...selected, opt];
                  onChange(next);
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all ${
                  isSelected
                    ? 'ring-2 ring-c-focus shadow-sm'
                    : 'opacity-50 hover:opacity-80'
                }`}
                style={{ backgroundColor: bgColor, color: 'var(--c-text-secondary)' }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    case 'rating': {
      const numVal = Number(value) || 0;
      return (
        <div className="flex items-center gap-1 py-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange(n === numVal ? 0 : n)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={18}
                className={
                  n <= numVal
                    ? 'text-c-warning fill-amber-400'
                    : 'text-c-text-secondary'
                }
              />
            </button>
          ))}
        </div>
      );
    }

    case 'progress': {
      const pct = Math.min(Math.max(Number(value) || 0, 0), 100);
      return (
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-c-surface-raised accent-c-accent"
          />
          <span className="text-xs font-bold text-c-text-muted w-10 text-right">
            {pct}%
          </span>
        </div>
      );
    }

    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
          placeholder={isPl ? 'Wpisz wartość...' : 'Enter value...'}
        />
      );
  }
};

export const FormView: React.FC<FormViewProps> = ({
  records,
  columns,
  config,
  onRecordUpdate,
  onRecordCreate,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [newRecordData, setNewRecordData] = useState<Record<string, unknown> | null>(null);

  const visibleColumns = useMemo(() => {
    if (config.visibleFieldIds && config.visibleFieldIds.length > 0) {
      const set = new Set(config.visibleFieldIds);
      return columns.filter((c) => set.has(c.key));
    }
    return columns.filter((c) => c.visible);
  }, [columns, config.visibleFieldIds]);

  const layout = config.layout || 'single-column';
  const currentRecord = records[currentIndex] || null;
  const isCreating = newRecordData !== null;

  const handleFieldChange = useCallback(
    (fieldId: string, val: unknown) => {
      if (isCreating) {
        setNewRecordData((prev) => ({ ...prev, [fieldId]: val }));
      } else if (currentRecord && onRecordUpdate) {
        onRecordUpdate(currentRecord.id, { [fieldId]: val });
      }
    },
    [currentRecord, isCreating, onRecordUpdate]
  );

  const handleCreate = useCallback(() => {
    if (newRecordData && onRecordCreate) {
      onRecordCreate(newRecordData);
      setNewRecordData(null);
      setCurrentIndex(records.length);
    }
  }, [newRecordData, onRecordCreate, records.length]);

  const startCreate = useCallback(() => {
    setNewRecordData({});
  }, []);

  const cancelCreate = useCallback(() => {
    setNewRecordData(null);
  }, []);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
    setNewRecordData(null);
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(records.length - 1, i + 1));
    setNewRecordData(null);
  }, [records.length]);

  const displayData = isCreating ? newRecordData! : currentRecord?.data || {};

  if (records.length === 0 && !isCreating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-c-text-muted gap-3 p-8">
        <div className="w-16 h-16 rounded-2xl bg-c-surface-raised flex items-center justify-center">
          <FileText size={28} className="text-c-text-muted" />
        </div>
        <span className="text-sm font-medium">{isPl ? 'Brak rekordów' : 'No records'}</span>
        {onRecordCreate && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-c-text text-c-surface hover:opacity-90 transition-colors"
          >
            <Plus size={14} />
            {isPl ? 'Utwórz pierwszy rekord' : 'Create first record'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Navigation bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-c-border-subtle">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={currentIndex <= 0 || isCreating}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={16} className="text-c-text-muted" />
          </button>
          <span className="text-xs font-bold text-c-text-muted min-w-[80px] text-center">
            {isCreating
              ? isPl
                ? 'Nowy rekord'
                : 'New record'
              : `${currentIndex + 1} / ${records.length}`}
          </span>
          <button
            onClick={goNext}
            disabled={currentIndex >= records.length - 1 || isCreating}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors disabled:opacity-30"
          >
            <ChevronRight size={16} className="text-c-text-muted" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isCreating ? (
            <>
              <button
                onClick={cancelCreate}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-c-text-muted hover:bg-c-surface-raised transition-colors"
              >
                {isPl ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={handleCreate}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-c-text text-c-surface hover:opacity-90 transition-colors"
              >
                {isPl ? 'Zapisz' : 'Save'}
              </button>
            </>
          ) : onRecordCreate ? (
            <button
              onClick={startCreate}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-c-accent hover:bg-c-accent-soft transition-colors"
            >
              <Plus size={12} />
              {isPl ? 'Nowy' : 'New'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-auto p-6">
        <div
          className={`max-w-3xl mx-auto ${layout === 'two-column' ? 'grid grid-cols-2 gap-x-6 gap-y-4' : 'space-y-4'}`}
        >
          {visibleColumns.map((col) => {
            const typeLabel = COLUMN_TYPE_LABELS[col.type];
            return (
              <div key={col.key}>
                <label className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-bold text-c-text">
                    {col.header}
                  </span>
                  <span className="text-[8px] font-medium text-c-text-muted uppercase tracking-wider">
                    {isPl ? typeLabel?.pl : typeLabel?.en}
                  </span>
                </label>
                <FieldRenderer
                  col={col}
                  value={displayData[col.key]}
                  onChange={(val) => handleFieldChange(col.key, val)}
                  isPl={isPl}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FormView;
