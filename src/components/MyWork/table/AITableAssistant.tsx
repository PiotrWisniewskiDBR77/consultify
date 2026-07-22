/**
 * AITableAssistant — Natural language command bar for table operations.
 * Triggered by "/" key or AI button. Parses NL into structured table actions.
 */
import { Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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
  const [lastResult, setLastResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!command.trim() || loading) return;
    setLoading(true);
    setLastResult(null);

    if (usePlatform && workspaceId) {
      try {
        const schema = columns.map((c) => ({ key: c.key, header: c.header, type: c.type }));
        const proposal = await generateSchemaProposal(
          workspaceId,
          command.trim(),
          schema,
          i18n.language
        );

        if (onProposal && proposal) {
          const mapped: TableProposal = {
            title: proposal.summary || command.trim(),
            description: proposal.summary || '',
            columns: (proposal.operations || [])
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
          onProposal(mapped);
          toast.success(t('myWorkTable.aiTableAssistant.proposalGenerated'));
        }
        setCommand('');
        return;
      } catch (err: any) {
        toast.error(err?.message || t('myWorkTable.aiTableAssistant.schemaProposalFailed'));
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const schema = columns.map((c) => ({ key: c.key, header: c.header, type: c.type }));
      const payload: Record<string, unknown> = {
        command: command.trim(),
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
      const result = await Api.getIdeaAITableAction(ideaId, payload as any);

      const action = result?.action;
      if (!action) {
        toast.error(t('myWorkTable.aiTableAssistant.commandNotRecognized'));
        return;
      }

      switch (action.type) {
        case 'sort':
          onSort({ key: action.column, direction: action.direction || 'asc' });
          toast.success(t('myWorkTable.aiTableAssistant.sorted'));
          break;
        case 'filter':
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
          toast.success(t('myWorkTable.aiTableAssistant.filterApplied'));
          break;
        case 'group':
          onGroup(action.column || null);
          toast.success(t('myWorkTable.aiTableAssistant.groupingApplied'));
          break;
        case 'add_column':
          onAddColumn({
            key: action.key || `col_${Date.now()}`,
            header: action.header || action.key || 'New',
            type: action.columnType || 'text',
            visible: true,
            width: 160,
            options: action.options,
          });
          toast.success(t('myWorkTable.aiTableAssistant.columnAdded'));
          break;
        case 'add_rows':
          if (Array.isArray(action.rows)) {
            const newRows: TableNode[] = action.rows.map((r: any, idx: number) => ({
              id: `ai-row-${Date.now()}-${idx}`,
              type: 'idea',
              data: { label: r.label || r.name || '', ...r },
              position: { x: 0, y: 0 },
            }));
            onAddRows(newRows);
            toast.success(t('myWorkTable.aiTableAssistant.rowsAdded', { count: newRows.length }));
          }
          break;
        case 'summarize':
          setLastResult(action.summary || action.message || '');
          break;
        case 'error':
          toast.error(action.message || t('myWorkTable.aiTableAssistant.error'));
          break;
        default:
          toast(t('myWorkTable.aiTableAssistant.actionNotSupported'));
      }

      setCommand('');
    } catch (err: any) {
      toast.error(err?.message || t('myWorkTable.aiTableAssistant.aiError'));
    } finally {
      setLoading(false);
    }
  }, [
    command,
    columns,
    i18n.language,
    ideaId,
    t,
    loading,
    onAddColumn,
    onAddRows,
    onFilter,
    onGroup,
    onProposal,
    onSort,
    usePlatform,
    workspaceId,
  ]);

  if (!open) return null;

  const examples = isPl ? EXAMPLE_COMMANDS.pl : EXAMPLE_COMMANDS.en;

  return (
    <div className="absolute left-4 right-4 top-2 z-50">
      <div className="rounded-2xl border border-c-border bg-c-surface shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <Sparkles size={16} className="text-c-text-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
            placeholder={t('myWorkTable.aiTableAssistant.commandPlaceholder')}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-c-text placeholder-c-text-muted"
          />
          {loading && <Loader2 size={16} className="animate-spin text-c-text-secondary" />}
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-c-surface-raised">
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        {lastResult && (
          <div className="px-4 py-3 border-t border-c-border-subtle bg-c-surface-raised">
            <p className="text-xs text-c-text leading-relaxed">{lastResult}</p>
          </div>
        )}

        {!command && (
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
