export type FinanceArtifactTypeId =
  | 'STATEMENT_PACK'
  | 'BASELINE_MODEL'
  | 'HISTORICAL_ANALYSIS'
  | 'PREDICTION_SCENARIO'
  | 'VALUATION_CASE';

export type FinanceWorkspaceId =
  | 'statementPackV2'
  | 'baseline'
  | 'analysis'
  | 'prediction'
  | 'valuation';

export type FinanceResolveInput = {
  artifactId: string | null | undefined;
  businessVersionId: string | null | undefined;
  artifactType: string | null | undefined;
  legacyId?: string | null;
};

export type FinanceResolveErrorReason =
  | 'MISSING_ARTIFACT_ID'
  | 'MISSING_BUSINESS_VERSION_ID'
  | 'UNKNOWN_ARTIFACT_TYPE'
  | 'ID_COLLISION'
  | 'IDENTITY_MISMATCH';

export type FinanceResolveResult =
  | {
      kind: 'workspace';
      workspace: FinanceWorkspaceId;
      artifactId: string;
      businessVersionId: string;
      artifactType: FinanceArtifactTypeId;
    }
  | { kind: 'error'; reason: FinanceResolveErrorReason };

const WORKSPACE_BY_ARTIFACT_TYPE: Record<FinanceArtifactTypeId, FinanceWorkspaceId> = {
  STATEMENT_PACK: 'statementPackV2',
  BASELINE_MODEL: 'baseline',
  HISTORICAL_ANALYSIS: 'analysis',
  PREDICTION_SCENARIO: 'prediction',
  VALUATION_CASE: 'valuation',
};

function isFinanceArtifactType(value: string): value is FinanceArtifactTypeId {
  return Object.hasOwn(WORKSPACE_BY_ARTIFACT_TYPE, value);
}

export function resolveFinanceWorkspace(input: FinanceResolveInput): FinanceResolveResult {
  const artifactId = input.artifactId?.trim();
  const businessVersionId = input.businessVersionId?.trim();
  const artifactType = input.artifactType?.trim();

  if (!artifactId) return { kind: 'error', reason: 'MISSING_ARTIFACT_ID' };
  if (!businessVersionId) return { kind: 'error', reason: 'MISSING_BUSINESS_VERSION_ID' };
  if (artifactId === businessVersionId) return { kind: 'error', reason: 'ID_COLLISION' };
  if (!artifactType || !isFinanceArtifactType(artifactType)) {
    return { kind: 'error', reason: 'UNKNOWN_ARTIFACT_TYPE' };
  }

  return {
    kind: 'workspace',
    workspace: WORKSPACE_BY_ARTIFACT_TYPE[artifactType],
    artifactId,
    businessVersionId,
    artifactType,
  };
}
