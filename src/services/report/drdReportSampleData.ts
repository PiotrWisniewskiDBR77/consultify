/**
 * DRD Report — sample seed scores (for the sample deliverable & tests).
 *
 * Realistic per-area actual/target levels for a mid-maturity manufacturer,
 * honoring each axis's native scale (axes 1 & 4 = 1–7, others = 1–5).
 * Loosely aligned with the narrative sample in
 * `data/sample-reports/drd-full-diagnostic-report.md` (TechProd Manufacturing).
 *
 * This is SEED input only; it feeds the engine, which computes all report numbers.
 */

import type { AreaScores } from './drdReportModel';

export const SAMPLE_DRD_SCORES: AreaScores = {
  // Axis 1 — Digital Processes (1–7)
  '1A': { actual: 5, target: 6 },
  '1B': { actual: 4, target: 6 },
  '1C': { actual: 5, target: 6 },
  '1D': { actual: 4, target: 5 },
  '1E': { actual: 3, target: 6 },
  '1F': { actual: 5, target: 6 },
  '1G': { actual: 4, target: 5 },
  '1H': { actual: 5, target: 6 },
  '1I': { actual: 3, target: 5 },
  // Axis 2 — Digital Products (1–5)
  '2A': { actual: 3, target: 4 },
  '2B': { actual: 2, target: 4 },
  '2C': { actual: 4, target: 5 },
  '2D': { actual: 3, target: 4 },
  '2E': { actual: 3, target: 5 },
  // Axis 3 — Digital Business Models (1–5)
  '3A': { actual: 3, target: 4 },
  '3B': { actual: 2, target: 4 },
  '3C': { actual: 2, target: 4 },
  '3D': { actual: 2, target: 4 },
  '3E': { actual: 3, target: 5 },
  // Axis 4 — Data Management (1–7)
  '4A': { actual: 5, target: 6 },
  '4B': { actual: 4, target: 6 },
  '4C': { actual: 4, target: 6 },
  '4D': { actual: 3, target: 6 },
  '4E': { actual: 4, target: 5 },
  // Axis 5 — Culture of Transformation (1–5)
  '5A': { actual: 4, target: 5 },
  '5B': { actual: 4, target: 5 },
  '5C': { actual: 3, target: 4 },
  '5D': { actual: 3, target: 5 },
  '5E': { actual: 4, target: 5 },
  // Axis 6 — Cybersecurity (1–5)
  '6A': { actual: 3, target: 4 },
  '6B': { actual: 4, target: 5 },
  '6C': { actual: 4, target: 5 },
  '6D': { actual: 3, target: 4 },
  '6E': { actual: 3, target: 5 },
  // Axis 7 — AI Maturity (1–5)
  '7A': { actual: 2, target: 4 },
  '7B': { actual: 2, target: 4 },
  '7C': { actual: 2, target: 4 },
  '7D': { actual: 1, target: 4 },
  '7E': { actual: 3, target: 4 },
};

export const SAMPLE_DRD_META = {
  organizationName: 'TechProd Manufacturing Sp. z o.o.',
  language: 'pl' as const,
  assessmentName: 'Diagnoza Dojrzałości Cyfrowej 2026',
  benchmark: { label: 'Benchmark branżowy (PL)', value: 46 },
};
