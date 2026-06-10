/**
 * Real Artifact Materializer for Table → Doc/Deck conversion (Block D · D-S3).
 *
 * Replaces the D-S1 `stubMaterializer` (which returned `stub-run-<id>` and a
 * null deep link). This bridges a Tabele table conversion into the canonical
 * V8 artifact runtime by registering a real `v8_output_artifacts` row via
 * `registerArtifactOrigin` and computing the deep link into the matching
 * editor surface (Report Builder for documents, Presentations for decks).
 *
 * Why `registerArtifactOrigin` rather than the full chat planning flow
 * (`createArtifactRunFromChat` → preflight → accept → approve →
 * `materializeArtifactRun`)?
 *
 *   - A table conversion has no conversation / contextSnapshot, which the
 *     chat planning flow requires. `registerArtifactOrigin` is the canonical
 *     entry point for non-chat origins (it is the same primitive
 *     `materializeArtifactRun` ultimately calls). It produces a real canonical
 *     artifact in the Outputs library, idempotently keyed on
 *     `(organizationId, originRuntime, originRecordId)` so re-converting the
 *     same table updates the existing artifact instead of duplicating it.
 *   - The conversion's `artifact_run_id` column is reused to carry the
 *     canonical `artifactId`; the deep link points at the editor route that
 *     can open it.
 *
 * Cross-tenant safety: `TableArtifactConversionService.convertTable` has
 * already asserted the table belongs to the actor's organization before this
 * materializer is invoked, and `registerArtifactOrigin` scopes every write to
 * `organizationId`.
 */

import logger from '../../utils/Logger.js';
import { registerArtifactOrigin } from '../v8/artifactRegistryService.js';
import type {
  ArtifactMaterializer,
  ConversionMaterializeRequest,
  ConversionMaterializeResult,
} from './TableArtifactConversionService.js';

/** Map a conversion target onto the artifact-runtime triple. */
function planForTarget(target: ConversionMaterializeRequest['target']): {
  outputType: 'report' | 'presentation';
  artifactFamily: 'document' | 'presentation';
  originRuntime: 'report' | 'presentation';
  deepLinkBase: string;
} {
  if (target === 'presentation') {
    return {
      outputType: 'presentation',
      artifactFamily: 'presentation',
      originRuntime: 'presentation',
      deepLinkBase: '/presentations',
    };
  }
  return {
    outputType: 'report',
    artifactFamily: 'document',
    originRuntime: 'report',
    deepLinkBase: '/reports/builder',
  };
}

export const realArtifactMaterializer: ArtifactMaterializer = {
  async materialize(req: ConversionMaterializeRequest): Promise<ConversionMaterializeResult> {
    const plan = planForTarget(req.target);

    // The origin record is the conversion run itself, so re-running a
    // conversion for the same table produces a fresh artifact per run while
    // staying traceable back to the conversion lifecycle row.
    const originRecordId = `table-conversion:${req.conversionId}`;
    const titleSnapshot =
      req.title && req.title.trim().length > 0 ? req.title.trim() : `Table export (${req.target})`;

    const artifact = await registerArtifactOrigin({
      organizationId: req.organizationId,
      outputType: plan.outputType,
      artifactFamily: plan.artifactFamily,
      originRuntime: plan.originRuntime,
      originRecordId,
      titleSnapshot,
      ownerUserId: req.initiatedBy,
      createdBy: req.initiatedBy,
      deliveryState: 'draft',
      visibilityScope: 'organization',
      originSummary: {
        sourceRuntime: 'tabele',
        sourceTableId: req.tableId,
        sourcePackId: req.sourcePackId,
        conversionId: req.conversionId,
        target: req.target,
        recordCount: req.snapshot.records.length,
        fieldCount: req.snapshot.fields.length,
        outlineProvided: Boolean(req.outline && req.outline.length > 0),
      },
    });

    if (!artifact?.artifactId) {
      throw new Error('registerArtifactOrigin returned no artifactId');
    }

    const artifactDeepLink = `${plan.deepLinkBase}/${artifact.artifactId}`;

    logger.info('[conversionMaterializer] materialized table conversion', {
      conversionId: req.conversionId,
      tableId: req.tableId,
      target: req.target,
      artifactId: artifact.artifactId,
    });

    return {
      // artifact_run_id is a uuid column; the canonical artifactId is a uuid.
      artifactRunId: artifact.artifactId,
      artifactDeepLink,
    };
  },
};

export default realArtifactMaterializer;
