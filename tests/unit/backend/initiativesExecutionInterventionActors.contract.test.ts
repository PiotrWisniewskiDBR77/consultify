import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(
    process.cwd(),
    'server/src/domain/initiatives-execution/postgresInitiativeReader.ts'
  ),
  'utf8'
);

describe('Execution intervention actor read model', () => {
  it('resolves owner and authority names inside the same organization', () => {
    expect(source).toContain("owner.id=s.payload_json->>'ownerId'");
    expect(source).toContain('owner.organization_id=s.organization_id');
    expect(source).toContain("authority.id=s.payload_json->>'authorityId'");
    expect(source).toContain('authority.organization_id=s.organization_id');
    expect(source).toContain('ownerName: r.owner_name');
    expect(source).toContain('authorityName: r.authority_name');
  });
});
