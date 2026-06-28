// @vitest-environment node
/**
 * F2/L1 — initiativeCandidateService: SKRZYNKA KANDYDATÓW (INITIATIVE_SYSTEM_SSOT §F2, D5/D8).
 *
 * Czysta logika z wstrzykiwanym mock-DB (CandidateDb). Pokrywa:
 *   - buildCandidateFromArtifact (heurystyka tytuł/rationale/fitScore)
 *   - scanForCandidates (buduje kandydatów, dedup, fail-soft)
 *   - listCandidates (filtr po statusie)
 *   - acceptCandidate (payload + mark accepted)
 *   - dismissCandidate
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// queryHelpers instancjuje getDatabase() — mockujemy, by import czystego serwisu
// nie wymagał realnej DB. Testy i tak wstrzykują własny mock-DB.
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
  queryRun: vi.fn(async () => ({ changes: 0 })),
}));

import {
  acceptCandidate,
  buildCandidateFromArtifact,
  dismissCandidate,
  listCandidates,
  scanForCandidates,
  type CandidateDb,
  type DiscoveryArtifact,
} from '../../../server/src/services/initiative/initiativeCandidateService.ts';

// --- mock DB factory -------------------------------------------------------

interface MockDbOpts {
  queryAll?: (sql: string, params: unknown[]) => Promise<any[]>;
  queryOne?: (sql: string, params: unknown[]) => Promise<any>;
  queryRun?: (sql: string, params: unknown[]) => Promise<{ changes: number }>;
}

function makeDb(opts: MockDbOpts = {}): CandidateDb & { calls: { all: any[][]; one: any[][]; run: any[][] } } {
  const calls = { all: [] as any[][], one: [] as any[][], run: [] as any[][] };
  return {
    calls,
    queryAll: (async (sql: string, params: unknown[] = []) => {
      calls.all.push([sql, params]);
      return (opts.queryAll ? opts.queryAll(sql, params) : Promise.resolve([])) as any;
    }) as CandidateDb['queryAll'],
    queryOne: (async (sql: string, params: unknown[] = []) => {
      calls.one.push([sql, params]);
      return (opts.queryOne ? opts.queryOne(sql, params) : Promise.resolve(null)) as any;
    }) as CandidateDb['queryOne'],
    queryRun: (async (sql: string, params: unknown[] = []) => {
      calls.run.push([sql, params]);
      return (opts.queryRun ? opts.queryRun(sql, params) : Promise.resolve({ changes: 0 })) as any;
    }) as CandidateDb['queryRun'],
  };
}

const insightArtifact: DiscoveryArtifact = {
  sourceType: 'interview_insight',
  sourceId: 'ins-1',
  title: 'Wysoki czas obsługi zgłoszeń',
  summary: 'Klienci czekają średnio 3 dni na odpowiedź; brak automatyzacji triage.',
};

// ===========================================================================
describe('F2/L1 — buildCandidateFromArtifact (heurystyka)', () => {
  it('buduje tytuł z prefiksem akcji z tytułu artefaktu', () => {
    const c = buildCandidateFromArtifact(insightArtifact);
    expect(c.title).toContain('Inicjatywa:');
    expect(c.title).toContain('Wysoki czas obsługi');
  });

  it('rationale opisuje źródło i streszczenie', () => {
    const c = buildCandidateFromArtifact(insightArtifact);
    expect(c.rationale).toContain('insightu z wywiadu');
    expect(c.rationale.length).toBeGreaterThan(0);
  });

  it('fitScore jest deterministyczny i w zakresie 0..1', () => {
    const a = buildCandidateFromArtifact(insightArtifact);
    const b = buildCandidateFromArtifact(insightArtifact);
    expect(a.fitScore).toBe(b.fitScore);
    expect(a.fitScore).toBeGreaterThanOrEqual(0);
    expect(a.fitScore).toBeLessThanOrEqual(1);
  });

  it('bogatszy artefakt → wyższy fitScore niż ubogi', () => {
    const rich = buildCandidateFromArtifact(insightArtifact);
    const poor = buildCandidateFromArtifact({
      sourceType: 'audit',
      sourceId: 'a-1',
      title: 'X',
    });
    expect(rich.fitScore).toBeGreaterThan(poor.fitScore);
  });

  it('pusty tytuł → bezpieczny fallback tytułu', () => {
    const c = buildCandidateFromArtifact({ sourceType: 'audit', sourceId: 'a-2', title: '' });
    expect(c.title.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
describe('F2/L1 — scanForCandidates', () => {
  it('brak orgId → pusta lista (guard)', async () => {
    const db = makeDb();
    expect(await scanForCandidates(db, undefined)).toEqual([]);
  });

  it('buduje kandydatów z artefaktów rozpoznania (insert RETURNING)', async () => {
    let inserted = 0;
    const db = makeDb({
      queryAll: async (sql) => {
        if (sql.includes('FROM interview_insights')) return [{ id: 'ins-1', title: 'Czas obsługi', summary: 'wolno' }];
        if (sql.includes('FROM initiative_candidates')) return []; // brak istniejących
        return [];
      },
      queryOne: async (sql, params) => {
        if (sql.includes('INSERT INTO initiative_candidates')) {
          inserted += 1;
          return {
            id: `cand-${inserted}`,
            organization_id: 'org-1',
            source_type: params[1],
            source_id: params[2],
            title: params[3],
            rationale: params[4],
            fit_score: params[5],
            status: 'pending',
          };
        }
        return null;
      },
    });
    const created = await scanForCandidates(db, 'org-1');
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe('pending');
    expect(created[0].sourceType).toBe('interview_insight');
    expect(created[0].title).toContain('Inicjatywa:');
  });

  it('dedup: artefakt z istniejącym kandydatem jest pomijany', async () => {
    const db = makeDb({
      queryAll: async (sql) => {
        if (sql.includes('FROM interview_insights')) return [{ id: 'ins-1', title: 'T', summary: 'S' }];
        if (sql.includes('FROM initiative_candidates'))
          return [{ source_type: 'interview_insight', source_id: 'ins-1' }];
        return [];
      },
      queryOne: async () => {
        throw new Error('should not insert a duplicate');
      },
    });
    const created = await scanForCandidates(db, 'org-1');
    expect(created).toEqual([]);
  });

  it('fail-soft: błąd ładowania źródeł → pusta lista, brak wyjątku', async () => {
    const db = makeDb({
      queryAll: async () => {
        throw new Error('db down');
      },
    });
    await expect(scanForCandidates(db, 'org-1')).resolves.toEqual([]);
  });

  it('fail-soft: pojedynczy insert pada → kontynuuje resztę', async () => {
    const db = makeDb({
      queryAll: async (sql) => {
        if (sql.includes('FROM interview_insights'))
          return [
            { id: 'ins-1', title: 'A', summary: 'sa' },
            { id: 'ins-2', title: 'B', summary: 'sb' },
          ];
        if (sql.includes('FROM initiative_candidates')) return [];
        return [];
      },
      queryOne: async (sql, params) => {
        if (sql.includes('INSERT')) {
          if (params[2] === 'ins-1') throw new Error('insert fail');
          return {
            id: 'cand-2',
            organization_id: 'org-1',
            source_type: params[1],
            source_id: params[2],
            title: params[3],
            rationale: params[4],
            fit_score: params[5],
            status: 'pending',
          };
        }
        return null;
      },
    });
    const created = await scanForCandidates(db, 'org-1');
    expect(created).toHaveLength(1);
    expect(created[0].sourceId).toBe('ins-2');
  });
});

// ===========================================================================
describe('F2/L1 — listCandidates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('brak orgId → pusta lista', async () => {
    const db = makeDb();
    expect(await listCandidates(db, undefined)).toEqual([]);
  });

  it('mapuje wiersze DB na model kandydata', async () => {
    const db = makeDb({
      queryAll: async () => [
        {
          id: 'c1',
          organization_id: 'org-1',
          source_type: 'assessment',
          source_id: 'as-9',
          title: 'T',
          rationale: 'R',
          fit_score: 0.7,
          status: 'pending',
        },
      ],
    });
    const list = await listCandidates(db, 'org-1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'c1', sourceType: 'assessment', fitScore: 0.7, status: 'pending' });
  });

  it('filtr po statusie dokłada warunek status = ?', async () => {
    const db = makeDb({ queryAll: async () => [] });
    await listCandidates(db, 'org-1', 'dismissed');
    const [sql, params] = db.calls.all[0];
    expect(sql).toContain('status = ?');
    expect(params).toContain('dismissed');
  });

  it('bez statusu — brak warunku status', async () => {
    const db = makeDb({ queryAll: async () => [] });
    await listCandidates(db, 'org-1');
    const [sql] = db.calls.all[0];
    expect(sql).not.toContain('status = ?');
  });

  it('fail-soft: błąd zapytania → pusta lista', async () => {
    const db = makeDb({
      queryAll: async () => {
        throw new Error('boom');
      },
    });
    await expect(listCandidates(db, 'org-1')).resolves.toEqual([]);
  });
});

// ===========================================================================
describe('F2/L1 — acceptCandidate', () => {
  it('zwraca payload generatora i oznacza accepted', async () => {
    const db = makeDb({
      queryOne: async () => ({
        id: 'c1',
        organization_id: 'org-1',
        source_type: 'audit',
        source_id: 'au-1',
        title: 'Inicjatywa: Audyt',
        rationale: 'Uzasadnienie',
        fit_score: 0.6,
        status: 'pending',
      }),
      queryRun: async () => ({ changes: 1 }),
    });
    const payload = await acceptCandidate(db, 'c1', 'org-1');
    expect(payload).not.toBeNull();
    expect(payload!.candidateId).toBe('c1');
    expect(payload!.sourceType).toBe('audit');
    expect(payload!.brief).toContain('Inicjatywa: Audyt');
    expect(payload!.brief).toContain('Uzasadnienie');
    // mark accepted wykonany
    const updateCall = db.calls.run.find(([sql]) => sql.includes("status = 'accepted'"));
    expect(updateCall).toBeDefined();
  });

  it('nieistniejący kandydat → null', async () => {
    const db = makeDb({ queryOne: async () => null });
    expect(await acceptCandidate(db, 'nope', 'org-1')).toBeNull();
  });

  it('brak id → null', async () => {
    const db = makeDb();
    expect(await acceptCandidate(db, undefined, 'org-1')).toBeNull();
  });

  it('fail-soft: błąd selecta → null', async () => {
    const db = makeDb({
      queryOne: async () => {
        throw new Error('boom');
      },
    });
    await expect(acceptCandidate(db, 'c1', 'org-1')).resolves.toBeNull();
  });

  it('zwraca payload nawet gdy mark-accepted padnie (recoverable)', async () => {
    const db = makeDb({
      queryOne: async () => ({
        id: 'c1',
        organization_id: 'org-1',
        source_type: 'assessment',
        source_id: 'as-1',
        title: 'T',
        rationale: 'R',
        status: 'pending',
      }),
      queryRun: async () => {
        throw new Error('update fail');
      },
    });
    const payload = await acceptCandidate(db, 'c1', 'org-1');
    expect(payload).not.toBeNull();
    expect(payload!.candidateId).toBe('c1');
  });
});

// ===========================================================================
describe('F2/L1 — dismissCandidate', () => {
  it('oznacza dismissed i zwraca true gdy zmieniono wiersz', async () => {
    const db = makeDb({ queryRun: async () => ({ changes: 1 }) });
    expect(await dismissCandidate(db, 'c1', 'org-1')).toBe(true);
    const [sql] = db.calls.run[0];
    expect(sql).toContain("status = 'dismissed'");
  });

  it('brak zmienionego wiersza → false', async () => {
    const db = makeDb({ queryRun: async () => ({ changes: 0 }) });
    expect(await dismissCandidate(db, 'c1', 'org-1')).toBe(false);
  });

  it('brak id → false', async () => {
    const db = makeDb();
    expect(await dismissCandidate(db, undefined, 'org-1')).toBe(false);
  });

  it('fail-soft: błąd update → false', async () => {
    const db = makeDb({
      queryRun: async () => {
        throw new Error('boom');
      },
    });
    await expect(dismissCandidate(db, 'c1', 'org-1')).resolves.toBe(false);
  });
});
