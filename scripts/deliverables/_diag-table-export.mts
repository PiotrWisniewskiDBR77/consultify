/**
 * _diag-table-export — XLSX FIDELITY probe for the premium TABLE path (B4 → X2).
 *
 * Generates a PREMIUM table schema on a real Sonnet (key from Railway staging),
 * maps it to a WorkbookSchema via `tableSchemaToWorkbook`, materializes the
 * .xlsx via `buildWorkbookBuffer`, then UNZIPS the .xlsx and parses
 * `xl/worksheets/*.xml` + `xl/styles.xml` to PROVE — evidence-grade, NOT just
 * "we called the exceljs API" — that the real file contains:
 *   • typed columns (numFmt: currency/percent/date in styles.xml)
 *   • singleSelect hex → solid cell FILL (option color present in styles.xml)
 *   • <conditionalFormatting> (dataBar/colorScale/iconSet/cellIs) in sheet XML
 *   • ALL seed rows materialized (row count in sheetData == seedRows + header)
 *   • multi-sheet (one xl/worksheets/sheetN.xml per table sheet)
 *
 * RUN:
 *   export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv 2>/dev/null | grep -E '^ANTHROPIC_API_KEY=' | head -1 | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
 *   node --import tsx scripts/deliverables/_diag-table-export.mts            # S16 (CF) + S26 (multi-sheet)
 *   node --import tsx scripts/deliverables/_diag-table-export.mts S16        # one scenario
 *
 * GOTCHA: structured LLM calls only work under plain-node tsx (not vitest).
 */
// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
//   1) DOTENV_IGNORE_LOCAL=1 — loadEnv skips `.env.local` (= PROD centerbeam).
//   2) SKIP_DB_INIT=1        — no DB pool / no persistence / no stall.
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

const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };

const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });
const breakerMod = await import('../../server/src/services/ai/circuitBreaker.js');
const resetBreaker = async () => { try { await (breakerMod.default as any).reset('anthropic'); } catch { /* noop */ } };

const { writeFileSync } = await import('node:fs');
const JSZip = (await import('jszip')).default;

const { generateTableSchema } = await import('../../server/src/services/tableSchemaGeneratorService.js');
const { tableSchemaToWorkbook, buildWorkbookBuffer } = await import(
  '../../server/src/services/workbook/WorkbookBuilder.js'
);

// ── Scenarios — CF-heavy portfolio (S16) + multi-sheet workbook (S26) ───────
const SCENARIOS: Record<string, { title: string; intent: string }> = {
  S16: {
    title: 'Portfolio Tracker (CF)',
    intent:
      'Portfolio 12 projektów (Airtable-grade): name, owner, status (singleSelect On Track/At Risk/Off Track), ' +
      'phase (singleSelect), start_date, end_date, budget (currency), actual (currency), progress (percent) — ' +
      'progress jako dataBar, variance (percent) jako colorScale. Kolorowe opcje hex dla statusu.',
  },
  S26: {
    title: 'Annual Budget Workbook',
    intent:
      'Roczny budżet jako workbook z 4 arkuszami: Summary (roll-up), OpEx, CapEx, Headcount. ' +
      'Każdy arkusz typowany (currency dla kwot, percent dla udziałów, date dla terminów, singleSelect ' +
      'z kolorami dla kategorii/statusu). Formuły sum w arkuszach i cross-sheet w Summary.',
  },
};

const args = process.argv.slice(2).map((a) => a.toUpperCase());
const wanted = args.length ? args : ['S16', 'S26'];

// ── XML assertion helpers ───────────────────────────────────────────────────
function hexToArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}
const ok = (b: boolean) => (b ? '✓' : '✗');

async function parseXlsx(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const sheetNames = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort();
  const sheets: string[] = [];
  for (const n of sheetNames) sheets.push(await zip.file(n)!.async('string'));
  const styles = await zip.file('xl/styles.xml')!.async('string');
  return { sheets, styles };
}

function countDataRows(sheetXml: string): number {
  // <sheetData><row r="1">...  rows present; subtract header (r=1).
  const rows = (sheetXml.match(/<row\b[^>]*\br="(\d+)"/g) ?? []).length;
  return Math.max(0, rows - 1);
}

let allPass = true;

for (const id of wanted) {
  const sc = SCENARIOS[id];
  if (!sc) { console.log(`(skip unknown scenario ${id})`); continue; }

  await resetBreaker();
  console.log(`\n════════ ${id} — ${sc.title} ════════`);
  console.log(`intent: ${sc.intent}\n`);

  const t0 = Date.now();
  const table: any = await generateTableSchema(sc.intent, { orgId: 'org-diag-xlsx', preferPremium: true });
  const genSec = ((Date.now() - t0) / 1000).toFixed(0);

  if (table.fallbackUsed || table.tierUsed !== 'PREMIUM') {
    console.log(`✗ FELL BACK to STANDARD (tier=${table.tierUsed}, fb=${table.fallbackUsed}) — premium key/flag issue. Aborting scenario.`);
    allPass = false;
    continue;
  }

  // ── Map B4 → WorkbookSchema (the bridge under test) ──
  const wbSchema = tableSchemaToWorkbook(table, { title: sc.title, author: 'diag' });
  const buf = await buildWorkbookBuffer(wbSchema);
  const outPath = `/tmp/diag-table-${id}.xlsx`;
  writeFileSync(outPath, buf);

  const { sheets, styles } = await parseXlsx(buf);
  const allSheetXml = sheets.join('\n');

  // ── Gather expectations from the source schema ──
  const srcSheets: any[] = table.sheets?.length
    ? table.sheets
    : [{ name: 'Sheet1', fields: table.fields, seedRows: table.seedRows, conditionalFormatting: table.conditionalFormatting }];

  const allFields: any[] = srcSheets.flatMap((s) => s.fields);
  const selectColors: string[] = allFields
    .filter((f) => (f.type === 'singleSelect' || f.type === 'multiSelect') && f.options?.length)
    .flatMap((f) => f.options.map((o: any) => o.color))
    .filter(Boolean);
  const typeKinds = new Set(allFields.map((f) => f.type));
  const allCf: any[] = srcSheets.flatMap((s) => s.conditionalFormatting ?? []);
  const cfRuleTypes = new Set(allCf.flatMap((b) => b.rules.map((r: any) => r.type)));

  console.log(`tier=${table.tierUsed} | ${genSec}s | sheets(src)=${srcSheets.length} | fields=${allFields.length} | wrote ${buf.length}B → ${outPath}`);
  console.log(`field types: ${[...typeKinds].join(', ')}`);
  console.log(`CF rule types: ${[...cfRuleTypes].join(', ') || '(none)'}\n`);

  // ── ASSERTIONS (parse the real .xlsx) ──
  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

  // 1. Multi-sheet: one worksheet XML per source sheet.
  checks.push({
    name: 'multi-sheet',
    pass: sheets.length === srcSheets.length,
    detail: `xl/worksheets count ${sheets.length} == src sheets ${srcSheets.length}`,
  });

  // 2. All seed rows materialized (per sheet: data rows == seedRows length).
  let rowsOk = true;
  const rowDetails: string[] = [];
  srcSheets.forEach((s, i) => {
    const got = countDataRows(sheets[i] ?? '');
    const exp = s.seedRows.length;
    if (got !== exp) rowsOk = false;
    rowDetails.push(`sheet${i + 1}:${got}/${exp}`);
  });
  checks.push({ name: 'all seed rows present', pass: rowsOk, detail: rowDetails.join(' ') });

  // 3. numFmt — currency / percent / date types must reach the cell style.
  //    NOTE: ExcelJS maps well-known formats to Excel BUILT-IN numFmtIds (which
  //    carry NO formatCode string in styles.xml — Excel knows ids 0-163
  //    intrinsically) and only emits a custom <numFmt formatCode="..."> for
  //    ids >= 164. So "#,##0.00" → built-in id 4, "0.00%" → built-in id 10,
  //    "YYYY-MM-DD" → custom id (>=164). We assert the style record exists with
  //    applyNumberFormat + the expected numFmtId, NOT a literal formatCode.
  //    cellXfs xf indices are referenced by each cell's s="N" attribute.
  const cellXfs = (styles.match(/<cellXfs[\s\S]*?<\/cellXfs>/) ?? [''])[0];
  const customNumFmtIds = new Set(
    [...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)].map((m) => [m[1], m[2]] as const)
  );
  const hasBuiltinFmt = (id: string) =>
    new RegExp(`numFmtId="${id}"[^>]*applyNumberFormat="1"`).test(cellXfs);
  const hasCustomFmt = (code: string) =>
    [...customNumFmtIds].some(([, c]) => c === code);

  const expectFmt: Array<[string, string, string]> = []; // [kind, builtinId, customCode]
  if (typeKinds.has('currency')) expectFmt.push(['currency', '4', '#,##0.00']);
  if (typeKinds.has('percent')) expectFmt.push(['percent', '10', '0.00%']);
  if (typeKinds.has('date')) expectFmt.push(['date', '14', 'YYYY-MM-DD']);
  for (const [kind, builtinId, code] of expectFmt) {
    const viaBuiltin = hasBuiltinFmt(builtinId);
    const viaCustom = hasCustomFmt(code);
    const present = viaBuiltin || viaCustom;
    checks.push({
      name: `numFmt ${kind}`,
      pass: present,
      detail: present
        ? viaBuiltin
          ? `built-in numFmtId=${builtinId} (applyNumberFormat)`
          : `custom formatCode "${code}"`
        : `MISSING (no builtin id=${builtinId}, no formatCode "${code}")`,
    });
  }

  // 4. singleSelect hex → solid cell fill present in styles.xml.
  if (selectColors.length > 0) {
    const sample = [...new Set(selectColors)].slice(0, 4);
    const found = sample.filter((c) => styles.toUpperCase().includes(hexToArgb(c)));
    checks.push({
      name: 'select hex → cell fill',
      pass: found.length > 0,
      detail: `${found.length}/${sample.length} option colors in styles.xml (${found.map(hexToArgb).join(',') || 'NONE'})`,
    });
  }

  // 5. <conditionalFormatting> present per CF rule type.
  if (cfRuleTypes.size > 0) {
    const cfBlockPresent = allSheetXml.includes('conditionalFormatting') || allSheetXml.includes('x14:conditionalFormatting');
    checks.push({ name: '<conditionalFormatting> block', pass: cfBlockPresent, detail: cfBlockPresent ? 'present' : 'MISSING' });
    for (const rt of cfRuleTypes) {
      const marker = rt.toLowerCase();
      // iconSet may live in x14 extLst; match keyword loosely.
      const present = allSheetXml.toLowerCase().includes(marker) || (rt === 'iconSet' && allSheetXml.includes('3TrafficLights'));
      checks.push({ name: `CF rule "${rt}" in sheet XML`, pass: present, detail: present ? 'serialized' : 'MISSING' });
    }
    // colorScale gradient colors should be in the CF block.
    const csColors = allCf.flatMap((b) => b.rules).filter((r: any) => r.type === 'colorScale').flatMap((r: any) => r.colors ?? []);
    if (csColors.length) {
      const sample = [...new Set(csColors)].slice(0, 3) as string[];
      const found = sample.filter((c) => allSheetXml.toUpperCase().includes(hexToArgb(c)));
      checks.push({ name: 'colorScale gradient colors', pass: found.length > 0, detail: `${found.length}/${sample.length} in CF block` });
    }
  }

  // 6. Formulas materialized as <f> when hasFormulas.
  if (table.hasFormulas) {
    const hasF = /<f>/.test(allSheetXml) || /<f /.test(allSheetXml);
    checks.push({ name: 'formulas → <f> in XML', pass: hasF, detail: hasF ? 'present' : 'MISSING' });
  }

  console.log('FIDELITY CHECKS:');
  for (const c of checks) {
    console.log(`  ${ok(c.pass)} ${c.name} — ${c.detail}`);
    if (!c.pass) allPass = false;
  }
}

console.log(`\n=== ${allPass ? 'ALL FIDELITY CHECKS PASS' : 'GAPS DETECTED — see ✗ above'} ===`);
process.exit(allPass ? 0 : 1);
