/**
 * liveBindingResolver — W6.5: rozstrzyganie świeżości żywych powiązań danych.
 *
 * Materiał (tabela/sekcja) może być POWIĄZANY z żywym źródłem (konektor F5 lub
 * formularz) zamiast trzymać statyczną kopię. Ten moduł decyduje — czysto, bez I/O —
 * CZY dane są nieświeże i czy odświeżyć je przy otwarciu, wg polityki TTL + trybu.
 *
 * Sam fetch wykonuje `materialDataBinding` (connectorDataset/formDataset). Tu tylko
 * deterministyczna polityka: rozdzielenie „kiedy odświeżać" od „jak pobrać".
 *
 * Czysty, testowalny z wstrzykiwanym `now`. Fail-soft (brak/niepoprawne wejście →
 * bezpieczna decyzja: nie odświeżaj automatycznie).
 *
 * SSOT: M17 plan W6.5 (live-bind resolver + refresh-on-open).
 */

import type { MaterialDataset } from './materialDataBinding.js';

// ── Typy ─────────────────────────────────────────────────────────────────────

export type RefreshMode = 'on_open' | 'manual' | 'scheduled';

/** Deskryptor powiązania materiału z żywym źródłem. */
export interface MaterialBinding {
  /** Identyfikator powiązania (np. id tabeli/sekcji). */
  id: string;
  kind: 'connector' | 'form';
  /** Typ konektora lub id formularza. */
  ref: string;
  /** Konfiguracja źródła (przekazywana do fetchu). */
  config?: Record<string, unknown>;
  /** Kiedy ostatnio pobrano dane (ISO lub epoch ms; brak = nigdy). */
  lastFetchedAt?: string | number | null;
  /** Polityka odświeżania. */
  policy: {
    /** Po ilu sekundach dane uznajemy za nieświeże. */
    ttlSeconds: number;
    mode: RefreshMode;
  };
}

export interface BindingFreshness {
  id: string;
  /** Wiek danych w sekundach (Infinity gdy nigdy nie pobrano). */
  ageSeconds: number;
  isStale: boolean;
  /** Czy POWINNO się odświeżyć teraz (uwzględnia tryb + świeżość). */
  needsRefresh: boolean;
  reason: 'never_fetched' | 'ttl_expired' | 'fresh' | 'manual_mode' | 'invalid';
}

export interface RefreshPlan {
  /** Powiązania do odświeżenia (needsRefresh=true). */
  toRefresh: BindingFreshness[];
  /** Wszystkie ocenione (do podglądu/diagnostyki). */
  all: BindingFreshness[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toMs(t: string | number | null | undefined): number | null {
  if (t == null) return null;
  if (typeof t === 'number') return Number.isFinite(t) ? t : null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

// ── Rozstrzyganie świeżości ──────────────────────────────────────────────────

/**
 * Ocenia świeżość jednego powiązania względem `nowMs`.
 *
 * Reguły:
 *   - brak lastFetchedAt → never_fetched, needsRefresh gdy tryb ≠ manual
 *   - wiek > ttl → ttl_expired, isStale, needsRefresh gdy tryb = on_open|scheduled
 *   - tryb manual → nigdy nie odświeża automatycznie (needsRefresh=false), ale
 *     isStale nadal raportowane (UI może pokazać „odśwież ręcznie")
 *   - niepoprawne wejście → invalid, needsRefresh=false (bezpiecznie)
 */
export function resolveBindingFreshness(binding: MaterialBinding, nowMs: number): BindingFreshness {
  if (!binding || !binding.id || !binding.policy || !Number.isFinite(binding.policy.ttlSeconds)) {
    return {
      id: binding?.id ?? 'unknown',
      ageSeconds: Infinity,
      isStale: true,
      needsRefresh: false,
      reason: 'invalid',
    };
  }
  const mode = binding.policy.mode;
  const ttl = Math.max(0, binding.policy.ttlSeconds);
  const fetchedMs = toMs(binding.lastFetchedAt);

  if (fetchedMs == null) {
    // nigdy nie pobrano — odśwież chyba że manual
    return {
      id: binding.id,
      ageSeconds: Infinity,
      isStale: true,
      needsRefresh: mode !== 'manual',
      reason: 'never_fetched',
    };
  }

  const ageSeconds = Math.max(0, Math.round((nowMs - fetchedMs) / 1000));
  const isStale = ageSeconds > ttl;

  if (!isStale) {
    return { id: binding.id, ageSeconds, isStale: false, needsRefresh: false, reason: 'fresh' };
  }
  // nieświeże:
  if (mode === 'manual') {
    return {
      id: binding.id,
      ageSeconds,
      isStale: true,
      needsRefresh: false,
      reason: 'manual_mode',
    };
  }
  return { id: binding.id, ageSeconds, isStale: true, needsRefresh: true, reason: 'ttl_expired' };
}

/**
 * Buduje plan odświeżenia dla zestawu powiązań (np. przy otwarciu materiału).
 * `onlyMode` ogranicza do trybu (np. tylko 'on_open' przy otwieraniu).
 */
export function planRefresh(
  bindings: MaterialBinding[],
  nowMs: number,
  opts?: { onlyMode?: RefreshMode }
): RefreshPlan {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return { toRefresh: [], all: [] };
  }
  const filtered = opts?.onlyMode
    ? bindings.filter((b) => b?.policy?.mode === opts.onlyMode)
    : bindings;
  const all = filtered.map((b) => resolveBindingFreshness(b, nowMs));
  return { toRefresh: all.filter((f) => f.needsRefresh), all };
}

/**
 * Po udanym fetchu — zwraca zaktualizowany deskryptor z nowym `lastFetchedAt`.
 * Czyste (nie mutuje wejścia). Caller persystuje.
 */
export function markFetched(binding: MaterialBinding, nowMs: number): MaterialBinding {
  return { ...binding, lastFetchedAt: nowMs };
}

/**
 * Metadane świeżości do dołączenia do pobranego datasetu (provenance + UI).
 */
export function annotateDatasetFreshness(
  dataset: MaterialDataset,
  freshness: BindingFreshness
): MaterialDataset & { freshness: BindingFreshness } {
  return { ...dataset, freshness };
}
