/**
 * ExecutionProgress — shows real-time execution progress for Chat-to-Schema proposals.
 * Displays operation list with status indicators, progress bar, error details, and undo button.
 */
import {
  AlertCircle,
  Check,
  Circle,
  Columns3,
  Database,
  Edit3,
  Eye,
  Layers,
  Loader2,
  type LucideIcon,
  RotateCcw,
  Table2,
  Trash2,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OperationStatus = 'pending' | 'running' | 'success' | 'failed';

export interface ExecutionOperation {
  id: string;
  operationType: string;
  description: string;
  status: OperationStatus;
  error?: string;
}

export interface ExecutionProgressProps {
  operations: ExecutionOperation[];
  onUndo?: () => Promise<void>;
  undoLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OP_ICONS: Record<string, LucideIcon> = {
  create_base: Database,
  add_base: Database,
  create_table: Table2,
  add_table: Table2,
  create_field: Columns3,
  add_field: Columns3,
  update_field: Edit3,
  delete_field: Trash2,
  create_view: Eye,
  add_view: Eye,
  create_record: Layers,
  add_record: Layers,
};

function getOpIcon(opType: string): LucideIcon {
  return OP_ICONS[opType] ?? Columns3;
}

function getStatusIndicator(status: OperationStatus): React.ReactNode {
  switch (status) {
    case 'success':
      return (
        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center transition-all duration-300 scale-100 animate-in zoom-in">
          <Check size={12} className="text-white" />
        </div>
      );
    case 'running':
      return (
        <div className="w-5 h-5 rounded-full bg-c-surface flex items-center justify-center">
          <Loader2 size={12} className="text-white animate-spin" />
        </div>
      );
    case 'failed':
      return (
        <div className="w-5 h-5 rounded-full bg-danger-500 flex items-center justify-center transition-all duration-300 animate-in zoom-in">
          <AlertCircle size={12} className="text-white" />
        </div>
      );
    case 'pending':
    default:
      return (
        <div className="w-5 h-5 rounded-full border-2 border-c-border-subtle flex items-center justify-center">
          <Circle size={8} className="text-c-text-secondary" />
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExecutionProgress: React.FC<ExecutionProgressProps> = ({
  operations,
  onUndo,
  undoLoading = false,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const stats = useMemo(() => {
    const total = operations.length;
    const success = operations.filter((o) => o.status === 'success').length;
    const failed = operations.filter((o) => o.status === 'failed').length;
    const running = operations.filter((o) => o.status === 'running').length;
    const done = success + failed;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const allDone = done === total;
    const hasErrors = failed > 0;
    return { total, success, failed, running, done, percent, allDone, hasErrors };
  }, [operations]);

  const progressColor = stats.hasErrors
    ? 'bg-danger-500'
    : stats.allDone
      ? 'bg-emerald-500'
      : 'bg-c-surface';

  const statusLabel = stats.allDone
    ? stats.hasErrors
      ? isPl
        ? 'Zakończono z błędami'
        : 'Completed with errors'
      : isPl
        ? 'Zakończono pomyślnie'
        : 'Completed successfully'
    : isPl
      ? 'Wykonywanie…'
      : 'Executing…';

  return (
    <div className="rounded-2xl border border-c-accent bg-c-surface shadow-xl overflow-hidden transition-all duration-200">
      {/* Header + Progress bar */}
      <div className="px-4 py-3 border-b border-c-border-subtle">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {!stats.allDone && <Loader2 size={14} className="animate-spin text-c-accent" />}
            {stats.allDone && !stats.hasErrors && <Check size={14} className="text-emerald-500" />}
            {stats.allDone && stats.hasErrors && (
              <AlertCircle size={14} className="text-danger-500" />
            )}
            <span className="text-xs font-semibold text-c-text">
              {statusLabel}
            </span>
          </div>
          <span className="text-[10px] text-c-text-secondary font-mono">
            {stats.done}/{stats.total}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-c-border-subtle overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${progressColor}`}
            style={{ width: `${stats.percent}%` }}
          />
        </div>
      </div>

      {/* Operations list */}
      <div className="px-4 py-3 space-y-1.5 max-h-56 overflow-y-auto">
        {operations.map((op, idx) => {
          const Icon = getOpIcon(op.operationType);
          const isActive = op.status === 'running';
          const isDone = op.status === 'success';
          const isFailed = op.status === 'failed';

          return (
            <div
              key={op.id}
              className={`flex items-start gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-c-accent-soft border border-c-accent'
                  : isFailed
                    ? 'bg-danger-500/5 dark:bg-danger-500/10 border border-danger-500/20'
                    : isDone
                      ? 'bg-emerald-500/5 dark:bg-emerald-500/5 border border-transparent'
                      : 'border border-transparent opacity-60'
              }`}
            >
              {/* Connector line */}
              <div className="flex flex-col items-center flex-shrink-0">
                {getStatusIndicator(op.status)}
                {idx < operations.length - 1 && (
                  <div
                    className={`w-0.5 h-3 mt-0.5 rounded-full transition-colors ${
                      isDone
                        ? 'bg-emerald-300 dark:bg-emerald-700'
                        : 'bg-c-border-subtle'
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon
                    size={12}
                    className={`flex-shrink-0 ${
                      isDone
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isFailed
                          ? 'text-danger-600 dark:text-danger-400'
                          : isActive
                            ? 'text-c-accent'
                            : 'text-c-text-secondary'
                    }`}
                  />
                  <span
                    className={`text-xs font-medium truncate ${
                      isDone
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : isFailed
                          ? 'text-danger-700 dark:text-danger-300'
                          : isActive
                            ? 'text-c-text'
                            : 'text-c-text-muted'
                    }`}
                  >
                    {op.description}
                  </span>
                </div>
                {isFailed && op.error && (
                  <p className="mt-1 text-[10px] text-danger-600 dark:text-danger-400 leading-tight">
                    {op.error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Undo button (shown after successful execution) */}
      {stats.allDone && !stats.hasErrors && onUndo && (
        <div className="px-4 py-3 border-t border-c-border-subtle bg-c-surface-raised">
          <button
            onClick={onUndo}
            disabled={undoLoading}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {undoLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            {isPl ? 'Cofnij zmiany' : 'Undo changes'}
          </button>
        </div>
      )}

      {/* Error summary */}
      {stats.allDone && stats.hasErrors && (

        <div className="px-4 py-3 border-t border-danger-200/60 dark:border-danger-800/40 bg-danger-50/50 dark:bg-danger-950/20">
          <p className="text-xs text-danger-700 dark:text-danger-300 font-medium">
            {isPl
              ? `${stats.failed} z ${stats.total} operacji nie powiodło się`
              : `${stats.failed} of ${stats.total} operations failed`}
          </p>
        </div>
      )}
    </div>
  );
};

export default ExecutionProgress;
