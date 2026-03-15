/**
 * ChatToSchemaPanel — NL input + proposal display for Chat-to-Schema.
 * Enhanced with multi-line input, quick action chips, proposal history,
 * schema context summary, and full approve/reject/refine/undo flow.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  History,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSchemaProposal, type ProposalHistoryEntry } from './useSchemaProposal';
import {
  SchemaProposalCard,
  type SchemaProposalCardProposal,
} from './SchemaProposalCard';
import { SchemaDiffPreview, type DiffChange, type DiffTable } from './SchemaDiffPreview';
import { RefineDialog, type RefinementHistoryEntry } from './RefineDialog';
import {
  ExecutionProgress,
  type ExecutionOperation,
  type OperationStatus,
} from './ExecutionProgress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatToSchemaPanelProps {
  workspaceId: string;
  existingSchema?: unknown;
  onExecuted?: (result: unknown) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Normalize helpers
// ---------------------------------------------------------------------------

function normalizeProposal(raw: unknown): SchemaProposalCardProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id ?? r.proposalId) as string;
  if (!id) return null;

  const operations = Array.isArray(r.operations)
    ? (r.operations as Array<Record<string, unknown>>).map((o) => ({
        id: String(o.id ?? o.operationId ?? ''),
        operationType: String(o.operationType ?? o.type ?? 'unknown'),
        dependsOn: o.dependsOn as string[] | undefined,
        target: o.target as Record<string, string> | undefined,
        payload: o.payload as Record<string, unknown> | undefined,
      }))
    : [];

  const warnings = Array.isArray(r.warnings)
    ? (r.warnings as Array<{ message: string; operationId?: string }>)
    : [];

  return {
    id,
    intent: String(r.intent ?? 'unknown'),
    confidence: Math.min(1, Math.max(0, Number(r.confidence ?? 0.5))),
    summary: String(r.summary ?? ''),
    operations,
    warnings,
    status: String(r.status ?? 'pending'),
    created_at: r.created_at as string | undefined,
    version: Number(r.version ?? 1),
  };
}

function extractDiffChanges(proposal: SchemaProposalCardProposal): DiffChange[] {
  return proposal.operations.map((op) => {
    const tableName = op.target?.tableName ?? String(op.payload?.tableName ?? '');
    switch (op.operationType) {
      case 'create_table':
      case 'add_table': {
        const fields = (op.payload?.fields as Array<Record<string, unknown>> | undefined)?.map((f) => ({
          name: String(f.name ?? f.fieldName ?? ''),
          type: String(f.type ?? f.fieldType ?? 'text'),
          required: Boolean(f.required),
          options: f.options as Record<string, unknown> | undefined,
        })) ?? [];
        return {
          type: 'add_table' as const,
          tableName: String(op.payload?.name ?? tableName),
          newTable: { name: String(op.payload?.name ?? tableName), fields },
        };
      }
      case 'create_field':
      case 'add_field':
        return {
          type: 'add_field' as const,
          tableName,
          field: {
            name: String(op.payload?.name ?? op.payload?.fieldName ?? ''),
            type: String(op.payload?.type ?? op.payload?.fieldType ?? 'text'),
            required: Boolean(op.payload?.required),
            options: op.payload?.options as Record<string, unknown> | undefined,
          },
        };
      case 'update_field':
        return {
          type: 'update_field' as const,
          tableName,
          oldField: {
            name: String(op.target?.fieldName ?? op.payload?.name ?? ''),
            type: String(op.payload?.oldType ?? 'text'),
          },
          newField: {
            name: String(op.payload?.name ?? op.target?.fieldName ?? ''),
            type: String(op.payload?.type ?? op.payload?.fieldType ?? 'text'),
            options: op.payload?.options as Record<string, unknown> | undefined,
          },
        };
      case 'delete_field':
        return {
          type: 'delete_field' as const,
          tableName,
          field: {
            name: String(op.target?.fieldName ?? op.payload?.name ?? ''),
            type: String(op.payload?.type ?? 'text'),
          },
        };
      default:
        return {
          type: 'add_field' as const,
          tableName,
          field: { name: op.operationType, type: 'unknown' },
        };
    }
  });
}

function extractCurrentSchema(existingSchema: unknown): DiffTable[] {
  if (!existingSchema || typeof existingSchema !== 'object') return [];
  if (Array.isArray(existingSchema)) {
    return existingSchema.map((t: Record<string, unknown>) => ({
      name: String(t.name ?? ''),
      fields: Array.isArray(t.fields)
        ? t.fields.map((f: Record<string, unknown>) => ({
            name: String(f.name ?? ''),
            type: String(f.type ?? f.fieldType ?? 'text'),
            required: Boolean(f.required),
          }))
        : [],
    }));
  }
  const r = existingSchema as Record<string, unknown>;
  if (Array.isArray(r.tables)) return extractCurrentSchema(r.tables);
  return [];
}

function buildExecutionOps(
  proposal: SchemaProposalCardProposal,
  _isPl: boolean
): ExecutionOperation[] {
  return proposal.operations.map((op) => {
    const name = op.payload?.name ?? op.target?.tableName ?? op.target?.fieldName ?? op.operationType;
    return {
      id: op.id,
      operationType: op.operationType,
      description: `${op.operationType.replace(/_/g, ' ')}: ${name}`,
      status: 'pending' as OperationStatus,
    };
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const QuickActionChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-medium text-slate-500 dark:text-zinc-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {icon}
    {label}
  </button>
);

const SchemaContextSummary: React.FC<{
  schema: DiffTable[];
  isPl: boolean;
}> = ({ schema, isPl }) => {
  if (schema.length === 0) return null;
  const totalFields = schema.reduce((sum, t) => sum + t.fields.length, 0);
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200/40 dark:border-zinc-700/40 bg-slate-50/30 dark:bg-zinc-800/20">
      <Database size={12} className="text-slate-400 dark:text-zinc-500" />
      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
        {isPl ? 'Aktualny schemat' : 'Current schema'}:
        {' '}{schema.length} {isPl ? 'tabel' : 'tables'}, {totalFields} {isPl ? 'pól' : 'fields'}
      </span>
      <div className="flex items-center gap-1 ml-auto">
        {schema.slice(0, 3).map((t) => (
          <span
            key={t.name}
            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 truncate max-w-[80px]"
          >
            {t.name}
          </span>
        ))}
        {schema.length > 3 && (
          <span className="text-[9px] text-slate-400 dark:text-zinc-500">
            +{schema.length - 3}
          </span>
        )}
      </div>
    </div>
  );
};

const ProposalHistoryList: React.FC<{
  history: ProposalHistoryEntry[];
  isPl: boolean;
}> = ({ history, isPl }) => {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="border-t border-slate-200/40 dark:border-zinc-700/40">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 px-4 py-2 w-full text-[10px] font-medium text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
      >
        <History size={12} />
        {isPl ? 'Historia propozycji' : 'Proposal history'} ({history.length})
        {expanded ? <ChevronDown size={10} className="ml-auto" /> : <ChevronRight size={10} className="ml-auto" />}
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-3 space-y-1 max-h-32 overflow-y-auto">
          {history.map((entry) => (
            <div
              key={`${entry.id}-${entry.timestamp}`}
              className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400"
            >
              <Clock size={10} className="flex-shrink-0" />
              <span className="truncate flex-1">{entry.summary || entry.intent}</span>
              <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                entry.status === 'executed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : entry.status === 'rejected' ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : entry.status === 'refined' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
              }`}>
                {entry.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ChatToSchemaPanel: React.FC<ChatToSchemaPanelProps> = ({
  workspaceId,
  existingSchema,
  onExecuted,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const {
    proposal: rawProposal,
    loading,
    error,
    executionResult,
    proposalHistory,
    generateProposal,
    executeProposal,
    rejectProposal,
    refineProposal,
    undoProposal,
    clearProposal,
    clearError,
  } = useSchemaProposal();

  const [inputValue, setInputValue] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [showRefineDialog, setShowRefineDialog] = useState(false);
  const [refinementHistory, setRefinementHistory] = useState<RefinementHistoryEntry[]>([]);
  const [executionOps, setExecutionOps] = useState<ExecutionOperation[] | null>(null);
  const [executed, setExecuted] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const proposal = normalizeProposal(rawProposal);
  const currentSchema = useMemo(() => extractCurrentSchema(existingSchema), [existingSchema]);
  const diffChanges = useMemo(() => (proposal ? extractDiffChanges(proposal) : []), [proposal]);

  useEffect(() => {
    if (rawProposal != null) setInputValue('');
  }, [rawProposal]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  // Handlers
  const handleSubmit = useCallback(async () => {
    const msg = inputValue.trim();
    if (!msg || loading) return;
    setExecutionOps(null);
    setExecuted(false);
    await generateProposal(workspaceId, msg, existingSchema, i18n.language || undefined);
  }, [workspaceId, inputValue, existingSchema, i18n.language, loading, generateProposal]);

  const handleQuickAction = useCallback((text: string) => {
    setInputValue(text);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleApprove = useCallback(
    async (approvedOperationIds?: string[]) => {
      if (!proposal) return;
      const ops = buildExecutionOps(proposal, isPl);
      const selectedIds = new Set(approvedOperationIds ?? ops.map((o) => o.id));

      setExecutionOps(
        ops.map((o) => ({
          ...o,
          status: selectedIds.has(o.id) ? 'running' as OperationStatus : 'pending' as OperationStatus,
        }))
      );

      try {
        const result = await executeProposal(approvedOperationIds);
        setExecutionOps((prev) =>
          prev?.map((o) => ({
            ...o,
            status: selectedIds.has(o.id) ? 'success' as OperationStatus : o.status,
          })) ?? null
        );
        setExecuted(true);
        onExecuted?.(result);
      } catch {
        setExecutionOps((prev) =>
          prev?.map((o) => ({
            ...o,
            status: o.status === 'running' ? 'failed' as OperationStatus : o.status,
            error: o.status === 'running' ? (isPl ? 'Operacja nie powiodła się' : 'Operation failed') : undefined,
          })) ?? null
        );
      }
    },
    [proposal, isPl, executeProposal, onExecuted]
  );

  const handleReject = useCallback(async () => {
    await rejectProposal();
    setExecutionOps(null);
    setExecuted(false);
    setShowDiff(false);
  }, [rejectProposal]);

  const handleRefine = useCallback(
    async (message: string) => {
      if (!message) {
        setShowRefineDialog(true);
        return;
      }
      const version = proposal?.version ?? 1;
      await refineProposal(message);
      setRefinementHistory((prev) => [
        ...prev,
        { version: version + 1, message, timestamp: new Date().toISOString() },
      ]);
      setShowRefineDialog(false);
    },
    [proposal, refineProposal]
  );

  const handleUndo = useCallback(async () => {
    await undoProposal();
    setExecutionOps(null);
    setExecuted(false);
  }, [undoProposal]);

  const handleClose = useCallback(() => {
    clearProposal();
    setExecutionOps(null);
    setExecuted(false);
    setShowDiff(false);
    setShowRefineDialog(false);
    onClose?.();
  }, [clearProposal, onClose]);

  // Quick action chips
  const quickActions = isPl
    ? [
        { label: 'Nowa tabela', icon: <Table2 size={10} />, text: 'Utwórz nową tabelę ' },
        { label: 'Dodaj kolumny', icon: <Plus size={10} />, text: 'Dodaj kolumny do tabeli ' },
        { label: 'Utwórz widok', icon: <Sparkles size={10} />, text: 'Utwórz widok dla tabeli ' },
        { label: 'Importuj dane', icon: <Upload size={10} />, text: 'Importuj dane do tabeli ' },
      ]
    : [
        { label: 'New table', icon: <Table2 size={10} />, text: 'Create a new table ' },
        { label: 'Add columns', icon: <Plus size={10} />, text: 'Add columns to table ' },
        { label: 'Create view', icon: <Sparkles size={10} />, text: 'Create a view for table ' },
        { label: 'Import data', icon: <Upload size={10} />, text: 'Import data into table ' },
      ];

  // -------------------------------------------------------------------------
  // Render: Execution progress
  // -------------------------------------------------------------------------
  if (executionOps) {
    return (
      <div className="space-y-3">
        <ExecutionProgress
          operations={executionOps}
          onUndo={executed ? handleUndo : undefined}
          undoLoading={loading}
        />
        {executed && proposal && (
          <SchemaProposalCard
            proposal={proposal}
            onApprove={handleApprove}
            onReject={handleReject}
            onRefine={handleRefine}
            onUndo={handleUndo}
            onClose={handleClose}
            loading={loading}
            executed={true}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Proposal review
  // -------------------------------------------------------------------------
  if (proposal) {
    return (
      <div className="space-y-3">
        <SchemaProposalCard
          proposal={proposal}
          onApprove={handleApprove}
          onReject={handleReject}
          onRefine={handleRefine}
          onClose={handleClose}
          onShowDiff={() => setShowDiff((v) => !v)}
          loading={loading}
        />

        {showDiff && (
          <SchemaDiffPreview
            currentSchema={currentSchema}
            proposedChanges={diffChanges}
            onClose={() => setShowDiff(false)}
          />
        )}

        {showRefineDialog && (
          <RefineDialog
            proposalSummary={proposal.summary}
            proposalIntent={proposal.intent}
            currentVersion={proposal.version ?? 1}
            refinementHistory={refinementHistory}
            onRefine={handleRefine}
            onClose={() => setShowRefineDialog(false)}
            loading={loading}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Chat input (default state)
  // -------------------------------------------------------------------------
  return (
    <div className="rounded-2xl border border-violet-500/30 bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-xl overflow-hidden transition-all duration-200">
      {/* Schema context summary */}
      <SchemaContextSummary schema={currentSchema} isPl={isPl} />

      {/* Input area */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles size={16} className="text-violet-500 flex-shrink-0 mt-2" />
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
                if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                isPl
                  ? "Opisz czego potrzebujesz... np. 'Stwórz CRM z leadami, kontaktami i transakcjami'"
                  : "Describe what you need... e.g., 'Create a CRM with leads, contacts, and deals'"
              }
              disabled={loading}
              rows={1}
              className="w-full bg-transparent border-0 outline-none text-sm text-slate-800 dark:text-zinc-200 placeholder-slate-400 resize-none leading-relaxed"
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-1">
            {loading && (
              <Loader2 size={16} className="animate-spin text-violet-400" />
            )}
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || loading}
              className="p-2 rounded-xl bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Send size={14} />
            </button>
            {onClose && (
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Quick action chips */}
        <div className="flex flex-wrap gap-1.5 mt-2 ml-6">
          {quickActions.map((action) => (
            <QuickActionChip
              key={action.label}
              icon={action.icon}
              label={action.label}
              onClick={() => handleQuickAction(action.text)}
              disabled={loading}
            />
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={clearError}
              className="p-0.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
          <button
            onClick={() => generateProposal(workspaceId, inputValue, existingSchema, i18n.language)}
            className="mt-1 text-[10px] text-red-600 dark:text-red-400 hover:underline"
          >
            {isPl ? 'Spróbuj ponownie' : 'Retry'}
          </button>
        </div>
      )}

      {/* Proposal history */}
      <ProposalHistoryList history={proposalHistory} isPl={isPl} />
    </div>
  );
};

export default ChatToSchemaPanel;
