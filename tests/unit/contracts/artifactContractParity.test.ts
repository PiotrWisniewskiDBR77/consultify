import { describe, expect, it } from 'vitest';

import {
  ArtifactFamilyValues as ClientArtifactFamilyValues,
  ArtifactOriginRuntimeValues as ClientArtifactOriginRuntimeValues,
  normalizeArtifactRunStatusFields,
} from '../../../src/services/api/artifactRuns';
import type {
  ArtifactRunOperationContract,
  ArtifactRunRecord as ClientArtifactRunRecord,
} from '../../../src/services/api/artifactRuns';
import {
  ArtifactFamilyValues as ServerArtifactFamilyValues,
  ArtifactOriginRuntimeValues as ServerArtifactOriginRuntimeValues,
  ArtifactRecordSchema,
} from '../../../server/src/types/artifactRegistry';
import type { OperationContract } from '../../../server/src/types/operationContract';
import type { ArtifactRunRecord as ServerArtifactRunRecord } from '../../../server/src/types/artifactRegistry';

type Assert<T extends true> = T;
type IsMutuallyAssignable<Left, Right> =
  Left extends Right ? (Right extends Left ? true : false) : false;
type OperationContractParity = Assert<
  IsMutuallyAssignable<ArtifactRunOperationContract, OperationContract>
>;

const operationContractParity: OperationContractParity = true;
type StatusContractParity = Assert<
  IsMutuallyAssignable<
    Pick<ClientArtifactRunRecord, 'runStatus' | 'persistedRunStatus' | 'effectiveRunStatus'>,
    Pick<ServerArtifactRunRecord, 'runStatus' | 'persistedRunStatus' | 'effectiveRunStatus'>
  >
>;
const statusContractParity: StatusContractParity = true;

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

  it('keeps explicit run status fields structurally aligned at compile time', () => {
    expect(statusContractParity).toBe(true);
  });

  it('normalizes an older run payload without deriving a competing lifecycle state', () => {
    const legacyRun = {
      runId: 'run-legacy',
      runStatus: 'proposal_created',
    } as Omit<ClientArtifactRunRecord, 'persistedRunStatus' | 'effectiveRunStatus'>;
    expect(normalizeArtifactRunStatusFields(legacyRun)).toEqual(
      expect.objectContaining({
        runStatus: 'proposal_created',
        persistedRunStatus: 'proposal_created',
        effectiveRunStatus: 'proposal_created',
      }),
    );
  });

  it('keeps backend effective status canonical when explicit fields differ', () => {
    const payload = {
      runId: 'run-current',
      runStatus: 'planned',
      persistedRunStatus: 'proposal_created',
      effectiveRunStatus: 'applying',
    } as ClientArtifactRunRecord;
    expect(normalizeArtifactRunStatusFields(payload)).toEqual(
      expect.objectContaining({
        runStatus: 'applying',
        persistedRunStatus: 'proposal_created',
        effectiveRunStatus: 'applying',
      }),
    );
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
