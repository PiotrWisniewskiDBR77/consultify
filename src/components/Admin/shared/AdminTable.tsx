/**
 * AdminTable - Clean minimalist table component
 *
 * Design: Monochrome, subtle borders, clean typography
 * Key principles:
 * - No background on thead
 * - Subtle borders (white/[0.06])
 * - Gentle hover states (white/[0.02])
 * - Reduced padding for density
 */

import { Loader2 } from 'lucide-react';
import React from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (item: T) => void;
  className?: string;
  compact?: boolean;
}

export function AdminTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id' as keyof T,
  emptyMessage = 'No data available',
  loading = false,
  onRowClick,
  className = '',
  compact = false,
}: AdminTableProps<T>) {
  const paddingClass = compact ? 'px-3 py-2' : 'px-4 py-3';

  if (loading) {
    return (
      <div
        className={`border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-transparent rounded-xl overflow-hidden ${className}`}
      >
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-slate-500 dark:text-slate-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={`border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-transparent rounded-xl overflow-hidden ${className}`}
      >
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-transparent rounded-xl overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto">
        <table
          /* §27-exempt: generyczny prymityw tabeli, FilterableTable = kanon dla list */ className="w-full text-left"
        >
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/[0.06]">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className={`
                                        ${paddingClass} text-xs font-medium text-slate-600 dark:text-slate-400
                                        uppercase tracking-wider
                                        ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                                        ${col.className || ''}
                                    `.trim()}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, rowIndex) => (
              <tr
                key={String(item[keyField]) || rowIndex}
                onClick={() => onRowClick?.(item)}
                className={`
                                    border-b border-slate-200 dark:border-white/[0.04] last:border-b-0
                                    hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors
                                    ${onRowClick ? 'cursor-pointer' : ''}
                                `}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`
                                            ${paddingClass} text-sm text-slate-700 dark:text-slate-300
                                            ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                                            ${col.className || ''}
                                        `.trim()}
                  >
                    {col.render
                      ? col.render(item, rowIndex)
                      : String(item[col.key as keyof T] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Status Badge component for use in tables
 * DBR77 Color System - See: docs/ui-standards/00-foundation/color-system.md
 *
 * Variants:
 * - success: Zielony (Active, Healthy)
 * - warning: Fiolet primary (Pending) - BRAK żółtego/pomarańczowego!
 * - error: Czerwony (Error, Failed)
 * - info: Navy secondary (Info)
 * - neutral: Szary (Inactive)
 */
type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  dot?: boolean;
}

const badgeConfig: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-success-500/10', text: 'text-success-400', dot: 'bg-success-400' },
  warning: { bg: 'bg-primary-500/10', text: 'text-primary-400', dot: 'bg-primary-400' }, // Fiolet zamiast amber
  error: { bg: 'bg-danger-500/10', text: 'text-danger-400', dot: 'bg-danger-400' },
  info: { bg: 'bg-secondary-500/10', text: 'text-secondary-400', dot: 'bg-secondary-400' }, // Navy zamiast blue
  neutral: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-600 dark:text-slate-500',
    dot: 'bg-slate-400',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, label, dot = true }) => {
  const config = badgeConfig[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
      {label}
    </span>
  );
};

// Legacy status mapping for backward compatibility
interface LegacyStatusBadgeProps {
  status: 'healthy' | 'warning' | 'error' | 'inactive' | 'pending' | 'active';
  label?: string;
}

const legacyStatusMap: Record<string, { variant: BadgeVariant; defaultLabel: string }> = {
  healthy: { variant: 'success', defaultLabel: 'Active' },
  active: { variant: 'success', defaultLabel: 'Active' },
  warning: { variant: 'warning', defaultLabel: 'Warning' },
  pending: { variant: 'warning', defaultLabel: 'Pending' },
  error: { variant: 'error', defaultLabel: 'Error' },
  inactive: { variant: 'neutral', defaultLabel: 'Inactive' },
};

export const LegacyStatusBadge: React.FC<LegacyStatusBadgeProps> = ({ status, label }) => {
  const config = legacyStatusMap[status] || legacyStatusMap.inactive;
  return <StatusBadge variant={config.variant} label={label || config.defaultLabel} />;
};

// Action buttons for table rows
interface TableActionProps {
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  variant?: 'ghost' | 'danger';
}

export const TableAction: React.FC<TableActionProps> = ({
  icon,
  onClick,
  label,
  variant = 'ghost',
}) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`p-1.5 rounded-lg transition-colors ${
        variant === 'danger'
          ? 'text-slate-600 dark:text-slate-500 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-500/10'
          : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
      }`}
      title={label}
    >
      {icon}
    </button>
  );
};

// Table actions wrapper for alignment
export const TableActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center justify-end gap-1">{children}</div>
);

export default AdminTable;
