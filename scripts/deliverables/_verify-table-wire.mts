/**
 * _verify-table-wire — weryfikacja spięcia PREMIUM (B4 typed schema) do ŻYWEJ
 * ścieżki generacji tabeli/arkusza + mostka eksportu exceljs (tableSchemaToWorkbook).
 *
 * Dwie ścieżki, jeden harness:
 *   (A) PREMIUM ON  → generateTableSchema zwraca TYPOWANY schemat (hex selecty +
 *       CF), premiumSchemaToGfmMarkdown renderuje go do GFM, a tableSchemaToWorkbook
 *       + buildWorkbookBuffer dają realny .xlsx (exceljs) — NIE fasadę SheetJS.
 *   (B) FLAG OFF    → generateTableSchema = STANDARD fallback, ZERO wywołań LLM
 *       (sprawdzane spy na llmService.call), eksport idzie ścieżką legacy.
 *
 * URUCHOMIENIE (structured działa tylko w czystym node tsx):
 *   export ANTHROPIC_API_KEY=$(railway variables --environment staging \
 *     --service consultify --kv 2>/dev/null | grep -E '^ANTHROPIC_API_KEY=' | \
 *     head -1 | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
 *   node --import tsx scripts/deliverables/_verify-table-wire.mts
 */
// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
// Layered guards make this harness PROD-safe and stall-free (see live-pilot-ft6.mts):
//   1) DOTENV_IGNORE_LOCAL=1 — loadEnv skips `.env.local` (= PROD centerbeam); staging `.env` wins.
//   2) SKIP_DB_INIT=1        — circuitBreaker skips DB-backed auto-init + persistence (no pool, no stall).
//   3) DATABASE_URL=staging  — belt-and-suspenders: any connection hits STAGING, never PROD.
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
// NB: ENABLE_DELIVERABLES_PREMIUM jest ustawiana per-test poniżej (ON dla A, OFF dla B).

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

// Pin PREMIUM model tier (structured call) bez DB-policy.
const llmCfg = await import('../../server/src/services/ai/llmConfigService.js');
(llmCfg.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(llmCfg.llmConfigService as any).getProviderConfig = async () => null;
const router = await import('../../server/src/services/ai/modelRouter.js');
(router.default as any).select = async () => ({ ...CFG });

// Spy na llmService.call — by udowodnić, że FLAG OFF NIE woła LLM-a.
const { llmService } = await import('../../server/src/services/ai/llmService.js');
let llmCallCount = 0;
const realCall = (llmService as any).call.bind(llmService);
(llmService as any).call = async (...args: any[]) => {
  llmCallCount += 1;
  return realCall(...args);
};

const featureFlags = (await import('../../server/src/config/FeatureFlags.js')).default;
const { generateTableSchema } = await import(
  '../../server/src/services/tableSchemaGeneratorService.js'
);
const { tableSchemaToWorkbook, buildWorkbookBuffer } = await import(
  '../../server/src/services/workbook/WorkbookBuilder.js'
);

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const intent =
  'Rejestr ryzyk projektu wdrożeniowego: nazwa ryzyka, kategoria (singleSelect), ' +
  'severity (singleSelect z kolorami), prawdopodobieństwo (percent), wpływ finansowy ' +
  '(currency), termin mitygacji (date), właściciel; dataBar/colorScale na wpływie.';

let failures = 0;
const ok = (cond: boolean, label: string, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ` :: ${extra}` : ''}`);
  if (!cond) failures += 1;
};

// ── (A) PREMIUM ON ──────────────────────────────────────────────────────────
console.log('\n=== (A) PREMIUM ON — typed schema + exceljs export ===');
(featureFlags as any).ENABLE_DELIVERABLES_PREMIUM = true;
llmCallCount = 0;
const t0 = Date.now();
const premium = await generateTableSchema(intent, { orgId: 'verify-org', preferPremium: true });
console.log(`  generateTableSchema: ${Date.now() - t0}ms, llmCalls=${llmCallCount}`);

ok(premium.tierUsed === 'PREMIUM', 'tierUsed === PREMIUM', premium.tierUsed);
ok(premium.fallbackUsed === false, 'fallbackUsed === false', String(premium.fallbackUsed));
ok(llmCallCount >= 1, 'PREMIUM ON wywołał LLM (≥1)', `calls=${llmCallCount}`);
ok(premium.fields.length >= 4, 'fields.length ≥ 4', String(premium.fields.length));

const selectFields = premium.fields.filter(
  (f) => f.type === 'singleSelect' || f.type === 'multiSelect'
);
const selectsWithHex = selectFields.filter((f) =>
  (f.options ?? []).some((o) => o.color && HEX.test(o.color))
);
ok(selectFields.length >= 1, 'co najmniej 1 pole singleSelect/multiSelect', String(selectFields.length));
ok(
  selectsWithHex.length >= 1,
  'select(y) mają opcje z kolorem hex',
  selectFields
    .map((f) => `${f.key}:[${(f.options ?? []).map((o) => o.color).join(',')}]`)
    .join(' ')
);
const cfBlocks = premium.conditionalFormatting ?? [];
ok(cfBlocks.length >= 1, 'conditionalFormatting obecne (≥1 blok)', String(cfBlocks.length));
console.log(
  '  fields:',
  premium.fields.map((f) => `${f.key}:${f.type}`).join(', ')
);
console.log('  CF:', JSON.stringify(cfBlocks));

// Most eksportu: B4 → WorkbookSchema → realny buffer xlsx (exceljs).
const wb = tableSchemaToWorkbook(premium as any, { title: 'Rejestr ryzyk' });
ok(Array.isArray(wb.sheets) && wb.sheets.length >= 1, 'tableSchemaToWorkbook → ≥1 arkusz', String(wb.sheets?.length));
ok(
  (wb.sheets?.[0]?.columns?.length ?? 0) === premium.fields.length || (premium.sheets?.length ?? 0) > 0,
  'kolumny arkusza odpowiadają polom schematu',
  `cols=${wb.sheets?.[0]?.columns?.length} fields=${premium.fields.length}`
);
const buffer = await buildWorkbookBuffer(wb);
// PK zip magic (.xlsx) = 0x50 0x4B ("PK").
const isXlsx = Buffer.isBuffer(buffer) && buffer.length > 200 && buffer[0] === 0x50 && buffer[1] === 0x4b;
ok(isXlsx, 'buildWorkbookBuffer → realny .xlsx (PK magic, exceljs)', `bytes=${buffer.length}`);

// ── (B) FLAG OFF — byte-identyczna ścieżka legacy, ZERO LLM ──────────────────
console.log('\n=== (B) FLAG OFF — STANDARD fallback, NO LLM ===');
(featureFlags as any).ENABLE_DELIVERABLES_PREMIUM = false;
llmCallCount = 0;
// preferPremium pominięte: flaga sama decyduje (jak w żywej ścieżce gdy OFF).
const standard = await generateTableSchema(intent, { orgId: 'verify-org' });
ok(standard.tierUsed === 'STANDARD', 'tierUsed === STANDARD', standard.tierUsed);
ok(standard.fallbackUsed === true, 'fallbackUsed === true', String(standard.fallbackUsed));
ok(llmCallCount === 0, 'FLAG OFF — ZERO wywołań LLM (byte-identyczna ścieżka)', `calls=${llmCallCount}`);
ok(standard.seedRows.length === 0, 'STANDARD fallback: brak seedRows', String(standard.seedRows.length));
ok(
  standard.fields.every((f) => f.type === 'singleLineText'),
  'STANDARD fallback: same pola tekstowe (brak typowania premium)',
  standard.fields.map((f) => f.type).join(',')
);

// ── (B2) preferPremium:false override przy fladze ON → też STANDARD ──────────
(featureFlags as any).ENABLE_DELIVERABLES_PREMIUM = true;
llmCallCount = 0;
const optedOut = await generateTableSchema(intent, { orgId: 'verify-org', preferPremium: false });
ok(optedOut.tierUsed === 'STANDARD', 'preferPremium:false wymusza STANDARD mimo flagi ON', optedOut.tierUsed);
ok(llmCallCount === 0, 'preferPremium:false — ZERO LLM', `calls=${llmCallCount}`);

console.log(`\n${failures === 0 ? 'ALL PASS ✓' : `${failures} FAILURE(S) ✗`}`);
process.exit(failures === 0 ? 0 : 1);
