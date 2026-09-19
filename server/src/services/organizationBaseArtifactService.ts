import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';

export const ORGANIZATION_BASE_ARTIFACT_SEED_FUNCTION =
  'public.seed_organization_base_artifacts' as const;

export function organizationBaseArtifactSeedSql(): string {
  return `SELECT ${ORGANIZATION_BASE_ARTIFACT_SEED_FUNCTION}(?) AS seeded_count`;
}

interface SeedReadbackRow {
  seeded_count: number | string;
}

export async function seedOrganizationBaseArtifacts(
  organizationId: string,
  database: IDatabase = getDatabase()
): Promise<number> {
  const normalizedOrganizationId = String(organizationId || '').trim();
  if (!normalizedOrganizationId) {
    throw new Error('ORGANIZATION_ID_REQUIRED_FOR_BASE_ARTIFACT_SEED');
  }

  const row = await database.get<SeedReadbackRow>(
    organizationBaseArtifactSeedSql(),
    [normalizedOrganizationId]
  );
  const seededCount = Number(row?.seeded_count);
  if (seededCount !== 3) {
    throw new Error(
      ['ORGANIZATION_BASE_ARTIFACT_SEED_COUNT_INVALID', String(row?.seeded_count)].join(':')
    );
  }
  return seededCount;
}
