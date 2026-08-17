import { Api } from './api';

export type GovernedClaimReviewState = 'pending' | 'approved' | 'rejected';

export interface GovernedClaim {
  claimId: string;
  itemId: string;
  claimPath: string;
  value: unknown;
  confidence: number;
  sourceType: string;
  visibilityScope: string;
  reviewState: GovernedClaimReviewState;
  approved: boolean;
  approvalSource: 'explicit_review' | 'legacy_auto_accept';
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface ClaimDecision {
  claimId: string;
  reviewState: GovernedClaimReviewState;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  wonDecision: boolean;
}

export interface GovernedSnapshotVersion {
  snapshotId: string;
  organizationId: string;
  version: number;
  schemaVersion: number;
  contentHash: string;
  claimCount: number;
  createdAt: string;
  createdBy: string;
}

export interface GovernedSourceRef {
  claimId: string;
  itemId: string;
  sourceType: string;
  sourceDocId: string | null;
  fileHash: string | null;
  docVersion: number | null;
  dangling: boolean;
  danglingReason: 'deleted' | 'soft_deleted' | 'hash_mismatch' | null;
}

export interface PinnedGovernedSnapshot extends GovernedSnapshotVersion {
  claims: GovernedClaim[];
  sourceRefs: GovernedSourceRef[];
}

export interface GovernedDocumentIngestResult {
  success: boolean;
  docId: string;
  filename: string;
  mimeType?: string;
  extractionStatus?: string;
}

const root = '/organization-context/governed';

export const organizationGovernedContextApi = {
  async ingestDocument(file: File): Promise<GovernedDocumentIngestResult> {
    return Api.uploadChatAttachment(file);
  },

  async listClaims(limit = 200): Promise<GovernedClaim[]> {
    const response = (await Api.get(`${root}/claims?limit=${limit}`)) as {
      claims?: GovernedClaim[];
    };
    return response.claims ?? [];
  },

  async decide(
    claimId: string,
    decision: 'approve' | 'reject',
    note?: string
  ): Promise<ClaimDecision> {
    return (await Api.post(
      `${root}/claims/${encodeURIComponent(claimId)}/${decision}`,
      note ? { note } : {}
    )) as ClaimDecision;
  },

  async publish(): Promise<GovernedSnapshotVersion> {
    return (await Api.post(`${root}/publish`, {})) as GovernedSnapshotVersion;
  },

  async listVersions(limit = 20): Promise<GovernedSnapshotVersion[]> {
    const response = (await Api.get(`${root}/versions?limit=${limit}`)) as {
      versions?: GovernedSnapshotVersion[];
    };
    return response.versions ?? [];
  },

  async getVersion(version: number): Promise<PinnedGovernedSnapshot> {
    return (await Api.get(`${root}/versions/${version}`)) as PinnedGovernedSnapshot;
  },
};
