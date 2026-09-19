import { describe, expect, it, vi } from 'vitest';

import type { IDatabase } from '../../database/IDatabase.js';
import {
  organizationBaseArtifactSeedSql,
  seedOrganizationBaseArtifacts,
} from '../organizationBaseArtifactService.js';

function databaseWithSeedCount(seededCount: number | string | null) {
  const get = vi.fn().mockResolvedValue(
    seededCount === null ? null : { seeded_count: seededCount }
  );
  return {
    database: { get } as unknown as IDatabase,
    get,
  };
}

describe('seedOrganizationBaseArtifacts', () => {
  it('woła wspólną funkcję QD21 i przyjmuje dokładnie trzy karty kanoniczne', async () => {
    const { database, get } = databaseWithSeedCount('3');

    await expect(seedOrganizationBaseArtifacts(' org-new ', database)).resolves.toBe(3);
    expect(get).toHaveBeenCalledWith(organizationBaseArtifactSeedSql(), ['org-new']);
  });

  it.each([0, 2, 4, null])('odrzuca odczyt %s zamiast trzech kart', async (count) => {
    const { database } = databaseWithSeedCount(count);
    await expect(seedOrganizationBaseArtifacts('org-new', database)).rejects.toThrow(
      'ORGANIZATION_BASE_ARTIFACT_SEED_COUNT_INVALID'
    );
  });

  it('odrzuca brak identyfikatora przed wywołaniem bazy', async () => {
    const { database, get } = databaseWithSeedCount(3);
    await expect(seedOrganizationBaseArtifacts(' ', database)).rejects.toThrow(
      'ORGANIZATION_ID_REQUIRED_FOR_BASE_ARTIFACT_SEED'
    );
    expect(get).not.toHaveBeenCalled();
  });
});
