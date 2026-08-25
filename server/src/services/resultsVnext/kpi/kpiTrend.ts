import { evaluatePerformanceStatus } from './targetGeometryEvaluator.js';
import type { KpiDefinitionVersion, KpiMeasurement } from './kpiTypes.js';

export type KpiTrendDirection = 'IMPROVING' | 'WORSENING' | 'FLAT';

function distance(version: KpiDefinitionVersion, value: number): number {
  switch (version.targetGeometry) {
    case 'threshold_min':
      return version.targetValue === null ? 0 : Math.max(0, version.targetValue - value);
    case 'threshold_max':
      return version.targetValue === null ? 0 : Math.max(0, value - version.targetValue);
    case 'range':
      if (version.targetMin === null || version.targetMax === null) return 0;
      return value < version.targetMin
        ? version.targetMin - value
        : value > version.targetMax
          ? value - version.targetMax
          : 0;
    case 'exact':
      return version.targetValue === null ? 0 : Math.abs(value - version.targetValue);
    default:
      return 0;
  }
}

export function buildKpiTrend(params: {
  kpiId: string;
  version: KpiDefinitionVersion;
  measurements: KpiMeasurement[];
  calculatedAt?: string;
}) {
  const points = [...params.measurements]
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
    .map((measurement) => ({
      periodStart: measurement.periodStart,
      periodEnd: measurement.periodEnd,
      actualValue: measurement.actualValue,
      performanceStatus: evaluatePerformanceStatus({
        geometry: params.version.targetGeometry,
        actualValue: measurement.actualValue,
        targetValue: params.version.targetValue,
        targetMin: params.version.targetMin,
        targetMax: params.version.targetMax,
        warningLow: params.version.warningLow,
        warningHigh: params.version.warningHigh,
        criticalLow: params.version.criticalLow,
        criticalHigh: params.version.criticalHigh,
        binarySuccessValue: params.version.binarySuccessValue,
      }),
      dataQualityStatus: measurement.dataQualityStatus,
      measurementId: measurement.measurementId,
    }));
  const numeric = points.filter(
    (point): point is typeof point & { actualValue: number } => point.actualValue !== null
  );
  let direction: KpiTrendDirection | null = null;
  let directionReason: 'UNKNOWN' | 'INSUFFICIENT_DATA' | null = null;
  if (params.version.targetGeometry === 'binary' || params.version.targetGeometry === 'custom')
    directionReason = 'UNKNOWN';
  else if (numeric.length < 2) directionReason = 'INSUFFICIENT_DATA';
  else {
    const previous = numeric[numeric.length - 2];
    const latest = numeric[numeric.length - 1];
    const change =
      distance(params.version, latest.actualValue) - distance(params.version, previous.actualValue);
    direction = change < 0 ? 'IMPROVING' : change > 0 ? 'WORSENING' : 'FLAT';
  }
  const previous = numeric.length >= 2 ? numeric[numeric.length - 2] : null;
  const latest = numeric.length >= 2 ? numeric[numeric.length - 1] : null;
  const deltaAbsolute = previous && latest ? latest.actualValue - previous.actualValue : null;
  return {
    kpiId: params.kpiId,
    definitionVersionId: params.version.definitionVersionId,
    unit: params.version.unit,
    points,
    direction,
    directionReason,
    deltaAbsolute,
    deltaRelative:
      previous && latest && previous.actualValue !== 0
        ? deltaAbsolute! / Math.abs(previous.actualValue)
        : null,
    comparedAgainst: previous
      ? { periodStart: previous.periodStart, periodEnd: previous.periodEnd }
      : null,
    calculatedAt: params.calculatedAt ?? new Date().toISOString(),
    sourceVersion: params.version.rowVersion,
  };
}
