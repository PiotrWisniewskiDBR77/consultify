/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/src/services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: vi.fn(async () => ({ capabilities: [], platformRole: null })),
  hasEffectiveCapability: () => false,
}));

const { searchResults } =
  await import('../../server/src/services/resultsVnext/platform/resultsSearchRepository.js');

function buildClientConfig(): ClientConfig | null {
  return process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : null;
}

const config = buildClientConfig();
const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const organizationId = `day14-search-org-${tag}`;
const userId = `day14-search-user-${tag}`;
const ids = Array.from({ length: 5 }, () => randomUUID());
let client: Client | null = null;

describe.skipIf(!config)('Day 14 S.1 Results search real Postgres', () => {
  beforeAll(async () => {
    client = new Client(config!);
    await client.connect();
    const policyId = randomUUID();
    await client.query(
      `INSERT INTO rvn_platform_visibility_policies
         (policy_id, organization_id, domain, policy_version, visibility_mode, created_by)
       VALUES ($1, $2, 'kpi', 1, 'OPEN_ORG', $3)`,
      [policyId, organizationId, userId]
    );
    for (let index = 0; index < ids.length; index += 1) {
      await client.query(
        `INSERT INTO rvn_kpi_definitions
           (kpi_id, organization_id, kpi_code, status, created_by, updated_at)
         VALUES ($1, $2, $3, 'active', $4, $5)`,
        [
          ids[index],
          organizationId,
          `DAY14-MARGIN-${index}`,
          userId,
          new Date(Date.UTC(2026, 7, 25, 12, 0, index)),
        ]
      );
      await client.query(
        `INSERT INTO rvn_platform_resource_visibility
           (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
         VALUES ('kpi', $1, $2, 'OPEN_ORG', $3, $4)`,
        [ids[index], organizationId, policyId, userId]
      );
    }
  });

  afterAll(async () => {
    if (!client) return;
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [
      organizationId,
    ]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [
      organizationId,
    ]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [
      organizationId,
    ]);
    await client.end();
  });

  it('walks three cursor pages without duplicates or omissions', async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 3; page += 1) {
      const result = await searchResults({
        userId,
        organizationId,
        query: 'margin',
        kinds: ['kpi'],
        limit: 2,
        cursor,
      });
      seen.push(...result.results.map((hit) => hit.id));
      cursor = result.nextCursor ?? undefined;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect(new Set(seen)).toEqual(new Set(ids));
  });
});
