import { apiGet, apiPost } from '../baseClient';

const BASE = '/finance/candidate-handoff/digitization-analysis';

export interface DigitizationAnalysisCandidateConfirmResult {
  created: boolean;
  candidateId: string;
  sourceSnapshot: Record<string, unknown>;
}

export async function previewDigitizationAnalysisCandidateHandoff(analysisId: string) {
  const envelope = await apiGet<{
    data:
      | { eligible: true; preview: Record<string, unknown> }
      | { eligible: false; reason: string };
  }>(`${BASE}/${encodeURIComponent(analysisId)}/preview`, 'Failed to preview Candidate handoff');
  return envelope.data;
}

export async function confirmDigitizationAnalysisCandidateHandoff(
  analysisId: string
): Promise<DigitizationAnalysisCandidateConfirmResult> {
  const envelope = await apiPost<{ data: DigitizationAnalysisCandidateConfirmResult }>(
    `${BASE}/${encodeURIComponent(analysisId)}/confirm`,
    undefined,
    'Failed to confirm Candidate handoff'
  );
  return envelope.data;
}

export async function getDigitizationAnalysisCandidateHandoff(analysisId: string) {
  try {
    const envelope = await apiGet<{ data: Record<string, unknown> }>(
      `${BASE}/${encodeURIComponent(analysisId)}`,
      'Failed to read Candidate handoff'
    );
    return envelope.data;
  } catch (error: any) {
    if (error?.status === 404 || error?.data?.code === 'NO_CANDIDATE_HANDOFF') return null;
    throw error;
  }
}
