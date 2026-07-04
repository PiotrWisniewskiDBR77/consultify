/**
 * ExportMembersDialog - Export member list functionality component
 *
 * Features:
 * - Format selection (CSV, Excel, JSON)
 * - Field selection for export
 * - Filter options (all, active, inactive)
 * - Export preview
 * - Download progress
 *
 * Design: Modal dialog with configuration options
 */

import {
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Loader2,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Modal } from '../../ui/primitives/Modal';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Export format
export type ExportFormat = 'csv' | 'excel' | 'json';

// Export filter
export type ExportFilter = 'all' | 'active' | 'inactive' | 'pending';

// Export field
export interface ExportField {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  sensitive?: boolean;
}

// Export options
export interface ExportOptions {
  format: ExportFormat;
  filter: ExportFilter;
  fields: string[];
  includeHeaders: boolean;
  dateFormat: string;
}

interface ExportMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
  availableFields: ExportField[];
  totalMembers: number;
  filteredCounts: Record<ExportFilter, number>;
  className?: string;
}

// Default fields
const defaultFields: ExportField[] = [
  { id: 'firstName', label: 'First Name', required: true },
  { id: 'lastName', label: 'Last Name', required: true },
  { id: 'email', label: 'Email', required: true },
  { id: 'role', label: 'Role' },
  { id: 'team', label: 'Team' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Created Date' },
  { id: 'lastActiveAt', label: 'Last Active' },
  { id: 'phone', label: 'Phone', sensitive: true },
  { id: 'manager', label: 'Manager' },
  { id: 'department', label: 'Department' },
  { id: 'location', label: 'Location' },
];

export const ExportMembersDialog: React.FC<ExportMembersDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  availableFields = defaultFields,
  totalMembers,
  filteredCounts,
  className,
}) => {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filter, setFilter] = useState<ExportFilter>('all');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(availableFields.filter((f) => f.required).map((f) => f.id))
  );
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  // Toggle field selection
  const toggleField = useCallback(
    (fieldId: string) => {
      setSelectedFields((prev) => {
        const next = new Set(prev);
        const field = availableFields.find((f) => f.id === fieldId);
        if (field?.required) return prev; // Can't toggle required fields

        if (next.has(fieldId)) {
          next.delete(fieldId);
        } else {
          next.add(fieldId);
        }
        return next;
      });
    },
    [availableFields]
  );

  // Select all fields
  const selectAllFields = useCallback(() => {
    setSelectedFields(new Set(availableFields.map((f) => f.id)));
  }, [availableFields]);

  // Deselect all (except required)
  const deselectOptionalFields = useCallback(() => {
    setSelectedFields(new Set(availableFields.filter((f) => f.required).map((f) => f.id)));
  }, [availableFields]);

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await onExport({
        format,
        filter,
        fields: Array.from(selectedFields),
        includeHeaders,
        dateFormat,
      });
      setExportComplete(true);
      setTimeout(() => {
        onClose();
        setExportComplete(false);
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [format, filter, selectedFields, includeHeaders, dateFormat, onExport, onClose]);

  // Get format icon
  const getFormatIcon = (fmt: ExportFormat) => {
    switch (fmt) {
      case 'csv':
        return FileText;
      case 'excel':
        return FileSpreadsheet;
      case 'json':
        return FileJson;
    }
  };

  // Get export count
  const getExportCount = () => filteredCounts[filter] || totalMembers;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t('admin.team.export.title', 'Export Members')}
      className={cn('max-w-2xl', className)}
    >
      <div className="space-y-6">
        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
            {t('admin.team.export.format', 'Export Format')}
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['csv', 'excel', 'json'] as ExportFormat[]).map((fmt) => {
              const Icon = getFormatIcon(fmt);
              return (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all',
                    format === fmt
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-c-info/20'
                      : 'border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700'
                  )}
                >
                  <Icon
                    size={24}
                    className={cn(
                      format === fmt ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'
                    )}
                  />
                  <div className="text-left">
                    <p
                      className={cn(
                        'font-medium',
                        format === fmt
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-navy-900 dark:text-white'
                      )}
                    >
                      {fmt.toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {fmt === 'csv' && '.csv'}
                      {fmt === 'excel' && '.xlsx'}
                      {fmt === 'json' && '.json'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
            {t('admin.team.export.filter', 'Members to Export')}
          </label>
          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'inactive', 'pending'] as ExportFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
                  filter === f
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-primary-300'
                )}
              >
                {f === 'all' && t('admin.team.export.filterAll', 'All Members')}
                {f === 'active' && t('admin.team.export.filterActive', 'Active')}
                {f === 'inactive' && t('admin.team.export.filterInactive', 'Inactive')}
                {f === 'pending' && t('admin.team.export.filterPending', 'Pending')}
                <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                  ({filteredCounts[f] || 0})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Field Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('admin.team.export.fields', 'Fields to Include')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={selectAllFields}
                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                {t('admin.team.export.selectAll', 'Select All')}
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={deselectOptionalFields}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                {t('admin.team.export.deselectOptional', 'Deselect Optional')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
            {availableFields.map((field) => (
              <label
                key={field.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-white dark:hover:bg-navy-800',
                  field.required && 'opacity-60 cursor-not-allowed'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedFields.has(field.id)}
                  onChange={() => toggleField(field.id)}
                  disabled={field.required}
                  className="rounded border-slate-300 dark:border-navy-700"
                />
                <span className="text-sm text-navy-900 dark:text-white flex items-center gap-1">
                  {field.label}
                  {field.required && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">*</span>
                  )}
                  {field.sensitive && (
                    <Tooltip
                      content={t('admin.team.export.sensitiveField', 'Contains sensitive data')}
                    >
                      <span className="text-xs text-amber-500">⚠</span>
                    </Tooltip>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Options */}
        {format !== 'json' && (
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHeaders}
                onChange={(e) => setIncludeHeaders(e.target.checked)}
                className="rounded border-slate-300 dark:border-navy-700"
              />
              <span className="text-sm text-navy-900 dark:text-white">
                {t('admin.team.export.includeHeaders', 'Include column headers')}
              </span>
            </label>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                {t('admin.team.export.dateFormat', 'Date format:')}
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="px-2 py-1 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="ISO">ISO 8601</option>
              </select>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t(
              'admin.team.export.summary',
              'Export {{count}} members with {{fields}} fields in {{format}} format',
              {
                count: getExportCount(),
                fields: selectedFields.size,
                format: format.toUpperCase(),
              }
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-navy-700">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedFields.size === 0}
            icon={
              isExporting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : exportComplete ? (
                <Check size={16} />
              ) : (
                <Download size={16} />
              )
            }
          >
            {isExporting
              ? t('admin.team.export.exporting', 'Exporting...')
              : exportComplete
                ? t('admin.team.export.complete', 'Export Complete!')
                : t('admin.team.export.export', 'Export')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportMembersDialog;
