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
import { copyTableToClipboard, downloadCSV, exportToCSV } from './csvUtils';
import { isTableFieldProposalEnabled } from './tableFieldProposalFlag';
import type { ColumnDef, FilterGroup, SavedView, SortConfig, TableNode } from './tableTypes';
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
  /**
   * N8 (2026-08-10) — legacy (non-platform) widok zapisany. Te same funkcje,
   * które `IdeaTableTool.tsx`'s `viewContextMenu` ("Rename"/"Update"/"Delete")
   * i inline-rename input już wołają — dodane tu jako drugi wywołujący, nie
   * duplikowane. Sync, `useTableViews.ts`'s `updateSavedView`/`deleteSavedView`
   * (nie mylić z platform `TableDataProvider`'s async wersją tych samych nazw,
   * którą TableToolbar.tsx woła przez `useTableData()` — INNY mechanizm,
   * patrz `ideaActionRegistry.ts` przy `idea.view.saved_view_*`).
   */
  updateSavedView: (viewId: string, patch: Partial<SavedView>) => void;
  deleteSavedView: (viewId: string) => void;
  /**
   * N10 (2026-08-10) — PLATFORM widok zapisany (`idea.view.table_platform_saved_view_rename`/
   * `_delete` w ideaActionRegistry.ts). `TableToolbar.tsx` woła te SAME
   * funkcje bezpośrednio przez `useTableData()` (`ctx.updateSavedView`/
   * `.deleteSavedView` = `platformIntegration.updateSavedView`/
   * `.deleteSavedView`, `useTablePlatformViews.ts`) — realne, asynchroniczne
   * wywołania serwera, INNY mechanizm niż `updateSavedView`/`deleteSavedView`
   * wyżej (legacy, `useTableViews.ts`, synchroniczne).
   */
  platformUpdateSavedView: (viewId: string, patch: Partial<SavedView>) => Promise<void>;
  platformDeleteSavedView: (viewId: string) => Promise<void>;
  /**
   * N8.2 (2026-08-10) — menu kolumny (`idea.column.*` w ideaActionRegistry.ts).
   * Cztery funkcje przekazywane DOKŁADNIE takie, jakie woła dziś klik człowieka
   * w `IdeaTableTool.tsx` — nic tu nie jest nową funkcją ani „poprawioną"
   * wersją istniejącej:
   *  • `cycleSort` = `effectiveCycleSort` (~L518) — JEDYNA z czterech, która
   *    jest DWUTOROWA (sama w sobie: `usePlatform ? effectiveSetSort : setSort`),
   *    więc ta sama funkcja jest poprawna niezależnie od `usePlatform`.
   *  • `toggleColumn`/`deleteColumn`/`renameColumn` = wersje LEGACY z
   *    `useTableSchema.ts`. To NIE jest przeoczenie: dokładnie te legacy funkcje
   *    woła dziś klik człowieka w menu kolumny (odpowiednio L4009/L4018) i w
   *    inline-rename inpucie nagłówka (L3745/L3750), mimo że
   *    `platformIntegration` ma własne, RÓŻNE MECHANIZMEM odpowiedniki
   *    (`deleteColumn` = realne `TablePlatformApi.deleteField`, czyli kasowanie
   *    po stronie serwera). Trzymamy parytet z klikiem człowieka zamiast po
   *    cichu dawać Teresie MOCNIEJSZE (trwałe, serwerowe) uprawnienia niż ma
   *    użytkownik przy tym samym menu — rozjazd legacy/platform jest
   *    udokumentowany jako PREISTNIEJĄCY defekt przy `idea.column.hide`
   *    w rejestrze, nie naprawiany po cichu w tym zadaniu.
   */
  cycleSort: (key: string) => void;
  toggleColumn: (key: string) => void;
  deleteColumn: (key: string) => void;
  renameColumn: (key: string, newHeader: string) => void;
  /**
   * N8.2 (2026-08-10) — row context menu ("Edit"/"Add note"). Exactly the
   * closures `IdeaTableTool.tsx`'s `rowContextMenu` onSelect handlers call
   * (`openRowEditPanel`/`openRowNotePanel`, declared right above the hook
   * call) — passed here so Teresa reaches the identical UI-state transition
   * a human right-click makes, not a re-implementation.
   */
  openRowEditPanel: (rowId: string) => void;
  openRowNotePanel: (rowId: string) => void;
  /**
   * N8.2 (2026-08-10) — row context menu ("Duplicate row"/"Delete row").
   * These are `effectiveHandleDuplicateRow`/a toast-wrapped
   * `effectiveHandleDeleteRow` (IdeaTableTool.tsx ~line 511-516) — the SAME
   * usePlatform-branching functions the row menu already calls, so Teresa's
   * mutation lands through whichever mechanism (legacy in-memory vs platform
   * server-backed) is actually active for this table today.
   */
  duplicateRow: (rowId: string) => void;
  deleteRow: (rowId: string) => void;
  /**
   * N9 (2026-08-10) — `idea.cell.clear` (ideaActionRegistry.ts). DOKŁADNIE
   * `_fieldChange` z `IdeaTableTool.tsx` (dual-path: `handleFieldChange`
   * legacy vs `platformIntegration.handleFieldChange`, wybór po
   * `usePlatform`, ~L665) — przekazane 1:1, żeby ta ścieżka Teresy trafiała w
   * TE SAME dane co klik człowieka na "Clear cell" (~L4169), nie zawsze w
   * legacy `nodes` (który reszta tego hooka, np. `tbl_export_csv`, dziś
   * używa bez względu na tryb — osobny, nienaprawiany tu wzorzec).
   */
  fieldChange: (rowId: string, colKey: string, value: unknown) => void;
}

export interface UseTableQuickActionsOpts {
  ideaId: string;
  isPl: boolean;
  columns: ColumnDef[];
  nodes: TableNode[];
  nodesUndo: UseUndoRedoReturn<TableNode[]>;
  selectedRowIds: Set<string>;
  handlers: QuickActionHandlers;
  /**
   * N8 (2026-08-10) — bieżący stan widoku, potrzebny WYŁĄCZNIE do zbudowania
   * payloadu `tbl_view_update` (dokładnie ten sam kształt, co
   * `viewContextMenu`'s "Update" item w `IdeaTableTool.tsx`: `sort`/`filters`/
   * `groupBy`/`layout`/`columns` migawka BIEŻĄCEGO stanu tabeli w momencie
   * wywołania — stąd wartości, nie settery, i osobne od `handlers` powyżej).
   */
  savedViews: SavedView[];
  sort: SortConfig | null;
  filters: FilterGroup;
  groupBy: string | null;
  viewLayout: ViewLayout;
  /**
   * N10 (2026-08-10) — PLATFORM widok zapisany, guard dla
   * `tbl_view_rename_platform`/`tbl_view_delete_platform` (`idea.view.table_platform_saved_view_*`
   * w ideaActionRegistry.ts). Osobne od `savedViews` wyżej (legacy) —
   * `platformIntegration.savedViews`, przekazywane 1:1 z `IdeaTableTool.tsx`.
   */
  platformSavedViews: SavedView[];
  /**
   * N9 (2026-08-10) — `tbl_cell_clear` guard. Ta sama wartość, którą
   * `cellContextMenu`'s "Clear cell" czyta z domknięcia komponentu
   * (`IdeaTableTool.tsx` prop `locked`, domyślnie `false`).
   */
  locked: boolean;
}

export function useTableQuickActions(opts: UseTableQuickActionsOpts): void {
  const {
    ideaId,
    isPl,
    columns,
    nodes,
    nodesUndo,
    selectedRowIds,
    handlers,
    savedViews,
    sort,
    filters,
    groupBy,
    viewLayout,
    platformSavedViews,
    locked,
  } = opts;

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

      // `idea.table.copy_clipboard` (ideaActionRegistry.ts) — NOT an export
      // (docs/standards/idea-workspace/10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md
      // §1 deciding rule: produces neither a file nor a persistent record, so
      // it is neither Export nor Convert). Mirrors `tbl_export_csv` immediately
      // above 1:1 (same `columns`/`nodes` source, same pre-existing legacy/
      // platform divergence noted at `QuickActionHandlers.fieldChange` above —
      // not fixed here).
      if (action === 'tbl_copy_clipboard') {
        copyTableToClipboard(columns, nodes);
        toast.success(i18n.t('ideas.table.copied', 'Copied'));
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

      // N8 (2026-08-10) — saved-view menu (`idea.view.saved_view_*` w
      // ideaActionRegistry.ts). Teresa-only ścieżka: klik człowieka (menu
      // kontekstowe PRAWEGO klika na zakładce widoku + inline-rename input,
      // `IdeaTableTool.tsx`) NIE przechodzi przez tę szynę — woła
      // `updateSavedView`/`deleteSavedView` bezpośrednio, nietknięte tym
      // wpisem. Te trzy gałęzie istnieją, żeby ta sama, realna mutacja była
      // osiągalna też z czatu.
      if (action === 'tbl_view_rename' || action === 'tbl_view_update' || action === 'tbl_view_delete') {
        const viewId = typeof detail?.viewId === 'string' ? detail.viewId : undefined;
        // Uczciwa reakcja zamiast cichego no-opu, gdy Teresa poda nieistniejące
        // (lub już usunięte) `viewId` — `updateSavedView`/`deleteSavedView`
        // (useTableViews.ts) same by po cichu nic nie zrobiły (prev.map/filter
        // bez dopasowania).
        const view = viewId ? savedViews.find((v) => v.id === viewId) : undefined;
        if (!viewId || !view) {
          toast.error(
            i18n.t('ideas.table.quickActions.viewNotFound', 'View not found: {{viewId}}', {
              viewId: viewId ?? '?',
            })
          );
          return;
        }
        if (action === 'tbl_view_rename') {
          const name = typeof detail?.name === 'string' ? detail.name.trim() : undefined;
          if (name) handlers.updateSavedView(viewId, { name });
          return;
        }
        if (action === 'tbl_view_update') {
          handlers.updateSavedView(viewId, {
            sort: sort ? [sort] : undefined,
            filters,
            groupBy: groupBy ?? undefined,
            layout: viewLayout,
            columns: columns.map((c) => ({ key: c.key, visible: c.visible !== false, width: c.width })),
          });
          toast.success(i18n.t('ideas.table.viewUpdated', 'View updated'));
          return;
        }
        // tbl_view_delete
        handlers.deleteSavedView(viewId);
        toast.success(i18n.t('ideas.table.viewDeleted', 'View deleted'));
        return;
      }

      // N10 (2026-08-10) — `TableToolbar.tsx`'s widok zapisany, ścieżka
      // PLATFORM (`idea.view.table_platform_saved_view_rename`/`_delete` w
      // ideaActionRegistry.ts). Odrębna od `tbl_view_rename`/`tbl_view_delete`
      // wyżej — TE wołają `platformIntegration.updateSavedView`/
      // `.deleteSavedView` (realne, asynchroniczne wywołania serwera), NIE
      // legacy `useTableViews.ts`. Teresa-only ścieżka: klik człowieka
      // (`TableToolbar.tsx`'s `viewContextMenu`, ~L502-555) NIE przechodzi
      // przez tę szynę — woła `ctx.updateSavedView`/`.deleteSavedView`
      // bezpośrednio z `useTableData()`, nietknięte tym wpisem.
      if (action === 'tbl_view_rename_platform' || action === 'tbl_view_delete_platform') {
        const viewId = typeof detail?.viewId === 'string' ? detail.viewId : undefined;
        const view = viewId ? platformSavedViews.find((v) => v.id === viewId) : undefined;
        if (!viewId || !view) {
          toast.error(
            i18n.t('ideas.table.quickActions.viewNotFound', 'View not found: {{viewId}}', {
              viewId: viewId ?? '?',
            })
          );
          return;
        }
        if (action === 'tbl_view_rename_platform') {
          const name = typeof detail?.name === 'string' ? detail.name.trim() : undefined;
          if (name) void handlers.platformUpdateSavedView(viewId, { name });
          return;
        }
        // tbl_view_delete_platform
        void handlers.platformDeleteSavedView(viewId);
        toast.success(i18n.t('ideas.table.viewDeleted', 'View deleted'));
        return;
      }

      // N8.2 (2026-08-10) — menu kolumny (`idea.column.*` w
      // ideaActionRegistry.ts). Ścieżka WYŁĄCZNIE dla Teresy: klik człowieka w
      // `colContextMenu` (`IdeaTableTool.tsx` ~L3990-4022) NIE przechodzi tędy —
      // woła te same cztery funkcje bezpośrednio z domknięcia i został
      // NIETKNIĘTY (bajt-identyczne zachowanie kliku). Te gałęzie istnieją, żeby
      // ta sama, realna zmiana była osiągalna też z czatu.
      if (
        action === 'tbl_column_rename' ||
        action === 'tbl_column_sort' ||
        action === 'tbl_column_hide' ||
        action === 'tbl_column_delete'
      ) {
        const colKey = typeof detail?.colKey === 'string' ? detail.colKey : undefined;
        // Uczciwa odmowa zamiast cichego no-opu: wszystkie cztery funkcje
        // (`useTableSchema.ts`) to `prev.map`/`prev.filter` po `c.key === key` —
        // przy nieistniejącym kluczu nie zrobiłyby NIC i nie powiedziały nic.
        const column = colKey ? columns.find((c) => c.key === colKey) : undefined;
        if (!colKey || !column) {
          toast.error(
            i18n.t('ideas.table.quickActions.columnNotFound', 'Column not found: {{colKey}}', {
              colKey: colKey ?? '?',
            })
          );
          return;
        }
        if (action === 'tbl_column_rename') {
          // Klik człowieka otwiera TYLKO inline-edytor nagłówka
          // (`setEditingHeaderKey`); dokończeniem jest `renameColumn` na
          // blur/Enter. Teresa nie ma jak „wpisać" w input, więc wykonuje
          // dokończony gest — TĄ SAMĄ funkcją, której używa commit inputa.
          const name = typeof detail?.name === 'string' ? detail.name.trim() : undefined;
          if (!name) {
            toast.error(
              i18n.t(
                'ideas.table.quickActions.columnNameRequired',
                'Provide a new column name to rename it.'
              )
            );
            return;
          }
          handlers.renameColumn(colKey, name);
          return;
        }
        if (action === 'tbl_column_sort') {
          handlers.cycleSort(colKey);
          return;
        }
        if (action === 'tbl_column_hide') {
          handlers.toggleColumn(colKey);
          return;
        }
        // tbl_column_delete
        handlers.deleteColumn(colKey);
        toast.success(i18n.t('ideas.table.columnDeleted', 'Column deleted'));
        return;
      }

      // N8.2 (2026-08-10) — row context menu (`table.row.*` w
      // ideaActionRegistry.ts). Teresa-only ścieżka: klik człowieka
      // (IdeaTableTool.tsx's `rowContextMenu`) NIE przechodzi przez tę szynę —
      // woła `openRowEditPanel`/`openRowNotePanel`/`effectiveHandleDuplicateRow`/
      // `effectiveHandleDeleteRow` bezpośrednio (nietknięte tym wpisem — te
      // handlery TU wołane to te same funkcje, tylko przekazane jako props).
      if (
        action === 'tbl_row_edit' ||
        action === 'tbl_row_note' ||
        action === 'tbl_row_duplicate' ||
        action === 'tbl_row_delete'
      ) {
        const rowId = typeof detail?.rowId === 'string' ? detail.rowId : undefined;
        if (!rowId) {
          toast.error(
            i18n.t('ideas.table.quickActions.rowIdRequired', 'Podaj rowId wiersza Tabeli')
          );
          return;
        }
        if (action === 'tbl_row_edit') {
          handlers.openRowEditPanel(rowId);
          return;
        }
        if (action === 'tbl_row_note') {
          handlers.openRowNotePanel(rowId);
          return;
        }
        if (action === 'tbl_row_duplicate') {
          handlers.duplicateRow(rowId);
          return;
        }
        // tbl_row_delete — `handlers.deleteRow` already wraps
        // `effectiveHandleDeleteRow` + the same success toast the human
        // right-click path shows (see IdeaTableTool.tsx handlers object).
        handlers.deleteRow(rowId);
        return;
      }

      // N9 (2026-08-10) — cell menu, jedyna z czterech pozycji z realnym
      // wejściem dla Teresy (`idea.cell.clear` w ideaActionRegistry.ts;
      // copy/paste/expand zostają UI-only — schowek systemowy / popover
      // zakotwiczony na ekranie, brak sensownego odpowiednika po stronie
      // czatu, patrz komentarz przy `runTableCellUiOnlyCallback`). Guard
      // odtwarza REGUŁĘ `cellContextMenu.editable` z `IdeaTableTool.tsx`
      // (kolumna „type"/formuła = pochodna, nie do edycji) z `columns`
      // dostępnym tu w zakresie hooka — Teresa nie ma dostępu do lokalnego
      // stanu `cellContextMenu`. Celowo BEZ sprawdzenia „czy wiersz istnieje"
      // przez legacy `nodes` (jak reszta tego hooka) — w trybie platformy
      // `nodes` tutaj NIE jest tablicą renderowaną na ekranie
      // (`platformIntegration.nodes` jest), więc taki check dawałby
      // fałszywe „nie znaleziono" dla poprawnych wierszy platformy;
      // `handlers.fieldChange` (przekazane jako `_fieldChange`, dual-path)
      // sam po cichu nic nie robi dla nieistniejącego `rowId` — ten sam
      // cichy no-op, co dzisiejszy klik człowieka na nieistniejącą komórkę
      // nie może w ogóle się zdarzyć (klik zawsze celuje w realną komórkę).
      if (action === 'tbl_cell_clear') {
        const rowId = typeof detail?.rowId === 'string' ? detail.rowId : undefined;
        const colKey = typeof detail?.colKey === 'string' ? detail.colKey : undefined;
        if (!rowId || !colKey) {
          toast.error(
            i18n.t('ideas.table.quickActions.cellTargetMissing', 'Missing cell target')
          );
          return;
        }
        if (locked) {
          toast.error(i18n.t('ideas.table.lockedReason', 'Table is locked'));
          return;
        }
        const col = columns.find((c) => c.key === colKey);
        if (!col || colKey === 'type' || col.type === 'formula') {
          toast.error(i18n.t('ideas.table.readOnlyCell', 'Cell is read-only'));
          return;
        }
        // ŚWIADOMA różnica wobec kliku człowieka, spisana zamiast przemilczana:
        // menu wyszarza „Wyczyść komórkę" także gdy komórka JEST JUŻ pusta
        // (`value == null || value === ''`, `IdeaTableTool.tsx` ~L4167). Tu tego
        // warunku NIE odtwarzam, bo wymagałby czytania wartości komórki, a
        // legacy `nodes` w tym hooku nie jest tablicą renderowaną w trybie
        // platformy (patrz akapit wyżej) — czytanie z niej dałoby FAŁSZYWE
        // „już pusta" dla realnie wypełnionych wierszy platformy, czyli ciche
        // odmówienie poprawnej operacji. Skutek świadomie przyjęty: Teresa może
        // wyczyścić komórkę już pustą — zapis `''` na `''`, bez zmiany dla
        // użytkownika, ale NA ŚCIEŻCE LEGACY dokłada wpis na stos cofania
        // (jedno „puste" Ctrl+Z). Nie ukrywam tego — patrz raport N9.
        handlers.fieldChange(rowId, colKey, '');
        toast.success(i18n.t('ideas.table.cellCleared', 'Cell cleared'));
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
  }, [
    columns,
    ideaId,
    isPl,
    nodes,
    nodesUndo,
    selectedRowIds,
    handlers.handleAddRow,
    savedViews,
    sort,
    filters,
    groupBy,
    viewLayout,
    // N8.2 (2026-08-10) — te cztery MUSZĄ być w zależnościach, inaczej Teresa
    // dostaje nieświeże domknięcie. Krytyczny przypadek: `cycleSort`
    // (`effectiveCycleSort`) czyta w trybie PLATFORMY `effectiveSort`, a nie
    // legacy `sort` — bez tej pozycji efekt nie przepiąłby się przy zmianie
    // sortowania platformy i `tbl_column_sort` cyklowałby ze STANU SPRZED
    // zmiany (asc→desc→null policzone od złego punktu). Pozostałe trzy dodane
    // dla tej samej klasy bezpieczeństwa; przepięcie listenera jest tanie.
    handlers.cycleSort,
    handlers.toggleColumn,
    handlers.deleteColumn,
    handlers.renameColumn,
    locked,
    handlers.fieldChange,
    // N10 (2026-08-10) — PLATFORM widok zapisany (patrz komentarz przy
    // `tbl_view_rename_platform`/`tbl_view_delete_platform` wyżej).
    platformSavedViews,
    handlers.platformUpdateSavedView,
    handlers.platformDeleteSavedView,
  ]);
}
