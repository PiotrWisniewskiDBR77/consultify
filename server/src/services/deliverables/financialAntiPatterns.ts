/**
 * financialAntiPatterns — W12.1 (warstwa finansowa): detektory wzorców na
 * WYLICZONEJ trajektorii modelu (nie na surowych driverach jak validateAssumptions).
 *
 * Domyka zadeklarowane-ale-nieemitowane patterny z `AntiPatternFinding`:
 *   • hockey_stick_no_driver — przychód przyspiesza nierealistycznie YoY bez
 *     proporcjonalnej zmiany drivera (klasyczny „kij hokejowy" pitch decku).
 *
 * UWAGA (uczciwość): `hidden_circularity` NIE jest tu wykrywany — wymaga grafu
 * zależności założeń (które wejście liczy które wyjście). Bez niego każdy detektor
 * byłby zgadywaniem → świadomie pominięty do czasu zbudowania grafu (zero fałszywych
 * detektorów). Patrz [[project_business_plan_generator]].
 *
 * Deterministyczne, fail-soft (pusta/krótka trajektoria → brak findingów).
 */

import type { AntiPatternFinding, PnLPeriod } from './businessPlanSpine.js';

// Progi „kija hokejowego":
const HOCKEY_MIN_PERIODS = 3; // potrzeba ≥3 okresów by ocenić przyspieszenie
const HOCKEY_GROWTH_MULTIPLE = 2.5; // skok przychodu ≥2.5× w jednym roku…
const HOCKEY_ACCEL_RATIO = 2.0; // …i ≥2× szybszy niż wzrost w roku poprzednim
const HOCKEY_LATE_SHARE = 0.6; // ≥60% całego wzrostu skumulowane w ostatnim okresie

/**
 * Wykrywa „kij hokejowy" na trajektorii przychodu: nagłe, nieproporcjonalne
 * przyspieszenie w późnym okresie. Zwraca 0..1 findingów (flag, nie reject —
 * to sygnał do uzasadnienia driverem, nie twardy błąd).
 */
export function detectHockeyStick(pnl: PnLPeriod[]): AntiPatternFinding[] {
  if (!Array.isArray(pnl) || pnl.length < HOCKEY_MIN_PERIODS) return [];

  const rev = pnl.map((p) => Math.max(0, p?.revenue ?? 0));
  // YoY growth rate per okres (od 2. okresu). g[i] = rev[i]/rev[i-1] - 1
  const growth: number[] = [];
  for (let i = 1; i < rev.length; i++) {
    const prev = rev[i - 1];
    growth.push(prev > 0 ? rev[i] / prev - 1 : 0);
  }
  if (growth.length < 2) return [];

  const lastGrowth = growth[growth.length - 1];
  const prevGrowth = growth[growth.length - 2];

  // skok ostatniego okresu jako wielokrotność (1+g)
  const lastMultiple = 1 + lastGrowth;

  // udział ostatniego przyrostu w całkowitym wzroście od pierwszego okresu
  const totalGain = rev[rev.length - 1] - rev[0];
  const lastGain = rev[rev.length - 1] - rev[rev.length - 2];
  const lateShare = totalGain > 0 ? lastGain / totalGain : 0;

  const acceleratesVsPrev = prevGrowth > 0
    ? lastGrowth >= prevGrowth * HOCKEY_ACCEL_RATIO
    : lastGrowth > 0; // z ~0 wzrostu na dodatni = też przyspieszenie

  const bigJump = lastMultiple >= HOCKEY_GROWTH_MULTIPLE;
  const backloaded = lateShare >= HOCKEY_LATE_SHARE;

  if (bigJump && acceleratesVsPrev && backloaded) {
    const pct = Math.round(lastGrowth * 100);
    const sharePct = Math.round(lateShare * 100);
    return [{
      pattern: 'hockey_stick_no_driver',
      severity: 'flag',
      detail: `Przychód skacze +${pct}% w ostatnim roku (${sharePct}% całego wzrostu skumulowane na końcu) — „kij hokejowy" bez proporcjonalnej zmiany drivera; uzasadnij konkretnym mechanizmem.`,
      ref: 'financials.pnl.revenue',
    }];
  }
  return [];
}

/**
 * Wszystkie finansowe anti-patterny na trajektorii (rozszerzalne).
 * Obecnie: hockey-stick. (one_percent/false_precision/cac są w validateAssumptions.)
 */
export function detectFinancialAntiPatterns(pnl: PnLPeriod[]): AntiPatternFinding[] {
  return [...detectHockeyStick(pnl)];
}
