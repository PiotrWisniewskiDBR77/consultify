/**
 * WALIDATORY kontraktu powierzchni tabelowej.
 *
 * Wykrywają dokładnie te klasy defektów, które audyt 45 tabel policzył jako
 * powtarzalne (322 atomowe defekty w `ATOMIC_DEFECT_BACKLOG.csv`):
 * duplikaty `actionId`/label, brak wymaganej capability, strefy poza kanonem,
 * atrapy „Coming soon", liczniki w Menu 2, bulk bez realnej akcji, preview bez
 * bloku Relations, więcej niż jeden Open.
 *
 * Kontrakt walidatora:
 *  · NIE rzuca wyjątków — zwraca `ValidationResult` z pełną listą naruszeń,
 *    żeby test raportował wszystkie problemy naraz, a nie pierwszy napotkany;
 *  · każde naruszenie ma STABILNY `code` (asercje idą po kodzie, nie po tekście)
 *    i `clause` wskazujący paragraf kontraktu;
 *  · jest czysty i bez importów z warstwy UI — działa w teście, w skrypcie
 *    audytowym i w dev-warningu tak samo.
 *
 * REPAIR_MASTER_PLAN R03 wymaga „walidacji duplikatów ID/label w testach
 * I W TRYBIE DEV" — stąd `assertContractInDev` na końcu pliku.
 *
 * @module contracts/tableSurface/validators
 */

import {
  CANON_MENU2_PRIMARY_CTA_MAX,
  CANON_MENU2_RIGHT_CLUSTER_ORDER,
  CANON_MENU3_RIGHT_ACTIONS_MAX,
  CANON_PLACEHOLDER_LABEL_PATTERN,
  CANON_PREVIEW_LIMIT,
  CANON_PRIMARY_ACTIONS_MAX,
  CANON_ROW_MENU,
  CANON_ROW_MENU_ZONE_ORDER,
} from './canon';
import { MENU2_COUNTER_PATTERNS, type Menu2Contract, type Menu3State } from './menuContract';
import {
  CANON_DETAILS_ACTION_ORDER,
  countProseWords,
  flattenPreviewActions,
  previewBlockOrder,
  type PreviewSchema,
} from './previewSchema';
import {
  DANGER_ACTION_IDS,
  groupRowActionsByZone,
  manageActionOrderIndex,
  type RowActionMenuModel,
  rowActionSeparatorCount,
} from './rowActionModel';
import {
  type ContractViolation,
  type TableSurfaceCapabilities,
  type TableSurfaceContract,
  toResult,
  type ValidationResult,
} from './types';

/** Skrót konstruktora naruszenia — używany tylko w tym module. */
const v = (code: string, message: string, clause: string, path?: string): ContractViolation => ({
  code,
  message,
  clause,
  path,
});

/**
 * Zwraca wartości występujące więcej niż raz, w kolejności pierwszego wystąpienia.
 * Wyodrębnione, bo „duplikat" jest tu najczęstszym defektem i chcemy jednej,
 * przetestowanej implementacji zamiast czterech pętli.
 */
function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicated.add(value);
    else seen.add(value);
  }
  return [...duplicated];
}

// ─── RowActionModel ─────────────────────────────────────────────────────────

/**
 * Waliduje model menu wiersza (§7 Kebab, §8 PPM).
 *
 * `capabilities` jest opcjonalne: bez niego sprawdzamy spójność wewnętrzną
 * modelu, z nim dodatkowo zgodność z deskryptorem powierzchni (czy pozycja
 * `archive` w ogóle ma prawo istnieć dla tej encji).
 */
export function validateRowActionModel(
  model: RowActionMenuModel,
  capabilities?: TableSurfaceCapabilities
): ValidationResult {
  const violations: ContractViolation[] = [];
  const at = `${model.surfaceId}/${model.recordId}`;

  // — duplikaty —
  for (const duplicate of findDuplicates(model.actions.map((a) => a.actionId))) {
    violations.push(
      v(
        'ROW_ACTION_DUPLICATE_ID',
        `Duplicate actionId "${duplicate}" in row menu (${at}).`,
        'contract §7 Zakazy',
        `actions[actionId=${duplicate}]`
      )
    );
  }
  for (const duplicate of findDuplicates(model.actions.map((a) => a.label))) {
    violations.push(
      v(
        'ROW_ACTION_DUPLICATE_LABEL',
        `Duplicate label "${duplicate}" in row menu (${at}); ` +
          'View/Open/Open preview with the same effect are forbidden.',
        'contract §7 Zakazy',
        `actions[label=${duplicate}]`
      )
    );
  }

  // — strefy i separatory —
  const groups = groupRowActionsByZone(model);
  const renderedZones = groups.map((g) => g.zone);
  const canonicalOrder = CANON_ROW_MENU_ZONE_ORDER.filter((z) => renderedZones.includes(z));
  if (renderedZones.join('>') !== canonicalOrder.join('>')) {
    violations.push(
      v(
        'ROW_ACTION_ZONE_ORDER',
        `Zones render as ${renderedZones.join(' > ')}; canon is context → manage → danger.`,
        'contract §7 Logiczne strefy'
      )
    );
  }
  const separators = rowActionSeparatorCount(model);
  if (separators > CANON_ROW_MENU.separatorsMax) {
    violations.push(
      v(
        'ROW_ACTION_TOO_MANY_SEPARATORS',
        `${separators} separators; canon allows at most ${CANON_ROW_MENU.separatorsMax}.`,
        'contract §7 Zakazy'
      )
    );
  }

  // — kolejność w strefie manage —
  const manageIds = model.actions.filter((a) => a.zone === 'manage').map((a) => a.actionId);
  const known = manageIds.filter((id) => manageActionOrderIndex(id) >= 0);
  const sorted = [...known].sort((a, b) => manageActionOrderIndex(a) - manageActionOrderIndex(b));
  if (known.join(',') !== sorted.join(',')) {
    violations.push(
      v(
        'ROW_ACTION_MANAGE_ORDER',
        `Manage zone order is ${known.join(' → ')}; canon is ` +
          'Open preview → Edit → Archive/Restore → Delay.',
        'contract §7 Manage'
      )
    );
  }

  for (const action of model.actions) {
    const path = `actions[${action.actionId}]`;

    // — atrapy —
    if (CANON_PLACEHOLDER_LABEL_PATTERN.test(action.label)) {
      violations.push(
        v(
          'ROW_ACTION_PLACEHOLDER_LABEL',
          `"${action.label}" is a Coming-soon placeholder; unbuilt functions are ` +
            'omitted from the menu and reported as a capability gap.',
          'contract §1, §10',
          path
        )
      );
    }
    if (action.disabled && !action.disabledReason) {
      violations.push(
        v(
          'ROW_ACTION_DISABLED_WITHOUT_REASON',
          `Disabled action "${action.actionId}" declares no reason; disabled is ` +
            'legal only for a real record/role/business restriction.',
          'contract §10 Disabled',
          path
        )
      );
    }
    if (!action.disabled && action.disabledReason) {
      violations.push(
        v(
          'ROW_ACTION_REASON_WITHOUT_DISABLED',
          `Action "${action.actionId}" carries a disabledReason but is enabled.`,
          'contract §10 Disabled',
          path
        )
      );
    }
    if (action.disabledDetail && action.label.includes(action.disabledDetail)) {
      violations.push(
        v(
          'ROW_ACTION_REASON_LEAKED_TO_LABEL',
          `Disabled reason is appended to the label of "${action.actionId}"; ` +
            'the reason stays in the capability descriptor, never in the menu item.',
          'contract §7, §10 Disabled',
          path
        )
      );
    }

    // — danger —
    const isDangerId = DANGER_ACTION_IDS.includes(action.actionId);
    if (isDangerId && action.zone !== 'danger') {
      violations.push(
        v(
          'ROW_ACTION_DANGER_WRONG_ZONE',
          `"${action.actionId}" is destructive but sits in zone "${action.zone}".`,
          'contract §7 Danger',
          path
        )
      );
    }
    if (action.zone === 'danger' && !action.disabled && !action.confirmation) {
      violations.push(
        v(
          'ROW_ACTION_DANGER_WITHOUT_CONFIRMATION',
          `Destructive action "${action.actionId}" has no confirmation.`,
          'contract §9',
          path
        )
      );
    }
  }

  // — danger zawsze OSTATNIE —
  const lastAction = model.actions[model.actions.length - 1];
  const hasDanger = model.actions.some((a) => a.zone === 'danger');
  if (hasDanger && lastAction && lastAction.zone !== 'danger') {
    violations.push(
      v(
        'ROW_ACTION_DANGER_NOT_LAST',
        'Delete/Reject/Move to trash must be the last item in the menu.',
        'contract §7 Danger'
      )
    );
  }

  // — zgodność z deskryptorem capability —
  if (capabilities) {
    violations.push(...validateRowActionsAgainstCapabilities(model, capabilities));
  }

  return toResult(violations);
}

/**
 * Sprawdza, czy menu deklaruje pozycje wymagane przez capabilities i czy nie
 * renderuje pozycji dla capability `not-applicable`.
 *
 * §1: „funkcja `not-applicable` jest POMIJANA, a nie renderowana jako atrapa";
 * §7 Manage: `Open preview` jest ZAWSZE, `Edit`/`Archive`/`Delay` warunkowo.
 */
function validateRowActionsAgainstCapabilities(
  model: RowActionMenuModel,
  capabilities: TableSurfaceCapabilities
): ContractViolation[] {
  const violations: ContractViolation[] = [];
  const has = (id: string) => model.actions.some((a) => a.actionId === id);

  if (!has('open-preview')) {
    violations.push(
      v(
        'ROW_ACTION_MISSING_REQUIRED_CAPABILITY',
        'Manage zone must always contain "Open preview".',
        'contract §7 Manage',
        'actions[open-preview]'
      )
    );
  }

  const conditional: Array<[string, boolean, string]> = [
    ['edit', capabilities.edit !== 'not-applicable', 'capabilities.edit'],
    ['archive', capabilities.archive === 'supported', 'capabilities.archive'],
    ['delay', capabilities.dueDate, 'capabilities.dueDate'],
  ];

  for (const [actionId, expected, source] of conditional) {
    if (expected && !has(actionId)) {
      violations.push(
        v(
          'ROW_ACTION_MISSING_REQUIRED_CAPABILITY',
          `${source} requires action "${actionId}" but the menu omits it.`,
          'contract §7 Manage',
          `actions[${actionId}]`
        )
      );
    }
    if (!expected && has(actionId)) {
      violations.push(
        v(
          'ROW_ACTION_UNDECLARED_CAPABILITY',
          `Action "${actionId}" is rendered although ${source} does not declare it; ` +
            'not-applicable functions are omitted, never rendered as a stub.',
          'contract §1',
          `actions[${actionId}]`
        )
      );
    }
  }

  // Delete: `supported` → aktywne z confirmation; `business-locked` → widoczne,
  // wyłączone, z powodem zapisanym w deskryptorze (§7 Danger).
  const deleteAction = model.actions.find((a) => DANGER_ACTION_IDS.includes(a.actionId));
  if (!deleteAction) {
    violations.push(
      v(
        'ROW_ACTION_MISSING_REQUIRED_CAPABILITY',
        'Danger zone must expose the destructive action declared by capabilities.delete.',
        'contract §7 Danger',
        'actions[delete]'
      )
    );
  } else if (capabilities.delete === 'business-locked' && !deleteAction.disabled) {
    violations.push(
      v(
        'ROW_ACTION_BUSINESS_LOCK_NOT_DISABLED',
        'capabilities.delete is business-locked, so the item must render disabled.',
        'contract §7 Danger',
        `actions[${deleteAction.actionId}]`
      )
    );
  }

  return violations;
}

// ─── PreviewSchema ──────────────────────────────────────────────────────────

/**
 * Waliduje deskryptor preview względem konkretnego rekordu (§6).
 *
 * Rekord jest potrzebny, bo selektory są funkcjami — limit słów prozy albo
 * liczba akcji są sprawdzalne dopiero na danych. Dlatego fixtures empty
 * i populated są częścią tego samego pakietu R00.
 */
export function validatePreviewSchema<T>(schema: PreviewSchema<T>, record: T): ValidationResult {
  const violations: ContractViolation[] = [];
  const at = schema.surfaceId;

  // — kolejność i kompletność bloków —
  const blocks = previewBlockOrder(schema);
  const mandatory = ['header', 'meta', 'details', 'relations', 'actions'] as const;
  for (const block of mandatory) {
    if (!blocks.includes(block)) {
      violations.push(
        v(
          'PREVIEW_MISSING_BLOCK',
          `Preview ${at} omits mandatory block "${block}".`,
          'contract §6 Sześć bloków',
          `blocks.${block}`
        )
      );
    }
  }

  // — dokładnie jeden Open w całym panelu —
  const actions = flattenPreviewActions(schema, record);
  const openCount =
    (schema.header.open ? 1 : 0) + actions.filter((a) => a.actionId === 'open').length;
  if (openCount !== 1) {
    violations.push(
      v(
        'PREVIEW_OPEN_NOT_UNIQUE',
        `Preview ${at} exposes ${openCount} Open controls; the canon allows exactly ` +
          'one, in the header.',
        'contract §6 Szczegóły'
      )
    );
  }

  // — duplikaty akcji (T43: trzy zduplikowane akcje preview) —
  for (const duplicate of findDuplicates(actions.map((a) => a.actionId))) {
    violations.push(
      v(
        'PREVIEW_DUPLICATE_ACTION_ID',
        `Duplicate preview actionId "${duplicate}" in ${at}.`,
        'contract §6 Actions',
        `actions[${duplicate}]`
      )
    );
  }
  for (const duplicate of findDuplicates(actions.map((a) => a.label))) {
    violations.push(
      v(
        'PREVIEW_DUPLICATE_ACTION_LABEL',
        `Duplicate preview action label "${duplicate}" in ${at}.`,
        'contract §6 Actions',
        `actions[label=${duplicate}]`
      )
    );
  }

  // — siatka akcji —
  const rows = schema.actions.rows(record);
  if (rows.length > CANON_PREVIEW_LIMIT.actionGridRowsMax) {
    violations.push(
      v(
        'PREVIEW_ACTION_GRID_OVERFLOW',
        `${rows.length} action rows; canon allows at most ` +
          `${CANON_PREVIEW_LIMIT.actionGridRowsMax}. Surplus belongs in the row kebab.`,
        'contract §6 Actions'
      )
    );
  }
  if (actions.length > CANON_PREVIEW_LIMIT.actionsDirectMax) {
    violations.push(
      v(
        'PREVIEW_ACTION_GRID_OVERFLOW',
        `${actions.length} direct actions; canon allows at most ` +
          `${CANON_PREVIEW_LIMIT.actionsDirectMax}.`,
        'contract §6 Actions'
      )
    );
  }
  for (const row of rows) {
    if (row.length > CANON_PREVIEW_LIMIT.actionGridColumns) {
      violations.push(
        v(
          'PREVIEW_ACTION_ROW_OVERFLOW',
          `An action row holds ${row.length} buttons; the grid has ` +
            `${CANON_PREVIEW_LIMIT.actionGridColumns} columns.`,
          'contract §6 Actions'
        )
      );
    }
  }
  const primaryCount = actions.filter((a) => a.variant === 'primary').length;
  if (primaryCount > CANON_PRIMARY_ACTIONS_MAX) {
    violations.push(
      v(
        'PREVIEW_MULTIPLE_PRIMARY',
        `${primaryCount} primary actions; canon allows at most ` + `${CANON_PRIMARY_ACTIONS_MAX}.`,
        'contract §6 Actions i przyciski'
      )
    );
  }
  for (const action of actions) {
    if (action.variant === 'destructive' && !action.confirmation) {
      violations.push(
        v(
          'PREVIEW_DESTRUCTIVE_WITHOUT_CONFIRMATION',
          `Destructive preview action "${action.actionId}" has no confirmation.`,
          'contract §9',
          `actions[${action.actionId}]`
        )
      );
    }
    if (action.label.length > CANON_PREVIEW_LIMIT.actionLabelCharsMax) {
      violations.push(
        v(
          'PREVIEW_ACTION_LABEL_TOO_LONG',
          `Label "${action.label}" exceeds ` +
            `${CANON_PREVIEW_LIMIT.actionLabelCharsMax} characters.`,
          'contract §6 Actions i przyciski',
          `actions[${action.actionId}]`
        )
      );
    }
  }

  // — Details —
  violations.push(...validatePreviewDetails(schema, record));

  // — Relations: blok obowiązkowy także pusty —
  if (!schema.relations.emptyLabel.trim()) {
    violations.push(
      v(
        'PREVIEW_RELATIONS_NO_EMPTY_LABEL',
        'Relations must declare a canonical empty label ("No relations"); the block ' +
          'renders even with zero relations.',
        'contract §6 Relations',
        'relations.emptyLabel'
      )
    );
  }

  // — AI: warunkowy, ale nigdy pusta atrapa —
  if (schema.ai && schema.ai.actions(record).length === 0) {
    violations.push(
      v(
        'PREVIEW_AI_EMPTY_STUB',
        'AI block is declared but yields no real actions; omit the block instead of ' +
          'rendering an empty stub.',
        'contract §6 AI, §10',
        'ai'
      )
    );
  }
  if (schema.ai) {
    const aiActions = schema.ai.actions(record);
    if (aiActions.length > CANON_PREVIEW_LIMIT.aiActionsDirectMax) {
      violations.push(
        v(
          'PREVIEW_AI_TOO_MANY_DIRECT',
          `${aiActions.length} direct AI actions; canon shows at most ` +
            `${CANON_PREVIEW_LIMIT.aiActionsDirectMax} with the rest in one overflow.`,
          'contract §6 AI',
          'ai.actions'
        )
      );
    }
  }

  // — Meta —
  const recommendation = schema.meta.recommendation?.(record);
  if (recommendation) {
    const words = countProseWords(recommendation);
    if (words > CANON_PREVIEW_LIMIT.metaRecommendationWordsHardMax) {
      violations.push(
        v(
          'PREVIEW_META_RECOMMENDATION_TOO_LONG',
          `Recommendation has ${words} words; hard maximum is ` +
            `${CANON_PREVIEW_LIMIT.metaRecommendationWordsHardMax}.`,
          'contract §6 Meta',
          'meta.recommendation'
        )
      );
    }
  }

  return toResult(violations);
}

/** Reguły bloku Details — tryb, limity i lokalny kebab (§6 Details). */
function validatePreviewDetails<T>(schema: PreviewSchema<T>, record: T): ContractViolation[] {
  const violations: ContractViolation[] = [];
  const { details } = schema;

  // Tryb i pasujący selektor muszą się zgadzać — inaczej blok renderuje pustkę.
  const selectorByMode = {
    prose: details.prose,
    properties: details.properties,
    'file-list': details.files,
  } as const;
  if (!selectorByMode[details.mode]) {
    violations.push(
      v(
        'PREVIEW_DETAILS_MODE_MISMATCH',
        `Details mode is "${details.mode}" but the matching selector is missing.`,
        'contract §6 Details',
        'details'
      )
    );
  }

  // Word count wyłącznie dla prozy (§6).
  if (details.showWordCount && details.mode !== 'prose') {
    violations.push(
      v(
        'PREVIEW_DETAILS_WORDCOUNT_MISPLACED',
        `Word count is shown for mode "${details.mode}"; it applies to prose only.`,
        'contract §6 Details',
        'details.showWordCount'
      )
    );
  }

  if (details.mode === 'prose' && details.prose) {
    const words = countProseWords(details.prose(record));
    // Pusty rekord (fixture empty) nie ma prozy — to nie jest naruszenie limitu.
    if (words > 0 && words < CANON_PREVIEW_LIMIT.proseWordsMin) {
      violations.push(
        v(
          'PREVIEW_DETAILS_PROSE_TOO_SHORT',
          `Details prose has ${words} words; canon requires ` +
            `${CANON_PREVIEW_LIMIT.proseWordsMin}–${CANON_PREVIEW_LIMIT.proseWordsMax}.`,
          'contract §6 Details',
          'details.prose'
        )
      );
    }
    if (words > CANON_PREVIEW_LIMIT.proseWordsSoftMax) {
      violations.push(
        v(
          'PREVIEW_DETAILS_PROSE_TOO_LONG',
          `Details prose has ${words} words; soft maximum is ` +
            `${CANON_PREVIEW_LIMIT.proseWordsSoftMax} (then scroll or Show more).`,
          'contract §6 Details',
          'details.prose'
        )
      );
    }
  }

  if (details.mode === 'properties' && details.properties) {
    const rows = details.properties(record);
    if (rows.length > CANON_PREVIEW_LIMIT.propertyRowsMax) {
      violations.push(
        v(
          'PREVIEW_DETAILS_TOO_MANY_PROPERTIES',
          `${rows.length} property rows; canon shows ` +
            `${CANON_PREVIEW_LIMIT.propertyRowsMin}–${CANON_PREVIEW_LIMIT.propertyRowsMax}.`,
          'contract §6 Details',
          'details.properties'
        )
      );
    }
  }

  // Kolejność lokalnego kebaba: Copy → Export → Download (§6).
  const order = details.contentActions.map((a) => a.actionId);
  const canonical = CANON_DETAILS_ACTION_ORDER.filter((id) => order.includes(id));
  if (order.join(',') !== canonical.join(',')) {
    violations.push(
      v(
        'PREVIEW_DETAILS_ACTION_ORDER',
        `Details kebab order is ${order.join(' → ')}; canon is Copy → Export → Download.`,
        'contract §6 Details',
        'details.contentActions'
      )
    );
  }

  return violations;
}

// ─── Menu 2 / Menu 3 ────────────────────────────────────────────────────────

/** Waliduje Menu 2 (§3). */
export function validateMenu2(menu: Menu2Contract): ValidationResult {
  const violations: ContractViolation[] = [];

  for (const tab of menu.tabs) {
    if (MENU2_COUNTER_PATTERNS.some((pattern) => pattern.test(tab.label))) {
      violations.push(
        v(
          'MENU2_COUNTER_IN_TAB',
          `Tab label "${tab.label}" carries a counter; Menu 2 never shows counters — ` +
            'they belong to Menu 3 chips.',
          'contract §3 Zakazy',
          `tabs[${tab.id}]`
        )
      );
    }
  }

  if (!menu.tabs.some((tab) => tab.id === menu.activeTabId)) {
    violations.push(
      v(
        'MENU2_ACTIVE_TAB_UNKNOWN',
        `activeTabId "${menu.activeTabId}" is not among the declared tabs.`,
        'contract §2 Zachowanie',
        'activeTabId'
      )
    );
  }

  for (const duplicate of findDuplicates(menu.tabs.map((t) => t.id))) {
    violations.push(
      v('MENU2_DUPLICATE_TAB_ID', `Duplicate tab id "${duplicate}".`, 'contract §3', 'tabs')
    );
  }

  // Kolejność prawego klastra.
  const declared = menu.rightCluster;
  const canonical = CANON_MENU2_RIGHT_CLUSTER_ORDER.filter((slot) => declared.includes(slot));
  if (declared.join(',') !== canonical.join(',')) {
    violations.push(
      v(
        'MENU2_RIGHT_CLUSTER_ORDER',
        `Right cluster is ${declared.join(' → ')}; canon is ` +
          `${CANON_MENU2_RIGHT_CLUSTER_ORDER.join(' → ')}.`,
        'contract §3 Prawa strona',
        'rightCluster'
      )
    );
  }
  const ctaCount = declared.filter((slot) => slot === 'primaryCta').length;
  if (ctaCount > CANON_MENU2_PRIMARY_CTA_MAX) {
    violations.push(
      v(
        'MENU2_MULTIPLE_PRIMARY_CTA',
        `${ctaCount} primary CTAs; canon allows ${CANON_MENU2_PRIMARY_CTA_MAX}.`,
        'contract §3 Zakazy',
        'rightCluster'
      )
    );
  }

  // Segment view modes renderuje się dopiero od dwóch widoków (§3).
  if (declared.includes('viewModes') && menu.viewModes.length < 2) {
    violations.push(
      v(
        'MENU2_VIEW_SEGMENT_WITHOUT_ALTERNATIVE',
        `View-mode segment is declared with ${menu.viewModes.length} view(s); it ` +
          'renders only when at least two exist.',
        'contract §3 Prawa strona',
        'viewModes'
      )
    );
  }

  return toResult(violations);
}

/** Waliduje aktualny stan Menu 3 (§4). */
export function validateMenu3(
  state: Menu3State,
  capabilities?: TableSurfaceCapabilities
): ValidationResult {
  const violations: ContractViolation[] = [];

  if (state.kind === 'filters') {
    for (const chip of state.chips) {
      // §4 Formuła 1: „każdy chip ma licznik, RÓWNIEŻ 0". Brak licznika to defekt,
      // ale `0` jest wartością poprawną — stąd sprawdzenie typu, nie prawdziwości.
      if (typeof chip.count !== 'number' || Number.isNaN(chip.count)) {
        violations.push(
          v(
            'MENU3_CHIP_WITHOUT_COUNT',
            `Filter chip "${chip.id}" has no numeric counter; every chip shows one, ` +
              'including zero.',
            'contract §4 Formuła 1',
            `chips[${chip.id}]`
          )
        );
      }
    }
    for (const duplicate of findDuplicates(state.chips.map((c) => c.id))) {
      violations.push(
        v(
          'MENU3_DUPLICATE_CHIP_ID',
          `Duplicate filter chip id "${duplicate}".`,
          'contract §4 Formuła 1',
          'chips'
        )
      );
    }
    if (state.rightActions.length > CANON_MENU3_RIGHT_ACTIONS_MAX) {
      violations.push(
        v(
          'MENU3_TOO_MANY_RIGHT_ACTIONS',
          `${state.rightActions.length} right-hand actions; canon shows at most ` +
            `${CANON_MENU3_RIGHT_ACTIONS_MAX}, the rest in overflow.`,
          'contract §4 Formuła 1',
          'rightActions'
        )
      );
    }
  }

  if (state.kind === 'bulk') {
    if (capabilities && capabilities.selection !== 'bulk') {
      violations.push(
        v(
          'MENU3_BULK_WITHOUT_SELECTION',
          'Bulk formula rendered although capabilities.selection is not "bulk".',
          'contract §4 Formuła 2'
        )
      );
    }
    if (state.selectedCount <= 0) {
      violations.push(
        v(
          'MENU3_BULK_EMPTY_SELECTION',
          'Bulk bar renders only when at least one row is selected.',
          'contract §4 Formuła 2',
          'selectedCount'
        )
      );
    }
    // §4 Formuła 2: „zawsze istnieje co najmniej jedna realna akcja poza Clear".
    if (state.actions.length === 0) {
      violations.push(
        v(
          'MENU3_BULK_WITHOUT_REAL_ACTION',
          'Bulk bar exposes Clear only; at least one real action is required.',
          'contract §4 Formuła 2',
          'actions'
        )
      );
    }
    for (const duplicate of findDuplicates(state.actions.map((a) => a.actionId))) {
      violations.push(
        v(
          'MENU3_DUPLICATE_BULK_ACTION',
          `Duplicate bulk actionId "${duplicate}".`,
          'contract §4 Formuła 2',
          'actions'
        )
      );
    }
    // Danger na końcu (§4 Formuła 2 — kolejność lewego klastra).
    const firstDanger = state.actions.findIndex((a) => a.danger);
    if (firstDanger >= 0 && firstDanger !== state.actions.length - 1) {
      violations.push(
        v(
          'MENU3_BULK_DANGER_NOT_LAST',
          'Danger bulk action must be last in the cluster.',
          'contract §4 Formuła 2',
          'actions'
        )
      );
    }
  }

  if (state.kind === 'openTabs') {
    for (const tab of state.tabs) {
      if (!tab.title.trim()) {
        violations.push(
          v(
            'MENU3_TAB_WITHOUT_TITLE',
            `Open tab "${tab.id}" has no real title.`,
            'contract §4 Formuła 3',
            `tabs[${tab.id}]`
          )
        );
      }
    }
  }

  return toResult(violations);
}

// ─── Deskryptor powierzchni ─────────────────────────────────────────────────

/** Waliduje deskryptor capability jednej powierzchni (§1, §5). */
export function validateTableSurfaceCapabilities(
  capabilities: TableSurfaceCapabilities
): ValidationResult {
  const violations: ContractViolation[] = [];
  const at = capabilities.id;

  if (capabilities.selection === 'none' && !capabilities.selectionNoneReason?.trim()) {
    violations.push(
      v(
        'CAPABILITY_SELECTION_NONE_UNJUSTIFIED',
        `${at}: selection "none" is legal only with a product justification.`,
        'contract §1, §10 Selection',
        'selectionNoneReason'
      )
    );
  }
  if (capabilities.selection === 'none' && capabilities.bulkActions.length > 0) {
    violations.push(
      v(
        'CAPABILITY_BULK_ACTIONS_WITHOUT_SELECTION',
        `${at}: bulk actions declared although selection is "none".`,
        'contract §1',
        'bulkActions'
      )
    );
  }
  if (capabilities.selection === 'bulk' && capabilities.bulkActions.length === 0) {
    violations.push(
      v(
        'CAPABILITY_BULK_WITHOUT_ACTIONS',
        `${at}: selection is "bulk" but no bulk action is declared; the bar would ` +
          'render Clear only.',
        'contract §4 Formuła 2',
        'bulkActions'
      )
    );
  }
  if (capabilities.delete === 'business-locked' && !capabilities.deleteLockReason?.trim()) {
    violations.push(
      v(
        'CAPABILITY_LOCK_WITHOUT_REASON',
        `${at}: delete is business-locked but no reason is recorded for audit.`,
        'contract §7 Danger, §10 Disabled',
        'deleteLockReason'
      )
    );
  }
  if (!capabilities.persistKey.trim()) {
    violations.push(
      v(
        'CAPABILITY_MISSING_PERSIST_KEY',
        `${at}: persistKey is required for column width/visibility/order persistence.`,
        'contract §5 Wymiary i mechanika',
        'persistKey'
      )
    );
  }

  // Kolumny — §5 „Kompletność informacyjna kolumn".
  const { columns } = capabilities;
  if (!columns.identifier.trim()) {
    violations.push(
      v(
        'CAPABILITY_MISSING_IDENTIFIER_COLUMN',
        `${at}: the first data column must identify the record.`,
        'contract §5 Obowiązkowa anatomia',
        'columns.identifier'
      )
    );
  }
  if (columns.required.length === 0) {
    violations.push(
      v(
        'CAPABILITY_NO_REQUIRED_COLUMNS',
        `${at}: no required domain columns declared; the list cannot support a ` +
          'decision without opening every record.',
        'contract §5 Kompletność informacyjna kolumn',
        'columns.required'
      )
    );
  }
  const allColumns = [columns.identifier, ...columns.required, ...(columns.optional ?? [])];
  for (const duplicate of findDuplicates(allColumns)) {
    violations.push(
      v(
        'CAPABILITY_DUPLICATE_COLUMN',
        `${at}: column "${duplicate}" is declared more than once.`,
        'contract §5',
        'columns'
      )
    );
  }

  return toResult(violations);
}

/**
 * Waliduje CAŁY rejestr T01–T45 (mapa powierzchnia → adapter/konfiguracja).
 *
 * Sprawdza to, czego typ `Record<TableSurfaceId, …>` nie złapie: zgodność
 * klucza z polem `id`, unikalność `persistKey` między powierzchniami
 * (współdzielony klucz oznacza, że dwie tabele nadpisują sobie ustawienia
 * kolumn) i spójność `adapter` z `requiresNewRegistry`.
 */
export function validateSurfaceRegister(
  register: Readonly<Record<string, TableSurfaceContract>>
): ValidationResult {
  const violations: ContractViolation[] = [];
  const entries = Object.entries(register);

  for (const [key, contract] of entries) {
    if (key !== contract.id) {
      violations.push(
        v(
          'REGISTER_KEY_ID_MISMATCH',
          `Register key "${key}" does not match contract id "${contract.id}".`,
          'R00 mapa T01–T45',
          key
        )
      );
    }
    const capabilityResult = validateTableSurfaceCapabilities(contract.capabilities);
    violations.push(...capabilityResult.violations);

    if (contract.capabilities.id !== contract.id) {
      violations.push(
        v(
          'REGISTER_CAPABILITY_ID_MISMATCH',
          `${contract.id}: capabilities.id is "${contract.capabilities.id}".`,
          'R00 mapa T01–T45',
          `${key}.capabilities.id`
        )
      );
    }

    // `missing-register` to jedyny adapter, który z definicji wymaga zbudowania
    // tabeli od zera (REPAIR_MASTER_PLAN Fala 2, R10–R12).
    const shouldRequireNew = contract.adapter === 'missing-register';
    if (shouldRequireNew !== contract.requiresNewRegistry) {
      violations.push(
        v(
          'REGISTER_ADAPTER_FLAG_MISMATCH',
          `${contract.id}: adapter "${contract.adapter}" implies ` +
            `requiresNewRegistry=${shouldRequireNew}.`,
          'REPAIR_MASTER_PLAN Fala 2',
          `${key}.requiresNewRegistry`
        )
      );
    }

    // Zanieczyszczony rejestr MUSI wskazać, co przenieść — inaczej R13–R16
    // dostaną ticket bez mierzalnego zakresu (AGENT_TASK_TEMPLATE: zadanie nie
    // może mieć celu typu „napraw T26").
    if (
      contract.adapter === 'contaminated-register' &&
      (contract.relocateFromList?.length ?? 0) === 0
    ) {
      violations.push(
        v(
          'REGISTER_CONTAMINATED_WITHOUT_RELOCATION',
          `${contract.id}: contaminated register declares nothing to relocate.`,
          'contract §5, REPAIR_MASTER_PLAN Fala 2',
          `${key}.relocateFromList`
        )
      );
    }
  }

  for (const duplicate of findDuplicates(entries.map(([, c]) => c.capabilities.persistKey))) {
    violations.push(
      v(
        'REGISTER_DUPLICATE_PERSIST_KEY',
        `persistKey "${duplicate}" is shared by more than one surface; column ` +
          'settings would overwrite each other.',
        'contract §5 Wymiary i mechanika',
        'persistKey'
      )
    );
  }

  return toResult(violations);
}

// ─── Tryb dev ───────────────────────────────────────────────────────────────

/**
 * Ostrzeżenie w trybie dev (REPAIR_MASTER_PLAN R03: „walidacja duplikatów
 * ID/label w testach I W TRYBIE DEV").
 *
 * Świadomie NIE rzuca: kontrakt jest wprowadzany na żywym produkcie z 322
 * otwartymi defektami, więc twardy throw wygasiłby ekrany, których R01–R04
 * jeszcze nie dotknęły. Ostrzega głośno i pozwala pracować.
 *
 * `import.meta.env.DEV` jest odczytywane defensywnie — ten moduł bywa ładowany
 * w środowisku node (skrypty audytowe), gdzie `import.meta.env` nie istnieje.
 */
export function assertContractInDev(context: string, result: ValidationResult): void {
  if (result.valid) return;
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  if (!env?.DEV) return;
  for (const violation of result.violations) {
    // eslint-disable-next-line no-console
    console.warn(
      `[table-surface-contract] ${context} · ${violation.code} · ${violation.clause}\n` +
        `  ${violation.message}${violation.path ? `\n  at ${violation.path}` : ''}`
    );
  }
}
