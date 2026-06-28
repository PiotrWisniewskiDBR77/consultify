/**
 * DRD Visualization Adapter
 *
 * Bridges the DRD (Digital Readiness Diagnosis) domain structure to the shared
 * assessment visualization layer (AssessmentReportVisualizations).
 *
 * Maps each of the 7 DRD axes to a DimensionScore, honouring per-axis scales
 * (levelCount = 5, 6 or 7) via maxLevel. Colours are a calm blue/teal/slate
 * palette — deliberately NOT crimson (app `primary` = crimson).
 */

import type { AssessmentVisualizationData } from '../components/assessment/reports/AssessmentReportVisualizations';
import DRD_STRUCTURE, {
  calculateAxisScore,
  calculateOverallScore,
  getTotalAreaCount,
} from './drdStructure';

/**
 * Calm, low-saturation palette per axis (blue / teal / slate family).
 * Index aligns with DRD_STRUCTURE order (axes 1..7).
 */
const DRD_AXIS_COLORS: string[] = [
  '#3b82f6', // blue-500   — Digital Processes
  '#0ea5e9', // sky-500    — Digital Products
  '#06b6d4', // cyan-500   — Digital Business Models
  '#14b8a6', // teal-500   — Data Management
  '#0d9488', // teal-600   — Culture of Transformation
  '#64748b', // slate-500  — Cybersecurity
  '#475569', // slate-600  — AI Maturity
];

/**
 * Build the shared visualization payload for a DRD assessment.
 *
 * @param areaScores per-area actual/target levels keyed by area id (e.g. "1A")
 */
export const buildDRDVisualizationData = (
  areaScores: Record<string, { actual: number; target: number }>
): AssessmentVisualizationData => {
  const dimensions = DRD_STRUCTURE.map((axis, index) => {
    const { actual, target } = calculateAxisScore(axis.id, areaScores);
    return {
      id: String(axis.id),
      name: axis.name,
      namePL: axis.namePL,
      current: actual,
      target,
      maxLevel: axis.levelCount,
      color: DRD_AXIS_COLORS[index % DRD_AXIS_COLORS.length],
    };
  });

  const overall = calculateOverallScore(areaScores);

  const totalAreas = getTotalAreaCount();
  const assessedAreas = Object.values(areaScores).filter(
    (s) => s && (s.actual > 0 || s.target > 0)
  ).length;
  const completionPercent =
    totalAreas > 0 ? Math.round((assessedAreas / totalAreas) * 100) : 0;

  return {
    framework: 'DRD',
    dimensions,
    overallScore: overall.actual,
    targetScore: overall.target,
    completionPercent,
  };
};

export default buildDRDVisualizationData;
