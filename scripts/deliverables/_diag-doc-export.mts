/**
 * _diag-doc-export — fidelity probe for premium DOCUMENT export (DOCX + PDF).
 *
 * Runs B3 (planDocumentStructure) + content-gen (generateDocumentContent) on a
 * RICH intent (kpi + chart + table + callout + bullet list), adapts the
 * GeneratedDocumentContent into a DocumentSchema, then renders BOTH the DOCX
 * and PDF renderer outputs to /tmp and PARSES them to assert that each rich
 * block type actually materialises in the file (not as raw JSON / placeholder).
 *
 * DOCX proof  = unzip word/document.xml + check for <w:tbl> (tables), <w:drawing>
 *               (embedded images/charts), styled runs, and that no raw `{...}`
 *               JSON or "[Table placeholder" leaked through.
 * PDF proof   = non-trivial byte size + page count + (when charts embed) image
 *               XObjects present.
 */
// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
//   1) DOTENV_IGNORE_LOCAL=1 — loadEnv skips `.env.local` (= PROD centerbeam).
//   2) SKIP_DB_INIT=1        — no pool, no DB-backed init/persistence stall.
//   3) DATABASE_URL=staging  — belt-and-suspenders: any connection hits STAGING.
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';

if (!process.env.DATABASE_URL) {
  const { existsSync, readFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../');
  for (const f of ['.env.staging.local', '.env']) {
    const p = resolve(repoRoot, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    const url = m?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    if (url && !/centerbeam/i.test(url)) { process.env.DATABASE_URL = url; break; }
  }
}
// ────────────────────────────────────────────────────────────────────────────

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };

const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

const { planDocumentStructure } = await import(
  '../../server/src/services/documentStudio/documentStructureGenerator.js'
);
const { generateDocumentContent } = await import(
  '../../server/src/services/documentStudio/documentBlockContentGenerator.js'
);
const { renderDocumentSchemaToDocxBuffer } = await import(
  '../../server/src/services/documentStudio/documentDocxRenderer.js'
);
const { renderDocumentSchemaToPdfBuffer } = await import(
  '../../server/src/services/documentStudio/documentPdfRenderer.js'
);
const { DEFAULT_CONSULTING_FORMATTING_SCHEMA } = await import(
  '../../server/src/services/documentStudio/documentStudioTypes.js'
);

// ── map content-gen ContentBlockType → schema DocumentBlockType ─────────────
const CONTENT_TO_DOC: Record<string, string> = {
  heading: 'heading',
  text: 'paragraph',
  bulletList: 'bullet_list',
  numberedList: 'numbered_list',
  quote: 'quote',
  callout: 'callout',
  chart: 'chart',
  table: 'table',
  kpi: 'kpi_strip',
  image: 'image',
  divider: 'paragraph',
};

function contentToSchema(content: any): any {
  const now = new Date().toISOString();
  const sections = content.sections.map((s: any, si: number) => ({
    sectionId: `sec-${si}`,
    orderIndex: si,
    level: 1,
    title: s.heading ?? `Section ${si + 1}`,
    purpose: undefined,
    blocks: s.blocks.map((b: any, bi: number) => ({
      blockId: b.blockId ?? `b-${si}-${bi}`,
      type: CONTENT_TO_DOC[b.type] ?? 'paragraph',
      content: b.content,
    })),
    sourceRefs: [],
  }));
  return {
    documentId: 'diag-doc',
    artifactId: 'diag-artifact',
    title: 'Raport diagnostyczny procesu rekrutacji ACME',
    documentType: 'diagnostic_report',
    language: 'pl',
    audience: ['Zarząd ACME'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'professional',
    confidentiality: 'internal',
    formattingSchema: DEFAULT_CONSULTING_FORMATTING_SCHEMA,
    sections,
    sourceRefs: [],
    createdAt: now,
    updatedAt: now,
  };
}

const intent =
  'Raport diagnostyczny procesu rekrutacji ACME: wprowadzenie, stan obecny z metrykami (KPI), ' +
  'tabela ryzyk ze statusami, wykres lejka rekrutacyjnego, 3 zidentyfikowane problemy jako ' +
  'wyróżnione ostrzeżenia (callout), rekomendacje jako lista punktowana';
const outline = [
  { title: 'Wprowadzenie i kontekst', purpose: 'Krótkie wprowadzenie prozą — po co ten raport' },
  { title: 'Stan obecny procesu rekrutacji', purpose: 'Metryki procesu jako kpi_strip; wykres lejka jako chart' },
  { title: 'Tabela ryzyk', purpose: 'Ryzyka z poziomem (status) jako table z kolorowaniem komórek' },
  { title: 'Zidentyfikowane problemy', purpose: '3 kluczowe problemy, każdy jako callout (ostrzeżenie)' },
  { title: 'Rekomendacje', purpose: 'Lista rekomendacji jako bullet_list, priorytetyzowana' },
];

console.log('=== B3 planDocumentStructure ===');
let t = Date.now();
const plan = await planDocumentStructure(intent, outline as any, { orgId: 'org-diag', preferPremium: true });
console.log(`tier=${plan.tierUsed} fallback=${plan.fallbackUsed} czas=${((Date.now() - t) / 1000).toFixed(1)}s`);
for (const s of plan.sections) {
  console.log(`  • ${s.title}: [${s.blocks.map((b: any) => b.type).join(', ')}]`);
}

console.log('\n=== content-gen generateDocumentContent ===');
t = Date.now();
const content = await generateDocumentContent(intent, plan, { orgId: 'org-diag', preferPremium: true });
console.log(`tier=${content.tierUsed} fallback=${content.fallbackUsed} czas=${((Date.now() - t) / 1000).toFixed(1)}s`);
const byType: Record<string, number> = {};
const sampleByType: Record<string, any> = {};
for (const s of content.sections as any[]) {
  for (const b of s.blocks) {
    byType[b.type] = (byType[b.type] ?? 0) + 1;
    if (!sampleByType[b.type]) sampleByType[b.type] = b.content;
  }
}
console.log(`block-type counts: ${JSON.stringify(byType)}`);
for (const [tp, sample] of Object.entries(sampleByType)) {
  console.log(`  sample ${tp}: ${JSON.stringify(sample).slice(0, 220)}`);
}

const schema = contentToSchema(content);

console.log('\n=== render DOCX + PDF ===');
const docx = await renderDocumentSchemaToDocxBuffer(schema as any);
const pdf = await renderDocumentSchemaToPdfBuffer(schema as any);
const outDir = mkdtempSync(join(tmpdir(), 'diag-doc-export-'));
const docxPath = join(outDir, 'report.docx');
const pdfPath = join(outDir, 'report.pdf');
writeFileSync(docxPath, docx);
writeFileSync(pdfPath, pdf);
console.log(`DOCX ${docx.length} B → ${docxPath}`);
console.log(`PDF  ${pdf.length} B → ${pdfPath}`);

// ── parse DOCX (unzip document.xml) ─────────────────────────────────────────
const documentXml = execSync(`unzip -p "${docxPath}" word/document.xml`, {
  maxBuffer: 32 * 1024 * 1024,
}).toString('utf8');
const tableCount = (documentXml.match(/<w:tbl>/g) ?? []).length;
const drawingCount = (documentXml.match(/<w:drawing>/g) ?? []).length;
const hasShading = /<w:shd /.test(documentXml);
// raw-JSON leak: a block content object stringified into a run (e.g. "{\"items\":")
const jsonLeak = /&quot;items&quot;|&quot;rows&quot;|&quot;cells&quot;|"items":|"cells":/.test(
  documentXml
);
const tablePlaceholder = /Table placeholder/.test(documentXml);
const kpiPlaceholder = /\[Table placeholder/.test(documentXml);
const chartPlaceholder = /chart placeholder/.test(documentXml);

// Probe per-block-type presence by sampling expected text from content into DOCX text runs.
function docxText(): string {
  return (documentXml.match(/<w:t[ >][^<]*/g) ?? []).map((m) => m.replace(/<w:t[ >]/, '')).join(' ');
}
const dt = docxText();

console.log('\n=== DOCX parse ===');
console.log(`  <w:tbl> tables       : ${tableCount}`);
console.log(`  <w:drawing> embeds   : ${drawingCount}`);
console.log(`  cell shading <w:shd> : ${hasShading}`);
console.log(`  raw-JSON leak        : ${jsonLeak ? 'YES (BAD)' : 'no'}`);
console.log(`  "[Table placeholder" : ${kpiPlaceholder ? 'YES' : 'no'}`);
console.log(`  "chart placeholder"  : ${chartPlaceholder ? 'YES (charts not embedded)' : 'no'}`);

// ── parse PDF ───────────────────────────────────────────────────────────────
const pdfRaw = readFileSync(pdfPath);
const pdfStr = pdfRaw.toString('latin1');
const pdfPages = (pdfStr.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
const pdfImages = (pdfStr.match(/\/Subtype\s*\/Image/g) ?? []).length;
console.log('\n=== PDF parse ===');
console.log(`  bytes   : ${pdfRaw.length}`);
console.log(`  pages   : ${pdfPages}`);
console.log(`  images  : ${pdfImages}`);

// ── per-block-type fidelity table ───────────────────────────────────────────
function present(needle: string): boolean {
  return dt.includes(needle);
}
function firstKpiLabel(): string | null {
  for (const s of content.sections as any[])
    for (const b of s.blocks)
      if (b.type === 'kpi' && Array.isArray(b.content?.items) && b.content.items[0])
        return String(b.content.items[0].label ?? '');
  return null;
}
function firstTableCell(): string | null {
  for (const s of content.sections as any[])
    for (const b of s.blocks)
      if (b.type === 'table' && Array.isArray(b.content?.rows) && b.content.rows[0]) {
        const cells = b.content.rows[0].cells ?? {};
        const k = Object.keys(cells)[0];
        if (k) return String(cells[k]?.value ?? cells[k] ?? '');
      }
  return null;
}
function firstCalloutText(): string | null {
  for (const s of content.sections as any[])
    for (const b of s.blocks)
      if (b.type === 'callout' && b.content?.text) return String(b.content.text);
  return null;
}
function firstBulletItem(): string | null {
  for (const s of content.sections as any[])
    for (const b of s.blocks)
      if ((b.type === 'bulletList' || b.type === 'numberedList') && Array.isArray(b.content?.items))
        return String(b.content.items[0] ?? '');
  return null;
}

const kpiLabel = firstKpiLabel();
const tableCell = firstTableCell();
const calloutText = firstCalloutText();
const bulletItem = firstBulletItem();

console.log('\n=== per-block-type DOCX fidelity ===');
const rows: Array<[string, string]> = [];
rows.push(['heading', present(schema.sections[0].title.slice(0, 20)) ? '✓ text run' : 'gap']);
rows.push([
  'kpi_strip',
  kpiLabel
    ? present(kpiLabel.slice(0, 16))
      ? `✓ "${kpiLabel.slice(0, 24)}" present`
      : `GAP — label "${kpiLabel.slice(0, 24)}" missing`
    : 'n/a (no kpi block produced)',
]);
rows.push([
  'table/risk_table',
  tableCell
    ? present(tableCell.slice(0, 16))
      ? `✓ cell "${tableCell.slice(0, 20)}" present; tbl=${tableCount}; shd=${hasShading}`
      : `GAP — cell "${tableCell.slice(0, 20)}" missing`
    : `tbl=${tableCount}`,
]);
rows.push([
  'callout',
  calloutText
    ? present(calloutText.slice(0, 16))
      ? `✓ "${calloutText.slice(0, 20)}…" present`
      : `GAP — text "${calloutText.slice(0, 20)}" missing`
    : 'n/a',
]);
rows.push([
  'bullet/numbered',
  bulletItem
    ? present(bulletItem.slice(0, 16))
      ? `✓ "${bulletItem.slice(0, 20)}…" present`
      : `GAP — item "${bulletItem.slice(0, 20)}" missing`
    : 'n/a',
]);
rows.push(['chart', drawingCount > 0 ? `✓ embedded (${drawingCount} drawing)` : 'placeholder (canvas dep missing?)']);
for (const [k, v] of rows) console.log(`  ${k.padEnd(18)} ${v}`);

console.log('\nDONE.');
