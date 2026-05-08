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

import type { DeckSetup } from './presentationGeneratorService.js';
import type {
  PresentationSourcePack,
  PresentationSourcePackPreflight,
} from './presentationSourcePackService.js';
import { preflightPresentationSourcePack } from './presentationSourcePackService.js';

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
