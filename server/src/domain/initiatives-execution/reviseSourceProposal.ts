import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export async function reviseSourceProposal(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    expectedProposalVersion: number;
    expectedSourceVersion: number;
    sourceVersion: number;
    provenance: { system: string; recordType: string; capturedAt: string; evidenceRefs: string[] };
  }>
): Promise<
  MaterialCommandResult<{ proposalId: string; proposalVersion: number; sourceVersion: number }>
> {
  if (
    envelope.aggregateType !== 'source_proposal' ||
    envelope.commandType !== 'source-proposal.revise'
  )
    throw new MaterialCommandValidationError('Invalid Source Proposal revision');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const current = await tx.getSourceProposalForUpdate(
      envelope.organizationId,
      envelope.aggregateId
    );
    const p = envelope.payload;
    if (
      !current ||
      current.version !== p.expectedProposalVersion ||
      current.sourceVersion !== p.expectedSourceVersion
    )
      throw new MaterialCommandValidationError('Exact Source Proposal snapshot required');
    if (
      p.sourceVersion <= current.sourceVersion ||
      !p.provenance.evidenceRefs.length ||
      !Number.isFinite(Date.parse(p.provenance.capturedAt))
    )
      throw new MaterialCommandValidationError('Forward source version with evidence required');
    if (!tx.reviseSourceProposal)
      throw new MaterialCommandValidationError('Source revision persistence unavailable');
    await tx.reviseSourceProposal({
      organizationId: envelope.organizationId,
      proposalId: envelope.aggregateId,
      expectedProposalVersion: p.expectedProposalVersion,
      sourceVersion: p.sourceVersion,
      provenance: p.provenance,
    });
    const response = {
      proposalId: envelope.aggregateId,
      proposalVersion: p.expectedProposalVersion + 1,
      sourceVersion: p.sourceVersion,
    };
    return {
      mutation: { ...current, ...response, provenance: p.provenance },
      response,
      eventType: 'source-proposal.revised',
      eventPayload: response,
      auditPayload: response,
    };
  });
}
