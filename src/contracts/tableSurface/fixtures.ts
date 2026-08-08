/**
 * FIXTURES empty i populated + referencyjne buildery kontraktu.
 *
 * Dwa powody, dla których fixtures są w tym samym pakiecie co typy:
 *
 * 1. Walidatory `PreviewSchema<T>` operują na SELEKTORACH — limit słów prozy
 *    albo liczba akcji są sprawdzalne dopiero na danych. Bez fixture kontrakt
 *    preview byłby niewykonalny testowo.
 * 2. AUDIT_CHECKPOINT_MODEL §Reguła agregacji: „Pusty stan może być oceniony
 *    wizualnie, lecz NIE DOWODZI anatomii tabeli wierszowej, preview, kebaba
 *    ani PPM." Odbiór wymaga więc OBU wariantów — a REPAIR_MASTER_PLAN Fala 2
 *    żąda wariantu empty i populated dla każdego przebudowywanego rejestru.
 *
 * Buildery poniżej (`buildRowActionMenu`, `buildPreviewSchema`, `buildMenu2`,
 * `buildMenu3*`) są REFERENCYJNĄ implementacją kontraktu: wyprowadzają kształt
 * wyłącznie z deskryptora capability. R01–R04 mają się do nich dostroić — to
 * one definiują, co znaczy „zgodne z kontraktem", a testy dowodzą, że wynik
 * builderów przechodzi walidatory dla wszystkich 45 powierzchni.
 *
 * Wszystko jest DETERMINISTYCZNE — żadnego `Date.now()` ani losowości, żeby
 * fixture dawało ten sam wynik w każdym przebiegu i nadawało się na dowód.
 *
 * @module contracts/tableSurface/fixtures
 */

import type {
  Menu2Contract,
  Menu2RightClusterSlot,
  Menu3BulkState,
  Menu3FiltersState,
  Menu3OpenTabsState,
} from './menuContract';
import type { PreviewSchema } from './previewSchema';
import { MANAGE_ACTION_ID, type RowActionMenuModel, type RowActionModel } from './rowActionModel';
import { TABLE_SURFACE_REGISTER } from './surfaceRegister';
import type { TableSurfaceContract, TableSurfaceId } from './types';

// ─── Rekord fixture ─────────────────────────────────────────────────────────

/**
 * Generyczny rekord fixture. Pola pokrywają wszystko, czego dotykają buildery
 * preview i menu — dzięki temu jeden kształt obsługuje 45 powierzchni bez
 * 45 osobnych typów testowych.
 */
export interface FixtureRecord {
  id: string;
  title: string;
  status: string;
  /** `null` oznacza komórkę pustą — renderowaną jako `—` (§5). */
  dueDate: string | null;
  owner: string;
  /** Proza bloku Details; pusta dla wariantów bez treści. */
  summary: string;
  relations: Array<{ id: string; label: string; type: string }>;
  properties: Array<{ label: string; value: string }>;
}

/**
 * Proza Details o długości mieszczącej się w kanonie 80–140 słów (§6 Details).
 * Zbudowana wg wymaganej kolejności: czym jest obiekt → najważniejszy stan →
 * konsekwencja / rekomendowany następny krok.
 */
function fixtureProse(entity: string, surface: string): string {
  const sentences = [
    `This record is a ${entity} tracked on the ${surface} register and owned by a named accountable person.`,
    'It carries the status, the owner and the date shown in the list, so the row and this panel never disagree about the same facts.',
    'The current state is stable: no blocking dependency is recorded against it and every declared relation resolves to an existing object.',
    'Progress has been reviewed at least once since the record was created, and the review did not change its classification.',
    'The consequence for the reader is that no immediate intervention is required on this item today.',
    'The recommended next step is to confirm the owner still agrees with the target date, then move the record forward through its normal transition.',
  ];
  return sentences.join(' ');
}

/** Trzy deterministyczne wiersze dla wariantu populated. */
function fixtureRows(contract: TableSurfaceContract): FixtureRecord[] {
  const { entity } = contract.capabilities;
  const prose = fixtureProse(entity, contract.surface);
  return [
    {
      id: `${contract.id}-r1`,
      title: `${contract.surface} record one`,
      status: 'active',
      dueDate: '2026-09-01',
      owner: 'Owner One',
      summary: prose,
      relations: [{ id: 'rel-1', label: 'Related initiative', type: 'initiative' }],
      properties: [
        { label: 'Status', value: 'Active' },
        { label: 'Owner', value: 'Owner One' },
        { label: 'Updated', value: '2026-08-05' },
      ],
    },
    {
      id: `${contract.id}-r2`,
      title: `${contract.surface} record two`,
      status: 'blocked',
      // Pusta komórka — renderer musi pokazać `—`, nie pustkę (§5).
      dueDate: null,
      owner: 'Owner Two',
      summary: prose,
      relations: [],
      properties: [
        { label: 'Status', value: 'Blocked' },
        { label: 'Owner', value: 'Owner Two' },
        { label: 'Updated', value: '2026-08-04' },
      ],
    },
    {
      id: `${contract.id}-r3`,
      title: `${contract.surface} record three`,
      status: 'done',
      dueDate: '2026-07-20',
      owner: 'Owner Three',
      summary: prose,
      relations: [
        { id: 'rel-2', label: 'Source document', type: 'document' },
        { id: 'rel-3', label: 'Parent process', type: 'process' },
      ],
      properties: [
        { label: 'Status', value: 'Done' },
        { label: 'Owner', value: 'Owner Three' },
        { label: 'Updated', value: '2026-07-20' },
      ],
    },
  ];
}

// ─── Referencyjne buildery ──────────────────────────────────────────────────

/**
 * Buduje kanoniczne menu wiersza WYŁĄCZNIE z deskryptora capability.
 *
 * Strefa `manage` powstaje w kolejności Open preview → Edit → Archive → Delay,
 * a pozycje warunkowe pojawiają się wtedy i tylko wtedy, gdy capability je
 * deklaruje (§7 Manage). `context` bierze się z `contextTransitions`, `danger`
 * z `capabilities.delete`.
 */
export function buildRowActionMenu(
  contract: TableSurfaceContract,
  record: FixtureRecord
): RowActionMenuModel {
  const caps = contract.capabilities;
  const actions: RowActionModel[] = [];

  // context — realne przejścia właściwe encji.
  for (const target of caps.contextTransitions) {
    actions.push({
      actionId: `convert-to-${target}`,
      label: `Convert to ${target}`,
      icon: 'relation',
      zone: 'context',
    });
  }

  // manage — stała kolejność w ramach capabilities.
  actions.push({
    actionId: MANAGE_ACTION_ID.openPreview,
    label: 'Open preview',
    icon: 'openPreview',
    zone: 'manage',
  });
  if (caps.edit !== 'not-applicable') {
    const permissionBlocked = caps.edit === 'permission-dependent';
    actions.push({
      actionId: MANAGE_ACTION_ID.edit,
      label: 'Edit',
      icon: 'edit',
      zone: 'manage',
      requiresCapability: 'edit',
      // Wyciszone bez dopisku w etykiecie; powód żyje w `disabledDetail` (§7, §10).
      ...(permissionBlocked
        ? {
            disabled: true,
            disabledReason: 'permission' as const,
            disabledDetail: 'Editing requires an elevated role on this entity.',
          }
        : {}),
    });
  }
  if (caps.archive === 'supported') {
    actions.push({
      actionId: MANAGE_ACTION_ID.archive,
      label: 'Archive',
      icon: 'archive',
      zone: 'manage',
      requiresCapability: 'archive',
    });
  }
  if (caps.dueDate) {
    actions.push({
      actionId: MANAGE_ACTION_ID.delay,
      label: 'Delay',
      icon: 'delay',
      zone: 'manage',
      requiresCapability: 'dueDate',
      submenu: [
        { actionId: 'delay-1d', label: '+1 day' },
        { actionId: 'delay-3d', label: '+3 days' },
        { actionId: 'delay-7d', label: '+7 days' },
      ],
    });
  }

  // danger — zawsze ostatnie.
  const locked = caps.delete === 'business-locked';
  actions.push({
    actionId: 'delete',
    label: 'Delete',
    icon: 'delete',
    zone: 'danger',
    confirmation: !locked,
    ...(locked
      ? {
          disabled: true,
          disabledReason: 'business-rule' as const,
          disabledDetail: caps.deleteLockReason,
        }
      : {}),
  });

  return { surfaceId: contract.id, recordId: record.id, actions };
}

/**
 * Buduje kanoniczny `PreviewSchema` dla powierzchni.
 *
 * Blok AI jest pomijany, gdy encja nie deklaruje realnych akcji AI — tu
 * kryterium jest obecność przejść kontekstowych, bo to one dają AI realne cele
 * („Draft <target>"). Powierzchnia bez przejść nie dostaje pustej atrapy (§10).
 */
export function buildPreviewSchema(contract: TableSurfaceContract): PreviewSchema<FixtureRecord> {
  const caps = contract.capabilities;
  const hasAi = caps.contextTransitions.length > 0;

  return {
    surfaceId: contract.id,
    entity: caps.entity,
    header: {
      title: (record) => record.title,
      pin: true,
      open: true,
      close: true,
    },
    meta: {
      pills: (record) => [
        { id: 'status', label: record.status, tone: 'neutral' },
        { id: 'owner', label: record.owner, tone: 'neutral' },
      ],
      trailing: (record) => record.dueDate,
      recommendation: (record) =>
        record.status === 'blocked'
          ? 'Blocked: confirm the dependency owner before the next review.'
          : null,
    },
    details: {
      mode: 'prose',
      prose: (record) => record.summary,
      showWordCount: true,
      contentActions: [
        { actionId: 'copy', label: 'Copy', icon: 'copy' },
        { actionId: 'export', label: 'Export', icon: 'export' },
        { actionId: 'download', label: 'Download', icon: 'download' },
      ],
    },
    ...(hasAi
      ? {
          ai: {
            actions: () =>
              caps.contextTransitions.slice(0, 3).map((target) => ({
                actionId: `ai-draft-${target}`,
                label: `Draft ${target}`,
                icon: 'ai' as const,
                variant: 'neutral' as const,
              })),
          },
        }
      : {}),
    relations: {
      items: (record) => record.relations,
      emptyLabel: 'No relations',
    },
    actions: {
      // Rząd 1: rozstrzygnięcia. Rząd 2: zarządcze. Pojedyncza akcja zajmuje
      // pierwszą kolumnę — bez atrapy w drugiej (§6 Actions).
      rows: () => {
        const first = [
          {
            actionId: 'complete',
            label: 'Complete',
            icon: 'complete' as const,
            variant: 'positive' as const,
          },
          {
            actionId: 'assign',
            label: 'Assign',
            icon: 'assign' as const,
            variant: 'neutral' as const,
          },
        ];
        const second =
          caps.archive === 'supported'
            ? [
                {
                  actionId: 'archive',
                  label: 'Archive',
                  icon: 'archive' as const,
                  variant: 'neutral' as const,
                },
              ]
            : [];
        return second.length > 0 ? [first, second] : [first];
      },
    },
  };
}

/** Buduje kanoniczny kontrakt Menu 2 dla powierzchni. */
export function buildMenu2(contract: TableSurfaceContract): Menu2Contract {
  const caps = contract.capabilities;
  const rightCluster: Menu2RightClusterSlot[] = [];
  // Kolejność od LEWEJ: filters → viewModes → domainTool → primaryCta → areaToggle.
  if (caps.viewModes.length >= 2) rightCluster.push('viewModes');
  rightCluster.push('primaryCta');

  return {
    searchToggle: true,
    // Etykiety BEZ liczników — te należą wyłącznie do chipów Menu 3 (§3).
    tabs: [{ id: contract.id, label: contract.surface }],
    activeTabId: contract.id,
    rightCluster,
    viewModes: caps.viewModes,
    hasFiltersDropdown: false,
  };
}

/**
 * Buduje formułę 1 Menu 3. Każdy preset dostaje licznik — także `0`, co jest
 * dokładnie tym, czego wymaga §4 Formuła 1 i czego brakowało w wariancie empty.
 */
export function buildMenu3Filters(
  contract: TableSurfaceContract,
  counts: Record<string, number> = {}
): Menu3FiltersState {
  return {
    kind: 'filters',
    chips: contract.capabilities.menu3Presets.map((preset, index) => ({
      id: preset,
      label: preset,
      count: counts[preset] ?? 0,
      active: index === 0,
    })),
    rightActions: [],
  };
}

/** Buduje formułę 2 Menu 3 (bulk). Zwraca `null`, gdy encja nie ma selection. */
export function buildMenu3Bulk(
  contract: TableSurfaceContract,
  selectedCount: number
): Menu3BulkState | null {
  const caps = contract.capabilities;
  if (caps.selection !== 'bulk') return null;

  const dangerIds = new Set(['delete', 'reject', 'move-to-trash']);
  const ordered = [
    ...caps.bulkActions.filter((id) => !dangerIds.has(id)),
    ...caps.bulkActions.filter((id) => dangerIds.has(id)),
  ];

  return {
    kind: 'bulk',
    selectedCount,
    selectAll: true,
    clear: true,
    actions: ordered.map((actionId) => ({
      actionId,
      label: actionId,
      icon: dangerIds.has(actionId) ? ('delete' as const) : ('relation' as const),
      danger: dangerIds.has(actionId),
    })),
  };
}

/** Buduje formułę 3 Menu 3 (otwarte taby). */
export function buildMenu3OpenTabs(
  contract: TableSurfaceContract,
  records: FixtureRecord[]
): Menu3OpenTabsState {
  return {
    kind: 'openTabs',
    tabs: records.map((record) => ({
      id: record.id,
      title: record.title,
      icon: 'table',
      closable: true,
    })),
  };
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** Kompletny fixture jednej powierzchni w jednym wariancie danych. */
export interface TableSurfaceFixture {
  variant: 'empty' | 'populated';
  contract: TableSurfaceContract;
  rows: FixtureRecord[];
  /**
   * Kolumny, które tabela renderuje. Obecne TAKŻE w wariancie empty —
   * REPAIR_MASTER_PLAN §6: „Brak danych nie usuwa struktury tabeli ani
   * powierzchni odbiorowych", R04: „empty state zachowuje nagłówek i geometrię".
   */
  columns: string[];
  menu2: Menu2Contract;
  menu3: Menu3FiltersState;
  previewSchema: PreviewSchema<FixtureRecord>;
  /** `null` w wariancie empty — nie ma rekordu, dla którego menu by powstało. */
  rowMenu: RowActionMenuModel | null;
}

/** Kolumny renderowane przez rejestr: identyfikator → required → kebab. */
export function fixtureColumns(contract: TableSurfaceContract): string[] {
  const { columns } = contract.capabilities;
  return [columns.identifier, ...columns.required, 'actions'];
}

/**
 * Wariant EMPTY: zero wierszy, ale pełna struktura.
 *
 * Nagłówek, komplet kolumn, Menu 2 i Menu 3 z licznikami `0` pozostają — to
 * jest test na regułę „brak danych nie usuwa struktury tabeli".
 */
export function emptyFixture(id: TableSurfaceId): TableSurfaceFixture {
  const contract = TABLE_SURFACE_REGISTER[id];
  return {
    variant: 'empty',
    contract,
    rows: [],
    columns: fixtureColumns(contract),
    menu2: buildMenu2(contract),
    menu3: buildMenu3Filters(contract),
    previewSchema: buildPreviewSchema(contract),
    rowMenu: null,
  };
}

/** Wariant POPULATED: trzy deterministyczne wiersze i menu pierwszego z nich. */
export function populatedFixture(id: TableSurfaceId): TableSurfaceFixture {
  const contract = TABLE_SURFACE_REGISTER[id];
  const rows = fixtureRows(contract);
  const counts = Object.fromEntries(
    contract.capabilities.menu3Presets.map((preset, index) => [
      preset,
      index === 0 ? rows.length : 0,
    ])
  );
  return {
    variant: 'populated',
    contract,
    rows,
    columns: fixtureColumns(contract),
    menu2: buildMenu2(contract),
    menu3: buildMenu3Filters(contract, counts),
    previewSchema: buildPreviewSchema(contract),
    rowMenu: buildRowActionMenu(contract, rows[0]),
  };
}

/**
 * Rekord-sonda dla wariantu empty przy walidacji `PreviewSchema`.
 *
 * Walidator preview potrzebuje rekordu, a wariant empty żadnego nie ma. Ten
 * obiekt reprezentuje „preview otwarte bez treści": puste `summary` (0 słów,
 * co walidator traktuje jako empty state, nie naruszenie limitu 80 słów),
 * zero relacji — czyli ścieżka kanonicznego `No relations`.
 */
export const EMPTY_PREVIEW_PROBE: FixtureRecord = {
  id: 'empty-probe',
  title: 'Untitled',
  status: 'unknown',
  dueDate: null,
  owner: '—',
  summary: '',
  relations: [],
  properties: [],
};
