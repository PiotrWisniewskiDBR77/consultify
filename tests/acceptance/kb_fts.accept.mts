/**
 * RED-I W6 acceptance — Knowledge Base full-text search on Postgres.
 *
 * Proves "działa dla klienta", not "testy przeszły":
 *  1. Seed a KB article + translation carrying a distinctive phrase.
 *  2. Call the REAL KnowledgeBaseService.searchArticlesFTS against the LOCAL
 *     Postgres (parity :5443) — assert it reports available:true (FTS path ran,
 *     NOT the LIKE fallback) and returns the seeded article id.
 *  3. Call the public searchArticles(phrase) — assert the doc comes back.
 *  4. Assert the process logged NO 42703 and NO "falling back to LIKE".
 *  5. Clean up the seeded rows.
 *
 * Run with the standard parity env, e.g.:
 *   DATABASE_URL=postgres://consultinity:consultinity@localhost:5443/consultinity \
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true \
 *   JWT_SECRET=development_secret_key_change_in_production_abc123xyz \
 *   node_modules/.bin/tsx tests/acceptance/kb_fts.accept.mts
 */
import pg from 'pg';

// Capture logger output BEFORE importing the service so we see every message.
import logger from '../../server/src/utils/Logger.js';
const captured: string[] = [];
for (const level of ['warn', 'error', 'debug', 'info'] as const) {
  const orig = (logger as any)[level]?.bind(logger);
  (logger as any)[level] = (msg: any, ...meta: any[]) => {
    captured.push(`${level}: ${String(msg)} ${meta.map((m) => (m instanceof Error ? m.message : JSON.stringify(m))).join(' ')}`);
    return orig ? orig(msg, ...meta) : undefined;
  };
}

const kbSvc = (await import('../../server/src/services/KnowledgeBaseService.js')).default as any;

const url = process.env.DATABASE_URL;
if (!url || !/postgres/.test(url)) throw new Error(`Need a Postgres DATABASE_URL, got: ${url}`);

const PHRASE = 'kwantowa termodynamika grafenowa';
const ARTICLE_ID = `red-kbfts-probe-${Date.now()}`;
const TR_ID = `${ARTICLE_ID}-pl`;

function fail(msg: string): never {
  console.error(`\n❌ FAIL: ${msg}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

let ok = false;
try {
  // Pick an existing category to satisfy the JOIN in searchArticles.
  const cat = await client.query('SELECT id FROM kb_categories LIMIT 1');
  if (cat.rows.length === 0) fail('no kb_categories to attach the probe article to');
  const categoryId = cat.rows[0].id;

  // 1) SEED — published article + PL translation carrying the phrase in content.
  await client.query(
    `INSERT INTO kb_articles (id, category_id, slug, status, is_public, visibility)
     VALUES ($1, $2, $3, 'published', 1, 'public')`,
    [ARTICLE_ID, categoryId, ARTICLE_ID]
  );
  await client.query(
    `INSERT INTO kb_article_translations (id, article_id, language, title, summary, content)
     VALUES ($1, $2, 'pl', $3, $4, $5)`,
    [TR_ID, ARTICLE_ID, 'Artykuł sondujący FTS', 'Streszczenie sondy', `Treść zawierająca frazę ${PHRASE} do wyszukania.`]
  );

  // 2) FTS path — the private method. available:true means FTS ran (not LIKE fallback).
  const fts = await kbSvc.searchArticlesFTS(PHRASE, 'pl', 20);
  console.log('searchArticlesFTS →', JSON.stringify(fts));
  if (!fts.available) fail('searchArticlesFTS reported available:false — FTS still disabled on Postgres (LIKE fallback)');
  if (!fts.ids.includes(ARTICLE_ID)) fail(`FTS did not return the seeded article. ids=${JSON.stringify(fts.ids)}`);
  console.log('✓ FTS path active on Postgres and returned the seeded article');

  // 3) Public API — end-to-end search returns the doc.
  const results = await kbSvc.searchArticles(PHRASE, 'pl', 10);
  const found = results.find((r: any) => String(r.id) === ARTICLE_ID);
  if (!found) fail(`searchArticles did not return the seeded doc. got=${JSON.stringify(results.map((r: any) => r.id))}`);
  console.log(`✓ searchArticles returned the seeded doc (title="${found.title}")`);

  // 4) No silent Postgres errors.
  const bad = captured.filter((l) => /42703|falling back to LIKE|FTS query failed/i.test(l));
  if (bad.length > 0) fail(`log shows FTS degradation:\n  ${bad.join('\n  ')}`);
  console.log('✓ no 42703 / no "falling back to LIKE" in logs');

  // 5) Negative control — a phrase that appears NOWHERE must not match.
  const empty = await kbSvc.searchArticlesFTS('zzxqwv nonexistentterm', 'pl', 20);
  if (empty.available && empty.ids.includes(ARTICLE_ID)) fail('FTS matched an unrelated query — ranking broken');
  console.log('✓ negative control: unrelated query does not match');

  ok = true;
} finally {
  // 6) CLEANUP — leave zero test rows (dane demo = twarz produktu).
  await client.query('DELETE FROM kb_article_translations WHERE article_id = $1', [ARTICLE_ID]);
  await client.query('DELETE FROM kb_articles WHERE id = $1', [ARTICLE_ID]);
  await client.end();
}

if (ok) console.log('\n✅ PASS — KB full-text search works on Postgres (FTS, not LIKE).');
process.exit(ok ? 0 : 1);
