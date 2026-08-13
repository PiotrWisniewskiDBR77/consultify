/**
 * Deterministyczny hash treści Outputu/Raportu.
 *
 * DLACZEGO TO JEST OSOBNY MODUŁ Z TESTAMI:
 * repo ma udokumentowany przypadek, w którym hash semantyczny dawał 6-7 różnych
 * wartości z 10 przebiegów. Dwie przyczyny, obie powielone tutaj jako reguły:
 *
 *  1. Kolejność brana z SQL (`UPDATE`/`SELECT` bez `ORDER BY`) nie jest stała.
 *     → Sortujemy W PAMIĘCI, tuż przed serializacją.
 *  2. Liczby zmiennoprzecinkowe wrzucane do konkatenacji nie są łączne —
 *     ta sama treść dawała różne ciągi.
 *     → Liczby normalizujemy do stałej reprezentacji.
 *
 * Wymóg manifestu §8.5 wspólnego kontraktu.
 */

/** Normalizuje liczbę do stabilnej postaci tekstowej. */
function normalizeNumber(value: number): string {
  if (!Number.isFinite(value)) return 'NaN';
  // -0 i 0 muszą dać ten sam ciąg.
  if (value === 0) return '0';
  // Stała precyzja zamiast domyślnej reprezentacji zmiennoprzecinkowej.
  return Number.isInteger(value) ? String(value) : value.toFixed(10);
}

/**
 * Zwraca kanoniczną, deterministyczną reprezentację wartości.
 * Klucze obiektów sortowane w pamięci; tablice zachowują kolejność,
 * bo dla treści raportu kolejność sekcji JEST znacząca.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const t = typeof value;
  if (t === 'number') return normalizeNumber(value as number);
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  if (t === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      // pomijamy undefined, żeby obecność klucza bez wartości nie zmieniała hasha
      .filter(([, v]) => v !== undefined)
      // SORT W PAMIĘCI — nigdy nie polegamy na kolejności z bazy
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
  }

  return JSON.stringify(String(value));
}

/**
 * Stabilny hash 64-bitowy (FNV-1a) w zapisie hex.
 * Nie jest kryptograficzny — służy do wykrywania zmiany treści, nie do ochrony.
 */
export function contentHash(value: unknown): string {
  const text = canonicalize(value);

  // FNV-1a 64-bit na BigInt — deterministyczny niezależnie od platformy.
  const PRIME = 1099511628211n;
  const MASK = (1n << 64n) - 1n;
  let hash = 14695981039346656037n;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * PRIME) & MASK;
  }

  return hash.toString(16).padStart(16, '0');
}
