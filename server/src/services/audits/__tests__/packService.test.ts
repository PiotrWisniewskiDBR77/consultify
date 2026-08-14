/**
 * packService.test — przeciw REALNEJ bazie Postgres.
 *
 * Uruchomienie (z korzenia worktree, NIE z `server/`):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false
 *   POSTGRES_SKIP_INIT_IN_TEST=1 DATABASE_URL="postgresql://...@127.0.0.1:5439/consultify_audits_u2"
 *   npx vitest run server/src/services/audits/__tests__/packService.test.ts
 *
 * Każdy test sprząta po sobie (usuwa pakiety utworzone w teście — kaskada
 * usuwa też ich kryteria; usuwa źródła, jeśli je stworzył).
 */

import { afterEach, describe, expect, it } from 'vitest';

import { auditGet, auditRun, newId } from '../auditsDb.js';
import { createSource, updateSource, verifySource } from '../normSourceService.js';
import {
  approveByExpert,
  comparePackVersions,
  createNewVersion,
  createPack,
  deletePack,
  getCriteriaFlat,
  getPack,
  listPacks,
  publishPack,
  replaceCriteria,
  updatePack,
  validatePackById,
} from '../packService.js';
import { DEMO_PACK_KEY, seedDemoAuditPack } from '../packSeed.js';
import type { AuditActor } from '../types.js';
import type { ReplaceCriterionInput } from '../packService.js';

const ORG_A = `org-test-u2-ps-a-${newId('run')}`;
const ORG_B = `org-test-u2-ps-b-${newId('run')}`;
const actorA: AuditActor = { organizationId: ORG_A, userId: 'user-a' };
const actorB: AuditActor = { organizationId: ORG_B, userId: 'user-b' };

const cleanupPackIds: string[] = [];
const cleanupSourceIds: string[] = [];

afterEach(async () => {
  while (cleanupPackIds.length) {
    const id = cleanupPackIds.pop() as string;
    await auditRun(`DELETE FROM audit_packs WHERE id = $1`, [id]);
  }
  while (cleanupSourceIds.length) {
    const id = cleanupSourceIds.pop() as string;
    await auditRun(`DELETE FROM audit_norm_sources WHERE id = $1`, [id]);
  }
});

function leaf(overrides: Partial<ReplaceCriterionInput> = {}): ReplaceCriterionInput {
  return {
    id: newId('crit'),
    title: 'Kryterium testowe',
    nodeKind: 'criterion',
    requirementText: 'Wymaganie testowe',
    auditQuestion: 'Pytanie testowe?',
    auditProcedure: 'Procedura testowa',
    sourceReference: 'Procedura demonstracyjna Consultify, pkt 1',
    expectedEvidence: [{ kind: 'document', description: 'Dokument testowy' }],
    ...overrides,
  };
}

async function makeVerifiedSource(actor: AuditActor): Promise<string> {
  const source = await createSource(actor, {
    sourceKey: `norm-${newId('k')}`,
    title: 'Norma testowa',
    sourceKind: 'normative_standard',
    sourceType: 'LICENSED_STANDARD',
    rightsStatus: 'licensed',
  });
  cleanupSourceIds.push(source.id);
  await updateSource(actor, source.id, { sourceVersion: '2024', publisher: 'Wydawca testowy' });
  await verifySource(actor, source.id, { verificationStatus: 'VERIFIED' });
  return source.id;
}

describe('packService', () => {
  it('create -> get -> update -> delete (draft)', async () => {
    const pack = await createPack(actorA, {
      packKey: `lifecycle-${newId('k')}`,
      title: 'Pakiet cyklu życia',
      classification: 'DEMONSTRATION',
    });
    cleanupPackIds.push(pack.id);
    expect(pack.publicationStatus).toBe('draft');
    expect(pack.version).toBe(1);

    const fetched = await getPack(actorA.organizationId, pack.id);
    expect(fetched.title).toBe('Pakiet cyklu życia');
    expect(fetched.criteria).toEqual([]);

    const updated = await updatePack(actorA, pack.id, { title: 'Pakiet zaktualizowany' });
    expect(updated.title).toBe('Pakiet zaktualizowany');

    await deletePack(actorA, pack.id);
    await expect(getPack(actorA.organizationId, pack.id)).rejects.toThrow(/nie został znaleziony/);
    cleanupPackIds.pop();
  });

  it('izolacja organizacji: pakiet organizacji A jest niewidoczny w liście/get organizacji B', async () => {
    const pack = await createPack(actorA, {
      packKey: `isolated-${newId('k')}`,
      title: 'Pakiet tylko dla A',
    });
    cleanupPackIds.push(pack.id);

    await expect(getPack(actorB.organizationId, pack.id)).rejects.toThrow(/nie został znaleziony/);

    const listB = await listPacks(actorB.organizationId, {});
    expect(listB.items.some((p) => p.id === pack.id)).toBe(false);

    const listA = await listPacks(actorA.organizationId, {});
    expect(listA.items.some((p) => p.id === pack.id)).toBe(true);
  });

  it('replaceCriteria buduje drzewo domena → kryterium widoczne przez getPack', async () => {
    const pack = await createPack(actorA, {
      packKey: `tree-${newId('k')}`,
      title: 'Pakiet z drzewem',
    });
    cleanupPackIds.push(pack.id);

    const domainKey = 'domain-1';
    await replaceCriteria(actorA, pack.id, [
      { id: domainKey, title: 'Domena testowa', nodeKind: 'domain', ordinal: 0 },
      leaf({ id: 'c1', parentId: domainKey, ordinal: 0, title: 'Kryterium 1' }),
      leaf({ id: 'c2', parentId: domainKey, ordinal: 1, title: 'Kryterium 2' }),
    ]);

    const withCriteria = await getPack(actorA.organizationId, pack.id);
    expect(withCriteria.criteria).toHaveLength(1);
    expect(withCriteria.criteria[0].nodeKind).toBe('domain');
    expect(withCriteria.criteria[0].children).toHaveLength(2);
    expect(withCriteria.criteria[0].children.map((c) => c.title)).toEqual([
      'Kryterium 1',
      'Kryterium 2',
    ]);

    // Podmiana całości: drugie wywołanie usuwa poprzednie wiersze.
    await replaceCriteria(actorA, pack.id, [leaf({ id: 'only', title: 'Jedyne kryterium' })]);
    const flat = await getCriteriaFlat(pack.id);
    expect(flat).toHaveLength(1);
    expect(flat[0].title).toBe('Jedyne kryterium');
  });

  it('publikacja jest blokowana przez walidator, gdy pakiet nie jest gotowy (TWARDA REGUŁA — bez obejścia)', async () => {
    const pack = await createPack(actorA, {
      packKey: `blocked-${newId('k')}`,
      title: 'Pakiet niegotowy',
      classification: 'VERIFIED_NORMATIVE',
      sourceType: 'LICENSED_STANDARD',
      // celowo brak sourceId — walidator musi to zablokować
    });
    cleanupPackIds.push(pack.id);
    await replaceCriteria(actorA, pack.id, [leaf()]);

    await expect(publishPack(actorA, pack.id)).rejects.toMatchObject({
      code: 'AUDIT_PACK_NOT_PUBLISHABLE',
    });

    // Pakiet pozostaje draftem — próba publikacji nie zmieniła stanu po cichu.
    const stillDraft = await getPack(actorA.organizationId, pack.id);
    expect(stillDraft.publicationStatus).toBe('draft');
    expect(stillDraft.classification).toBe('VERIFIED_NORMATIVE');
  });

  it('publikacja przechodzi dopiero po skompletowaniu źródła, kryteriów i zatwierdzenia eksperckiego', async () => {
    const sourceId = await makeVerifiedSource(actorA);
    const pack = await createPack(actorA, {
      packKey: `publishable-${newId('k')}`,
      title: 'Pakiet gotowy do publikacji',
      classification: 'VERIFIED_NORMATIVE',
      sourceType: 'LICENSED_STANDARD',
      sourceId,
      sourceVersion: '2024',
      scope: 'Zakres',
      objectives: 'Cele',
      requiredRoles: ['lead_auditor'],
      findingTaxonomy: [
        {
          key: 'conforming',
          label: 'Zgodne',
          nonConforming: false,
          requiresCorrectiveAction: false,
        },
        {
          key: 'nonconforming',
          label: 'Niezgodne',
          nonConforming: true,
          requiresCorrectiveAction: true,
        },
      ],
    });
    cleanupPackIds.push(pack.id);
    await replaceCriteria(actorA, pack.id, [leaf()]);

    // Bez zatwierdzenia eksperckiego nadal zablokowane.
    await expect(publishPack(actorA, pack.id)).rejects.toMatchObject({
      code: 'AUDIT_PACK_NOT_PUBLISHABLE',
    });

    await approveByExpert(actorA, pack.id, 'Zatwierdzam w teście');
    const published = await publishPack(actorA, pack.id);
    expect(published.publicationStatus).toBe('published');
    expect(published.publishedBy).toBe(actorA.userId);
    expect(published.publishedAt).not.toBeNull();

    // Opublikowanego pakietu nie da się już edytować w miejscu.
    await expect(updatePack(actorA, pack.id, { title: 'x' })).rejects.toThrow(/nową wersję/);
    await expect(deletePack(actorA, pack.id)).rejects.toThrow(/draft/);
  });

  it('validatePackById zwraca ten sam wynik, który blokuje publikację', async () => {
    const pack = await createPack(actorA, {
      packKey: `validate-${newId('k')}`,
      title: 'Pakiet do walidacji',
    });
    cleanupPackIds.push(pack.id);
    const result = await validatePackById(actorA.organizationId, pack.id);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('createNewVersion kopiuje kryteria niezależnie (edycja nowej wersji nie zmienia starej)', async () => {
    const pack = await createPack(actorA, {
      packKey: `versioned-${newId('k')}`,
      title: 'Pakiet wersjonowany',
    });
    cleanupPackIds.push(pack.id);
    await replaceCriteria(actorA, pack.id, [
      leaf({ id: 'a', refCode: 'A.1', title: 'Kryterium A' }),
      leaf({ id: 'b', refCode: 'A.2', title: 'Kryterium B' }),
    ]);

    const v2 = await createNewVersion(actorA, pack.packKey);
    cleanupPackIds.push(v2.id);
    expect(v2.version).toBe(2);
    expect(v2.publicationStatus).toBe('draft');
    expect(v2.supersedesPackId).toBe(pack.id);

    const v2Criteria = await getCriteriaFlat(v2.id);
    expect(v2Criteria.map((c) => c.title).sort()).toEqual(['Kryterium A', 'Kryterium B']);

    // Edycja kryteriów nowej wersji nie może dotknąć wersji 1.
    await replaceCriteria(actorA, v2.id, [
      leaf({ id: 'c', refCode: 'A.1', title: 'Kryterium A zmienione' }),
    ]);
    const v1CriteriaAfter = await getCriteriaFlat(pack.id);
    expect(v1CriteriaAfter.map((c) => c.title).sort()).toEqual(['Kryterium A', 'Kryterium B']);
  });

  it('comparePackVersions raportuje dodane/usunięte/zmienione kryteria między wersjami', async () => {
    const packKey = `compare-${newId('k')}`;
    const pack = await createPack(actorA, { packKey, title: 'Pakiet do porównania' });
    cleanupPackIds.push(pack.id);
    await replaceCriteria(actorA, pack.id, [
      leaf({ id: 'keep', refCode: 'K.1', title: 'Bez zmian' }),
      leaf({ id: 'change', refCode: 'K.2', title: 'Do zmiany — wersja 1' }),
      leaf({ id: 'remove', refCode: 'K.3', title: 'Do usunięcia' }),
    ]);

    const v2 = await createNewVersion(actorA, packKey);
    cleanupPackIds.push(v2.id);
    await replaceCriteria(actorA, v2.id, [
      leaf({ id: 'keep2', refCode: 'K.1', title: 'Bez zmian' }),
      leaf({ id: 'change2', refCode: 'K.2', title: 'Do zmiany — wersja 2' }),
      leaf({ id: 'added', refCode: 'K.4', title: 'Nowe kryterium' }),
    ]);

    const diff = await comparePackVersions(actorA.organizationId, packKey, 1, 2);
    expect(diff.added.map((d) => d.refCode)).toEqual(['K.4']);
    expect(diff.removed.map((d) => d.refCode)).toEqual(['K.3']);
    expect(diff.changed.map((d) => d.refCode)).toEqual(['K.2']);
    expect(diff.changed[0].changedFields).toContain('title');
    expect(diff.unchangedCount).toBe(1);
  });

  it('seedDemoAuditPack jest idempotentny — drugie wywołanie zwraca ten sam pakiet bez duplikatu', async () => {
    const first = await seedDemoAuditPack(actorA.organizationId, actorA.userId);
    cleanupPackIds.push(first.id);
    expect(first.packKey).toBe(DEMO_PACK_KEY);
    expect(first.classification).toBe('DEMONSTRATION');
    // 3 domeny + 9 kryteriów liściowych.
    const flatFirst = await getCriteriaFlat(first.id);
    expect(flatFirst).toHaveLength(12);

    const second = await seedDemoAuditPack(actorA.organizationId, actorA.userId);
    expect(second.id).toBe(first.id);

    const countRow = await auditGet<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit_packs WHERE organization_id = $1 AND pack_key = $2`,
      [actorA.organizationId, DEMO_PACK_KEY]
    );
    expect(Number(countRow?.count ?? 0)).toBe(1);

    // Sprzątamy też źródło demonstracyjne utworzone przez seed.
    const packRow = await auditGet<{ source_id: string | null }>(
      `SELECT source_id FROM audit_packs WHERE id = $1`,
      [first.id]
    );
    if (packRow?.source_id) cleanupSourceIds.push(packRow.source_id);
  });
});
