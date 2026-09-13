import type { PoolClient } from 'pg';
import {
  canExportInterviewDecisionContent,
  projectDecisionSourceIdentity,
} from './organizationExportDecisionPrivacy.js';
import { projectPersonalTaskExport } from './organizationExportTaskPrivacy.js';
import { verifiedManualInitiativeContent } from './organizationExportManualInitiativeContent.js';
import { projectCanonicalExportLineage } from './organizationExportCanonicalLineage.js';
import { projectInterviewExportRow } from './organizationExportInterviewPrivacy.js';
import { readFindingReceiptSnapshot } from './organizationExportFindingReceiptSource.js';

import {
  assertNotReservedOrganizationId,
  type OrganizationExportResult,
} from './organizationLifecycleService.js';
import {
  ORGANIZATION_EXPORT_POLICY_VERSION,
  ORGANIZATION_EXPORT_TABLES,
  type OrganizationExportTableContract,
} from './organizationExportContract.js';

const SCHEMAS = ['public', 'v8'];
const qi = (value: string) => `"${value.replace(/"/g, '""')}"`;
const identity = (schema: string, table: string) => `${schema}\0${table}`;
const publicKey = (schema: string, table: string) =>
  schema === 'public' ? table : `${schema}.${table}`;
const qualified = (schema: string, table: string) => `${qi(schema)}.${qi(table)}`;
const decisionSourceTimestampKinds = new Set(['finding', 'pointer', 'handoff']);
const snapshotColumn = (
  column: string,
  dataType: string,
  decisionPrivacyKind: OrganizationExportTableContract['decisionPrivacyKind']
) =>
  decisionPrivacyKind &&
  decisionSourceTimestampKinds.has(decisionPrivacyKind) &&
  dataType === 'timestamp without time zone'
    ? `${qi(column)} AT TIME ZONE 'UTC' AS ${qi(column)}`
    : qi(column);
const normalized = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const credential =
  /(^|_)(password|passcode|secret|token|credential|mfa|otp|api_key|private_key|access_key|recovery|backup_codes?|hash|salt|cookie|authorization)($|_)/i;

function sanitize(value: unknown): unknown {
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
    try {
      return JSON.stringify(sanitize(JSON.parse(value)));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !credential.test(normalized(key)))
        .map(([key, nested]) => [key, sanitize(nested)])
    );
  }
  return value;
}

/**
 * Column-level contract drift, classified so a drifted column degrades the
 * export of ONE column instead of dropping the whole tenant table.
 *
 * Reason this exists (K3b parity measurement, 2026-09-13): the declared
 * contract lists 59 `organizations` columns; a database built by the strict
 * migrator has 56 (`trial_extension_count`, `trial_warning_sent_at`,
 * `onboarding_accept_idempotency_key` live only in `000_initdb_core_tables.sql`,
 * which the schema chain never executes). The all-or-nothing drift check then
 * skipped the tenant ROOT table, left `result.organization = null` and turned a
 * working export into HTTP 500 `ORG_EXPORT_FAILED`.
 *
 * Fail-closed direction is preserved per column:
 *   - a declared column missing in the database cannot be selected -> omitted;
 *   - a declared column whose type drifted is no longer the column the policy
 *     classified -> omitted;
 *   - a column present in the database but NOT declared stays unclassified and
 *     is never exported (it was never in `projection`) -> recorded.
 * Nothing undeclared becomes exportable; only the blast radius shrinks from
 * "whole table" to "this column".
 */
interface ColumnContractDrift {
  missing: string[];
  typeMismatch: string[];
  undeclared: string[];
}

function columnContractDrift(
  policy: OrganizationExportTableContract,
  table: { columns: string[]; types: Record<string, string> }
): ColumnContractDrift {
  const present = new Set(table.columns);
  const declared = new Set([
    ...policy.projection,
    ...policy.excludedColumns,
    ...Object.keys(policy.columnTypes),
  ]);
  return {
    missing: [...declared].filter((column) => !present.has(column)),
    typeMismatch: table.columns.filter(
      (column) => declared.has(column) && policy.columnTypes[column] !== table.types[column]
    ),
    undeclared: table.columns.filter((column) => !declared.has(column)),
  };
}

const driftIsEmpty = (drift: ColumnContractDrift): boolean =>
  drift.missing.length === 0 && drift.typeMismatch.length === 0 && drift.undeclared.length === 0;

/** Tables whose row content is filtered by a projector that READS columns. */
const contentPrivacyProjected = (policy: OrganizationExportTableContract): boolean =>
  Boolean(
    policy.interviewPrivacy ||
      policy.personalTaskPrivacy ||
      policy.decisionPrivacyKind ||
      policy.canonicalLineageColumns
  );

interface CatalogColumn {
  schema_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
}
interface CatalogKey {
  schema_name: string;
  table_name: string;
  columns: string[];
}
interface CatalogEdge {
  child_schema: string;
  child_table: string;
  parent_schema: string;
  parent_table: string;
  child_columns: string[];
  parent_columns: string[];
  delete_action: string;
}

/** Contract is an explicit argument for deterministic policy tests, never request input. */
export async function exportOrganizationData(
  client: PoolClient,
  organizationId: string,
  contract: readonly OrganizationExportTableContract[] = ORGANIZATION_EXPORT_TABLES,
  options: { actorId?: string } = {}
): Promise<OrganizationExportResult> {
  assertNotReservedOrganizationId(organizationId);
  const columns = await client.query<CatalogColumn>(
    `
    SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name,
           format_type(a.atttypid,a.atttypmod) AS data_type
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid
     WHERE c.relkind IN ('r','p') AND n.nspname=ANY($1::text[]) AND a.attnum>0 AND NOT a.attisdropped
     ORDER BY n.nspname,c.relname,a.attnum`,
    [SCHEMAS]
  );
  const primaryKeys = await client.query<CatalogKey>(
    `
    SELECT n.nspname AS schema_name,c.relname AS table_name,
           array_agg(a.attname ORDER BY k.ord)::text[] AS columns
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY k(attnum,ord) ON true
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.attnum
     WHERE con.contype='p' AND n.nspname=ANY($1::text[])
     GROUP BY n.nspname,c.relname,con.oid ORDER BY 1,2`,
    [SCHEMAS]
  );
  const foreignKeys = await client.query<CatalogEdge>(
    `
    SELECT ns.nspname AS child_schema, child.relname AS child_table,
           np.nspname AS parent_schema,parent.relname AS parent_table,
           array_agg(ca.attname ORDER BY ck.ord)::text[] AS child_columns,
           array_agg(pa.attname ORDER BY ck.ord)::text[] AS parent_columns,
           CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
             WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS delete_action
      FROM pg_constraint con JOIN pg_class child ON child.oid=con.conrelid
      JOIN pg_namespace ns ON ns.oid=child.relnamespace
      JOIN pg_class parent ON parent.oid=con.confrelid JOIN pg_namespace np ON np.oid=parent.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY ck(attnum,ord) ON true
      JOIN unnest(con.confkey) WITH ORDINALITY pk(attnum,ord) ON pk.ord=ck.ord
      JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=ck.attnum
      JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=pk.attnum
     WHERE con.contype='f' AND ns.nspname=ANY($1::text[])
     GROUP BY ns.nspname,child.relname,np.nspname,parent.relname,con.confdeltype,con.oid
     ORDER BY 1,2,3,4`,
    [SCHEMAS]
  );
  const tables = new Map<
    string,
    { schema: string; table: string; columns: string[]; types: Record<string, string> }
  >();
  for (const row of columns.rows) {
    const key = identity(row.schema_name, row.table_name);
    const table = tables.get(key) || {
      schema: row.schema_name,
      table: row.table_name,
      columns: [],
      types: {},
    };
    table.columns.push(row.column_name);
    table.types[row.column_name] = row.data_type;
    tables.set(key, table);
  }
  const policies = new Map(contract.map((entry) => [identity(entry.schema, entry.table), entry]));
  const pks = new Map(
    primaryKeys.rows.map((entry) => [identity(entry.schema_name, entry.table_name), entry.columns])
  );
  const result: OrganizationExportResult = {
    organization: null,
    exportedAt: new Date().toISOString(),
    tables: {},
    rowCounts: {},
    skipped: [],
    totalRows: 0,
    securityManifest: {
      policyVersion: ORGANIZATION_EXPORT_POLICY_VERSION,
      complete: false,
      truncated: false,
      scope:
        'Declared tenant owner only; unclassified relations are omitted, never inferred from discovery.',
      tableIdentityVersion: 'schema-qualified-v1',
      includedSchemas: [],
      unresolvedTables: [],
      excludedTables: [],
      excludedColumns: [],
    },
  };
  const unresolved = (table: string, reason: string) =>
    result.securityManifest.unresolvedTables.push({ table, reason });
  const interviewRows = new Map<string, Record<string, unknown>[]>();
  const canonicalRows = new Map<string, Record<string, unknown>[]>();
  const decisionRows = new Map<string, Record<string, unknown>[]>();
  for (const [key, table] of tables) {
    const name = publicKey(table.schema, table.table);
    const policy = policies.get(key);
    if (policy?.category === 'EXCLUDE_SECURITY') {
      result.securityManifest.excludedTables.push({
        table: name,
        reason: 'credential_session_or_security_material',
      });
      continue;
    }
    if (!policy || policy.category !== 'EXPORT' || (!policy.ownerColumn && !policy.ownerVia)) {
      unresolved(name, 'ownership_contract_unresolved');
      continue;
    }
    const drift = columnContractDrift(policy, table);
    // A column we cannot read as classified is dropped from the projection.
    const untrusted = new Set([...drift.missing, ...drift.typeMismatch]);
    const projection = policy.projection.filter(
      (column) => !credential.test(normalized(column)) && !untrusted.has(column)
    );
    // Table-level drift still fails closed: without the ownership column the
    // tenant scope cannot be proved, and a drifted primary key changes row
    // identity and the deterministic order of the export.
    //
    // A privacy-projected table keeps the ORIGINAL all-or-nothing rule. Its
    // projector decides what may leave the tenant by READING columns
    // (`is_anonymous`, `session_id`, `owner_id`, …); silently dropping a
    // drifted one of those would let the projector mis-classify a row and
    // widen disclosure. Per-column degradation is therefore allowed only
    // where no content-privacy decision depends on the columns.
    if (
      (policy.ownerColumn && !table.columns.includes(policy.ownerColumn)) ||
      projection.length === 0 ||
      policy.primaryKey.some((column) => untrusted.has(column)) ||
      (!driftIsEmpty(drift) && contentPrivacyProjected(policy)) ||
      JSON.stringify(pks.get(key) || []) !== JSON.stringify(policy.primaryKey)
    ) {
      unresolved(name, 'schema_projection_or_primary_key_drift');
      continue;
    }
    if (!driftIsEmpty(drift)) {
      for (const column of drift.missing)
        result.skipped.push({ tabela: name, kolumna: column, reason: 'declared_column_missing_in_schema' });
      for (const column of drift.typeMismatch)
        result.skipped.push({ tabela: name, kolumna: column, reason: 'declared_column_type_drift' });
      for (const column of drift.undeclared)
        result.skipped.push({ tabela: name, kolumna: column, reason: 'undeclared_column_not_exported' });
      unresolved(name, 'schema_column_drift_partial_export');
    }
    const actualEdges = foreignKeys.rows.filter(
      (edge) => identity(edge.child_schema, edge.child_table) === key
    );
    const expectedEdges = policy.foreignKeys;
    const edgeKey = (edge: CatalogEdge) =>
      JSON.stringify([
        edge.child_columns,
        edge.parent_schema,
        edge.parent_table,
        edge.parent_columns,
        edge.delete_action,
      ]);
    const expectedEdgeKeys = expectedEdges
      .map((edge) =>
        JSON.stringify([
          edge.columns,
          edge.parentSchema,
          edge.parentTable,
          edge.parentColumns,
          edge.deleteAction,
        ])
      )
      .sort();
    if (JSON.stringify(actualEdges.map(edgeKey).sort()) !== JSON.stringify(expectedEdgeKeys)) {
      unresolved(name, 'foreign_key_contract_drift');
      continue;
    }
    const excluded = table.columns.filter((column) => !projection.includes(column));
    if (excluded.length)
      result.securityManifest.excludedColumns.push({
        table: name,
        classes: ['declared_policy_exclusion'],
        count: excluded.length,
        reason: 'security_or_privacy_policy_excluded',
      });
    // Direct owner selection covers approved descendants with their own owner.
    // No traversal is permitted through an unclassified or shared-user FK.
    // Without a PK, stable JSON ordering is the documented deterministic fallback.
    const order = policy.primaryKey.length
      ? policy.primaryKey.map(qi).join(',')
      : projection.map((column) => `${qi(column)}::text`).join(',');
    let predicate: string;
    if (policy.ownerColumn) {
      predicate = `${qi(policy.ownerColumn)}::text=$1`;
    } else {
      const edge = policy.ownerVia!;
      const parent = policies.get(identity(edge.parentSchema, edge.parentTable));
      const parentCatalog = tables.get(identity(edge.parentSchema, edge.parentTable));
      const provedEdge = actualEdges.some(
        (fk) =>
          fk.parent_schema === edge.parentSchema &&
          fk.parent_table === edge.parentTable &&
          JSON.stringify(fk.child_columns) === JSON.stringify([edge.childColumn]) &&
          JSON.stringify(fk.parent_columns) === JSON.stringify([edge.parentColumn])
      );
      if (
        !parent ||
        parent.category !== 'EXPORT' ||
        !parent.ownerColumn ||
        !parentCatalog ||
        !provedEdge ||
        !parentCatalog.columns.includes(parent.ownerColumn) ||
        !table.columns.includes(edge.childColumn) ||
        // The ownership predicate reads the parent's OWNER column through a
        // proved foreign key; drift in the parent's other columns is recorded
        // and degraded where the parent itself is exported (see
        // columnContractDrift) and must not silently unresolve this child.
        columnContractDrift(parent, parentCatalog).typeMismatch.includes(parent.ownerColumn) ||
        (contentPrivacyProjected(parent) &&
          !driftIsEmpty(columnContractDrift(parent, parentCatalog))) ||
        parent.primaryKey.some((column) => !parentCatalog.columns.includes(column)) ||
        JSON.stringify(pks.get(identity(edge.parentSchema, edge.parentTable)) || []) !==
          JSON.stringify(parent.primaryKey) ||
        JSON.stringify(
          foreignKeys.rows
            .filter(
              (fk) =>
                identity(fk.child_schema, fk.child_table) ===
                identity(edge.parentSchema, edge.parentTable)
            )
            .map(edgeKey)
            .sort()
        ) !==
          JSON.stringify(
            parent.foreignKeys
              .map((fk) =>
                JSON.stringify([
                  fk.columns,
                  fk.parentSchema,
                  fk.parentTable,
                  fk.parentColumns,
                  fk.deleteAction,
                ])
              )
              .sort()
          )
      ) {
        unresolved(name, 'indirect_owner_edge_unresolved');
        continue;
      }
      predicate = `EXISTS (SELECT 1 FROM ${qualified(edge.parentSchema, edge.parentTable)} AS owner_scope WHERE owner_scope.${qi(edge.parentColumn)}=export_row.${qi(edge.childColumn)} AND owner_scope.${qi(parent.ownerColumn)}::text=$1)`;
    }
    const rows = await client.query(
      `SELECT ${projection
        .map((column) => snapshotColumn(column, table.types[column], policy.decisionPrivacyKind))
        .join(
          ','
        )} FROM ${qualified(table.schema, table.table)} AS export_row WHERE ${predicate} ORDER BY ${order}`,
      [organizationId]
    );
    if (policy.interviewPrivacy) interviewRows.set(key, rows.rows);
    if (policy.canonicalLineageColumns) canonicalRows.set(key, rows.rows);
    if (policy.decisionPrivacyKind) decisionRows.set(policy.decisionPrivacyKind, rows.rows);
    const safeRows = rows.rows.map(
      (row) =>
        sanitize(
          policy.canonicalLineageColumns
            ? projectCanonicalExportLineage(row, policy.canonicalLineageColumns)
            : policy.personalTaskPrivacy
              ? projectPersonalTaskExport(row)
              : policy.decisionPrivacyKind
                ? projectDecisionSourceIdentity(row)
                : row
        ) as Record<string, unknown>
    );
    if (policy.canonicalLineageColumns && rows.rows.length)
      unresolved(name, 'canonical_content_privacy_unresolved_lineage_only');
    if (policy.personalTaskPrivacy && rows.rows.length)
      unresolved(name, 'task_source_or_supplemental_content_privacy_unresolved');
    if (policy.decisionPrivacyKind && rows.rows.length)
      unresolved(name, 'decision_source_or_supplemental_content_privacy_unresolved');
    if (!result.securityManifest.includedSchemas.includes(table.schema))
      result.securityManifest.includedSchemas.push(table.schema);
    if (key === identity('public', 'organizations')) {
      if (!safeRows.length)
        throw Object.assign(new Error('Organization not found'), { code: 'ORG_NOT_FOUND' });
      result.organization = safeRows[0];
    } else if (safeRows.length) {
      result.tables[name] = safeRows;
      result.rowCounts[name] = safeRows.length;
      result.totalRows += safeRows.length;
    }
  }
  const decisions = decisionRows.get('decision');
  if (decisions?.length) {
    const auditKey = identity('public', 'interview_insight_audit_log');
    const auditCatalog = tables.get(auditKey);
    // Internal, writer-specific authorization evidence only. The audit table's
    // unresolved export ownership remains untouched in the public manifest.
    const receiptSnapshot = await readFindingReceiptSnapshot(
      client,
      organizationId,
      (decisionRows.get('finding') || []).map((row) => String(row.id)),
      auditCatalog
        ? {
            ...auditCatalog,
            primaryKey: pks.get(auditKey) || [],
            foreignKeyCount: foreignKeys.rows.filter(
              (edge) => identity(edge.child_schema, edge.child_table) === auditKey
            ).length,
          }
        : undefined
    );
    const sources = {
      ...receiptSnapshot,
      handoffs: decisionRows.get('handoff') || [],
      findings: decisionRows.get('finding') || [],
      insights: decisionRows.get('insight') || [],
      pointers: decisionRows.get('pointer') || [],
      questions: interviewRows.get(identity('public', 'interview_questions')) || [],
      sessions: interviewRows.get(identity('public', 'interview_sessions')) || [],
    };
    result.tables.decisions = decisions.map((row) => {
      const safe = projectDecisionSourceIdentity(row);
      if (canExportInterviewDecisionContent(row, organizationId, options.actorId, sources)) {
        safe.title = row.title;
        safe.description = row.description;
        safe.export_payload_scope = 'verified_interview_handoff_body_supplemental_unresolved';
      }
      return sanitize(safe) as Record<string, unknown>;
    });
  }
  const stateRows = canonicalRows.get(identity('public', 'ie_aggregate_state')) || [];
  const verifiedManual = verifiedManualInitiativeContent(
    organizationId,
    stateRows,
    canonicalRows.get(identity('public', 'ie_aggregate_relations')) || [],
    result.tables.projects || []
  );
  if (stateRows.length) {
    const safeRows = stateRows.map((row) =>
      verifiedManual.has(`${row.aggregate_type}\0${row.aggregate_id}`)
        ? (sanitize({ ...row, export_payload_scope: 'verified_manual_hub_content' }) as Record<
            string,
            unknown
          >)
        : (sanitize(projectCanonicalExportLineage(row, ['payload_json'])) as Record<
            string,
            unknown
          >)
    );
    result.tables.ie_aggregate_state = safeRows;
    if (safeRows.every((row) => row.export_payload_scope === 'verified_manual_hub_content')) {
      result.securityManifest.unresolvedTables = result.securityManifest.unresolvedTables.filter(
        (entry) =>
          !(
            entry.table === 'ie_aggregate_state' &&
            entry.reason === 'canonical_content_privacy_unresolved_lineage_only'
          )
      );
    }
  }
  // Use only a session whose full contract and tenant-scoped read succeeded in
  // this same pinned snapshot. Missing/drifted/cross-org parents fail closed.
  const sessionRows = interviewRows.get(identity('public', 'interview_sessions'));
  const sessions = new Map((sessionRows || []).map((row) => [String(row.id), row]));
  for (const policy of contract.filter((entry) => entry.interviewPrivacy)) {
    const key = identity(policy.schema, policy.table);
    const rawRows = interviewRows.get(key);
    if (!rawRows) continue;
    const name = publicKey(policy.schema, policy.table);
    const safeRows: Record<string, unknown>[] = [];
    let missingParent = false;
    for (const row of rawRows) {
      const kind = policy.interviewPrivacy!;
      const parent =
        kind === 'session' || kind === 'assignment' ? row : sessions.get(String(row.session_id));
      if (!parent) {
        missingParent = true;
        continue;
      }
      const safe = projectInterviewExportRow(
        kind,
        row,
        {
          is_anonymous: parent.is_anonymous,
          respondentId: kind === 'assignment' ? parent.assignee_user_id : parent.owner_id,
        },
        options.actorId
      );
      safeRows.push(sanitize(safe) as Record<string, unknown>);
    }
    if (missingParent) unresolved(name, 'interview_privacy_parent_missing_or_outside_tenant');
    result.totalRows -= result.rowCounts[name] || 0;
    if (safeRows.length) {
      result.tables[name] = safeRows;
      result.rowCounts[name] = safeRows.length;
      result.totalRows += safeRows.length;
    } else {
      delete result.tables[name];
      delete result.rowCounts[name];
    }
  }
  for (const policy of contract) {
    if (policy.category === 'EXPORT' && !tables.has(identity(policy.schema, policy.table))) {
      unresolved(publicKey(policy.schema, policy.table), 'declared_table_missing');
    }
  }
  if (!result.organization)
    throw Object.assign(new Error('Organization export root contract could not be verified'), {
      code: 'EXPORT_ROOT_CONTRACT_INVALID',
    });
  result.securityManifest.complete =
    result.securityManifest.unresolvedTables.length === 0 && result.skipped.length === 0;
  return result;
}
