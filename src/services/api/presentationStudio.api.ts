/**
 * Presentation Studio API client (Sprint S5)
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *
 * Read-only, tenant-scoped client for the four preview endpoints introduced
 * in sprints S1..S4:
 *   - POST /api/presentation-studio/source-pack/preview         (S1)
 *   - POST /api/presentation-studio/narrative-plan/preview      (S2)
 *   - POST /api/presentation-studio/template-architect/preview  (S3)
 *   - POST /api/presentation-studio/generate/preview            (S4)
 *
 * Tenant safety: organizationId is set by the server from the authenticated
 * session. The client MUST NOT attempt to override it via the body. RBAC is
 * enforced by the server (`presentation_create` capability).
 *
 * The endpoints all return `{ success: boolean, data: T }`. This client
 * unwraps the envelope and surfaces a typed `T`.
 */

import { fetchWithRetry, getHeaders, handleResponse } from './baseClient';

const STUDIO_BASE = '/api/presentation-studio';

// ---------------------------------------------------------------------------
// Wire types (subset of server-side envelopes)
// ---------------------------------------------------------------------------

/**
 * `setup` body shared across all four preview endpoints. Mirrors the subset
 * of `DeckSetup` parsed by `parseDeckSetupFromBody` on the server.
 *
 * NOTE: organizationId is intentionally NOT modeled here — the server takes
 * the tenant from the authenticated session and ignores any body-supplied id.
 */
export interface PresentationStudioSetupInput {
  title: string;
  audience?: 'sponsor' | 'executive' | 'investor' | 'internal' | string;
  goal?: 'inform' | 'decide' | 'sell' | 'align' | string;
  language?: 'en' | 'pl' | string;
  theme?: 'corporate' | 'minimal' | 'modern' | string;
  confidentiality?: 'confidential' | 'internal' | 'public' | string;
  brandColor?: string;
  templateId?: string;
  templateFamily?: string;
  deckType?: string;
  sourceType?: string;
  sourceId?: string;
  sourceArtifacts?: Array<Record<string, unknown>>;
  sourcePack?: Record<string, unknown>;
  sourcePackStrict?: boolean;
}

export interface PresentationStudioOutlineItem {
  intent: string;
  title: string;
  enabled?: boolean;
  keyMessage?: string;
  sourceRef?: string;
  sourceRefs?: string[];
  confidence?: number;
  density?: 'visual' | 'balanced' | 'document';
  visualPolicy?: string;
  layoutHint?: string;
  suggestedBlocks?: string[];
  notesPolicy?: 'none' | 'light' | 'standard' | 'speaker_heavy';
  warnings?: string[];
}

export interface PresentationStudioSourcePack {
  status: 'empty' | 'partial' | 'ready' | string;
  builtAt: string;
  sources: Array<{
    sourceType: string;
    [key: string]: unknown;
  }>;
  warnings: string[];
  missingInputs: string[];
  [key: string]: unknown;
}

export interface PresentationStudioNarrativePlan {
  status: 'ready' | 'needs_sources' | string;
  goal?: string;
  thesis?: string;
  storyline?: string;
  decisionContext?: string;
  proofPoints?: string[];
  warnings: string[];
  createdAt: string;
  slidePlan: Array<{
    intent: string;
    title: string;
    audienceQuestion?: string;
    requiredEvidence?: string[];
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface PresentationStudioTemplatePlanGovernance {
  initialStatus: 'draft';
  approvalRequired: true;
  ownerRole: string;
  auditEvent: 'template_architect_plan_created';
}

export interface PresentationStudioTemplatePlan {
  planId: string;
  status: 'draft' | 'ready_for_review' | 'needs_sources' | string;
  templateName: string;
  templateFamily: string;
  purpose: string;
  recommendedFrequency: string | null;
  audience: string[];
  requiredInputs: string[];
  optionalInputs: string[];
  sections: Array<{
    name: string;
    purpose: string;
    slides: Array<{
      slideNumber: number;
      intent: string;
      title: string;
      purpose: string;
      requiredData: string[];
      layoutRule: string;
      contentDensity: 'visual' | 'balanced' | 'document';
      approvalRequired: boolean;
    }>;
  }>;
  governance: PresentationStudioTemplatePlanGovernance;
  warnings: string[];
  createdAt: string;
  [key: string]: unknown;
}

export interface PresentationStudioWouldGenerate {
  canProceed: boolean;
  blockingReasons: string[];
  strict: boolean;
}

// ---------------------------------------------------------------------------
// Response envelopes (server side)
// ---------------------------------------------------------------------------

export interface SourcePackPreviewResponse {
  ok: boolean;
  sourcePack: PresentationStudioSourcePack;
  missingInputs: string[];
  warnings: string[];
  previewId: string;
}

export interface NarrativePlanPreviewResponse {
  narrativePlan: PresentationStudioNarrativePlan;
  sourcePack: PresentationStudioSourcePack;
  missingInputs: string[];
  warnings: string[];
  previewId: string;
}

export interface TemplatePlanPreviewResponse {
  templatePlan: PresentationStudioTemplatePlan;
  sourcePack: PresentationStudioSourcePack;
  narrativePlan: PresentationStudioNarrativePlan;
  missingInputs: string[];
  warnings: string[];
  approvalRequired: true;
  previewId: string;
}

export interface GeneratePreviewResponse {
  outlinePreview: PresentationStudioOutlineItem[];
  estimatedSlideCount: number;
  usedTemplate: {
    family: string | null;
    runtime: Record<string, unknown> | null;
    source: 'setup' | 'narrative_fallback' | 'default';
  };
  sourcePack: PresentationStudioSourcePack;
  narrativePlan: PresentationStudioNarrativePlan;
  missingInputs: string[];
  warnings: string[];
  wouldGenerate: PresentationStudioWouldGenerate;
  previewId: string;
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

export interface SourcePackPreviewRequest extends PresentationStudioSetupInput {
  /**
   * Mirror of the `setup` body. The server's `/source-pack/preview` accepts
   * the setup directly at the body root for backward compatibility with the
   * S1 contract. Newer endpoints nest setup under `setup`.
   */
}

export interface NarrativePlanPreviewRequest {
  setup: PresentationStudioSetupInput;
  outline?: PresentationStudioOutlineItem[];
  sourcePack?: PresentationStudioSourcePack;
}

export interface TemplatePlanPreviewRequest {
  setup: PresentationStudioSetupInput;
  outline?: PresentationStudioOutlineItem[];
  sourcePack?: PresentationStudioSourcePack;
  narrativePlan?: PresentationStudioNarrativePlan;
}

export interface GeneratePreviewRequest {
  setup: PresentationStudioSetupInput;
  outline?: PresentationStudioOutlineItem[];
  sourcePack?: PresentationStudioSourcePack;
  narrativePlan?: PresentationStudioNarrativePlan;
  strict?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function studioPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRetry(`${STUDIO_BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await handleResponse<{ success: boolean; data: T; error?: string; code?: string }>(
    res,
    `Presentation Studio POST ${path}`
  );
  if (!json || !json.success || !json.data) {
    const message = json?.error || `Presentation Studio POST ${path} returned no data`;
    throw new Error(message);
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const PresentationStudioApi = {
  previewSourcePack: (input: SourcePackPreviewRequest) =>
    studioPost<SourcePackPreviewResponse>('/source-pack/preview', input),

  previewNarrativePlan: (input: NarrativePlanPreviewRequest) =>
    studioPost<NarrativePlanPreviewResponse>('/narrative-plan/preview', input),

  previewTemplatePlan: (input: TemplatePlanPreviewRequest) =>
    studioPost<TemplatePlanPreviewResponse>('/template-architect/preview', input),

  previewGenerate: (input: GeneratePreviewRequest) =>
    studioPost<GeneratePreviewResponse>('/generate/preview', input),
};

export type PresentationStudioApiType = typeof PresentationStudioApi;
