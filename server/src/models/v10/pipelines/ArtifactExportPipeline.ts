import type { Artifact } from '../../artifact/Artifact.js';
import type { LineageNode } from '../../artifact/ArtifactVersionLineage.js';
import type {
  EvidenceRef,
  ExportDestination,
  ExportManifest,
} from '../../artifact/ExportManifest.js';
import type {
  FooterTarget,
  ProvenanceFooter,
  TenantWatermarkPolicy,
  WatermarkSpec,
} from '../../artifact/ProvenanceFooter.js';

export type ArtifactExportRunId = string & { readonly __brand: 'ArtifactExportRunId' };

export function unsafeArtifactExportRunId(value: string): ArtifactExportRunId {
  return String(value) as ArtifactExportRunId;
}

export type ArtifactExportPipelineOutput = {
  readonly runId: ArtifactExportRunId;
  readonly manifest: ExportManifest;
  readonly provenanceFooter: ProvenanceFooter;
  readonly lineageRootId: string;
};

export function runArtifactExportPipeline(input: {
  readonly runId: ArtifactExportRunId;
  readonly artifact: Artifact;
  readonly lineageNodes: readonly LineageNode[];
  readonly sha256: string;
  readonly format: string;
  readonly destination: ExportDestination;
  readonly exportedBy: unknown;
  readonly sources: readonly EvidenceRef[];
  readonly confidentialityTags: readonly string[];
  readonly watermark: WatermarkSpec;
  readonly tenantWatermarkPolicy: TenantWatermarkPolicy;
  readonly footerTarget: FooterTarget;
  readonly now: string;
}): ArtifactExportPipelineOutput {
  const sha256Prefix12 = String(input.sha256).slice(0, 12);
  const lineageRootId = String(
    input.lineageNodes.find((n) => n.lineageRootId == null)?.id ?? input.artifact.id
  );

  return {
    runId: input.runId,
    manifest: {
      format: String(input.format),
      destination: input.destination,
      sha256: String(input.sha256),
      sources: input.sources,
    },
    provenanceFooter: {
      sha256Prefix12,
      footerTarget: input.footerTarget,
      watermarkText: input.tenantWatermarkPolicy.watermarkRequired
        ? input.watermark.text || input.tenantWatermarkPolicy.defaultText
        : null,
    },
    lineageRootId,
  };
}
