#!/usr/bin/env node
/**
 * check-artefakt-struktura.mjs — BRAMKA STRUKTURALNA kart N (SPEC-A / SPEC-N).
 *
 * Powód (audyt 2026-07-22, `_AUDYT_ARCHITEKTURY_ARTEFAKTOW_2026-07-22.md §3`):
 * `check-artefakt.sh` pilnuje TYLKO koloru w powłoce i NIE skanuje centrum kart —
 * dlatego crimson w `RuntimeModeSelector.tsx` przeszedł hook (SPEC-N §STAN
 * "Luka bezpiecznika"). Brak bramki STRUKTURALNEJ to KORZEŃ rozjazdu kart:
 * `StandardTable` nie da się obejść, `NModeShell` — da się, i obchodzi go 8/8
 * (SPEC-N :98). Ten skrypt jest analogonem `check-list-canon.sh` dla artefaktów:
 * mierzy, czy karta trzyma się KONTRAKTU POWŁOKI, nie tylko koloru.
 *
 * Dla KAŻDEGO z 7 artefaktów (SPEC-N §0A) sprawdza:
 *   (a) montuje NModeHeader (Menu 1) — wprost `<NModeHeader>` albo przez
 *       `<NModeShell>` (który renderuje NModeHeader wewnątrz, NModeShell.tsx:102).
 *       Raportuje DROGĘ montażu — bo "wprost NModeHeader" = obejście NModeShell,
 *       czyli dokładnie rozjazd, który audyt nazywa.
 *   (b) używa `ArtifactRightPanel` (wspólny prawy panel, SPEC-A §10.2/§11.2).
 *   (c) sekcje prawego panelu w KANONICZNEJ kolejności:
 *       Akcje(actions) · Właściwości(properties) · Powiązania(relations) ·
 *       [Dowody(evidence)] · Komentarze(comments) · Historia/AI(history).
 *       Flaguje INWERSJE kolejności i złe umiejscowienie `evidence`; brak sekcji
 *       raportuje INFORMACYJNIE (próg wymagalności = decyzja Piotra / kontrakt karty).
 *   (d) skan crimson rozszerzony na CENTRUM (artefakt + jego lokalne importy z tego
 *       samego katalogu-feature, np. RuntimeModeSelector), NIE tylko powłokę —
 *       zamyka lukę z RAPORTU 07-22. Reguła tokenów jak w `check-artefakt.sh`
 *       (primary-* / c-accent, wyjątek `crimson-ok`), z pominięciem czystych linii-
 *       komentarzy — baseline ma liczyć crimson NA EKRANIE, nie w komentarzu.
 *
 * TRYB RAPORTU (domyślny) — wypisuje, wynik per artefakt, NIE blokuje (exit 0).
 * Blokowanie (`--strict`) i PROGI wymagalności sekcji to decyzja produktowa Piotra
 * / kontraktu karty — świadomie NIE rozstrzygane tutaj (patrz `_KONTRAKT_KARTY_SSOT`).
 *
 * Dowód metody: każde twierdzenie wynika z odczytu żywego kodu (parser AST-lite
 * po nawiasach, świadomy stringów/komentarzy/template-literali).
 *
 * Użycie: node scripts/check-artefakt-struktura.mjs [--json] [--strict]
 *   --json    maszynowy wynik (baseline długu strukturalnego)
 *   --strict  exit 1 gdy jakikolwiek TWARDY defekt (patrz "verdict" niżej)
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const JSON_OUT = args.has('--json');
const STRICT = args.has('--strict');

// ── 7 kart N (SPEC-N §0A; ta sama lista co karty_n_files w check-artefakt.sh) ──
const ARTIFACTS = [
  { name: 'Tool', file: 'src/components/DiscoveryTools/KnownToolDetailView.tsx' },
  { name: 'Initiative', file: 'src/components/Initiatives/InitiativeDocumentView.tsx' },
  { name: 'Insight', file: 'src/components/Interview/InsightViewer.tsx' },
  { name: 'Interview', file: 'src/components/Interview/InterviewWorkspace.tsx' },
  { name: 'Decision', file: 'src/components/MyWork/DecisionDetailView.tsx' },
  { name: 'Notification', file: 'src/components/MyWork/NotificationDetailView.tsx' },
  { name: 'Task', file: 'src/components/MyWork/TaskDetailView.tsx' },
];

// Kanon kolejności sekcji prawego panelu (SPEC-A §11.2, SPEC-N §2.2,
// ArtifactRightPanel.tsx:8-9). `evidence` opcjonalne, MIĘDZY relations a comments.
const CANON_RANK = { actions: 0, properties: 1, relations: 2, evidence: 3, comments: 4, history: 5 };
const CORE_FIVE = ['actions', 'properties', 'relations', 'comments', 'history'];

// Powłoka objęta JUŻ przez check-artefakt.sh — z centrum WYKLUCZAMY (zero
// podwójnego liczenia; (d) jest ściśle ADDYTYWNE do istniejącego hooka).
const SHELL_PREFIXES = [
  'src/components/shared/NModeLayout/',
  'src/components/shared/ExecutiveModuleShell/',
  'src/components/standard/',
];
const SHELL_FILES = new Set(['src/components/MyWork/IdeaMapWorkspace.tsx']);

// Reguła tokenów crimson — 1:1 z check-artefakt.sh:79 (primary-* KAŻDY numer +
// token c-accent). Wyjątek per linia: komentarz `crimson-ok`.
const CRIMSON_RE = /primary-|bg-c-accent|text-c-accent|border-c-accent/;

// ── Parser AST-lite: skan tablicy sekcji świadomy stringów/komentarzy ──────────
function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === q) return i + 1;
    i++;
  }
  return i;
}
function skipTemplate(src, i) {
  i++; // za backtickiem
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return i + 1;
    if (c === '$' && src[i + 1] === '{') {
      i += 2;
      let depth = 1;
      while (i < src.length && depth > 0) {
        const d = src[i];
        if (d === '\\') { i += 2; continue; }
        if (d === "'" || d === '"') { i = skipString(src, i); continue; }
        if (d === '`') { i = skipTemplate(src, i); continue; }
        if (d === '{') { depth++; i++; continue; }
        if (d === '}') { depth--; i++; continue; }
        i++;
      }
      continue;
    }
    i++;
  }
  return i;
}

// id: '<x>' jako PIERWSZY klucz obiektu-sekcji (obiekt bezpośrednio w tablicy).
const ID_KEY_RE = /^id\s*:\s*(['"`])([\w-]+)\1/;

/**
 * Zwraca uporządkowaną listę id sekcji z literału tablicy zaczynającego się
 * pod indeksem `startIdx` (pierwszy nawias wartości: `[` albo `(` dla useMemo).
 * Rozpoznaje id TYLKO jako pierwszy klucz obiektu, którego bezpośrednia ramka
 * to `{` wewnątrz `[` — czyli realny element tablicy sekcji, nie zagnieżdżone JSX.
 */
function scanSectionIds(src, startIdx) {
  const ids = [];
  const stack = [];
  let pendingFirstKey = false; // true tuż po `{` otwartym bezpośrednio w `[`
  let i = startIdx;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    // komentarze
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      i = e === -1 ? n : e + 2;
      continue;
    }
    // stringi
    if (c === "'" || c === '"') { i = skipString(src, i); pendingFirstKey = false; continue; }
    if (c === '`') { i = skipTemplate(src, i); pendingFirstKey = false; continue; }
    // nawiasy
    if (c === '[' || c === '{' || c === '(') {
      const parent = stack[stack.length - 1];
      stack.push(c);
      pendingFirstKey = c === '{' && parent === '[';
      i++;
      continue;
    }
    if (c === ']' || c === '}' || c === ')') {
      stack.pop();
      pendingFirstKey = false;
      i++;
      if (stack.length === 0) break; // koniec wartości definicji
      continue;
    }
    // whitespace — nie kasuje oczekiwania na pierwszy klucz
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    // pierwszy klucz obiektu-sekcji
    if (pendingFirstKey) {
      const m = ID_KEY_RE.exec(src.slice(i, i + 48));
      if (m) {
        ids.push(m[2]);
        i += m[0].length;
        pendingFirstKey = false;
        continue;
      }
      pendingFirstKey = false; // pierwszy klucz to nie `id:` → to nie sekcja
    }
    i++;
  }
  return ids;
}

// Znajdź wyrażenie przekazane do <ArtifactRightPanel sections={X}>.
function findSectionsVar(src) {
  const tag = src.indexOf('<ArtifactRightPanel');
  if (tag === -1) return null;
  // szukaj sections={...} w rozsądnym oknie za tagiem (może być kilka renderów —
  // bierzemy pierwszy; wszystkie w tych plikach wskazują tę samą zmienną)
  const win = src.slice(tag, tag + 400);
  const m = /sections=\{([^}]+)\}/.exec(win);
  if (!m) return null;
  const expr = m[1].trim();
  return /^[A-Za-z_$][\w$]*$/.test(expr) ? expr : { dynamic: expr };
}

// Znajdź początek literału tablicy przypisanego do zmiennej `varName`.
function findDefStart(src, varName) {
  const re = new RegExp('(?:const|let|var)\\s+' + varName + '\\b[^=]*=');
  const m = re.exec(src);
  if (!m) return -1;
  let i = m.index + m[0].length;
  // pomiń whitespace/komentarze/identyfikator opakowujący (useMemo/useCallback…)
  // do pierwszego nawiasu wartości: `[` (literał tablicy) albo `(` (wywołanie hooka).
  // scanSectionIds radzi sobie z oboma — dla useMemo `(` staje się dnem stosu,
  // a `id:` łapiemy dopiero w zwróconej tablicy (`return [ … ]`).
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl + 1; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 2; continue; }
    if (c === '[' || c === '(') return i;
    if (/[A-Za-z_$.]/.test(c)) { i++; continue; } // identyfikator opakowujący, np. useMemo / useMemo<...>
    return -1; // nieoczekiwany kształt — nie parsujemy
  }
  return -1;
}

function extractSectionIds(src) {
  const v = findSectionsVar(src);
  if (!v) return { ok: false, reason: 'brak <ArtifactRightPanel> albo nierozpoznany prop sections' };
  if (typeof v === 'object') return { ok: false, reason: `sections budowane dynamicznie: ${v.dynamic}` };
  const start = findDefStart(src, v);
  if (start === -1) return { ok: false, reason: `nie znaleziono definicji const ${v} = [ … ]` };
  return { ok: true, varName: v, ids: scanSectionIds(src, start) };
}

// ── (a)/(b) montaż powłoki ─────────────────────────────────────────────────────
function headerMount(src) {
  const jsxHeader = /<NModeHeader[\s/>]/.test(src);
  const jsxShell = /<NModeShell[\s/>]/.test(src);
  if (jsxShell && jsxHeader) return { mounted: true, path: 'NModeShell + wprost NModeHeader' };
  if (jsxShell) return { mounted: true, path: 'via <NModeShell> (kanon)' };
  if (jsxHeader) return { mounted: true, path: 'wprost <NModeHeader> (obejście NModeShell)' };
  return { mounted: false, path: 'BRAK' };
}

// ── (c) analiza kolejności ─────────────────────────────────────────────────────
function analyzeOrder(ids) {
  const known = ids.filter((id) => id in CANON_RANK);
  const unknown = ids.filter((id) => !(id in CANON_RANK));
  const inversions = [];
  for (let i = 1; i < known.length; i++) {
    if (CANON_RANK[known[i]] < CANON_RANK[known[i - 1]]) {
      inversions.push(`'${known[i]}' po '${known[i - 1]}'`);
    }
  }
  const present = new Set(known);
  const missing = CORE_FIVE.filter((id) => !present.has(id));
  let evidenceIssue = null;
  if (present.has('evidence')) {
    const idx = known.indexOf('evidence');
    const prev = known[idx - 1];
    const next = known[idx + 1];
    // kanon: między relations a comments
    if ((prev && CANON_RANK[prev] > CANON_RANK.relations) || (next && CANON_RANK[next] < CANON_RANK.comments)) {
      evidenceIssue = `evidence poza pozycją relations→comments (sąsiedzi: ${prev ?? '∅'} / ${next ?? '∅'})`;
    }
  }
  return { known, unknown, inversions, missing, evidenceIssue };
}

// ── (d) skan crimson w centrum (artefakt + lokalne importy z feature-dir) ──────
function isShellPath(rel) {
  if (SHELL_FILES.has(rel)) return true;
  return SHELL_PREFIXES.some((p) => rel.startsWith(p));
}
function resolveImport(spec, fromDir) {
  let base;
  if (spec.startsWith('@/')) base = 'src/' + spec.slice(2);
  else if (spec.startsWith('./') || spec.startsWith('../')) base = normalizeRel(fromDir, spec);
  else return null; // zewnętrzny pakiet
  const cands = [base + '.tsx', base + '.ts', base, base + '/index.tsx', base + '/index.ts'];
  for (const c of cands) {
    const abs = resolve(ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return c;
  }
  return null;
}
function normalizeRel(fromDir, spec) {
  const parts = (fromDir + '/' + spec).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}
function centerFilesFor(artFile, src) {
  const featureDir = dirname(artFile); // np. src/components/Interview
  const set = new Set([artFile]);
  const importRe = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src))) {
    const resolved = resolveImport(m[1], featureDir);
    if (!resolved) continue;
    if (isShellPath(resolved)) continue; // powłoka → check-artefakt.sh
    if (!resolved.startsWith(featureDir + '/')) continue; // tylko centrum tego artefaktu
    set.add(resolved);
  }
  return [...set];
}
function crimsonHits(rel) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) return [];
  const lines = readFileSync(abs, 'utf8').split('\n');
  const hits = [];
  lines.forEach((ln, idx) => {
    const trimmed = ln.trim();
    // Pomijamy CZYSTE linie-komentarze — realny przypadek: `// was crimson
    // primary-*` (DecisionDetailView:1678) opisuje USUNIĘTY crimson, nie
    // renderowany token. Line-grep w check-artefakt.sh liczyłby go; tu baseline
    // ma odzwierciedlać crimson NA EKRANIE, więc jest dokładniejszy.
    const isCommentLine = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
    if (CRIMSON_RE.test(ln) && !ln.includes('crimson-ok') && !isCommentLine) {
      hits.push({ file: rel, line: idx + 1, text: trimmed.slice(0, 100) });
    }
  });
  return hits;
}

// ── Bieg ───────────────────────────────────────────────────────────────────────
const results = [];
for (const art of ARTIFACTS) {
  const abs = resolve(ROOT, art.file);
  if (!existsSync(abs)) {
    results.push({ ...art, error: 'pliku nie ma na tej gałęzi' });
    continue;
  }
  const src = readFileSync(abs, 'utf8');
  const header = headerMount(src);
  const usesPanel = /<ArtifactRightPanel[\s/>]/.test(src);
  const sec = extractSectionIds(src);
  const order = sec.ok ? analyzeOrder(sec.ids) : null;

  const centerFiles = centerFilesFor(art.file, src);
  let crimson = [];
  for (const f of centerFiles) crimson = crimson.concat(crimsonHits(f));

  // TWARDE defekty (jednoznaczne, niezależne od progów Piotra):
  const hard = [];
  if (!header.mounted) hard.push('brak NModeHeader (Menu 1)');
  if (!usesPanel) hard.push('brak ArtifactRightPanel');
  if (order && order.inversions.length) hard.push(`kolejność sekcji: ${order.inversions.join(', ')}`);
  if (order && order.evidenceIssue) hard.push(order.evidenceIssue);
  if (crimson.length) hard.push(`crimson w centrum: ${crimson.length}`);
  // Obejście NModeShell = MIĘKKI sygnał rozjazdu (nie twardy — Decision/Task/Notif
  // renderują NModeHeader wprost świadomie; to wejście do kontraktu, nie defekt).
  const soft = [];
  if (header.path.includes('obejście')) soft.push('Menu 1 wprost, z pominięciem NModeShell');
  if (order && order.unknown.length) soft.push(`sekcje spoza kanonu: ${order.unknown.join(', ')}`);
  if (order && order.missing.length) soft.push(`brak sekcji (informacyjnie): ${order.missing.join(', ')}`);
  if (!sec.ok) soft.push(`(c) nieparsowalne: ${sec.reason}`);

  results.push({
    ...art, header, usesPanel, sec, order,
    centerFileCount: centerFiles.length, crimson, hard, soft,
    verdict: hard.length ? 'FLAGA' : 'OK',
  });
}

// ── Wyjście ──────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify(results.map((r) => ({
    name: r.name, file: r.file, error: r.error,
    headerMounted: r.header?.mounted, headerPath: r.header?.path,
    usesArtifactRightPanel: r.usesPanel,
    sectionIds: r.sec?.ok ? r.sec.ids : null,
    sectionsParseError: r.sec?.ok ? null : r.sec?.reason,
    orderInversions: r.order?.inversions ?? null,
    missingCore: r.order?.missing ?? null,
    unknownSections: r.order?.unknown ?? null,
    evidenceIssue: r.order?.evidenceIssue ?? null,
    crimsonCenterCount: r.crimson?.length ?? null,
    crimsonCenter: r.crimson ?? null,
    verdict: r.verdict,
  })), null, 2));
} else {
  const B = (s) => `\x1b[1m${s}\x1b[0m`;
  console.log(B('\n══ BRAMKA STRUKTURALNA KART N — tryb RAPORTU (nie blokuje) ══'));
  console.log('   SSOT kanonu: ARTIFACT_ANATOMY_STANDARD.md §11.2 · SPEC-N §2.1-2.4 · ArtifactRightPanel.tsx');
  console.log('   Kanon sekcji: actions · properties · relations · [evidence] · comments · history\n');

  let flagged = 0;
  let crimsonTotal = 0;
  for (const r of results) {
    if (r.error) {
      console.log(`▌ ${B(r.name)} — ${r.file}\n  ⚠ ${r.error}\n`);
      continue;
    }
    console.log(`▌ ${B(r.name)} — ${r.file}`);
    // (a)
    console.log(`  (a) Menu 1 / NModeHeader : ${r.header.mounted ? '✓' : '✗'} ${r.header.path}`);
    // (b)
    console.log(`  (b) ArtifactRightPanel   : ${r.usesPanel ? '✓ używa' : '✗ NIE używa'}`);
    // (c)
    if (r.sec.ok) {
      console.log(`  (c) Sekcje panelu        : [${r.sec.ids.join(', ') || '∅'}]`);
      if (r.order.inversions.length)
        console.log(`        ✗ kolejność        : ${r.order.inversions.join('; ')}`);
      else
        console.log(`        ✓ kolejność        : zgodna z kanonem`);
      if (r.order.evidenceIssue) console.log(`        ✗ evidence         : ${r.order.evidenceIssue}`);
      if (r.order.missing.length) console.log(`        · brak (info)      : ${r.order.missing.join(', ')}`);
      if (r.order.unknown.length) console.log(`        · spoza kanonu     : ${r.order.unknown.join(', ')}`);
    } else {
      console.log(`  (c) Sekcje panelu        : ⚠ nieparsowalne — ${r.sec.reason}`);
    }
    // (d)
    console.log(`  (d) Crimson w centrum    : ${r.crimson.length === 0 ? '✓ 0' : '✗ ' + r.crimson.length + ' naruszeń'} (skan ${r.centerFileCount} plików centrum)`);
    r.crimson.slice(0, 8).forEach((h) => console.log(`        ${h.file}:${h.line}`));
    if (r.crimson.length > 8) console.log(`        … +${r.crimson.length - 8} więcej`);
    crimsonTotal += r.crimson.length;
    // verdict
    if (r.verdict === 'FLAGA') {
      flagged++;
      console.log(`  → ${B('STRUKTURA: FLAGA')} — ${r.hard.join(' · ')}`);
    } else {
      console.log(`  → ${B('STRUKTURA: OK')} (twardych defektów brak)`);
    }
    if (r.soft.length) console.log(`     wejście do kontraktu: ${r.soft.join(' · ')}`);
    console.log('');
  }

  console.log(B('── BASELINE DŁUGU STRUKTURALNEGO ──'));
  console.log(`   Artefaktów: ${results.length} · z twardym defektem: ${flagged} · crimson w centrum (suma): ${crimsonTotal}`);
  console.log('   Tryb raportu — exit 0. Progi wymagalności sekcji = decyzja Piotra / _KONTRAKT_KARTY_SSOT.\n');
}

// Report mode: nie blokuje. --strict blokuje na TWARDYCH defektach.
if (STRICT) {
  const anyHard = results.some((r) => r.verdict === 'FLAGA');
  process.exit(anyHard ? 1 : 0);
}
process.exit(0);
