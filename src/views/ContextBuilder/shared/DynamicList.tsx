import { Check, Edit2, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface DynamicListItem {
  id: string;
  [key: string]: unknown;
}

export interface ColumnConfig {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'number';
  options?: { label: string; value: string }[]; // For select type
  placeholder?: string;
  width?: string; // Tailwind width class e.g. "w-1/3"
  render?: (item: DynamicListItem) => React.ReactNode; // Custom render function
}

interface DynamicListProps {
  items: DynamicListItem[];
  columns: ColumnConfig[];
  onAdd: (item: Omit<DynamicListItem, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<DynamicListItem>) => void;
  onDelete: (id: string) => void;
  title?: string;
  description?: string;
  emptyStateMessage?: string;
  onRowClick?: (item: DynamicListItem) => void;
}

export const DynamicList: React.FC<DynamicListProps> = ({
  items,
  columns,
  onAdd,
  onUpdate,
  onDelete,
  title,
  description,
  emptyStateMessage,
  onRowClick,
}) => {
  const { t } = useTranslation();
  // Safety check for undefined items
  const safeItems = items || [];
  const resolvedEmptyStateMessage =
    emptyStateMessage ?? t('contextBuilder.dynamicList.empty', 'No items yet. Add one!');

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Staging state for new or edited item
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const handleStartAdd = () => {
    setFormData({});
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (item: DynamicListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({ ...item });
    setEditingId(item.id);
    setIsAdding(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(id);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({});
  };

  const handleSave = () => {
    if (isAdding) {
      onAdd(formData as Omit<DynamicListItem, 'id'>);
    } else if (editingId) {
      onUpdate(editingId, formData);
    }
    handleCancel();
  };

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      {(title || description) && (
        <div className="mb-2">
          {/* h2, nie h3: ta lista renderuje się bezpośrednio po h1 ekranu w wielu
              modułach org-legacy (goals/challenges/strategy) — h3 tu łamał kolejność
              (axe: heading-order, zmierzone na org-success-metrics/scope-boundaries/
              recommendation i rodzeństwie; w challenges h2 zostaje sąsiadem uploadera
              podniesionego do h2 w ContextDocUploader.tsx). */}
          {title && (
            <h2 className="text-lg font-semibold text-navy-900 dark:text-white">{title}</h2>
          )}
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
      )}

      {/* List Header */}
      <div className="hidden md:flex gap-4 px-4 py-2 bg-slate-50 dark:bg-navy-800 rounded-t-lg border border-slate-200 dark:border-navy-700 font-medium text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {columns.map((col) => (
          <div key={col.key} className={`${col.width || 'flex-1'} px-2`}>
            {col.label}
          </div>
        ))}
        <div className="w-20 text-right">
          {t('contextBuilder.dynamicList.actions', 'Actions')}
        </div>
      </div>

      {/* List Items */}
      <div className="space-y-2">
        {safeItems.length === 0 && !isAdding && (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400">
            {resolvedEmptyStateMessage}
          </div>
        )}

        {safeItems.map((item) => {
          const isEditing = editingId === item.id;

          if (isEditing) {
            return (
              <div
                key={item.id}
                className="flex flex-col md:flex-row gap-2 md:gap-4 p-4 bg-white dark:bg-navy-900 border border-primary-500 rounded-lg shadow-sm"
              >
                {columns.map((col) => (
                  <div key={col.key} className={`${col.width || 'flex-1'}`}>
                    <label className="md:hidden text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                      {col.label}
                    </label>
                    {col.type === 'select' ? (
                      <select
                        value={(formData[col.key] as string) || ''}
                        onChange={(e) => handleChange(col.key, e.target.value)}
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-navy-800 text-sm focus-visible:ring-1 focus-visible:ring-c-focus"
                      >
                        <option value="" disabled>
                          {t('contextBuilder.dynamicList.selectPlaceholder', 'Select...')}
                        </option>
                        {col.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={col.type || 'text'}
                        value={(formData[col.key] as string) || ''}
                        onChange={(e) => handleChange(col.key, e.target.value)}
                        placeholder={col.placeholder || col.label}
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-navy-800 text-sm focus-visible:ring-1 focus-visible:ring-c-focus"
                      />
                    )}
                  </div>
                ))}
                <div className="md:w-20 flex items-center justify-end gap-2 pt-2 md:pt-0">
                  <button
                    onClick={handleSave}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30 rounded"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              onClick={() => onRowClick && onRowClick(item)}
              className={`flex flex-col md:flex-row gap-2 md:gap-4 p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg hover:shadow-md transition-all group ${onRowClick ? 'cursor-pointer hover:border-primary-300 active:scale-[0.99] transition-transform' : ''}`}
            >
              {columns.map((col) => (
                <div key={col.key} className={`${col.width || 'flex-1'} flex items-center`}>
                  <span className="md:hidden text-xs font-bold text-slate-600 dark:text-slate-400 mr-2 min-w-[80px]">
                    {col.label}:
                  </span>
                  {col.render ? (
                    col.render(item)
                  ) : (
                    <span className="text-sm text-navy-900 dark:text-slate-200">
                      {String(item[col.key] ?? '')}
                    </span>
                  )}
                </div>
              ))}
              <div className="md:w-20 flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleStartEdit(item, e)}
                  className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-danger-500 hover:bg-danger-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Row */}
        {isAdding ? (
          <div className="flex flex-col md:flex-row gap-2 md:gap-4 p-4 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-500 border-dashed rounded-lg">
            {columns.map((col) => (
              <div key={col.key} className={`${col.width || 'flex-1'}`}>
                <label className="md:hidden text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  {col.label}
                </label>
                {col.type === 'select' ? (
                  <select
                    value={(formData[col.key] as string) || ''}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-navy-800 text-sm focus-visible:ring-1 focus-visible:ring-c-focus"
                  >
                    <option value="" disabled>
                      {t('contextBuilder.dynamicList.selectPlaceholder', 'Select...')}
                    </option>
                    {col.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={col.type || 'text'}
                    value={(formData[col.key] as string) || ''}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    placeholder={col.placeholder || col.label}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-navy-800 text-sm focus-visible:ring-1 focus-visible:ring-c-focus"
                  />
                )}
              </div>
            ))}
            <div className="md:w-20 flex items-center justify-end gap-2 pt-2 md:pt-0">
              <button onClick={handleSave} className="p-2 text-green-600 hover:bg-green-50 rounded">
                <Check size={18} />
              </button>
              <button
                onClick={handleCancel}
                className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30 rounded"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleStartAdd}
            className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all flex items-center justify-center gap-2 font-medium text-sm"
          >
            <Plus size={16} />
            {t('contextBuilder.dynamicList.addItem', 'Add Item')}
          </button>
        )}
      </div>
    </div>
  );
};
