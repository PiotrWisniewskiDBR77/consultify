/**
 * useTableQuickActions — listens for 'idea-workspace-quick-action' CustomEvents
 * and dispatches them to the appropriate handler.
 *
 * Extracted from IdeaTableTool to reduce orchestrator size.
 */
import { useEffect } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { downloadCSV, exportToCSV } from './csvUtils';
import type { ColumnDef, TableNode } from './tableTypes';
import type { ViewLayout } from './useTableViews';
import type { UseUndoRedoReturn } from './useUndoRedo';

export interface QuickActionHandlers {
  handleAddRow: () => void;
  setShowRowTemplatePicker: (v: boolean) => void;
  setAddRowBtnRect: (v: DOMRect | null) => void;
  setShowAddColumn: (v: boolean) => void;
  setSort: React.Dispatch<React.SetStateAction<import('./tableTypes').SortConfig | null>>;
  setShowFilterPanel: (v: boolean) => void;
  setShowAIAssistant: (v: boolean) => void;
  setShowFrameworkGen: (v: boolean) => void;
  setViewLayout: React.Dispatch<React.SetStateAction<ViewLayout>>;
  setShowSummaryDashboard: (v: boolean) => void;
  setShowColorPalette: (v: boolean) => void;
  setShowAICategorize: (v: boolean) => void;
  setShowScoringModel: (v: boolean) => void;
  setShowExportPresentation: (v: boolean) => void;
  setShowPipeline: (v: boolean) => void;
  setShowCopilot: (v: boolean) => void;
  setShowVoiceInput: (v: boolean) => void;
  setShowCrossRelations: (v: boolean) => void;
  setShowHeatmap: (v: boolean) => void;
  onUndo: () => void | Promise<void>;
  onRedo: () => void;
}

export interface UseTableQuickActionsOpts {
  ideaId: string;
  isPl: boolean;
  columns: ColumnDef[];
  nodes: TableNode[];
  nodesUndo: UseUndoRedoReturn<TableNode[]>;
  selectedRowIds: Set<string>;
  handlers: QuickActionHandlers;
}

export function useTableQuickActions(opts: UseTableQuickActionsOpts): void {
  const { ideaId, isPl, columns, nodes, nodesUndo, selectedRowIds, handlers } = opts;

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.action) return;

      const { action } = detail;

      // Undo / redo from the canvas rail (CanvasLeftToolbar emits tbl_undo/tbl_redo)
      if (action === 'tbl_undo') {
        void handlers.onUndo();
        return;
      }
      if (action === 'tbl_redo') {
        handlers.onRedo();
        return;
      }

      // Simple toggle actions
      const toggleMap: Record<string, () => void> = {
        tbl_add_row: handlers.handleAddRow,
        tbl_add_row_template: () => {
          handlers.setAddRowBtnRect(null);
          handlers.setShowRowTemplatePicker(true);
        },
        tbl_add_column: () => handlers.setShowAddColumn(true),
        tbl_ai_assistant: () => handlers.setShowAIAssistant(true),
        tbl_framework: () => handlers.setShowFrameworkGen(true),
        tbl_summary: () => handlers.setShowSummaryDashboard(true),
        tbl_color_palette: () => handlers.setShowColorPalette(true),
        tbl_categorize: () => handlers.setShowAICategorize(true),
        tbl_scoring: () => handlers.setShowScoringModel(true),
        tbl_export_pptx: () => handlers.setShowExportPresentation(true),
        tbl_pipeline: () => handlers.setShowPipeline(true),
        tbl_copilot: () => handlers.setShowCopilot(true),
        tbl_voice: () => handlers.setShowVoiceInput(true),
        tbl_cross_relations: () => handlers.setShowCrossRelations(true),
        tbl_heatmap: () => handlers.setShowHeatmap(true),
      };

      if (toggleMap[action]) {
        toggleMap[action]();
        return;
      }

      // View layout switches
      const viewMap: Record<string, ViewLayout> = {
        tbl_kanban: 'kanban',
        tbl_matrix: 'matrix',
        tbl_sticky: 'sticky',
        tbl_timeline: 'timeline',
        tbl_calendar: 'calendar',
        tbl_grid: 'grid',
      };
      if (viewMap[action]) {
        handlers.setViewLayout(viewMap[action]);
        return;
      }

      if (action === 'tbl_sort') {
        handlers.setSort((prev) =>
          prev
            ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            : { key: 'label', direction: 'asc' }
        );
        trackFunnelEvent('ideas_table_sort_applied', { ideaId });
        return;
      }

      if (action === 'tbl_filter') {
        handlers.setShowFilterPanel(true);
        trackFunnelEvent('ideas_table_filter_applied', { ideaId });
        return;
      }

      if (action === 'tbl_export_csv') {
        const csv = exportToCSV(columns, nodes);
        downloadCSV(csv, `idea-${ideaId}.csv`);
        return;
      }

      // AI autofill from artifacts
      if (action === 'tbl_autofill_from_artifact') {
        const selectedRows = nodes.filter((n) => n.data?._selected);
        if (selectedRows.length === 0) {
          toast(isPl ? 'Zaznacz wiersze do autofill' : 'Select rows to autofill', { icon: '⚠️' });
          return;
        }
        trackFunnelEvent('ideas_table_autofill_triggered', {
          ideaId,
          rowCount: selectedRows.length,
        });
        toast(isPl ? 'Generuję mapowania autofill...' : 'Generating autofill mappings...', {
          icon: '🤖',
          duration: 2000,
        });
        try {
          const result = await Api.generateIdeaAI(ideaId, {
            generatorType: 'ai_autofill_mappings',
            tool: 'table',
            context: {
              seedText: `Autofill ${selectedRows.length} rows from linked artifacts`,
              title: '',
              existingNodes: selectedRows.map((r) => ({
                id: r.id,
                label: r.data?.label,
                artifactLinks: r.data?.artifactLinks,
              })),
              existingEdges: [],
              language: isPl ? 'pl' : 'en',
            },
          });
          const mappings = (result as any)?.view_patch?.autofillMappings;
          if (Array.isArray(mappings) && mappings.length > 0) {
            let appliedCount = 0;
            nodesUndo.push(
              nodes.map((n) => {
                const mapping = mappings.find((m: any) => m.nodeId === n.id || m.rowId === n.id);
                if (!mapping?.fields) return n;
                const updatedData = { ...n.data };
                for (const [key, val] of Object.entries(mapping.fields)) {
                  if (val !== undefined && val !== null && val !== '') {
                    updatedData[key] = val;
                    appliedCount++;
                  }
                }
                return { ...n, data: updatedData };
              })
            );
            toast.success(
              isPl
                ? `Zastosowano ${appliedCount} pól z ${mappings.length} mapowań`
                : `Applied ${appliedCount} fields from ${mappings.length} mappings`,
              { duration: 3000 }
            );
          } else {
            toast(isPl ? 'Brak mapowań do zastosowania' : 'No mappings found to apply', {
              icon: 'ℹ️',
            });
          }
        } catch {
          toast.error(isPl ? 'Autofill nie powiódł się' : 'Autofill failed');
        }
        return;
      }

      // Refresh artifact data
      if (action === 'tbl_refresh_artifact_data') {
        trackFunnelEvent('ideas_table_refresh_triggered', { ideaId });
        toast(isPl ? 'Odświeżanie danych z artefaktów...' : 'Refreshing data from artifacts...', {
          icon: '🔄',
          duration: 2000,
        });
        try {
          const rowsWithArtifacts = nodes.filter(
            (n) => Array.isArray(n.data?.artifactLinks) && n.data.artifactLinks.length > 0
          );
          if (rowsWithArtifacts.length === 0) {
            toast(isPl ? 'Brak wierszy z artefaktami' : 'No rows with linked artifacts', {
              icon: 'ℹ️',
            });
          } else {
            const refreshResult = await Api.generateIdeaAI(ideaId, {
              generatorType: 'ai_autofill_mappings',
              tool: 'table',
              context: {
                seedText: `Refresh ${rowsWithArtifacts.length} rows from their linked artifacts`,
                title: '',
                existingNodes: rowsWithArtifacts.map((r) => ({
                  id: r.id,
                  label: r.data?.label,
                  artifactLinks: r.data?.artifactLinks,
                })),
                existingEdges: [],
                language: isPl ? 'pl' : 'en',
              },
            });
            const refreshMappings = (refreshResult as any)?.view_patch?.autofillMappings;
            if (Array.isArray(refreshMappings) && refreshMappings.length > 0) {
              let refreshedCount = 0;
              nodesUndo.push(
                nodes.map((n) => {
                  const mapping = refreshMappings.find(
                    (m: any) => m.nodeId === n.id || m.rowId === n.id
                  );
                  if (!mapping?.fields) return n;
                  const updatedData = { ...n.data };
                  for (const [key, val] of Object.entries(mapping.fields)) {
                    if (val !== undefined && val !== null && val !== '') {
                      updatedData[key] = val;
                      refreshedCount++;
                    }
                  }
                  return { ...n, data: updatedData };
                })
              );
              toast.success(
                isPl ? `Odświeżono ${refreshedCount} pól` : `Refreshed ${refreshedCount} fields`,
                { duration: 3000 }
              );
            } else {
              toast(isPl ? 'Brak zmian do zastosowania' : 'No changes to apply', { icon: 'ℹ️' });
            }
          }
        } catch {
          toast.error(isPl ? 'Odświeżanie nie powiodło się' : 'Refresh failed');
        }
        return;
      }

      // Link artifact to row
      if (action === 'tbl_link_artifact_to_row') {
        if (selectedRowIds.size > 0) {
          const firstId = Array.from(selectedRowIds)[0];
          window.dispatchEvent(
            new CustomEvent('idea-workspace-attach-knowledge', {
              detail: { nodeId: firstId, ideaId },
            })
          );
        } else {
          toast(isPl ? 'Najpierw zaznacz wiersz' : 'Select a row first', {
            icon: '🔗',
            duration: 2000,
          });
        }
      }
    };

    window.addEventListener('idea-workspace-quick-action', handler);
    return () => window.removeEventListener('idea-workspace-quick-action', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, ideaId, isPl, nodes, nodesUndo, selectedRowIds, handlers.handleAddRow]);
}
