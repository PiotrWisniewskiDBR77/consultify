/**
 * W67 evidence harness. Every mode mounts the real product component; the
 * harness supplies deterministic API rows only.
 *
 * Query: &module=n1|n2|n4. This file is copied unchanged into the exact-base
 * worktree for BEFORE evidence, so only product code differs.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { AuditPackSummary } from '@/components/Audit/method/auditsMethodApi';
import { AuditLibraryTab } from '@/components/Audit/method/tabs/AuditLibraryTab';
import { GovernedContextWorkspace } from '@/components/Organization/GovernedContextWorkspace';
import { Api } from '@/services/api';
import {
  type GovernedClaim,
  organizationGovernedContextApi,
} from '@/services/organizationGovernedContextApi';

import Day267MaterialyHubZrzutyScreen from './day267-materialy-hub-zrzuty';

const moduleKey = new URLSearchParams(window.location.search).get('module') || 'n1';

const auditPack: AuditPackSummary = {
  id: 'w67-audit-pack',
  packKey: 'w67-audit-pack',
  version: 1,
  title: 'Operational control audit',
  summary: 'Nine criteria across three control areas',
  sourceId: 'w67-source',
  sourceTitle: 'Operating standard',
  sourceVersion: '1',
  sourceType: 'INTERNAL_PROCEDURE',
  verificationStatus: 'VERIFIED',
  publicationStatus: 'published',
  requiredRoles: [],
  criteriaCount: 9,
  updatedAt: '2026-09-14T12:00:00.000Z',
  expertApprovedBy: 'expert-1',
};

const detailCriteria = Array.from({ length: 3 }, (_, index) => ({
  id: `root-${index + 1}`,
  parentId: null,
  ordinal: index + 1,
  refCode: `C${index + 1}`,
  nodeKind: 'control_area',
  title: `Control area ${index + 1}`,
  mandatory: true,
}));

const claims: GovernedClaim[] = Array.from({ length: 200 }, (_, index) => ({
  claimId: `claim-${index + 1}`,
  itemId: `source-${index + 1}`,
  claimPath: `profile.control_${index + 1}`,
  value: `Governed value ${index + 1}`,
  confidence: 0.9,
  sourceType: 'document',
  visibilityScope: 'organization',
  reviewState: 'approved',
  approved: true,
  approvalSource: 'explicit_review',
  decidedBy: 'owner-1',
  decidedAt: '2026-09-14T12:00:00.000Z',
  createdAt: '2026-09-14T11:00:00.000Z',
}));

function AuditEvidence(): React.ReactElement {
  (Api as unknown as { get: (path: string) => Promise<unknown> }).get = async (path) => {
    if (!path.startsWith('/audits/packs/')) throw new Error(`Unexpected evidence API path: ${path}`);
    return {
      data: {
        success: true,
        data: {
          pack: {
            ...auditPack,
            purpose: 'Verify operating controls',
            scope: 'Whole organization',
            objectives: null,
            auditType: 'compliance',
            requiredCompetencies: [],
            findingTaxonomy: [],
            rightsStatus: 'licensed',
            rightsNote: null,
          },
          criteria: detailCriteria,
        },
      },
    };
  };
  return (
    <MemoryRouter>
      <div className="h-screen bg-c-app p-6 text-c-text" data-testid="w67-real-audit-module">
        <AuditLibraryTab
          packs={[auditPack]}
          loading={false}
          error={null}
          onRetry={() => undefined}
          isPolish={false}
          onStartAudit={() => undefined}
          startingPackId={null}
          canManagePackLibrary
          onApprovePackExpert={() => undefined}
          onPublishPack={() => undefined}
          pendingPackActionKey={null}
        />
      </div>
    </MemoryRouter>
  );
}

function ClaimsEvidence(): React.ReactElement {
  const api = organizationGovernedContextApi as unknown as {
    listClaims: () => Promise<GovernedClaim[]>;
    listClaimsPage?: () => Promise<{ claims: GovernedClaim[]; total: number; limit: number }>;
    listVersions: () => Promise<[]>;
  };
  api.listClaims = async () => claims;
  api.listClaimsPage = async () => ({ claims, total: 727, limit: 200 });
  api.listVersions = async () => [];
  return (
    <div className="min-h-screen bg-c-app p-6 text-c-text" data-testid="w67-real-claims-module">
      <GovernedContextWorkspace isAdmin={false} />
    </div>
  );
}

export default function D3CounterDriftW67Screen(): React.ReactElement {
  if (moduleKey === 'n2') return <AuditEvidence />;
  if (moduleKey === 'n4') return <ClaimsEvidence />;
  return <Day267MaterialyHubZrzutyScreen />;
}
