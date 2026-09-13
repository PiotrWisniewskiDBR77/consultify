// [ODMROZENIE 14_ADMIN DEC-460] Disclosure for the existing organization export action.
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function organizationExportDisclosure(
  value: unknown,
  expectedOrganizationId: string
): {
  complete: boolean;
  message: string;
} {
  if (!record(value)) throw new Error('Invalid organization export response');
  if (
    record(value.organization) &&
    typeof value.organization.id === 'string' &&
    value.organization.id !== expectedOrganizationId
  ) {
    throw new Error('Organization export does not match the requested organization');
  }
  const manifest = value.securityManifest;
  const unknown = {
    complete: false,
    message:
      'Export downloaded. Completeness could not be verified; inspect the file before using it as a backup.',
  };
  if (!record(manifest)) return unknown;
  const unresolved = Array.isArray(manifest.unresolvedTables)
    ? manifest.unresolvedTables.length
    : null;
  const skipped = Array.isArray(value.skipped) ? value.skipped.length : null;
  if (
    manifest.complete === false ||
    manifest.truncated === true ||
    (unresolved ?? 0) > 0 ||
    (skipped ?? 0) > 0
  ) {
    return {
      complete: false,
      message: `Partial export downloaded. Unresolved tables: ${unresolved ?? 'unknown'}; skipped entries: ${skipped ?? 'unknown'}. Some data is missing; inspect the file manifest.`,
    };
  }
  if (
    ![
      'tenant-export-contract-v5-20260912',
      'tenant-export-contract-v7-20260912',
      'tenant-export-contract-v8-20260912',
      'tenant-export-contract-v9-20260912',
    ].includes(String(manifest.policyVersion)) ||
    manifest.tableIdentityVersion !== 'schema-qualified-v1' ||
    manifest.complete !== true ||
    manifest.truncated !== false ||
    unresolved !== 0 ||
    skipped !== 0 ||
    !Array.isArray(manifest.excludedTables) ||
    !Array.isArray(manifest.excludedColumns) ||
    !Array.isArray(manifest.includedSchemas) ||
    typeof manifest.scope !== 'string' ||
    !manifest.scope.trim() ||
    !manifest.includedSchemas.every((schema) => typeof schema === 'string' && schema.length > 0) ||
    !manifest.excludedTables.every(
      (entry) =>
        record(entry) && typeof entry.table === 'string' && typeof entry.reason === 'string'
    ) ||
    !manifest.excludedColumns.every(
      (entry) =>
        record(entry) &&
        typeof entry.table === 'string' &&
        typeof entry.reason === 'string' &&
        Array.isArray(entry.classes) &&
        entry.classes.every((item) => typeof item === 'string') &&
        Number.isInteger(entry.count) &&
        Number(entry.count) >= 0
    ) ||
    !record(value.organization) ||
    value.organization.id !== expectedOrganizationId ||
    !expectedOrganizationId.trim() ||
    !record(value.tables) ||
    !record(value.rowCounts) ||
    typeof value.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !Number.isInteger(value.totalRows) ||
    Number(value.totalRows) < 0
  )
    return unknown;
  const counts = value.rowCounts as Record<string, unknown>;
  const tables = value.tables as Record<string, unknown>;
  if (
    Object.keys(counts).length !== Object.keys(tables).length ||
    !Object.entries(tables).every(
      ([table, rows]) =>
        Array.isArray(rows) &&
        rows.every(record) &&
        Number.isInteger(counts[table]) &&
        counts[table] === rows.length
    ) ||
    Object.values(counts).reduce<number>((sum, count) => sum + Number(count), 0) !== value.totalRows
  )
    return unknown;
  return {
    complete: true,
    message: `Export downloaded: complete under its declared scope. Security exclusions: ${manifest.excludedTables.length} tables and ${manifest.excludedColumns.length} column groups. See the file manifest.`,
  };
}
