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

import DRD_STRUCTURE, {
  calculateAxisScore,
  calculateOverallScore,
  DRD_AXIS_KEY_MAP,
  getTotalAreaCount,
} from '../../data/drdStructure.js';
import { hasAssessmentResponse } from './assessmentCompleteness.js';

/**
 * Local, server-side mirror of the FE `AssessmentVisualizationData` shape
 * (src/components/assessment/reports/AssessmentReportVisualizations.tsx). Inlined
 * so the server report generator never imports a browser component. Kept minimal:
 * only the fields the DRD report model consumes.
 */
interface DimensionScore {
  id: string;
  name: string;
  namePL?: string;
  current: number;
  target: number;
  maxLevel: number;
  color: string;
}
interface AssessmentVisualizationData {
  framework: string;
  dimensions: DimensionScore[];
  overallScore: number;
  targetScore: number;
  completionPercent: number;
}

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
  const assessedAreas = Object.values(areaScores).filter(hasAssessmentResponse).length;
  const completionPercent = totalAreas > 0 ? Math.round((assessedAreas / totalAreas) * 100) : 0;

  return {
    framework: 'DRD',
    dimensions,
    overallScore: overall.actual,
    targetScore: overall.target,
    completionPercent,
  };
};

/**
 * Build the shared visualization payload from AXIS-LEVEL scores.
 *
 * Keyed by the internal axis key (processes | digitalProducts | businessModels |
 * dataManagement | culture | cybersecurity | aiMaturity — see DRD_AXIS_KEY_MAP).
 * Used by the report editor, whose `axisData` is stored per-axis (already
 * aggregated), not per-area. Honours per-axis maxLevel (mixed scales 5/6/7).
 */
export const buildDRDVisualizationDataFromAxes = (
  axisData: Record<string, { actual?: number; target?: number }>
): AssessmentVisualizationData => {
  const dimensions = DRD_STRUCTURE.map((axis, index) => {
    const key = DRD_AXIS_KEY_MAP[axis.id];
    const entry = (key && axisData[key]) || {};
    return {
      id: String(axis.id),
      name: axis.name,
      namePL: axis.namePL,
      current: Number(entry.actual ?? 0),
      target: Number(entry.target ?? 0),
      maxLevel: axis.levelCount,
      color: DRD_AXIS_COLORS[index % DRD_AXIS_COLORS.length],
    };
  });

  const avg = (nums: number[]) =>
    nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0;
  const assessed = dimensions.filter(hasAssessmentResponse).length;

  return {
    framework: 'DRD',
    dimensions,
    overallScore: avg(dimensions.map((d) => d.current)),
    targetScore: avg(dimensions.map((d) => d.target)),
    completionPercent: dimensions.length ? Math.round((assessed / dimensions.length) * 100) : 0,
  };
};

export default buildDRDVisualizationData;
