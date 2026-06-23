// @vitest-environment node
/**
 * livePilotFT6 — PIERWSZY pilot FT-6 na ŻYWYM LLM (NIE mock).
 *
 * Odpala REALNE serwisy B1/B3/B4 przez prawdziwy llmService.call → prawdziwy
 * model, i ocenia wynik tym samym scoringiem co harness mock. To jedyna rzecz
 * w całym programie, która mierzy FAKTYCZNĄ jakość generacji (a nie logikę).
 *
 * CAVEAT (świadomy): w repo jest tylko OPENAI_API_KEY (brak Anthropic). Premium
 * tier z D1 = klasa Opus/Sonnet; tu wymuszamy openai/gpt-4o (fallback) — więc to
 * pomiar PODŁOGI, nie docelowego mózgu. Wynik czytać z tą gwiazdką.
 *
 * URUCHOMIENIE (lokalnie, kosztuje ~$1-3):
 *   LIVE_PILOT=1 npx vitest run tests/integration/deliverables/livePilotFT6.test.ts
 * Bez LIVE_PILOT=1 → describe.skip (CI zostaje zielone, zero kosztu).
 *
 * 9 scenariuszy (3×3): deck/doc/table × Sml/Med/Lrg. Wynik → JSON w
 * docs/qa/deliverables/runs/.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { DECK_SCENARIOS } from './catalog/decks.js';
import { DOC_SCENARIOS } from './catalog/reports.js';
import { TABLE_SCENARIOS } from './catalog/tables.js';
import { scoreDeck } from './scoring/deckScoring.js';
import { scoreDoc, type DocumentArtifact } from './scoring/docScoring.js';
import { scoreTable } from './scoring/tableScoring.js';

const LIVE = process.env.LIVE_PILOT === '1';

// ── Wybór providera: Anthropic (D1) gdy jest klucz, inaczej openai/gpt-4o ──
function premiumCfg() {
  if (process.env.ANTHROPIC_API_KEY) {
    return { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };
  }
  return { id: 'gpt-4o', model_id: 'gpt-4o', provider: 'openai', tier: 'PREMIUM' };
}
vi.mock('../../../server/src/services/ai/modelRouter.js', () => ({
  default: { select: vi.fn(async () => premiumCfg()) },
}));
vi.mock('../../../server/src/utils/Logger.js', () => {
  const show = (lvl: string) => (...a: any[]) => {
    const msg = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    if (/fail|error|fallback|premium|llm/i.test(msg)) {
      // eslint-disable-next-line no-console
      console.log(`[LOG:${lvl}] ${msg}`);
    }
  };
  return { default: { error: show('err'), info: show('info'), warn: show('warn'), debug: vi.fn() } };
});
// Premium ON — flaga czytana przy imporcie modułu, więc env w beforeAll = za późno.
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  default: {
    get ENABLE_DELIVERABLES_PREMIUM() {
      return true;
    },
  },
}));
// llmConfigService.getNextFallback → openai (resolveModelConfig dla id:'premium').
vi.mock('../../../server/src/services/ai/llmConfigService.js', () => ({
  llmConfigService: {
    getProviderConfig: vi.fn(async () => null),
    getNextFallback: vi.fn(async () => premiumCfg()),
  },
}));

// ── Helpery wejścia (intent → slajdy/outline) ─────────────────────
const SECTION_LABELS = [
  'Kontekst i problem',
  'Cel i zakres',
  'Diagnoza — kluczowe ustalenia',
  'Analiza danych',
  'Rekomendacje',
  'Plan wdrożenia (roadmap)',
  'Wskaźniki sukcesu (KPI)',
  'Ryzyka i mitigacja',
  'Następne kroki',
];

function buildSlides(intent: string, n: number): any[] {
  const count = Math.max(5, Math.min(n, 10));
  return Array.from({ length: count }, (_, i) => {
    const label = i === 0 ? intent : SECTION_LABELS[(i - 1) % SECTION_LABELS.length];
    return {
      intent: undefined,
      key_message: i === 0 ? intent : `${label}: kluczowy wniosek dla decydenta na slajdzie ${i + 1}.`,
      content: {
        title: i === 0 ? intent : label,
        headline: label,
      },
    };
  });
}

function buildOutline(intent: string, n: number): Array<{ title: string; purpose: string }> {
  const count = Math.max(4, Math.min(n, 8));
  const out = [{ title: intent, purpose: 'Wprowadzenie i kontekst dokumentu' }];
  for (let i = 1; i < count; i++) {
    out.push({ title: SECTION_LABELS[(i - 1) % SECTION_LABELS.length], purpose: '' });
  }
  return out;
}

function pickTier(list: any[]): any[] {
  // Sml = S01-05, Med = S06-15, Lrg = S16-25 → bierzemy po jednym z każdego.
  const byNum = (id: string) => parseInt(id.match(/S(\d+)/)?.[1] ?? '0', 10);
  const sml = list.find((e) => byNum(e.meta.id) <= 5);
  const med = list.find((e) => byNum(e.meta.id) >= 6 && byNum(e.meta.id) <= 15);
  const lrg = list.find((e) => byNum(e.meta.id) >= 16 && byNum(e.meta.id) <= 25);
  return [sml, med, lrg].filter(Boolean);
}

type PilotRow = {
  id: string;
  module: 'deck' | 'doc' | 'table';
  tier: string;
  intent: string;
  tierUsed?: string;
  fallbackUsed?: boolean;
  scorePct: number;
  passed: boolean;
  failures: string[];
  sample: any;
  error?: string;
};

const rows: PilotRow[] = [];

function tierName(id: string): string {
  const n = parseInt(id.match(/S(\d+)/)?.[1] ?? '0', 10);
  if (n <= 5) return 'Sml';
  if (n <= 15) return 'Med';
  if (n <= 25) return 'Lrg';
  return 'Xtr';
}

beforeAll(() => {
  if (!LIVE) return;
  // Wczytaj OPENAI_API_KEY ze stagingowego env.
  const envPath = resolve(process.cwd(), '.env.staging.local');
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/);
      if (m && !process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = m[1].trim();
    }
  }
  process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';
});

describe.skipIf(!LIVE)('FT-6 LIVE pilot — 9 scenariuszy na żywym LLM (gpt-4o fallback)', () => {
  it('deck B1 — 3 scenariusze (Sml/Med/Lrg) przez planDeckLayout', async () => {
    const { planDeckLayout } = await import(
      '../../../server/src/services/presentationLayoutDirectorService.js'
    );
    for (const entry of pickTier(DECK_SCENARIOS)) {
      const intent = entry.meta.intent;
      const n = entry.criteria.maxSlides ? Math.min(entry.criteria.maxSlides, 9) : 8;
      const slides = buildSlides(intent, Math.max(entry.criteria.minSlides ?? 6, n));
      const row: PilotRow = {
        id: entry.meta.id,
        module: 'deck',
        tier: tierName(entry.meta.id),
        intent,
        scorePct: 0,
        passed: false,
        failures: [],
        sample: null,
      };
      try {
        const result = await planDeckLayout(
          slides,
          { language: 'PL', template: 'corporate' } as any,
          { orgId: 'org-live-pilot', preferPremium: true }
        );
        const report = scoreDeck(result, entry.criteria);
        row.tierUsed = result.tierUsed;
        row.fallbackUsed = result.fallbackUsed;
        row.scorePct = report.scorePct;
        row.passed = report.passed;
        row.failures = report.failures.map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`);
        row.sample = {
          distinctLayouts: new Set(result.plans.map((p) => p.layoutIntent)).size,
          palettes: [...new Set(result.plans.map((p) => p.paletteId))],
          layouts: result.plans.map((p) => p.layoutIntent),
          withBrief: result.plans.filter((p) => (p.imageBrief?.trim().length ?? 0) > 0).length,
          firstReasoning: result.plans[0]?.reasoning?.slice(0, 120),
        };
      } catch (err) {
        row.error = (err as Error).message;
      }
      rows.push(row);
      // eslint-disable-next-line no-console
      console.log(`[deck ${row.id}] ${row.scorePct}% ${row.passed ? 'PASS' : 'FAIL'} tier=${row.tierUsed} fb=${row.fallbackUsed}${row.error ? ' ERR=' + row.error : ''}`);
    }
    expect(rows.filter((r) => r.module === 'deck').length).toBe(3);
  }, 180_000);

  it('doc B3+content — 3 scenariusze przez planDocumentStructure→generateDocumentContent', async () => {
    const { planDocumentStructure } = await import(
      '../../../server/src/services/documentStudio/documentStructureGenerator.js'
    );
    const { generateDocumentContent } = await import(
      '../../../server/src/services/documentStudio/documentBlockContentGenerator.js'
    );
    for (const entry of pickTier(DOC_SCENARIOS)) {
      const intent = entry.meta.intent;
      const outline = buildOutline(intent, 6);
      const row: PilotRow = {
        id: entry.meta.id,
        module: 'doc',
        tier: tierName(entry.meta.id),
        intent,
        scorePct: 0,
        passed: false,
        failures: [],
        sample: null,
      };
      try {
        const plan = await planDocumentStructure(intent, outline, {
          orgId: 'org-live-pilot',
          preferPremium: true,
        });
        const content = await generateDocumentContent(intent, plan, {
          orgId: 'org-live-pilot',
          preferPremium: true,
          citationCount: (entry.criteria as any).minCitations,
        });
        const artifact: DocumentArtifact = {
          sections: content.sections.map((s: any) => ({
            sectionId: s.sectionId,
            heading: s.heading,
            blocks: s.blocks.map((b: any) => ({ blockId: b.blockId, type: b.type, content: b.content })),
          })),
          citations: content.citations,
        };
        const report = scoreDoc(artifact, entry.criteria);
        row.scorePct = report.scorePct;
        row.passed = report.passed;
        row.failures = report.failures.map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`);
        row.sample = {
          sections: artifact.sections.length,
          blockTypes: [...new Set(artifact.sections.flatMap((s) => s.blocks.map((b) => b.type)))],
          totalBlocks: artifact.sections.reduce((a, s) => a + s.blocks.length, 0),
          firstHeading: artifact.sections[0]?.heading,
        };
      } catch (err) {
        row.error = (err as Error).message;
      }
      rows.push(row);
      // eslint-disable-next-line no-console
      console.log(`[doc ${row.id}] ${row.scorePct}% ${row.passed ? 'PASS' : 'FAIL'}${row.error ? ' ERR=' + row.error : ''}`);
    }
    expect(rows.filter((r) => r.module === 'doc').length).toBe(3);
  }, 240_000);

  it('table B4 — 3 scenariusze przez generateTableSchema', async () => {
    const { generateTableSchema } = await import(
      '../../../server/src/services/tableSchemaGeneratorService.js'
    );
    for (const entry of pickTier(TABLE_SCENARIOS)) {
      const intent = entry.meta.intent;
      const row: PilotRow = {
        id: entry.meta.id,
        module: 'table',
        tier: tierName(entry.meta.id),
        intent,
        scorePct: 0,
        passed: false,
        failures: [],
        sample: null,
      };
      try {
        const schema = await generateTableSchema(intent, {
          orgId: 'org-live-pilot',
          preferPremium: true,
        });
        const report = scoreTable(
          {
            fields: schema.fields as any,
            seedRows: schema.seedRows,
            conditionalFormatting: (schema as any).conditionalFormatting,
            hasFormulas: (schema as any).hasFormulas,
          },
          entry.criteria
        );
        row.tierUsed = (schema as any).tierUsed;
        row.fallbackUsed = (schema as any).fallbackUsed;
        row.scorePct = report.scorePct;
        row.passed = report.passed;
        row.failures = report.failures.map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`);
        row.sample = {
          fields: schema.fields.map((f: any) => `${f.header}:${f.type}`),
          seedRows: schema.seedRows?.length ?? 0,
          fieldTypes: [...new Set(schema.fields.map((f: any) => f.type))],
        };
      } catch (err) {
        row.error = (err as Error).message;
      }
      rows.push(row);
      // eslint-disable-next-line no-console
      console.log(`[table ${row.id}] ${row.scorePct}% ${row.passed ? 'PASS' : 'FAIL'} tier=${row.tierUsed} fb=${row.fallbackUsed}${row.error ? ' ERR=' + row.error : ''}`);
    }
    expect(rows.filter((r) => r.module === 'table').length).toBe(3);
  }, 180_000);
});

afterAll(() => {
  if (!LIVE || rows.length === 0) return;
  const tag = process.env.ANTHROPIC_API_KEY ? 'sonnet46' : 'gpt4o';
  const outPath = resolve(process.cwd(), `docs/qa/deliverables/runs/2026-06-22-live-pilot-${tag}.json`);
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  const summary = {
    ranAt: new Date().toISOString(),
    model: process.env.ANTHROPIC_API_KEY
      ? 'anthropic/claude-sonnet-4-6 (PREMIUM, zgodny z D1)'
      : 'openai/gpt-4o (PREMIUM fallback — NIE Opus/Sonnet z D1)',
    note: 'FT-6 live. Klucz z Railway staging. Scoring = ten sam co mock-harness.',
    total: rows.length,
    passed: rows.filter((r) => r.passed).length,
    avgScorePct: Math.round(rows.reduce((a, r) => a + r.scorePct, 0) / rows.length),
    byModule: ['deck', 'doc', 'table'].map((m) => {
      const sub = rows.filter((r) => r.module === m);
      return {
        module: m,
        passed: sub.filter((r) => r.passed).length,
        of: sub.length,
        avgScorePct: sub.length ? Math.round(sub.reduce((a, r) => a + r.scorePct, 0) / sub.length) : 0,
      };
    }),
    rows,
  };
  writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`\n=== PILOT FT-6 ZAPIS → ${outPath} ===\n` + JSON.stringify(summary.byModule, null, 2));
});
