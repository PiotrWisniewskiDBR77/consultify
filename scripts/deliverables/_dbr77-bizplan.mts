/**
 * _dbr77-bizplan — DOWÓD WIELOWĄTKOWEGO BIZNESPLANU.
 * Jeden RĘCZNIE AUTOROWANY kręgosłup założeń + model finansowy DBR77 → wpuszczony
 * we WSZYSTKIE 3 generatory: tabela finansowa (B4), raport Word (B3+content),
 * deck inwestorski (B1, z briefami grafik produktu). Dowodzi: generatory POTRAFIĄ
 * dać spójną wiązkę GDY dostaną wspólny wkład — i obnaża brakującą warstwę
 * orkiestracji (dziś threading jest ręczny, nie produktowy).
 *
 * Model: openrouter/qwen3-235b (prod default) lub Sonnet (DBR77_BRAIN=sonnet).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';
{
  // Hydrate DATABASE_URL (staging only) + provider keys from .env.staging.local
  // (app's loadEnv reads .env/.env.local, NOT .env.staging.local — inject here).
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../');
  for (const f of ['.env.staging.local', '.env']) {
    const p = resolve(repoRoot, f); if (!existsSync(p)) continue;
    const txt = readFileSync(p, 'utf8');
    if (!process.env.DATABASE_URL) {
      const url = txt.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
      if (url && !/centerbeam/i.test(url)) process.env.DATABASE_URL = url;
    }
    for (const k of ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) {
      if (process.env[k]) continue;
      const v = txt.match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)\\s*$`, 'm'))?.[1]?.trim().replace(/^['"]|['"]$/g, '');
      if (v) process.env[k] = v;
    }
  }
}
const SONNET = process.env.DBR77_BRAIN === 'sonnet';
const CFG = SONNET
  ? { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' }
  : { id: 'qwen/qwen3-235b-a22b-2507', model_id: 'qwen/qwen3-235b-a22b-2507', provider: 'openrouter', tier: 'PREMIUM' };
const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

const { planDeckLayout } = await import('../../server/src/services/presentationLayoutDirectorService.js');
const { planDocumentStructure } = await import('../../server/src/services/documentStudio/documentStructureGenerator.js');
const { generateDocumentContent } = await import('../../server/src/services/documentStudio/documentBlockContentGenerator.js');
const { generateTableSchema } = await import('../../server/src/services/tableSchemaGeneratorService.js');

// ════════════════════════════════════════════════════════════════
// WSPÓLNY KRĘGOSŁUP ZAŁOŻEŃ + MODEL FINANSOWY (ręcznie autorowany = wkład merytoryczny)
// ════════════════════════════════════════════════════════════════
const SPINE = {
  company: 'DBR77 Sp. z o.o.',
  product: 'Consultify — platforma AI generująca materiały doradcze (prezentacje, raporty, tabele) klasy konsultingowej',
  thesis: 'Konsulting tworzy deliverable ręcznie: wolno i drogo. Consultify generuje je AI w minuty, w jakości McKinsey/Gamma, zasilane realnymi danymi organizacji.',
  ask: 'Runda seed 1,2 mln EUR na skalowanie Consultify (sprzedaż + produkt), runway 24 mies.',
  assumptions: [
    'Model hybrydowy: usługi doradcze (transformacja AI) + SaaS Consultify (subskrypcja per-seat).',
    'SaaS: 290 EUR/seat/mies., churn roczny 12%, ekspansja netto 115%.',
    'Konsulting: stawka 1400 EUR/dzień, utylizacja 65%, zespół delivery rośnie z 8 do 22 FTE.',
    'CAC SaaS 2,1 tys. EUR, LTV 9,4 tys. EUR (LTV/CAC ≈ 4,5).',
    'Koszt modeli AI ~1/100 konkurencji (chińskie modele przez OpenRouter) = marża brutto SaaS 86%.',
  ],
  // 3-letni model finansowy (tys. EUR) — ilustracyjny, spójny
  financials: [
    { rok: 'Rok 1 (2026)', przychodSaaS: 540, przychodKonsulting: 1850, przychodRazem: 2390, cogs: 430, opex: 1980, ebitda: -20, marzaEbitda: '-1%', klienciSaaS: 38, arr: 650, fte: 16 },
    { rok: 'Rok 2 (2027)', przychodSaaS: 2160, przychodKonsulting: 2600, przychodRazem: 4760, cogs: 760, opex: 3200, ebitda: 800, marzaEbitda: '17%', klienciSaaS: 142, arr: 2900, fte: 22 },
    { rok: 'Rok 3 (2028)', przychodSaaS: 5400, przychodKonsulting: 3400, przychodRazem: 8800, cogs: 1300, opex: 4800, ebitda: 2700, marzaEbitda: '31%', klienciSaaS: 340, arr: 7200, fte: 31 },
  ],
};
const F = SPINE.financials;
const finLine = `Przychód R1/R2/R3: ${F[0].przychodRazem}/${F[1].przychodRazem}/${F[2].przychodRazem} tys. EUR; EBITDA ${F[0].ebitda}/${F[1].ebitda}/${F[2].ebitda} (marża ${F[0].marzaEbitda}→${F[2].marzaEbitda}); ARR SaaS ${F[0].arr}→${F[2].arr} tys. EUR; klienci SaaS ${F[0].klienciSaaS}→${F[2].klienciSaaS}`;

const out: any = { ranAt: new Date().toISOString(), model: CFG.id, spine: SPINE };
let md = `# DBR77 — KOMPLET BIZNESPLANU (wielowątkowy, wspólny kręgosłup założeń)\n\n_Model: ${CFG.id}. Założenia+finanse ręcznie autorowane (wkład merytoryczny), wpuszczone w 3 generatory. Dane ilustracyjne._\n\n## Założenia (kręgosłup)\n${SPINE.assumptions.map((a) => `- ${a}`).join('\n')}\n\n**Finanse (skrót):** ${finLine}\n\n`;

// ── 1) TABELA FINANSOWA (B4) — z modelu ───────────────────────────
console.log('1/3 TABELA finansowa…');
const tableIntent = `Zbuduj tabelę modelu finansowego 3-letniego dla biznesplanu ${SPINE.company} w rozbiciu na lata (Rok 1 2026 / Rok 2 2027 / Rok 3 2028): kolumny — Rok (text), Przychód SaaS tys EUR (currency), Przychód konsulting tys EUR (currency), Przychód razem tys EUR (currency), COGS tys EUR (currency), OpEx tys EUR (currency), EBITDA tys EUR (currency, kandydat na conditional formatting kolor czerwony→zielony), Marża EBITDA (percent), Klienci SaaS (number), ARR tys EUR (currency), FTE (number). Wiersze dokładnie wg danych: ${JSON.stringify(F)}. Dodaj conditional formatting na EBITDA (colorScale) i Marża EBITDA (dataBar).`;
const table: any = await generateTableSchema(tableIntent, { orgId: 'dbr77-bizplan', preferPremium: true });
out.table = { tierUsed: table.tierUsed, fallbackUsed: table.fallbackUsed, fields: table.fields, seedRows: table.seedRows, cf: table.conditionalFormatting };
md += `## 1) TABELA FINANSOWA (B4) — ${table.fields.length} pól · ${(table.seedRows||[]).length} wierszy · CF ${(table.conditionalFormatting||[]).length} · tier ${table.tierUsed}\n\n| ${table.fields.map((f:any)=>f.header).join(' | ')} |\n| ${table.fields.map(()=>'---').join(' | ')} |\n${(table.seedRows||[]).map((r:any)=>`| ${table.fields.map((f:any)=>{const v=r[f.key];return typeof v==='object'?JSON.stringify(v):(v??'')}).join(' | ')} |`).join('\n')}\n\n`;

// ── 2) RAPORT WORD (B3+content) — biznesplan z założeń + finansów ──
console.log('2/3 RAPORT Word…');
const docOutline = [
  ['Streszczenie wykonawcze', `kpi_strip z 4 metrykami (przychód R3 ${F[2].przychodRazem} tys EUR, EBITDA R3 ${F[2].ebitda} tys EUR / marża ${F[2].marzaEbitda}, ARR R3 ${F[2].arr} tys EUR, ask ${SPINE.ask}) + 2 paragrafy: ${SPINE.thesis}`],
  ['Problem i rynek', `Proza: konsulting tworzy deliverable ręcznie (wolno/drogo). 1 callout z wielkością bólu.`],
  ['Produkt — Consultify', `Proza opisu: ${SPINE.product}. bullet_list 5 możliwości (deck/raport/tabela AI, dane org, eksport, modele tanie). 1 callout o przewadze kosztowej (modele ~1/100 ceny).`],
  ['Model biznesowy i założenia', `bullet_list założeń: ${SPINE.assumptions.join(' | ')}.`],
  ['Analiza finansowa', `table modelu 3-letniego (Rok, Przychód razem, EBITDA, Marża, ARR) z danych: ${JSON.stringify(F.map((x)=>({rok:x.rok,przychod:x.przychodRazem,ebitda:x.ebitda,marza:x.marzaEbitda,arr:x.arr})))} + chart trendu przychodu i EBITDA 3 lata + proza interpretacji (break-even w R2).`],
  ['Ryzyka i mitygacja', `Proza + callout warning o ryzyku adopcji + zależności od dostawców modeli AI.`],
  ['Zespół i rekomendacja inwestycyjna', `Proza: zespół ${F[2].fte} FTE w R3. callout success z ask: ${SPINE.ask}, LTV/CAC 4,5.`],
].map(([title, purpose]) => ({ title, purpose }));
const docIntent = `Pełny raport biznesplanu dla ${SPINE.company}: ${SPINE.thesis} Założenia: ${SPINE.assumptions.join(' ')} Finanse: ${finLine}`;
const plan = await planDocumentStructure(docIntent, docOutline as any, { orgId: 'dbr77-bizplan', preferPremium: true });
const content = await generateDocumentContent(docIntent, plan, { orgId: 'dbr77-bizplan', preferPremium: true, citationCount: 3 });
out.doc = { sections: content.sections, citations: content.citations };
md += `## 2) RAPORT WORD (B3+content) — ${content.sections.length} sekcji · typy: ${[...new Set((content.sections as any[]).flatMap((s)=>s.blocks.map((b:any)=>b.type)))].join(', ')}\n\n`;
for (const s of content.sections as any[]) { md += `### ${s.heading}\n`; for (const b of s.blocks) { const c=b.content||{}; if(b.type==='heading')continue; if(b.type==='text')md+=`${(c.text||'').slice(0,600)}\n\n`; else if(b.type==='kpi')md+=`**KPI:** ${(c.items||[]).map((it:any)=>`${it.label}: ${it.value}${it.delta?` (${it.delta})`:''}`).join(' · ')}\n\n`; else if(b.type==='callout')md+=`> [!${(c.tone||'info').toUpperCase()}] ${c.text||''}\n\n`; else if(b.type==='bulletList'||b.type==='numberedList')md+=(c.items||[]).map((it:any)=>`- ${it}`).join('\n')+'\n\n'; else if(b.type==='table')md+=`**Tabela:** ${(c.rows||[]).length} wierszy\n\n`; else if(b.type==='chart')md+=`**Wykres (${c.kind}):** ${c.title||''} — serie ${(c.series||[]).map((x:any)=>x.label).join(', ')}\n\n`; } }
if (content.citations?.length) md += `**Cytowania:** ${content.citations.map((c:any)=>c.ref).join(' · ')}\n\n`;

// ── 3) DECK INWESTORSKI (B1) — reużywa założeń + finansów + grafiki produktu ──
console.log('3/3 DECK inwestorski…');
const deckSlides = [
  ['cover', `${SPINE.company} — Consultify`, SPINE.thesis],
  ['executive_summary', 'Streszczenie inwestorskie', `${finLine}. Ask: ${SPINE.ask}`],
  ['root_cause', 'Problem', 'Konsulting tworzy deliverable ręcznie — wolno, drogo, niespójnie'],
  ['single_insight', 'Produkt — Consultify', SPINE.product],
  ['performance_overview', 'Rynek i trakcja', `${F[1].klienciSaaS} klientów SaaS w R2, ARR ${F[1].arr} tys EUR`],
  ['comparison', 'Przewaga: koszt modeli ~1/100', 'Chińskie modele przez OpenRouter — marża brutto SaaS 86% vs konkurencja'],
  ['performance_overview', 'Model finansowy 3-letni', finLine],
  ['recommendation_portfolio', 'Jednostkowa ekonomia', 'LTV/CAC 4,5; ekspansja netto 115%; churn 12%'],
  ['roadmap', 'Roadmapa 24 mies.', 'Skalowanie sprzedaży → produkt → ekspansja zagraniczna'],
  ['recommendation_single', 'Ask inwestorski', SPINE.ask],
  ['next_steps', 'Następne kroki', 'Term sheet, due diligence, zamknięcie rundy w Q3'],
].map(([intent, title, km]) => ({ intent, key_message: km, content: { title, headline: title } }));
const deck = await planDeckLayout(deckSlides as any, { language: 'PL', template: 'board', client: SPINE.company, project: 'Biznesplan inwestorski' } as any, { orgId: 'dbr77-bizplan', preferPremium: true });
out.deck = { tierUsed: deck.tierUsed, fallbackUsed: deck.fallbackUsed, plans: deck.plans };
md += `## 3) DECK INWESTORSKI (B1) — ${deck.plans.length} slajdów · ${new Set(deck.plans.map((p:any)=>p.layoutIntent)).size} layoutów · paleta ${[...new Set(deck.plans.map((p:any)=>p.paletteId))].join('/')} · briefy-grafik ${deck.plans.filter((p:any)=>p.imageBrief).length}\n\n`;
deck.plans.forEach((p:any,i:number)=>{ md+=`**Slajd ${i+1}** \`${p.layoutIntent}\`${p.composition?.layoutVariantId?` · komp:${p.composition.layoutVariantId}`:''} · ${deckSlides[i].content.title}\n  - grafika: ${p.imageBrief||'(brak)'}\n\n`; });

const dir = resolve(process.cwd(), 'docs/qa/deliverables/runs');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, '2026-06-23-DBR77-bizplan.md'), md, 'utf8');
writeFileSync(resolve(dir, '2026-06-23-DBR77-bizplan.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('\n=== ZAPIS → docs/qa/deliverables/runs/2026-06-23-DBR77-bizplan.md ===');
console.log(`table: ${table.fields.length} pól/${(table.seedRows||[]).length} wierszy/CF ${(table.conditionalFormatting||[]).length}, tier ${table.tierUsed} fb ${table.fallbackUsed}`);
console.log(`doc: ${content.sections.length} sekcji, typy ${[...new Set((content.sections as any[]).flatMap((s)=>s.blocks.map((b:any)=>b.type)))].join(',')}`);
console.log(`deck: ${deck.plans.length} slajdów/${new Set(deck.plans.map((p:any)=>p.layoutIntent)).size} layoutów, briefy ${deck.plans.filter((p:any)=>p.imageBrief).length}, fb ${deck.fallbackUsed}`);
