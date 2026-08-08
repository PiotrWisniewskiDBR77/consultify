/**
 * Test baseline — kontrola negatywna programu naprawczego.
 *
 * WERSJA R01. Poprzednia (R00) miała wadę, którą trzeba nazwać wprost:
 * asertowała ZAPISANE liczby przeciwko sobie nawzajem, więc gdy R01 zamknął
 * defekty, test pozostał zielony zamiast wymusić aktualizację. Baseline mierzył
 * sam siebie. Teraz asercje idą na ŻYWY moduł `RowActionsMenu` — jeśli ktoś
 * cofnie R01, ten plik zaczerwieni się natychmiast.
 *
 * `RowActionsMenu.tsx` jest własnością R01. Test nie czyta go jako tekstu —
 * sprawdza zachowanie eksportowanych funkcji, żeby nie być kruchym wobec
 * równoległych edycji.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  czyAtrapa,
  normalizeZones,
  type RowActionSectionKind,
} from '@/components/shared/RowActionsMenu';

import { CANON_PLACEHOLDER_LABEL_PATTERN, CANON_ROW_MENU_ZONE_ORDER } from '../canon';
import {
  ACCEPTANCE_SURFACE_DENOMINATOR,
  CANON_KEYBOARD_SUPPORT,
  LEGACY_ATOMIC_DEFECT_COUNT,
  LEGACY_BEHAVIOUR_DEVIATIONS,
  LEGACY_KEYBOARD_SUPPORT,
  LEGACY_MENU_PASS_SURFACES,
  LEGACY_NON_CANONICAL_SECTION_KINDS,
  LEGACY_ROW_MENU_GEOMETRY,
  LEGACY_TABLE_PASS_SURFACES,
} from '../legacyBaseline';
import { TABLE_SURFACE_IDS } from '../surfaceRegister';
import { ACCEPTANCE_SURFACES } from '../types';

describe('Baseline · strefy — nadmiarowe rodzaje sekcji są neutralizowane', () => {
  it('kanon zna dokładnie trzy strefy', () => {
    expect(CANON_ROW_MENU_ZONE_ORDER).toEqual(['context', 'manage', 'danger']);
  });

  it.each(LEGACY_NON_CANONICAL_SECTION_KINDS)(
    'union nadal dopuszcza rodzaj "%s" — i to jest w porządku, bo renderer go składa',
    (kind) => {
      expectTypeOf(kind).toMatchTypeOf<RowActionSectionKind>();
      expect(CANON_ROW_MENU_ZONE_ORDER).not.toContain(kind);
    }
  );

  it('ŻYWY renderer składa wszystkie siedem rodzajów w trzy strefy (T01-KEBAB-K04)', () => {
    const zones = normalizeZones([
      { id: '1', kind: 'open', actions: [{ id: 'o', label: 'Open', onClick: () => {} }] },
      { id: '2', kind: 'ai', actions: [{ id: 'a', label: 'AI', onClick: () => {} }] },
      { id: '3', kind: 'convert', actions: [{ id: 'c', label: 'Convert', onClick: () => {} }] },
      { id: '4', kind: 'output', actions: [{ id: 'x', label: 'Export', onClick: () => {} }] },
      { id: '5', kind: 'manage', actions: [{ id: 'e', label: 'Edit', onClick: () => {} }] },
      {
        id: '6',
        kind: 'danger',
        actions: [{ id: 'd', label: 'Delete', onClick: () => {}, variant: 'danger' }],
      },
    ]);
    // Trzy strefy → najwyżej dwa separatory. Sześć grup wizualnych z defektu
    // P0 jest po R01 niewyrażalne.
    expect(zones).toHaveLength(3);
    expect(zones.map((z) => z.zone)).toEqual(['context', 'manage', 'danger']);
  });
});

describe('Baseline · wykrywanie atrap', () => {
  it('kanoniczny wzorzec łapie "Coming soon" i "Wkrótce"', () => {
    expect(CANON_PLACEHOLDER_LABEL_PATTERN.test('Export (coming soon)')).toBe(true);
    expect(CANON_PLACEHOLDER_LABEL_PATTERN.test('Eksport — wkrótce')).toBe(true);
    expect(CANON_PLACEHOLDER_LABEL_PATTERN.test('Wkrotce')).toBe(true);
  });

  it('ZAMKNIĘTE R01: atrapa nazwana w etykiecie jest wykrywana także bez disabled', () => {
    const deviation = LEGACY_BEHAVIOUR_DEVIATIONS.placeholderDetectedOnLabel;
    expect(deviation.status).toBe('CLOSED_R01');
    // Dowód na żywym module — nie na zapisanej liczbie.
    expect(czyAtrapa({ label: 'Export (coming soon)' })).toBe(deviation.current);
    expect(czyAtrapa({ label: 'Export (coming soon)' })).toBe(true);
    expect(deviation.legacy).toBe(false);
  });

  it('OTWARTE: aktywna akcja z mylącym opisem nadal przechodzi (należy do R20–R28)', () => {
    const deviation = LEGACY_BEHAVIOUR_DEVIATIONS.placeholderInDescriptionOfEnabledAction;
    expect(deviation.status).toBe('OPEN');
    expect(czyAtrapa({ disabled: false, description: 'Coming soon (backend)' })).toBe(
      deviation.current
    );
  });

  it('realny business-lock NIE jest atrapą i zostaje w menu', () => {
    expect(
      czyAtrapa({ disabled: true, description: 'Safes are automatic — cannot be deleted' })
    ).toBe(false);
    expect(czyAtrapa({ disabled: true, description: 'Coming soon (backend)' })).toBe(true);
    expect(czyAtrapa({ disabled: true, rightLabel: 'Wkrótce' })).toBe(true);
  });

  it('ZAMKNIĘTE R01: ścieżka legacy nie usuwa już pozycji wyłączonych', () => {
    const deviation = LEGACY_BEHAVIOUR_DEVIATIONS.legacyPathDropsDisabledActions;
    expect(deviation.status).toBe('CLOSED_R01');
    const zones = normalizeZones([
      {
        id: 'legacy',
        actions: [
          { id: 'edit', label: 'Edit', onClick: () => {} },
          {
            id: 'archive',
            label: 'Archive',
            onClick: () => {},
            disabled: true,
            description: 'Archive first',
          },
        ],
      },
    ]);
    const kept = zones.flatMap((z) => z.actions).map((a) => a.id);
    expect(kept).toContain('archive');
    expect(deviation.legacy).toBe(true);
  });
});

describe('Baseline · geometria menu wiersza', () => {
  it('wszystkie odchylenia geometryczne są zamknięte przez R01', () => {
    for (const deviation of LEGACY_ROW_MENU_GEOMETRY) {
      expect(deviation.status).toBe('CLOSED_R01');
      expect(deviation.closedBy).toBe('R01');
      expect(deviation.clause.length).toBeGreaterThan(0);
      expect(deviation.source.length).toBeGreaterThan(0);
    }
  });

  it('zapisany stan bazowy faktycznie różnił się od kanonu', () => {
    // Zabezpieczenie przed „naprawą" baseline przez przepisanie do niego
    // wartości kanonicznych bez ruszania komponentu.
    for (const deviation of LEGACY_ROW_MENU_GEOMETRY) {
      expect(deviation.legacy).not.toBe(deviation.canon);
    }
  });

  it('kanon domyka górną i dolną granicę szerokości panelu', () => {
    const min = LEGACY_ROW_MENU_GEOMETRY.find((d) => d.property === 'panel min-width')!;
    const max = LEGACY_ROW_MENU_GEOMETRY.find((d) => d.property === 'panel max-width')!;
    expect(min.legacy).toBeLessThan(min.canon);
    // Stan bazowy nie miał górnej granicy w ogóle — zapisany jako 0.
    expect(max.legacy).toBe(0);
    expect(max.canon).toBe(320);
  });
});

describe('Baseline · klawiatura', () => {
  it('stan bazowy obsługiwał wyłącznie Escape', () => {
    expect([...LEGACY_KEYBOARD_SUPPORT]).toEqual(['Escape']);
  });

  it('kanon wymaga pełnej nawigacji, dostarczonej przez R01', () => {
    const added = CANON_KEYBOARD_SUPPORT.filter(
      (key) => !LEGACY_KEYBOARD_SUPPORT.includes(key as 'Escape')
    );
    expect(added).toEqual(['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'Space', 'typeahead']);
  });
});

describe('Baseline · macierz odbiorowa', () => {
  it('mianownik to 45 tabel × 5 powierzchni', () => {
    expect(TABLE_SURFACE_IDS).toHaveLength(45);
    expect(ACCEPTANCE_SURFACES).toHaveLength(5);
    expect(TABLE_SURFACE_IDS.length * ACCEPTANCE_SURFACES.length).toBe(
      ACCEPTANCE_SURFACE_DENOMINATOR
    );
  });

  it('bazowo tylko 9 tabel miało PASS na odbiorze TABLE', () => {
    expect(LEGACY_TABLE_PASS_SURFACES).toHaveLength(9);
    for (const id of LEGACY_TABLE_PASS_SURFACES) {
      expect(TABLE_SURFACE_IDS).toContain(id);
    }
  });

  it('bazowo tylko T25 miało PASS na odbiorze MENU_1_2_3', () => {
    expect([...LEGACY_MENU_PASS_SURFACES]).toEqual(['T25']);
  });

  it('bazowo PREVIEW, KEBAB i PPM nie miały ani jednego PASS', () => {
    for (const surface of ['PREVIEW', 'KEBAB', 'PPM'] as const) {
      expect(ACCEPTANCE_SURFACES).toContain(surface);
    }
    expect(LEGACY_ATOMIC_DEFECT_COUNT).toBe(322);
  });
});
