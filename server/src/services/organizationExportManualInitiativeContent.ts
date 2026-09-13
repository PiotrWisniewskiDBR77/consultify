/** MANUAL_HUB source proof from initiativeWriteTruth and Register.
 * Only current source_proposal/initiative state is covered. History, cards and
 * typed children must not inherit content authority from a current parent.
 */
type Row = Record<string, unknown>;
const obj = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
const nonempty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const positive = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0;
export function verifiedManualInitiativeContent(
  organizationId: string,
  states: readonly Row[],
  relations: readonly Row[],
  projects: readonly Row[]
): Set<string> {
  const allowed = new Set<string>();
  const projectIds = new Set(
    projects.filter((row) => row.organization_id === organizationId).map((row) => row.id)
  );
  const proposals = new Map<string, Row>();
  for (const row of states) {
    if (row.organization_id !== organizationId || row.aggregate_type !== 'source_proposal')
      continue;
    const p = obj(row.payload_json),
      provenance = obj(p.provenance);
    if (
      !nonempty(row.aggregate_id) ||
      !positive(row.version) ||
      p.proposalId !== row.aggregate_id ||
      !positive(p.proposalVersion) ||
      p.proposalVersion !== row.version ||
      p.sourceType !== 'MANUAL_HUB' ||
      !nonempty(p.sourceId) ||
      p.sourceVersion !== 1 ||
      !projectIds.has(p.projectId) ||
      !nonempty(p.initiativeOwnerId) ||
      !['PROJECT', 'ORGANIZATION_RESTRICTED'].includes(String(p.visibility)) ||
      provenance.system !== 'consultify.initiatives-hub' ||
      provenance.recordType !== 'manual-initiative-proposal' ||
      !nonempty(provenance.capturedAt) ||
      Number.isNaN(Date.parse(provenance.capturedAt)) ||
      !Array.isArray(provenance.evidenceRefs) ||
      provenance.evidenceRefs.length !== 1 ||
      provenance.evidenceRefs[0] !== `consultify://initiatives/source-proposals/${row.aggregate_id}`
    )
      continue;
    proposals.set(row.aggregate_id, p);
    allowed.add(`source_proposal\0${row.aggregate_id}`);
  }
  for (const row of states) {
    if (row.organization_id !== organizationId || row.aggregate_type !== 'initiative') continue;
    const p = obj(row.payload_json),
      source = obj(p.source);
    if (
      !nonempty(row.aggregate_id) ||
      !positive(row.version) ||
      p.initiativeId !== row.aggregate_id
    )
      continue;
    const proposal = proposals.get(String(source.proposalId));
    if (
      !proposal ||
      source.sourceType !== 'MANUAL_HUB' ||
      source.sourceId !== proposal.sourceId ||
      source.sourceVersion !== proposal.sourceVersion ||
      source.freshness !== 'CURRENT' ||
      source.proposalVersion !== Number(proposal.proposalVersion) + 1 ||
      p.projectId !== proposal.projectId ||
      p.visibility !== proposal.visibility ||
      !projectIds.has(p.projectId)
    )
      continue;
    // Register increments the relational candidate disposition version, not the
    // source_proposal aggregate version. The relation records the PRE version.
    const claimed = relations.some((relation) => {
      const payload = obj(relation.payload_json);
      return (
        relation.organization_id === organizationId &&
        relation.relation_type === 'SOURCE_REGISTRATION' &&
        relation.source_type === 'MANUAL_HUB' &&
        relation.source_id === source.sourceId &&
        relation.source_version === source.sourceVersion &&
        relation.target_type === 'initiative' &&
        relation.target_id === row.aggregate_id &&
        payload.proposalId === source.proposalId &&
        payload.proposalVersion === proposal.proposalVersion &&
        payload.disposition === 'REGISTER'
      );
    });
    if (claimed) allowed.add(`initiative\0${row.aggregate_id}`);
  }
  return allowed;
}
