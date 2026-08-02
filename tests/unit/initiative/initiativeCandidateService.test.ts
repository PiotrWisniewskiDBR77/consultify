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

// F2→F1 wiring imports the canonical funnel + generator brain. Mock both so the
// service module imports cleanly without pulling the real LLM/DB chain. Per-test
// behaviour is exercised through INJECTED deps (opts.deps), not these spies —
// these only guarantee the module graph stays light + give a real-default safety net.
// vi.hoisted lifts the spies above the hoisted vi.mock factories.
const { mockFunnelCreate, mockGenerateFull, mockGeneratorDefaultDeps } = vi.hoisted(() => ({
  mockFunnelCreate: vi.fn(async (_orgId: string, input: any) => ({
    id: 'init-default',
    name: input?.title ?? 'T',
    title: input?.title ?? 'T',
    status: 'DRAFT',
    sourceType: input?.sourceType ?? 'manual',
    sourceId: input?.sourceId ?? null,
  })),
  mockGenerateFull: vi.fn(async (_deps: any, input: any) => ({
    initiativeId: input?.initiativeId ?? 'init-default',
    language: 'pl',
    cards: {},
    outcomes: [],
    qualitySummary: { total: 0, filled: 0, failed: 0, healed: 0, averageScore: null, belowThreshold: [] },
  })),
  mockGeneratorDefaultDeps: vi.fn(() => ({ generationService: {} as any })),
}));
vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative: mockFunnelCreate,
  default: { createInitiative: mockFunnelCreate },
}));
vi.mock('../../../server/src/services/initiative/initiativeGeneratorBrain.js', () => ({
  generateFullInitiative: mockGenerateFull,
  defaultDeps: mockGeneratorDefaultDeps,
}));

import {
  acceptCandidate,
  buildCandidateFromArtifact,
  dismissCandidate,
  listCandidates,
  scanForCandidates,
  type AcceptDeps,
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
  it('zwraca payload generatora i zapisuje accepted dopiero z initiative receipt', async () => {
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
    // Domyślny mock lejka zwraca init-default, więc receipt jest kompletny.
    const updateCall = db.calls.run.find(([sql]) => sql.includes("status = 'accepted'"));
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).toContain('initiative_id = ?');
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

  it('zwraca payload nawet gdy zapis receipt padnie (recoverable)', async () => {
    const db = makeDb({
      queryOne: async () => ({
        id: 'c1',
        organization_id: 'org-1',
        source_type: 'assessment',
        source_id: 'as-1',
        title: 'T',
        rationale: 'R',
        status: 'accepted',
        initiative_id: 'init-existing',
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
describe('F2→F1 — acceptCandidate tworzy DRAFT + uruchamia generator', () => {
  beforeEach(() => vi.clearAllMocks());

  const candidateRow = {
    id: 'c1',
    organization_id: 'org-1',
    source_type: 'interview_insight',
    source_id: 'ins-1',
    title: 'Inicjatywa: Czas obsługi',
    rationale: 'AI sugeruje na podstawie insightu',
    fit_score: 0.7,
    status: 'pending',
  };

  function makeAcceptDeps(over: Partial<AcceptDeps> = {}): AcceptDeps & {
    createCalls: any[][];
    fillCalls: any[][];
  } {
    const createCalls: any[][] = [];
    const fillCalls: any[][] = [];
    return {
      createCalls,
      fillCalls,
      createInitiative: over.createInitiative
        ? over.createInitiative
        : (((orgId: string, input: any, options: any) => {
            createCalls.push([orgId, input, options]);
            return Promise.resolve({
              id: 'init-9',
              name: input.title,
              title: input.title,
              status: 'DRAFT',
              sourceType: input.sourceType,
              sourceId: input.sourceId ?? null,
            });
          }) as any),
      generateFull: over.generateFull
        ? over.generateFull
        : (((deps: any, input: any) => {
            fillCalls.push([deps, input]);
            return Promise.resolve({
              initiativeId: input.initiativeId,
              language: 'pl',
              cards: { problemDefinition: 'x' },
              outcomes: [],
              qualitySummary: { total: 6, filled: 5, failed: 1, healed: 0, averageScore: 8, belowThreshold: [] },
            });
          }) as any),
      generatorDeps: over.generatorDeps ?? ((() => ({ generationService: {} as any })) as any),
    };
  }

  it('tworzy DRAFT z liniażem kandydata (source_type/source_id) i zwraca initiativeId', async () => {
    const db = makeDb({ queryOne: async () => candidateRow, queryRun: async () => ({ changes: 1 }) });
    const deps = makeAcceptDeps();
    const payload = await acceptCandidate(db, 'c1', { orgId: 'org-1', userId: 'u-1', deps });

    expect(payload).not.toBeNull();
    expect(payload!.initiativeId).toBe('init-9');
    expect(deps.createCalls).toHaveLength(1);
    const [orgArg, inputArg, optsArg] = deps.createCalls[0];
    expect(orgArg).toBe('org-1');
    expect(inputArg.title).toBe('Inicjatywa: Czas obsługi');
    expect(inputArg.sourceType).toBe('interview_insight');
    expect(inputArg.sourceId).toBe('ins-1');
    expect(inputArg.status).toBeUndefined(); // funnel normalizuje do DRAFT
    expect(optsArg.actor.id).toBe('u-1');
  });

  it('uruchamia generator (fill domyślnie true) z initiativeId + brief + sourceType', async () => {
    const db = makeDb({ queryOne: async () => candidateRow, queryRun: async () => ({ changes: 1 }) });
    const deps = makeAcceptDeps();
    const payload = await acceptCandidate(db, 'c1', { orgId: 'org-1', deps });

    expect(deps.fillCalls).toHaveLength(1);
    const [, fillInput] = deps.fillCalls[0];
    expect(fillInput.initiativeId).toBe('init-9');
    expect(fillInput.brief).toContain('Inicjatywa: Czas obsługi');
    expect(fillInput.sourceType).toBe('interview_insight');
    expect(payload!.filled).toBe(true); // qualitySummary.filled > 0
  });

  it('fill=false tworzy DRAFT ale NIE uruchamia generatora', async () => {
    const db = makeDb({ queryOne: async () => candidateRow, queryRun: async () => ({ changes: 1 }) });
    const deps = makeAcceptDeps();
    const payload = await acceptCandidate(db, 'c1', { orgId: 'org-1', fill: false, deps });

    expect(payload!.initiativeId).toBe('init-9');
    expect(deps.createCalls).toHaveLength(1);
    expect(deps.fillCalls).toHaveLength(0);
    expect(payload!.filled).toBe(false);
  });

  it('fail-soft: fill rzuca → DRAFT nadal utworzony, filled=false, accept OK', async () => {
    const db = makeDb({ queryOne: async () => candidateRow, queryRun: async () => ({ changes: 1 }) });
    const deps = makeAcceptDeps({
      generateFull: (async () => {
        throw new Error('LLM down');
      }) as any,
    });
    const payload = await acceptCandidate(db, 'c1', { orgId: 'org-1', deps });

    expect(payload).not.toBeNull();
    expect(payload!.initiativeId).toBe('init-9'); // DRAFT przetrwał
    expect(payload!.filled).toBe(false);
  });

  it('fail-soft: createInitiative rzuca → payload z initiativeId=null, brak fill i brak fałszywego accepted', async () => {
    const db = makeDb({ queryOne: async () => candidateRow, queryRun: async () => ({ changes: 1 }) });
    const deps = makeAcceptDeps({
      createInitiative: (async () => {
        throw new Error('funnel boom');
      }) as any,
    });
    const payload = await acceptCandidate(db, 'c1', { orgId: 'org-1', deps });

    expect(payload).not.toBeNull();
    expect(payload!.initiativeId).toBeNull();
    expect(payload!.filled).toBe(false);
    expect(deps.fillCalls).toHaveLength(0); // brak initiativeId → brak fill
    expect(db.calls.run.some(([sql]) => sql.includes("status = 'accepted'"))).toBe(false);
  });

  it('po utworzeniu DRAFTU zapisuje org-scoped receipt i accepted', async () => {
    const db = makeDb({ queryOne: async () => candidateRow, queryRun: async () => ({ changes: 1 }) });
    const deps = makeAcceptDeps();
    await acceptCandidate(db, 'c1', { orgId: 'org-1', deps });

    const updateCall = db.calls.run.find(([sql]) => sql.includes("status = 'accepted'"));
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).toContain('initiative_id = ?');
    expect(updateCall![0]).toContain('organization_id = ?');
    expect(updateCall![1]).toEqual(['init-9', null, 'c1', 'org-1']);
  });

  it('retry zaakceptowanego kandydata zwraca receipt bez ponownego create ani fill', async () => {
    const db = makeDb({
      queryOne: async () => ({ ...candidateRow, status: 'accepted', initiative_id: 'init-receipt' }),
      queryRun: async () => ({ changes: 1 }),
    });
    const deps = makeAcceptDeps();

    const payload = await acceptCandidate(db, 'c1', { orgId: 'org-1', deps });

    expect(payload!.initiativeId).toBe('init-receipt');
    expect(deps.createCalls).toHaveLength(0);
    expect(deps.fillCalls).toHaveLength(0);
    expect(db.calls.run).toHaveLength(0);
  });

  it('semanticzny duplikat zapisuje jawny merge receipt do istniejącej inicjatywy', async () => {
    const db = makeDb({
      queryOne: async (sql: string) => (sql.includes('initiative_candidates') ? candidateRow : null),
      queryAll: async (sql: string) =>
        sql.includes('FROM initiatives')
          ? [{ id: 'init-existing', title: 'Inicjatywa: Czas obsługi', status: 'DRAFT' }]
          : [],
      queryRun: async () => ({ changes: 1 }),
    });
    const deps = makeAcceptDeps();

    const payload = await acceptCandidate(db, 'c1', { orgId: 'org-1', deps });

    expect(payload!.initiativeId).toBe('init-existing');
    expect(payload!.duplicateOfInitiativeId).toBe('init-existing');
    expect(deps.createCalls).toHaveLength(0);
    expect(deps.fillCalls).toHaveLength(0);
    const receipt = db.calls.run.find(([sql]) => sql.includes('duplicate_of_initiative_id'));
    expect(receipt![1]).toEqual(['init-existing', 'init-existing', 'c1', 'org-1']);
  });

  it('filled=false gdy generator nic nie wypełnił (qualitySummary.filled=0)', async () => {
    const db = makeDb({ queryOne: async () => candidateRow, queryRun: async () => ({ changes: 1 }) });
    const deps = makeAcceptDeps({
      generateFull: (async (_d: any, input: any) => ({
        initiativeId: input.initiativeId,
        language: 'pl',
        cards: {},
        outcomes: [],
        qualitySummary: { total: 6, filled: 0, failed: 6, healed: 0, averageScore: null, belowThreshold: [] },
      })) as any,
    });
    const payload = await acceptCandidate(db, 'c1', { orgId: 'org-1', deps });
    expect(payload!.filled).toBe(false);
  });

  it('liniaż degraduje do manual gdy kandydat nie ma sourceId', async () => {
    const db = makeDb({
      queryOne: async () => ({ ...candidateRow, source_id: null }),
      queryRun: async () => ({ changes: 1 }),
    });
    const deps = makeAcceptDeps();
    await acceptCandidate(db, 'c1', { orgId: 'org-1', deps });

    const [, inputArg] = deps.createCalls[0];
    expect(inputArg.sourceType).toBe('manual');
    expect(inputArg.sourceId).toBeNull();
  });

  it('back-compat: 3-ci argument jako string traktowany jako orgId', async () => {
    const db = makeDb({ queryOne: async () => candidateRow, queryRun: async () => ({ changes: 1 }) });
    // brak deps → użyje zamockowanych modułów (mockFunnelCreate / mockGenerateFull)
    const payload = await acceptCandidate(db, 'c1', 'org-1');
    expect(payload).not.toBeNull();
    expect(payload!.candidateId).toBe('c1');
    // org-scoped lookup wykonany (SELECT z organization_id)
    const selectCall = db.calls.one.find(([sql]) => sql.includes('organization_id'));
    expect(selectCall).toBeDefined();
  });
});

// ===========================================================================
// Zwornik Delta C — project inheritance on accept (sourceProjectResolver.ts
// is NOT mocked here: its real logic runs against the injected mock db, which
// is the intended integration seam).
describe('F2→F1 — acceptCandidate: zwornik project inheritance', () => {
  beforeEach(() => vi.clearAllMocks());

  const assessmentCandidate = {
    id: 'c2',
    organization_id: 'org-1',
    source_type: 'assessment',
    source_id: 'assess-1',
    title: 'Inicjatywa: Z assessmentu',
    rationale: 'AI sugeruje na podstawie assessmentu',
    fit_score: 0.7,
    status: 'pending',
  };

  const interviewCandidate = {
    id: 'c3',
    organization_id: 'org-1',
    source_type: 'interview_insight',
    source_id: 'ins-1',
    title: 'Inicjatywa: Z wywiadu',
    rationale: 'AI sugeruje na podstawie insightu',
    fit_score: 0.7,
    status: 'pending',
  };

  function makeAcceptDeps() {
    const createCalls: any[][] = [];
    return {
      createCalls,
      createInitiative: (async (orgId: string, input: any, options: any) => {
        createCalls.push([orgId, input, options]);
        return {
          id: 'init-inherited',
          name: input.title,
          title: input.title,
          status: 'DRAFT',
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          projectId: input.projectId ?? null,
        };
      }) as any,
      generateFull: (async () => ({
        initiativeId: 'init-inherited',
        language: 'pl',
        cards: {},
        outcomes: [],
        qualitySummary: { total: 0, filled: 0, failed: 0, healed: 0, averageScore: null, belowThreshold: [] },
      })) as any,
      generatorDeps: (() => ({ generationService: {} as any })) as any,
    };
  }

  it('inherits project_id from the source assessment row', async () => {
    const db = makeDb({
      queryOne: async (sql: string) => {
        if (sql.includes('FROM initiative_candidates')) return assessmentCandidate;
        if (sql.includes('FROM assessments')) return { project_id: 'proj-from-assessment' };
        return null;
      },
      queryRun: async () => ({ changes: 1 }),
    });
    const deps = makeAcceptDeps();
    const payload = await acceptCandidate(db, 'c2', { orgId: 'org-1', deps });

    expect(payload!.initiativeId).toBe('init-inherited');
    expect(deps.createCalls).toHaveLength(1);
    const [, inputArg] = deps.createCalls[0];
    expect(inputArg.projectId).toBe('proj-from-assessment');
  });

  it('interview_insight source has no project concept → projectId stays null (funnel auto-anchors)', async () => {
    const db = makeDb({
      queryOne: async (sql: string) => {
        if (sql.includes('FROM initiative_candidates')) return interviewCandidate;
        // No 'FROM assessments'/'FROM audits' branch reached for this source type.
        throw new Error('should not query a project table for interview_insight');
      },
      queryRun: async () => ({ changes: 1 }),
    });
    const deps = makeAcceptDeps();
    const payload = await acceptCandidate(db, 'c3', { orgId: 'org-1', deps });

    expect(payload!.initiativeId).toBe('init-inherited');
    const [, inputArg] = deps.createCalls[0];
    expect(inputArg.projectId).toBeNull();
  });

  it('fail-soft: project lookup throwing does not block DRAFT creation', async () => {
    const db = makeDb({
      queryOne: async (sql: string) => {
        if (sql.includes('FROM initiative_candidates')) return assessmentCandidate;
        if (sql.includes('FROM assessments')) throw new Error('db down');
        return null;
      },
      queryRun: async () => ({ changes: 1 }),
    });
    const deps = makeAcceptDeps();
    const payload = await acceptCandidate(db, 'c2', { orgId: 'org-1', deps });

    expect(payload!.initiativeId).toBe('init-inherited');
    const [, inputArg] = deps.createCalls[0];
    expect(inputArg.projectId).toBeNull();
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
