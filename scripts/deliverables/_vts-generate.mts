/**
 * _vts-generate — generuje 3 złote deliverable VTS (deck/doc/table) na ŻYWYM
 * premium (Sonnet 4.6) i zrzuca REALNĄ TREŚĆ do MD + JSON, żeby Piotr ocenił
 * wynik "na oczy". PROD-safe (te same guardy co live-pilot).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';
if (!process.env.DATABASE_URL) {
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../');
  for (const f of ['.env.staging.local', '.env']) {
    const p = resolve(repoRoot, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    const url = m?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    if (url && !/centerbeam/i.test(url)) { process.env.DATABASE_URL = url; break; }
  }
}
const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };
const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

const { planDeckLayout } = await import('../../server/src/services/presentationLayoutDirectorService.js');
const { planDocumentStructure } = await import('../../server/src/services/documentStudio/documentStructureGenerator.js');
const { generateDocumentContent } = await import('../../server/src/services/documentStudio/documentBlockContentGenerator.js');
const { generateTableSchema } = await import('../../server/src/services/tableSchemaGeneratorService.js');

const meta = { language: 'PL', template: 'board', client: 'VTS Group S.A.', project: 'Diagnoza gotowości na AI — wave 2' };

const DECK_SLIDES = [
  ['cover', 'Diagnoza gotowości na AI — VTS Group S.A.', 'Wyniki ankiety wave 2: 131 pracowników, 8 działów, droga do skalowania AI'],
  ['executive_summary', 'Streszczenie wykonawcze', 'Średni indeks gotowości 58/100 — fundament jest, brakuje kompetencji i danych; 7 inicjatyw zwróci się w 24 mies.'],
  ['key_messages', 'Trzy wnioski dla zarządu', 'Apetyt na AI wysoki; dane rozproszone i niespójne; luka kompetencyjna w produkcji i logistyce'],
  ['assessment', 'Metodyka badania', 'Ankieta 2-blokowa PL/EN, 131 zaproszeń, 87% zwrotu, indeks gotowości w 5 wymiarach'],
  ['performance_overview', 'Indeks gotowości — obraz całościowy', '58/100 średnio; dane 41, kompetencje 49, procesy 62, kultura 71, technologia 67'],
  ['comparison', 'Gotowość wg działów', 'R&D (74) i IT (71) ciągną w górę; Produkcja (44) i Logistyka (46) wymagają wsparcia'],
  ['root_cause', 'Główne bariery wdrożenia', 'Brak spójnych danych (63% wskazań), luka kompetencyjna, niejasny właściciel AI'],
  ['recommendation_portfolio', 'Rekomendowany portfel inicjatyw', '7 inicjatyw w 3 falach: szybkie wygrane, enablery, skalowanie'],
  ['roadmap', 'Roadmapa 24 mies. — model 5-etapowy', 'Audyt danych → pilotaże → kompetencje → skalowanie → governance'],
  ['risk_management', 'Ryzyka i mitygacje', '5 ryzyk: jakość danych, adopcja, AI Act, dług technologiczny, brak ownera'],
  ['next_steps', 'Następne kroki', 'Decyzja o budżecie Etapu 1, powołanie AI Owner, start audytu danych w 30 dni'],
].map(([intent, title, km]) => ({ intent, key_message: km, content: { title, headline: title } }));

const DOC_OUTLINE = [
  ['Streszczenie wykonawcze', 'Otwórz kpi_strip z 4 metrykami badania (zwrot 87%, średni indeks 58/100, 7 inicjatyw, horyzont 24 mies.), potem 2 paragrafy wniosku.'],
  ['Kontekst i cele diagnozy', 'Proza: po co badanie, ekspansja USA + Data Centers jako tło, czego oczekuje zarząd. 1 callout z zakresem (co jest, a co NIE jest celem).'],
  ['Metodyka badania', 'Ankieta 2-blokowa PL/EN (general + process), próba 131, magic-link, 5 wymiarów; bullet_list z wymiarami. 1 callout (limitacja: samoocena).'],
  ['Kluczowe wyniki — indeks gotowości', 'chart rozkładu gotowości po 5 wymiarach; proza interpretacji.'],
  ['Gotowość wg działów', 'table porównawcza 8 działów (dział, respondenci, indeks, najsłabszy wymiar) + proza o rozwarstwieniu.'],
  ['Główne bariery wdrożenia', 'Proza + callout ostrzegawczy o ryzyku jakości danych (#1 bariera).'],
  ['Rekomendacje', 'bullet_list 7 rekomendacji wg priorytetu, każda z właścicielem i horyzontem.'],
  ['Roadmapa i ryzyka', 'Proza roadmapy 5-etapowej + table rejestru ryzyk (ryzyko, prawdopodobieństwo, wpływ, mitygacja, właściciel).'],
].map(([title, purpose]) => ({ title, purpose }));

const TABLE_INTENT = 'Wygeneruj tabelę śledzącą wyniki diagnozy gotowości na AI w VTS Group wave 2 w rozbiciu na działy: dział (singleSelect z kolorami), liczba respondentów (number), frekwencja (percent), indeks gotowości 0-100 (number, kandydat CF), najsłabszy wymiar (singleSelect), główna bariera (text), priorytet (singleSelect kolorowy), właściciel (text), termin docelowy (date), pewność (rating 1-5), status (singleSelect kolorowy); przykładowe dane dla 8 działów (Produkcja, R&D, Sprzedaż, Marketing, IT, Finanse, HR, Logistyka).';

const out: any = { ranAt: new Date().toISOString(), model: 'anthropic/claude-sonnet-4-6' };
let md = `# VTS — wygenerowane deliverable (premium Sonnet 4.6)\n\n_Wygenerowano: ${out.ranAt}. Treść realna z modelu, dane ilustracyjne._\n\n`;

// 1) DECK
console.log('Generuję DECK…');
const deck = await planDeckLayout(DECK_SLIDES as any, meta as any, { orgId: 'vts-golden', preferPremium: true });
out.deck = { tierUsed: deck.tierUsed, fallbackUsed: deck.fallbackUsed, plans: deck.plans };
md += `## 1) PREZENTACJA ZARZĄDCZA (deck) — ${deck.plans.length} slajdów · paleta ${[...new Set(deck.plans.map((p: any) => p.paletteId))].join('/')} · ${new Set(deck.plans.map((p: any) => p.layoutIntent)).size} różnych layoutów\n\n`;
deck.plans.forEach((p: any, i: number) => {
  md += `**Slajd ${i + 1}** — \`${p.layoutIntent}\` · ${DECK_SLIDES[i].content.title}\n  - image brief: ${p.imageBrief || '(brak)'}\n  - reasoning: ${(p.reasoning || '').slice(0, 140)}\n\n`;
});

// 2) DOC
console.log('Generuję DOC (struktura + treść)…');
const plan = await planDocumentStructure('Pełny raport diagnostyczny gotowości na AI dla VTS Group S.A. wave 2', DOC_OUTLINE as any, { orgId: 'vts-golden', preferPremium: true });
const content = await generateDocumentContent('Pełny raport diagnostyczny gotowości na AI dla VTS Group S.A. wave 2', plan, { orgId: 'vts-golden', preferPremium: true });
out.doc = { structureTier: plan.tierUsed, structureFallback: plan.fallbackUsed, sections: content.sections };
md += `## 2) RAPORT DIAGNOSTYCZNY (doc) — ${content.sections.length} sekcji · typy bloków: ${[...new Set((content.sections as any[]).flatMap((s) => s.blocks.map((b: any) => b.type)))].join(', ')}\n\n`;
for (const s of content.sections as any[]) {
  md += `### ${s.heading}\n`;
  for (const b of s.blocks) {
    const c = b.content || {};
    if (b.type === 'heading') continue;
    if (b.type === 'text') md += `${c.text || ''}\n\n`;
    else if (b.type === 'kpi') md += `**KPI:** ${(c.items || []).map((it: any) => `${it.label}: ${it.value}${it.delta ? ' (' + it.delta + ')' : ''}`).join(' · ')}\n\n`;
    else if (b.type === 'callout') md += `> [!${(c.tone || 'info').toUpperCase()}] ${c.text || ''}\n\n`;
    else if (b.type === 'bulletList' || b.type === 'numberedList') md += (c.items || []).map((it: any) => `- ${it}`).join('\n') + '\n\n';
    else if (b.type === 'table') md += `**Tabela:** ${(c.rows || []).length} wierszy\n${JSON.stringify(c.rows || []).slice(0, 400)}\n\n`;
    else if (b.type === 'chart') md += `**Wykres (${c.kind || '?'}):** ${c.title || ''} — serie: ${(c.series || []).map((se: any) => se.label).join(', ')}\n\n`;
    else if (b.type === 'quote') md += `> „${c.text || ''}" — ${c.author || ''}\n\n`;
    else md += `[${b.type}] ${JSON.stringify(c).slice(0, 200)}\n\n`;
  }
}

// 3) TABLE
console.log('Generuję TABLE…');
const table: any = await generateTableSchema(TABLE_INTENT, { orgId: 'vts-golden', preferPremium: true });
out.table = { tierUsed: table.tierUsed, fallbackUsed: table.fallbackUsed, fields: table.fields, seedRows: table.seedRows, conditionalFormatting: table.conditionalFormatting || [], hasFormulas: !!table.hasFormulas };
md += `## 3) TABELA WYNIKÓW (table) — ${table.fields.length} pól · ${(table.seedRows || []).length} wierszy seed · tier ${table.tierUsed}\n\n`;
md += `**Conditional formatting (${(table.conditionalFormatting || []).length} reguł):** ${(table.conditionalFormatting || []).map((cf: any) => `${cf.ref}→[${cf.rules.map((r: any) => r.type).join(',')}]`).join(' · ') || '(brak)'}\n\n`;
md += `| ${table.fields.map((f: any) => f.header).join(' | ')} |\n| ${table.fields.map(() => '---').join(' | ')} |\n`;
for (const row of (table.seedRows || []).slice(0, 8)) {
  md += `| ${table.fields.map((f: any) => { const v = (row as any)[f.key]; return typeof v === 'object' ? JSON.stringify(v) : (v ?? ''); }).join(' | ')} |\n`;
}
md += `\n**Typy pól:** ${table.fields.map((f: any) => `${f.header}:${f.type}`).join(' · ')}\n`;

const dir = resolve(process.cwd(), 'docs/qa/deliverables/runs');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, '2026-06-22-VTS-generated.md'), md, 'utf8');
writeFileSync(resolve(dir, '2026-06-22-VTS-generated.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('\n=== ZAPIS → docs/qa/deliverables/runs/2026-06-22-VTS-generated.md ===');
console.log(`deck: ${deck.plans.length} slajdów, ${new Set(deck.plans.map((p: any) => p.layoutIntent)).size} layoutów, fb=${deck.fallbackUsed}`);
console.log(`doc: ${content.sections.length} sekcji, typy=${[...new Set((content.sections as any[]).flatMap((s) => s.blocks.map((b: any) => b.type)))].join(',')}`);
console.log(`table: ${table.fields.length} pól, ${(table.seedRows || []).length} wierszy, tier=${table.tierUsed}`);
