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
import type { TemplateArchitectPlan } from './presentationTemplateArchitectService.js';
import { buildPresentationTemplateArchitectPlan } from './presentationTemplateArchitectService.js';

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
