import { describe, expect, it } from 'vitest';
import { organizationExportDisclosure } from '@/utils/organizationExportDisclosure';
const fixture = () => ({
  organization: { id: 'org-a' },
  tables: { tasks: [{ id: 't1' }] },
  rowCounts: { tasks: 1 },
  totalRows: 1,
  exportedAt: '2026-09-12T00:00:00Z',
  skipped: [],
  securityManifest: {
    policyVersion: 'tenant-export-contract-v8-20260912',
    tableIdentityVersion: 'schema-qualified-v1',
    includedSchemas: ['public'],
    scope: 'declared',
    complete: true,
    truncated: false,
    unresolvedTables: [] as Array<{ table: string; reason: string }>,
    excludedTables: [],
    excludedColumns: [],
  },
});
describe('v8 export disclosure compatibility', () => {
  it('recognizes structurally complete v8 without weakening count validation', () => {
    const data = fixture();
    expect(organizationExportDisclosure(data, 'org-a').complete).toBe(true);
    data.totalRows = 5;
    expect(organizationExportDisclosure(data, 'org-a').complete).toBe(false);
  });
  it('keeps unresolved task scope partial even with complete=true and recognized v8', () => {
    const data = fixture();
    data.securityManifest.unresolvedTables = [
      { table: 'tasks', reason: 'supplemental unresolved' },
    ];
    const result = organizationExportDisclosure(data, 'org-a');
    expect(result.complete).toBe(false);
    expect(result.message).toContain('Partial export downloaded');
  });
  it('does not recognize an arbitrary future contract as complete', () => {
    const data = fixture();
    data.securityManifest.policyVersion = 'unknown';
    expect(organizationExportDisclosure(data, 'org-a').message).toContain(
      'Completeness could not be verified'
    );
  });
  it('recognizes the exact v9 contract but still rejects a future version', () => {
    const data = fixture();
    data.securityManifest.policyVersion = 'tenant-export-contract-v9-20260912';
    expect(organizationExportDisclosure(data, 'org-a').complete).toBe(true);

    data.securityManifest.policyVersion = 'tenant-export-contract-v10-unknown';
    const future = organizationExportDisclosure(data, 'org-a');
    expect(future.complete).toBe(false);
    expect(future.message).toContain('Completeness could not be verified');
  });
});
