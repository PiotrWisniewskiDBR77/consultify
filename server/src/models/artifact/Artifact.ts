import type { ArtifactType } from './ArtifactTypeRegistry.js';
import type { DataClassification } from './DataClassification.js';

export type TenantId = string & { readonly __brand: 'ArtifactTenantId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type ArtifactId = string & { readonly __brand: 'ArtifactId' };
export type ArtifactVersionId = string & { readonly __brand: 'ArtifactVersionId' };
export type PolicyId = string & { readonly __brand: 'PolicyId' };
export type RetentionPolicyId = string & { readonly __brand: 'RetentionPolicyId' };

export function unsafeTenantId(value: string): TenantId {
  return String(value) as TenantId;
}

export function unsafeUserId(value: string): UserId {
  return String(value) as UserId;
}

export function unsafeArtifactId(value: string): ArtifactId {
  return String(value) as ArtifactId;
}

export function unsafeArtifactVersionId(value: string): ArtifactVersionId {
  return String(value) as ArtifactVersionId;
}

export function unsafePolicyId(value: string): PolicyId {
  return String(value) as PolicyId;
}

export function unsafeRetentionPolicyId(value: string): RetentionPolicyId {
  return String(value) as RetentionPolicyId;
}

export type EvidenceRef = {
  readonly trustBundleSha256: string;
  readonly sourceHint: string | null;
};

export interface Artifact {
  readonly id: ArtifactId;
  readonly tenantId: TenantId;
  readonly type: ArtifactType;
  readonly ownerId: UserId;
  readonly permissionPolicyId: PolicyId;
  readonly dataClassification: DataClassification;
  readonly retentionPolicyId: RetentionPolicyId;
  readonly reviewState: string;
  readonly currentVersionId: ArtifactVersionId;
  readonly lineageRootId: ArtifactId | null;
  readonly parentArtifactId: ArtifactId | null;
  readonly derivedFromVersionId: ArtifactVersionId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly exportRecords: readonly string[];
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly content: unknown;
}
