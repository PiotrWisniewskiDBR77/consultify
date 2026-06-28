// @vitest-environment node
/**
 * F0 / L2 — Grunt generacji inicjatywy: ścieżka POPULOWANIA (enrichContext) + emisja
 * groundingu (buildGroundingBlock). Integracja: realny `InitiativeGenerationService`
 * + realny `DbPromise` mock + realny `buildOrgFinancialsSummary` (przez ten sam mock).
 *
 * Część kręgosłupa inicjatyw (INITIATIVE_SYSTEM_SSOT §F0, INITIATIVE_BACKBONE_HANDOFF).
 *
 * STRATEGIA MOCKÓW (wzór: tests/unit/backend/controllers/InitiativeController.test.ts —
 * mock warstwy DB przez queryHelpers/DbPromise):
 *  - `DbPromise.get`/`DbPromise.all` mockowane jedną funkcją dyspozytorską po SQL.
 *    `financialsGrounding` używa TEGO SAMEGO modułu `DbPromise.all`, więc mock jednego
 *    miejsca pokrywa wszystkie 4 źródła (initiative/org/financials/portfolio + KPI).
 *  - `llmService.call` zwraca DOKŁADNIE prompt użytkownika jako `content`, więc test
 *    może asercjować, że grounding (4 źródła + instrukcje) realnie trafił do promptu.
 *  - `enrichContext` jest PRYWATNE → testujemy je przez publiczne `generateSectionContent`.
 *  - `buildGroundingBlock` jest EKSPORTOWANE → testujemy też wprost (kolejność/kontrakt).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock DB layer (queryHelpers/DbPromise) — SQL-dispatching get/all ──────────
// One programmable router per test so we can assert the populate path AND fail-soft.
type Rows = Record<string, unknown>[];
interface DbScript {
  initiative?: Record<string, unknown> | null;
  org?: Record<string, unknown> | null;
  kpis?: Rows;
  portfolio?: Rows;
  financials?: Rows;
  /** Force a specific source query to throw (fail-soft proof). */
  throwOn?: 'initiative' | 'org' | 'kpis' | 'portfolio' | 'financials';
}

let script: DbScript = {};

function dbGet(_db: unknown, sql: string): Promise<unknown> {
  const s = String(sql);
  if (/FROM initiatives WHERE id/i.test(s)) {
    if (script.throwOn === 'initiative') return Promise.reject(new Error('boom-initiative'));
    return Promise.resolve(script.initiative ?? null);
  }
  if (/FROM organizations WHERE id/i.test(s)) {
    if (script.throwOn === 'org') return Promise.reject(new Error('boom-org'));
    return Promise.resolve(script.org ?? null);
  }
  return Promise.resolve(null);
}

function dbAll(_db: unknown, sql: string): Promise<unknown[]> {
  const s = String(sql);
  if (/FROM initiative_kpis/i.test(s)) {
    if (script.throwOn === 'kpis') return Promise.reject(new Error('boom-kpis'));
    return Promise.resolve(script.kpis ?? []);
  }
  // Portfolio query selects name,status FROM initiatives ... organization_id ... id !=
  if (/FROM initiatives\s+WHERE organization_id/i.test(s) || /id != \?/i.test(s)) {
    if (script.throwOn === 'portfolio') return Promise.reject(new Error('boom-portfolio'));
    return Promise.resolve(script.portfolio ?? []);
  }
  // financialsGrounding query — JOINs financial_statement_values
  if (/financial_statement_values/i.test(s)) {
    if (script.throwOn === 'financials') return Promise.reject(new Error('boom-financials'));
    return Promise.resolve(script.financials ?? []);
  }
  return Promise.resolve([]);
}

vi.mock('../../../server/src/utils/DbPromise.js', () => {
  const api = {
    get: (...a: any[]) => dbGet(a[0], a[1]),
    all: (...a: any[]) => dbAll(a[0], a[1]),
    run: vi.fn(async () => ({ success: true, changes: 0 })),
  };
  return { default: api, ...api };
});

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  default: {},
  getDatabase: () => ({}),
}));

// Section type service supplies a prompt template that echoes the interpolated
// context so we can read it back through the LLM mock.
vi.mock('../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: {
    getSectionTypeByKey: vi.fn(async () => ({
      key: 'business-case',
      aiPromptTemplate: 'Sekcja business-case dla {{initiativeName}}.',
    })),
    getAllSectionTypes: vi.fn(async () => []),
  },
}));

// LLM mock: echo the user prompt back as content. The generated `content` therefore
// CONTAINS the full prompt incl. the grounding block → assert grounding emission.
const llmCall = vi.fn(async (args: any) => ({
  content: String(args?.messages?.[0]?.content || ''),
  usage: { totalTokens: 7 },
  model: 'mock-llm',
}));
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...a: any[]) => llmCall(...a) },
  default: { call: (...a: any[]) => llmCall(...a) },
}));

import initiativeGenerationService, {
  buildGroundingBlock,
  __resetLlmInstanceForTests,
  type GenerationContext,
} from '../../../server/src/services/initiativeGenerationService.ts';

const ORG = 'org-fin-1';
const INIT = 'init-1';

/** Generate the business-case section and return the prompt that reached the LLM. */
async function generatePrompt(ctx?: Partial<GenerationContext>): Promise<string> {
  const res = await initiativeGenerationService.generateSectionContent(
    'business-case',
    {
      initiativeId: INIT,
      initiativeName: 'Automatyzacja kontroli jakości',
      language: 'pl',
      ...ctx,
    } as GenerationContext,
    ORG
  );
  return String(res.content);
}

const FULL_INITIATIVE = {
  id: INIT,
  name: 'Automatyzacja kontroli jakości',
  organization_id: ORG,
  summary: 'Redukcja braków przez automatyczną inspekcję',
  description: 'desc',
  problem_statement: 'Wysoki odsetek braków na linii',
  category: 'OPERATIONS',
  module: 'QUALITY',
  status: 'DRAFT',
  source_type: 'audit',
  source_id: 'a-77',
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetLlmInstanceForTests();
  script = {};
});

afterEach(() => {
  __resetLlmInstanceForTests();
});

// ═══════════════════════════════════════════════════════════════════════════
// A. enrichContext POPULATE path (through public generateSectionContent)
// ═══════════════════════════════════════════════════════════════════════════
describe('F0/L2 — enrichContext populuje grunt z 4 źródeł', () => {
  it('populuje portfolioSummary z inicjatyw-rodzeństwa org', async () => {
    script = {
      initiative: FULL_INITIATIVE,
      portfolio: [
        { name: 'Migracja CRM', status: 'PLANNING' },
        { name: 'Optymalizacja magazynu', status: 'EXECUTING' },
      ],
    };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Istniejące inicjatywy w organizacji');
    expect(prompt).toContain('Migracja CRM [PLANNING]');
    expect(prompt).toContain('Optymalizacja magazynu [EXECUTING]');
  });

  it('populuje orgContext z organizations (nazwa + branża)', async () => {
    script = {
      initiative: FULL_INITIATIVE,
      org: { name: 'Apator S.A.', industry: 'Produkcja aparatury pomiarowej' },
    };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Kontekst organizacji');
    expect(prompt).toContain('Apator S.A.');
    expect(prompt).toContain('branża: Produkcja aparatury pomiarowej');
  });

  it('populuje orgContext samą nazwą gdy brak industry', async () => {
    script = { initiative: FULL_INITIATIVE, org: { name: 'Elkomtech', industry: null } };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Elkomtech');
    expect(prompt).not.toContain('branża:');
  });

  it('populuje financialsSummary z helpera financials (realne P&L)', async () => {
    script = {
      initiative: FULL_INITIATIVE,
      financials: [
        { line_code: 'REVENUE', value: 8.8, scaling: 'millions', currency: 'EUR', period_label: '2025', period_end: '2025-12-31' },
        { line_code: 'EBITDA', value: 2.7, scaling: 'millions', currency: 'EUR', period_label: '2025', period_end: '2025-12-31' },
      ],
    };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Dane finansowe org');
    expect(prompt).toContain('Przychód 2025: 8.8M EUR');
    expect(prompt).toContain('EBITDA 2.7M');
  });

  it('populuje lineage (source_type#source_id) z inicjatywy', async () => {
    script = { initiative: FULL_INITIATIVE };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Pochodzenie (lineage): audit #a-77');
  });

  it('populuje existingKpis z initiative_kpis (baseline→cel)', async () => {
    script = {
      initiative: FULL_INITIATIVE,
      kpis: [{ name: 'OEE', unit: '%', baseline: 62, target: 75 }],
    };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Istniejące KPI');
    expect(prompt).toContain('OEE');
    expect(prompt).toContain('62');
    expect(prompt).toContain('75');
  });

  it('wszystkie 4 źródła naraz trafiają do jednego promptu', async () => {
    script = {
      initiative: FULL_INITIATIVE,
      org: { name: 'Apator S.A.', industry: 'Produkcja' },
      portfolio: [{ name: 'Migracja CRM', status: 'PLANNING' }],
      financials: [
        { line_code: 'REVENUE', value: 8.8, scaling: 'millions', currency: 'EUR', period_label: '2025', period_end: '2025-12-31' },
      ],
    };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Kontekst organizacji'); // org
    expect(prompt).toContain('Dane finansowe org'); // financials
    expect(prompt).toContain('Istniejące inicjatywy w organizacji'); // portfolio
    expect(prompt).toContain('Pochodzenie (lineage)'); // lineage
  });

  it('nie nadpisuje jawnie podanego orgContext z kontekstu wejściowego', async () => {
    script = { initiative: FULL_INITIATIVE, org: { name: 'DB-Name', industry: 'X' } };
    const prompt = await generatePrompt({ orgContext: 'Wartość-z-kontekstu' });
    expect(prompt).toContain('Wartość-z-kontekstu');
    expect(prompt).not.toContain('DB-Name');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. FAIL-SOFT — pojedyncze źródło rzuca → grounding nadal buduje z reszty
// ═══════════════════════════════════════════════════════════════════════════
describe('F0/L2 — fail-soft: błąd jednego źródła nie wywala gruntu', () => {
  it('portfolio rzuca → org/financials/lineage nadal w promptcie', async () => {
    script = {
      initiative: FULL_INITIATIVE,
      org: { name: 'Apator S.A.', industry: 'Produkcja' },
      financials: [
        { line_code: 'REVENUE', value: 5, scaling: 'millions', currency: 'PLN', period_label: '2025', period_end: '2025-12-31' },
      ],
      throwOn: 'portfolio',
    };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Kontekst organizacji');
    expect(prompt).toContain('Dane finansowe org');
    expect(prompt).toContain('Pochodzenie (lineage)');
    expect(prompt).not.toContain('Istniejące inicjatywy w organizacji');
  });

  it('financials rzuca → org/portfolio nadal w promptcie', async () => {
    script = {
      initiative: FULL_INITIATIVE,
      org: { name: 'Apator S.A.', industry: 'Produkcja' },
      portfolio: [{ name: 'Migracja CRM', status: 'PLANNING' }],
      throwOn: 'financials',
    };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Kontekst organizacji');
    expect(prompt).toContain('Istniejące inicjatywy w organizacji');
    expect(prompt).not.toContain('Dane finansowe org');
  });

  it('org rzuca → portfolio/financials nadal w promptcie', async () => {
    script = {
      initiative: FULL_INITIATIVE,
      portfolio: [{ name: 'Migracja CRM', status: 'PLANNING' }],
      financials: [
        { line_code: 'REVENUE', value: 5, scaling: 'millions', currency: 'PLN', period_label: '2025', period_end: '2025-12-31' },
      ],
      throwOn: 'org',
    };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Istniejące inicjatywy w organizacji');
    expect(prompt).toContain('Dane finansowe org');
    expect(prompt).not.toContain('Kontekst organizacji');
  });

  it('kpis rzuca → reszta gruntu nadal w promptcie', async () => {
    script = {
      initiative: FULL_INITIATIVE,
      org: { name: 'Apator S.A.', industry: 'Produkcja' },
      throwOn: 'kpis',
    };
    const prompt = await generatePrompt();
    expect(prompt).toContain('Kontekst organizacji');
    expect(prompt).not.toContain('Istniejące KPI');
  });

  it('initiative-fetch rzuca → enrichContext zwraca surowy kontekst (bez crashu)', async () => {
    script = { throwOn: 'initiative' };
    // Generacja nadal kończy się sukcesem (LLM echo promptu) — bez wzbogacenia DB.
    const prompt = await generatePrompt();
    expect(prompt).toContain('Automatyzacja kontroli jakości');
    expect(prompt).not.toContain('Kontekst organizacji');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C. buildGroundingBlock kontrakt (org-first + anty-duplikat) — wprost
// ═══════════════════════════════════════════════════════════════════════════
describe('F0/L2 — buildGroundingBlock emituje 4 źródła z kontraktem', () => {
  it('emituje wszystkie 4 źródła gdy obecne', () => {
    const g = buildGroundingBlock({
      language: 'pl',
      orgContext: 'Apator S.A. — branża: Produkcja',
      financialsSummary: 'Przychód 2025: 8.8M EUR',
      portfolioSummary: 'Migracja CRM [PLANNING]',
      sourceLineage: 'audit #a-77',
    } as GenerationContext)!;
    expect(g).toContain('Kontekst organizacji');
    expect(g).toContain('Dane finansowe org');
    expect(g).toContain('Istniejące inicjatywy w organizacji');
    expect(g).toContain('Pochodzenie (lineage)');
  });

  it('org-context jest PIERWSZY (najwyższy priorytet)', () => {
    const g = buildGroundingBlock({
      language: 'pl',
      orgContext: 'ORG',
      financialsSummary: 'FIN',
      portfolioSummary: 'PORT',
    } as GenerationContext)!;
    expect(g.indexOf('Kontekst organizacji')).toBe(0);
    expect(g.indexOf('Kontekst organizacji')).toBeLessThan(g.indexOf('Dane finansowe org'));
    expect(g.indexOf('Kontekst organizacji')).toBeLessThan(
      g.indexOf('Istniejące inicjatywy w organizacji')
    );
  });

  it('portfolio niesie instrukcję anty-duplikat „NIE duplikuj"', () => {
    const g = buildGroundingBlock({
      language: 'pl',
      portfolioSummary: 'Migracja CRM [PLANNING]',
    } as GenerationContext)!;
    expect(g).toContain('NIE duplikuj');
  });

  it('pusty kontekst → null (nie ma czym gruntować)', () => {
    expect(buildGroundingBlock({ language: 'pl' } as GenerationContext)).toBeNull();
  });
});
