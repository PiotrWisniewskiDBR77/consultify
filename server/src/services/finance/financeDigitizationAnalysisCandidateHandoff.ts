import type { PinnedTransactionClient } from '../../database/PostgresDatabase.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import type {
  FinanceCandidateFields,
  FinanceCandidatePreviewResult,
  FinanceSourceResolution,
} from './financeCandidateHandoffCore.js';
import {
  computeSourceFingerprint,
  confirmFinanceCandidateHandoff,
  emptySourceSnapshot,
  getFinanceCandidateHandoff,
  previewFinanceCandidateHandoff,
  unknownIfMissing,
} from './financeCandidateHandoffCore.js';

export const FINANCE_DIGITIZATION_ANALYSIS_SOURCE_TYPE = 'finance_digitization_analysis' as const;

interface DigitizationAnalysisCandidateSource {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  analysis_type: string | null;
  archive_version: number;
  archived_at: string | Date | null;
  currency: string | null;
  initial_investment: number | null;
  implementation_cost: number | null;
  training_cost: number | null;
  annual_operating_cost: number | null;
  npv: number | null;
  irr: number | null;
  roi_percent: number | null;
  payback_months: number | null;
}

async function resolveEligibleDigitizationAnalysis(
  organizationId: string,
  analysisId: string
): Promise<FinanceSourceResolution<DigitizationAnalysisCandidateSource>> {
  const source = await queryHelpers.queryOne<DigitizationAnalysisCandidateSource>(
    `SELECT da.id,da.name,da.description,da.status,da.analysis_type,
            da.archive_version,da.archived_at,
            af.currency,af.initial_investment,af.implementation_cost,af.training_cost,
            af.annual_operating_cost,af.npv,af.irr,af.roi_percent,af.payback_months
       FROM digitization_analyses da
       LEFT JOIN analysis_financials af
         ON af.analysis_id=da.id AND af.organization_id=da.organization_id
      WHERE da.id=? AND da.organization_id=?`,
    [analysisId, organizationId]
  );
  if (!source) return { ok: false, reason: 'Digitization analysis not found' };
  if (source.archived_at) return { ok: false, reason: 'Digitization analysis is archived' };
  if (!String(source.name || '').trim()) return { ok: false, reason: 'Analysis title is empty' };
  return { ok: true, data: source };
}

function buildCandidateFields(source: DigitizationAnalysisCandidateSource): FinanceCandidateFields {
  const capexParts = [source.initial_investment, source.implementation_cost, source.training_cost];
  const capex = capexParts.some((value) => value != null)
    ? capexParts.reduce<number>((sum, value) => sum + Number(value || 0), 0)
    : null;
  const fingerprintPayload = {
    id: source.id,
    name: source.name,
    description: source.description,
    status: source.status,
    analysisType: source.analysis_type,
    version: source.archive_version,
    currency: source.currency,
    capex,
    opex: source.annual_operating_cost,
    npv: source.npv,
    irr: source.irr,
    roi: source.roi_percent,
    payback: source.payback_months,
  };
  const snapshot = {
    ...emptySourceSnapshot(),
    currency: unknownIfMissing(source.currency),
    capex: unknownIfMissing(capex),
    opex: unknownIfMissing(source.annual_operating_cost),
    npv: unknownIfMissing(source.npv),
    irr: unknownIfMissing(source.irr),
    roi: unknownIfMissing(source.roi_percent),
    payback: unknownIfMissing(source.payback_months),
    baselineOrScenario: unknownIfMissing(source.status),
    sourceVersion: String(source.archive_version),
    sourceFingerprint: computeSourceFingerprint(fingerprintPayload),
  };
  const financialFacts = [
    snapshot.npv !== 'unknown' ? `NPV ${snapshot.npv} ${snapshot.currency}` : null,
    snapshot.roi !== 'unknown' ? `ROI ${snapshot.roi}%` : null,
    snapshot.capex !== 'unknown' ? `CAPEX ${snapshot.capex} ${snapshot.currency}` : null,
  ].filter(Boolean);
  return {
    title: String(source.name).trim(),
    rationale: [
      source.description?.trim() || 'Candidate generated from a digitization analysis.',
      financialFacts.length ? `Persisted Finance facts: ${financialFacts.join(', ')}.` : null,
      `Source state: ${source.status || 'unknown'}; type: ${source.analysis_type || 'unknown'}.`,
    ]
      .filter(Boolean)
      .join(' '),
    sourceSnapshot: snapshot,
  };
}

export async function previewDigitizationAnalysisCandidate(params: {
  organizationId: string;
  analysisId: string;
}): Promise<FinanceCandidatePreviewResult> {
  return previewFinanceCandidateHandoff({
    organizationId: params.organizationId,
    sourceType: FINANCE_DIGITIZATION_ANALYSIS_SOURCE_TYPE,
    sourceId: params.analysisId,
    resolveEligibleSource: () =>
      resolveEligibleDigitizationAnalysis(params.organizationId, params.analysisId),
    buildCandidateFields,
  });
}

export async function confirmDigitizationAnalysisCandidateHandoff(params: {
  organizationId: string;
  analysisId: string;
  createdBy?: string | null;
}) {
  return confirmFinanceCandidateHandoff({
    organizationId: params.organizationId,
    sourceType: FINANCE_DIGITIZATION_ANALYSIS_SOURCE_TYPE,
    sourceId: params.analysisId,
    createdBy: params.createdBy ?? null,
    resolveEligibleSource: () =>
      resolveEligibleDigitizationAnalysis(params.organizationId, params.analysisId),
    buildCandidateFields,
    lockSourceRow: (tx) => lockSource(tx, params.organizationId, params.analysisId),
  });
}

async function lockSource(
  tx: PinnedTransactionClient,
  organizationId: string,
  analysisId: string
): Promise<void> {
  await tx.queryOne(
    `SELECT id FROM digitization_analyses WHERE id=? AND organization_id=? FOR UPDATE`,
    [analysisId, organizationId]
  );
}

export async function getDigitizationAnalysisCandidateHandoff(params: {
  organizationId: string;
  analysisId: string;
}) {
  return getFinanceCandidateHandoff({
    organizationId: params.organizationId,
    sourceType: FINANCE_DIGITIZATION_ANALYSIS_SOURCE_TYPE,
    sourceId: params.analysisId,
  });
}
