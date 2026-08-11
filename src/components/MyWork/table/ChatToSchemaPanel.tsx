/**
 * ChatToSchemaPanel — NL input + proposal display for Chat-to-Schema.
 * Enhanced with multi-line input, quick action chips, proposal history,
 * schema context summary, and full approve/reject/refine/undo flow.
 */
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { EMPTY_SELECTION } from '../ideaSelectionTypes';

import {
  type ExecutionOperation,
  ExecutionProgress,
  type OperationStatus,
} from './ExecutionProgress';
import { RefineDialog, type RefinementHistoryEntry } from './RefineDialog';
import { type DiffChange, type DiffTable, SchemaDiffPreview } from './SchemaDiffPreview';
import { SchemaProposalCard, type SchemaProposalCardProposal } from './SchemaProposalCard';
import { type ProposalHistoryEntry, useSchemaProposal } from './useSchemaProposal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatToSchemaPanelMode = 'modal' | 'slideOver' | 'splitScreen';

export interface ChatToSchemaPanelProps {
  workspaceId: string;
  existingSchema?: unknown;
  onExecuted?: (result: unknown) => void;
  onClose?: () => void;
  /** Initial message to seed the conversation (from chat intercept) */
  initialMessage?: string;
  /** Company context for smarter proposals */
  companyContext?: {
    workspaceName?: string;
    moduleName?: string;
    existingTableNames?: string[];
  };
  /** @deprecated Use mode instead. Kept for backward compatibility. */
  slideOver?: boolean;
  /** Render mode: modal (centered overlay), slideOver (fixed right overlay), splitScreen (inline, no backdrop) */
  mode?: ChatToSchemaPanelMode;
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
        const fields =
          (op.payload?.fields as Array<Record<string, unknown>> | undefined)?.map((f) => ({
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
    const name =
      op.payload?.name ?? op.target?.tableName ?? op.target?.fieldName ?? op.operationType;
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
    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-c-border-subtle text-[10px] font-medium text-c-text-muted hover:border-c-border hover:text-c-text hover:bg-c-surface-raised transition-all disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {icon}
    {label}
  </button>
);

const SchemaContextSummary: React.FC<{
  schema: DiffTable[];
  isPl: boolean;
}> = ({ schema, isPl }) => {
  const { t } = useTranslation();
  if (schema.length === 0) return null;
  const totalFields = schema.reduce((sum, t) => sum + t.fields.length, 0);
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-c-border-subtle bg-c-surface-raised">
      <Database size={12} className="text-c-text-secondary" />
      <span className="text-[10px] text-c-text-secondary">
        {t('myWorkTable.chatToSchemaPanel.currentSchema')}: {schema.length}{' '}
        {t('myWorkTable.chatToSchemaPanel.tables')}, {totalFields}{' '}
        {t('myWorkTable.chatToSchemaPanel.fields')}
      </span>
      <div className="flex items-center gap-1 ml-auto">
        {schema.slice(0, 3).map((t) => (
          <span
            key={t.name}
            className="text-[9px] px-1.5 py-0.5 rounded bg-c-surface-raised text-c-text-muted truncate max-w-[80px]"
          >
            {t.name}
          </span>
        ))}
        {schema.length > 3 && (
          <span className="text-[9px] text-c-text-secondary">+{schema.length - 3}</span>
        )}
      </div>
    </div>
  );
};

const ProposalHistoryList: React.FC<{
  history: ProposalHistoryEntry[];
  isPl: boolean;
}> = ({ history, isPl }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="border-t border-c-border-subtle">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 px-4 py-2 w-full text-[10px] font-medium text-c-text-secondary hover:text-c-text-secondary transition-colors"
      >
        <History size={12} />
        {t('myWorkTable.chatToSchemaPanel.proposalHistory')} ({history.length})
        {expanded ? (
          <ChevronDown size={10} className="ml-auto" />
        ) : (
          <ChevronRight size={10} className="ml-auto" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-4 pb-3 space-y-1 max-h-32 overflow-y-auto">
          {history.map((entry) => (
            <div
              key={`${entry.id}-${entry.timestamp}`}
              className="flex items-center gap-2 text-[10px] text-c-text-muted"
            >
              <Clock size={10} className="flex-shrink-0" />
              <span className="truncate flex-1">{entry.summary || entry.intent}</span>
              <span
                className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  entry.status === 'executed'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : entry.status === 'rejected'
                      ? 'bg-danger-500/15 text-danger-600 dark:text-danger-400'
                      : entry.status === 'refined'
                        ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                        : 'bg-c-surface-raised text-c-text-muted'
                }`}
              >
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
  initialMessage,
  companyContext,
  slideOver = false,
  mode: modeProp,
}) => {
  const mode = modeProp ?? (slideOver ? 'slideOver' : 'modal');
  const { t, i18n } = useTranslation();
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
  const [conversation, setConversation] = useState<
    Array<{ id: string; role: 'user' | 'ai'; content: string; timestamp: Date }>
  >([]);
  const initialMsgSentRef = useRef(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const slideOverDialogRef = useRef<HTMLDivElement>(null);

  const proposal = normalizeProposal(rawProposal);
  const currentSchema = useMemo(() => extractCurrentSchema(existingSchema), [existingSchema]);
  const diffChanges = useMemo(() => (proposal ? extractDiffChanges(proposal) : []), [proposal]);

  useEffect(() => {
    if (rawProposal != null) setInputValue('');
  }, [rawProposal]);

  // Auto-scroll conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // When proposal arrives, add AI message to conversation
  useEffect(() => {
    if (rawProposal != null) {
      const p = rawProposal as Record<string, unknown>;
      const summary = String(p.summary ?? '');
      setConversation((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'ai' as const,
          content: summary || t('myWorkTable.chatToSchemaPanel.hereIsMyProposal'),
          timestamp: new Date(),
        },
      ]);
    }
  }, [rawProposal, isPl]);

  // Auto-submit initial message from chat intercept
  useEffect(() => {
    if (initialMessage && !initialMsgSentRef.current) {
      initialMsgSentRef.current = true;
      handleSubmit(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  // Handlers
  const handleSubmit = useCallback(
    async (overrideMsg?: string) => {
      const msg = (overrideMsg ?? inputValue).trim();
      if (!msg || loading) return;

      setConversation((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: 'user', content: msg, timestamp: new Date() },
      ]);
      setInputValue('');
      setExecutionOps(null);
      setExecuted(false);

      if (proposal) {
        await refineProposal(msg);
      } else {
        await generateProposal(
          workspaceId,
          msg,
          existingSchema,
          i18n.language || undefined,
          companyContext
        );
      }
    },
    [
      workspaceId,
      inputValue,
      existingSchema,
      i18n.language,
      loading,
      generateProposal,
      refineProposal,
      proposal,
      companyContext,
    ]
  );

  /**
   * N-inventory-b-medium (2026-08-10): routes the Send button/Enter-to-send
   * through the registry (idea.ai.table_schema_propose) instead of calling
   * handleSubmit directly — see the action's comment in
   * ideaActionRegistry.ts for why this is a real, registrable command (not
   * incidental chat chrome). `ideaId: ''` — this panel only has
   * `workspaceId` in scope, same established pattern as other leaf
   * components with no idea-id (see e.g. WhiteboardToolbar.tsx).
   */
  const runSchemaProposeAction = useCallback(
    (overrideMsg?: string) => {
      const ctx: ActionContext = {
        ideaId: '',
        tool: 'table',
        selection: EMPTY_SELECTION,
        surface: 'panel',
        source: 'ui',
        params: { run: () => handleSubmit(overrideMsg) },
      };
      void runIdeaAction('idea.ai.table_schema_propose', ctx);
    },
    [handleSubmit]
  );

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
          status: selectedIds.has(o.id)
            ? ('running' as OperationStatus)
            : ('pending' as OperationStatus),
        }))
      );

      try {
        const result = await executeProposal(approvedOperationIds);
        setExecutionOps(
          (prev) =>
            prev?.map((o) => ({
              ...o,
              status: selectedIds.has(o.id) ? ('success' as OperationStatus) : o.status,
            })) ?? null
        );
        setExecuted(true);
        onExecuted?.({
          ...(result && typeof result === 'object' ? result : {}),
          type: 'table_proposal',
          proposalId: proposal.id,
          workspaceId,
          summary: proposal.summary || proposal.intent || '',
        });
      } catch {
        setExecutionOps(
          (prev) =>
            prev?.map((o) => ({
              ...o,
              status: o.status === 'running' ? ('failed' as OperationStatus) : o.status,
              error:
                o.status === 'running'
                  ? t('myWorkTable.chatToSchemaPanel.operationFailed')
                  : undefined,
            })) ?? null
        );
      }
    },
    [proposal, isPl, executeProposal, onExecuted, workspaceId]
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

  // Only the slideOver render mode owns a `fixed inset-0` backdrop + panel;
  // splitScreen/modal are embedded by the host and don't get dialog semantics
  // here. Suspended while the nested `RefineDialog` is showing — two
  // simultaneously-open `useDialogA11y` document Escape listeners would both
  // fire on a single Escape press (stopPropagation doesn't stop sibling
  // listeners on the same `document` target), closing both dialogs instead
  // of just the top one.
  useDialogA11y({
    open: mode === 'slideOver' && !showRefineDialog,
    onClose: handleClose,
    containerRef: slideOverDialogRef,
  });

  // Quick action chips
  const quickActions = [
    {
      label: t('myWorkTable.chatToSchemaPanel.quickActionNewTableLabel'),
      icon: <Table2 size={10} />,
      text: t('myWorkTable.chatToSchemaPanel.quickActionNewTableText'),
    },
    {
      label: t('myWorkTable.chatToSchemaPanel.quickActionAddColumnsLabel'),
      icon: <Plus size={10} />,
      text: t('myWorkTable.chatToSchemaPanel.quickActionAddColumnsText'),
    },
    {
      label: t('myWorkTable.chatToSchemaPanel.quickActionCreateViewLabel'),
      icon: <Sparkles size={10} />,
      text: t('myWorkTable.chatToSchemaPanel.quickActionCreateViewText'),
    },
    {
      label: t('myWorkTable.chatToSchemaPanel.quickActionImportDataLabel'),
      icon: <Upload size={10} />,
      text: t('myWorkTable.chatToSchemaPanel.quickActionImportDataText'),
    },
  ];

  // -------------------------------------------------------------------------
  // Render: Panel content
  // -------------------------------------------------------------------------
  const panelContent = (
    <div
      className={`flex flex-col ${mode === 'slideOver' || mode === 'splitScreen' ? 'h-full' : 'max-h-[80vh]'}`}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-c-border-subtle bg-c-surface-raised flex-shrink-0">
        <Sparkles size={16} className="text-c-text-secondary" />
        <span id="chat-to-schema-panel-title" className="text-sm font-semibold text-c-text">
          {t('myWorkTable.chatToSchemaPanel.aiTableBuilder')}
        </span>
        {companyContext?.workspaceName && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-c-surface text-c-text-secondary">
            {companyContext.workspaceName}
          </span>
        )}
        <button
          onClick={handleClose}
          className="ml-auto p-1.5 rounded-lg hover:bg-c-surface-raised text-c-text-secondary transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Schema context */}
      <SchemaContextSummary schema={currentSchema} isPl={isPl} />

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {conversation.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-c-surface-raised flex items-center justify-center mb-3">
              <Table2 size={24} className="text-c-text-secondary" />
            </div>
            <p className="text-sm font-medium text-c-text mb-1">
              {t('myWorkTable.chatToSchemaPanel.describeYourTable')}
            </p>
            <p className="text-xs text-c-text-secondary max-w-[280px]">
              {t('myWorkTable.chatToSchemaPanel.tellMeWhatYouNeed')}
            </p>
          </div>
        )}

        {conversation.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-c-text text-c-surface rounded-br-md'
                  : 'bg-c-surface-raised text-c-text rounded-bl-md'
              }`}
            >
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-c-surface-raised px-3.5 py-2.5">
              <Loader2 size={14} className="animate-spin text-c-text-secondary" />
              <span className="text-xs text-c-text-muted">
                {t('myWorkTable.chatToSchemaPanel.generatingProposal')}
              </span>
            </div>
          </div>
        )}

        <div ref={conversationEndRef} />
      </div>

      {/* Proposal actions */}
      {proposal && !executionOps && !executed && (
        <div className="px-4 py-2 border-t border-c-border-subtle bg-c-surface-raised flex-shrink-0">
          <SchemaProposalCard
            proposal={proposal}
            onApprove={handleApprove}
            onReject={handleReject}
            onRefine={handleRefine}
            onClose={handleClose}
            onShowDiff={() => setShowDiff((v) => !v)}
            loading={loading}
          />
        </div>
      )}

      {/* Execution progress */}
      {executionOps && (
        <div className="px-4 py-2 border-t border-c-border-subtle flex-shrink-0">
          <ExecutionProgress
            operations={executionOps}
            onUndo={executed ? handleUndo : undefined}
            undoLoading={loading}
          />
        </div>
      )}

      {/* Diff preview */}
      {showDiff && (
        <div className="px-4 py-2 border-t border-c-border-subtle flex-shrink-0">
          <SchemaDiffPreview
            currentSchema={currentSchema}
            proposedChanges={diffChanges}
            onClose={() => setShowDiff(false)}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-danger-500/10 border-t border-danger-500/20 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-danger-700 dark:text-danger-300">{error}</p>
            <button
              onClick={clearError}
              className="p-0.5 text-danger-400 hover:text-danger-600 dark:hover:text-danger-300 transition-colors flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-c-border-subtle flex-shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  runSchemaProposeAction();
                }
              }}
              placeholder={
                proposal
                  ? t('myWorkTable.chatToSchemaPanel.refineEGAddA')
                  : t('myWorkTable.chatToSchemaPanel.describeWhatYouNeed')
              }
              disabled={loading}
              rows={1}
              className="w-full bg-c-surface-raised border border-c-border-subtle rounded-xl px-3 py-2 outline-none text-sm text-c-text placeholder-c-text-muted resize-none leading-relaxed focus:border-c-focus-solid transition-colors"
            />
          </div>
          <button
            onClick={() => runSchemaProposeAction()}
            disabled={!inputValue.trim() || loading}
            className="p-2.5 rounded-xl bg-c-text text-c-surface hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex-shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        {/* Quick actions (only when no proposal yet) */}
        {!proposal && conversation.length === 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
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
        )}
      </div>

      {/* Proposal history */}
      <ProposalHistoryList history={proposalHistory} isPl={isPl} />

      {/* Refine dialog */}
      {showRefineDialog && proposal && (
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

  // -------------------------------------------------------------------------
  // Render: splitScreen | slideOver | modal
  // -------------------------------------------------------------------------
  if (mode === 'splitScreen') {
    return <div className="flex flex-col h-full min-h-0 w-full bg-c-surface">{panelContent}</div>;
  }

  if (mode === 'slideOver') {
    return (
      <>
        <div
          className="fixed inset-0 z-context-menu bg-black/20 backdrop-blur-[2px]"
          onClick={handleClose}
        />
        <div
          ref={slideOverDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-to-schema-panel-title"
          tabIndex={-1}
          className="fixed right-0 top-0 bottom-0 z-context-menu w-[480px] max-w-[90vw] bg-c-surface border-l border-c-border-subtle shadow-2xl flex flex-col outline-none"
        >
          {panelContent}
        </div>
      </>
    );
  }

  // modal (default)
  return (
    <div className="rounded-2xl border border-c-border bg-c-surface shadow-xl overflow-hidden transition-all duration-200">
      {panelContent}
    </div>
  );
};

export default ChatToSchemaPanel;
