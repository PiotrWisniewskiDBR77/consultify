/**
 * V8 Advisory API — business case generation (Oxford O4 wiring).
 *
 * Thin typed client for `POST /api/v8/advisory/business-case`
 * (server/src/routes/v8/advisory.routes.ts), which runs
 * BusinessCaseService's 5-phase pipeline (PLAN → CONFIRM → MODEL → REVIEW →
 * NARRATIVE) SYNCHRONOUSLY server-side and returns the full result in one
 * response — there is no client-driven phase dialog. Types mirror the
 * server's BusinessCaseGenerationResult 1:1 (see
 * server/src/services/advisory/BusinessCaseService.ts and
 * businessCaseModel.ts) so the UI never has to guess a shape.
 */

import { v8Post } from './client';

export type BusinessCaseSizeBand = 'micro' | 'small' | 'mid' | 'large' | 'enterprise';
export type BusinessCaseLanguage = 'pl' | 'en';

export interface BusinessCaseGenerateParams {
  /** Free-text description of the decision/investment. Required. */
  prompt: string;
  horizonYears?: number;
  waccPct?: number;
  currency?: string;
  language?: BusinessCaseLanguage;
  industrySegment?: string;
  sizeBand?: BusinessCaseSizeBand;
  projectId?: string;
}

export interface BusinessCaseValueDriver {
  key: string;
  label: string;
  role: 'benefit' | 'cost' | 'capex';
  annualAmount: number;
  rampPct?: number[];
  rationale?: string;
}

export interface BusinessCaseScenarioDef {
  key: string;
  name: string;
  driverKey: string;
  multiplier: number;
  rationale?: string;
}

export interface BusinessCasePlan {
  problem: string;
  options: Array<{ id: string; name: string; description: string }>;
  drivers: BusinessCaseValueDriver[];
  scenarios: BusinessCaseScenarioDef[];
  horizonYears: number;
  waccPct: number;
  currency: string;
}

export interface BusinessCaseScenarioResult {
  key: string;
  name: string;
  driverKey: string | null;
  multiplier: number;
  cashflows: number[];
  npv: number;
  irrPct: number | null;
  paybackYears: number | null;
  roiPct: number;
  totalInvestment: number;
  totalNominalBenefit: number;
}

export interface BusinessCaseModelResult {
  waccPct: number;
  horizonYears: number;
  currency: string;
  base: BusinessCaseScenarioResult;
  scenarios: BusinessCaseScenarioResult[];
  worstCase: BusinessCaseScenarioResult | null;
  bestCase: BusinessCaseScenarioResult | null;
}

export interface BusinessCaseWaccGuidanceBand {
  low: number;
  mid: number;
  high: number;
}

export interface BusinessCaseWaccResolution {
  waccPct: number;
  source: 'client' | 'industry-guidance';
  guidance: {
    recommendedWaccPct: number;
    waccBand: BusinessCaseWaccGuidanceBand;
    label: { pl: string; en: string };
  };
  grade: {
    verdict: 'below-band' | 'in-band' | 'above-band';
    distancePp: number;
    note: { pl: string; en: string };
  };
}

export interface BusinessCasePipelinePhaseLog {
  phase: 'plan' | 'confirm' | 'model' | 'review' | 'narrative';
  status: 'ok' | 'warning' | 'failed' | 'skipped';
  durationMs: number;
  detail?: string;
}

export interface BusinessCaseNarrativeCheck {
  consistent: boolean;
  unverifiedNumbers: string[];
}

export interface BusinessCaseGenerationResult {
  id: string;
  plan: BusinessCasePlan;
  model: BusinessCaseModelResult;
  narrative: string;
  narrativeCheck: BusinessCaseNarrativeCheck;
  llmReviewIssues: Array<{ severity: 'critical' | 'minor'; description: string }>;
  pipelineLog: BusinessCasePipelinePhaseLog[];
  waccResolution: BusinessCaseWaccResolution;
  generatedAt: string;
}

// The pipeline runs 3-4 sequential LLM calls server-side (PLAN, CONFIRM,
// NARRATIVE, REVIEW, +1 possible NARRATIVE retry) — comfortably over the
// baseClient 20s default hard timeout under real model latency.
const BUSINESS_CASE_TIMEOUT_MS = 120_000;

export async function generateBusinessCase(
  params: BusinessCaseGenerateParams
): Promise<BusinessCaseGenerationResult> {
  return v8Post<BusinessCaseGenerationResult>('/advisory/business-case', params, {
    timeoutMs: BUSINESS_CASE_TIMEOUT_MS,
  });
}
