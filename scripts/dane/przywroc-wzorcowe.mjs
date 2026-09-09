/**
 * PRZYWRÓCENIE WIERSZY WZORCOWYCH po czystce sierot (09.09.2026).
 *
 * POWÓD: `--sieroty-apply` uznaje za sierotę każdy wiersz, którego `organization_id`
 * nie występuje w `organizations`. Wartości WZORCOWE ('*', '__system__', '__global__', '')
 * z definicji tam nie występują — to konfiguracja produktu, nie dane najemcy. Skasowanie
 * wiersza `ie_governance_policies ('*','PRODUCT','DEFAULT')` wywracało KAŻDĄ próbę
 * utworzenia inicjatywy (HTTP 500 `INITIATIVES_EXECUTION_RUNTIME_FAILED`).
 *
 * Skrypt czyta manifest sierot i wstawia z powrotem WYŁĄCZNIE wiersze o wartościach
 * wzorcowych (bez fikstur testowych `org-*`). Kolumny generowane pomijane.
 *
 * Użycie:
 *   DATABASE_URL=… node scripts/dane/przywroc-wzorcowe.mjs <manifest.json> [--apply]
 */
import fs from 'node:fs';
import pg from 'pg';

const WZORCOWE = new Set(['*', '__system__', '__global__', '']);
const [, , sciezka, ...flagi] = process.argv;
const apply = flagi.includes('--apply');
if (!sciezka) throw new Error('Podaj ścieżkę do manifestu.');
if (!process.env.DATABASE_URL) throw new Error('Brak DATABASE_URL.');
if (/centerbeam/i.test(process.env.DATABASE_URL)) throw new Error('PRODUKCJA — STOP.');

const manifest = JSON.parse(fs.readFileSync(sciezka, 'utf8'));
const wiersze = manifest.wiersze ?? {};
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, keepAlive: true });
const c = await pool.connect();
const qi = (s) => `"${String(s).replace(/"/g, '""')}"`;
let planowane = 0,
  wstawione = 0;
const raport = [];
try {
  await c.query('BEGIN');
  for (const [tabela, rows] of Object.entries(wiersze)) {
    const doWstawienia = rows.filter((r) =>
      ['organization_id', 'org_id'].some((k) => k in r && WZORCOWE.has(r[k]))
    );
    if (!doWstawienia.length) continue;
    planowane += doWstawienia.length;
    const zapisywalne = new Set(
      (
        await c.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'`,
          [tabela]
        )
      ).rows.map((x) => x.column_name)
    );
    let n = 0;
    for (const r of doWstawienia) {
      const kol = Object.keys(r).filter((k) => zapisywalne.has(k));
      const val = kol.map((k) => (r[k] !== null && typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]));
      const res = await c.query(
        `INSERT INTO ${qi(tabela)} (${kol.map(qi).join(',')})
         VALUES (${kol.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT DO NOTHING`,
        val
      );
      n += res.rowCount ?? 0;
    }
    wstawione += n;
    raport.push(`  ${tabela}: ${n}/${doWstawienia.length}`);
  }
  if (apply) await c.query('COMMIT');
  else await c.query('ROLLBACK');
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  c.release();
  await pool.end();
}
console.log(raport.join('\n'));
console.log(`[wzorcowe] ${apply ? 'APPLY' : 'DRY-RUN'}: wstawiono ${wstawione} z ${planowane} wierszy wzorcowych.`);
