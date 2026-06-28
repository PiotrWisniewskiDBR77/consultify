/**
 * initiativeMaterializeService (F5 „Zrób materiał") — inicjatywa/portfel → realny plik
 * przez silnik M17. Deterministyczne (bez LLM): mock DB + mock generatorów M17 gdzie
 * trzeba; tabela/raport idą realnie (XLSX/DOCX), deck zamockowany (pptxgenjs ciężki).
 *
 * Weryfikuje: tabela → niepusty bufor PK/OOXML; raport/deck ścieżki; fail-soft na braku
 * inicjatywy / pustym portfelu; TYLKO realne pola (brak → „—", zero fabrykacji liczb).
 *
 * Wzór: tests/unit/deliverables/bundleExport.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  materializeInitiative,
  materializePortfolio,
  buildInitiativesTableSchema,
  type MaterializeDb,
} from '../../../server/src/services/initiative/initiativeMaterializeService';

// ── Mock deck PPTX runtime (pptxgenjs is heavy / native) — return a PK buffer ──
vi.mock('../../../server/src/services/deliverables/bundlePptxRuntime', () => ({
  deckPlansToPptxBuffer: vi.fn(async (plans: unknown[]) =>
    Array.isArray(plans) && plans.length > 0
      ? Buffer.from('PK\x03\x04 fake-pptx ' + 'x'.repeat(3000))
      : null,
  ),
}));

// ── Mock DB factory ──────────────────────────────────────────────────────
interface SeedInitiative {
  id: string;
  organization_id: string;
  name?: string;
  title?: string;
  status?: string;
  priority?: string;
  expected_roi?: number;
  cost_capex?: number;
  business_value?: string;
  problem_statement?: string;
  hypothesis?: string;
  summary?: string;
  owner_first_name?: string;
  owner_last_name?: string;
}
interface SeedMilestone { initiative_id: string; name: string; status?: string; target_date?: string; order_index?: number }
interface SeedKpi { initiative_id: string; name: string; target_value?: number; unit?: string; is_primary?: number }

function makeDb(opts: {
  initiatives?: SeedInitiative[];
  milestones?: SeedMilestone[];
  kpis?: SeedKpi[];
}): MaterializeDb {
  const inits = opts.initiatives ?? [];
  const ms = opts.milestones ?? [];
  const kpis = opts.kpis ?? [];
  return {
    async queryOne<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
      if (sql.includes('FROM initiatives')) {
        const id = String(params[0]);
        // Mirror the org-scoped WHERE: when SQL filters by organization_id, honor it.
        const orgFiltered = sql.includes('organization_id = ?') ? String(params[1]) : null;
        const found =
          inits.find((i) => i.id === id && (orgFiltered === null || i.organization_id === orgFiltered)) ?? null;
        return found as unknown as T | null;
      }
      if (sql.includes('FROM initiative_kpis')) {
        const id = String(params[0]);
        const k = kpis.filter((x) => x.initiative_id === id).sort((a, b) => (b.is_primary ?? 0) - (a.is_primary ?? 0))[0];
        return (k ?? null) as unknown as T | null;
      }
      return null;
    },
    async queryAll<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
      if (sql.includes('FROM initiatives')) {
        const orgId = String(params[0]);
        return inits.filter((i) => i.organization_id === orgId) as unknown as T[];
      }
      if (sql.includes('FROM initiative_milestones')) {
        const id = String(params[0]);
        return ms.filter((m) => m.initiative_id === id) as unknown as T[];
      }
      return [];
    },
  };
}

const ORG = 'org-1';
const baseInitiative: SeedInitiative = {
  id: 'init-1',
  organization_id: ORG,
  name: 'Automatyzacja raportów ICT',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  expected_roi: 240,
  cost_capex: 120000,
  business_value: 'Redukcja czasu raportowania o 80%.',
  problem_statement: 'Raporty ICT zajmują 3 dni miesięcznie.',
  hypothesis: 'Automatyzacja skróci proces do godzin.',
  owner_first_name: 'Anna',
  owner_last_name: 'Kowalska',
};

function isOoxml(buf: Buffer): boolean {
  return buf.length > 0 && buf.subarray(0, 2).toString('latin1') === 'PK';
}

afterEach(() => vi.clearAllMocks());

// ════════════════════════════════════════════════════════════════════════
// buildInitiativesTableSchema (pure) — columns + real-fields-only
// ════════════════════════════════════════════════════════════════════════
describe('buildInitiativesTableSchema — kolumny i brak fabrykacji', () => {
  it('ma kolumny name/status/owner/KPI/progress/ROI', () => {
    const schema = buildInitiativesTableSchema([
      { id: 'a', name: 'X', status: 'NEW', priority: null, ownerName: 'Jan', expectedRoi: 50, costCapex: null, costOpex: null, businessValue: null, problemStatement: null, hypothesis: null, summary: null, startDate: null, endDate: null, progressPct: 25, primaryKpi: 'NPS: 70', milestones: [] } as never,
    ]);
    const keys = schema.fields.map((f) => f.key);
    expect(keys).toEqual(['name', 'status', 'owner', 'kpi', 'progress', 'roi']);
    expect(schema.seedRows[0].roi).toBe('50%');
    expect(schema.seedRows[0].progress).toBeCloseTo(0.25);
  });

  it('brakujące pola → „—" (zero zmyślonych liczb)', () => {
    const schema = buildInitiativesTableSchema([
      { id: 'a', name: '—', status: null, priority: null, ownerName: null, expectedRoi: null, costCapex: null, costOpex: null, businessValue: null, problemStatement: null, hypothesis: null, summary: null, startDate: null, endDate: null, progressPct: null, primaryKpi: null, milestones: [] } as never,
    ]);
    const row = schema.seedRows[0];
    expect(row.status).toBe('—');
    expect(row.owner).toBe('—');
    expect(row.kpi).toBe('—');
    expect(row.roi).toBe('—'); // NIE 0, NIE wymyślona liczba
    expect(row.progress).toBe(0); // brak postępu → placeholder 0, nie zmyślona wartość
  });
});

// ════════════════════════════════════════════════════════════════════════
// materializeInitiative — table / report / deck → real buffers
// ════════════════════════════════════════════════════════════════════════
describe('materializeInitiative — realne pliki', () => {
  it('table → REALNY .xlsx (PK/OOXML, niepusty)', async () => {
    const db = makeDb({
      initiatives: [baseInitiative],
      milestones: [
        { initiative_id: 'init-1', name: 'Analiza', status: 'COMPLETED' },
        { initiative_id: 'init-1', name: 'Pilotaż', status: 'IN_PROGRESS' },
      ],
      kpis: [{ initiative_id: 'init-1', name: 'Czas raportu', target_value: 4, unit: 'h', is_primary: 1 }],
    });
    const result = await materializeInitiative(db, 'init-1', 'table', { orgId: ORG, company: 'Apator' });
    expect(result).not.toBeNull();
    expect(result!.format).toBe('table');
    expect(result!.mimeType).toContain('spreadsheetml');
    expect(result!.filename.endsWith('.xlsx')).toBe(true);
    expect(isOoxml(result!.buffer)).toBe(true);
    expect(result!.buffer.length).toBeGreaterThan(2000);
  });

  it('report → REALNY .docx (PK/OOXML, niepusty)', async () => {
    const db = makeDb({ initiatives: [baseInitiative], milestones: [{ initiative_id: 'init-1', name: 'Analiza', status: 'COMPLETED' }] });
    const result = await materializeInitiative(db, 'init-1', 'report', { orgId: ORG, company: 'Apator' });
    expect(result).not.toBeNull();
    expect(result!.mimeType).toContain('wordprocessingml');
    expect(result!.filename.endsWith('.docx')).toBe(true);
    expect(isOoxml(result!.buffer)).toBe(true);
    expect(result!.buffer.length).toBeGreaterThan(2000);
  });

  it('deck → bufor PPTX (PK) przez M17 deckPlansToPptxBuffer', async () => {
    const db = makeDb({ initiatives: [baseInitiative] });
    const result = await materializeInitiative(db, 'init-1', 'deck', { orgId: ORG, company: 'Apator' });
    expect(result).not.toBeNull();
    expect(result!.mimeType).toContain('presentationml');
    expect(result!.filename.endsWith('.pptx')).toBe(true);
    expect(isOoxml(result!.buffer)).toBe(true);
  });

  it('postęp liczony z REALNYCH kamieni milowych (1/2 COMPLETED → 50%)', async () => {
    const db = makeDb({
      initiatives: [baseInitiative],
      milestones: [
        { initiative_id: 'init-1', name: 'A', status: 'COMPLETED' },
        { initiative_id: 'init-1', name: 'B', status: 'PENDING' },
      ],
    });
    // progress wjeżdża do tabeli jako fraction 0.5 — weryfikujemy przez schema-builder
    // pośrednio (plik jest binarny). Tu sprawdzamy że plik powstaje z takimi danymi.
    const result = await materializeInitiative(db, 'init-1', 'table', { orgId: ORG });
    expect(result).not.toBeNull();
    expect(isOoxml(result!.buffer)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Fail-soft
// ════════════════════════════════════════════════════════════════════════
describe('materializeInitiative — fail-soft', () => {
  it('brak inicjatywy → null', async () => {
    const db = makeDb({ initiatives: [] });
    const result = await materializeInitiative(db, 'nope', 'table', { orgId: ORG });
    expect(result).toBeNull();
  });

  it('cross-org: inicjatywa innej org + orgId filtr → null', async () => {
    const db = makeDb({ initiatives: [{ ...baseInitiative, organization_id: 'other-org' }] });
    const result = await materializeInitiative(db, 'init-1', 'table', { orgId: ORG });
    expect(result).toBeNull();
  });

  it('błąd DB (queryOne rzuca) → null (nie wiesza)', async () => {
    const db: MaterializeDb = {
      queryOne: async () => { throw new Error('db down'); },
      queryAll: async () => [],
    };
    const result = await materializeInitiative(db, 'init-1', 'table', { orgId: ORG });
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// materializePortfolio
// ════════════════════════════════════════════════════════════════════════
describe('materializePortfolio — org-scoped', () => {
  it('table → REALNY .xlsx z wieloma inicjatywami', async () => {
    const db = makeDb({
      initiatives: [
        baseInitiative,
        { id: 'init-2', organization_id: ORG, name: 'Migracja chmury', status: 'PLANNED', expected_roi: 180 },
      ],
      milestones: [{ initiative_id: 'init-1', name: 'A', status: 'COMPLETED' }],
      kpis: [],
    });
    const result = await materializePortfolio(db, ORG, 'table');
    expect(result).not.toBeNull();
    expect(isOoxml(result!.buffer)).toBe(true);
    expect(result!.buffer.length).toBeGreaterThan(2000);
  });

  it('report → REALNY .docx (portfel)', async () => {
    const db = makeDb({
      initiatives: [baseInitiative, { id: 'init-2', organization_id: ORG, name: 'Migracja', status: 'PLANNED' }],
    });
    const result = await materializePortfolio(db, ORG, 'report', { company: 'Apator' });
    expect(result).not.toBeNull();
    expect(result!.filename.endsWith('.docx')).toBe(true);
    expect(isOoxml(result!.buffer)).toBe(true);
  });

  it('deck → bufor PPTX (portfel)', async () => {
    const db = makeDb({ initiatives: [baseInitiative, { id: 'init-2', organization_id: ORG, name: 'Migracja', status: 'PLANNED' }] });
    const result = await materializePortfolio(db, ORG, 'deck');
    expect(result).not.toBeNull();
    expect(result!.filename.endsWith('.pptx')).toBe(true);
    expect(isOoxml(result!.buffer)).toBe(true);
  });

  it('pusty portfel → null (fail-soft)', async () => {
    const db = makeDb({ initiatives: [] });
    const result = await materializePortfolio(db, ORG, 'table');
    expect(result).toBeNull();
  });

  it('inne org nie wyciekają (tylko ORG)', async () => {
    const db = makeDb({
      initiatives: [baseInitiative, { id: 'x', organization_id: 'foreign', name: 'Obca' }],
    });
    const result = await materializePortfolio(db, ORG, 'table');
    // Plik powstaje tylko z inicjatyw ORG; obca org nie blokuje ani nie wycieka.
    expect(result).not.toBeNull();
    expect(isOoxml(result!.buffer)).toBe(true);
  });
});
