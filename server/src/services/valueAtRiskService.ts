/**
 * valueAtRiskService — Value-at-Risk on Slip (M16/2.7)
 *
 * Pure functions that couple benefit value (M16 Finance) with schedule risk
 * (M14 EVM). The bridge is EVM schedule-health, derived from the Schedule
 * Performance Index (SPI):
 *
 *   scheduleHealth(spi) = min(spi, 1) * 100   // 0..100, capped (SPI>=1 => healthy)
 *
 * Value-at-Risk (VaR) is the portion of a benefit's forecast value that is
 * exposed by an unhealthy schedule:
 *
 *   VaR = forecast * (1 - scheduleHealth(spi) / 100)
 *
 * No DB / no I/O — deterministic, side-effect free, trivially testable.
 */

export type VarLevel = 'low' | 'medium' | 'high' | 'critical';

export interface VarResult {
  /** Absolute benefit value at risk (same unit as forecast). */
  valueAtRisk: number;
  /**
   * Confidence in the forecast given schedule performance, 0..100.
   * Equals schedule-health. `null` when SPI is unknown (no schedule signal).
   */
  confidencePct: number | null;
  level: VarLevel;
}

export interface PortfolioVarItem {
  initiativeId: string;
  benefitForecast: number;
  spi: number | null;
}

export interface PortfolioVarByInitiative extends VarResult {
  initiativeId: string;
  benefitForecast: number;
}

export interface PortfolioVarResult {
  totalForecast: number;
  totalAtRisk: number;
  /** Share of total forecast that is at risk, 0..1. */
  atRiskPct: number;
  byInitiative: PortfolioVarByInitiative[];
}

export interface VarHeatmapCell {
  initiativeId: string;
  /** atRisk / forecast, clamped to 0..1, for heatmap shading. */
  intensity: number;
}

const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

/**
 * EVM schedule-health on a 0..100 scale: SPI*100, capped at 100.
 * SPI >= 1 (on/ahead of schedule) => 100 (fully healthy).
 */
export function scheduleHealth(spi: number): number {
  if (!Number.isFinite(spi)) return 0;
  return clamp(spi, 0, 1) * 100;
}

/**
 * Classify VaR severity by its share of the forecast.
 *   > 0.5  => critical
 *   > 0.25 => high
 *   > 0.1  => medium
 *   else   => low
 */
function classifyLevel(ratio: number): VarLevel {
  if (ratio > 0.5) return 'critical';
  if (ratio > 0.25) return 'high';
  if (ratio > 0.1) return 'medium';
  return 'low';
}

/**
 * Value-at-Risk for a single benefit forecast given its initiative's SPI.
 *
 * When `spi` is `null` (no schedule signal) we cannot estimate exposure:
 * VaR = 0, confidence unknown (`null`), level 'low'.
 */
export function valueAtRisk(
  benefitForecast: number,
  spi: number | null
): VarResult {
  const forecast = Number.isFinite(benefitForecast) ? benefitForecast : 0;

  if (spi === null || spi === undefined || !Number.isFinite(spi)) {
    return { valueAtRisk: 0, confidencePct: null, level: 'low' };
  }

  const health = scheduleHealth(spi);
  const at = forecast * (1 - health / 100);
  const ratio = forecast > 0 ? at / forecast : 0;

  return {
    valueAtRisk: at,
    confidencePct: health,
    level: classifyLevel(ratio),
  };
}

/**
 * Aggregate Value-at-Risk across a portfolio of initiatives.
 */
export function portfolioVaR(items: PortfolioVarItem[]): PortfolioVarResult {
  const list = Array.isArray(items) ? items : [];

  const byInitiative: PortfolioVarByInitiative[] = list.map((item) => {
    const forecast = Number.isFinite(item.benefitForecast)
      ? item.benefitForecast
      : 0;
    const res = valueAtRisk(forecast, item.spi);
    return {
      initiativeId: item.initiativeId,
      benefitForecast: forecast,
      ...res,
    };
  });

  const totalForecast = byInitiative.reduce(
    (sum, i) => sum + i.benefitForecast,
    0
  );
  const totalAtRisk = byInitiative.reduce((sum, i) => sum + i.valueAtRisk, 0);
  const atRiskPct = totalForecast > 0 ? totalAtRisk / totalForecast : 0;

  return { totalForecast, totalAtRisk, atRiskPct, byInitiative };
}

/**
 * Per-initiative heatmap cells: intensity = atRisk / forecast (0..1).
 */
export function varHeatmapCells(items: PortfolioVarItem[]): VarHeatmapCell[] {
  const list = Array.isArray(items) ? items : [];
  return list.map((item) => {
    const forecast = Number.isFinite(item.benefitForecast)
      ? item.benefitForecast
      : 0;
    const { valueAtRisk: at } = valueAtRisk(forecast, item.spi);
    const intensity = forecast > 0 ? clamp(at / forecast, 0, 1) : 0;
    return { initiativeId: item.initiativeId, intensity };
  });
}
