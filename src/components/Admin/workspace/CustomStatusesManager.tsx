/**
 * CustomStatusesManager - Custom task statuses management component
 *
 * Features:
 * - Add/edit/delete custom statuses
 * - Color picker for status badges
 * - Status categories (To Do, In Progress, Done)
 * - Drag and drop ordering
 * - Default status configuration
 *
 * Design: List with color swatches and inline editing
 */

import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleDashed,
  CircleDot,
  GripVertical,
  HelpCircle,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Status category
export type StatusCategory = 'todo' | 'in_progress' | 'done' | 'blocked';

// Custom status
export interface CustomStatus {
  id: string;
  name: string;
  color: string;
  category: StatusCategory;
  description?: string;
  isDefault?: boolean;
  isSystem?: boolean;
  order: number;
}

interface CustomStatusesManagerProps {
  statuses: CustomStatus[];
  onChange: (statuses: CustomStatus[]) => void;
  onSave?: () => void;
  className?: string;
}

// Available colors
const statusColors = [
  { id: 'gray', value: '#6b7280', name: 'Gray' },
  { id: 'red', value: '#f43f5e', name: 'Red' },
  { id: 'orange', value: '#f59e0b', name: 'Orange' },
  { id: 'amber', value: '#f59e0b', name: 'Amber' },
  { id: 'yellow', value: '#eab308', name: 'Yellow' },
  { id: 'lime', value: '#84cc16', name: 'Lime' },
  { id: 'green', value: '#22c55e', name: 'Green' },
  { id: 'emerald', value: '#10b981', name: 'Emerald' },
  { id: 'teal', value: '#3b82f6', name: 'Teal' },
  { id: 'cyan', value: '#3b82f6', name: 'Cyan' },
  { id: 'sky', value: '#0ea5e9', name: 'Sky' },
  { id: 'blue', value: '#3b82f6', name: 'Blue' },
  { id: 'indigo', value: '#6366f1', name: 'Indigo' },
  { id: 'violet', value: '#6366f1', name: 'Violet' },
  { id: 'purple', value: '#a855f7', name: 'Purple' },
  { id: 'fuchsia', value: '#d946ef', name: 'Fuchsia' },
  { id: 'pink', value: '#ec4899', name: 'Pink' },
  { id: 'rose', value: '#f43f5e', name: 'Rose' },
];

// Category icons and labels
const categoryInfo: Record<
  StatusCategory,
  { icon: React.ElementType; label: string; color: string }
> = {
  todo: { icon: CircleDashed, label: 'To Do', color: 'text-slate-500 dark:text-slate-400' },
  in_progress: { icon: CircleDot, label: 'In Progress', color: 'text-blue-500' },
  done: { icon: CircleCheck, label: 'Done', color: 'text-emerald-500' },
  blocked: { icon: X, label: 'Blocked', color: 'text-danger-500' },
};

export const CustomStatusesManager: React.FC<CustomStatusesManagerProps> = ({
  statuses,
  onChange,
  onSave,
  className,
}) => {
  const { t } = useTranslation();
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<Partial<CustomStatus> | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  // Group statuses by category
  const statusesByCategory = React.useMemo(() => {
    const groups: Record<StatusCategory, CustomStatus[]> = {
      todo: [],
      in_progress: [],
      done: [],
      blocked: [],
    };
    statuses
      .sort((a, b) => a.order - b.order)
      .forEach((status) => {
        groups[status.category].push(status);
      });
    return groups;
  }, [statuses]);

  // Add new status
  const handleAddStatus = useCallback(
    (category: StatusCategory) => {
      setNewStatus({
        id: `status_${Date.now()}`,
        name: '',
        color: statusColors[0].value,
        category,
        order: statuses.length,
      });
    },
    [statuses.length]
  );

  // Save new status
  const handleSaveNewStatus = useCallback(() => {
    if (newStatus && newStatus.name) {
      onChange([...statuses, newStatus as CustomStatus]);
      setNewStatus(null);
    }
  }, [newStatus, statuses, onChange]);

  // Update status
  const updateStatus = useCallback(
    (statusId: string, updates: Partial<CustomStatus>) => {
      onChange(statuses.map((s) => (s.id === statusId ? { ...s, ...updates } : s)));
    },
    [statuses, onChange]
  );

  // Delete status
  const deleteStatus = useCallback(
    (statusId: string) => {
      onChange(statuses.filter((s) => s.id !== statusId));
    },
    [statuses, onChange]
  );

  // Set as default
  const setAsDefault = useCallback(
    (statusId: string, category: StatusCategory) => {
      onChange(
        statuses.map((s) => ({
          ...s,
          isDefault: s.id === statusId ? true : s.category === category ? false : s.isDefault,
        }))
      );
    },
    [statuses, onChange]
  );

  // Move status
  const moveStatus = useCallback(
    (statusId: string, direction: 'up' | 'down') => {
      const statusIndex = statuses.findIndex((s) => s.id === statusId);
      if (statusIndex === -1) return;

      const status = statuses[statusIndex];
      const categoryStatuses = statuses
        .filter((s) => s.category === status.category)
        .sort((a, b) => a.order - b.order);

      const categoryIndex = categoryStatuses.findIndex((s) => s.id === statusId);
      const targetIndex = direction === 'up' ? categoryIndex - 1 : categoryIndex + 1;

      if (targetIndex < 0 || targetIndex >= categoryStatuses.length) return;

      const targetStatus = categoryStatuses[targetIndex];

      onChange(
        statuses.map((s) => {
          if (s.id === statusId) return { ...s, order: targetStatus.order };
          if (s.id === targetStatus.id) return { ...s, order: status.order };
          return s;
        })
      );
    },
    [statuses, onChange]
  );

  // Render status item
  const renderStatusItem = (status: CustomStatus, categoryStatuses: CustomStatus[]) => {
    const isEditing = editingStatus === status.id;
    const statusIndex = categoryStatuses.findIndex((s) => s.id === status.id);

    return (
      <div
        key={status.id}
        className={cn(
          'flex items-center gap-3 p-3 bg-white dark:bg-navy-800 rounded-lg border transition-all',
          isEditing
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-slate-200 dark:border-navy-700'
        )}
      >
        {/* Drag Handle */}
        <div className="cursor-grab text-slate-400 hover:text-slate-600 dark:text-slate-400">
          <GripVertical size={16} />
        </div>

        {/* Move Buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => moveStatus(status.id, 'up')}
            disabled={statusIndex === 0}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 disabled:opacity-30"
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={() => moveStatus(status.id, 'down')}
            disabled={statusIndex === categoryStatuses.length - 1}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 disabled:opacity-30"
          >
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Color Indicator */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(showColorPicker === status.id ? null : status.id)}
            className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: status.color }}
          />

          {/* Color Picker */}
          {showColorPicker === status.id && (
            <div className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-lg z-10">
              <div className="grid grid-cols-6 gap-1">
                {statusColors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => {
                      updateStatus(status.id, { color: color.value });
                      setShowColorPicker(null);
                    }}
                    className={cn(
                      'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                      status.color === color.value
                        ? 'border-c-border-subtle dark:border-white scale-110'
                        : 'border-transparent'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status Name */}
        {isEditing ? (
          <input
            type="text"
            value={status.name}
            onChange={(e) => updateStatus(status.id, { name: e.target.value })}
            className="flex-1 px-2 py-1 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded text-sm text-navy-900 dark:text-white"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-navy-900 dark:text-white">
            {status.name}
          </span>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2">
          {status.isDefault && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
              {t('admin.workspace.statuses.default', 'Default')}
            </span>
          )}
          {status.isSystem && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded">
              {t('admin.workspace.statuses.system', 'System')}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {!status.isDefault && !status.isSystem && (
            <Tooltip content={t('admin.workspace.statuses.setDefault', 'Set as default')}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAsDefault(status.id, status.category)}
                className="h-7 w-7 p-0"
              >
                <Check size={14} />
              </Button>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingStatus(isEditing ? null : status.id)}
            className="h-7 w-7 p-0"
          >
            {isEditing ? <X size={14} /> : <CircleDashed size={14} />}
          </Button>
          {!status.isSystem && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteStatus(status.id)}
              className="h-7 w-7 p-0 text-danger-500 hover:text-danger-600"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            {t('admin.workspace.statuses.title', 'Custom Task Statuses')}
            <Tooltip
              content={t('admin.workspace.statuses.tooltip', 'Configure task workflow statuses')}
            >
              <HelpCircle size={16} className="text-slate-400 dark:text-slate-500" />
            </Tooltip>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('admin.workspace.statuses.subtitle', 'Customize your task workflow')}
          </p>
        </div>
        {onSave && (
          <Button variant="outline" size="sm" onClick={onSave} icon={<Save size={16} />}>
            {t('admin.workspace.statuses.save', 'Save Changes')}
          </Button>
        )}
      </div>

      {/* Status Categories */}
      {(Object.keys(categoryInfo) as StatusCategory[]).map((category) => {
        const info = categoryInfo[category];
        const Icon = info.icon;
        const categoryStatuses = statusesByCategory[category];

        return (
          <div key={category} className="space-y-2">
            {/* Category Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={18} className={info.color} />
                <h4 className="font-medium text-navy-900 dark:text-white">{info.label}</h4>
                <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded">
                  {categoryStatuses.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddStatus(category)}
                className="h-7"
              >
                <Plus size={14} />
                {t('admin.workspace.statuses.add', 'Add')}
              </Button>
            </div>

            {/* Status List */}
            <div className="space-y-2 ml-6">
              {categoryStatuses.map((status) => renderStatusItem(status, categoryStatuses))}

              {/* New Status Form */}
              {newStatus && newStatus.category === category && (
                <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                  <div
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                    style={{ backgroundColor: newStatus.color }}
                  />
                  <input
                    type="text"
                    value={newStatus.name || ''}
                    onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                    placeholder="Status name..."
                    className="flex-1 px-2 py-1 bg-white dark:bg-navy-800 border border-primary-200 dark:border-primary-700 rounded text-sm text-navy-900 dark:text-white"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewStatus(null)}
                    className="h-7 w-7 p-0"
                  >
                    <X size={14} />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNewStatus}
                    disabled={!newStatus.name}
                    className="h-7"
                  >
                    <Check size={14} />
                  </Button>
                </div>
              )}

              {/* Empty State */}
              {categoryStatuses.length === 0 && !newStatus && (
                <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-navy-700 rounded-lg">
                  {t('admin.workspace.statuses.noStatuses', 'No statuses in this category')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CustomStatusesManager;
