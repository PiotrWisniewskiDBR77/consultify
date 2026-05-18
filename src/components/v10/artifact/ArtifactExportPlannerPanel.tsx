import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Artifact, UserId } from '@/models/artifact/Artifact';
import {
  EXPORT_FORMATS,
  type ExportFormat,
  getArtifactTypeSpec,
} from '@/models/artifact/ArtifactTypeRegistry';
import type { LineageNode } from '@/models/artifact/ArtifactVersionLineage';
import {
  type EvidenceRef as ExportEvidenceRef,
  EXPORT_DESTINATIONS,
} from '@/models/artifact/ExportManifest';
import {
  FOOTER_TARGETS,
  type FooterTarget,
  type TenantWatermarkPolicy,
} from '@/models/artifact/ProvenanceFooter';
import type {
  ArtifactExportPlanRequest,
  ArtifactExportPlanResponse,
} from '@/services/api/v10/artifactRuntime';

import { ArtifactRuntimePanelShell } from './ArtifactRuntimePanelShell';

interface ArtifactExportPlannerPanelProps {
  artifact: Artifact;
  lineageNodes: readonly LineageNode[];
  exportedBy: UserId;
  sources: readonly ExportEvidenceRef[];
  tenantWatermarkPolicy: TenantWatermarkPolicy;
  enabled?: boolean;
  isPlanning?: boolean;
  lastPlan?: ArtifactExportPlanResponse | null;
  error?: string | null;
  defaultFormat?: ExportFormat;
  defaultDestination?: (typeof EXPORT_DESTINATIONS)[number];
  defaultFooterTarget?: FooterTarget;
  defaultTags?: readonly string[];
  defaultSha256?: string;
  defaultWatermarkText?: string;
  onPlan: (request: ArtifactExportPlanRequest) => void | Promise<unknown>;
}

export function ArtifactExportPlannerPanel({
  artifact,
  lineageNodes,
  exportedBy,
  sources,
  tenantWatermarkPolicy,
  enabled = true,
  isPlanning = false,
  lastPlan,
  error,
  defaultFormat,
  defaultDestination = 'download',
  defaultFooterTarget = 'pdf_footer',
  defaultTags = [],
  defaultSha256 = '',
  defaultWatermarkText,
  onPlan,
}: ArtifactExportPlannerPanelProps) {
  const artifactSpec = useMemo(() => getArtifactTypeSpec(artifact.type), [artifact.type]);
  const availableFormats =
    artifactSpec.exportFormats.length > 0 ? artifactSpec.exportFormats : EXPORT_FORMATS;

  const [format, setFormat] = useState<ExportFormat>(defaultFormat ?? availableFormats[0]);
  const [destination, setDestination] =
    useState<(typeof EXPORT_DESTINATIONS)[number]>(defaultDestination);
  const [footerTarget, setFooterTarget] = useState<FooterTarget>(defaultFooterTarget);
  const [sha256, setSha256] = useState(defaultSha256);
  const [watermarkText, setWatermarkText] = useState(
    defaultWatermarkText ?? tenantWatermarkPolicy.defaultText ?? ''
  );
  const [tags, setTags] = useState(defaultTags.join(', '));
  const supportedFormats = lastPlan?.supportedFormats ?? [];
  const exportWarnings = lastPlan?.warnings ?? [];

  const handlePlan = () =>
    onPlan({
      artifact,
      lineageNodes,
      sha256,
      format,
      destination,
      exportedBy,
      sources,
      confidentialityTags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      watermark: {
        text: watermarkText,
        label: tenantWatermarkPolicy.watermarkRequired ? 'Tenant watermark policy' : undefined,
      },
      tenantWatermarkPolicy,
      footerTarget,
    });

  return (
    <ArtifactRuntimePanelShell
      title="Artifact Export Planner"
      description="Build an export plan with manifest, footer target, and watermark policy inputs."
      badge={enabled ? 'Enabled' : 'Flagged off'}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <Badge variant="outline">{artifact.type}</Badge>
        <Badge variant="outline">{sources.length} evidence refs</Badge>
        <Badge variant="outline">{lineageNodes.length} lineage nodes</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="artifact-export-format">Export format</Label>
          <select
            id="artifact-export-format"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={format}
            onChange={(event) => setFormat(event.target.value as ExportFormat)}
          >
            {availableFormats.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="artifact-export-destination">Destination</Label>
          <select
            id="artifact-export-destination"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={destination}
            onChange={(event) =>
              setDestination(event.target.value as (typeof EXPORT_DESTINATIONS)[number])
            }
          >
            {EXPORT_DESTINATIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="artifact-export-footer-target">Footer target</Label>
          <select
            id="artifact-export-footer-target"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={footerTarget}
            onChange={(event) => setFooterTarget(event.target.value as FooterTarget)}
          >
            {FOOTER_TARGETS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="artifact-export-sha">Payload SHA-256</Label>
          <Input
            id="artifact-export-sha"
            value={sha256}
            onChange={(event) => setSha256(event.target.value)}
            placeholder="64-char lowercase hex digest"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="artifact-export-watermark">Watermark text</Label>
        <Textarea
          id="artifact-export-watermark"
          value={watermarkText}
          onChange={(event) => setWatermarkText(event.target.value)}
          placeholder="Optional watermark text"
        />
        <p className="text-xs text-slate-500">
          {tenantWatermarkPolicy.watermarkRequired
            ? 'Tenant policy requires a non-empty watermark.'
            : 'Watermark is optional for this tenant policy.'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="artifact-export-tags">Confidentiality tags</Label>
        <Input
          id="artifact-export-tags"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="confidential, board, external-share"
        />
      </div>

      <Button
        type="button"
        onClick={handlePlan}
        loading={isPlanning}
        disabled={!enabled || !sha256.trim()}
        size="sm"
      >
        Plan export
      </Button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {lastPlan ? (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div className="flex flex-wrap gap-2">
            <Badge>{lastPlan.manifest.format ?? format}</Badge>
            <Badge variant="outline">{lastPlan.manifest.destination ?? destination}</Badge>
            <Badge variant="outline">{lastPlan.provenanceFooter.target ?? footerTarget}</Badge>
          </div>
          <p>{supportedFormats.join(', ')}</p>
          {exportWarnings.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {exportWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </ArtifactRuntimePanelShell>
  );
}
