/**
 * V4-ORG-01: Benchmark backend
 * V4-ASMT-01: /compare dla Assessment — optional assessmentId to load scores from assessment
 * GET /api/benchmark/compare — percentiles, cohort size, category comparison
 */
import { Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import industryBenchmarkService from '../services/ai/industryBenchmarkService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import BenchmarkingService from '../services/benchmarkingService.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

const MIN_COHORT_SIZE = 5;

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

router.get(
  '/compare',
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const framework = String(req.query.framework || 'SIRI').toUpperCase();
    let score = parseFloat(String(req.query.score || '0'));
    const industry = String(req.query.industry || 'manufacturing').toLowerCase().replace(/[^a-z_]/g, '_');
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
                const num = typeof v === 'number' ? v : (v as any)?.actual ?? (v as any)?.score ?? (v as any)?.value;
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
      industry === 'manufacturing_discrete' || industry === 'manufacturing_process' ? 'manufacturing' : industry;

    const orgScores = Object.entries(categories).map(([k, v]) => ({
      axis: CATEGORY_TO_AXIS[k] || k.toLowerCase().replace(/[^a-z_]/g, '_'),
      score: Number(v),
    }));

    const comparisons = industryBenchmarkService.compareToBenchmarks(normalizedIndustry, orgScores);

    const cohortSize = 50;
    const suppressed = cohortSize < MIN_COHORT_SIZE;

    if (suppressed) {
      return res.json({
        percentiles: null,
        cohortSize,
        suppressed: true,
        industry: normalizedIndustry,
        industryName: normalizedIndustry.replace(/_/g, ' '),
        sampleSize: cohortSize,
        lastUpdated: new Date().toISOString().slice(0, 10),
        percentile: 50,
        percentileLabel: 'Average',
        industryAverage: score,
        gapToAverage: 0,
        categoryComparison: {},
        strengths: [],
        weaknesses: [],
      });
    }

    const { percentile, ranking } = BenchmarkingService.calculatePercentileSync(score, { overall: score * 0.95 });
    const percentileLabel = BenchmarkingService.getPercentileLabel(percentile);

    const industryData = industryBenchmarkService.getBenchmarks(normalizedIndustry);
    const avgOverall =
      industryData.length > 0
        ? industryData.reduce((s, d) => s + (d.average || 0), 0) / industryData.length
        : score;
    const gapToAverage = parseFloat((score - avgOverall).toFixed(2));

    const categoryComparison: Record<string, { score: number; benchmark: number; gap: number; status: 'above' | 'below' }> = {};
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
      percentiles: { p25: avgOverall - 0.5, p50: avgOverall, p75: avgOverall + 0.5 },
      cohortSize,
      suppressed: false,
      industry: normalizedIndustry,
      industryName: normalizedIndustry.replace(/_/g, ' '),
      sampleSize: cohortSize,
      lastUpdated: new Date().toISOString().slice(0, 10),
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
