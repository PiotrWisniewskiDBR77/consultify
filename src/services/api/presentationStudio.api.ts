/**
 * Presentation Studio API client (Sprints S5 + S7)
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
 * Mutating, tenant-scoped client for the approval-gated generate flow
 * introduced in sprint S6:
 *   - POST /api/presentation-studio/generate/request-approval   (S6)
 *   - POST /api/presentation-studio/generate                    (S6)
 *
 * Tenant safety: organizationId is set by the server from the authenticated
 * session. The client MUST NOT attempt to override it via the body. RBAC is
 * enforced by the server (`presentation_create` capability).
 *
 * The endpoints all return `{ success: boolean, data: T }` on the happy path.
 * Mutating endpoints can return non-2xx with a typed error envelope; this
 * client surfaces them as `PresentationStudioApiError` so the UI can render
 * honest banners without parsing raw responses.
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

/**
 * Sprint S10/S11 layout audit shape. The backend audits the deterministic
 * outline for overflow, evidence-discipline, and PDF/PPTX parity issues
 * and returns one entry per slide plus aggregate flag counts.
 */
export type PresentationStudioLayoutAuditFlag =
  | 'layout_overflow_title'
  | 'layout_overflow_key_message'
  | 'layout_overflow_blocks'
  | 'missing_source_for_evidence_intent'
  | 'unsupported_intent_for_pptx_export'
  | 'unsupported_intent_for_pdf_export';

export interface PresentationStudioSlideLayoutAudit {
  index: number;
  intent: string;
  flags: PresentationStudioLayoutAuditFlag[];
}

export interface PresentationStudioOutlineLayoutAudit {
  warnings: string[];
  slideAudits: PresentationStudioSlideLayoutAudit[];
  flagCounts: Record<PresentationStudioLayoutAuditFlag, number>;
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
  /** Sprint S10/S11: layout audit findings on the outline preview. */
  layoutAudit: PresentationStudioOutlineLayoutAudit;
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
// S9: source artifact picker
// ---------------------------------------------------------------------------

export type PresentationStudioSourceArtifactReadiness =
  | 'ready'
  | 'partial_ready'
  | 'missing_sales_data'
  | 'policy_blocked'
  | 'insufficient_evidence';

export interface PresentationStudioSourceArtifactItem {
  type: string;
  id: string;
  label: string;
  readiness: PresentationStudioSourceArtifactReadiness;
  confidence: number | null;
  updatedAt: string | null;
  hint: string | null;
}

export interface PresentationStudioSourceArtifactList {
  artifacts: PresentationStudioSourceArtifactItem[];
  total: number;
  byType: Record<string, number>;
  generatedAt: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// S7: approval / execute typed surfaces
// ---------------------------------------------------------------------------

export interface PresentationStudioApprovalTicket {
  ticketId: string;
  organizationId: string;
  userId: string;
  payloadFingerprint: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export type RequestApprovalRequest = GeneratePreviewRequest;

export interface RequestApprovalResponse {
  ticket: PresentationStudioApprovalTicket;
  generatePreview: GeneratePreviewResponse;
  payloadFingerprint: string;
}

export interface ExecuteGenerateRequest extends GeneratePreviewRequest {
  approvalTicket: string;
}

export interface ExecuteGenerateResponse {
  deckId: string;
  slideCount: number;
  outline: PresentationStudioOutlineItem[];
  validationWarnings: string[];
  ticketId: string;
  auditEvent: 'presentation_generated_via_studio';
}

/**
 * Typed error class for all non-2xx responses on the mutating Studio
 * endpoints. The UI can `instanceof PresentationStudioApiError` and inspect
 * `code`, `reason`, and `preview` (when present) to render honest banners.
 *
 * Known codes (server-side):
 *   - request-approval: `PRECONDITION_NOT_MET` (412) when the embedded
 *     preview's `wouldGenerate.canProceed` is false.
 *   - generate:         `PRECONDITION_REQUIRED` (403) when no ticket id was
 *                       supplied.
 *   - generate:         `INVALID_APPROVAL_TICKET` (403) on any ticket
 *                       redemption failure; `reason` is one of `not_found`,
 *                       `expired`, `consumed`, `tenant_mismatch`,
 *                       `user_mismatch`, `payload_mismatch`.
 *   - both:             `PERMISSION_DENIED` (403) when the user lacks
 *                       `presentation_create`.
 *   - both:             `NO_ORG_CONTEXT` / `NO_USER_CONTEXT` (403).
 */
export class PresentationStudioApiError extends Error {
  status: number;
  code: string;
  reason?: string;
  preview?: GeneratePreviewResponse;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    reason?: string;
    preview?: GeneratePreviewResponse;
  }) {
    super(init.message);
    this.name = 'PresentationStudioApiError';
    this.status = init.status;
    this.code = init.code;
    if (init.reason !== undefined) this.reason = init.reason;
    if (init.preview !== undefined) this.preview = init.preview;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function studioGet<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`${STUDIO_BASE}${path}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ success: boolean; data: T; error?: string; code?: string }>(
    res,
    `Presentation Studio GET ${path}`
  );
  if (!json || !json.success || !json.data) {
    const message = json?.error || `Presentation Studio GET ${path} returned no data`;
    throw new Error(message);
  }
  return json.data;
}

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

/**
 * Mutating-endpoint helper. Bypasses `handleResponse` (which throws on
 * non-2xx) so the caller can surface typed error envelopes directly via
 * `PresentationStudioApiError`. Used by `requestApproval` and
 * `executeGenerate` only.
 */
interface StudioTypedEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  code?: string;
  reason?: string;
  preview?: GeneratePreviewResponse;
}

async function studioPostTyped<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRetry(`${STUDIO_BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: StudioTypedEnvelope<T> | null = null;
  try {
    json = (await res.json()) as StudioTypedEnvelope<T>;
  } catch {
    json = null;
  }
  if (!res.ok || !json || json.success === false || !json.data) {
    const code = json?.code || `HTTP_${res.status}`;
    const message =
      json?.error ||
      json?.reason ||
      `Presentation Studio POST ${path} failed with status ${res.status}`;
    throw new PresentationStudioApiError({
      status: res.status,
      code,
      message,
      reason: json?.reason,
      preview: json?.preview,
    });
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

  /**
   * Phase A of the mutating generate flow: request a single-use approval
   * ticket. Resolves with the ticket and embedded preview on success.
   * Throws `PresentationStudioApiError` with code `PRECONDITION_NOT_MET` and
   * a populated `preview` when generation would not proceed.
   */
  requestApproval: (input: RequestApprovalRequest) =>
    studioPostTyped<RequestApprovalResponse>('/generate/request-approval', input),

  /**
   * Phase B of the mutating generate flow: redeem a ticket and persist a
   * deck. Resolves with the deck id, slide count, outline, and the canonical
   * `presentation_generated_via_studio` audit event marker. Throws
   * `PresentationStudioApiError` with code `INVALID_APPROVAL_TICKET` and a
   * `reason` (`not_found` | `expired` | `consumed` | `tenant_mismatch` |
   * `user_mismatch` | `payload_mismatch`) on any redemption failure, or
   * `PRECONDITION_REQUIRED` when the ticket id is missing.
   */
  executeGenerate: (input: ExecuteGenerateRequest) =>
    studioPostTyped<ExecuteGenerateResponse>('/generate', input),

  /**
   * S9 — Tenant-scoped enumeration of source artifacts the user can attach
   * to a Studio deck. Read-only. Honest degraded UI: the server returns 200
   * with `warnings[]` populated when the underlying query fails; the client
   * surfaces those warnings in the picker rather than throwing.
   */
  listSourceArtifacts: (params?: { limit?: number }) => {
    const limit = params?.limit;
    const query =
      limit && Number.isFinite(limit) ? `?limit=${encodeURIComponent(String(limit))}` : '';
    return studioGet<PresentationStudioSourceArtifactList>(`/source-artifacts${query}`);
  },

  /**
   * E3 / R4 — Per-slide AI regeneration. Uses saved ContextPack snapshot
   * (narrative slides) or rebuilds from existing unified_json. Does NOT touch
   * other slides. Pass `instruction` for a free-text rewrite of any slide;
   * the server returns the rebuilt FE-shaped `card` for in-place `updateCard`.
   */
  regenerateSlide: (deckId: string, slideIndex: number, instruction?: string) =>
    studioPostTyped<{ slide: Record<string, unknown>; card?: Record<string, unknown> }>(
      `/decks/${encodeURIComponent(deckId)}/slides/${encodeURIComponent(String(slideIndex))}/regenerate`,
      instruction && instruction.trim().length > 0 ? { instruction: instruction.trim() } : {}
    ),
};

export type PresentationStudioApiType = typeof PresentationStudioApi;
