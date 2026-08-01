/**
 * L2 — Integracja: serwisy KRĘGOSŁUPA inicjatyw (≥20 testów).
 *
 * Ćwiczy logikę stojącą ZA nowymi endpointami backbone (mock-DB), tak jak
 * statusLifecycle.test.ts ćwiczy realny handler statusów. Tu skupiamy się na
 * KONTRAKTACH integracyjnych, na których polegają routery:
 *
 *   • portfolioAnalysisService.getPortfolioHealth — adapter DB → kształt PortfolioHealth,
 *     delegacja do funkcji czystych, fail-safe na błędzie zapytania.
 *   • initiativeCandidateService.{scanForCandidates,listCandidates,acceptCandidate,
 *     dismissCandidate} — happy + fail-soft (schema drift → [] / null / false).
 *   • initiativeMaterializeService.{materializeInitiative,materializePortfolio} —
 *     tabela → niepusty bufor + nazwa/mime; brak inicjatywy/pusty portfel → null
 *     (mockujemy ciężkie generatory M17, by test był szybki i deterministyczny).
 *   • auditInitiativeService.createInitiativeFromAudit — stampuje source_type=audit,
 *     DRAFT; ścieżki 404 (brak audytu) / 422 (brak findingu).
 *
 * Wzór mocków = statusLifecycle.test.ts (vi.mock queryHelpers itp., importy `.js`).
 * Dowód dla: WYNIKI_M13_SYSTEM (L2 backbone).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── mocki współdzielone ──
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockFunnelCreate = vi.fn();

// Heavy M17 generators — zamockowane, by L2 nie generował realnych plików Office.
const mockTableSchemaToWorkbook = vi.fn();
const mockBuildWorkbookBuffer = vi.fn();
const mockContentToDocumentSchema = vi.fn();
const mockSafeBundleBaseName = vi.fn();
const mockRenderDocx = vi.fn();
const mockDeckPptx = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  getTableColumns: (...a: unknown[]) => mockGetTableColumns(...a),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative: (...a: unknown[]) => mockFunnelCreate(...a),
}));
vi.mock('../../../server/src/services/workbook/WorkbookBuilder.js', () => ({
  tableSchemaToWorkbook: (...a: unknown[]) => mockTableSchemaToWorkbook(...a),
  buildWorkbookBuffer: (...a: unknown[]) => mockBuildWorkbookBuffer(...a),
}));
vi.mock('../../../server/src/services/deliverables/bundleExportRuntime.js', () => ({
  contentToDocumentSchema: (...a: unknown[]) => mockContentToDocumentSchema(...a),
  safeBundleBaseName: (...a: unknown[]) => mockSafeBundleBaseName(...a),
}));
vi.mock('../../../server/src/services/documentStudio/documentDocxRenderer.js', () => ({
  renderDocumentSchemaToDocxBuffer: (...a: unknown[]) => mockRenderDocx(...a),
}));
vi.mock('../../../server/src/services/deliverables/bundlePptxRuntime.js', () => ({
  deckPlansToPptxBuffer: (...a: unknown[]) => mockDeckPptx(...a),
}));

// Lazy imports (po zarejestrowaniu mocków).
async function portfolioMod() {
  return import('../../../server/src/services/initiative/portfolioAnalysisService.js');
}
async function candidateMod() {
  return import('../../../server/src/services/initiative/initiativeCandidateService.js');
}
async function materializeMod() {
  return import('../../../server/src/services/initiative/initiativeMaterializeService.js');
}
async function auditMod() {
  return import('../../../server/src/services/initiative/auditInitiativeService.js');
}

/** Injectable DB shim z mock-funkcji (kandydaci/materialize biorą `db`). */
const db = {
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryAll.mockResolvedValue([]);
  mockQueryOne.mockResolvedValue(null);
  mockQueryRun.mockResolvedValue({ changes: 0 });
  mockGetTableColumns.mockResolvedValue([{ name: 'risk_level' }, { name: 'created_by' }]);
  mockSafeBundleBaseName.mockImplementation((s: string) => String(s || 'plik').replace(/\s+/g, '-'));
  mockTableSchemaToWorkbook.mockReturnValue({ wb: true });
  mockBuildWorkbookBuffer.mockResolvedValue(Buffer.from('XLSXDATA'));
  mockContentToDocumentSchema.mockReturnValue({ doc: true });
  mockRenderDocx.mockResolvedValue(Buffer.from('DOCXDATA'));
  mockDeckPptx.mockResolvedValue(Buffer.from('PPTXDATA'));
});

// ═══════════════════════════════════════════════════════════════════════════
// A. portfolioAnalysisService.getPortfolioHealth (delegacja + fail-safe)
// ═══════════════════════════════════════════════════════════════════════════
describe('L2 — getPortfolioHealth (adapter DB → PortfolioHealth)', () => {
  it('B-A1: pusty org → kształt z byStatus/coverage/gaps/balance/total=0', async () => {
    const { getPortfolioHealth } = await portfolioMod();
    mockQueryAll.mockResolvedValue([]);
    const h = await getPortfolioHealth(db, 'org-1');
    expect(h).toMatchObject({ total: 0 });
    expect(h).toHaveProperty('byStatus');
    expect(Array.isArray(h.coverage)).toBe(true);
    expect(Array.isArray(h.gaps)).toBe(true);
    expect(h.balance).toHaveProperty('quickWins');
  });

  it('B-A2: brak orgId → zwraca zdrowie pustego portfela (nie pyta DB)', async () => {
    const { getPortfolioHealth } = await portfolioMod();
    const h = await getPortfolioHealth(db, '');
    expect(h.total).toBe(0);
    expect(mockQueryAll).not.toHaveBeenCalled();
  });

  it('B-A3: realne wiersze → byStatus liczy statusy, coverage pokrywa pełną taksonomię (8)', async () => {
    const { getPortfolioHealth } = await portfolioMod();
    mockQueryAll.mockResolvedValue([
      { id: '1', title: 'Automatyzacja procesu zamówień', summary: '', status: 'EXECUTING', area: 'proces', category: null, effort: 'low', impact: 'high' },
      { id: '2', title: 'Pulpit analityczny danych', summary: '', status: 'DRAFT', area: 'dane', category: null, effort: 'high', impact: 'high' },
    ]);
    const h = await getPortfolioHealth(db, 'org-1');
    expect(h.total).toBe(2);
    expect(h.byStatus.EXECUTING).toBe(1);
    expect(h.byStatus.DRAFT).toBe(1);
    expect(h.coverage).toHaveLength(8); // pełna taksonomia MECE
    expect(h.balance.quickWins).toBe(1); // low effort + high impact
    expect(h.balance.bigBets).toBe(1); // high effort + high impact
  });

  it('B-A4: błąd zapytania (schema drift) → fail-safe, pusty portfel (NIE rzuca)', async () => {
    const { getPortfolioHealth } = await portfolioMod();
    mockQueryAll.mockRejectedValue(new Error('no such column: area'));
    const h = await getPortfolioHealth(db, 'org-1');
    expect(h.total).toBe(0);
    expect(h.coverage).toHaveLength(8);
  });

  it('B-A5: gaps wymienia taksonomiczne obszary bez pokrycia', async () => {
    const { getPortfolioHealth } = await portfolioMod();
    mockQueryAll.mockResolvedValue([
      { id: '1', title: 'Inicjatywa danych', summary: '', status: 'DRAFT', area: 'dane', category: null, effort: 'medium', impact: 'medium' },
    ]);
    const h = await getPortfolioHealth(db, 'org-1');
    expect(h.gaps).toContain('process'); // brak pokrycia procesu
    expect(h.gaps).not.toContain('data'); // dane pokryte
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. initiativeCandidateService (scan/list/accept/dismiss — happy + fail-soft)
// ═══════════════════════════════════════════════════════════════════════════
describe('L2 — initiativeCandidateService', () => {
  it('B-B1: scanForCandidates — brak orgId → [] (guard)', async () => {
    const { scanForCandidates } = await candidateMod();
    const out = await scanForCandidates(db, undefined);
    expect(out).toEqual([]);
  });

  it('B-B2: scan — zero artefaktów → [] (nic do zaproponowania)', async () => {
    const { scanForCandidates } = await candidateMod();
    mockQueryAll.mockResolvedValue([]); // insights/assessments/audits puste
    const out = await scanForCandidates(db, 'org-1');
    expect(out).toEqual([]);
  });

  it('B-B3: scan — artefakt bez inicjatywy → wstawia kandydata pending + RETURNING mapuje wiersz', async () => {
    const { scanForCandidates } = await candidateMod();
    // 1. loadDiscoveryArtifacts: insights → [art], assessments → [], audits → []
    mockQueryAll
      .mockResolvedValueOnce([{ id: 'ins-1', title: 'Wąskie gardło w obsłudze', summary: 'Klienci czekają 3 dni na odpowiedź.' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      // 2. existing candidates dedup query → []
      .mockResolvedValueOnce([]);
    mockQueryOne.mockResolvedValue({
      id: 'cand-1', organization_id: 'org-1', source_type: 'interview_insight', source_id: 'ins-1',
      title: 'Inicjatywa: Wąskie gardło w obsłudze', rationale: 'AI sugeruje…', fit_score: 0.8, status: 'pending',
    });
    const out = await scanForCandidates(db, 'org-1', { createdBy: 'user-1' });
    expect(out).toHaveLength(1);
    expect(out[0].sourceType).toBe('interview_insight');
    expect(out[0].status).toBe('pending');
    const insertCall = mockQueryOne.mock.calls.find((c) => /INSERT INTO initiative_candidates/i.test(String(c[0])));
    expect(insertCall).toBeTruthy();
  });

  it('B-B4: scan — artefakt z istniejącym kandydatem (dedup) → pomija (idempotent)', async () => {
    const { scanForCandidates } = await candidateMod();
    mockQueryAll
      .mockResolvedValueOnce([{ id: 'ins-1', title: 'X', summary: 'Y' }]) // insights
      .mockResolvedValueOnce([]) // assessments
      .mockResolvedValueOnce([]) // audits
      .mockResolvedValueOnce([{ source_type: 'interview_insight', source_id: 'ins-1' }]); // existing key
    const out = await scanForCandidates(db, 'org-1');
    expect(out).toEqual([]);
    expect(mockQueryOne).not.toHaveBeenCalled(); // żaden INSERT
  });

  it('B-B5: scan — błąd loadDiscoveryArtifacts (każde źródło rzuca) → fail-soft [] (nie wiesza)', async () => {
    const { scanForCandidates } = await candidateMod();
    mockQueryAll.mockRejectedValue(new Error('no such table: interview_insights'));
    const out = await scanForCandidates(db, 'org-1');
    expect(out).toEqual([]); // wszystkie źródła degradują do []
  });

  it('B-B6: listCandidates — brak orgId → [] (guard)', async () => {
    const { listCandidates } = await candidateMod();
    expect(await listCandidates(db, undefined)).toEqual([]);
  });

  it('B-B7: listCandidates — mapuje wiersze (fit_score→Number, snake→camel)', async () => {
    const { listCandidates } = await candidateMod();
    mockQueryAll.mockResolvedValue([
      { id: 'c1', organization_id: 'org-1', source_type: 'audit', source_id: 'a1', title: 'T', rationale: 'R', fit_score: '0.7', status: 'pending' },
    ]);
    const out = await listCandidates(db, 'org-1');
    expect(out[0]).toMatchObject({ id: 'c1', organizationId: 'org-1', sourceType: 'audit', fitScore: 0.7 });
  });

  it('B-B8: listCandidates — filtr statusu dokleja WHERE status = ?', async () => {
    const { listCandidates } = await candidateMod();
    mockQueryAll.mockResolvedValue([]);
    await listCandidates(db, 'org-1', 'accepted');
    const call = mockQueryAll.mock.calls[0];
    expect(String(call[0])).toMatch(/status = \?/);
    expect(call[1]).toContain('accepted');
  });

  it('B-B9: listCandidates — błąd zapytania → fail-soft []', async () => {
    const { listCandidates } = await candidateMod();
    mockQueryAll.mockRejectedValue(new Error('boom'));
    expect(await listCandidates(db, 'org-1')).toEqual([]);
  });

  it('B-B10: acceptCandidate — istniejący → status=accepted + payload z briefem dla F1', async () => {
    const { acceptCandidate } = await candidateMod();
    mockFunnelCreate.mockResolvedValue({ id: 'init-from-candidate', status: 'DRAFT' });
    mockQueryOne.mockResolvedValue({
      id: 'c1', organization_id: 'org-1', source_type: 'assessment', source_id: 'as-1',
      title: 'Inicjatywa: Skalowanie', rationale: 'AI: szansa wzrostu', fit_score: 0.6, status: 'pending',
    });
    mockQueryRun.mockResolvedValue({ changes: 1 });
    const payload = await acceptCandidate(db, 'c1', 'org-1');
    expect(payload).toMatchObject({ candidateId: 'c1', organizationId: 'org-1', sourceType: 'assessment' });
    expect(payload!.brief).toContain('Inicjatywa: Skalowanie');
    const upd = mockQueryRun.mock.calls.find(
      (c) => /UPDATE initiative_candidates[\s\S]*status = 'accepted'/.test(String(c[0]))
    );
    expect(upd).toBeTruthy();
    expect(String(upd![0])).toContain('initiative_id = ?');
  });

  it('B-B11: acceptCandidate — brak id → null', async () => {
    const { acceptCandidate } = await candidateMod();
    expect(await acceptCandidate(db, undefined, 'org-1')).toBeNull();
  });

  it('B-B12: acceptCandidate — kandydat nieznaleziony → null (route → 404)', async () => {
    const { acceptCandidate } = await candidateMod();
    mockQueryOne.mockResolvedValue(null);
    expect(await acceptCandidate(db, 'missing', 'org-1')).toBeNull();
  });

  it('B-B13: dismissCandidate — zmieniony wiersz → true', async () => {
    const { dismissCandidate } = await candidateMod();
    mockQueryRun.mockResolvedValue({ changes: 1 });
    expect(await dismissCandidate(db, 'c1', 'org-1')).toBe(true);
    const upd = mockQueryRun.mock.calls.find((c) => /SET status = 'dismissed'/.test(String(c[0])));
    expect(upd).toBeTruthy();
  });

  it('B-B14: dismissCandidate — brak trafienia (changes=0) → false (route → 404)', async () => {
    const { dismissCandidate } = await candidateMod();
    mockQueryRun.mockResolvedValue({ changes: 0 });
    expect(await dismissCandidate(db, 'missing', 'org-1')).toBe(false);
  });

  it('B-B15: dismissCandidate — błąd zapytania → fail-soft false', async () => {
    const { dismissCandidate } = await candidateMod();
    mockQueryRun.mockRejectedValue(new Error('boom'));
    expect(await dismissCandidate(db, 'c1', 'org-1')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C. initiativeMaterializeService (tabela → bufor; fail-soft → null)
// ═══════════════════════════════════════════════════════════════════════════
describe('L2 — initiativeMaterializeService', () => {
  const oneInitiativeRow = {
    id: 'i1', title: 'Automatyzacja onboardingu', status: 'EXECUTING', priority: 'high',
    expected_roi: 120, problem_statement: 'Proces trwa 5 dni', hypothesis: 'Skrócimy o 40%', summary: 'X',
  };

  it('B-C1: materializeInitiative(table) — istniejąca inicjatywa → niepusty bufor + filename .xlsx + mime', async () => {
    const { materializeInitiative } = await materializeMod();
    mockQueryOne.mockResolvedValueOnce(oneInitiativeRow); // loadInitiative
    mockQueryAll.mockResolvedValue([]); // milestones
    mockQueryOne.mockResolvedValueOnce(null); // primary kpi
    const r = await materializeInitiative(db, 'i1', 'table', { orgId: 'org-1', company: 'ACME' });
    expect(r).not.toBeNull();
    expect(r!.buffer.length).toBeGreaterThan(0);
    expect(r!.filename).toMatch(/\.xlsx$/);
    expect(r!.mimeType).toContain('spreadsheetml');
    expect(mockBuildWorkbookBuffer).toHaveBeenCalled();
  });

  it('B-C2: materializeInitiative — inicjatywa nie istnieje → null (route → 422)', async () => {
    const { materializeInitiative } = await materializeMod();
    mockQueryOne.mockResolvedValue(null);
    const r = await materializeInitiative(db, 'nope', 'table', { orgId: 'org-1' });
    expect(r).toBeNull();
  });

  it('B-C3: materializeInitiative(report) — deleguje do DOCX renderer → bufor .docx', async () => {
    const { materializeInitiative } = await materializeMod();
    mockQueryOne.mockResolvedValueOnce(oneInitiativeRow);
    mockQueryAll.mockResolvedValue([]);
    mockQueryOne.mockResolvedValueOnce(null);
    const r = await materializeInitiative(db, 'i1', 'report', { orgId: 'org-1', company: 'ACME' });
    expect(r!.filename).toMatch(/\.docx$/);
    expect(mockRenderDocx).toHaveBeenCalled();
  });

  it('B-C4: materializeInitiative — generator zwraca pusty bufor → null (fail-soft, no fake file)', async () => {
    const { materializeInitiative } = await materializeMod();
    mockQueryOne.mockResolvedValueOnce(oneInitiativeRow);
    mockQueryAll.mockResolvedValue([]);
    mockQueryOne.mockResolvedValueOnce(null);
    mockBuildWorkbookBuffer.mockResolvedValue(Buffer.alloc(0)); // pusty bufor
    const r = await materializeInitiative(db, 'i1', 'table', { orgId: 'org-1' });
    expect(r).toBeNull();
  });

  it('B-C5: materializeInitiative — generator rzuca → fail-soft null (router nie wisi)', async () => {
    const { materializeInitiative } = await materializeMod();
    mockQueryOne.mockResolvedValueOnce(oneInitiativeRow);
    mockQueryAll.mockResolvedValue([]);
    mockQueryOne.mockResolvedValueOnce(null);
    mockBuildWorkbookBuffer.mockRejectedValue(new Error('exceljs blew up'));
    const r = await materializeInitiative(db, 'i1', 'table', { orgId: 'org-1' });
    expect(r).toBeNull();
  });

  it('B-C6: materializePortfolio(table) — niepusty portfel → bufor', async () => {
    const { materializePortfolio } = await materializeMod();
    mockQueryAll.mockResolvedValueOnce([oneInitiativeRow, { ...oneInitiativeRow, id: 'i2', title: 'Druga' }]); // loadPortfolio
    mockQueryAll.mockResolvedValue([]); // milestones per row
    mockQueryOne.mockResolvedValue(null); // kpi per row
    const r = await materializePortfolio(db, 'org-1', 'table', { company: 'ACME' });
    expect(r).not.toBeNull();
    expect(r!.buffer.length).toBeGreaterThan(0);
    expect(r!.filename).toMatch(/\.xlsx$/);
  });

  it('B-C7: materializePortfolio — pusty portfel → null (route → 422)', async () => {
    const { materializePortfolio } = await materializeMod();
    mockQueryAll.mockResolvedValue([]);
    const r = await materializePortfolio(db, 'org-1', 'table');
    expect(r).toBeNull();
  });

  it('B-C8: buildInitiativesTableSchema — kolumny name/status/owner/KPI/progress/ROI; brak danych → „—"/0', async () => {
    const { buildInitiativesTableSchema } = await materializeMod();
    const schema = buildInitiativesTableSchema([
      { id: 'i1', name: '—', status: null, ownerName: null, expectedRoi: null, progressPct: null, primaryKpi: null } as any,
    ]);
    const keys = schema.fields.map((f: any) => f.key);
    expect(keys).toEqual(['name', 'status', 'owner', 'kpi', 'progress', 'roi']);
    expect(schema.seedRows[0]).toMatchObject({ status: '—', owner: '—', kpi: '—', roi: '—', progress: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D. auditInitiativeService.createInitiativeFromAudit (lineage + 404/422)
// ═══════════════════════════════════════════════════════════════════════════
describe('L2 — createInitiativeFromAudit (source_type=audit, DRAFT, 404/422)', () => {
  const auditRow = {
    id: 'aud-1', organization_id: 'org-1', project_id: null,
    name: 'Audyt bezpieczeństwa', findings: JSON.stringify([{ title: 'Brak MFA', severity: 'high', recommendation: 'Wdrożyć MFA' }]),
  };

  it('B-D1: pre-loaded audit + finding → funnel z sourceType=audit, sourceId=auditId, status DRAFT (zwracany)', async () => {
    const { createInitiativeFromAudit } = await auditMod();
    mockFunnelCreate.mockResolvedValue({ id: 'init-1', title: 'Brak MFA', status: 'DRAFT', sourceType: 'audit', sourceId: 'aud-1' });
    const out = await createInitiativeFromAudit({
      auditId: 'aud-1', organizationId: 'org-1', userId: 'user-1', audit: auditRow as any,
    } as any);
    expect(out).toMatchObject({ status: 'DRAFT', sourceType: 'audit', sourceId: 'aud-1' });
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input).toMatchObject({ sourceType: 'audit', sourceId: 'aud-1' });
    expect(input.status).toBeUndefined(); // status pominięty → funnel normalizuje do DRAFT
  });

  it('B-D2: brak audytu w DB → błąd 404 (route mapuje na 404)', async () => {
    const { createInitiativeFromAudit } = await auditMod();
    mockQueryOne.mockResolvedValue(null); // queryOne audits → brak
    await expect(
      createInitiativeFromAudit({ auditId: 'missing', organizationId: 'org-1', userId: 'u1' } as any)
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockFunnelCreate).not.toHaveBeenCalled();
  });

  it('B-D3: audyt bez findingów → błąd 422 (nic do konwersji)', async () => {
    const { createInitiativeFromAudit } = await auditMod();
    await expect(
      createInitiativeFromAudit({
        auditId: 'aud-2', organizationId: 'org-1', userId: 'u1',
        audit: { id: 'aud-2', organization_id: 'org-1', findings: '[]' } as any,
      } as any)
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(mockFunnelCreate).not.toHaveBeenCalled();
  });

  it('B-D4: brak auditId → rzuca (walidacja wejścia)', async () => {
    const { createInitiativeFromAudit } = await auditMod();
    await expect(
      createInitiativeFromAudit({ auditId: '', organizationId: 'org-1', userId: 'u1' } as any)
    ).rejects.toThrow(/auditId/);
  });

  it('B-D5: ładuje audyt z DB gdy nie pre-loaded (queryOne na audits z org-scope)', async () => {
    const { createInitiativeFromAudit } = await auditMod();
    mockQueryOne.mockResolvedValueOnce(auditRow); // queryOne audits
    mockFunnelCreate.mockResolvedValue({ id: 'init-2', title: 'Brak MFA', status: 'DRAFT', sourceType: 'audit', sourceId: 'aud-1' });
    await createInitiativeFromAudit({ auditId: 'aud-1', organizationId: 'org-1', userId: 'u1' } as any);
    const q = mockQueryOne.mock.calls.find((c) => /FROM audits/i.test(String(c[0])));
    expect(q).toBeTruthy();
    expect(q![1]).toEqual(['aud-1', 'org-1']); // id + org-scope
  });

  it('B-D6: explicit finding wins → tytuł z findingu, source_type=audit zachowany', async () => {
    const { createInitiativeFromAudit } = await auditMod();
    mockFunnelCreate.mockResolvedValue({ id: 'init-3', title: 'Niezgodność RODO', status: 'DRAFT', sourceType: 'audit', sourceId: 'aud-1' });
    await createInitiativeFromAudit({
      auditId: 'aud-1', organizationId: 'org-1', userId: 'u1', audit: auditRow as any,
      finding: { title: 'Niezgodność RODO', severity: 'critical' } as any,
    } as any);
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.title).toBe('Niezgodność RODO');
    expect(input.sourceType).toBe('audit');
  });
});
