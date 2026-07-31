import { describe, expect, it } from 'vitest';

import {
  ArtifactFamilyValues as ClientArtifactFamilyValues,
  ArtifactOriginRuntimeValues as ClientArtifactOriginRuntimeValues,
} from '../../../src/services/api/artifactRuns';
import type { ArtifactRunOperationContract } from '../../../src/services/api/artifactRuns';
import {
  ArtifactFamilyValues as ServerArtifactFamilyValues,
  ArtifactOriginRuntimeValues as ServerArtifactOriginRuntimeValues,
  ArtifactRecordSchema,
} from '../../../server/src/types/artifactRegistry';
import type { OperationContract } from '../../../server/src/types/operationContract';

type Assert<T extends true> = T;
type IsMutuallyAssignable<Left, Right> =
  Left extends Right ? (Right extends Left ? true : false) : false;
type OperationContractParity = Assert<
  IsMutuallyAssignable<ArtifactRunOperationContract, OperationContract>
>;

const operationContractParity: OperationContractParity = true;

const legacyArtifactRecord = {
  artifactId: 'artifact-1',
  organizationId: 'org-1',
  outputType: 'report',
  artifactFamily: 'document',
  deliveryState: 'completed',
  titleSnapshot: null,
  ownerUserId: null,
  canonicalHome: 'outputs_library',
  visibilityScope: 'organization',
  projectId: null,
  contextSnapshotId: null,
  executionRunId: null,
  templateFamilyRef: null,
  sourceInitiativeId: null,
  aiGovernancePresetRef: null,
  originSummary: null,
  createdBy: 'user-1',
  createdAt: '2026-07-31T10:00:00.000Z',
  lastTransitionAt: '2026-07-31T10:00:00.000Z',
};

describe('Artifact client/server contract parity', () => {
  it('keeps the operation contract structurally aligned at compile time', () => {
    expect(operationContractParity).toBe(true);
  });

  it('keeps artifact family literals aligned', () => {
    expect(ClientArtifactFamilyValues).toEqual(ServerArtifactFamilyValues);
  });

  it('keeps origin runtime literals aligned', () => {
    expect(ClientArtifactOriginRuntimeValues).toEqual(ServerArtifactOriginRuntimeValues);
  });

  it('normalizes legacy records without isDraft to false', () => {
    expect(ArtifactRecordSchema.parse(legacyArtifactRecord).isDraft).toBe(false);
  });

  it('preserves an explicit draft marker', () => {
    expect(ArtifactRecordSchema.parse({ ...legacyArtifactRecord, isDraft: true }).isDraft).toBe(true);
  });
});
