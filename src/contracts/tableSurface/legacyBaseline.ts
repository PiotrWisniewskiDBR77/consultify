/**
 * BASELINE STANU — zmierzona odległość między rendererem menu wiersza a kanonem.
 *
 * Po co powstał (R00): R00 nie wolno było zmienić ani jednego piksela, więc same
 * testy kontraktowe byłyby zielone także na kodzie, który kontraktu NIE spełnia —
 * czyli „fałszywy sukces", który audyt złapał już kilka razy. Baseline zapisywał
 * tę odległość jako DANE, a `legacyBaseline.test.ts` ją asertował.
 *
 * ── AKTUALIZACJA R01 (2026-08-06) ───────────────────────────────────────────
 *
 * R01 podłączył kanoniczny renderer i zamknął wszystkie pozycje geometryczne
 * oraz trzy z czterech odchyleń zachowania. Zgodnie z własnym kontraktem
 * baseline'u („KIEDY MA ZACZERWIENIĆ: gdy R01 podłączy kanoniczny model akcji —
 * wymusi to świadomą aktualizację") wpisy dostają status, a nie znikają:
 * historia pomiaru jest dowodem odbiorowym dla bramki G5.
 *
 * UWAGA METODOLOGICZNA. Poprzednia wersja tego pliku NIE zaczerwieniła się przy
 * zamknięciu defektów, bo jej asercje porównywały zapisane liczby między sobą,
 * a nie z żywym kodem. Test został przepisany tak, żeby dowodził zachowania
 * `czyAtrapa`/`normalizeZones` na żywym module — inaczej baseline mierzy sam
 * siebie i nie chroni przed niczym.
 *
 * ŹRÓDŁO POMIARU BAZOWEGO: `src/components/shared/RowActionsMenu.tsx` na SHA
 * `d8b3979e651d2e6d5591bff128f5abb23d10772e`.
 *
 * @module contracts/tableSurface/legacyBaseline
 */

import { CANON_ICON, CANON_ROW_MENU, CANON_TYPOGRAPHY } from './canon';

/** Czy odchylenie jest jeszcze otwarte, czy zamknięte przez pakiet naprawczy. */
export type DeviationStatus = 'OPEN' | 'CLOSED_R01';

/**
 * Wartości `RowActionSectionKind`, które NIE są jedną z trzech stref kanonicznych.
 *
 * §7 Zakazy nazywa je wprost: „sekcje `open/ai/convert/output` rozbijające trzy
 * strefy wizualne". Union NADAL je dopuszcza — celowo, bo 26 miejsc renderowania
 * podaje je do dziś. R01 nie zawęził typu; zamiast tego renderer NORMALIZUJE je
 * do trzech stref (`normalizeZones`), więc nadmiarowy rodzaj nie może już
 * wyprodukować czwartej grupy wizualnej. Zawężenie unionu to sprzątanie dla
 * fali R20–R28, gdy znikną ostatni wywołujący.
 */
export const LEGACY_NON_CANONICAL_SECTION_KINDS = ['open', 'ai', 'convert', 'output'] as const;

export interface LegacyGeometryDeviation {
  /** Co zmierzono. */
  property: string;
  /** Wartość na SHA bazowym. */
  legacy: number;
  /** Wartość wymagana kontraktem. */
  canon: number;
  /** Miejsce pomiaru bazowego. */
  source: string;
  /** Paragraf kontraktu. */
  clause: string;
  /** Pakiet, który to zamyka. */
  closedBy: 'R01' | 'R02' | 'R03' | 'R04';
  status: DeviationStatus;
}

/**
 * Geometria menu wiersza. Wszystkie pozycje zamknięte przez R01 — dowód
 * w `src/components/shared/__tests__/rowActionsMenu.r01.test.tsx`
 * (sekcja „R01 · geometria").
 */
export const LEGACY_ROW_MENU_GEOMETRY: readonly LegacyGeometryDeviation[] = [
  {
    property: 'panel min-width',
    legacy: 160,
    canon: CANON_ROW_MENU.minWidth,
    source: "RowActionsMenu.tsx — panel className 'min-w-[160px]'",
    clause: 'contract §7 Kontrakt graficzny kebaba',
    closedBy: 'R01',
    status: 'CLOSED_R01',
  },
  {
    property: 'panel max-width',
    // Stan bazowy nie miał górnej granicy — `maxWidth` wynikał wyłącznie
    // z odległości triggera od lewej krawędzi, więc przy szerokim ekranie
    // menu mogło urosnąć daleko ponad 320 px.
    legacy: 0,
    canon: CANON_ROW_MENU.maxWidth,
    source: 'RowActionsMenu.tsx — maxWidth = anchorRect.right - margin, bez klamry',
    clause: 'contract §7 Kontrakt graficzny kebaba',
    closedBy: 'R01',
    status: 'CLOSED_R01',
  },
  {
    property: 'viewport clearance',
    legacy: 8,
    canon: CANON_ROW_MENU.viewportClearance,
    source: 'RowActionsMenu.tsx — const margin = 8 in the reposition effect',
    clause: 'contract §7 Kontrakt graficzny kebaba',
    closedBy: 'R01',
    status: 'CLOSED_R01',
  },
  {
    property: 'menu item height',
    // `px-3 py-1.5` + `text-xs` dawało ~26 px, nie stałe 36 px z kanonu.
    legacy: 26,
    canon: 36,
    source: "RowActionsMenu.tsx — item className 'px-3 py-1.5 text-xs'",
    clause: 'contract §7 Kontrakt graficzny kebaba (h-9)',
    closedBy: 'R01',
    status: 'CLOSED_R01',
  },
  {
    property: 'menu item font size',
    legacy: 12,
    canon: CANON_TYPOGRAPHY.menuItemSizePx,
    source: "RowActionsMenu.tsx — item className 'text-xs'",
    clause: 'contract §7 Kontrakt graficzny kebaba',
    closedBy: 'R01',
    status: 'CLOSED_R01',
  },
  {
    property: 'menu icon size (size="sm")',
    legacy: 14,
    canon: CANON_ICON.default,
    source: "RowActionsMenu.tsx — const iconSize = size === 'sm' ? 14 : 16",
    clause: 'contract §7 Trigger',
    closedBy: 'R01',
    status: 'CLOSED_R01',
  },
];

/**
 * Odchylenia zachowania. `legacy` opisuje SHA bazowy, `current` stan po R01.
 * Test asertuje `current` na żywym module — `legacy` zostaje jako dowód.
 */
export const LEGACY_BEHAVIOUR_DEVIATIONS = {
  /**
   * `czyAtrapa` wykrywało „Coming soon" wyłącznie w `description`/`rightLabel`
   * i tylko dla pozycji `disabled`. Pozycja AKTYWNA nazwana wprost
   * „Export (coming soon)" przechodziła przez filtr i renderowała się
   * w produkcyjnym menu — czego §1 zabrania bezwarunkowo.
   * R01 rozszerzył wykrywanie na `label`.
   */
  placeholderDetectedOnLabel: { legacy: false, current: true, status: 'CLOSED_R01' },
  /**
   * Pozostaje OTWARTE i jest to świadome: akcja AKTYWNA (nie disabled)
   * z dopiskiem „Coming soon" w `description` nadal przechodzi. Działa, więc
   * nie jest atrapą w rozumieniu §1 — problemem jest mylący opis, a to należy
   * do treści, nie do renderera. Zgłoszone do fali domenowej R20–R28.
   */
  placeholderInDescriptionOfEnabledAction: {
    legacy: false,
    current: false,
    status: 'OPEN',
  },
  /**
   * Ścieżka legacy (`actions` bez `sections`) filtrowała `!action.disabled`,
   * czyli USUWAŁA z menu każdą pozycję wyłączoną. Kanon wymaga odwrotnie:
   * pozycja ograniczona uprawnieniem/regułą ZOSTAJE, wyraźnie jaśniejsza
   * (§1, §7 Manage, §10 Disabled).
   */
  legacyPathDropsDisabledActions: { legacy: true, current: false, status: 'CLOSED_R01' },
} as const;

/** Obsługa klawiatury na SHA bazowym — wyłącznie Escape. */
export const LEGACY_KEYBOARD_SUPPORT = ['Escape'] as const;

/** Pełny zestaw wymagany przez §7, dostarczony przez R01. */
export const CANON_KEYBOARD_SUPPORT = [
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Enter',
  'Space',
  'Escape',
  'typeahead',
] as const;

/**
 * Powierzchnie, które w `MATRIX_T01_T45.csv` mają PASS na odbiorze TABLE.
 * Dziewięć z 45 — reszta oblała. PREVIEW, KEBAB i PPM oblały wszystkie 45,
 * MENU_1_2_3 — 44 (jedyny PASS: T25).
 *
 * Baseline regresji: po R04 lista PASS może tylko rosnąć.
 */
export const LEGACY_TABLE_PASS_SURFACES = [
  'T07',
  'T08',
  'T12',
  'T13',
  'T14',
  'T21',
  'T25',
  'T34',
  'T39',
] as const;

/** Jedyna powierzchnia z PASS na MENU_1_2_3 w bazowej macierzy. */
export const LEGACY_MENU_PASS_SURFACES = ['T25'] as const;

/** Liczba atomowych defektów w `ATOMIC_DEFECT_BACKLOG.csv` (322 wiersze + nagłówek). */
export const LEGACY_ATOMIC_DEFECT_COUNT = 322;

/** Mianownik odbiorów powierzchniowych: 45 tabel × 5 powierzchni. */
export const ACCEPTANCE_SURFACE_DENOMINATOR = 225;
