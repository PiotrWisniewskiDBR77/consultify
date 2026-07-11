/**
 * assumptionsRegistry (Z114 — Wzorzec transparentnych założeń, generalizowalny).
 *
 * Rdzeń wyciągnięty z `deliverables/assumptionsModel.ts` (typ `Provenance`,
 * `sources` per driver) i UOGÓLNIONY do wzorca „transparentnych założeń" z
 * SSOT Harvard/wdrozenie-100/_KONCEPT_FINANCE_2026-07-10.md §6 / §4.2.
 *
 * Pętla (uniwersalna, wiele silników — Finance / BusinessPlan / Results / Assessment):
 *   BRAK DANYCH → AI ZAKŁADA (jawnie, z benchmarku) → LISTA ZAŁOŻEŃ (rejestr)
 *   → UŻYTKOWNIK EDYTUJE → RECOMPUTE → ślad rewizji.
 *
 * Ten moduł dostarcza MECHANIZM + KONTRAKT (deterministyczny TS), NIE generację AI:
 *   1. wykryj brakujące drivery — deterministycznie, wg rejestru wymaganych per typ modelu,
 *   2. oznacz źródło (prowieniencja per wartość),
 *   3. wylistuj założenia ze statusem/badge do UI (twarde vs założone-AI vs edytowane),
 *   4. diff po edycji (ślad rewizji + delty do „recompute → o ile zmienił się wynik").
 *
 * Wartość liczbową (krok „AI zakłada") dostarcza CALLER/LLM — tu tylko opakowanie
 * w prowieniencję z `source_type='ai_assumed'` + rationale + confidence.
 *
 * Czyste funkcje, deterministyczne (zero Date.now()/losowości — znaczniki czasu
 * podaje caller), nigdy nie rzucają.
 */

// ── Kontrakt prowieniencji (§4.2 kolumny model_assumptions) ─────────────────

/**
 * Skąd pochodzi wartość założenia. UI koloruje badge wg klas:
 *  - twarde (imported/user/teresa): dane wejściowe / zaakceptowane,
 *  - benchmark: sourcowane zewnętrznie (obronne),
 *  - ai_assumed: uzupełnione przez AI → DO PRZEGLĄDU.
 */
export type AssumptionSourceType =
  | 'imported' // z uploadu / systemu źródłowego (twarde)
  | 'user' // wpisane/edytowane ręcznie przez użytkownika (zaakceptowane)
  | 'teresa' // wprowadzone przez asystenta na polecenie użytkownika (proxy usera)
  | 'ai_assumed' // AI zgadło przy braku danych (jawnie — do przeglądu)
  | 'benchmark'; // z benchmarku branżowego / analogii (sourcowane)

/** Klasy statusu jako kryterium „needsReview" i koloru badge w UI. */
export const HARD_SOURCE_TYPES: readonly AssumptionSourceType[] = ['imported', 'user', 'teresa'];
export const SOURCED_SOURCE_TYPES: readonly AssumptionSourceType[] = ['imported', 'benchmark', 'teresa'];

/** Prowieniencja pojedynczej wartości (§4.2 Z114). */
export interface AssumptionProvenance {
  source_type: AssumptionSourceType;
  /** Referencja źródła: „Gartner 2025" / „upload:2026-financials.xlsx" / model id / analogia. */
  source_ref?: string;
  /** Uzasadnienie — wymagane sensownie dla ai_assumed/benchmark (obronność). */
  rationale?: string;
  /** Pewność 0..1 (zwłaszcza dla ai_assumed). Poza zakresem → clamp. */
  confidence?: number;
  /** Kto edytował (gdy source_type=user/teresa). */
  edited_by?: string;
  /** Znacznik czasu ISO edycji — podaje caller (deterministyczność). */
  edited_at?: string;
}

/** Pojedyncze założenie/driver — każda liczba traceable do nazwanego klucza. */
export interface Assumption {
  /** Stabilny klucz, np. „revenue.growth_yoy". */
  key: string;
  label?: string;
  /** Wartość bazowa; null = BRAK (do wykrycia w kroku 1). */
  value: number | null;
  unit: string;
  provenance: AssumptionProvenance;
}

// ── Rejestr wymaganych driverów per typ modelu (deterministyczny) ───────────

/** Specyfikacja wymaganego drivera dla danego typu modelu. */
export interface RequiredDriver {
  key: string;
  label: string;
  unit: string;
  /**
   * Podpowiedź benchmarku dla kroku „AI zakłada" — to TYLKO hint dla callera/LLM
   * (mechanizm), silnik sam nie generuje wartości.
   */
  benchmarkHint?: number;
  /** Czy driver jest opcjonalny (nie liczony jako brak). Domyślnie false = wymagany. */
  optional?: boolean;
}

/** Rejestr: typ modelu → lista wymaganych driverów. */
export type DriverRegistry = Record<string, RequiredDriver[]>;

// ── Krok 1: wykryj brakujące drivery (deterministycznie) ────────────────────

export interface MissingDriver {
  key: string;
  label: string;
  unit: string;
  benchmarkHint?: number;
  /** Dlaczego brak: nie ma go w rejestrze wartości / jest ale value=null. */
  reason: 'absent' | 'null_value';
}

const isMissingValue = (v: number | null | undefined): boolean =>
  v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));

/**
 * Wykryj wymagane drivery, których brakuje w dostarczonym zbiorze założeń.
 * Brak = klucz nieobecny (`absent`) albo obecny z pustą wartością (`null_value`).
 * Drivery `optional` są pomijane. Wynik posortowany po `key` (stabilny).
 */
export function detectMissingDrivers(
  required: readonly RequiredDriver[],
  provided: readonly Assumption[],
): MissingDriver[] {
  const byKey = new Map<string, Assumption>();
  for (const a of provided) byKey.set(a.key, a);
  const out: MissingDriver[] = [];
  for (const r of required) {
    if (r.optional) continue;
    const found = byKey.get(r.key);
    if (!found) {
      out.push({ key: r.key, label: r.label, unit: r.unit, benchmarkHint: r.benchmarkHint, reason: 'absent' });
    } else if (isMissingValue(found.value)) {
      out.push({ key: r.key, label: r.label, unit: r.unit, benchmarkHint: r.benchmarkHint, reason: 'null_value' });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

// ── Krok 2: AI zakłada JAWNIE / oznacz źródło ───────────────────────────────

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export interface AiAssumeOpts {
  rationale: string;
  confidence?: number; // 0..1
  source_ref?: string; // np. „benchmark Bessemer 2025" / „analogia: SaaS B2B"
  /** Jeśli wartość pochodzi z twardego benchmarku, nie z gołego zgadywania. */
  benchmarked?: boolean;
}

/**
 * Krok „AI zakłada (jawnie)": opakuj DOSTARCZONĄ przez callera/LLM wartość w
 * założenie z prowieniencją `ai_assumed` (lub `benchmark`, gdy `benchmarked`).
 * Silnik NIE wymyśla liczby — dostaje ją z zewnątrz i tylko znakuje pochodzenie.
 */
export function buildAiAssumption(
  driver: Pick<RequiredDriver, 'key' | 'label' | 'unit'>,
  value: number,
  opts: AiAssumeOpts,
): Assumption {
  return {
    key: driver.key,
    label: driver.label,
    value,
    unit: driver.unit,
    provenance: {
      source_type: opts.benchmarked ? 'benchmark' : 'ai_assumed',
      source_ref: opts.source_ref,
      rationale: opts.rationale,
      confidence: opts.confidence === undefined ? undefined : clamp01(opts.confidence),
    },
  };
}

/**
 * Oznacz/zmień źródło istniejącego założenia (merge prowieniencji).
 * Zwraca NOWY obiekt (immutable). Nie ustawia znaczników czasu sam —
 * `edited_at`/`edited_by` przekazuje caller w `patch` (deterministyczność).
 */
export function markSource(a: Assumption, patch: Partial<AssumptionProvenance>): Assumption {
  const confidence =
    patch.confidence === undefined ? a.provenance.confidence : clamp01(patch.confidence);
  return {
    ...a,
    provenance: { ...a.provenance, ...patch, confidence },
  };
}

/**
 * Zarejestruj edycję użytkownika: ustaw wartość + `source_type='user'` (zaakceptowane)
 * + ślad kto/kiedy. `at` (ISO) podaje caller.
 */
export function applyUserEdit(
  a: Assumption,
  value: number,
  editedBy: string,
  at: string,
  rationale?: string,
): Assumption {
  return {
    ...a,
    value,
    provenance: {
      ...a.provenance,
      source_type: 'user',
      edited_by: editedBy,
      edited_at: at,
      ...(rationale !== undefined ? { rationale } : {}),
    },
  };
}

// ── Krok 3: lista założeń ze statusem/badge do UI ───────────────────────────

/** Status pod badge/kolor w panelu „Założenia". */
export type AssumptionStatus =
  | 'missing' // brak wartości
  | 'assumed' // ai_assumed → DO PRZEGLĄDU
  | 'edited' // user → zaakceptowane
  | 'sourced'; // imported/benchmark/teresa → twarde/sourcowane

export interface ListedAssumption extends Assumption {
  status: AssumptionStatus;
  /** true → wymaga przeglądu człowieka (ai_assumed lub niska pewność). */
  needsReview: boolean;
}

/** Próg pewności, poniżej którego sourcowane założenie i tak prosi o przegląd. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

function statusOf(a: Assumption): AssumptionStatus {
  if (isMissingValue(a.value)) return 'missing';
  const t = a.provenance.source_type;
  if (t === 'ai_assumed') return 'assumed';
  if (t === 'user') return 'edited';
  return 'sourced';
}

/**
 * Wylistuj założenia ze statusem i flagą `needsReview` (sortowane po key).
 * needsReview = brak wartości, ai_assumed, albo pewność < progu.
 */
export function listAssumptions(assumptions: readonly Assumption[]): ListedAssumption[] {
  return [...assumptions]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((a) => {
      const status = statusOf(a);
      const conf = a.provenance.confidence;
      const lowConf = typeof conf === 'number' && conf < LOW_CONFIDENCE_THRESHOLD;
      const needsReview = status === 'missing' || status === 'assumed' || lowConf;
      return { ...a, status, needsReview };
    });
}

// ── Audyt pokrycia (gate przed compute/eksportem) ───────────────────────────

export interface CoverageAudit {
  modelType: string;
  requiredCount: number;
  presentCount: number;
  missing: MissingDriver[];
  /** Pokrycie 0..1 (present / required). */
  coverage: number;
  assumedKeys: string[]; // ai_assumed → do przeglądu
  needsReviewKeys: string[];
  /** true gdy wszystkie wymagane drivery mają wartość. */
  complete: boolean;
}

/**
 * Audyt kompletności założeń dla typu modelu — gate przed compute i „stroną założeń"
 * w eksportach (§6 pkt 5). Deterministyczny.
 */
export function auditCoverage(
  modelType: string,
  required: readonly RequiredDriver[],
  provided: readonly Assumption[],
): CoverageAudit {
  const missing = detectMissingDrivers(required, provided);
  const requiredCount = required.filter((r) => !r.optional).length;
  const presentCount = requiredCount - missing.length;
  const listed = listAssumptions(provided);
  const assumedKeys = listed.filter((l) => l.status === 'assumed').map((l) => l.key);
  const needsReviewKeys = listed.filter((l) => l.needsReview).map((l) => l.key);
  return {
    modelType,
    requiredCount,
    presentCount,
    missing,
    coverage: requiredCount === 0 ? 1 : presentCount / requiredCount,
    assumedKeys,
    needsReviewKeys,
    complete: missing.length === 0,
  };
}

// ── Krok 4: diff po edycji (ślad rewizji → recompute delta) ─────────────────

export interface AssumptionChange {
  key: string;
  kind: 'added' | 'removed' | 'value_changed' | 'source_changed';
  label?: string;
  unit?: string;
  from: number | null;
  to: number | null;
  /** Zmiana bezwzględna wartości (to − from) gdy oba liczbowe. */
  deltaAbs?: number;
  /** Zmiana względna (to − from)/|from| gdy from≠0. */
  deltaPct?: number;
  fromSource?: AssumptionSourceType;
  toSource?: AssumptionSourceType;
}

/**
 * Diff dwóch stanów rejestru założeń (before → after) — ślad rewizji do panelu
 * i wejście do „recompute → o ile zmienił się wynik". Sortowany po key.
 * Kolejność wykrywania per klucz: removed / added / value_changed / source_changed.
 */
export function diffAssumptions(
  before: readonly Assumption[],
  after: readonly Assumption[],
): AssumptionChange[] {
  const beforeByKey = new Map<string, Assumption>();
  const afterByKey = new Map<string, Assumption>();
  for (const a of before) beforeByKey.set(a.key, a);
  for (const a of after) afterByKey.set(a.key, a);
  const keys = new Set<string>([...beforeByKey.keys(), ...afterByKey.keys()]);
  const out: AssumptionChange[] = [];

  for (const key of keys) {
    const b = beforeByKey.get(key);
    const a = afterByKey.get(key);
    if (b && !a) {
      out.push({ key, kind: 'removed', label: b.label, unit: b.unit, from: b.value, to: null, fromSource: b.provenance.source_type });
      continue;
    }
    if (!b && a) {
      out.push({ key, kind: 'added', label: a.label, unit: a.unit, from: null, to: a.value, toSource: a.provenance.source_type });
      continue;
    }
    if (!b || !a) continue;
    const valueChanged = (b.value ?? null) !== (a.value ?? null);
    if (valueChanged) {
      const from = b.value ?? null;
      const to = a.value ?? null;
      const change: AssumptionChange = {
        key, kind: 'value_changed', label: a.label ?? b.label, unit: a.unit,
        from, to,
        fromSource: b.provenance.source_type, toSource: a.provenance.source_type,
      };
      if (typeof from === 'number' && typeof to === 'number') {
        change.deltaAbs = to - from;
        change.deltaPct = from !== 0 ? (to - from) / Math.abs(from) : undefined;
      }
      out.push(change);
      continue;
    }
    if (b.provenance.source_type !== a.provenance.source_type) {
      out.push({
        key, kind: 'source_changed', label: a.label ?? b.label, unit: a.unit,
        from: b.value ?? null, to: a.value ?? null,
        fromSource: b.provenance.source_type, toSource: a.provenance.source_type,
      });
    }
  }

  return out.sort((x, y) => x.key.localeCompare(y.key));
}
