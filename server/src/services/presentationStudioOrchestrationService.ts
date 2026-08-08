/**
 * Presentation Studio Orchestration Service
 *
 * Module: Consultify Presentation Studio (Sprint S1)
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - docs/product/PREZENTACJE_V8_SSOT.md
 *
 * Phase 2 (post-approval) micro-sprint S1 introduces ONLY the orchestration
 * skeleton plus the source-pack preview entry point. No DB migrations.
 * Route surface is mounted under `/api/presentation-studio/...` and reuses
 * the existing tenant + RBAC patterns from `presentations.routes.ts`.
 *
 * Subsequent sprints (S2 narrative plan preview, S3 template architect draft,
 * S4 generate dispatcher) will extend this service. Keeping orchestration in
 * one module avoids parallel registries and preserves the
 * `proposal -> approval -> execution -> audit` invariant for future
 * mutating endpoints.
 */

import type { DeckSetup, OutlineItem } from './presentationGeneratorService.js';
import type { PresentationNarrativePlan } from './presentationNarrativePlannerService.js';
import { buildPresentationNarrativePlan } from './presentationNarrativePlannerService.js';
import type {
  PresentationSourcePack,
  PresentationSourcePackPreflight,
} from './presentationSourcePackService.js';
import {
  buildPresentationSourcePack,
  preflightPresentationSourcePack,
} from './presentationSourcePackService.js';
import type {
  ApprovalTicketRejectionReason,
  PresentationStudioApprovalTicket,
} from './presentationStudioApprovalTicketService.js';
import {
  computePayloadFingerprint,
  consumeApprovalTicket,
  mintApprovalTicket,
} from './presentationStudioApprovalTicketService.js';
import { applyIntentDensityDefaults } from './presentationStudioIntentDensityDefaultsService.js';
import type { PresentationStudioOutlineLayoutAudit } from './presentationStudioLayoutAuditService.js';
import { auditPresentationStudioOutlineLayout } from './presentationStudioLayoutAuditService.js';
import type { TemplateArchitectPlan } from './presentationTemplateArchitectService.js';
import { buildPresentationTemplateArchitectPlan } from './presentationTemplateArchitectService.js';
import type {
  PresentationTemplateRuntime,
  TemplateFamily,
} from './presentationTemplateRuntimeService.js';
import {
  applyTemplateRuntime,
  buildSystemTemplateRuntime,
} from './presentationTemplateRuntimeService.js';

export interface PresentationStudioSourcePackPreviewInput {
  setup: DeckSetup;
  organizationId: string;
  /**
   * When true, missing required inputs cause `ok=false` (mirrors generation-time
   * strict mode). When false (default), the preview surfaces warnings without
   * blocking. The preview itself never mutates state, so this only affects the
   * `ok` flag in the response.
   */
  strict?: boolean;
  /** Optional clock injection for deterministic tests. */
  now?: Date;
}

export interface PresentationStudioSourcePackPreviewResult {
  ok: boolean;
  sourcePack: PresentationSourcePack;
  missingInputs: string[];
  warnings: string[];
  /** Stable, request-scoped id surfaced to the UI for telemetry/log correlation. */
  previewId: string;
}

function makePreviewId(organizationId: string, builtAt: string): string {
  const normalizedOrg = organizationId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'org';
  return `pssp_${normalizedOrg}_${Date.parse(builtAt) || Date.now()}`;
}

/**
 * Build a tenant-scoped source pack preview WITHOUT triggering any deck
 * generation, DB write, or audit event. This is the read-only entry point
 * used by the Studio UI to show "what would happen if we generate now".
 *
 * Tenant safety:
 *   - `organizationId` MUST be the resolved tenant from auth middleware. The
 *     caller is responsible for not trusting body-supplied org ids.
 *   - The downstream `preflightPresentationSourcePack` only reads in-memory
 *     setup data; no cross-tenant DB access is performed here.
 */
export function previewPresentationStudioSourcePack(
  input: PresentationStudioSourcePackPreviewInput
): PresentationStudioSourcePackPreviewResult {
  const preflight: PresentationSourcePackPreflight = preflightPresentationSourcePack({
    setup: input.setup,
    organizationId: input.organizationId,
    strict: Boolean(input.strict),
    now: input.now,
  });
  return {
    ok: preflight.ok,
    sourcePack: preflight.sourcePack,
    missingInputs: preflight.missingInputs,
    warnings: preflight.warnings,
    previewId: makePreviewId(input.organizationId, preflight.sourcePack.builtAt),
  };
}

export interface PresentationStudioNarrativePlanPreviewInput {
  setup: DeckSetup;
  organizationId: string;
  /**
   * Caller-supplied outline. Optional: when omitted the narrative planner
   * receives an empty outline and the result is best-effort (status will
   * usually be `needs_sources`). The Studio UI normally passes the outline
   * returned from `generateOutline` or a draft outline maintained client-side.
   */
  outline?: OutlineItem[];
  /**
   * Caller-supplied source pack. Optional: when omitted we build a fresh one
   * from `setup.sourceArtifacts`. The narrative plan is sensitive to source
   * pack content, so the UI typically reuses the source pack from the
   * preceding `previewSourcePack` call to keep the preview deterministic.
   */
  sourcePack?: PresentationSourcePack;
  /** Optional clock injection for deterministic tests. */
  now?: Date;
}

export interface PresentationStudioNarrativePlanPreviewResult {
  narrativePlan: PresentationNarrativePlan;
  sourcePack: PresentationSourcePack;
  missingInputs: string[];
  warnings: string[];
  /** Stable, request-scoped id surfaced to the UI for telemetry/log correlation. */
  previewId: string;
}

/**
 * Build a tenant-scoped narrative plan preview WITHOUT triggering generation.
 * Mirrors `previewPresentationStudioSourcePack` invariants: read-only,
 * tenant-scoped, no DB writes, no audit events.
 *
 * The narrative planner is deterministic and source-grounded:
 *   - Empty source pack -> `status='needs_sources'`, draft hypothesis tone.
 *   - Source pack present -> per-slide narrative role + required evidence.
 */
export function previewPresentationStudioNarrativePlan(
  input: PresentationStudioNarrativePlanPreviewInput
): PresentationStudioNarrativePlanPreviewResult {
  const sourcePack =
    input.sourcePack ||
    buildPresentationSourcePack({
      setup: input.setup,
      organizationId: input.organizationId,
      now: input.now,
    });
  const outline: OutlineItem[] = Array.isArray(input.outline) ? input.outline : [];
  const narrativePlan = buildPresentationNarrativePlan({
    setup: input.setup,
    outline,
    sourcePack,
    now: input.now,
  });
  const warnings = [...sourcePack.warnings, ...narrativePlan.warnings];
  return {
    narrativePlan,
    sourcePack,
    missingInputs: sourcePack.missingInputs,
    warnings,
    previewId: makePreviewId(input.organizationId, narrativePlan.createdAt),
  };
}

export interface PresentationStudioTemplatePlanPreviewInput {
  setup: DeckSetup;
  organizationId: string;
  /**
   * Caller-supplied outline. Optional. Forwarded to the narrative planner so
   * the resulting template plan can ground per-slide blueprints in the same
   * narrative the UI just previewed.
   */
  outline?: OutlineItem[];
  /**
   * Caller-supplied source pack. Optional: when omitted we build a fresh one
   * from `setup.sourceArtifacts`. Reusing the source pack from the preceding
   * preview keeps `requiredInputs` / `missingRequired` deterministic.
   */
  sourcePack?: PresentationSourcePack;
  /**
   * Caller-supplied narrative plan. Optional: when omitted we build a fresh
   * one from setup + outline + source pack. Passing the plan from
   * `previewPresentationStudioNarrativePlan` keeps the template plan consistent
   * with what the UI just rendered.
   */
  narrativePlan?: PresentationNarrativePlan;
  /** Optional clock injection for deterministic tests. */
  now?: Date;
}

export interface PresentationStudioTemplatePlanPreviewResult {
  templatePlan: TemplateArchitectPlan;
  sourcePack: PresentationSourcePack;
  narrativePlan: PresentationNarrativePlan;
  missingInputs: string[];
  warnings: string[];
  /**
   * Aggregate `approvalRequired` flag exposed at the envelope level so the UI
   * does not need to reach into `templatePlan.governance` to know whether the
   * proposal -> approval -> execution -> audit flow is required.
   *
   * Always `true` for template plans by design: a template only enters the
   * registry after explicit human approval.
   */
  approvalRequired: true;
  /** Stable, request-scoped id surfaced to the UI for telemetry/log correlation. */
  previewId: string;
}

/**
 * Build a tenant-scoped template architect plan preview WITHOUT triggering
 * any registry write. Mirrors S1/S2 invariants: read-only, tenant-scoped,
 * no DB writes, no audit events.
 *
 * Governance:
 *   - The plan is always returned with `governance.initialStatus = 'draft'`
 *     and `governance.approvalRequired = true`. Even if the underlying source
 *     pack is fully ready, the template can only become an approved registry
 *     entry through an explicit approve endpoint (S4+).
 *   - The envelope-level `approvalRequired: true` flag is the canonical
 *     read-back for the UI's "Requires approval" badge.
 */
export function previewPresentationStudioTemplatePlan(
  input: PresentationStudioTemplatePlanPreviewInput
): PresentationStudioTemplatePlanPreviewResult {
  const sourcePack =
    input.sourcePack ||
    buildPresentationSourcePack({
      setup: input.setup,
      organizationId: input.organizationId,
      now: input.now,
    });
  const outline: OutlineItem[] = Array.isArray(input.outline) ? input.outline : [];
  const narrativePlan =
    input.narrativePlan ||
    buildPresentationNarrativePlan({
      setup: input.setup,
      outline,
      sourcePack,
      now: input.now,
    });
  const templatePlan = buildPresentationTemplateArchitectPlan({
    setup: input.setup,
    sourcePack,
    narrativePlan,
    now: input.now,
  });
  const warnings = [...sourcePack.warnings, ...narrativePlan.warnings, ...templatePlan.warnings];
  return {
    templatePlan,
    sourcePack,
    narrativePlan,
    missingInputs: sourcePack.missingInputs,
    warnings,
    approvalRequired: true,
    previewId: makePreviewId(input.organizationId, templatePlan.createdAt),
  };
}

export interface PresentationStudioGeneratePreviewInput {
  setup: DeckSetup;
  organizationId: string;
  /**
   * Caller-supplied outline. Optional. Used as the starting outline before
   * template runtime adjustments. When omitted we derive a default outline
   * from `templateFamily` (if any) or from the narrative plan's per-slide
   * intents (last-resort fallback).
   */
  outline?: OutlineItem[];
  /**
   * Caller-supplied source pack. Optional: when omitted we build a fresh one
   * from `setup.sourceArtifacts`. Reusing the source pack from the preceding
   * `previewSourcePack` call keeps `requiredInputs`/`missingRequired` stable
   * across previews.
   */
  sourcePack?: PresentationSourcePack;
  /**
   * Caller-supplied narrative plan. Optional: when omitted we build a fresh
   * one from setup + outline + source pack.
   */
  narrativePlan?: PresentationNarrativePlan;
  /**
   * When true, missing required source inputs cause `wouldGenerate.canProceed`
   * to be false (mirrors generation-time strict mode). When false (default),
   * missing inputs surface as blocking reasons but `canProceed` may still be
   * true if the deck is non-decision and warnings are tolerable.
   *
   * Defaults to `setup.sourcePackStrict` when not explicitly set.
   */
  strict?: boolean;
  /** Optional clock injection for deterministic tests. */
  now?: Date;
}

export interface PresentationStudioGeneratePreviewResult {
  /**
   * Best-effort outline the generator would use if invoked NOW. Built from
   * (in order of preference):
   *   1) caller-supplied `outline`
   *   2) `templateFamily`/`deckType` -> `buildSystemTemplateRuntime`
   *   3) narrative plan slide plan (intents + titles)
   *   4) minimal `cover` + `key_messages` default
   *
   * NOTE: This is a preview. The real `generateOutline` path also resolves
   * approved-template registry rows from the DB; that path is intentionally
   * NOT exercised here so the preview stays pure read with zero DB access.
   */
  outlinePreview: OutlineItem[];
  estimatedSlideCount: number;
  /**
   * Template metadata used to build the outline preview. `family` is null
   * when no template family was resolvable from the setup.
   */
  usedTemplate: {
    family: TemplateFamily | null;
    runtime: PresentationTemplateRuntime | null;
    source: 'setup' | 'narrative_fallback' | 'default';
  };
  sourcePack: PresentationSourcePack;
  narrativePlan: PresentationNarrativePlan;
  missingInputs: string[];
  warnings: string[];
  /**
   * Actionable summary the UI can use to render an honest "Generate" button
   * state. `canProceed=false` means the real generation call would either
   * fail (strict + missing inputs) or be unsafe (e.g. decision deck with
   * empty source pack); the UI should disable the button and surface the
   * reasons.
   */
  wouldGenerate: {
    canProceed: boolean;
    blockingReasons: string[];
    strict: boolean;
  };
  /**
   * Sprint S10 layout audit pass over `outlinePreview`. Surfaces overflow,
   * missing-source, and PPTX export-parity findings as warning strings (also
   * merged into the top-level `warnings` array) plus a per-slide finding
   * map and an aggregate flag counter. Findings never block generation —
   * they are advisory and the UI is expected to render the count next to
   * the "Generate" CTA.
   */
  layoutAudit: PresentationStudioOutlineLayoutAudit;
  /** Stable, request-scoped id surfaced to the UI for telemetry/log correlation. */
  previewId: string;
}

function resolveTemplateFamilyFromSetup(setup: DeckSetup): string | null {
  const requested = String((setup as any).templateFamily || (setup as any).deckType || '').trim();
  return requested || null;
}

function outlineFromNarrativePlan(narrativePlan: PresentationNarrativePlan): OutlineItem[] {
  // The narrative planner currently types `intent` as `string` while
  // `OutlineItem.intent` is the strict `SlideIntent` enum. Re-narrowing here
  // is safe because the planner only emits intents that round-trip through
  // the shared template runtime; the cast avoids a wider type widening at
  // the orchestrator boundary.
  // Sprint S14: pipe each item through `applyIntentDensityDefaults` so
  // the narrative-plan path emits the same slide-level + per-slot
  // density defaults as the source-driven generator path. Closes the
  // consumer side of R-S12-1.
  return narrativePlan.slidePlan.map((slide) =>
    applyIntentDensityDefaults({
      intent: slide.intent as OutlineItem['intent'],
      title: slide.title,
      enabled: true,
    })
  );
}

function defaultMinimalOutline(): OutlineItem[] {
  return [
    { intent: 'cover', title: 'Cover', enabled: true },
    { intent: 'key_messages', title: 'Key Messages', enabled: true },
  ];
}

/**
 * Build a tenant-scoped read-only preview of what the deck WOULD look like
 * if `generateOutline` were called now. Mirrors S1/S2/S3 invariants: no DB
 * writes, no DB reads, no audit events, no telemetry side-effects.
 *
 * Approved-template DB resolution is intentionally OUT OF SCOPE for S4: the
 * preview only uses the public template runtime surface and narrative plan
 * fallback. The real `generateOutline` path will be wrapped behind an
 * approval-gated `generate` endpoint in a later sprint.
 */
export function previewPresentationStudioGenerate(
  input: PresentationStudioGeneratePreviewInput
): PresentationStudioGeneratePreviewResult {
  const sourcePack =
    input.sourcePack ||
    buildPresentationSourcePack({
      setup: input.setup,
      organizationId: input.organizationId,
      now: input.now,
    });

  const family = resolveTemplateFamilyFromSetup(input.setup);
  const runtime = family ? buildSystemTemplateRuntime(family) : null;

  let outlineSource: 'setup' | 'narrative_fallback' | 'default' = 'default';
  let baseOutline: OutlineItem[];
  if (Array.isArray(input.outline) && input.outline.length > 0) {
    baseOutline = input.outline;
    outlineSource = 'setup';
  } else if (runtime) {
    baseOutline = runtime.outline;
    outlineSource = 'setup';
  } else {
    baseOutline = [];
  }

  const narrativePlan =
    input.narrativePlan ||
    buildPresentationNarrativePlan({
      setup: input.setup,
      outline: baseOutline,
      sourcePack,
      now: input.now,
    });

  if (baseOutline.length === 0) {
    if (narrativePlan.slidePlan.length > 0) {
      baseOutline = outlineFromNarrativePlan(narrativePlan);
      outlineSource = 'narrative_fallback';
    } else {
      baseOutline = defaultMinimalOutline();
      outlineSource = 'default';
    }
  }

  const sourceArtifacts = Array.isArray(input.setup.sourceArtifacts)
    ? input.setup.sourceArtifacts
    : [];
  const applied = applyTemplateRuntime({
    outline: baseOutline,
    runtime,
    sources: sourceArtifacts,
  });
  const outlinePreview = applied.outline;
  const templateWarnings = applied.warnings;

  const strict = input.strict ?? Boolean(input.setup.sourcePackStrict);
  const blockingReasons: string[] = [];
  if (strict && sourcePack.missingInputs.length > 0) {
    blockingReasons.push(
      `Strict mode is enabled and the source pack is missing inputs: ${sourcePack.missingInputs.join(', ')}.`
    );
  }
  if (input.setup.goal === 'decide' && sourcePack.status === 'empty') {
    blockingReasons.push(
      'Decision decks require at least one source artifact to ground the recommendation.'
    );
  }
  if (narrativePlan.status === 'needs_sources' && strict) {
    blockingReasons.push(
      'Narrative planner reports needs_sources; strict mode treats this as blocking.'
    );
  }

  const layoutAudit = auditPresentationStudioOutlineLayout(outlinePreview, {
    templateFamily: family ?? null,
    organizationId: input.organizationId,
  });

  const warnings = [
    ...sourcePack.warnings,
    ...narrativePlan.warnings,
    ...templateWarnings,
    ...layoutAudit.warnings,
  ];

  return {
    outlinePreview,
    estimatedSlideCount: outlinePreview.filter((item) => item.enabled !== false).length,
    usedTemplate: {
      family: (family as TemplateFamily) || null,
      runtime,
      source: outlineSource,
    },
    sourcePack,
    narrativePlan,
    missingInputs: sourcePack.missingInputs,
    warnings,
    wouldGenerate: {
      canProceed: blockingReasons.length === 0,
      blockingReasons,
      strict,
    },
    layoutAudit,
    previewId: makePreviewId(input.organizationId, narrativePlan.createdAt),
  };
}

// ===========================================================================
// S6 — Approval-gated Generate
//
// First mutating Studio surface. Honors the proposal -> approval -> execution
// -> audit invariant: callers MUST first request a ticket via
// `requestPresentationStudioGenerateApproval`, then redeem it via
// `executePresentationStudioGenerate`. The ticket binds the (org, user,
// payload fingerprint) tuple and is single-use.
//
// Both functions are designed for dependency injection so tests can swap out
// the real `generateOutline` (which writes to `presentation_decks`) and the
// real audit writer without going through the database.
// ===========================================================================

export interface PresentationStudioGenerateRequestApprovalInput {
  setup: DeckSetup;
  organizationId: string;
  userId: string;
  /** Optional caller-supplied outline / source pack / narrative plan reused from the preview surface. */
  outline?: OutlineItem[];
  sourcePack?: PresentationSourcePack;
  narrativePlan?: PresentationNarrativePlan;
  /** Mirrors the `strict` param of `previewPresentationStudioGenerate`. */
  strict?: boolean;
  /** Optional clock injection for deterministic tests. */
  now?: Date;
  /** Override TTL in milliseconds. Defaults to the ticket service default (10 minutes). */
  ttlMs?: number;
}

export interface PresentationStudioGenerateRequestApprovalResult {
  ticket: PresentationStudioApprovalTicket;
  generatePreview: PresentationStudioGeneratePreviewResult;
  /**
   * Stable fingerprint over the canonical setup payload. Surfaced so the UI
   * can debug "why was my ticket rejected" by re-computing it client-side.
   */
  payloadFingerprint: string;
}

export type PresentationStudioGenerateApprovalRejection = {
  ok: false;
  code: 'PRECONDITION_NOT_MET';
  reason: string;
  preview: PresentationStudioGeneratePreviewResult;
};

export type PresentationStudioGenerateApprovalResponse =
  | ({ ok: true } & PresentationStudioGenerateRequestApprovalResult)
  | PresentationStudioGenerateApprovalRejection;

/**
 * Build the canonical payload fingerprinted by the approval ticket. The
 * fingerprint MUST round-trip across the request-approval and execute calls
 * — any field included here must be present and equal on both sides.
 *
 * We intentionally pin the (organizationId, setup, outline, sourcePack,
 * narrativePlan, strict) tuple. The userId is NOT part of the fingerprint
 * because the ticket is already user-scoped.
 */
function buildGeneratePayloadFingerprint(input: {
  organizationId: string;
  setup: DeckSetup;
  outline?: OutlineItem[];
  sourcePack?: PresentationSourcePack;
  narrativePlan?: PresentationNarrativePlan;
  strict?: boolean;
}): string {
  return computePayloadFingerprint({
    organizationId: input.organizationId,
    setup: input.setup,
    outline: input.outline ?? null,
    sourcePack: input.sourcePack ?? null,
    narrativePlan: input.narrativePlan ?? null,
    strict: input.strict ?? null,
  });
}

/**
 * Phase A of the mutating flow: validate that generation would succeed and
 * mint a single-use approval ticket. Does NOT invoke `generateOutline` and
 * never writes to `presentation_decks`.
 */
export function requestPresentationStudioGenerateApproval(
  input: PresentationStudioGenerateRequestApprovalInput
): PresentationStudioGenerateApprovalResponse {
  const generatePreview = previewPresentationStudioGenerate({
    setup: input.setup,
    organizationId: input.organizationId,
    outline: input.outline,
    sourcePack: input.sourcePack,
    narrativePlan: input.narrativePlan,
    strict: input.strict,
    now: input.now,
  });
  if (!generatePreview.wouldGenerate.canProceed) {
    return {
      ok: false,
      code: 'PRECONDITION_NOT_MET',
      reason:
        generatePreview.wouldGenerate.blockingReasons[0] ||
        'Generation preview blocks this request.',
      preview: generatePreview,
    };
  }
  const payloadFingerprint = buildGeneratePayloadFingerprint({
    organizationId: input.organizationId,
    setup: input.setup,
    outline: input.outline,
    sourcePack: input.sourcePack,
    narrativePlan: input.narrativePlan,
    strict: input.strict,
  });
  const ticket = mintApprovalTicket({
    organizationId: input.organizationId,
    userId: input.userId,
    payloadFingerprint,
    ttlMs: input.ttlMs,
    now: input.now,
  });
  return {
    ok: true,
    ticket,
    generatePreview,
    payloadFingerprint,
  };
}

// ---------------------------------------------------------------------------
// Phase B: execute (mutating). Dependency-injected so tests can swap out
// `generateOutline` and the audit writer without touching the database.
// ---------------------------------------------------------------------------

export interface PresentationStudioGenerateExecuteInput {
  setup: DeckSetup;
  organizationId: string;
  userId: string;
  ticketId: string;
  outline?: OutlineItem[];
  sourcePack?: PresentationSourcePack;
  narrativePlan?: PresentationNarrativePlan;
  strict?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  now?: Date;
}

export interface PresentationStudioGenerateExecuteResult {
  deckId: string;
  slideCount: number;
  outline: OutlineItem[];
  validationWarnings: string[];
  ticketId: string;
  auditEvent: 'presentation_generated_via_studio';
}

export type PresentationStudioGenerateExecuteResponse =
  | { ok: true; result: PresentationStudioGenerateExecuteResult }
  | { ok: false; code: 'INVALID_APPROVAL_TICKET'; reason: ApprovalTicketRejectionReason };

/**
 * Audit record emitted on successful generation. Module-internal; the route
 * handler does not import this type.
 */
export interface PresentationStudioGenerateAuditPayload {
  userId: string;
  organizationId: string;
  actionType: 'presentation_generated_via_studio';
  resourceType: 'presentation_deck';
  resourceId: string;
  details: {
    ticketId: string;
    payloadFingerprint: string;
    slideCount: number;
    deckTitle: string;
    deckGoal: string;
    deckAudience: string;
    layoutAuditFlagCounts?: PresentationStudioOutlineLayoutAudit['flagCounts'];
  };
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Real generator dependency type. Match the signature of `generateOutline`. */
export type PresentationStudioGenerateOutlineFn = (
  setup: DeckSetup,
  organizationId: string
) => Promise<{ outline: OutlineItem[]; deckId: string; validationWarnings: string[] }>;

export type PresentationStudioAuditFn = (
  payload: PresentationStudioGenerateAuditPayload
) => Promise<void>;

/**
 * Mutable dependency registry. Tests use `setStudioGenerateDependencies` to
 * swap out the real generator and audit writer. Production code never calls
 * the setter and the defaults below are used.
 */
interface StudioGenerateDependencies {
  generateOutline: PresentationStudioGenerateOutlineFn;
  recordAudit: PresentationStudioAuditFn;
}

let _studioGenerateDeps: StudioGenerateDependencies | null = null;

async function defaultGenerateOutline(
  setup: DeckSetup,
  organizationId: string
): Promise<{ outline: OutlineItem[]; deckId: string; validationWarnings: string[] }> {
  // Lazy import to keep the hot orchestration path free of generator
  // dependencies and to make dependency injection in tests trivial.
  const mod = await import('./presentationGeneratorService.js');
  return mod.generateOutline(setup, organizationId);
}

async function defaultRecordAudit(payload: PresentationStudioGenerateAuditPayload): Promise<void> {
  const { run: dbRun } = await import('../utils/DbPromise.js');
  await dbRun(
    `INSERT INTO audit_logs (id, timestamp, user_id, action_type, resource_type, resource_id, organization_id, details, ip_address, user_agent, created_at)
     VALUES (gen_random_uuid()::TEXT, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      payload.userId,
      payload.actionType,
      payload.resourceType,
      payload.resourceId,
      payload.organizationId,
      JSON.stringify(payload.details ?? {}),
      payload.ipAddress || null,
      payload.userAgent || null,
    ]
  );
}

function getStudioGenerateDeps(): StudioGenerateDependencies {
  return (
    _studioGenerateDeps ?? {
      generateOutline: defaultGenerateOutline,
      recordAudit: defaultRecordAudit,
    }
  );
}

/**
 * Test-only helper: swap out the generator and audit writer for the duration
 * of a test. Production code MUST NOT call this. Pass `null` to reset to the
 * real defaults.
 */
export function _setStudioGenerateDependenciesForTests(
  deps: StudioGenerateDependencies | null
): void {
  _studioGenerateDeps = deps;
}

/**
 * Phase B of the mutating flow: redeem the approval ticket and invoke the
 * real generator. On success emits the canonical
 * `presentation_generated_via_studio` audit event. On any failure (invalid
 * ticket, generator error) NO audit event is emitted and the deck is not
 * persisted (the underlying `generateOutline` is responsible for
 * transaction-like semantics on its own writes).
 */
export async function executePresentationStudioGenerate(
  input: PresentationStudioGenerateExecuteInput
): Promise<PresentationStudioGenerateExecuteResponse> {
  const expectedFingerprint = buildGeneratePayloadFingerprint({
    organizationId: input.organizationId,
    setup: input.setup,
    outline: input.outline,
    sourcePack: input.sourcePack,
    narrativePlan: input.narrativePlan,
    strict: input.strict,
  });
  const consume = consumeApprovalTicket({
    ticketId: input.ticketId,
    organizationId: input.organizationId,
    userId: input.userId,
    expectedFingerprint,
    now: input.now,
  });
  if (consume.ok === false) {
    return { ok: false, code: 'INVALID_APPROVAL_TICKET', reason: consume.reason };
  }

  const deps = getStudioGenerateDeps();
  const generated = await deps.generateOutline(input.setup, input.organizationId);

  // Sprint S10: run the layout audit on the actual generator output (not
  // the preview). Findings merge into `validationWarnings` so the API
  // response, the audit row, and any consumer logging all see the same
  // honest set of layout flags.
  // Sprint S11: pass the template family resolved from the setup so the
  // audit can apply per-family slot capacity overrides.
  const executeFamily = resolveTemplateFamilyFromSetup(input.setup);
  const layoutAudit = auditPresentationStudioOutlineLayout(generated.outline, {
    templateFamily: executeFamily ?? null,
    organizationId: input.organizationId,
  });
  const mergedValidationWarnings = [
    ...(generated.validationWarnings || []),
    ...layoutAudit.warnings,
  ];

  await deps.recordAudit({
    userId: input.userId,
    organizationId: input.organizationId,
    actionType: 'presentation_generated_via_studio',
    resourceType: 'presentation_deck',
    resourceId: generated.deckId,
    details: {
      ticketId: input.ticketId,
      payloadFingerprint: expectedFingerprint,
      slideCount: generated.outline.length,
      deckTitle: input.setup.title,
      deckGoal: String(input.setup.goal),
      deckAudience: String(input.setup.audience),
      layoutAuditFlagCounts: layoutAudit.flagCounts,
    },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });

  return {
    ok: true,
    result: {
      deckId: generated.deckId,
      slideCount: generated.outline.length,
      outline: generated.outline,
      validationWarnings: mergedValidationWarnings,
      ticketId: consume.ticket.ticketId,
      auditEvent: 'presentation_generated_via_studio',
    },
  };
}
