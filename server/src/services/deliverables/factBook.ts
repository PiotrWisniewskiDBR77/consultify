/**
 * factBook (F10.1) — księga faktów: liczby jako REFERENCJE, nie kopie.
 *
 * Źródło sprzecznych liczb = kopiowanie tej samej liczby do 3 artefaktów i drift.
 * Rozwiązanie: jeden rejestr faktów (z SPINE hero-numbers) + tokeny `{{fact:key}}`
 * w treści. Renderer podstawia KANONICZNĄ sformatowaną wartość → ta sama liczba
 * jest IDENTYCZNA wszędzie z konstrukcji (nie ma kopii do rozjechania).
 *
 * + audyt: wykrywa twardo wpisane liczby, które są SPRZECZNE z kanonem
 *   (np. „€12.4M" gdzie fakt mówi „€12.0M") — sieć bezpieczeństwa dla treści LLM.
 *
 * Czyste funkcje, deterministyczne, nigdy nie rzucają.
 */

export interface Fact {
  key: string;
  label: string;
  /** Sformatowana RAZ wartość — reużywana wszędzie. */
  formatted: string;
  value?: number;
  unit?: string;
}

export type FactBook = ReadonlyMap<string, Fact>;

/** Zbuduj księgę faktów z listy faktów (np. SPINE.heroNumbers). */
export function buildFactBook(facts: Fact[]): FactBook {
  const map = new Map<string, Fact>();
  for (const f of facts) {
    if (f && typeof f.key === 'string' && f.key.length > 0) map.set(f.key, f);
  }
  return map;
}

const FACT_TOKEN = /\{\{\s*fact:([a-zA-Z0-9_.-]+)\s*\}\}/g;

export interface RenderResult {
  text: string;
  /** Klucze tokenów `{{fact:...}}`, których nie ma w księdze (zostają dosłownie). */
  unknownKeys: string[];
}

/**
 * Podstaw `{{fact:key}}` → kanoniczna sformatowana wartość. Nieznany klucz =
 * token zostaje dosłownie + ląduje w unknownKeys (do walidacji/QA).
 */
export function renderFactReferences(template: string, factBook: FactBook): RenderResult {
  const unknownKeys: string[] = [];
  const text = String(template ?? '').replace(FACT_TOKEN, (_m, key: string) => {
    const fact = factBook.get(key);
    if (!fact) {
      unknownKeys.push(key);
      return `{{fact:${key}}}`;
    }
    return fact.formatted;
  });
  return { text, unknownKeys };
}

export interface FactContradiction {
  key: string;
  label: string;
  canonical: string;
  /** Liczba znaleziona przy etykiecie, różna od kanonu. */
  foundValue: string;
}

// „Wartościowe" liczby = mają kształt metryki: waluta (€$£) LUB część dziesiętna
// LUB sufiks magnitudy/jednostki (M/K/B/%/×/bn/mln). Wyklucza gołe cyfry z etykiet
// (np. „3" w „Year 3"), które nie są wartościami.
const VALUE_NUMBER =
  /(?:[€$£]\s?\d[\d.,]*\s?(?:[MKBmkb]|bn|mln|mld)?|\d[\d.,]*\s?(?:[MKB]|bn|mln|mld|%|×|x)|\d+[.,]\d+)/g;

/** Znormalizuj wartość do samych cyfr+separatora dziesiętnego (do porównań). */
function digitsOf(s: string): string {
  return (s.match(/\d[\d.,]*/)?.[0] ?? '').replace(/,/g, '');
}

/**
 * Audyt: znajdź twardo wpisane liczby SPRZECZNE z kanonem.
 * Dla każdego faktu: jeśli jego etykieta występuje w tekście, ale w pobliżu jest
 * „wartościowa" liczba różna od kanonicznej (a kanon NIE występuje) → sprzeczność.
 * Porównuje tylko liczby o kształcie metryki (waluta/dziesiętne/sufiks) — gołe
 * cyfry z etykiety nie są kandydatami, więc mało false-positives.
 */
export function auditFactConsistency(factBook: FactBook, text: string): FactContradiction[] {
  const out: FactContradiction[] = [];
  const haystack = String(text ?? '');
  const lower = haystack.toLowerCase();

  for (const fact of factBook.values()) {
    const canonDigits = digitsOf(fact.formatted);
    if (!canonDigits) continue;

    const labelIdx = lower.indexOf(fact.label.toLowerCase());
    if (labelIdx < 0) continue;

    // Okno PO etykiecie (gdzie zwykle stoi wartość), ±krótki prefiks.
    const start = Math.max(0, labelIdx - 5);
    const window = haystack.slice(start, Math.min(haystack.length, labelIdx + 140));

    // Kanon obecny w oknie? → zgodne, pomiń.
    if (window.replace(/\s+/g, '').includes(fact.formatted.replace(/\s+/g, ''))) continue;

    // „Wartościowe" liczby w oknie, różne od kanonu? → sprzeczność.
    const valueTokens = window.match(VALUE_NUMBER) ?? [];
    const conflicting = valueTokens
      .map((t) => t.trim())
      .find((t) => digitsOf(t) && digitsOf(t) !== canonDigits);
    if (conflicting) {
      out.push({
        key: fact.key,
        label: fact.label,
        canonical: fact.formatted,
        foundValue: digitsOf(conflicting),
      });
    }
  }
  return out;
}
