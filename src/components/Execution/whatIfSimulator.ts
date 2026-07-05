/**
 * whatIfSimulator — deterministyczny silnik what-if (dry-run interwencji) dla M14/ExecutionHub.
 *
 * Czysty moduł TypeScript bez Reacta i bez zależności runtime. Liczy projekcję
 * metryk portfela po zastosowaniu zestawu interwencji (dry-run), zwraca delty
 * względem baseline'u oraz czytelne wyjaśnienia. Heurystyki są DETERMINISTYCZNE —
 * ten sam wejściowy zestaw zawsze daje identyczny wynik (brak losowości, brak czasu).
 */

/** Metryki bazowe portfela (snapshot zdrowia). */
export interface PortfolioMetrics {
  /** Zdrowie portfela 0–100. */
  healthScore: number;
  /** Schedule Performance Index (≈1.0 = na czas). */
  spi?: number | null;
  /** Cost Performance Index (≈1.0 = w budżecie). */
  cpi?: number | null;
  /** Wykorzystanie zespołu w % (100 = pełne, >100 = przeciążenie). */
  capacityUtilizationPct?: number;
  /** Liczba otwartych ryzyk wysokich. */
  openHighRisks?: number;
}

/**
 * Pojedyncza interwencja (dry-run).
 * `magnitude` interpretowane zależnie od typu:
 *  - add_resource     → liczba FTE,
 *  - descope          → liczba zakresów/jednostek pracy zdjętych,
 *  - extend_deadline  → liczba dni wydłużenia,
 *  - mitigate_risk    → liczba ryzyk do zamknięcia,
 *  - reprioritize     → siła repriorytetyzacji (jednostka umowna).
 */
export interface Intervention {
  type: 'add_resource' | 'descope' | 'extend_deadline' | 'mitigate_risk' | 'reprioritize';
  magnitude?: number;
}

export interface WhatIfResult {
  projected: PortfolioMetrics;
  deltas: Record<string, number>;
  explanation: string[];
}

export interface ScenarioInput {
  label: string;
  interventions: Intervention[];
}

export interface ScenarioComparison {
  label: string;
  projected: PortfolioMetrics;
  healthDelta: number;
}

// ── Pomocnicze: clampy w domenach metryk ──────────────────────────────────────

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clampHealth = (value: number): number => clamp(value, 0, 100);
const clampIndex = (value: number): number => clamp(value, 0, 2); // spi / cpi
const clampUtil = (value: number): number => clamp(value, 0, 200);

/** Domyślna magnitude (1) gdy nie podano lub wartość niepoprawna. */
const mag = (intervention: Intervention): number => {
  const m = intervention.magnitude;
  return typeof m === 'number' && Number.isFinite(m) ? m : 1;
};

/** Bezpieczny odczyt liczby z możliwie undefined/null pola metryki. */
const num = (value: number | null | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Wewnętrzny, w pełni określony stan roboczy. spi/cpi mogą być nieznane w
 * baseline — wtedy traktujemy je jako "brak danych" i nie projektujemy (zostają
 * null), by nie wymyślać metryk, których portfel nie raportuje.
 */
interface WorkingState {
  healthScore: number;
  spi: number | null;
  cpi: number | null;
  capacityUtilizationPct: number;
  openHighRisks: number;
}

/** Nudge spi ku 1.0 o zadany krok (nie przeskakując celu). */
const nudgeTowardsOnTrack = (spi: number, step: number): number => {
  if (spi >= 1) {
    return spi; // już ≥ na czas — wydłużenie/akcja nie pogarsza
  }
  return Math.min(1, spi + Math.abs(step));
};

/**
 * Symuluje zestaw interwencji (dry-run) na metrykach bazowych.
 * Deterministyczne — kolejność interwencji w `explanation` zachowana, wynik
 * niezależny od czasu/losowości.
 */
export function simulateWhatIf(
  baseline: PortfolioMetrics,
  interventions: Intervention[]
): WhatIfResult {
  const baseHealth = clampHealth(num(baseline.healthScore, 0));
  const baseSpi = baseline.spi === null || baseline.spi === undefined ? null : clampIndex(baseline.spi);
  const baseCpi = baseline.cpi === null || baseline.cpi === undefined ? null : clampIndex(baseline.cpi);
  const baseUtil = clampUtil(num(baseline.capacityUtilizationPct, 0));
  const baseRisks = Math.max(0, Math.round(num(baseline.openHighRisks, 0)));

  const state: WorkingState = {
    healthScore: baseHealth,
    spi: baseSpi,
    cpi: baseCpi,
    capacityUtilizationPct: baseUtil,
    openHighRisks: baseRisks,
  };

  const explanation: string[] = [];

  for (const intervention of interventions ?? []) {
    const m = mag(intervention);
    switch (intervention.type) {
      case 'add_resource': {
        // Więcej FTE → spada przeciążenie (~8 pkt/FTE), lekki wzrost tempa (spi).
        const utilDrop = m * 8;
        state.capacityUtilizationPct = clampUtil(state.capacityUtilizationPct - utilDrop);
        if (state.spi !== null) {
          state.spi = clampIndex(nudgeTowardsOnTrack(state.spi, m * 0.03));
        }
        state.healthScore = clampHealth(state.healthScore + m * 1.5);
        explanation.push(
          `add_resource (+${m} FTE): wykorzystanie zespołu spada o ~${utilDrop} pkt, SPI rośnie lekko ku 1.0, healthScore +${m * 1.5}.`
        );
        break;
      }
      case 'descope': {
        // Mniej zakresu → łatwiej dowieźć: spi i health rosną, lżejsze obciążenie.
        if (state.spi !== null) {
          state.spi = clampIndex(state.spi + m * 0.05);
        }
        state.healthScore = clampHealth(state.healthScore + m * 4);
        state.capacityUtilizationPct = clampUtil(state.capacityUtilizationPct - m * 3);
        explanation.push(
          `descope (-${m} zakres): SPI rośnie (+${m * 0.05}), healthScore +${m * 4}, wykorzystanie maleje o ~${m * 3} pkt.`
        );
        break;
      }
      case 'extend_deadline': {
        // Wydłużenie terminu → mniej slipu/late, spi dryfuje ku 1.0.
        if (state.spi !== null) {
          state.spi = clampIndex(nudgeTowardsOnTrack(state.spi, m * 0.01));
        }
        state.healthScore = clampHealth(state.healthScore + Math.min(5, m * 0.2));
        explanation.push(
          `extend_deadline (+${m} dni): poślizg (slip/late) maleje, SPI dryfuje ku 1.0, healthScore lekko rośnie.`
        );
        break;
      }
      case 'mitigate_risk': {
        // Zamknięcie ryzyk wysokich → openHighRisks maleje (≥0), health rośnie.
        const before = state.openHighRisks;
        state.openHighRisks = Math.max(0, before - Math.round(m));
        const closed = before - state.openHighRisks;
        state.healthScore = clampHealth(state.healthScore + closed * 3);
        explanation.push(
          `mitigate_risk (-${m} ryzyk): otwarte ryzyka wysokie ${before} → ${state.openHighRisks}, healthScore +${closed * 3}.`
        );
        break;
      }
      case 'reprioritize': {
        // Repriorytetyzacja — neutralna kosztowo (cpi bez zmian), lekki zysk spi.
        if (state.spi !== null) {
          state.spi = clampIndex(nudgeTowardsOnTrack(state.spi, m * 0.02));
        }
        state.healthScore = clampHealth(state.healthScore + m * 0.5);
        explanation.push(
          `reprioritize (×${m}): koszt (CPI) bez zmian, SPI lekko rośnie ku 1.0, healthScore +${m * 0.5}.`
        );
        break;
      }
      default: {
        explanation.push(`nieznana interwencja "${String((intervention as { type?: unknown }).type)}": pominięta.`);
        break;
      }
    }
  }

  const projected: PortfolioMetrics = {
    healthScore: round2(state.healthScore),
    spi: state.spi === null ? state.spi : round2(state.spi),
    cpi: state.cpi === null ? state.cpi : round2(state.cpi),
    capacityUtilizationPct: round2(state.capacityUtilizationPct),
    openHighRisks: state.openHighRisks,
  };

  const deltas: Record<string, number> = {
    healthScore: round2(projected.healthScore - baseHealth),
    capacityUtilizationPct: round2((projected.capacityUtilizationPct ?? 0) - baseUtil),
    openHighRisks: (projected.openHighRisks ?? 0) - baseRisks,
  };
  if (baseSpi !== null && projected.spi !== null && projected.spi !== undefined) {
    deltas.spi = round2(projected.spi - baseSpi);
  }
  if (baseCpi !== null && projected.cpi !== null && projected.cpi !== undefined) {
    deltas.cpi = round2(projected.cpi - baseCpi);
  }

  return { projected, deltas, explanation };
}

/**
 * Porównuje scenariusze (każdy = zestaw interwencji) względem wspólnego
 * baseline'u. Zwraca listę posortowaną MALEJĄCO po `healthDelta`
 * (najlepszy scenariusz na górze). Sort jest stabilny przy remisach.
 */
export function compareScenarios(
  baseline: PortfolioMetrics,
  scenarios: ScenarioInput[]
): ScenarioComparison[] {
  const baseHealth = clampHealth(num(baseline.healthScore, 0));

  return (scenarios ?? [])
    .map((scenario, index) => {
      const { projected } = simulateWhatIf(baseline, scenario.interventions);
      return {
        label: scenario.label,
        projected,
        healthDelta: round2(projected.healthScore - baseHealth),
        index,
      };
    })
    .sort((a, b) => (b.healthDelta - a.healthDelta) || (a.index - b.index))
    .map(({ label, projected, healthDelta }) => ({ label, projected, healthDelta }));
}
