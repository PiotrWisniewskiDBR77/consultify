/**
 * normSourceService.test — przeciw REALNEJ bazie Postgres (patrz nagłówek
 * pliku uruchomieniowy w prompcie zadania: NODE_ENV=test DB_TYPE=postgres
 * RUN_DB_TESTS=1 MOCK_DB=false).
 *
 * Każdy test sprząta po sobie — baza jest wspólna dla wszystkich testów tego
 * pliku i innych plików w tym worktree.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { auditRun, newId } from '../auditsDb.js';
import {
  createSource,
  deleteSource,
  getSource,
  listSources,
  updateSource,
  verifySource,
} from '../normSourceService.js';
import type { AuditActor } from '../types.js';

const ORG_A = `org-test-u2-nss-a-${newId('run')}`;
const ORG_B = `org-test-u2-nss-b-${newId('run')}`;
const actorA: AuditActor = { organizationId: ORG_A, userId: 'user-a' };
const actorB: AuditActor = { organizationId: ORG_B, userId: 'user-b' };

const cleanupSourceIds: string[] = [];
const cleanupPackIds: string[] = [];

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

describe('normSourceService', () => {
  it('create -> get -> update -> delete lifecycle', async () => {
    const created = await createSource(actorA, {
      sourceKey: `demo-key-${newId('k')}`,
      title: 'Źródło testowe',
      sourceKind: 'internal_procedure',
      rightsStatus: 'not_verified',
    });
    cleanupSourceIds.push(created.id);

    expect(created.organizationId).toBe(ORG_A);
    expect(created.verificationStatus).toBe('UNVERIFIED');

    const fetched = await getSource(actorA.organizationId, created.id);
    expect(fetched.title).toBe('Źródło testowe');

    const updated = await updateSource(actorA, created.id, { title: 'Źródło zaktualizowane' });
    expect(updated.title).toBe('Źródło zaktualizowane');

    await deleteSource(actorA, created.id);
    await expect(getSource(actorA.organizationId, created.id)).rejects.toThrow(/nie został znaleziony/);
    // Usunięte — nie sprzątamy go drugi raz.
    cleanupSourceIds.pop();
  });

  it('izolacja organizacji: źródło utworzone w organizacji A jest niewidoczne dla organizacji B', async () => {
    const created = await createSource(actorA, {
      sourceKey: `isolated-${newId('k')}`,
      title: 'Źródło tylko dla A',
    });
    cleanupSourceIds.push(created.id);

    await expect(getSource(actorB.organizationId, created.id)).rejects.toThrow(/nie został znaleziony/);

    const listForB = await listSources(actorB.organizationId, {});
    expect(listForB.items.some((s) => s.id === created.id)).toBe(false);

    const listForA = await listSources(actorA.organizationId, {});
    expect(listForA.items.some((s) => s.id === created.id)).toBe(true);
  });

  it('verifySource blokuje VERIFIED bez wersji/praw/wydawcy i przechodzi, gdy komplet jest spełniony', async () => {
    const created = await createSource(actorA, {
      sourceKey: `verify-${newId('k')}`,
      title: 'Źródło do weryfikacji',
      sourceKind: 'normative_standard',
      rightsStatus: 'not_verified',
    });
    cleanupSourceIds.push(created.id);

    // Brak source_version, publisher i rights_status nieuprawniający — blokada.
    await expect(
      verifySource(actorA, created.id, { verificationStatus: 'VERIFIED' }),
    ).rejects.toThrow(/AUDIT_SOURCE_NOT_VERIFIABLE|nie można oznaczyć/i);

    // Uzupełniamy brakujące pola.
    await updateSource(actorA, created.id, {
      sourceVersion: '2018',
      publisher: 'Wydawca testowy',
      rightsStatus: 'licensed',
    });

    const verified = await verifySource(actorA, created.id, {
      verificationStatus: 'VERIFIED',
      verificationNote: 'Sprawdzone w teście',
    });
    expect(verified.verificationStatus).toBe('VERIFIED');
    expect(verified.verifiedBy).toBe(actorA.userId);
    expect(verified.verifiedAt).not.toBeNull();
  });

  it('deleteSource odmawia usunięcia źródła używanego przez opublikowany pakiet', async () => {
    const created = await createSource(actorA, {
      sourceKey: `used-${newId('k')}`,
      title: 'Źródło w użyciu',
    });
    cleanupSourceIds.push(created.id);

    const packId = newId('apk');
    await auditRun(
      `INSERT INTO audit_packs
         (id, organization_id, pack_key, version, title, source_id, classification, publication_status)
       VALUES ($1,$2,$3,1,$4,$5,'DEMONSTRATION','published')`,
      [packId, actorA.organizationId, `pack-key-${packId}`, 'Pakiet używający źródła', created.id],
    );
    cleanupPackIds.push(packId);

    await expect(deleteSource(actorA, created.id)).rejects.toThrow(/wykorzystywane przez opublikowany pakiet/);

    // Po usunięciu pakietu usunięcie źródła powinno się udać.
    await auditRun(`DELETE FROM audit_packs WHERE id = $1`, [packId]);
    cleanupPackIds.pop();
    await deleteSource(actorA, created.id);
    cleanupSourceIds.pop();
  });

  it('createSource odrzuca nieznany source_kind / rights_status', async () => {
    await expect(
      createSource(actorA, {
        sourceKey: `bad-${newId('k')}`,
        title: 'Zły rodzaj',
        // @ts-expect-error celowo nieprawidłowa wartość
        sourceKind: 'not_a_real_kind',
      }),
    ).rejects.toThrow(/Nieznany rodzaj źródła/);
  });
});
