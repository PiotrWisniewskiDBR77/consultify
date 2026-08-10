/**
 * REJESTR AKCJI Idea Workspace — rdzeń standardu (barrel publicznego API).
 *
 * SSOT: `docs/standards/idea-workspace/02_REJESTR_AKCJI.md`.
 *
 * PO CO TO JEST (powód powstania, nie ozdoba):
 * commit f5d0271992 naprawił ~40 martwych kliknięć na reprezentację, ale
 * PUNKTOWO — powłoka (Menu 3, popovery raila, prawy panel) nadal wysyła
 * gołe stringi akcji, więc następna akcja `mm_*` dopisana do wspólnej
 * powierzchni znowu będzie martwa. Rejestr + strażnik `scripts/check-actions.sh`
 * mają sprawić, że wprowadzenie martwego kliknięcia stanie się NIEMOŻLIWE:
 *   Z1 — akcja jest zadeklarowana RAZ, a pole `tools` fizycznie decyduje,
 *        w których reprezentacjach w ogóle istnieje (koniec rozjazdu nazw),
 *   Z3 — `handler` jest polem WYMAGANYM (akcja bez handlera się nie kompiluje),
 *        a strażnik sprawdza, że każdy string runtime ma odbiornik w hooku,
 *        każdy `CustomEvent` ma listenera i każdy endpoint istnieje w routerze,
 *   Z4 — `teresa.description` + `teresa.parameters` generują manifest narzędzi
 *        asystentki (`src/actions/teresaActionManifest.ts`), więc nowa akcja
 *        jest dostępna dla Teresy automatycznie.
 *
 * ★ PODZIAŁ MODUŁU (QG-01, 2026-08-10) ★ — plik przekroczył 9000 linii i 231
 * zarejestrowanych akcji, więc definicje SĄ TERAZ rozbite per narzędzie w
 * `src/actions/registry/`:
 *   `types.ts`            — typy kontraktu (Lang/ActionDef/ActionContext/…)
 *   `runtimeHelpers.ts`   — mapy `RUNTIME_*` + funkcje `run*Callback`/`dispatch*`
 *   `mindmapActions.ts`   — akcje z `tools: ['mindmap']`
 *   `whiteboardActions.ts`— akcje z `tools: ['whiteboard']`
 *   `processFlowActions.ts` — akcje z `tools: ['process_flow']`
 *   `tableActions.ts`     — akcje z `tools: ['table']`
 *   `sharedActions.ts`    — `tools: 'all'` i akcje wielo-toolowe
 * TEN plik pozostaje JEDYNYM publicznym API (import path bez zmian:
 * `@/actions/ideaActionRegistry`) — importuje pięć tablic domenowych,
 * skleja je w `IDEA_ACTIONS` i eksportuje dokładnie te same
 * funkcje/dostępy co przed podziałem (`getAction`, `isActionAvailableInTool`,
 * `getActionsForSurface`, `runIdeaAction`, `IDEA_ACTION_REGISTRY`) — ID-y,
 * kolejność logiki i zachowanie BEZ ZMIAN, tylko fizyczna lokalizacja
 * definicji.
 *
 * ⚠ KONTRAKT FORMATU (czyta go `scripts/check-actions.sh`, awk-em, nie parserem TS):
 *   • mapy runtime deklarujemy jako `export const RUNTIME_*: ToolActionMap = { … }`
 *     w `registry/runtimeHelpers.ts`, z jedną parą `tool: 'action_string',` w linii,
 *   • każda akcja to jeden literał obiektu wcięty o 2 spacje w tablicy
 *     `export const XXX_ACTIONS: ActionDef[]` w odpowiednim `registry/*.ts`,
 *     a pola akcji (`id:`, `handler:`, `surfaces:` …) o 4 spacje,
 *   • `id` i pola logiczne (`mutates`, `showsDisabled`) w JEDNEJ linii.
 * Zmiana formatu = zmiana strażnika (teraz skanuje `ideaActionRegistry.ts`
 * ORAZ `registry/*.ts` — patrz komentarz na górze `scripts/check-actions.sh`).
 * Bez tego rejestr przestaje być pilnowany.
 *
 * CZEGO TU JESZCZE NIE MA (świadomie, patrz raport fali):
 *   powierzchnie UI NIE renderują się jeszcze z rejestru — to następna fala
 *   (rozdz. 02, „Kolejność wdrożenia rdzenia", punkty 2–3 i 6).
 */

export * from './registry/types';
// `export * from './registry/types'` re-eksportuje typy DLA KONSUMENTÓW, ale NIE
// wprowadza ich nazw do zasięgu TEGO pliku — stąd jawny `import type` poniżej.
// (`ActionResult` zgubił się przy podziale QG-01 i wywalał `tsc`: TS2304 w
// sygnaturze `runIdeaAction`.)
import type { ActionDef, ActionContext, ActionResult, Surface, Tool } from './registry/types';

import { MINDMAP_ACTIONS } from './registry/mindmapActions';
import { WHITEBOARD_ACTIONS } from './registry/whiteboardActions';
import { PROCESS_FLOW_ACTIONS } from './registry/processFlowActions';
import { TABLE_ACTIONS } from './registry/tableActions';
import { SHARED_ACTIONS } from './registry/sharedActions';

// ──────────────────────────────── REJESTR ────────────────────────────────
// `getActionsForSurface` PRESERWUJE kolejność `IDEA_ACTIONS` (dokumentacja
// w `IdeaCanvasContextMenu.tsx:358` — kolejność menu = kolejność rejestru).
// Podział na moduły per narzędzie fizycznie zmienia kolejność zapisu w
// źródle (grupowanie mindmap/whiteboard/processFlow/table/shared zamiast
// oryginalnego porządku przeplecionego), więc `ORIGINAL_ORDER` odtwarza
// DOKŁADNĄ kolejność sprzed podziału (QG-01, 2026-08-10) — bez tego kroku
// kolejność pozycji w Menu 3 / menu kontekstowym zmieniłaby się mimo
// identycznego zestawu id-ków, co jest realną zmianą zachowania UI.
const ORIGINAL_ORDER: readonly string[] = Object.freeze([
  'idea.element.add',
  'idea.view.auto_layout',
  'idea.canvas.cursor_select',
  'idea.ai.expand_map',
  'idea.templates.open',
  'idea.export.open',
  'idea.ai.summarize_map',
  'idea.ai.gap_analysis',
  'idea.ai.auto_connect',
  'idea.ai.find_themes',
  'idea.ai.name_clusters',
  'idea.ai.extract_actions',
  'idea.ai.process_analysis',
  'idea.ai.table_assistant',
  'idea.ai.table_categorize',
  'idea.view.mm_structure_type',
  'idea.ai.table_framework',
  'idea.view.saved_view_rename',
  'idea.view.saved_view_update',
  'idea.view.saved_view_delete',
  'idea.template.apply',
  'idea.column.rename',
  'idea.column.sort',
  'idea.export.file',
  'idea.column.hide',
  'idea.column.delete',
  'table.row.edit',
  'table.row.note',
  'table.row.duplicate',
  'table.row.delete',
  'table.rows.bulk_delete',
  'idea.canvas.tbl_save',
  'table.rows.add_row',
  'idea.cell.copy',
  'idea.ai.table_schema_propose',
  'idea.cell.paste',
  'idea.cell.expand',
  'idea.cell.clear',
  'idea.view.table_apply_view',
  'idea.view.table_save_view',
  'idea.view.table_platform_saved_view_rename',
  'idea.view.table_platform_saved_view_update',
  'idea.view.table_platform_saved_view_delete',
  'idea.workspace.table_bulk_convert',
  'idea.view.table_add_row_with_template',
  'idea.view.table_scoring',
  'idea.view.table_export_presentation',
  'idea.view.table_pipeline',
  'idea.ai.table_copilot',
  'idea.view.table_voice_input',
  'idea.view.table_cross_relations',
  'idea.view.table_heatmap',
  'idea.workspace.convert',
  'idea.workspace.duplicate',
  'idea.workspace.business_case_save',
  'idea.workspace.business_case_lineage_add',
  'idea.workspace.business_case_lineage_remove',
  'idea.edge.edit_label',
  'idea.edge.insert_node',
  'idea.edge.reverse',
  'idea.edge.cycle_arrow',
  'idea.edge.cycle_style',
  'idea.edge.edit_relation',
  'idea.export.table_csv',
  'idea.table.copy_clipboard',
  'idea.edge.delete',
  'idea.edge.pf_edit_props',
  'idea.edge.pf_insert_node',
  'idea.edge.pf_condition_none',
  'idea.edge.pf_condition_yes',
  'idea.edge.pf_condition_no',
  'idea.edge.pf_condition_default',
  'idea.edge.pf_condition_exception',
  'idea.edge.pf_delete',
  'idea.node.pf_properties',
  'idea.node.pf_edit',
  'idea.node.pf_copy',
  'idea.node.pf_ai_rewrite_step',
  'idea.node.pf_convert_initiative',
  'idea.node.pf_artifact_links',
  'idea.node.pf_comments',
  'idea.node.pf_open_chat',
  'idea.view.pf_add_decision',
  'idea.view.pf_paste_at_point',
  'idea.lane.pf_rename',
  'idea.lane.pf_move_up',
  'idea.lane.pf_move_down',
  'idea.lane.pf_color',
  'idea.lane.pf_toggle_collapse',
  'idea.lane.pf_delete',
  'idea.view.pf_mode_classic',
  'idea.view.pf_mode_automation',
  'idea.view.pf_mode_vsm',
  'idea.view.pf_toggle_kpi',
  'idea.view.pf_validate',
  'idea.ai.pf_process_summary',
  'idea.view.pf_readback',
  'idea.view.pf_open_ai_proposal',
  'idea.node.pf_convert_task_set',
  'idea.node.pf_convert_report',
  'idea.node.pf_convert_analysis',
  'idea.canvas.insert_shape_circle',
  'idea.canvas.insert_shape_diamond',
  'idea.canvas.insert_shape_hexagon',
  'idea.view.pf_add_start',
  'idea.canvas.insert_image',
  'idea.canvas.insert_link',
  'idea.canvas.undo',
  'idea.canvas.redo',
  'idea.canvas.toggle_voting',
  'idea.canvas.cycle_role',
  'idea.canvas.toggle_follow',
  'idea.canvas.export_view',
  'idea.canvas.toggle_shortcuts',
  'idea.canvas.set_bg_dots',
  'idea.canvas.set_bg_grid',
  'idea.canvas.set_bg_lines',
  'idea.canvas.set_bg_blank',
  'idea.canvas.tidy_board',
  'idea.canvas.save',
  'idea.canvas.pf_save',
  'idea.canvas.clear_drawings',
  'idea.node.edit',
  'idea.node.copy',
  'idea.canvas.paste',
  'idea.canvas.wb_select_all',
  'idea.node.duplicate',
  'idea.node.bring_to_front',
  'idea.node.send_to_back',
  'idea.node.lock',
  'idea.node.delete',
  'idea.node.expand',
  'idea.node.challenge',
  'idea.node.find_evidence',
  'idea.node.suggest_connections',
  'idea.node.attach_knowledge',
  'idea.node.comments',
  'idea.node.ai_find_themes',
  'idea.node.ai_name_clusters',
  'idea.node.ai_extract_actions',
  'idea.canvas.fill_gap',
  'idea.canvas.brainstorm_here',
  'idea.canvas.to_mindmap',
  'idea.canvas.to_table',
  'idea.node.wb_open_detail',
  'idea.frame.select_contents',
  'idea.frame.add_selection',
  'idea.frame.resize_to_fit',
  'idea.frame.delete_with_contents',
  'idea.frame.delete_release',
  'idea.node.remove_from_frame',
  'idea.view.add_root_topic',
  'idea.view.copy_selection',
  'idea.view.cut_selection',
  'idea.view.paste_at_point',
  'idea.view.select_all',
  'idea.view.fit_view',
  'idea.view.auto_cluster',
  'idea.view.collapse_all',
  'idea.view.fold_level_1',
  'idea.view.fold_level_2',
  'idea.view.expand_all',
  'idea.ai.suggest_nodes',
  'idea.node.mm_edit',
  'idea.node.mm_open_detail',
  'idea.node.mm_add_child',
  'idea.node.mm_add_sibling',
  'idea.node.mm_duplicate',
  'idea.node.mm_copy',
  'idea.node.mm_cut',
  'idea.node.mm_paste',
  'idea.node.mm_toggle_collapse',
  'idea.node.mm_group_selected',
  'idea.node.mm_reparent_promote',
  'idea.node.mm_reparent_demote',
  'idea.node.mm_focus_subtree',
  'idea.node.mm_drill_down',
  'idea.node.mm_connect_to_selected',
  'idea.node.mm_detach_branch',
  'idea.node.mm_duplicate_branch',
  'idea.node.mm_convert_initiative',
  'idea.node.mm_convert_decision',
  'idea.node.mm_convert_tasks',
  'idea.node.mm_convert_branch_decision',
  'idea.node.mm_convert_branch_tasks',
  'idea.node.mm_convert_branch_task_set',
  'idea.node.mm_convert_branch_initiative',
  'idea.node.mm_convert_branch_process_flow',
  'idea.node.mm_ai_rewrite_node',
  'idea.node.mm_ai_expand_node',
  'idea.node.mm_ai_what_if',
  'idea.node.mm_apply_ai_suggestion',
  'idea.node.mm_summarize_branch',
  'idea.view.mm_ai_detect_dependencies',
  'idea.view.mm_ai_prioritize',
  'idea.view.mm_ai_competitors',
  'idea.node.mm_ai_suggest_links',
  'idea.node.mm_change_shape',
  'idea.node.mm_add_image',
  'idea.node.mm_copy_style',
  'idea.node.mm_paste_style',
  'idea.node.mm_vote_up',
  'idea.node.mm_assign',
  'idea.node.mm_comments',
  'idea.node.mm_attach_knowledge',
  'idea.node.mm_attach_artifact',
  'idea.node.mm_open_linked_artifacts',
  'idea.node.mm_copy_link',
  'idea.node.mm_delete',
  'table.date_dependency.save',
  'table.date_dependency.recalculate',
  'table.distribution_builder.create',
  'table.distribution_builder.execute',
  'table.distribution_builder.delete',
  'table.record_template.delete',
  'table.record_template.save',
  'table.automation.run_now',
  'table.automation.delete',
  'table.webhook_relay.delete',
  'table.distribution.create',
  'table.distribution.execute',
  'table.distribution.delete',
  'table.form.share_mode_change',
  'table.form.delete',
  'table.form_intake.save_allow_list',
  'table.interface.delete',
  'table.sharing.invite',
  'table.sharing.remove_collaborator',
  'table.sync.create',
  'table.sync.run_now',
  'table.sync.delete',
]);
const ORDER_INDEX: ReadonlyMap<string, number> = new Map(
  ORIGINAL_ORDER.map((id, i) => [id, i])
);
// Akcja, której NIE MA w `ORIGINAL_ORDER` (czyli dopisana po podziale), ląduje
// na KOŃCU, nie na początku. Pierwotny wariant `?? 0` wrzucał taką akcję na
// pozycję zerową — nowa pozycja cicho przeskakiwałaby na szczyt Menu 3 i menu
// kontekstowego, bez żadnego sygnału. `MAX_SAFE_INTEGER` sprawia, że najgorszy
// skutek zapomnianego wpisu to „na końcu listy", a nie „przed wszystkim".
// Sam brak wpisu łapie R11 w `scripts/check-actions.sh` (kontrola: zbiór
// `ORIGINAL_ORDER` MUSI być permutacją zbioru id-ków z `registry/*Actions.ts`).
// `Array.prototype.sort` jest stabilny (ES2019), więc akcje o równym indeksie
// zachowują kolejność źródłową.
const IDEA_ACTIONS: ActionDef[] = [
  ...MINDMAP_ACTIONS,
  ...WHITEBOARD_ACTIONS,
  ...PROCESS_FLOW_ACTIONS,
  ...TABLE_ACTIONS,
  ...SHARED_ACTIONS,
].sort(
  (a, b) =>
    (ORDER_INDEX.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
    (ORDER_INDEX.get(b.id) ?? Number.MAX_SAFE_INTEGER)
);

// ─────────────────────────── DOSTĘP DO REJESTRU ───────────────────────────

/**
 * Zamrożony rejestr — pojedyncze źródło prawdy o akcjach Idea Workspace.
 * `Object.freeze` jest twardą blokadą dopisania akcji „w locie" z komponentu:
 * akcja może powstać wyłącznie tutaj, czyli pod okiem strażnika.
 */
export const IDEA_ACTION_REGISTRY: readonly ActionDef[] = Object.freeze(
  IDEA_ACTIONS.map((a) => Object.freeze(a))
);

const BY_ID: ReadonlyMap<string, ActionDef> = new Map(IDEA_ACTIONS.map((a) => [a.id, a]));

export function getAction(id: string): ActionDef | undefined {
  return BY_ID.get(id);
}

/** Czy akcja w ogóle istnieje w danej reprezentacji (Z1 — pole `tools` rządzi). */
export function isActionAvailableInTool(def: ActionDef, tool: Tool): boolean {
  return def.tools === 'all' || def.tools.includes(tool);
}

/**
 * Co powierzchnia ma narysować. Akcja spoza `tools` trafia tu WYŁĄCZNIE gdy
 * `showsDisabled` — i wtedy z gotowym powodem wyszarzenia (Z3).
 */
export function getActionsForSurface(
  surface: Surface,
  ctx: Pick<ActionContext, 'tool'> & Partial<ActionContext>
): Array<{ def: ActionDef; disabledReason: string | null }> {
  const full: ActionContext = {
    ideaId: ctx.ideaId || '',
    tool: ctx.tool,
    selection: ctx.selection || { type: 'none', count: 0, ids: [] },
    surface,
    source: ctx.source || 'ui',
    language: ctx.language,
    params: ctx.params,
    confirmed: ctx.confirmed,
  };
  const out: Array<{ def: ActionDef; disabledReason: string | null }> = [];
  for (const def of IDEA_ACTIONS) {
    if (!def.surfaces.includes(surface)) continue;
    const inTool = isActionAvailableInTool(def, ctx.tool);
    if (!inTool && !def.showsDisabled) continue;
    const reason = def.disabledReason
      ? def.disabledReason(full)
      : inTool
        ? null
        : 'Niedostępne tutaj.';
    out.push({ def, disabledReason: reason });
  }
  return out;
}

/**
 * Jedyne wejście wykonawcze — używają go i powierzchnie UI, i Teresa.
 * Egzekwuje reguły bezpieczeństwa rozdz. 02: brak akcji = odmowa z komunikatem,
 * wyszarzenie = odmowa z powodem, `confirmBeforeRun` = wymagane potwierdzenie.
 */
export async function runIdeaAction(id: string, ctx: ActionContext): Promise<ActionResult> {
  const def = BY_ID.get(id);
  if (!def) {
    return { ok: false, actionId: id, message: `Nie znam akcji „${id}".` };
  }
  if (!isActionAvailableInTool(def, ctx.tool)) {
    const reason = def.disabledReason?.(ctx) || 'Ta akcja nie istnieje w tej reprezentacji.';
    return { ok: false, actionId: id, message: reason };
  }
  const blocked = def.disabledReason?.(ctx);
  if (blocked) {
    return { ok: false, actionId: id, message: blocked };
  }
  if (def.teresa.confirmBeforeRun && ctx.source === 'teresa' && !ctx.confirmed) {
    return {
      ok: false,
      actionId: id,
      message: `„${def.label.pl}" zmienia dane na trwałe — potwierdź, zanim to zrobię.`,
      // Addytywne (Krok A): powierzchnia czatu używa tego pola, żeby zamiast
      // samego tekstu odmowy wyrenderować przyciski „Potwierdź"/„Anuluj" —
      // ponowne wywołanie z `confirmed: true` idzie TĄ SAMĄ ścieżką
      // (executeTeresaTool → runIdeaAction), więc nie ma drugiego mechanizmu.
      data: { needsConfirmation: true, actionId: id },
    };
  }
  return def.handler(ctx);
}

