/**
 * layeredEdit (F6.2) — edycja warstwowa: warstwa GENEROWANA + warstwa NADPISAŃ.
 *
 * Problem: regeneracja (AI) NIE może kasować ręcznych poprawek usera (clobber =
 * znany P0 w innych modułach). Rozwiązanie: dwie warstwy keyowane po blockId:
 *   - generated[blockId] = treść z AI (wymieniana przy regeneracji)
 *   - overrides[blockId] = ręczne poprawki usera (trwałe, shallow-merge na wierzch)
 *   - effective = generated z nałożonymi overrides
 *
 * Przy regeneracji: overrides dla blockId, który DALEJ istnieje → zachowane;
 * overrides dla usuniętego blockId → „osierocone" (zgłoszone + odrzucone).
 *
 * Czyste funkcje, deterministyczne, nigdy nie rzucają. Generyczne po typie bloku.
 */

export type BlockMap<T = Record<string, unknown>> = Record<string, T>;
export type OverrideMap<T = Record<string, unknown>> = Record<string, Partial<T>>;

export interface MergeResult<T> {
  /** Warstwa generowana z nałożonymi overrides (to renderujemy). */
  effective: BlockMap<T>;
  /** Klucze overrides bez odpowiadającego bloku generowanego (osierocone). */
  orphanedOverrideKeys: string[];
}

/**
 * Nałóż overrides na warstwę generowaną (shallow-merge per blok).
 * Override dla nieistniejącego bloku NIE tworzy bloku — trafia do orphaned.
 */
export function mergeLayers<T extends Record<string, unknown>>(
  generated: BlockMap<T>,
  overrides: OverrideMap<T>
): MergeResult<T> {
  const effective: BlockMap<T> = {};
  for (const [blockId, gen] of Object.entries(generated)) {
    const ov = overrides[blockId];
    effective[blockId] = ov ? ({ ...gen, ...ov } as T) : gen;
  }
  const orphanedOverrideKeys = Object.keys(overrides).filter((k) => !(k in generated));
  return { effective, orphanedOverrideKeys };
}

export interface RegenerationResult<T> {
  effective: BlockMap<T>;
  /** Overrides zachowane (blok dalej istnieje). */
  preservedOverrideKeys: string[];
  /** Overrides odrzucone (blok zniknął w nowej generacji). */
  orphanedOverrideKeys: string[];
  /** Klucze przefiltrowanej mapy overrides (do zapisania jako nowy stan). */
  survivingOverrides: OverrideMap<T>;
}

/**
 * Regeneracja: nowa warstwa generowana + DOTYCHCZASOWE overrides usera.
 * Zachowuje overrides na blokach, które przetrwały; reszta = osierocona.
 * NIE clobberuje ręcznych poprawek tam, gdzie blok dalej istnieje.
 */
export function regenerate<T extends Record<string, unknown>>(
  newGenerated: BlockMap<T>,
  existingOverrides: OverrideMap<T>
): RegenerationResult<T> {
  const survivingOverrides: OverrideMap<T> = {};
  const preservedOverrideKeys: string[] = [];
  const orphanedOverrideKeys: string[] = [];

  for (const [blockId, ov] of Object.entries(existingOverrides)) {
    if (blockId in newGenerated) {
      survivingOverrides[blockId] = ov;
      preservedOverrideKeys.push(blockId);
    } else {
      orphanedOverrideKeys.push(blockId);
    }
  }

  const { effective } = mergeLayers(newGenerated, survivingOverrides);
  return { effective, preservedOverrideKeys, orphanedOverrideKeys, survivingOverrides };
}

/**
 * Zarejestruj ręczną poprawkę usera (immutable update mapy overrides).
 * `patch` = pola do nadpisania w bloku. Zwraca NOWĄ mapę (nie mutuje wejścia).
 */
export function recordOverride<T extends Record<string, unknown>>(
  overrides: OverrideMap<T>,
  blockId: string,
  patch: Partial<T>
): OverrideMap<T> {
  return {
    ...overrides,
    [blockId]: { ...(overrides[blockId] || {}), ...patch },
  };
}

/** Cofnij ręczną poprawkę (usuń override dla bloku) — immutable. */
export function clearOverride<T extends Record<string, unknown>>(
  overrides: OverrideMap<T>,
  blockId: string
): OverrideMap<T> {
  if (!(blockId in overrides)) return overrides;
  const next = { ...overrides };
  delete next[blockId];
  return next;
}
