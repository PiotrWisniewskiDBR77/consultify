import type {
  ArtifactFamily,
  ArtifactOriginRuntime,
  ArtifactPlanOutputType,
} from '../../types/artifactRegistry.js';
import type { ArtifactType as PublishArtifactType } from '../../types/publishReviewSemantics.js';
import { AppError } from '../../utils/ErrorHandler.js';

export const ARTIFACT_TYPE_MAPPING_INVALID = 'ARTIFACT_TYPE_MAPPING_INVALID';

export interface CanonicalArtifactTypeMapping {
  artifactFamily: ArtifactFamily;
  outputType: ArtifactPlanOutputType;
  publishArtifactType: PublishArtifactType;
  allowedOriginRuntimes: readonly ArtifactOriginRuntime[];
}

const CANONICAL_MAPPINGS = {
  'document:report': {
    artifactFamily: 'document',
    outputType: 'report',
    publishArtifactType: 'report',
    allowedOriginRuntimes: ['report', 'native_artifact', 'assessment_report', 'work_canvas'],
  },
  'presentation:presentation': {
    artifactFamily: 'presentation',
    outputType: 'presentation',
    publishArtifactType: 'presentation',
    allowedOriginRuntimes: ['presentation'],
  },
  'sheet:sheet': {
    artifactFamily: 'sheet',
    outputType: 'sheet',
    publishArtifactType: 'sheet',
    allowedOriginRuntimes: ['sheet'],
  },
  'template:report': {
    artifactFamily: 'template',
    outputType: 'report',
    publishArtifactType: 'report',
    allowedOriginRuntimes: ['report_template', 'document_template'],
  },
  'template:presentation': {
    artifactFamily: 'template',
    outputType: 'presentation',
    publishArtifactType: 'presentation',
    allowedOriginRuntimes: ['presentation_template'],
  },
  'template:sheet': {
    artifactFamily: 'template',
    outputType: 'sheet',
    publishArtifactType: 'sheet',
    allowedOriginRuntimes: ['sheet_template'],
  },
} as const satisfies Record<string, CanonicalArtifactTypeMapping>;

export function mapCanonicalArtifactType(params: {
  artifactFamily: ArtifactFamily;
  outputType: ArtifactPlanOutputType;
}): CanonicalArtifactTypeMapping {
  const key = `${params.artifactFamily}:${params.outputType}` as keyof typeof CANONICAL_MAPPINGS;
  const mapping = CANONICAL_MAPPINGS[key];
  if (!mapping) {
    throw new AppError(
      `Unsupported artifact family/output pair: ${params.artifactFamily}/${params.outputType}`,
      400,
      ARTIFACT_TYPE_MAPPING_INVALID,
      { artifactFamily: params.artifactFamily, outputType: params.outputType }
    );
  }
  return mapping;
}

export function mapExplicitArtifactRunType(params: {
  artifactFamily?: ArtifactFamily;
  outputType?: ArtifactPlanOutputType;
}): CanonicalArtifactTypeMapping | null {
  if (!params.artifactFamily && !params.outputType) return null;
  if (params.artifactFamily === 'template' && !params.outputType) {
    throw new AppError(
      'Template artifact family requires an explicit output type',
      400,
      ARTIFACT_TYPE_MAPPING_INVALID,
      { artifactFamily: 'template', outputType: null }
    );
  }

  const artifactFamily =
    params.artifactFamily ||
    (params.outputType === 'presentation'
      ? 'presentation'
      : params.outputType === 'sheet'
        ? 'sheet'
        : 'document');
  const outputType =
    params.outputType ||
    (artifactFamily === 'presentation'
      ? 'presentation'
      : artifactFamily === 'sheet'
        ? 'sheet'
        : 'report');
  return mapCanonicalArtifactType({ artifactFamily, outputType });
}
