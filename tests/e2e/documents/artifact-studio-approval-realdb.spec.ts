import { expect, test, type APIRequestContext } from '@playwright/test';

import { API_BASE_URL, authHeaders, seedDocumentArtifact } from './_document-studio-helpers';

const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

type TestIdentity = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
};

const supportHeaders = {
  'x-test-support-key': TEST_SUPPORT_KEY,
  'content-type': 'application/json',
};

async function bootstrap(request: APIRequestContext, runId: string): Promise<TestIdentity> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
    headers: supportHeaders,
    data: { runId, role: 'ADMIN' },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as TestIdentity;
}

async function createReviewer(request: APIRequestContext, runId: string): Promise<TestIdentity> {
  const response = await request.post(`${API_BASE_URL}/api/test-support/member`, {
    headers: supportHeaders,
    data: { runId, role: 'ADMIN' },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as TestIdentity;
}

test.describe('Document approval governance on realDB [@module:documents]', () => {
  test.setTimeout(240_000);

  test('forbids self-approval and cold-hydrates the durable approved state with audit', async ({
    request,
  }) => {
    const runId = `doc-approval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await bootstrap(request, runId);

    try {
      const reviewer = await createReviewer(request, runId);
      expect(reviewer.organizationId).toBe(owner.organizationId);
      expect(reviewer.userId).not.toBe(owner.userId);

      const { artifactId, schema } = await seedDocumentArtifact(request, owner.token, {
        title: `Document approval realDB ${Date.now()}`,
        documentType: 'business_case',
        description: 'Verify independent approval persistence and cold hydration.',
      });
      expect(artifactId).not.toBe('');

      const selfOnlyRequest = await request.post(
        `${API_BASE_URL}/api/document-studio/${artifactId}/approvals`,
        {
          headers: authHeaders(owner.token),
          data: {
            participants: [{ userId: owner.userId, required: true }],
            quorumPolicy: 'single_approval',
          },
        }
      );
      expect(selfOnlyRequest.status()).toBe(403);
      expect(await selfOnlyRequest.json()).toMatchObject({
        error: 'self_approval_forbidden',
      });

      const requestApproval = await request.post(
        `${API_BASE_URL}/api/document-studio/${artifactId}/approvals`,
        {
          headers: authHeaders(owner.token),
          data: {
            participants: [
              { userId: owner.userId, required: false, role: 'Author' },
              { userId: reviewer.userId, required: true, role: 'Independent reviewer' },
            ],
            quorumPolicy: 'single_approval',
            reason: 'RealDB approval durability evidence',
          },
        }
      );
      expect(requestApproval.status(), await requestApproval.text()).toBe(201);
      const approval = (await requestApproval.json()).approval as {
        approvalId: string;
        status: string;
        versionId?: string;
      };
      expect(approval.approvalId).toMatch(/^approval-/);
      expect(approval.status).toBe('pending');
      expect(approval.versionId).toBeTruthy();

      const ownerDecision = await request.post(
        `${API_BASE_URL}/api/document-studio/${artifactId}/approvals/${approval.approvalId}/decisions`,
        {
          headers: authHeaders(owner.token),
          data: { kind: 'approve', comment: 'An author must not approve their own version.' },
        }
      );
      expect(ownerDecision.status()).toBe(403);
      expect(await ownerDecision.json()).toMatchObject({ error: 'self_approval_forbidden' });

      const reviewerDecision = await request.post(
        `${API_BASE_URL}/api/document-studio/${artifactId}/approvals/${approval.approvalId}/decisions`,
        {
          headers: authHeaders(reviewer.token),
          data: { kind: 'approve', comment: 'Independent approval on durable storage.' },
        }
      );
      expect(reviewerDecision.status(), await reviewerDecision.text()).toBe(201);
      expect((await reviewerDecision.json()).approval).toMatchObject({ status: 'approved' });

      const reset = await request.post(
        `${API_BASE_URL}/api/test-support/document-approval-cache/reset`,
        {
          headers: {
            ...supportHeaders,
            authorization: `Bearer ${owner.token}`,
          },
        }
      );
      expect(reset.status(), await reset.text()).toBe(204);

      const coldRead = await request.get(
        `${API_BASE_URL}/api/document-studio/${artifactId}/approvals/${approval.approvalId}`,
        { headers: authHeaders(owner.token) }
      );
      expect(coldRead.ok(), await coldRead.text()).toBe(true);
      expect((await coldRead.json()).approval).toMatchObject({
        approvalId: approval.approvalId,
        artifactId,
        status: 'approved',
        requestedBy: owner.userId,
        decisions: [expect.objectContaining({ reviewerId: reviewer.userId, kind: 'approve' })],
      });

      const auditRead = await request.get(
        `${API_BASE_URL}/api/document-studio/${artifactId}/approvals/${approval.approvalId}/audit`,
        { headers: authHeaders(owner.token) }
      );
      expect(auditRead.ok(), await auditRead.text()).toBe(true);
      const events = ((await auditRead.json()).auditEntries || []) as Array<{ action: string }>;
      expect(events.map((entry) => entry.action)).toEqual(
        expect.arrayContaining([
          'approval_requested',
          'approval_decision_recorded',
          'approval_resolved',
        ])
      );

      const materialEdit = await request.put(
        `${API_BASE_URL}/api/document-studio/${artifactId}/content`,
        {
          headers: authHeaders(owner.token),
          data: {
            expectedVersion: schema.updatedAt,
            sections: schema.sections.map((section: any, index: number) =>
              index === 0
                ? {
                    ...section,
                    title: `${section.title} — materially revised`,
                  }
                : section
            ),
          },
        }
      );
      expect(materialEdit.ok(), await materialEdit.text()).toBe(true);
      const editedVersion = (await materialEdit.json()).schema.updatedAt as string;
      expect(editedVersion).not.toBe(schema.updatedAt);

      const staleRead = await request.get(
        `${API_BASE_URL}/api/document-studio/${artifactId}/approvals/${approval.approvalId}`,
        { headers: authHeaders(owner.token) }
      );
      expect(staleRead.ok(), await staleRead.text()).toBe(true);
      expect((await staleRead.json()).approval).toMatchObject({
        approvalId: approval.approvalId,
        status: 'approved',
        currentForVersion: false,
        effectiveStatus: 'stale',
      });

      const finalExport = await request.get(
        `${API_BASE_URL}/api/document-studio/${artifactId}/export/markdown?mode=final`,
        { headers: authHeaders(owner.token) }
      );
      const finalExportBody = await finalExport.json();
      expect(finalExport.status(), JSON.stringify(finalExportBody)).toBe(409);
      expect(finalExportBody).toMatchObject({
        code: 'ARTIFACT_EXPORT_BLOCKED',
        blocks: expect.arrayContaining(['CURRENT_APPROVAL_REQUIRED']),
      });

      const staleAuditRead = await request.get(
        `${API_BASE_URL}/api/document-studio/${artifactId}/approvals/${approval.approvalId}/audit`,
        { headers: authHeaders(owner.token) }
      );
      expect(staleAuditRead.ok(), await staleAuditRead.text()).toBe(true);
      const staleEvents = ((await staleAuditRead.json()).auditEntries || []) as Array<{
        action: string;
        details?: Record<string, unknown>;
      }>;
      expect(staleEvents).toContainEqual(
        expect.objectContaining({
          action: 'approval_became_stale',
          details: expect.objectContaining({
            approvedVersionId: schema.updatedAt,
            currentVersionId: editedVersion,
            reason: 'material_content_changed',
          }),
        })
      );
    } finally {
      const cleanup = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
        headers: supportHeaders,
        data: { runId },
        timeout: 180_000,
      });
      expect(cleanup.ok(), await cleanup.text()).toBe(true);
    }
  });
});
