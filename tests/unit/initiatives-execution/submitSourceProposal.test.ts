import { describe, expect, it } from 'vitest';
import { submitSourceProposal } from '../../../server/src/domain/initiatives-execution/submitSourceProposal';

describe('Source Submit validation', () => {
  const envelope = {
    organizationId: 'o',
    actorId: 'a',
    aggregateType: 'source_proposal',
    aggregateId: 'p',
    expectedVersion: 0,
    clientRequestId: 'r',
    correlationId: 'r',
    policyId: 'policy',
    policyVersion: 1,
    commandType: 'source-proposal.submit',
    createIfMissing: true,
    payload: {
      sourceType: 'assessment-finding',
      sourceId: 'f',
      sourceVersion: 1,
      provenance: {
        system: 'Assessment',
        recordType: 'finding',
        capturedAt: '2026-08-10T10:00:00.000Z',
        evidenceRefs: ['e'],
      },
      title: 't',
      problem: 'p',
      proposedOutcome: null,
      projectId: 'project',
      initiativeOwnerId: 'owner',
      visibility: 'PROJECT' as const,
    },
  };
  it('fails before persistence when exact source version is invalid', async () => {
    await expect(
      submitSourceProposal(null as never, {
        ...envelope,
        payload: { ...envelope.payload, sourceVersion: 0 },
      })
    ).rejects.toThrow('sourceVersion');
  });
  it('fails before persistence when provenance is incomplete', async () => {
    await expect(
      submitSourceProposal(null as never, {
        ...envelope,
        payload: {
          ...envelope.payload,
          provenance: { ...envelope.payload.provenance, evidenceRefs: [], system: '' },
        },
      })
    ).rejects.toThrow('provenance.system');
  });
});
