/** Source-derived canonical identity projection; this is NOT content export.
 * Generic stores accept many aggregate types and arbitrary source content.
 * Keep explicit lineage only until the source privacy contract is verified.
 */
const types = new Set([
  'initiative',
  'source_proposal',
  'task',
  'decision',
  'execution_task',
  'execution_decision',
  'execution_case',
]);
const scalarKeys = [
  'initiativeId',
  'proposalId',
  'proposalVersion',
  'sourceType',
  'sourceId',
  'sourceVersion',
  'executionCaseId',
  'taskId',
  'decisionId',
  'parentId',
  'parentType',
  'documentOrigin',
  'aggregateId',
  'aggregateType',
  'aggregateVersion',
  'version',
  'fromVersion',
  'toVersion',
  'executionCaseVersion',
  'baselineVersion',
  'initiativeVersion',
  'decisionVersion',
  'scheduleVersion',
  'visibility',
  'freshness',
  'cardKey',
  'cardVersion',
  'lifecycleState',
  'status',
  'state',
  'decisionType',
  'policyId',
  'policyVersion',
  'projectId',
  'initiativeOwnerId',
  'ownerId',
  'assigneeId',
  'authorityId',
  'requesterId',
  'createdAt',
  'updatedAt',
  'decidedAt',
  'deleted',
];
function lineage(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of scalarKeys) {
    const item = row[key];
    if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) result[key] = item;
  }
  for (const key of ['source', 'governance', 'policy', 'sourceVersions']) {
    if (row[key] && typeof row[key] === 'object' && !Array.isArray(row[key]))
      result[key] = lineage(row[key]);
  }
  return result;
}
export function projectCanonicalExportLineage(
  row: Record<string, unknown>,
  payloadColumns: readonly string[]
): Record<string, unknown> {
  const safe = { ...row };
  const supported = row.aggregate_type === undefined || types.has(String(row.aggregate_type));
  for (const column of payloadColumns) {
    const value = row[column];
    // Catalog contracts declare JSONB for these fields. Strings are not parsed
    // as a second unverified encoding and never pass raw text to the file.
    safe[column] = supported ? lineage(value) : {};
  }
  safe.export_payload_scope = 'lineage_only_content_unresolved';
  return safe;
}
