#!/usr/bin/env node
// check-resource-collisions.mjs
//
// Mechaniczny strażnik kolizji zasobów między równoległymi dyżurami Consultify.
// Zero zależności zewnętrznych — czysty Node (fs, path, url).
//
// Użycie:
//   node scripts/waves/check-resource-collisions.mjs [ścieżka-do-rejestru.json]
//   node scripts/waves/check-resource-collisions.mjs [rejestr.json] --add '<json-nowego-dyzuru>'
//
// Kod wyjścia: 0 = czysto, 1 = wykryto kolizję (albo błąd wejścia).

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const DEFAULT_REGISTRY_PATH = join(
  REPO_ROOT,
  'docs/program/system-pracy/05_REJESTR_ZASOBOW.json',
);

function parseArgs(argv) {
  const args = argv.slice(2);
  let registryPath = DEFAULT_REGISTRY_PATH;
  let addJson = null;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--add') {
      addJson = args[i + 1];
      i += 1;
    } else if (!a.startsWith('--')) {
      registryPath = resolve(a);
    }
  }
  return { registryPath, addJson };
}

function loadRegistry(path) {
  if (!existsSync(path)) {
    console.error(`BŁĄD: plik rejestru nie istnieje: ${path}`);
    process.exit(1);
  }
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`BŁĄD: nie można odczytać rejestru: ${err.message}`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`BŁĄD: rejestr nie jest poprawnym JSON: ${err.message}`);
    process.exit(1);
  }
}

// --- Pomocnicze: przedziały migracji ---------------------------------------

function parseRange(rangeStr) {
  if (!rangeStr || typeof rangeStr !== 'string') return null;
  const m = rangeStr.match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  const lo = parseInt(m[1], 10);
  const hi = parseInt(m[2], 10);
  if (lo > hi) return null;
  return { lo, hi };
}

function rangesOverlap(a, b) {
  return a.lo <= b.hi && b.lo <= a.hi;
}

// --- Pomocnicze: wzorce ścieżek (proste globy z **, *) ----------------------
// Zamiana wzorca na RegExp: ** = dowolna głębokość, * = dowolny fragment bez '/'
function globToRegExp(glob) {
  let re = '^';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 1;
        // pochłoń ewentualny '/' zaraz po '**'
        if (glob[i + 1] === '/') i += 1;
      } else {
        re += '[^/]*';
      }
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  re += '$';
  return new RegExp(re);
}

// Dwa wzorce "nachodzą", jeśli istnieje jakaś realna ścieżka, którą oba by
// dopasowały. Heurystyka bez enumeracji plików: porównujemy segmenty ścieżek
// część-po-części; jeśli jeden segment to '*'/'**' dopasowuje wszystko, inaczej
// segmenty muszą być identyczne (ignorując rozszerzenia z '*' wewnątrz).
function patternsOverlap(patA, patB) {
  if (patA === patB) return true;
  const segA = patA.split('/');
  const segB = patB.split('/');

  const len = Math.min(segA.length, segB.length);
  for (let i = 0; i < len; i += 1) {
    const a = segA[i];
    const b = segB[i];
    if (a === '**' || b === '**') return true; // od tego punktu może nachodzić dowolnie
    if (a === b) continue;
    // Segmenty z '*' — traktuj jako regex fragmentu
    const reA = globToRegExp(a);
    const reB = globToRegExp(b);
    // czy jest choć jeden literalny string, który spełnia oba segmenty?
    // Uproszczenie: jeśli oba segmenty zawierają '*', a ich stałe części się
    // nie wykluczają (jedna jest prefiksem/sufiksem drugiej po usunięciu '*'),
    // uznajemy za potencjalne nachodzenie.
    if (a.includes('*') || b.includes('*')) {
      if (segmentGlobsCouldOverlap(a, b)) continue;
      return false;
    }
    return false; // stałe segmenty różne, bez '*' po żadnej stronie -> rozłączne
  }
  // Jeśli dotarliśmy tu, wspólny prefiks długości `len` pasuje segment-po-segmencie.
  // Jeśli długości równe -> identyczne (już odsiane wyżej) albo w pełni zgodne przez *.
  // Jeśli różne długości i krótszy wzorzec nie kończył się na '**', to są rozłączne
  // (jeden to plik, drugi wchodzi głębiej w podkatalog niebędący '**').
  if (segA.length === segB.length) return true;
  return false;
}

function segmentGlobsCouldOverlap(a, b) {
  // np. 'admin-*.routes.ts' vs 'admin-bulk.routes.ts' -> mogą nachodzić
  const reA = globToRegExp(a);
  const reB = globToRegExp(b);
  // Brak enumeracji realnych plików tutaj — testujemy kilka syntetycznych
  // kandydatów zbudowanych z liter obu wzorców, wystarczające dla wzorców
  // w tym rejestrze (proste prefiksy/sufiksy).
  const literalA = a.replace(/\*/g, '');
  const literalB = b.replace(/\*/g, '');
  const candidate1 = literalA + literalB;
  const candidate2 = literalB + literalA;
  return (
    reA.test(candidate1) && reB.test(candidate1) ||
    reA.test(candidate2) && reB.test(candidate2) ||
    literalA === '' || literalB === '' ||
    literalA.includes(literalB) || literalB.includes(literalA)
  );
}

function territoriesOverlap(patternsA, patternsB) {
  const collisions = [];
  for (const pa of patternsA) {
    for (const pb of patternsB) {
      if (patternsOverlap(pa, pb)) {
        collisions.push([pa, pb]);
      }
    }
  }
  return collisions;
}

function isCrossCuttingMatch(pattern, crossCuttingList) {
  const hits = [];
  for (const cc of crossCuttingList) {
    if (patternsOverlap(pattern, cc)) hits.push(cc);
  }
  return hits;
}

// --- Pomocnicze: skan istniejących migracji ----------------------------------

function scanExistingMigrationNumbers(repoRoot) {
  const dirs = ['server/migrations', 'server/migrations-v2'];
  const numbers = [];
  for (const d of dirs) {
    const full = join(repoRoot, d);
    if (!existsSync(full)) continue;
    let entries;
    try {
      entries = readdirSync(full);
    } catch {
      continue;
    }
    for (const name of entries) {
      const m = name.match(/^(\d+)_/);
      if (m) {
        numbers.push({ file: `${d}/${name}`, number: parseInt(m[1], 10) });
      }
    }
  }
  return numbers;
}

// --- Główne sprawdzenia -------------------------------------------------------

function checkMigrationOverlaps(dyzury) {
  const problems = [];
  const withRanges = dyzury
    .map((d) => ({ d, range: parseRange(d.migracje) }))
    .filter((x) => x.range !== null);

  for (let i = 0; i < withRanges.length; i += 1) {
    for (let j = i + 1; j < withRanges.length; j += 1) {
      const a = withRanges[i];
      const b = withRanges[j];
      if (rangesOverlap(a.range, b.range)) {
        problems.push(
          `KOLIZJA MIGRACJI: dyżur ${a.d.numer} (${a.d.migracje}) nachodzi na dyżur ${b.d.numer} (${b.d.migracje})`,
        );
      }
    }
  }
  return problems;
}

function checkPortOverlaps(dyzury, field, label) {
  const problems = [];
  const seen = new Map();
  for (const d of dyzury) {
    const port = d[field];
    if (port === undefined || port === null) continue;
    if (seen.has(port)) {
      problems.push(
        `KOLIZJA PORTU ${label}: dyżur ${seen.get(port)} i dyżur ${d.numer} obydwa używają portu ${port}`,
      );
    } else {
      seen.set(port, d.numer);
    }
  }
  return problems;
}

function checkTerritoryOverlaps(dyzury) {
  const problems = [];
  for (let i = 0; i < dyzury.length; i += 1) {
    for (let j = i + 1; j < dyzury.length; j += 1) {
      const a = dyzury[i];
      const b = dyzury[j];
      const patA = a.terytorium || [];
      const patB = b.terytorium || [];
      if (patA.length === 0 || patB.length === 0) continue;
      const collisions = territoriesOverlap(patA, patB);
      if (collisions.length > 0) {
        for (const [pa, pb] of collisions) {
          problems.push(
            `KOLIZJA TERYTORIUM: dyżur ${a.numer} (${pa}) nachodzi na dyżur ${b.numer} (${pb})`,
          );
        }
      }
    }
  }
  return problems;
}

function checkCrossCuttingLicenses(dyzury, crossCuttingList) {
  const problems = [];
  const warnings = [];
  const owners = new Map(); // crossCuttingPattern -> [numer dyzuru,...]

  for (const d of dyzury) {
    const patterns = d.terytorium || [];
    for (const p of patterns) {
      const hits = isCrossCuttingMatch(p, crossCuttingList);
      for (const cc of hits) {
        if (!owners.has(cc)) owners.set(cc, []);
        owners.get(cc).push(d.numer);
      }
    }
  }

  for (const [cc, numery] of owners.entries()) {
    const unique = [...new Set(numery)];
    if (unique.length > 1) {
      problems.push(
        `KOLIZJA PLIKU PRZEKROJOWEGO: '${cc}' dotknięty przez WIĘCEJ NIŻ JEDEN dyżur naraz: ${unique.join(', ')} (wymaga wyłącznej licencji — tylko jeden dyżur naraz)`,
      );
    } else {
      warnings.push(
        `UWAGA: dyżur ${unique[0]} dotyka pliku przekrojowego '${cc}' — wymaga wyłącznej licencji (potwierdź, że żaden inny dyżur go dziś nie dotyka)`,
      );
    }
  }
  return { problems, warnings };
}

function checkAgainstExistingMigrations(dyzury, existingNumbers) {
  const problems = [];
  for (const d of dyzury) {
    const range = parseRange(d.migracje);
    if (!range) continue;
    for (const ex of existingNumbers) {
      if (ex.number >= range.lo && ex.number <= range.hi) {
        problems.push(
          `KOLIZJA Z ISTNIEJĄCYM PLIKIEM: dyżur ${d.numer} (${d.migracje}) obejmuje numer ${ex.number}, który JUŻ ISTNIEJE jako ${ex.file}`,
        );
      }
    }
  }
  return problems;
}

// --- Tryb --add ---------------------------------------------------------------

function handleAdd(registry, addJsonStr, registryPath) {
  let newDyzur;
  try {
    newDyzur = JSON.parse(addJsonStr);
  } catch (err) {
    console.error(`BŁĄD: --add nie jest poprawnym JSON: ${err.message}`);
    process.exit(1);
  }

  if (typeof newDyzur.numer !== 'number') {
    console.error("BŁĄD: nowy dyżur musi mieć pole liczbowe 'numer'.");
    process.exit(1);
  }

  const dyzury = registry.aktywne_dyzury || [];
  if (dyzury.some((d) => d.numer === newDyzur.numer)) {
    console.error(`ODMOWA: dyżur ${newDyzur.numer} już istnieje w rejestrze.`);
    process.exit(1);
  }

  const candidateList = [...dyzury, newDyzur];
  const existingMigrationNumbers = scanExistingMigrationNumbers(REPO_ROOT);
  const crossCutting = registry.pliki_przekrojowe || [];

  const problems = [
    ...checkMigrationOverlaps(candidateList),
    ...checkPortOverlaps(candidateList, 'port_pg', 'PG'),
    ...checkPortOverlaps(candidateList, 'port_harness', 'harness'),
    ...checkTerritoryOverlaps(candidateList),
    ...checkAgainstExistingMigrations(candidateList, existingMigrationNumbers),
  ];
  const { problems: ccProblems } = checkCrossCuttingLicenses(
    candidateList,
    crossCutting,
  );
  problems.push(...ccProblems);

  if (problems.length > 0) {
    console.error(
      `ODMOWA: dodanie dyżuru ${newDyzur.numer} spowodowałoby ${problems.length} kolizj${problems.length === 1 ? 'ę' : 'i'}:\n`,
    );
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  registry.aktywne_dyzury = candidateList;
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  console.log(
    `OK: dyżur ${newDyzur.numer} dodany bez kolizji. Rejestr zapisany: ${registryPath}`,
  );
  process.exit(0);
}

// --- main ----------------------------------------------------------------------

function main() {
  const { registryPath, addJson } = parseArgs(process.argv);
  const registry = loadRegistry(registryPath);

  if (addJson !== null) {
    handleAdd(registry, addJson, registryPath);
    return;
  }

  const dyzury = registry.aktywne_dyzury || [];
  const crossCutting = registry.pliki_przekrojowe || [];
  const existingMigrationNumbers = scanExistingMigrationNumbers(REPO_ROOT);

  const problems = [
    ...checkMigrationOverlaps(dyzury),
    ...checkPortOverlaps(dyzury, 'port_pg', 'PG'),
    ...checkPortOverlaps(dyzury, 'port_harness', 'harness'),
    ...checkTerritoryOverlaps(dyzury),
    ...checkAgainstExistingMigrations(dyzury, existingMigrationNumbers),
  ];
  const { problems: ccProblems, warnings: ccWarnings } =
    checkCrossCuttingLicenses(dyzury, crossCutting);
  problems.push(...ccProblems);

  console.log(`Rejestr: ${registryPath}`);
  console.log(`Aktywnych dyżurów: ${dyzury.length}`);
  console.log(
    `Plików migracji zeskanowanych (server/migrations + migrations-v2): ${existingMigrationNumbers.length}`,
  );
  console.log('');

  if (ccWarnings.length > 0) {
    console.log('Ostrzeżenia (pliki przekrojowe — jednoosobowa licencja):');
    for (const w of ccWarnings) console.log(`  - ${w}`);
    console.log('');
  }

  if (problems.length > 0) {
    console.log(`WYNIK: KOLIZJE WYKRYTE (${problems.length}):`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    process.exit(1);
  }

  console.log('WYNIK: CZYSTO — brak kolizji migracji/portów/terytoriów.');
  process.exit(0);
}

main();
