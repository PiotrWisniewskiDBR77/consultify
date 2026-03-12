/**
 * AITableAssistant — Natural language command bar for table operations.
 * Triggered by "/" key or AI button. Parses NL into structured table actions.
 */
import { Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

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
}) => {
  const { i18n } = useTranslation();
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
        toast.error(isPl ? 'Nie rozpoznano polecenia' : 'Command not recognized');
        return;
      }

      switch (action.type) {
        case 'sort':
          onSort({ key: action.column, direction: action.direction || 'asc' });
          toast.success(isPl ? 'Posortowano' : 'Sorted');
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
          toast.success(isPl ? 'Filtr zastosowany' : 'Filter applied');
          break;
        case 'group':
          onGroup(action.column || null);
          toast.success(isPl ? 'Grupowanie zastosowane' : 'Grouping applied');
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
          toast.success(isPl ? 'Kolumna dodana' : 'Column added');
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
            toast.success(
              isPl ? `Dodano ${newRows.length} wierszy` : `Added ${newRows.length} rows`
            );
          }
          break;
        case 'summarize':
          setLastResult(action.summary || action.message || '');
          break;
        case 'generate_table':
          if (onProposal && action.proposal) {
            const proposal: TableProposal = {
              title: action.proposal.title,
              description: action.proposal.description,
              columns: (action.proposal.columns || []).map((c: any, idx: number) => ({
                key: c.key || `col_${idx}`,
                header: c.header || c.name || c.key,
                type: c.type || 'text',
                visible: true,
                width: c.width || 160,
                options: c.options,
                optionColors: c.optionColors,
                formula: c.formula,
                aiPrompt: c.aiPrompt,
              })),
              views: (action.proposal.views || []).map((v: any, idx: number) => ({
                id: `ai-view-${idx}`,
                name: v.name || `View ${idx + 1}`,
                icon: v.icon,
                layout: v.layout || 'table',
                sort: v.sort,
                filters: v.filters,
                groupBy: v.groupBy,
              })),
              rows: (action.proposal.rows || []).map((r: any, idx: number) => ({
                id: `ai-row-${Date.now()}-${idx}`,
                type: 'idea',
                data: { label: r.label || r.name || '', ...r },
                position: { x: 0, y: 0 },
              })),
              contextHints: action.proposal.contextHints,
            };
            onProposal(proposal);
            toast.success(isPl ? 'Propozycja tabeli wygenerowana' : 'Table proposal generated');
          }
          break;
        case 'error':
          toast.error(action.message || (isPl ? 'Błąd' : 'Error'));
          break;
        default:
          toast(isPl ? 'Akcja nieobsługiwana' : 'Action not supported');
      }

      setCommand('');
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Błąd AI' : 'AI error'));
    } finally {
      setLoading(false);
    }
  }, [
    command,
    columns,
    i18n.language,
    ideaId,
    isPl,
    loading,
    onAddColumn,
    onAddRows,
    onFilter,
    onGroup,
    onSort,
  ]);

  if (!open) return null;

  const examples = isPl ? EXAMPLE_COMMANDS.pl : EXAMPLE_COMMANDS.en;

  return (
    <div className="absolute left-4 right-4 top-2 z-50">
      <div className="rounded-2xl border border-violet-500/30 bg-white dark:bg-navy-900 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <Sparkles size={16} className="text-violet-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
            placeholder={isPl ? 'Wpisz polecenie dla tabeli…' : 'Type a table command…'}
            className="flex-1 bg-transparent border-0 outline-none text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400"
          />
          {loading && <Loader2 size={16} className="animate-spin text-violet-400" />}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <X size={14} className="text-slate-400" />
          </button>
        </div>

        {lastResult && (
          <div className="px-4 py-3 border-t border-slate-200/60 dark:border-navy-700/60 bg-violet-500/5">
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {lastResult}
            </p>
          </div>
        )}

        {!command && (
          <div className="px-4 py-2 border-t border-slate-200/30 dark:border-white/[0.04]">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {isPl ? 'Przykłady' : 'Examples'}
            </div>
            <div className="flex flex-wrap gap-1">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setCommand(ex)}
                  className="px-2 py-1 rounded-lg text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
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
