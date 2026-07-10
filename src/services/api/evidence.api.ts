/**
 * Evidence Layer API client — H1 Harvey-gap, kontrakt nr 1.
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_RDZEN_2026-07-10.md §3.
 * Backend: server/src/routes/evidence.routes.ts.
 */
import { apiGet, apiPost, apiPut } from './baseClient';

export type EvidenceArtifactType =
  | 'insight'
  | 'initiative'
  | 'task'
  | 'decision'
  | 'report'
  | 'deck'
  | 'document'
  | 'kpi'
  | 'finance_number'
  | 'benefit'
  | 'canvas'
  | 'project'
  | 'source'
  | 'assessment'
  | 'other';

export type EvidenceSourceType =
  | 'interview'
  | 'document'
  | 'kb'
  | 'statement_pack'
  | 'kpi_series'
  | 'insight'
  | 'tool_session'
  | 'snapshot'
  | 'benchmark';

export interface EvidenceSource {
  type: EvidenceSourceType;
  ref: string;
  snippet?: string;
  url?: string;
}

export type EvidenceAssumptionSourceType =
  | 'imported'
  | 'user'
  | 'teresa'
  | 'ai_assumed'
  | 'benchmark';

export interface EvidenceAssumption {
  key: string;
  value: unknown;
  source_type: EvidenceAssumptionSourceType;
  rationale?: string;
  confidence?: number;
}

export interface EvidenceToVerify {
  claim: string;
  why: string;
  suggested_check?: string;
}

export type EvidenceConfidenceLabel = 'high' | 'medium' | 'low' | 'unknown';

export interface EvidenceEnvelope {
  id: string;
  organizationId: string;
  artifactType: EvidenceArtifactType;
  artifactId: string;
  sources: EvidenceSource[];
  assumptions: EvidenceAssumption[];
  confidence: number | null;
  confidenceLabel: EvidenceConfidenceLabel;
  toVerify: EvidenceToVerify[];
  computedBy: { service: string; version?: string; at: string } | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertEvidenceEnvelopeBody {
  sources?: EvidenceSource[];
  assumptions?: EvidenceAssumption[];
  confidence?: number | null;
  toVerify?: EvidenceToVerify[];
  computedBy?: { service: string; version?: string; at: string } | null;
}

/** Fail-open: brak envelope lub błąd sieci → null (sekcja renderuje stan pusty). */
export async function fetchEvidenceEnvelope(
  artifactType: EvidenceArtifactType,
  artifactId: string
): Promise<EvidenceEnvelope | null> {
  try {
    const res = await apiGet<{ envelope: EvidenceEnvelope | null }>(
      `/evidence/${encodeURIComponent(artifactType)}/${encodeURIComponent(artifactId)}`
    );
    return res?.envelope ?? null;
  } catch {
    return null;
  }
}

export async function upsertEvidenceEnvelope(
  artifactType: EvidenceArtifactType,
  artifactId: string,
  body: UpsertEvidenceEnvelopeBody
): Promise<EvidenceEnvelope> {
  const res = await apiPut<{ envelope: EvidenceEnvelope }>(
    `/evidence/${encodeURIComponent(artifactType)}/${encodeURIComponent(artifactId)}`,
    body
  );
  return res.envelope;
}

export async function attachEvidenceSource(
  artifactType: EvidenceArtifactType,
  artifactId: string,
  source: EvidenceSource
): Promise<EvidenceEnvelope> {
  const res = await apiPost<{ envelope: EvidenceEnvelope }>(
    `/evidence/${encodeURIComponent(artifactType)}/${encodeURIComponent(artifactId)}/sources`,
    { source }
  );
  return res.envelope;
}
