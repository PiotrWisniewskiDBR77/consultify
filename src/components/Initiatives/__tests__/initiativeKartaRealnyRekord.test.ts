/**
 * PRZEJŚCIE NA ŻYWO 2026-09-05 — bezpiecznik rozjazdu LISTA ↔ KARTA INICJATYWY.
 *
 * Fakt zmierzony na realnym koncie właściciela (staging, org a3e05d4a…):
 * wiersze rejestru pochodzą z `GET /api/initiatives/runtime-v1/initiatives`,
 * a karta pytała wyłącznie tras, które tych rekordów NIE znają (404).
 * Ten test trzyma dwie rzeczy naraz:
 *   1. lista realnej organizacji NIE miesza się z fiksturą pokazową,
 *   2. karta ładuje realny rekord dokładnie tą trasą, z której przyszła lista.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readRegisteredInitiative } from '@/services/initiatives-execution/runtimeApi';
import type { RegisteredInitiativeReadModel } from '@/services/initiatives-execution/runtimeApi';

import {
  resolveInitiativeDocumentRecord,
  toInitiativeDocumentFromRegistration,
} from '../initiativeDocumentSource';
import {
  selectInitiativeRegisterSource,
  toCanonicalInitiativeRegisterItem,
} from '../initiativeRegisterProjection';
import { createInitiativesDemoDataset, isShowcaseInitiativeId } from '../initiativesDemoData';

/** Kopia 1:1 kształtu odpowiedzi ze stagingu (skrócona o pola nieużywane w teście). */
const REAL_REGISTRATION = {
  version: 1,
  updatedAt: '2026-08-26T04:01:55.596Z',
  initiative: {
    initiativeId: 'demo-story-20260826-initiative-traceability',
    title: 'Pełna identyfikowalność partii',
    problem: 'Dane partii są rozproszone pomiędzy systemami i arkuszami.',
    proposedOutcome: 'Identyfikacja źródła niezgodności w czasie krótszym niż 10 minut.',
    priority: 'MEDIUM',
    projectId: 'a3e05d4a-5397-419d-b486-8e44366c0063--acceptance--case-project',
    readiness: 'READY',
    visibility: 'PROJECT',
    lifecycleState: 'IN_EXECUTION',
    executionState: 'ACTIVE',
    initiativeOwnerId: 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2',
    updatedAt: '2026-08-26T04:01:55.283Z',
    source: {
      sourceId: 'demo-story-20260826-source-traceability',
      sourceType: 'DEMO_STORY',
      sourceVersion: 1,
      proposalId: 'demo-story-20260826-proposal-traceability',
      proposalVersion: 1,
      freshness: 'CURRENT',
      refreshedAt: '2026-08-26T04:01:55.283Z',
    },
  },
} as unknown as RegisteredInitiativeReadModel;

const REAL_ID = 'demo-story-20260826-initiative-traceability';

const notFound = () => Promise.reject(new Error('Initiative not found'));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rejestr Inicjatyw — wylacznie realne rekordy organizacji', () => {
  it('nie miesza fikstury pokazowej z wierszami API (zrodlo jest rozlaczne)', () => {
    const canonicalRows = [toCanonicalInitiativeRegisterItem(REAL_REGISTRATION)];
    const sampleRows = createInitiativesDemoDataset().initiatives;

    const realMode = selectInitiativeRegisterSource(canonicalRows, sampleRows, false);
    expect(realMode.map((row) => row.id)).toEqual([REAL_ID]);
    expect(realMode.some((row) => isShowcaseInitiativeId(row.id))).toBe(false);

    // Tryb fikstury jest wylaczny w druga strone — nigdy nakladka na realne.
    const sampleMode = selectInitiativeRegisterSource(canonicalRows, sampleRows, true);
    expect(sampleMode.length).toBeGreaterThan(0);
    expect(sampleMode.every((row) => isShowcaseInitiativeId(row.id))).toBe(true);
    expect(sampleMode.some((row) => row.id === REAL_ID)).toBe(false);
  });

  it('id `demo-story-*` z bazy NIE jest identyfikatorem pokazowym klienta', () => {
    // Fakt o danych: staging ma zaseedowane rekordy z prefiksem `demo-story-`.
    // Fikstura klienta uzywa prefiksu `init-showcase-`. Karta nie moze brac
    // pierwszego za drugie, bo wtedy szuka go w pamieci zamiast w API.
    expect(isShowcaseInitiativeId(REAL_ID)).toBe(false);
  });
});

describe('karta inicjatywy — ladowanie realnego rekordu', () => {
  it('laduje rekord z rejestru runtime-v1, gdy v8 i legacy zwracaja 404', async () => {
    const readInterviewInitiatives = vi.fn(async () => []);
    const record = await resolveInitiativeDocumentRecord(REAL_ID, {
      readPlanningInitiative: notFound,
      readLegacyInitiative: notFound,
      readRegisteredInitiative: async () => REAL_REGISTRATION,
      readInterviewInitiatives,
    });

    expect(record.id).toBe(REAL_ID);
    expect(record.title).toBe('Pełna identyfikowalność partii');
    expect(String(record.summary)).toContain('Dane partii');
    expect(record.documentOrigin).toBe('initiatives-runtime-v1');
    // Trasa ratunkowa `interview_insight` nie moze byc w ogole dotykana.
    expect(readInterviewInitiatives).not.toHaveBeenCalled();
  });

  it('uderza dokladnie w trase, z ktorej pochodzi lista (integracja z klientem HTTP)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).startsWith('/api/initiatives/runtime-v1/initiatives/')) {
        return new Response(JSON.stringify(REAL_REGISTRATION), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const record = await resolveInitiativeDocumentRecord(REAL_ID, {
      readPlanningInitiative: notFound,
      readLegacyInitiative: notFound,
      readRegisteredInitiative,
      readInterviewInitiatives: async () => [],
    });

    expect(record.id).toBe(REAL_ID);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toContain(
      `/api/initiatives/runtime-v1/initiatives/${REAL_ID}`
    );
  });

  /**
   * DOWOD MUTACYJNY: usun rejestr runtime-v1 z lancucha (stan sprzed naprawy) —
   * karta wraca do czerwonego bledu na tym samym, realnym rekordzie.
   */
  it('bez rejestru runtime-v1 ten sam realny rekord znowu nie laduje sie', async () => {
    await expect(
      resolveInitiativeDocumentRecord(REAL_ID, {
        readPlanningInitiative: notFound,
        readLegacyInitiative: notFound,
        readRegisteredInitiative: notFound as never,
        readInterviewInitiatives: async () => [],
        notFoundMessage: 'Nie udalo sie zaladowac karty inicjatywy',
      })
    ).rejects.toThrow('Nie udalo sie zaladowac karty inicjatywy');
  });

  it('adapter zachowuje tozsamosc i cykl zycia rekordu rejestru', () => {
    const mapped = toInitiativeDocumentFromRegistration(REAL_REGISTRATION);
    expect(mapped.id).toBe(REAL_ID);
    expect(mapped.canonicalVersion).toBe(1);
    expect(mapped.lifecycle).toBe('IN_EXECUTION');
    expect(String(mapped.expectedOutcome)).toContain('10 minut');
  });
});
