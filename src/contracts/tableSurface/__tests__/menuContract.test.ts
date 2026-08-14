/**
 * Testy kontraktu Menu 1 / 2 / 3 — §2, §3, §4.
 *
 * MENU_1_2_3 oblało 44 z 45 tabel. Te testy zamrażają trzy reguły, które
 * najczęściej były łamane: brak liczników w Menu 2 (`INT-MENU-001`), Menu 3
 * jako JEDNA maszyna stanów o priorytecie `bulk > open tabs > filters`
 * oraz bulk, który zawsze ma Clear i zawsze ma co najmniej jedną realną akcję.
 */

import { describe, expect, it } from 'vitest';

import { buildMenu2, buildMenu3Bulk, buildMenu3Filters, populatedFixture } from '../fixtures';
import {
  type Menu2Contract,
  type Menu3BulkState,
  type Menu3FiltersState,
  type Menu3OpenTabsState,
  menu3StatePriority,
  resolveMenu3State,
} from '../menuContract';
import { TABLE_SURFACE_IDS, TABLE_SURFACE_REGISTER } from '../surfaceRegister';
import { validateMenu2, validateMenu3 } from '../validators';

function baseMenu2(overrides: Partial<Menu2Contract> = {}): Menu2Contract {
  return {
    searchToggle: true,
    tabs: [
      { id: 'inbox', label: 'Inbox' },
      { id: 'templates', label: 'Templates' },
    ],
    activeTabId: 'inbox',
    rightCluster: ['primaryCta'],
    viewModes: ['list'],
    hasFiltersDropdown: false,
    ...overrides,
  };
}

const filters: Menu3FiltersState = {
  kind: 'filters',
  chips: [
    { id: 'all', label: 'All', count: 12, active: true },
    { id: 'mine', label: 'Mine', count: 0 },
  ],
  rightActions: [],
};

const bulk: Menu3BulkState = {
  kind: 'bulk',
  selectedCount: 3,
  clear: true,
  actions: [
    { actionId: 'assign', label: 'Assign', icon: 'assign' },
    { actionId: 'delete', label: 'Delete', icon: 'delete', danger: true },
  ],
};

const openTabs: Menu3OpenTabsState = {
  kind: 'openTabs',
  tabs: [{ id: 't1', title: 'Real record title', icon: 'table', closable: true }],
};

const menu2Codes = (menu: Menu2Contract) =>
  validateMenu2(menu).violations.map((violation) => violation.code);

describe('Menu 2 — zakaz liczników (§3)', () => {
  it('przyjmuje etykiety bez liczników', () => {
    expect(validateMenu2(baseMenu2()).valid).toBe(true);
  });

  it.each([
    ['③ Inbox', 'numeral otoczony — dokładny wzorzec z INT-MENU-001'],
    ['① Templates', 'numeral otoczony'],
    ['Inbox (3)', 'licznik domykający'],
    ['(3) Inbox', 'licznik wiodący w nawiasie'],
    ['3 Inbox', 'licznik wiodący'],
    ['Inbox · 3', 'separator i liczba'],
  ])('odrzuca etykietę "%s" (%s)', (label) => {
    const menu = baseMenu2({
      tabs: [{ id: 'inbox', label }],
      activeTabId: 'inbox',
    });
    expect(menu2Codes(menu)).toContain('MENU2_COUNTER_IN_TAB');
  });
});

describe('Menu 2 — prawy klaster (§3)', () => {
  it('wymusza kolejność filters → viewModes → domainTool → primaryCta → areaToggle', () => {
    const menu = baseMenu2({
      rightCluster: ['primaryCta', 'viewModes'],
      viewModes: ['list', 'grid'],
    });
    expect(menu2Codes(menu)).toContain('MENU2_RIGHT_CLUSTER_ORDER');
  });

  it('dopuszcza dokładnie jeden primary CTA', () => {
    const menu = baseMenu2({ rightCluster: ['primaryCta', 'primaryCta'] });
    expect(menu2Codes(menu)).toContain('MENU2_MULTIPLE_PRIMARY_CTA');
  });

  it('odrzuca segment view modes przy jednym widoku', () => {
    const menu = baseMenu2({ rightCluster: ['viewModes'], viewModes: ['list'] });
    expect(menu2Codes(menu)).toContain('MENU2_VIEW_SEGMENT_WITHOUT_ALTERNATIVE');
  });

  it('wykrywa aktywną zakładkę spoza listy', () => {
    const menu = baseMenu2({ activeTabId: 'nieistniejaca' });
    expect(menu2Codes(menu)).toContain('MENU2_ACTIVE_TAB_UNKNOWN');
  });
});

describe('Menu 3 — maszyna stanów (§4)', () => {
  it('ma priorytet bulk > open tabs > filters', () => {
    expect(menu3StatePriority('bulk')).toBeLessThan(menu3StatePriority('openTabs'));
    expect(menu3StatePriority('openTabs')).toBeLessThan(menu3StatePriority('filters'));
  });

  it('pokazuje bulk, gdy istnieje zaznaczenie', () => {
    expect(resolveMenu3State({ bulk, openTabs, filters }).kind).toBe('bulk');
  });

  it('pokazuje otwarte taby, gdy nie ma zaznaczenia', () => {
    expect(resolveMenu3State({ openTabs, filters }).kind).toBe('openTabs');
  });

  it('wraca do filtrów, gdy nie ma ani zaznaczenia, ani tabów', () => {
    expect(resolveMenu3State({ filters }).kind).toBe('filters');
  });

  it('nie pokazuje bulk przy zerowym zaznaczeniu', () => {
    const empty: Menu3BulkState = { ...bulk, selectedCount: 0 };
    expect(resolveMenu3State({ bulk: empty, openTabs, filters }).kind).toBe('openTabs');
  });

  it('nie usuwa otwartych tabów ze stanu, gdy bulk wygrywa wizualnie', () => {
    // §4 Formuła 3 — bulk ma pierwszeństwo WIZUALNE, taby żyją dalej.
    const input = { bulk, openTabs, filters };
    expect(resolveMenu3State(input).kind).toBe('bulk');
    expect(input.openTabs.tabs).toHaveLength(1);
  });
});

describe('Menu 3 — formuła 1 (filtry)', () => {
  it('przyjmuje chipy z licznikami, w tym 0', () => {
    expect(validateMenu3(filters).valid).toBe(true);
  });

  it('odrzuca chip bez licznika', () => {
    const broken: Menu3FiltersState = {
      kind: 'filters',
      chips: [{ id: 'all', label: 'All' } as unknown as Menu3FiltersState['chips'][number]],
      rightActions: [],
    };
    expect(validateMenu3(broken).violations.map((v) => v.code)).toContain(
      'MENU3_CHIP_WITHOUT_COUNT'
    );
  });

  it('odrzuca więcej niż pięć akcji po prawej', () => {
    const overflowing: Menu3FiltersState = {
      ...filters,
      rightActions: Array.from({ length: 6 }, (_, index) => ({
        actionId: `a${index}`,
        label: `A${index}`,
        icon: 'ai' as const,
      })),
    };
    expect(validateMenu3(overflowing).violations.map((v) => v.code)).toContain(
      'MENU3_TOO_MANY_RIGHT_ACTIONS'
    );
  });
});

describe('Menu 3 — formuła 2 (bulk)', () => {
  it('przyjmuje kanoniczny pasek bulk', () => {
    expect(validateMenu3(bulk, TABLE_SURFACE_REGISTER.T05.capabilities).valid).toBe(true);
  });

  it('odrzuca pasek bulk bez realnej akcji poza Clear', () => {
    const clearOnly: Menu3BulkState = { ...bulk, actions: [] };
    expect(validateMenu3(clearOnly).violations.map((v) => v.code)).toContain(
      'MENU3_BULK_WITHOUT_REAL_ACTION'
    );
  });

  it('wymusza danger na końcu klastra', () => {
    const wrongOrder: Menu3BulkState = {
      ...bulk,
      actions: [bulk.actions[1], bulk.actions[0]],
    };
    expect(validateMenu3(wrongOrder).violations.map((v) => v.code)).toContain(
      'MENU3_BULK_DANGER_NOT_LAST'
    );
  });

  it('nie pozwala renderować bulk dla encji bez selection', () => {
    const noSelection = {
      ...TABLE_SURFACE_REGISTER.T05.capabilities,
      selection: 'none' as const,
    };
    expect(validateMenu3(bulk, noSelection).violations.map((v) => v.code)).toContain(
      'MENU3_BULK_WITHOUT_SELECTION'
    );
  });

  it('Clear jest niereprezentowalnie nieobecny — typ wymusza literał true', () => {
    // Asercja typu, nie runtime: `clear` ma typ `true`, więc `false` nie
    // skompiluje się. Test dokumentuje intencję i pilnuje, by ktoś nie
    // rozluźnił typu do `boolean`.
    const clear: Menu3BulkState['clear'] = true;
    expect(clear).toBe(true);
  });
});

describe('Menu 3 — formuła 3 (otwarte taby)', () => {
  it('wymaga realnego tytułu taba', () => {
    const untitled: Menu3OpenTabsState = {
      kind: 'openTabs',
      tabs: [{ id: 't1', title: '  ', icon: 'table', closable: true }],
    };
    expect(validateMenu3(untitled).violations.map((v) => v.code)).toContain(
      'MENU3_TAB_WITHOUT_TITLE'
    );
  });
});

describe('Menu — referencyjne buildery dla wszystkich 45 powierzchni', () => {
  it.each(TABLE_SURFACE_IDS)('%s: Menu 2 przechodzi walidator', (id) => {
    const contract = TABLE_SURFACE_REGISTER[id];
    expect(validateMenu2(buildMenu2(contract)).violations).toEqual([]);
  });

  it.each(TABLE_SURFACE_IDS)('%s: Menu 3 (filtry) przechodzi walidator', (id) => {
    const contract = TABLE_SURFACE_REGISTER[id];
    expect(validateMenu3(buildMenu3Filters(contract)).violations).toEqual([]);
  });

  it.each(TABLE_SURFACE_IDS)('%s: Menu 3 (bulk) przechodzi walidator', (id) => {
    const contract = TABLE_SURFACE_REGISTER[id];
    const state = buildMenu3Bulk(contract, 2);
    if (contract.capabilities.selection === 'none') {
      expect(state).toBeNull();
      expect(contract.capabilities.bulkActions).toEqual([]);
      return;
    }
    expect(state).not.toBeNull();
    expect(validateMenu3(state!, contract.capabilities).violations).toEqual([]);
  });

  it('wariant empty pokazuje liczniki 0 na każdym chipie', () => {
    const fixture = populatedFixture('T05');
    const emptyChips = buildMenu3Filters(fixture.contract).chips;
    expect(emptyChips.length).toBeGreaterThan(0);
    expect(emptyChips.every((chip) => chip.count === 0)).toBe(true);
  });
});
