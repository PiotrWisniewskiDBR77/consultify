/**
 * V4-ORG-01: Benchmark backend
 * V4-ASMT-01: /compare dla Assessment — optional assessmentId to load scores from assessment
 * GET /api/benchmark/compare — percentiles, cohort size, category comparison
 */
import { Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import industryBenchmarkService from '../services/ai/industryBenchmarkService.js';
import BenchmarkingService from '../services/benchmarkingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

const MIN_COHORT_SIZE = 5;
const DEFAULT_DATASET_VERSION = '2026-r0';

router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Use /api/benchmark/compare for benchmark comparisons',
    availableEndpoints: ['/api/benchmark/compare'],
  });
});

// Map framework category keys to industry benchmark axes (best-effort)
const CATEGORY_TO_AXIS: Record<string, string> = {
  digital_strategy: 'digital_strategy',
  data_analytics: 'data_analytics',
  cybersecurity: 'cybersecurity',
  automation: 'automation',
  digital_culture: 'digital_culture',
  cloud_infrastructure: 'cloud_infrastructure',
  iot_connectivity: 'iot_connectivity',
  supply_chain: 'supply_chain',
  PROCESS: 'automation',
  PRODUCT: 'data_analytics',
  ORGANIZATION: 'digital_culture',
  CONNECTIVITY: 'iot_connectivity',
  DATA: 'data_analytics',
  INTELLIGENCE: 'automation',
  WORKFORCE: 'digital_culture',
};

type BenchmarkDatasetRow = {
  id: string;
  framework: string;
  industry: string;
  region: string | null;
  company_size: string | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  cohort_size: number | null;
  last_updated: string | null;
  version_tag?: string | null;
};

function normalizeCompanySize(size: string): string | null {
  const raw = String(size || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');
  if (!raw) return null;
  if (['SMALL', 'SMB', 'STARTUP'].includes(raw)) return 'SMB';
  if (['MID', 'MID_MARKET', 'MIDMARKET', 'MEDIUM'].includes(raw)) return 'MID_MARKET';
  if (['LARGE', 'ENTERPRISE'].includes(raw)) return 'ENTERPRISE';
  return raw;
}

function normalizeRegion(region: string): string | null {
  const raw = String(region || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  return raw || null;
}

function calculatePercentileFromDataset(score: number, dataset: BenchmarkDatasetRow): number {
  const p25 = Number(dataset.p25 ?? 0);
  const p50 = Number(dataset.p50 ?? 0);
  const p75 = Number(dataset.p75 ?? 0);
  const p90 = Number(dataset.p90 ?? p75);

  if (score <= p25) return 25;
  if (score <= p50) return Math.round(25 + ((score - p25) / Math.max(p50 - p25, 0.01)) * 25);
  if (score <= p75) return Math.round(50 + ((score - p50) / Math.max(p75 - p50, 0.01)) * 25);
  if (score <= p90) return Math.round(75 + ((score - p75) / Math.max(p90 - p75, 0.01)) * 15);
  return 95;
}

router.get(
  '/compare',
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const framework = String(req.query.framework || 'SIRI').toUpperCase();
    let score = parseFloat(String(req.query.score || '0'));
    const industry = String(req.query.industry || 'manufacturing')
      .toLowerCase()
      .replace(/[^a-z_]/g, '_');
    const region = String(req.query.region || '');
    const size = String(req.query.size || '');
    const assessmentId = (req.query.assessmentId as string) || undefined;
    let categories: Record<string, number> = {};
    try {
      const catRaw = req.query.categories;
      if (typeof catRaw === 'string') categories = JSON.parse(catRaw) || {};
    } catch {
      /* ignore */
    }

    // V4-ASMT-01: Load categories from assessment when assessmentId provided
    if (assessmentId && Object.keys(categories).length === 0) {
      const orgId = (req as any).user?.organizationId;
      if (orgId) {
        const row = await queryHelpers.queryOne<{ score_summary?: string | null }>(
          `SELECT score_summary FROM assessments WHERE id = ? AND organization_id = ? LIMIT 1`,
          [assessmentId, orgId]
        );
        if (row?.score_summary) {
          try {
            const ss = JSON.parse(row.score_summary || '{}') as Record<string, any>;
            if (typeof ss.overall?.actual === 'number') {
              score = ss.overall.actual;
              categories = { overall: score };
            } else if (typeof ss === 'object') {
              for (const [k, v] of Object.entries(ss)) {
                const num =
                  typeof v === 'number'
                    ? v
                    : ((v as any)?.actual ?? (v as any)?.score ?? (v as any)?.value);
                if (typeof num === 'number') categories[k] = num;
              }
            }
          } catch {
            /* ignore parse */
          }
        }
      }
    }

    const normalizedIndustry =
      industry === 'manufacturing_discrete' || industry === 'manufacturing_process'
        ? 'manufacturing'
        : industry;
    const normalizedRegion = normalizeRegion(region);
    const normalizedSize = normalizeCompanySize(size);

    const orgScores = Object.entries(categories).map(([k, v]) => ({
      axis: CATEGORY_TO_AXIS[k] || k.toLowerCase().replace(/[^a-z_]/g, '_'),
      score: Number(v),
    }));

    const comparisons = industryBenchmarkService.compareToBenchmarks(normalizedIndustry, orgScores);
    const dataset = await queryHelpers.queryOne<BenchmarkDatasetRow>(
      `SELECT id, framework, industry, region, company_size, p25, p50, p75, p90,
              cohort_size, last_updated, version_tag
       FROM benchmark_datasets
       WHERE framework = ?
         AND industry = ?
         AND (region = ? OR region IS NULL)
         AND (company_size = ? OR company_size IS NULL)
       ORDER BY
         CASE WHEN region = ? THEN 0 ELSE 1 END,
         CASE WHEN company_size = ? THEN 0 ELSE 1 END,
         last_updated DESC
       LIMIT 1`,
      [
        framework,
        normalizedIndustry,
        normalizedRegion,
        normalizedSize,
        normalizedRegion,
        normalizedSize,
      ]
    );

    if (!dataset) {
      try {
        await queryHelpers.run(
          `INSERT OR IGNORE INTO benchmark_datasets (id, framework, industry, region, company_size, p25, p50, p75, p90, cohort_size, last_updated, version_tag)
           VALUES (?, ?, ?, NULL, NULL, 2.0, 3.0, 3.8, 4.2, 0, datetime('now'), ?)`,
          [
            `seed_${framework}_${normalizedIndustry}`,
            framework,
            normalizedIndustry,
            DEFAULT_DATASET_VERSION,
          ]
        );
      } catch {
        /* seed best-effort */
      }

      return res.json({
        percentiles: null,
        cohortSize: 0,
        suppressed: true,
        industry: normalizedIndustry,
        industryName: normalizedIndustry.replace(/_/g, ' '),
        sampleSize: 0,
        lastUpdated: new Date().toISOString(),
        datasetVersion: DEFAULT_DATASET_VERSION,
        percentile: 50,
        percentileLabel: 'Average',
        industryAverage: score,
        gapToAverage: 0,
        categoryComparison: {},
        strengths: [],
        weaknesses: [],
      });
    }

    const cohortSize = Number(dataset.cohort_size || 0);
    const suppressed = cohortSize < MIN_COHORT_SIZE;

    if (suppressed) {
      return res.json({
        percentiles: null,
        cohortSize,
        suppressed: true,
        industry: normalizedIndustry,
        industryName: normalizedIndustry.replace(/_/g, ' '),
        sampleSize: cohortSize,
        lastUpdated: dataset.last_updated || new Date().toISOString(),
        datasetVersion: dataset.version_tag || DEFAULT_DATASET_VERSION,
        percentile: 50,
        percentileLabel: 'Average',
        industryAverage: score,
        gapToAverage: 0,
        categoryComparison: {},
        strengths: [],
        weaknesses: [],
      });
    }

    const percentile = calculatePercentileFromDataset(score, dataset);
    const percentileLabel = BenchmarkingService.getPercentileLabel(percentile);
    const avgOverall = Number(dataset.p50 ?? score);
    const gapToAverage = parseFloat((score - avgOverall).toFixed(2));

    const categoryComparison: Record<
      string,
      { score: number; benchmark: number; gap: number; status: 'above' | 'below' }
    > = {};
    const strengths: Array<{ id: string; gap: number }> = [];
    const weaknesses: Array<{ id: string; gap: number }> = [];

    for (const c of comparisons) {
      const status = c.gap >= 0 ? 'above' : 'below';
      categoryComparison[c.axis] = {
        score: c.orgScore,
        benchmark: c.industryAverage,
        gap: c.gap,
        status,
      };
      if (c.gap > 0) strengths.push({ id: c.axis, gap: c.gap });
      else if (c.gap < 0) weaknesses.push({ id: c.axis, gap: Math.abs(c.gap) });
    }

    res.json({
      percentiles: {
        p25: Number(dataset.p25 ?? avgOverall),
        p50: avgOverall,
        p75: Number(dataset.p75 ?? avgOverall),
        p90: Number(dataset.p90 ?? dataset.p75 ?? avgOverall),
      },
      cohortSize,
      suppressed: false,
      industry: normalizedIndustry,
      industryName: normalizedIndustry.replace(/_/g, ' '),
      sampleSize: cohortSize,
      lastUpdated: dataset.last_updated || new Date().toISOString(),
      datasetVersion: dataset.version_tag || DEFAULT_DATASET_VERSION,
      region: normalizedRegion,
      companySize: normalizedSize,
      percentile: Math.round(percentile),
      percentileLabel,
      industryAverage: parseFloat(avgOverall.toFixed(2)),
      gapToAverage,
      categoryComparison,
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.slice(0, 5),
    });
  })
);

export default router;
