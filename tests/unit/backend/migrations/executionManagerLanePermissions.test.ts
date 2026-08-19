import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'server/migrations/20261040_execution_manager_lane_permissions.sql'
  ),
  'utf8'
);

describe('execution manager-lane permission migration', () => {
  it('grants the exact canonical manager roles and no member/viewer role', () => {
    for (const role of ['SUPERADMIN', 'OWNER', 'ADMIN', 'PROJECT_MANAGER']) {
      expect(migration).toContain(`'${role}', 'manage_workstreams'`);
    }
    for (const role of ['TEAM_MEMBER', 'MEMBER', 'VIEWER', 'GUEST', 'USER']) {
      expect(migration).not.toContain(`'${role}', 'manage_workstreams'`);
    }
  });

  it('is replay-safe on the role and permission identity', () => {
    expect(migration).toContain('ON CONFLICT (role, permission_key) DO NOTHING');
  });
});

