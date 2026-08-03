/**
 * useTableQuickActions — listens for 'idea-workspace-quick-action' CustomEvents
 * and dispatches them to the appropriate handler.
 *
 * Extracted from IdeaTableTool to reduce orchestrator size.
 */
import i18n from 'i18next';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { FieldFillProposal, FieldFillRowChange } from './AITableFieldProposal';
import { downloadCSV, exportToCSV } from './csvUtils';
import { isTableFieldProposalEnabled } from './tableFieldProposalFlag';
import type { ColumnDef, TableNode } from './tableTypes';
import type { ViewLayout } from './useTableViews';
import type { UseUndoRedoReturn } from './useUndoRedo';

/**
 * Buduje propozycję różnicy (przed → po) z mapowań AI, BEZ zapisu do danych.
 * Zwraca tylko wiersze i pola, które faktycznie się zmieniają. Pusty wynik = brak zmian.
 */
function buildFieldFillProposal(
  source: FieldFillProposal['source'],
  nodes: TableNode[],
  columns: ColumnDef[],
  mappings: Array<{ nodeId?: string; rowId?: string; fields?: Record<string, unknown> }>
): FieldFillProposal {
  const headerFor = (key: string): string => columns.find((c) => c.key === key)?.header ?? key;

  const rows: FieldFillRowChange[] = [];
  for (const node of nodes) {
    const mapping = mappings.find((m) => m.nodeId === node.id || m.rowId === node.id);
    if (!mapping?.fields) continue;
    const cells = [] as FieldFillRowChange['cells'];
    for (const [key, val] of Object.entries(mapping.fields)) {
      if (val === undefined || val === null || val === '') continue;
      const before = node.data?.[key];
      // Pomijamy „zmiany", które nic nie zmieniają (ta sama wartość).
      if (before === val) continue;
      cells.push({ key, header: headerFor(key), before, after: val });
    }
    if (cells.length > 0) {
      rows.push({ rowId: node.id, label: String(node.data?.label ?? node.id), cells });
    }
  }
  return { source, rows };
}

export interface QuickActionHandlers {
  handleAddRow: (label?: string) => void;
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
  /**
   * P1-6: pokazuje podgląd propozycji autofill/odświeżania (przed → po) zamiast
   * pisać prosto do komórek. Ustawiane tylko gdy flaga `ff_tableFieldProposal` = ON.
   */
  onFieldFillProposal?: (proposal: FieldFillProposal) => void;
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

      // Krok B: `idea.element.add` przekazuje `ctx.params.label` jako
      // `detail.label` — wyjęte z toggleMap (poniżej), bo tamta mapa woła
      // funkcje bez argumentów. Gdy label podany, nowy wiersz dostaje go od
      // razu jako `label` zamiast pustej wartości domyślnej.
      if (action === 'tbl_add_row') {
        const label =
          typeof detail?.label === 'string' && detail.label.trim()
            ? detail.label.trim()
            : undefined;
        handlers.handleAddRow(label);
        return;
      }

      // Simple toggle actions
      const toggleMap: Record<string, () => void> = {
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
          toast(
            i18n.t('ideas.table.quickActions.selectRowsToAutofill', 'Select rows to autofill'),
            { icon: '⚠️' }
          );
          return;
        }
        trackFunnelEvent('ideas_table_autofill_triggered', {
          ideaId,
          rowCount: selectedRows.length,
        });
        toast(
          i18n.t(
            'ideas.table.quickActions.generatingAutofillMappings',
            'Generating autofill mappings...'
          ),
          {
            icon: '🤖',
            duration: 2000,
          }
        );
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
            // P1-6: gdy flaga ON — nie piszemy do komórek, pokazujemy podgląd propozycji.
            if (isTableFieldProposalEnabled() && handlers.onFieldFillProposal) {
              const proposal = buildFieldFillProposal('autofill', nodes, columns, mappings);
              if (proposal.rows.length === 0) {
                toast(i18n.t('ideas.table.quickActions.noChangesToApply', 'No changes to apply'), {
                  icon: 'ℹ️',
                });
              } else {
                handlers.onFieldFillProposal(proposal);
              }
              return;
            }
            // OFF (domyślnie): zachowanie jak dziś — auto-apply (do akceptu Piotra na zrzutach).
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
              i18n.t(
                'ideas.table.quickActions.appliedFieldsFromMappings',
                'Applied {{appliedCount}} fields from {{mappingCount}} mappings',
                { appliedCount, mappingCount: mappings.length }
              ),
              { duration: 3000 }
            );
          } else {
            toast(
              i18n.t(
                'ideas.table.quickActions.noMappingsFoundToApply',
                'No mappings found to apply'
              ),
              {
                icon: 'ℹ️',
              }
            );
          }
        } catch {
          toast.error(i18n.t('ideas.table.quickActions.autofillFailed', 'Autofill failed'));
        }
        return;
      }

      // Refresh artifact data
      if (action === 'tbl_refresh_artifact_data') {
        trackFunnelEvent('ideas_table_refresh_triggered', { ideaId });
        toast(
          i18n.t(
            'ideas.table.quickActions.refreshingDataFromArtifacts',
            'Refreshing data from artifacts...'
          ),
          {
            icon: '🔄',
            duration: 2000,
          }
        );
        try {
          const rowsWithArtifacts = nodes.filter(
            (n) => Array.isArray(n.data?.artifactLinks) && n.data.artifactLinks.length > 0
          );
          if (rowsWithArtifacts.length === 0) {
            toast(
              i18n.t(
                'ideas.table.quickActions.noRowsWithLinkedArtifacts',
                'No rows with linked artifacts'
              ),
              {
                icon: 'ℹ️',
              }
            );
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
              // P1-6: gdy flaga ON — podgląd propozycji zamiast nadpisania komórek.
              if (isTableFieldProposalEnabled() && handlers.onFieldFillProposal) {
                const proposal = buildFieldFillProposal('refresh', nodes, columns, refreshMappings);
                if (proposal.rows.length === 0) {
                  toast(
                    i18n.t('ideas.table.quickActions.noChangesToApply', 'No changes to apply'),
                    { icon: 'ℹ️' }
                  );
                } else {
                  handlers.onFieldFillProposal(proposal);
                }
                return;
              }
              // OFF (domyślnie): zachowanie jak dziś — auto-apply.
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
                i18n.t('ideas.table.quickActions.refreshedFields', 'Refreshed {{count}} fields', {
                  count: refreshedCount,
                }),
                { duration: 3000 }
              );
            } else {
              toast(i18n.t('ideas.table.quickActions.noChangesToApply', 'No changes to apply'), {
                icon: 'ℹ️',
              });
            }
          }
        } catch {
          toast.error(i18n.t('ideas.table.quickActions.refreshFailed', 'Refresh failed'));
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
          toast(i18n.t('ideas.table.quickActions.selectRowFirst', 'Select a row first'), {
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
