/**
 * _diag-doc2 — doc-quality probe (own, do NOT confuse with _diag-doc.mts).
 *
 * Replicates the SHARED harness `outline()` logic from live-pilot-ft6.mts EXACTLY
 * so the score it prints matches what the pilot would measure — then chains
 * B3 (planDocumentStructure) → content-gen (generateDocumentContent) → scoreDoc
 * on the REAL premium brain (Anthropic Sonnet 4.6). Prints scorePct + failures +
 * block-type sample per scenario.
 *
 * RUN:
 *   export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv 2>/dev/null | grep -E '^ANTHROPIC_API_KEY=' | head -1 | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
 *   node --import tsx scripts/deliverables/_diag-doc2.mts            # default set: S01 S06 S16 S19
 *   node --import tsx scripts/deliverables/_diag-doc2.mts S01 S07 S20  # explicit set
 */
// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';
process.env.DATABASE_URL =
  process.env.DATABASE_URL && !/centerbeam/i.test(process.env.DATABASE_URL)
    ? process.env.DATABASE_URL
    : 'postgresql://x:x@trolley.proxy.rlwy.net:28146/railway?sslmode=disable';

const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };

const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });
const breakerMod = await import('../../server/src/services/ai/circuitBreaker.js');
const resetBreaker = async () => { try { await (breakerMod.default as any).reset('anthropic'); } catch {} };

const { DOC_SCENARIOS } = await import('../../tests/integration/deliverables/catalog/reports.js');
const { scoreDoc } = await import('../../tests/integration/deliverables/scoring/docScoring.js');
const { planDocumentStructure } = await import('../../server/src/services/documentStudio/documentStructureGenerator.js');
const { generateDocumentContent } = await import('../../server/src/services/documentStudio/documentBlockContentGenerator.js');

// ── MODE A: EXACT copy of the shared harness outline() (live-pilot-ft6.mts) ──
// What the FT-6 pilot actually feeds. Section titles are GENERIC labels — this
// is a deliberate test shortcut and can structurally miss `requireSectionHeading`.
const LABELS = ['Kontekst i problem', 'Cel i zakres', 'Diagnoza — ustalenia', 'Analiza danych', 'Rekomendacje', 'Roadmap', 'KPI', 'Ryzyka', 'Następne kroki'];
function pilotOutline(intent: string, n: number) {
  const c = Math.max(1, Math.min(n, 9));
  const o = [{ title: intent, purpose: 'Wprowadzenie i kontekst' }];
  for (let i = 1; i < c; i++) o.push({ title: LABELS[(i - 1) % LABELS.length], purpose: '' });
  return o;
}

// ── MODE B: realistic, criteria-derived outline (per task brief). ────────────
// Derives section titles + purposes from the criteria DSL (the SPEC), NOT from
// scenario names. Mirrors what the real product narrative-planner would feed B3:
// a section for each required heading keyword, purposes that hint the required
// block types, sized to [minSections, maxSections].
function realisticOutline(intent: string, criteria: any) {
  const min = criteria.minSections ?? 3;
  const max = criteria.maxSections ?? Math.max(min, 6);
  const n = Math.max(min, Math.min(max, Math.round((min + max) / 2)));

  // Required block types → purpose hints the planner can act on.
  // KPI count: if the spec pins an EXACT count (kpiItemsRange min===max), the
  // realistic planner would request that exact count (this is the SPEC, derived
  // from the criteria DSL — NOT scenario-name matching).
  const kpiRange = criteria.kpiItemsRange as [number, number] | undefined;
  const kpiCountHint = kpiRange
    ? kpiRange[0] === kpiRange[1]
      ? `DOKŁADNIE ${kpiRange[0]} wskaźników`
      : `${kpiRange[0]}-${kpiRange[1]} wskaźników`
    : '3-5 wskaźników';
  const reqTypes: string[] = (criteria.requireBlockType ?? []).map((r: any) => r.type);
  // minStyledCells in the spec ⇒ the table is a STATUS/severity table with
  // conditional formatting (coloured cells). Signal that to the planner/writer.
  const tableHint = criteria.minStyledCells
    ? 'tabela STATUSU/ryzyka z kolorowaniem warunkowym komórek (zielony/bursztynowy/czerwony wg severity)'
    : 'zestawienie porównawcze jako tabela';
  const hintFor: Record<string, string> = {
    kpi: `kluczowe metryki jako kpi_strip (${kpiCountHint} z deltą)`,
    chart: 'trend jako wykres (chart)',
    table: tableHint,
    callout: 'kluczowe ostrzeżenia/wnioski jako callout',
    bulletList: 'wypunktowana lista ustaleń',
    numberedList: 'kroki jako lista numerowana',
    quote: 'cytat interesariusza',
  };
  // Data-only constraint: spec forbids prose paragraphs ⇒ planner must build the
  // doc from data blocks only (kpi/table/chart/callout/lists), zero prose text.
  const forbidText = (criteria.forbidBlockType ?? []).includes('text');
  const noProse = forbidText
    ? ' DOKUMENT DATA-ONLY: ŻADNYCH paragrafów prozy (type text/paragraph) — wyłącznie ' +
      'kpi_strip, table, chart, callout, listy. Każda sekcja zaczyna się od heading.'
    : '';
  const richHint = (reqTypes.length
    ? 'Treść merytoryczna — użyj: ' + reqTypes.map((t) => hintFor[t] ?? t).join('; ') + '.'
    : 'Treść merytoryczna z odpowiednimi typami bloków.') + noProse;

  const headKw: string[] = criteria.requireSectionHeading ?? [];
  const sections: Array<{ title: string; purpose: string }> = [];
  // REQUIRED-heading sections take priority (must survive even a 1-section doc).
  // For a single-section doc whose required heading is e.g. "CRM", that one section
  // IS the document — fold the intro purpose into it.
  for (const kw of headKw) {
    const title = kw.toUpperCase() === kw ? kw : kw.charAt(0).toUpperCase() + kw.slice(1);
    sections.push({
      title,
      purpose: `Sekcja "${title}". Wprowadzenie + treść merytoryczna. ${richHint}`,
    });
  }
  // Intro only if there is room beyond the required-heading sections.
  if (sections.length < n) {
    sections.push({
      title: forbidText ? 'Wskaźniki kluczowe' : 'Wprowadzenie i kontekst',
      purpose: forbidText ? `Sekcja danych. ${richHint}` : 'Krótkie wprowadzenie prozą — cel i zakres dokumentu.',
    });
  }
  const filler = ['Stan obecny', 'Analiza ustaleń', 'Diagnoza', 'Rekomendacje', 'Roadmapa', 'Ryzyka', 'KPI i mierniki', 'Następne kroki', 'Podsumowanie', 'Appendix'];
  let fi = 0;
  while (sections.length < n && fi < filler.length) {
    const title = filler[fi++];
    if (sections.some((s) => s.title.toLowerCase() === title.toLowerCase())) continue;
    sections.push({ title, purpose: richHint });
  }
  return sections.slice(0, n);
}

const argv = process.argv.slice(2).map((s) => s.toUpperCase());
// MODE flag: B (realistic, default) | A (pilot-exact) | AB (both)
const modeArg = (argv.find((a) => a === 'A' || a === 'B' || a === 'AB') ?? 'B');
const dump = argv.includes('DUMP');
const want = argv.filter((a) => /^S\d+$/.test(a));
const wantSet = want.length ? want : ['S01', 'S06', 'S16', 'S19'];
const targets = DOC_SCENARIOS.filter((e: any) => wantSet.some((w) => e.meta.id.endsWith(w)));

const rows: any[] = [];
async function runOne(e: any, mode: 'A' | 'B') {
  await resetBreaker();
  const id = `${e.meta.id}/${mode}`;
  const r: any = { id, intent: e.meta.intent };
  const t0 = Date.now();
  try {
    const nSec = Math.round((((e.criteria as any).minSections ?? 4) + ((e.criteria as any).maxSections ?? 6)) / 2);
    const ol = mode === 'A' ? pilotOutline(e.meta.intent, nSec) : realisticOutline(e.meta.intent, e.criteria);
    const plan = await planDocumentStructure(e.meta.intent, ol as any, { orgId: 'org-diag2', preferPremium: true });
    const planBlocks = plan.sections.reduce((a: number, s: any) => a + s.blocks.length, 0);
    const content = await generateDocumentContent(e.meta.intent, plan, {
      orgId: 'org-diag2', preferPremium: true, citationCount: (e.criteria as any).minCitations,
    });
    const artifact = {
      sections: content.sections.map((s: any) => ({
        sectionId: s.sectionId, heading: s.heading,
        blocks: s.blocks.map((b: any) => ({ blockId: b.blockId, type: b.type, content: b.content })),
      })),
      citations: content.citations,
    };
    const rep = scoreDoc(artifact as any, e.criteria);
    Object.assign(r, {
      tierUsed: content.tierUsed, fallbackUsed: content.fallbackUsed,
      planTier: plan.tierUsed, planFallback: plan.fallbackUsed, planBlocks,
      scorePct: rep.scorePct, passed: rep.passed,
      failures: rep.failures.map((f: any) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`),
      sections: artifact.sections.length,
      totalBlocks: artifact.sections.reduce((a: number, s: any) => a + s.blocks.length, 0),
      blockTypes: [...new Set(artifact.sections.flatMap((s: any) => s.blocks.map((b: any) => b.type)))],
      perSection: artifact.sections.map((s: any) => `${s.heading}:[${s.blocks.map((b: any) => b.type).join(',')}]`),
      artifact,
    });
  } catch (err: any) { r.error = err?.message; r.scorePct = 0; r.passed = false; }
  r.elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
  rows.push(r);
  console.log(`\n[doc ${id}] ${r.scorePct}% ${r.passed ? 'PASS' : 'FAIL'}  (${r.elapsedS}s)  planTier=${r.planTier} planFb=${r.planFallback} planBlocks=${r.planBlocks} cgTier=${r.tierUsed} cgFb=${r.fallbackUsed}`);
  console.log(`   sections=${r.sections} totalBlocks=${r.totalBlocks} types=[${(r.blockTypes ?? []).join(',')}]`);
  if (r.perSection) for (const ps of r.perSection) console.log(`     • ${ps}`);
  if (r.failures?.length) console.log(`   FAILURES: ${r.failures.join(' | ')}`);
  if (r.error) console.log(`   ERROR: ${r.error}`);
  if (dump && r.artifact) {
    console.log('   --- CONTENT SAMPLE (kpi/table/callout/text) ---');
    for (const s of r.artifact.sections) {
      for (const b of s.blocks) {
        if (['kpi', 'table', 'callout', 'text'].includes(b.type)) {
          console.log(`     [${b.type}] ${JSON.stringify(b.content).slice(0, 240)}`);
        }
      }
    }
  }
}

const modes: Array<'A' | 'B'> = modeArg === 'AB' ? ['A', 'B'] : [modeArg as 'A' | 'B'];
for (const e of targets) {
  for (const m of modes) await runOne(e, m);
}

const avg = Math.round(rows.reduce((a, r) => a + (r.scorePct || 0), 0) / rows.length);
console.log(`\n=== SUMMARY: ${rows.filter((r) => r.passed).length}/${rows.length} pass, avg ${avg}% ===`);
console.log(rows.map((r) => `${r.id}=${r.scorePct}%`).join('  '));
