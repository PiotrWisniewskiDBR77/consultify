/**
 * Testy kontraktu `RowActionModel` — §7 (Kebab) i §8 (PPM).
 *
 * Testują SAM KONTRAKT, nie ekran: budują modele, przepuszczają przez walidator
 * i sprawdzają, że kanoniczne przechodzą, a każde znane naruszenie z audytu
 * daje konkretny, stabilny kod błędu. Zero renderu, zero zmian w UI.
 */

import { describe, expect, it } from 'vitest';

import { buildRowActionMenu, populatedFixture } from '../fixtures';
import {
  groupRowActionsByZone,
  manageActionOrderIndex,
  type RowActionMenuModel,
  rowActionMenusAreIdentical,
  type RowActionModel,
  rowActionSeparatorCount,
} from '../rowActionModel';
import { TABLE_SURFACE_IDS, TABLE_SURFACE_REGISTER } from '../surfaceRegister';
import { validateRowActionModel } from '../validators';

/** Minimalny kanoniczny model — punkt wyjścia dla mutacji w testach. */
function baseMenu(overrides: Partial<RowActionMenuModel> = {}): RowActionMenuModel {
  const actions: RowActionModel[] = [
    { actionId: 'open-preview', label: 'Open preview', icon: 'openPreview', zone: 'manage' },
    { actionId: 'edit', label: 'Edit', icon: 'edit', zone: 'manage' },
    { actionId: 'archive', label: 'Archive', icon: 'archive', zone: 'manage' },
    { actionId: 'delete', label: 'Delete', icon: 'delete', zone: 'danger', confirmation: true },
  ];
  return { surfaceId: 'T05', recordId: 'r1', actions, ...overrides };
}

const codes = (model: RowActionMenuModel) =>
  validateRowActionModel(model).violations.map((violation) => violation.code);

describe('RowActionModel — kanoniczny kształt', () => {
  it('przyjmuje model zgodny z kanonem', () => {
    expect(validateRowActionModel(baseMenu()).valid).toBe(true);
  });

  it('renderuje wyłącznie niepuste strefy w kolejności context → manage → danger', () => {
    const model = baseMenu({
      actions: [
        {
          actionId: 'convert-to-task',
          label: 'Convert to task',
          icon: 'relation',
          zone: 'context',
        },
        ...baseMenu().actions,
      ],
    });
    expect(groupRowActionsByZone(model).map((group) => group.zone)).toEqual([
      'context',
      'manage',
      'danger',
    ]);
  });

  it('pomija pustą strefę razem z jej separatorem', () => {
    // Bez strefy context: dwie strefy, jeden separator (§7 — „legalny brak
    // strefy context daje 2 strefy i 1 separator").
    expect(rowActionSeparatorCount(baseMenu())).toBe(1);
  });

  it('nigdy nie przekracza dwóch separatorów', () => {
    const model = baseMenu({
      actions: [
        {
          actionId: 'convert-to-task',
          label: 'Convert to task',
          icon: 'relation',
          zone: 'context',
        },
        ...baseMenu().actions,
      ],
    });
    expect(rowActionSeparatorCount(model)).toBeLessThanOrEqual(2);
  });
});

describe('RowActionModel — duplikaty', () => {
  it('wykrywa zduplikowany actionId', () => {
    const model = baseMenu();
    model.actions.push({
      actionId: 'edit',
      label: 'Edit record',
      icon: 'edit',
      zone: 'manage',
    });
    expect(codes(model)).toContain('ROW_ACTION_DUPLICATE_ID');
  });

  it('wykrywa zduplikowaną etykietę — wzorzec View/Open/Open preview', () => {
    const model = baseMenu();
    model.actions.splice(1, 0, {
      actionId: 'view',
      label: 'Open preview',
      icon: 'openPreview',
      zone: 'manage',
    });
    expect(codes(model)).toContain('ROW_ACTION_DUPLICATE_LABEL');
  });
});

describe('RowActionModel — atrapy i disabled', () => {
  it('odrzuca etykietę "Coming soon"', () => {
    const model = baseMenu();
    model.actions.splice(3, 0, {
      actionId: 'export',
      label: 'Export (coming soon)',
      icon: 'export',
      zone: 'manage',
      disabled: true,
      disabledReason: 'state',
    });
    expect(codes(model)).toContain('ROW_ACTION_PLACEHOLDER_LABEL');
  });

  it('odrzuca etykietę "Wkrótce"', () => {
    const model = baseMenu();
    model.actions.splice(3, 0, {
      actionId: 'export',
      label: 'Eksport — wkrótce',
      icon: 'export',
      zone: 'manage',
      disabled: true,
      disabledReason: 'state',
    });
    expect(codes(model)).toContain('ROW_ACTION_PLACEHOLDER_LABEL');
  });

  it('wymaga powodu dla pozycji wyłączonej', () => {
    const model = baseMenu();
    model.actions[1].disabled = true;
    expect(codes(model)).toContain('ROW_ACTION_DISABLED_WITHOUT_REASON');
  });

  it('nie pozwala doklejać powodu do etykiety', () => {
    const model = baseMenu();
    model.actions[1] = {
      ...model.actions[1],
      label: 'Edit — AI-generated, read-only',
      disabled: true,
      disabledReason: 'business-rule',
      disabledDetail: 'AI-generated, read-only',
    };
    expect(codes(model)).toContain('ROW_ACTION_REASON_LEAKED_TO_LABEL');
  });
});

describe('RowActionModel — strefa danger', () => {
  it('wymusza Delete jako ostatnią pozycję', () => {
    const model = baseMenu();
    const [deleteAction] = model.actions.splice(3, 1);
    model.actions.unshift(deleteAction);
    expect(codes(model)).toContain('ROW_ACTION_DANGER_NOT_LAST');
  });

  it('wymaga confirmation dla akcji destrukcyjnej', () => {
    const model = baseMenu();
    model.actions[3].confirmation = false;
    expect(codes(model)).toContain('ROW_ACTION_DANGER_WITHOUT_CONFIRMATION');
  });

  it('nie pozwala umieścić Delete poza strefą danger', () => {
    const model = baseMenu();
    model.actions[3].zone = 'manage';
    expect(codes(model)).toContain('ROW_ACTION_DANGER_WRONG_ZONE');
  });
});

describe('RowActionModel — kolejność strefy manage', () => {
  it('zna kanoniczną kolejność Open preview → Edit → Archive → Delay', () => {
    expect(manageActionOrderIndex('open-preview')).toBe(0);
    expect(manageActionOrderIndex('edit')).toBe(1);
    expect(manageActionOrderIndex('archive')).toBe(2);
    expect(manageActionOrderIndex('delay')).toBe(3);
  });

  it('wykrywa przestawioną kolejność', () => {
    const model = baseMenu();
    [model.actions[1], model.actions[2]] = [model.actions[2], model.actions[1]];
    expect(codes(model)).toContain('ROW_ACTION_MANAGE_ORDER');
  });
});

describe('RowActionModel — zgodność z deskryptorem capability', () => {
  const capabilities = TABLE_SURFACE_REGISTER.T05.capabilities;

  it('wymaga pozycji zadeklarowanych przez capabilities', () => {
    // T05 ma dueDate: true, więc `Delay` jest obowiązkowe.
    const result = validateRowActionModel(baseMenu(), capabilities);
    expect(result.violations.map((violation) => violation.code)).toContain(
      'ROW_ACTION_MISSING_REQUIRED_CAPABILITY'
    );
  });

  it('odrzuca pozycję dla capability not-applicable', () => {
    // T01 Ideas: archive = not-applicable → pozycja Archive jest atrapą.
    const ideasCaps = TABLE_SURFACE_REGISTER.T01.capabilities;
    const result = validateRowActionModel(baseMenu(), ideasCaps);
    expect(result.violations.map((violation) => violation.code)).toContain(
      'ROW_ACTION_UNDECLARED_CAPABILITY'
    );
  });

  it('wymaga disabled dla delete business-locked', () => {
    // T07 Client Vault: delete = business-locked.
    const vaultCaps = TABLE_SURFACE_REGISTER.T07.capabilities;
    const model = baseMenu();
    model.actions[3].disabled = false;
    const result = validateRowActionModel(model, vaultCaps);
    expect(result.violations.map((violation) => violation.code)).toContain(
      'ROW_ACTION_BUSINESS_LOCK_NOT_DISABLED'
    );
  });
});

describe('RowActionModel — parity kebab ↔ PPM (§8)', () => {
  it('uznaje ten sam model za identyczny w obu triggerach', () => {
    const fixture = populatedFixture('T05');
    const kebab = buildRowActionMenu(fixture.contract, fixture.rows[0]);
    const contextMenu = buildRowActionMenu(fixture.contract, fixture.rows[0]);
    expect(rowActionMenusAreIdentical(kebab, contextMenu)).toBe(true);
  });

  it('wykrywa rozjazd kolejności między kebabem a PPM', () => {
    const fixture = populatedFixture('T05');
    const kebab = buildRowActionMenu(fixture.contract, fixture.rows[0]);
    const contextMenu = buildRowActionMenu(fixture.contract, fixture.rows[0]);
    const [first, second] = [contextMenu.actions[0], contextMenu.actions[1]];
    contextMenu.actions[0] = second;
    contextMenu.actions[1] = first;
    expect(rowActionMenusAreIdentical(kebab, contextMenu)).toBe(false);
  });

  it('wykrywa akcję istniejącą wyłącznie w PPM', () => {
    const fixture = populatedFixture('T05');
    const kebab = buildRowActionMenu(fixture.contract, fixture.rows[0]);
    const contextMenu = buildRowActionMenu(fixture.contract, fixture.rows[0]);
    contextMenu.actions.splice(1, 0, {
      actionId: 'ppm-only',
      label: 'Only on right click',
      icon: 'edit',
      zone: 'manage',
    });
    expect(rowActionMenusAreIdentical(kebab, contextMenu)).toBe(false);
  });
});

describe('RowActionModel — referencyjny builder dla wszystkich 45 powierzchni', () => {
  it.each(TABLE_SURFACE_IDS)(
    '%s: kanoniczne menu zbudowane z capability przechodzi walidator',
    (id) => {
      const fixture = populatedFixture(id);
      const model = buildRowActionMenu(fixture.contract, fixture.rows[0]);
      const result = validateRowActionModel(model, fixture.contract.capabilities);
      expect(result.violations).toEqual([]);
    }
  );
});
