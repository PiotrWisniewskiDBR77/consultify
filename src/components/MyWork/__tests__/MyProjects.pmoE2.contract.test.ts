import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../MyProjects.tsx'), 'utf8');

describe('F2-3 E2 MyProjects contract', () => {
  it('uses the standard list shell for both projects and members', () => {
    expect(source).toContain('<StandardModuleBar');
    expect(source.match(/<StandardTable/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('<StandardPreview');
    expect(source).toContain('teamColumns');
  });

  it('exposes project creation, role descriptions, responsibility matrix and communication configuration', () => {
    expect(source).toContain('CreateProjectModal');
    expect(source).toContain('Role responsibilities');
    expect(source).toContain('Communication plan');
    expect(source).toContain('Approval inputs');
  });

  it('renders explicit permission and unassigned-role states without raw role/action formatting', () => {
    expect(source).toContain('pmo-no-management-permission');
    expect(source).toContain('pmo-unassigned-required-role');
    expect(source).toContain('projectRoleLabel(row.roleKey)');
    expect(source).toContain('row.accountableFor.map(permissionLabel)');
    expect(source).toContain('approvalRoleLabel(binding.roleKey)');
    expect(source).not.toContain('role.replace(/_/g');
    expect(source).not.toContain('row.accountableFor.join');
    expect(source).not.toContain('binding.roleKey.replace');
  });
});
