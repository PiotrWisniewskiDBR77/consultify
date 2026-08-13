/**
 * AITableAssistant — Natural language command bar for table operations.
 * Triggered by "/" key or AI button. Parses NL into structured table actions.
 *
 * TB-P1-03 (docs/qa/ideas-manual-audit-2026-08-09/08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md §P1.7):
 * every submitted command is retained in a durable history and reaches exactly ONE terminal
 * state — proposal, applied, unsupported (with reason), validation error, transport error or
 * cancelled — surfaced via accessible status/alert regions, never a silent close/clear and
 * never a transient toast as the sole channel. Recoverable states expose Retry/Edit and
 * preserve the submitted text.
 */
import { AlertTriangle, CheckCircle2, Loader2, Send, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { generateSchemaProposal } from '@/services/api/tablePlatform.api';

import type { TableProposal } from './AITableProposal';
import type { ColumnDef, FilterGroup, SortConfig, TableNode } from './tableTypes';

interface ArtifactContext {
  id: string;
  type: string;
  title: string;
  snippet?: string;
}

interface AITableAssistantProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  columns: ColumnDef[];
  artifactContext?: ArtifactContext[];
  onSort: (sort: SortConfig) => void;
  onFilter: (filters: FilterGroup) => void;
  onGroup: (column: string | null) => void;
  onAddColumn: (col: ColumnDef) => void;
  onAddRows: (rows: TableNode[]) => void;
  onProposal?: (proposal: TableProposal) => void;
  usePlatform?: boolean;
  workspaceId?: string;
}

/** One durable terminal outcome for a submitted command. Exactly one applies per entry. */
type AiCommandStatus = 'pending' | 'applied' | 'proposal' | 'unsupported' | 'validation' | 'transport' | 'cancelled';

interface AiCommandEntry {
  id: string;
  command: string;
  status: AiCommandStatus;
  message: string;
}

const RECOVERABLE: ReadonlySet<AiCommandStatus> = new Set(['unsupported', 'validation', 'transport']);

const EXAMPLE_COMMANDS = {
  en: [
    'Create a risk assessment table for digital transformation',
    'Sort by priority descending',
    'Show only high impact items',
    'Group by status',
    'Add 5 rows about digital transformation risks',
    'Add a "Deadline" date column',
    'Build a project tracker with milestones and owners',
    'Summarize the table',
  ],
  pl: [
    'Stwórz tabelę oceny ryzyka dla transformacji cyfrowej',
    'Posortuj po priorytecie malejąco',
    'Pokaż tylko elementy o wysokim wpływie',
    'Grupuj po statusie',
    'Dodaj 5 wierszy o ryzykach transformacji cyfrowej',
    'Dodaj kolumnę "Termin" typu data',
    'Zbuduj tracker projektu z kamieniami milowymi i właścicielami',
    'Podsumuj tabelę',
  ],
};

export const AITableAssistant: React.FC<AITableAssistantProps> = ({
  open,
  onClose,
  ideaId,
  columns,
  artifactContext,
  onSort,
  onFilter,
  onGroup,
  onAddColumn,
  onAddRows,
  onProposal,
  usePlatform,
  workspaceId,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<AiCommandEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const entrySeq = useRef(0);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Abort any in-flight request if the assistant unmounts mid-request.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const upsertEntry = useCallback((id: string, patch: Partial<AiCommandEntry>) => {
    setHistory((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const runCommand = useCallback(
    async (rawCommand: string) => {
      const trimmed = rawCommand.trim();
      if (!trimmed) {
        setInlineNotice(t('myWorkTable.aiTableAssistant.commandRequired'));
        return;
      }
      setInlineNotice(null);

      const id = `ai-cmd-${Date.now()}-${entrySeq.current++}`;
      setHistory((prev) => [
        ...prev,
        { id, command: trimmed, status: 'pending', message: t('myWorkTable.aiTableAssistant.statusPending') },
      ]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      if (usePlatform && workspaceId) {
        try {
          const schema = columns.map((c) => ({ key: c.key, header: c.header, type: c.type }));
          const proposal = await generateSchemaProposal(
            workspaceId,
            trimmed,
            schema,
            i18n.language,
            undefined,
            controller.signal
          );

          const operations = proposal?.operations || [];
          if (!proposal || operations.length === 0) {
            upsertEntry(id, { status: 'validation', message: t('myWorkTable.aiTableAssistant.noChanges') });
            return;
          }

          const mapped: TableProposal = {
            title: proposal.summary || trimmed,
            description: proposal.summary || '',
            columns: operations
              .filter((op: any) => op.operationType === 'create_field')
              .map((op: any, idx: number) => ({
                key: op.payload?.name || `col_${idx}`,
                header: op.payload?.name || `Column ${idx + 1}`,
                type: op.payload?.fieldType || 'text',
                visible: true,
                width: 160,
              })),
            views: [],
            rows: [],
          };
          upsertEntry(id, {
            status: 'proposal',
            message: t('myWorkTable.aiTableAssistant.proposalGenerated'),
          });
          onProposal?.(mapped);
          setCommand('');
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            upsertEntry(id, { status: 'cancelled', message: t('myWorkTable.aiTableAssistant.cancelled') });
          } else {
            upsertEntry(id, {
              status: 'transport',
              message: err?.message || t('myWorkTable.aiTableAssistant.transportError'),
            });
          }
        } finally {
          setLoading(false);
          abortRef.current = null;
        }
        return;
      }

      try {
        const schema = columns.map((c) => ({ key: c.key, header: c.header, type: c.type }));
        const payload: Record<string, unknown> = {
          command: trimmed,
          schema,
          language: i18n.language,
        };
        if (artifactContext?.length) {
          payload.artifactContext = artifactContext.map((a) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            snippet: a.snippet,
          }));
        }
        const result = await Api.getIdeaAITableAction(ideaId, payload as any, controller.signal);
        const action = result?.action;

        if (!action) {
          upsertEntry(id, { status: 'transport', message: t('myWorkTable.aiTableAssistant.transportError') });
          return;
        }

        const columnExists = (key: unknown) =>
          typeof key === 'string' && columns.some((c) => c.key === key);

        switch (action.type) {
          case 'sort': {
            if (!columnExists(action.column)) {
              upsertEntry(id, {
                status: 'validation',
                message: t('myWorkTable.aiTableAssistant.columnNotFound', { column: String(action.column || '') }),
              });
              break;
            }
            onSort({ key: action.column, direction: action.direction || 'asc' });
            upsertEntry(id, { status: 'applied', message: t('myWorkTable.aiTableAssistant.sorted') });
            setCommand('');
            break;
          }
          case 'filter': {
            if (!columnExists(action.column)) {
              upsertEntry(id, {
                status: 'validation',
                message: t('myWorkTable.aiTableAssistant.columnNotFound', { column: String(action.column || '') }),
              });
              break;
            }
            onFilter({
              logic: 'and',
              rules: [
                {
                  id: `ai-${Date.now()}`,
                  column: action.column,
                  operator: action.operator || 'contains',
                  value: action.value || '',
                },
              ],
            });
            upsertEntry(id, { status: 'applied', message: t('myWorkTable.aiTableAssistant.filterApplied') });
            setCommand('');
            break;
          }
          case 'group': {
            if (action.column && !columnExists(action.column)) {
              upsertEntry(id, {
                status: 'validation',
                message: t('myWorkTable.aiTableAssistant.columnNotFound', { column: String(action.column || '') }),
              });
              break;
            }
            onGroup(action.column || null);
            upsertEntry(id, { status: 'applied', message: t('myWorkTable.aiTableAssistant.groupingApplied') });
            setCommand('');
            break;
          }
          case 'add_column': {
            if (!action.key && !action.header) {
              upsertEntry(id, { status: 'validation', message: t('myWorkTable.aiTableAssistant.noChanges') });
              break;
            }
            onAddColumn({
              key: action.key || `col_${Date.now()}`,
              header: action.header || action.key || 'New',
              type: action.columnType || 'text',
              visible: true,
              width: 160,
              options: action.options,
            });
            upsertEntry(id, { status: 'applied', message: t('myWorkTable.aiTableAssistant.columnAdded') });
            setCommand('');
            break;
          }
          case 'add_rows': {
            if (!Array.isArray(action.rows) || action.rows.length === 0) {
              upsertEntry(id, { status: 'validation', message: t('myWorkTable.aiTableAssistant.noRowsToAdd') });
              break;
            }
            const newRows: TableNode[] = action.rows.map((r: any, idx: number) => ({
              id: `ai-row-${Date.now()}-${idx}`,
              type: 'idea',
              data: { label: r.label || r.name || '', ...r },
              position: { x: 0, y: 0 },
            }));
            onAddRows(newRows);
            upsertEntry(id, {
              status: 'applied',
              message: t('myWorkTable.aiTableAssistant.rowsAdded', { count: newRows.length }),
            });
            setCommand('');
            break;
          }
          case 'summarize': {
            upsertEntry(id, {
              status: 'applied',
              message: action.summary || action.message || t('myWorkTable.aiTableAssistant.sorted'),
            });
            setCommand('');
            break;
          }
          case 'error': {
            upsertEntry(id, {
              status: 'validation',
              message: action.message || t('myWorkTable.aiTableAssistant.error'),
            });
            break;
          }
          default: {
            upsertEntry(id, {
              status: 'unsupported',
              message: t('myWorkTable.aiTableAssistant.actionNotSupported'),
            });
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          upsertEntry(id, { status: 'cancelled', message: t('myWorkTable.aiTableAssistant.cancelled') });
        } else {
          upsertEntry(id, {
            status: 'transport',
            message: err?.message || t('myWorkTable.aiTableAssistant.aiError'),
          });
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [
      columns,
      i18n.language,
      ideaId,
      t,
      artifactContext,
      onAddColumn,
      onAddRows,
      onFilter,
      onGroup,
      onProposal,
      onSort,
      upsertEntry,
      usePlatform,
      workspaceId,
    ]
  );

  const handleSubmit = useCallback(() => {
    if (loading) return;
    void runCommand(command);
  }, [command, loading, runCommand]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRetry = useCallback(
    (entry: AiCommandEntry) => {
      if (loading) return;
      void runCommand(entry.command);
    },
    [loading, runCommand]
  );

  const handleEdit = useCallback((entry: AiCommandEntry) => {
    setCommand(entry.command);
    setInlineNotice(null);
    inputRef.current?.focus();
  }, []);

  if (!open) return null;

  const examples = isPl ? EXAMPLE_COMMANDS.pl : EXAMPLE_COMMANDS.en;
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  const olderEntries = history.length > 1 ? history.slice(0, -1).slice(-4) : [];

  const statusLabel: Record<AiCommandStatus, string> = {
    pending: t('myWorkTable.aiTableAssistant.statusPending'),
    applied: t('myWorkTable.aiTableAssistant.statusApplied'),
    proposal: t('myWorkTable.aiTableAssistant.statusProposal'),
    unsupported: t('myWorkTable.aiTableAssistant.statusUnsupported'),
    validation: t('myWorkTable.aiTableAssistant.statusValidation'),
    transport: t('myWorkTable.aiTableAssistant.statusTransport'),
    cancelled: t('myWorkTable.aiTableAssistant.statusCancelled'),
  };

  return (
    <div className="absolute left-4 right-4 top-2 z-50">
      <div className="rounded-2xl border border-c-border bg-c-surface shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <Sparkles size={16} className="text-c-text-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              if (inlineNotice) setInlineNotice(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') {
                if (loading) {
                  handleCancel();
                } else {
                  onClose();
                }
              }
            }}
            placeholder={t('myWorkTable.aiTableAssistant.commandPlaceholder')}
            aria-label={t('myWorkTable.aiTableAssistant.commandPlaceholder')}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-c-text placeholder-c-text-muted"
          />
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin text-c-text-secondary" aria-hidden="true" />
              <button
                onClick={handleCancel}
                type="button"
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-c-text-secondary hover:bg-c-surface-raised"
              >
                {t('myWorkTable.aiTableAssistant.cancel')}
              </button>
            </>
          ) : (
            /* TB-P2-03: a first-time user had no visible way to submit besides
                guessing Enter — Enter stays wired (onKeyDown above), this button
                is the discoverable, clickable equivalent. */
            <button
              onClick={handleSubmit}
              type="button"
              disabled={!command.trim()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-c-text bg-c-surface-raised hover:bg-c-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={12} aria-hidden="true" />
              {t('myWorkTable.aiTableAssistant.send')}
            </button>
          )}
          {/* TB-P2-03: bare icon button had no accessible name — indistinguishable
              from Send to a screen reader / on hover. */}
          <button
            onClick={onClose}
            type="button"
            aria-label={t('myWorkTable.aiTableAssistant.closeAssistant')}
            title={t('myWorkTable.aiTableAssistant.closeAssistant')}
            className="p-1 rounded-lg hover:bg-c-surface-raised"
          >
            <X size={14} className="text-c-text-secondary" aria-hidden="true" />
          </button>
        </div>

        {inlineNotice && (
          <div
            role="alert"
            aria-live="assertive"
            className="px-4 py-2 border-t border-c-border-subtle bg-c-danger/10 text-c-danger text-xs"
          >
            {inlineNotice}
          </div>
        )}

        {lastEntry && (
          <div
            role={RECOVERABLE.has(lastEntry.status) ? 'alert' : 'status'}
            aria-live={RECOVERABLE.has(lastEntry.status) ? 'assertive' : 'polite'}
            data-testid="ai-table-assistant-terminal-state"
            data-status={lastEntry.status}
            className={`px-4 py-3 border-t border-c-border-subtle ${
              RECOVERABLE.has(lastEntry.status)
                ? 'bg-c-danger/10'
                : lastEntry.status === 'cancelled'
                  ? 'bg-c-surface-raised'
                  : lastEntry.status === 'pending'
                    ? 'bg-c-surface-raised'
                    : 'bg-c-success/10'
            }`}
          >
            <div className="flex items-start gap-2">
              {lastEntry.status === 'pending' ? (
                <Loader2 size={14} className="mt-0.5 animate-spin text-c-text-secondary flex-shrink-0" aria-hidden="true" />
              ) : RECOVERABLE.has(lastEntry.status) ? (
                <AlertTriangle size={14} className="mt-0.5 text-c-danger flex-shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2
                  size={14}
                  className={`mt-0.5 flex-shrink-0 ${
                    lastEntry.status === 'cancelled' ? 'text-c-text-secondary' : 'text-c-success'
                  }`}
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-c-text-secondary">
                  {statusLabel[lastEntry.status]}
                </p>
                <p className="text-xs text-c-text mt-0.5 break-words">“{lastEntry.command}”</p>
                <p className="text-xs text-c-text-secondary mt-0.5 leading-relaxed">{lastEntry.message}</p>
                {(RECOVERABLE.has(lastEntry.status) || lastEntry.status === 'cancelled') && (
                  <div className="flex gap-2 mt-2">
                    {RECOVERABLE.has(lastEntry.status) && (
                      <button
                        onClick={() => handleRetry(lastEntry)}
                        type="button"
                        disabled={loading}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-c-text bg-c-surface-raised hover:bg-c-border-subtle disabled:opacity-40"
                      >
                        {t('myWorkTable.aiTableAssistant.retry')}
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(lastEntry)}
                      type="button"
                      disabled={loading}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40"
                    >
                      {t('myWorkTable.aiTableAssistant.edit')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {olderEntries.length > 0 && (
          <div className="px-4 py-2 border-t border-c-border-subtle max-h-24 overflow-y-auto">
            <div className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1">
              {t('myWorkTable.aiTableAssistant.historyLabel')}
            </div>
            <ul className="space-y-1">
              {olderEntries.map((e) => (
                <li key={e.id} className="text-[10px] text-c-text-secondary truncate" data-status={e.status}>
                  {statusLabel[e.status]} — “{e.command}”
                </li>
              ))}
            </ul>
          </div>
        )}

        {!command && history.length === 0 && (
          <div className="px-4 py-2 border-t border-c-border-subtle">
            <div className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1.5">
              {t('myWorkTable.aiTableAssistant.examples')}
            </div>
            <div className="flex flex-wrap gap-1">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setCommand(ex)}
                  className="px-2 py-1 rounded-lg text-[10px] text-c-text-secondary bg-c-surface-raised hover:bg-c-border-subtle transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AITableAssistant;
