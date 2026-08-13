/**
 * Bezpieczne scalanie treści Library — naprawa L11.
 *
 * DEFEKT, KTÓRY TO NAPRAWIA:
 * `KnownToolsService.ensureToolsSeedOnce()` budował
 * `library_content_translations` wyłącznie z `whatYouGet` i nadpisywał kolumnę
 * bezwarunkowo (`= EXCLUDED.library_content_translations`). Migracje 559 i 562
 * — obie aktywne — wypełniają OSIEM pól (`whenToUse`, `inputs`, `steps`,
 * `outputs`, `commonMistakes`, `example`, `nextSteps`, `whatYouGet`).
 * Efekt: raz na proces serwer kasował 7 z 8 pól dla wszystkich 31 narzędzi.
 *
 * REGUŁY SCALANIA (decyzja właściciela 2026-08-13):
 *  1. Istniejąca NIEPUSTA wartość zawsze wygrywa.
 *  2. Seed uzupełnia wyłącznie wartości brakujące lub puste.
 *  3. Brak pola w seedzie NICZEGO nie usuwa.
 *  4. Nieznane pola są zachowywane.
 *  5. Operacja jest idempotentna — restart nie degraduje danych.
 *  6. Scalamy per LOCALE i per POLE. Bez prostego replace i bez oceniania
 *     całego JSON-a po długości.
 */

/** Treść jednego locale: pola o dowolnych nazwach (nieznane też zachowujemy). */
export type LocaleContent = Record<string, unknown>;
/** Mapa locale → treść, np. { en: {...}, pl: {...} }. */
export type LibraryContent = Record<string, LocaleContent>;

/**
 * Czy wartość jest „pusta" w sensie merytorycznym.
 * UWAGA: `0` i `false` NIE są puste — to poprawne dane.
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) {
    // Tablica samych pustych stringów jest pusta merytorycznie.
    return value.length === 0 || value.every((v) => isEmptyValue(v));
  }
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parsuje kolumnę do mapy locale. Odporne na null, pusty string,
 * niepoprawny JSON i JSON, który nie jest obiektem (legacy dane).
 */
export function parseLibraryContent(raw: string | null | undefined): LibraryContent {
  if (!raw || typeof raw !== 'string' || raw.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Zepsuty JSON traktujemy jak brak treści — NIGDY nie rzucamy, bo to
    // przerwałoby seed i wywróciło start serwera.
    return {};
  }
  if (!isPlainObject(parsed)) return {};

  const out: LibraryContent = {};
  for (const [locale, content] of Object.entries(parsed)) {
    // Locale, którego wartość nie jest obiektem, pomijamy przy scalaniu,
    // ale zachowujemy w wyniku, żeby niczego nie skasować.
    out[locale] = isPlainObject(content) ? content : ({} as LocaleContent);
    if (!isPlainObject(content)) {
      // zachowaj oryginał pod tym samym kluczem, jeśli niósł jakąkolwiek treść
      if (!isEmptyValue(content)) {
        (out as Record<string, unknown>)[locale] = content;
      }
    }
  }
  return out;
}

/**
 * Scala treść seeda w istniejącą, per locale i per pole.
 * Zwraca NOWY obiekt; wejścia nie są mutowane.
 */
export function mergeLibraryContent(
  existing: LibraryContent,
  seed: LibraryContent
): LibraryContent {
  const result: LibraryContent = {};

  // 1. Przepisujemy wszystko, co już jest — łącznie z locale spoza seeda
  //    i polami, których seed w ogóle nie zna.
  for (const [locale, content] of Object.entries(existing ?? {})) {
    result[locale] = isPlainObject(content) ? { ...content } : content;
  }

  // 2. Seed wchodzi wyłącznie tam, gdzie brakuje treści.
  for (const [locale, seedContent] of Object.entries(seed ?? {})) {
    if (!isPlainObject(seedContent)) continue;

    const current = result[locale];
    if (!isPlainObject(current)) {
      // Locale nie istniało (albo było niepoprawne) — bierzemy je z seeda,
      // ale nie nadpisujemy niepustej wartości nie-obiektowej.
      if (current === undefined || isEmptyValue(current)) {
        result[locale] = { ...seedContent };
      }
      continue;
    }

    for (const [field, seedValue] of Object.entries(seedContent)) {
      // Reguła nadrzędna: istniejąca niepusta wartość wygrywa.
      if (!isEmptyValue(current[field])) continue;
      // Nie wstawiamy pustki seeda w miejsce pustki — to tylko szum.
      if (isEmptyValue(seedValue)) continue;
      current[field] = seedValue;
    }
  }

  return result;
}

/**
 * Wersja operująca na surowych stringach kolumny — to jest kontrakt używany
 * w SQL. Zwraca JSON gotowy do zapisu.
 *
 * Klucze sortujemy w pamięci, żeby ten sam stan dawał ten sam ciąg
 * (repo ma udokumentowany przypadek niestabilnych hashy przy serializacji).
 */
export function mergeLibraryContentJson(
  existingRaw: string | null | undefined,
  seedRaw: string | null | undefined
): string {
  const merged = mergeLibraryContent(parseLibraryContent(existingRaw), parseLibraryContent(seedRaw));
  return stableStringify(merged);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}
