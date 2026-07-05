/**
 * SchemaProposalCard — displays a Chat-to-Schema proposal for review.
 * Enhanced with intent badge, confidence indicator, impact summary,
 * expandable operations, warnings, and approve/reject/refine/undo actions.
 */
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
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
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Operation type labels
// ---------------------------------------------------------------------------

const OP_META: Record<string, { en: string; pl: string; icon: LucideIcon; color: string }> = {
  create_base: {
    en: 'Create base',
    pl: 'Utwórz bazę',
    icon: Database,
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  add_base: {
    en: 'Create base',
    pl: 'Utwórz bazę',
    icon: Database,
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  create_table: {
    en: 'Create table',
    pl: 'Utwórz tabelę',
    icon: Table2,
    color: 'text-c-accent',
  },
  add_table: {
    en: 'Create table',
    pl: 'Utwórz tabelę',
    icon: Table2,
    color: 'text-c-accent',
  },
  create_field: {
    en: 'Add field',
    pl: 'Dodaj pole',
    icon: Columns3,
    color: 'text-sky-600 dark:text-sky-400',
  },
  add_field: {
    en: 'Add field',
    pl: 'Dodaj pole',
    icon: Columns3,
    color: 'text-sky-600 dark:text-sky-400',
  },
  update_field: {
    en: 'Update field',
    pl: 'Aktualizuj pole',
    icon: Edit3,
    color: 'text-amber-600 dark:text-amber-400',
  },
  delete_field: {
    en: 'Delete field',
    pl: 'Usuń pole',
    icon: Trash2,
    color: 'text-danger-600 dark:text-danger-400',
  },
  create_view: {
    en: 'Create view',
    pl: 'Utwórz widok',
    icon: Eye,
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  add_view: {
    en: 'Create view',
    pl: 'Utwórz widok',
    icon: Eye,
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  create_record: {
    en: 'Add record',
    pl: 'Dodaj rekord',
    icon: Layers,
    color: 'text-blue-600 dark:text-blue-400',
  },
  add_record: {
    en: 'Add record',
    pl: 'Dodaj rekord',
    icon: Layers,
    color: 'text-blue-600 dark:text-blue-400',
  },
};

function getOpMeta(
  opType: string,
  isPl: boolean
): { label: string; icon: LucideIcon; color: string } {
  const entry = OP_META[opType] ?? {
    en: opType.replace(/_/g, ' '),
    pl: opType.replace(/_/g, ' '),
    icon: Columns3,
    color: 'text-c-text-muted',
  };
  return { label: isPl ? entry.pl : entry.en, icon: entry.icon, color: entry.color };
}

// ---------------------------------------------------------------------------
// Intent badge labels
// ---------------------------------------------------------------------------

const INTENT_LABELS: Record<string, { en: string; pl: string }> = {
  create_table: { en: 'Create Table', pl: 'Utwórz tabelę' },
  add_fields: { en: 'Add Fields', pl: 'Dodaj pola' },
  modify_schema: { en: 'Modify Schema', pl: 'Modyfikuj schemat' },
  create_view: { en: 'Create View', pl: 'Utwórz widok' },
  create_base: { en: 'Create Base', pl: 'Utwórz bazę' },
  import_data: { en: 'Import Data', pl: 'Importuj dane' },
  complex: { en: 'Complex Change', pl: 'Złożona zmiana' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchemaProposalOperation {
  id: string;
  operationType: string;
  dependsOn?: string[];
  target?: Record<string, string>;
  payload?: Record<string, unknown>;
}

export interface SchemaProposalWarning {
  message: string;
  operationId?: string;
}

export interface SchemaProposalCardProposal {
  id: string;
  intent: string;
  confidence: number;
  summary: string;
  operations: SchemaProposalOperation[];
  warnings: SchemaProposalWarning[];
  status: string;
  created_at?: string;
  version?: number;
}

export interface SchemaProposalCardProps {
  proposal: SchemaProposalCardProposal;
  onApprove: (approvedOperationIds?: string[]) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  onRefine: (message: string) => Promise<void>;
  onUndo?: () => Promise<void>;
  onClose: () => void;
  onShowDiff?: () => void;
  loading?: boolean;
  executed?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatOperationDescription(op: SchemaProposalOperation, isPl: boolean): string {
  const { target, payload } = op;
  const parts: string[] = [];

  const name =
    payload?.name ??
    payload?.fieldName ??
    payload?.tableName ??
    target?.tableName ??
    target?.fieldName ??
    target?.baseName ??
    target?.viewName;
  if (name) parts.push(`'${name}'`);

  const type = payload?.type ?? payload?.fieldType;
  if (type) parts.push(`(${type})`);

  if (payload?.fields && Array.isArray(payload.fields)) {
    const count = payload.fields.length;
    parts.push(isPl ? `z ${count} polami` : `with ${count} fields`);
  }

  const options = payload?.options;
  if (Array.isArray(options) && options.length > 0) {
    parts.push(`[${options.length} ${isPl ? 'opcji' : 'options'}]`);
  }

  return parts.join(' ');
}

function computeImpactSummary(operations: SchemaProposalOperation[], isPl: boolean): string {
  const counts: Record<string, number> = {};
  for (const op of operations) {
    const key = op.operationType.replace(/^add_/, 'create_');
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const parts: string[] = [];
  const labels = isPl
    ? {
        create_base: 'baz',
        create_table: 'tabel',
        create_field: 'pól',
        create_view: 'widoków',
        update_field: 'aktualizacji pól',
        delete_field: 'usunięć pól',
        create_record: 'rekordów',
      }
    : {
        create_base: 'bases',
        create_table: 'tables',
        create_field: 'fields',
        create_view: 'views',
        update_field: 'field updates',
        delete_field: 'field deletions',
        create_record: 'records',
      };

  for (const [key, count] of Object.entries(counts)) {
    const label = labels[key as keyof typeof labels] ?? key.replace(/_/g, ' ');
    parts.push(`${count} ${label}`);
  }

  if (parts.length === 0) return isPl ? 'Brak operacji' : 'No operations';
  const prefix = isPl ? 'Utworzy' : 'Will create';
  return `${prefix}: ${parts.join(', ')}`;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const OperationItem: React.FC<{
  op: SchemaProposalOperation;
  isPl: boolean;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  warning?: SchemaProposalWarning;
}> = ({ op, isPl, selected, expanded, onToggleSelect, onToggleExpand, warning }) => {
  const { label, icon: Icon, color } = getOpMeta(op.operationType, isPl);
  const description = formatOperationDescription(op, isPl);

  return (
    <div
      className={`rounded-xl border transition-all duration-150 ${
        selected
          ? 'border-c-accent bg-c-accent-soft'
          : 'border-c-border-subtle bg-c-surface'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={onToggleSelect}
          className={`flex-shrink-0 w-4 h-4 rounded border transition-colors ${
            selected ? 'border-c-border bg-c-surface' : 'border-c-border'
          } flex items-center justify-center`}
        >
          {selected && <Check size={10} className="text-white" />}
        </button>
        <button
          onClick={onToggleExpand}
          className="flex-shrink-0 p-0.5 text-c-text-secondary hover:text-c-text-secondary transition-colors"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Icon size={14} className={`flex-shrink-0 ${color}`} />
        <span className="text-xs font-medium text-c-text truncate">
          {label}
          {description ? `: ${description}` : ''}
        </span>
        {warning && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 ml-auto" />}
      </div>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {op.payload && (
          <div className="px-3 pb-2 pl-[2.25rem]">
            <div className="text-[10px] text-c-text-muted bg-c-surface-raised rounded-lg p-2 overflow-x-auto max-h-32 overflow-y-auto font-mono">
              {renderPayloadDetails(op.payload, isPl)}
            </div>
            {warning && (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <AlertTriangle size={10} />
                <span>{warning.message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function renderPayloadDetails(payload: Record<string, unknown>, isPl: boolean): React.ReactNode {
  const fields = payload.fields as Array<Record<string, unknown>> | undefined;
  if (fields && Array.isArray(fields)) {
    return (
      <div className="space-y-1">
        {fields.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-c-accent font-semibold">
              {String(f.name ?? f.fieldName ?? `field_${i}`)}
            </span>
            <span className="text-c-text-secondary">—</span>
            <span>{String(f.type ?? f.fieldType ?? 'text')}</span>
            {Boolean(f.required) && (
              <span className="text-danger-500 text-[9px]">{isPl ? 'wymagane' : 'required'}</span>
            )}
          </div>
        ))}
      </div>
    );
  }
  return <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const SchemaProposalCard: React.FC<SchemaProposalCardProps> = ({
  proposal,
  onApprove,
  onReject,
  onRefine,
  onUndo,
  onClose,
  onShowDiff,
  loading = false,
  executed = false,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [selectedOps, setSelectedOps] = useState<Set<string>>(
    () => new Set(proposal.operations.map((o) => o.id))
  );
  const [opsExpanded, setOpsExpanded] = useState<Set<string>>(new Set());
  const [allOpsVisible, setAllOpsVisible] = useState(true);

  const warningsByOp = useMemo(() => {
    const map = new Map<string, SchemaProposalWarning>();
    for (const w of proposal.warnings) {
      if (w.operationId) map.set(w.operationId, w);
    }
    return map;
  }, [proposal.warnings]);

  const globalWarnings = useMemo(
    () => proposal.warnings.filter((w) => !w.operationId),
    [proposal.warnings]
  );

  const toggleOp = useCallback((id: string) => {
    setSelectedOps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setOpsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedOps(new Set(proposal.operations.map((o) => o.id)));
  }, [proposal.operations]);

  const selectNone = useCallback(() => {
    setSelectedOps(new Set());
  }, []);

  const handleApprove = useCallback(async () => {
    const ids = Array.from(selectedOps);
    await onApprove(ids.length > 0 ? ids : undefined);
  }, [onApprove, selectedOps]);

  const handleReject = useCallback(async () => {
    await onReject();
  }, [onReject]);

  // Confidence
  const confidence = proposal.confidence;
  const confidenceColor =
    confidence >= 0.8
      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
      : confidence >= 0.6
        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
        : 'bg-danger-500/20 text-danger-700 dark:text-danger-300 border-danger-500/30';

  const confidenceDot =
    confidence >= 0.8 ? 'bg-emerald-500' : confidence >= 0.6 ? 'bg-amber-500' : 'bg-danger-500';

  const confidencePercent = Math.round(confidence * 100);

  // Intent badge
  const intentEntry = INTENT_LABELS[proposal.intent];
  const intentLabel = intentEntry
    ? isPl
      ? intentEntry.pl
      : intentEntry.en
    : proposal.intent.replace(/_/g, ' ');

  // Impact summary
  const impactText = computeImpactSummary(proposal.operations, isPl);

  // Timestamp
  const timeStr = formatTimestamp(proposal.created_at);

  return (
    <div className="rounded-2xl border border-c-accent bg-c-surface shadow-xl overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-c-border-subtle bg-c-accent-soft">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-c-accent-soft text-c-accent border border-c-accent">
            {intentLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold border ${confidenceColor}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${confidenceDot}`} />
            {confidencePercent}%
          </span>
          {proposal.version && proposal.version > 1 && (
            <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              v{proposal.version}
            </span>
          )}
          {timeStr && (
            <span className="inline-flex items-center gap-1 text-[10px] text-c-text-secondary">
              <Clock size={10} />
              {timeStr}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-c-surface-raised text-c-text-secondary hover:text-c-text-secondary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 bg-c-surface-raised border-b border-c-border-subtle">
        <p className="text-sm text-c-text leading-relaxed">
          {proposal.summary}
        </p>
        <p className="mt-1.5 text-[11px] text-c-text-muted font-medium">
          {impactText}
        </p>
      </div>

      {/* Operations */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setAllOpsVisible((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-c-text-secondary hover:text-c-text-secondary transition-colors"
          >
            {allOpsVisible ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {isPl ? 'Operacje' : 'Operations'} ({proposal.operations.length})
          </button>
          {allOpsVisible && (
            <div className="flex gap-1">
              <button
                onClick={selectAll}
                className="text-[10px] text-c-accent hover:underline"
              >
                {isPl ? 'Wszystkie' : 'All'}
              </button>
              <span className="text-c-text-secondary">|</span>
              <button
                onClick={selectNone}
                className="text-[10px] text-c-accent hover:underline"
              >
                {isPl ? 'Żadne' : 'None'}
              </button>
              {onShowDiff && (
                <>
                  <span className="text-c-text-secondary">|</span>
                  <button
                    onClick={onShowDiff}
                    className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    {isPl ? 'Podgląd diff' : 'Diff preview'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div
          className={`space-y-1.5 overflow-hidden transition-all duration-200 ${
            allOpsVisible ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {proposal.operations.map((op) => (
              <OperationItem
                key={op.id}
                op={op}
                isPl={isPl}
                selected={selectedOps.has(op.id)}
                expanded={opsExpanded.has(op.id)}
                onToggleSelect={() => toggleOp(op.id)}
                onToggleExpand={() => toggleExpand(op.id)}
                warning={warningsByOp.get(op.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Global Warnings */}
      {globalWarnings.length > 0 && (
        <div className="px-4 py-3 border-t border-c-border-subtle">
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-400/30 dark:border-amber-500/30 p-3">
            <AlertTriangle
              size={14}
              className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
            />
            <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
              {globalWarnings.map((w, i) => (
                <p key={i}>{w.message}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-c-border-subtle bg-c-surface-raised">
        {!executed ? (
          <>
            <button
              onClick={handleApprove}
              disabled={loading || selectedOps.size === 0}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isPl ? 'Zatwierdź' : 'Approve'}
              {selectedOps.size < proposal.operations.length &&
                ` (${selectedOps.size}/${proposal.operations.length})`}
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold bg-danger-600 text-white hover:bg-danger-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <X size={14} />
              {isPl ? 'Odrzuć' : 'Reject'}
            </button>
            <button
              onClick={() => onRefine('')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Edit3 size={14} />
              {isPl ? 'Doprecyzuj' : 'Refine'}
            </button>
          </>
        ) : (
          onUndo && (
            <button
              onClick={onUndo}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              {isPl ? 'Cofnij' : 'Undo'}
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default SchemaProposalCard;
