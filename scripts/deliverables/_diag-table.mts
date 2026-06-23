/**
 * _diag-table — B4 TABLE generator diagnostic probe (plain-node tsx).
 *
 * Mirrors live-pilot-ft6 prod-safe isolation, but TABLE-only + verbose:
 *   - per-scenario scorePct + PASS/FAIL
 *   - each failure: criterion [expected vs got]
 *   - per-row field-completeness (every seed row must fill every field key)
 *   - field type breakdown + CF + formulas presence
 *
 * RUN:
 *   export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv 2>/dev/null | grep -E '^ANTHROPIC_API_KEY=' | head -1 | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
 *   node --import tsx scripts/deliverables/_diag-table.mts            # default S01,S06,S16 + S07(Med)
 *   node --import tsx scripts/deliverables/_diag-table.mts S01 S20    # specific scenarios
 */
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';
process.env.ENABLE_DELIVERABLES_PREMIUM = 'true';
process.env.DATABASE_URL = 'postgresql://x:x@trolley.proxy.rlwy.net:28146/railway?sslmode=disable';

const CFG = { id: 'claude-sonnet-4-6', model_id: 'claude-sonnet-4-6', provider: 'anthropic', tier: 'PREMIUM' };

const lc = await import('../../server/src/services/ai/llmConfigService.js');
(lc.llmConfigService as any).getNextFallback = async () => ({ ...CFG });
(lc.llmConfigService as any).getProviderConfig = async () => null;
const r = await import('../../server/src/services/ai/modelRouter.js');
(r.default as any).select = async () => ({ ...CFG });
const breakerMod = await import('../../server/src/services/ai/circuitBreaker.js');
const resetBreaker = async () => { try { await (breakerMod.default as any).reset('anthropic'); } catch {} };

const { TABLE_SCENARIOS } = await import('../../tests/integration/deliverables/catalog/tables.js');
const { scoreTable } = await import('../../tests/integration/deliverables/scoring/tableScoring.js');
const { generateTableSchema } = await import('../../server/src/services/tableSchemaGeneratorService.js');

// Which scenarios? CLI args (S01, M20.S06, ...) or default sample.
const args = process.argv.slice(2).map((a) => a.toUpperCase());
const wanted = args.length
  ? args.map((a) => (a.startsWith('M20.') ? a : `M20.${a}`))
  : ['M20.S01', 'M20.S06', 'M20.S16', 'M20.S07'];

const scenarios = wanted
  .map((id) => TABLE_SCENARIOS.find((e: any) => e.meta.id === id))
  .filter(Boolean);

if (!scenarios.length) {
  console.error('No matching scenarios for', wanted.join(', '));
  process.exit(1);
}

console.log(`\n=== B4 TABLE diag — ${scenarios.length} scenario(s) on Sonnet 4.6 ===\n`);

const summary: any[] = [];

for (const e of scenarios as any[]) {
  await resetBreaker();
  const id = e.meta.id;
  const t0 = Date.now();
  try {
    const schema: any = await generateTableSchema(e.meta.intent, { orgId: 'org-diag-table', preferPremium: true });
    const dt = ((Date.now() - t0) / 1000).toFixed(0);
    const rep = scoreTable(
      { fields: schema.fields, seedRows: schema.seedRows, conditionalFormatting: schema.conditionalFormatting, hasFormulas: schema.hasFormulas, sheets: schema.sheets },
      e.criteria
    );

    // Per-row completeness: every seed row must hold every field key (non-empty).
    const fieldKeys: string[] = schema.fields.map((f: any) => f.key);
    const rowCompleteness = (schema.seedRows ?? []).map((row: any, i: number) => {
      const missing = fieldKeys.filter((k) => row[k] === undefined || row[k] === null || row[k] === '');
      return { i, missing };
    });
    const incompleteRows = rowCompleteness.filter((x: any) => x.missing.length > 0);

    console.log(`──────── ${id} "${e.meta.title}" ────────`);
    console.log(`intent: ${e.meta.intent}`);
    console.log(`tier=${schema.tierUsed} fb=${schema.fallbackUsed} | ${dt}s | SCORE ${rep.scorePct}% ${rep.passed ? 'PASS' : 'FAIL'}`);
    console.log(`fields (${schema.fields.length}): ${schema.fields.map((f: any) => `${f.header}:${f.type}${f.options ? `[${f.options.map((o: any) => o.label).join('/')}]` : ''}`).join(', ')}`);
    console.log(`seedRows: ${schema.seedRows?.length ?? 0} | CF: ${(schema.conditionalFormatting ?? []).length} blocks [${(schema.conditionalFormatting ?? []).flatMap((b: any) => b.rules.map((r: any) => r.type)).join(',')}] | hasFormulas: ${!!schema.hasFormulas}${schema.sheets ? ` | sheets: ${schema.sheets.length} [${schema.sheets.map((s: any) => s.name).join(', ')}]` : ''}`);
    if (incompleteRows.length) {
      console.log(`⚠ INCOMPLETE ROWS (${incompleteRows.length}/${schema.seedRows.length}):`);
      for (const x of incompleteRows) console.log(`    row[${x.i}] missing: ${x.missing.join(', ')}`);
    } else {
      console.log(`✓ all ${schema.seedRows?.length ?? 0} rows fill all ${fieldKeys.length} field keys`);
    }
    if (rep.failures.length) {
      console.log(`FAILURES (${rep.failures.length}):`);
      for (const f of rep.failures) console.log(`    ✗ [${f.category}] ${f.criterion}: expected ${f.expected}, got ${f.got}`);
    }
    console.log('');

    summary.push({ id, score: rep.scorePct, passed: rep.passed, fails: rep.failures.length, incomplete: incompleteRows.length, sec: dt });
  } catch (err: any) {
    console.log(`──────── ${id} ERROR: ${err?.message} ────────\n`);
    summary.push({ id, score: 0, passed: false, error: err?.message });
  }
}

console.log('=== SUMMARY ===');
for (const s of summary) {
  console.log(`${s.id}: ${s.score}% ${s.passed ? 'PASS' : 'FAIL'}${s.fails ? ` (${s.fails} fails)` : ''}${s.incomplete ? ` [${s.incomplete} incomplete rows]` : ''}${s.error ? ` ERR=${s.error}` : ''}`);
}
const avg = Math.round(summary.reduce((a, s) => a + (s.score || 0), 0) / summary.length);
console.log(`AVG: ${avg}%`);
process.exit(0);
