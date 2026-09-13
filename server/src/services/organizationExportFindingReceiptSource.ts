/** Internal provenance read only. This does not classify or export the audit table. */
type Row = Record<string, unknown>;

export interface FindingReceiptAuditCatalog {
  columns: readonly string[];
  types: Record<string, string>;
  primaryKey: readonly string[];
  foreignKeyCount: number;
}

export interface FindingReceiptSnapshot {
  findingReceiptSnapshotVerified: boolean;
  findingReceipts: Row[];
  findingReceiptInvalidations: Row[];
}

const COLUMN_TYPES: Record<string, string> = {
  id: 'text',
  organization_id: 'text',
  insight_id: 'text',
  finding_id: 'text',
  entity_type: 'text',
  entity_id: 'text',
  action: 'text',
  actor_user_id: 'text',
  detail_json: 'text',
  created_at: 'timestamp without time zone',
};

const ENTITY_TYPE = 'finding_generation_receipt';
const CREATED = 'finding_generation_bound_v1';
const INVALIDATED = 'finding_generation_invalidated_v1';

export async function readFindingReceiptSnapshot(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: Row[] }> },
  organizationId: string,
  findingIds: readonly string[],
  catalog: FindingReceiptAuditCatalog | undefined
): Promise<FindingReceiptSnapshot> {
  const unavailable = (): FindingReceiptSnapshot => ({
    findingReceiptSnapshotVerified: false,
    findingReceipts: [],
    findingReceiptInvalidations: [],
  });
  const expected = Object.keys(COLUMN_TYPES).sort();
  if (
    !organizationId.trim() ||
    !catalog ||
    JSON.stringify([...catalog.columns].sort()) !== JSON.stringify(expected) ||
    expected.some((column) => catalog.types[column] !== COLUMN_TYPES[column]) ||
    catalog.primaryKey.length !== 1 ||
    catalog.primaryKey[0] !== 'id' ||
    catalog.foreignKeyCount !== 0 ||
    findingIds.some((id) => typeof id !== 'string' || !id.trim())
  )
    return unavailable();

  const ids = [...new Set(findingIds)];
  if (!ids.length) return unavailable();
  // Same export client/transaction as the source rows. Both marker kinds are
  // read together; an absent invalidation collection must never imply validity.
  const result = await client.query(
    `SELECT id, organization_id, insight_id, finding_id, entity_type, entity_id,
            action, actor_user_id, detail_json,
            created_at AT TIME ZONE 'UTC' AS created_at
       FROM public.interview_insight_audit_log
      WHERE organization_id = $1 AND finding_id = ANY($2::text[])
        AND entity_type = $3 AND action = ANY($4::text[])
      ORDER BY id`,
    [organizationId, ids, ENTITY_TYPE, [CREATED, INVALIDATED]]
  );
  // Also validate returned identity; do not rely solely on a caller's client.
  if (
    result.rows.some(
      (row) =>
        row.organization_id !== organizationId ||
        typeof row.finding_id !== 'string' ||
        !ids.includes(row.finding_id) ||
        row.entity_type !== ENTITY_TYPE ||
        ![CREATED, INVALIDATED].includes(String(row.action))
    )
  )
    return unavailable();

  return {
    findingReceiptSnapshotVerified: true,
    findingReceipts: result.rows.filter((row) => row.action === CREATED),
    findingReceiptInvalidations: result.rows.filter((row) => row.action === INVALIDATED),
  };
}
