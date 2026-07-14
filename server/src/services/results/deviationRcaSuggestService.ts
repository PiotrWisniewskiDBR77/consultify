/**
 * deviationRcaSuggestService — heurystyczny silnik sugestii RCA + akcji dla
 * odchyleń KPI (M15 Rezultaty). Czysta logika, bez LLM: deterministyczny i
 * w pełni testowalny. Wejście to znormalizowane sygnały (odchylenie, trend,
 * adopcja, świeżość danych, zmiana zakresu, przeciążenie zasobów), a wyjście
 * to posortowane hipotezy przyczyn źródłowych oraz mapowane akcje naprawcze.
 */

export type RcaCategory =
  | 'measurement'
  | 'adoption'
  | 'scope'
  | 'external'
  | 'capacity'
  | 'data-quality';

export interface RcaSuggestInput {
  /** Odchylenie od celu w procentach (np. 0.25 = 25% poniżej/powyżej). */
  deviationPct?: number;
  /** Kierunek trendu wartości KPI w czasie. */
  trend?: 'improving' | 'flat' | 'declining';
  /** Wskaźnik adopcji inicjatywy/rozwiązania (0..1). */
  adoptionScore?: number;
  /** Czy dane pomiarowe są nieaktualne / nieodświeżane. */
  staleData?: boolean;
  /** Czy zakres inicjatywy uległ zmianie. */
  scopeChanged?: boolean;
  /** Czy zespół/zasoby są przeciążone. */
  capacityOverloaded?: boolean;
}

export interface RcaHypothesis {
  category: RcaCategory;
  hypothesis: string;
  /** Pewność hipotezy w zakresie 0..1. */
  confidence: number;
}

export interface RcaAction {
  title: string;
  ownerRole: string;
}

function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Generuje hipotezy przyczyn źródłowych na podstawie sygnałów wejściowych.
 * Każda hipoteza cytuje sygnał, który ją wywołał. Wynik posortowany malejąco
 * po `confidence` (przy remisie zachowuje stabilną kolejność wykrycia).
 */
export function suggestRca(input: RcaSuggestInput): RcaHypothesis[] {
  const hypotheses: RcaHypothesis[] = [];

  const { deviationPct, trend, adoptionScore, staleData, scopeChanged, capacityOverloaded } = input;

  // Nieaktualne dane → najpierw podważamy wiarygodność pomiaru (data-quality).
  if (staleData === true) {
    hypotheses.push({
      category: 'data-quality',
      hypothesis:
        'Dane pomiarowe są nieaktualne (sygnał: staleData=true) — odchylenie może wynikać z nieodświeżonego źródła, a nie z realnej zmiany wyniku.',
      confidence: 0.8,
    });
  }

  // Niska adopcja → inicjatywa nie jest używana (adoption).
  if (typeof adoptionScore === 'number' && adoptionScore < 0.5) {
    // Im niższa adopcja, tym wyższa pewność (0.5→~0.55, 0.0→~0.9).
    const confidence = clampConfidence(0.9 - adoptionScore * 0.7);
    hypotheses.push({
      category: 'adoption',
      hypothesis: `Niska adopcja rozwiązania (sygnał: adoptionScore=${adoptionScore.toFixed(
        2
      )}) — użytkownicy nie stosują inicjatywy, więc efekt nie materializuje się w KPI.`,
      confidence,
    });
  }

  // Zmiana zakresu → cel/baza odniesienia mogą być nieadekwatne (scope).
  if (scopeChanged === true) {
    hypotheses.push({
      category: 'scope',
      hypothesis:
        'Zakres inicjatywy uległ zmianie (sygnał: scopeChanged=true) — pierwotny cel KPI może już nie odzwierciedlać aktualnego zakresu prac.',
      confidence: 0.7,
    });
  }

  // Przeciążenie zasobów → brak mocy przerobowych na realizację (capacity).
  if (capacityOverloaded === true) {
    hypotheses.push({
      category: 'capacity',
      hypothesis:
        'Zespół/zasoby są przeciążone (sygnał: capacityOverloaded=true) — brak mocy przerobowych spowalnia realizację i pogarsza wynik.',
      confidence: 0.65,
    });
  }

  // Istotne odchylenie → kandydat na błędną definicję pomiaru (measurement).
  if (typeof deviationPct === 'number' && Math.abs(deviationPct) >= 0.2) {
    const magnitude = Math.abs(deviationPct);
    // Im większe odchylenie, tym bardziej podejrzana definicja/baza pomiaru.
    const confidence = clampConfidence(0.4 + Math.min(magnitude, 1) * 0.3);
    hypotheses.push({
      category: 'measurement',
      hypothesis: `Znaczące odchylenie od celu (sygnał: deviationPct=${pct(
        deviationPct
      )}) — możliwy błąd w definicji KPI, jednostce lub bazie odniesienia.`,
      confidence,
    });
  }

  // Pogarszający się trend bez wewnętrznych przyczyn → czynnik zewnętrzny.
  if (trend === 'declining') {
    const internalSignal =
      (typeof adoptionScore === 'number' && adoptionScore < 0.5) ||
      scopeChanged === true ||
      capacityOverloaded === true;
    // Gdy brak wewnętrznych wyjaśnień, czynnik zewnętrzny bardziej prawdopodobny.
    const confidence = internalSignal ? 0.4 : 0.6;
    hypotheses.push({
      category: 'external',
      hypothesis:
        'Trend wyniku jest pogarszający (sygnał: trend=declining) — możliwy wpływ czynników zewnętrznych (rynek, otoczenie, założenia).',
      confidence,
    });
  }

  // Sort malejąco po confidence; stabilny przy remisie (zachowaj kolejność wykrycia).
  return hypotheses
    .map((h, index) => ({ h, index }))
    .sort((a, b) => b.h.confidence - a.h.confidence || a.index - b.index)
    .map(({ h }) => h);
}

const CATEGORY_ACTION_MAP: Record<RcaCategory, RcaAction> = {
  adoption: {
    title: 'Wzmocnij komunikację/szkolenia',
    ownerRole: 'Change Manager',
  },
  'data-quality': {
    title: 'Napraw źródło pomiaru',
    ownerRole: 'Data Owner',
  },
  capacity: {
    title: 'Realokuj zasoby',
    ownerRole: 'Resource Manager',
  },
  scope: {
    title: 'Rewaliduj zakres',
    ownerRole: 'Initiative Owner',
  },
  external: {
    title: 'Aktualizuj założenia',
    ownerRole: 'Sponsor',
  },
  measurement: {
    title: 'Zweryfikuj definicję KPI',
    ownerRole: 'KPI Owner',
  },
};

/**
 * Mapuje kategorie RCA na konkretne akcje naprawcze (kategoria → akcja).
 * Deduplikuje po kategorii zachowując kolejność pierwszego wystąpienia.
 */
export function suggestActions(rca: Array<{ category: RcaCategory }>): RcaAction[] {
  const seen = new Set<RcaCategory>();
  const actions: RcaAction[] = [];

  for (const { category } of rca) {
    if (seen.has(category)) continue;
    const action = CATEGORY_ACTION_MAP[category];
    if (!action) continue;
    seen.add(category);
    actions.push(action);
  }

  return actions;
}

export default { suggestRca, suggestActions };
