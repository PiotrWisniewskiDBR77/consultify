/**
 * Uspójnienie F3.2 / F3.9 — advisory quality pass wpięty w kanoniczny lejek.
 *
 * Strukturalne validatory §B3 (CARD_STRUCT_VALIDATORS via validateCardStructure)
 * uruchamiają się na CREATE w trybie ADVISORY: logują wynik i — gdy
 * `enforceQuality:true` — dołączają `qualityWarnings` do rezultatu. NIGDY nie
 * blokują/nie rzucają. F3.9 dokłada anty-crashowy check material_quality.
 *
 * Kontrakt testowany tu:
 *   (a) niekompletny input + enforceQuality:true ⇒ qualityWarnings niepuste,
 *   (b) kompletny input ⇒ brak warnings,
 *   (c) jakość NIGDY nie blokuje tworzenia (inicjatywa powstaje zawsze).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRun, auditLog, loggerInfo, loggerWarn } = vi.hoisted(() => ({
  queryRun: vi.fn(),
  auditLog: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...a: unknown[]) => queryRun(...a),
}));
vi.mock('../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: (...a: unknown[]) => auditLog(...a) },
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: (...a: unknown[]) => loggerWarn(...a), info: (...a: unknown[]) => loggerInfo(...a), error: vi.fn() },
}));

import { createInitiative } from '../../../server/src/services/initiative/createInitiativeService';

const ORG = 'org-1';

// A structurally COMPLETE card that should pass all 10 §B3 validators. Uses
// validate:false so non-schema fields (kpis, milestones, kill_criteria, raid)
// survive to the advisory pass instead of being stripped by the Zod schema.
const completeInput = () => ({
  title: 'Inicjatywa kompletna',
  kpis: [{ baseline: 10, target: 20, unit: '%' }],
  keyRisks: [
    { type: 'RISK', text: 'r1' },
    { type: 'RISK', text: 'r2' },
    { type: 'ASSUMPTION', text: 'a1' },
    { type: 'DEPENDENCY', text: 'd1' },
  ],
  scopeIn: ['s1', 's2', 's3'],
  scopeOut: ['o1', 'o2', 'o3'],
  deliverables: ['d1', 'd2', 'd3', 'd4'],
  successCriteria: ['c1', 'c2', 'c3', 'c4'],
  killCriteria: ['k1', 'k2'],
  milestones: ['m1', 'm2', 'm3'],
  expectedRoi: 1.5,
  ownerBusinessId: 'owner-1',
});

beforeEach(() => {
  vi.clearAllMocks();
  queryRun.mockResolvedValue(undefined);
  auditLog.mockResolvedValue(undefined);
});

describe('createInitiativeService — F3.2/F3.9 advisory quality', () => {
  it('(a) incomplete input + enforceQuality:true ⇒ qualityWarnings non-empty', async () => {
    // Minimal card — fails most structural validators (no KPI, no RAID, empty counts...).
    const res = await createInitiative(ORG, { title: 'Cienka karta' }, { enforceQuality: true });
    expect(res.id).toBeTruthy();
    expect(res.qualityWarnings).toBeDefined();
    expect(Array.isArray(res.qualityWarnings)).toBe(true);
    expect(res.qualityWarnings!.length).toBeGreaterThan(0);
    // warnings are prefixed by the failing rule id
    expect(res.qualityWarnings!.some((w) => w.startsWith('kpi_baseline_target:'))).toBe(true);
  });

  it('(b) complete input ⇒ no qualityWarnings even with enforceQuality:true', async () => {
    const res = await createInitiative(ORG, completeInput(), {
      validate: false,
      enforceQuality: true,
    });
    expect(res.id).toBeTruthy();
    expect(res.qualityWarnings).toBeUndefined();
  });

  it('C3: attaches qualityWarnings as advisory even when enforceQuality is false', async () => {
    // USPOJNIENIE C3 — ostrzeżenia §B3 są ZAWSZE widoczne (advisory), nie tylko
    // przy enforceQuality. Tworzenie nadal NIE jest blokowane (patrz test (c)).
    const res = await createInitiative(ORG, { title: 'Cienka karta' });
    expect(res.id).toBeTruthy();
    expect(res.qualityWarnings).toBeDefined();
    expect(Array.isArray(res.qualityWarnings)).toBe(true);
    expect(res.qualityWarnings!.length).toBeGreaterThan(0);
    // ...and the advisory result is still logged.
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining('§B3 quality (advisory)'));
  });

  it('(c) quality NEVER blocks creation — thin card still inserts + returns', async () => {
    const res = await createInitiative(ORG, { title: 'Pusta' }, { enforceQuality: true });
    expect(res.id).toBeTruthy();
    expect(res.status).toBe('DRAFT');
    // INSERT still happened despite all the quality failures.
    const inserted = queryRun.mock.calls.some((c) =>
      String(c[0]).includes('INSERT INTO initiatives')
    );
    expect(inserted).toBe(true);
  });

  it('logs all-passed on a structurally complete card', async () => {
    await createInitiative(ORG, completeInput(), { validate: false });
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining('all passed'));
  });

  it('F3.9: partial material_quality (missing fields) ⇒ anti-crash warning', async () => {
    const res = await createInitiative(
      ORG,
      { ...completeInput(), materialQuality: { score: 0.7 } }, // missing posture + coverage
      { validate: false, enforceQuality: true }
    );
    expect(res.qualityWarnings).toBeDefined();
    expect(res.qualityWarnings!.some((w) => w.includes('material_quality'))).toBe(true);
  });

  it('F3.9 tolerant: absent material_quality ⇒ no material_quality warning', async () => {
    const res = await createInitiative(ORG, completeInput(), {
      validate: false,
      enforceQuality: true,
    });
    // complete card has no warnings at all, and certainly no material_quality one
    expect(res.qualityWarnings).toBeUndefined();
  });

  it('F3.9 tolerant: complete material_quality object ⇒ no material_quality warning', async () => {
    const res = await createInitiative(
      ORG,
      {
        ...completeInput(),
        materialQuality: { score: 0.7, posture: 'strong', coverage: 0.9 },
      },
      { validate: false, enforceQuality: true }
    );
    expect(res.qualityWarnings).toBeUndefined();
  });

  it('F3.9: snake_case material_quality alias is honored', async () => {
    const res = await createInitiative(
      ORG,
      { ...completeInput(), material_quality: { score: 0.5 } },
      { validate: false, enforceQuality: true }
    );
    expect(res.qualityWarnings!.some((w) => w.includes('material_quality'))).toBe(true);
  });
});
