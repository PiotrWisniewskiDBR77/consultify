#!/usr/bin/env node
/**
 * Bezpiecznik (dyzur 2026-09-05, wave3 defekt 5): blokuje powrot rozdzielonego
 * odczytu `import.meta.env`.
 *
 * Vite/esbuild podstawiaja obiekt `import.meta.env` TYLKO gdy `import.meta`
 * i `.env` wystepuja w JEDNYM wyrazeniu (jeden lancuch MemberExpression) w
 * skompilowanym (po TS) kodzie. Wzorzec:
 *
 *   const meta = import.meta as unknown as { env?: ... };
 *   ... meta?.env?.[KEY] ...
 *
 * po wycieciu castu TS staje sie `const meta = import.meta; ... meta?.env`,
 * czyli DWA oddzielone wyrazenia -- `import.meta.env` nigdy nie powstaje jako
 * jeden node, wiec Vite nigdy go nie podstawia. `meta.env` jest wtedy zawsze
 * `undefined` w `vite build` (dziala tylko przypadkiem w `vite dev`/vitest,
 * ktore maja inny mechanizm wstrzykiwania).
 *
 * SPROSTOWANE 2026-09-06 (zlecenie Z5 — pomiar empiryczny `vi.stubEnv`):
 * wzorzec ponizej ("poprawny" wg tego komentarza od 05.09) —
 *
 *   (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[KEY]
 *
 * — DZIALA w `vite build` i w przegladarkowym `vite dev` (esbuild zdejmuje
 * cast PRZED podstawieniem), ale zwraca `undefined` w Vitest przy
 * `vi.stubEnv` (Vitest/vite-node czyta SUROWE zrodlo, gdzie cast rozdziela
 * "import.meta" od ".env" — evidence/z5/05-vitest-cast-vs-literal-dowod.txt
 * w gałęzi Z5). Ten skan (a) tego NIE lapie (lapie tylko SPLIT), wiec dalej
 * jest poprawny jako bezpiecznik na regresje do formy z 05.09, ale NOWY
 * kanoniczny ksztalt (Z5, dziala WSZEDZIE wlacznie z Vitest) to cast na
 * WYNIKU `.env`, nie na `import.meta` przed `.env`:
 *
 *   (import.meta.env as unknown as Record<string, string | undefined>)?.[KEY]
 *
 * lub statyczny `import.meta.env.VITE_KLUCZ`.
 *
 * Ten skrypt ma DWA kroki:
 *   (a) skan `src/` regexem rozdzielonego wzorca -> exit 1 przy trafieniu
 *       (szybkie, samo-wystarczajace, dziala bez zbudowanego node_modules
 *       poza samym Node -- to jest krok wpiety w pre-commit).
 *   (b) DOWOD w buildzie: esbuild (bundle, platform browser) probnika
 *       `scripts/dev/probe/envFlagsBuildProof.entry.ts`, ktory importuje
 *       3 naprawione flagi, z `--define:import.meta.env={...VITE_*:"true"}`.
 *       Sprawdza, ze zbundlowany kod NIE zawiera juz `import.meta` (Vite go
 *       podstawil) i ze wszystkie 3 flagi faktycznie zwracaja `true`, gdy ich
 *       `VITE_*` jest ustawione w define -- czyli dowod na poziomie builda,
 *       nie samego `vitest`.
 *
 * Uzycie:
 *   node scripts/check-flags-env-static.mjs             # (a) + (b)
 *   node scripts/check-flags-env-static.mjs --scan-only # tylko (a), szybkie
 */
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_ONLY = process.argv.includes('--scan-only');

// ---------------------------------------------------------------------------
// (a) Regex scan for the split pattern, generalized past the exact 108-file
//     text so a future regression under a different variable name is still
//     caught.
// ---------------------------------------------------------------------------
function listSourceFiles() {
  const out = execFileSync(
    'grep',
    ['-rl', '--include=*.ts', '--include=*.tsx', 'import\\.meta', 'src'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  // `__tests__`/`.test.ts(x)` files are excluded: their whole purpose (see
  // e.g. `zaiTeresaFlag.envStaticRead.test.ts` and the 5 test files from this
  // dyzur) is to document and mutation-prove the BROKEN shape in prose/regex
  // literals, which is exactly what would false-positive here even after
  // comment-stripping (a regex literal is still executable code, not a
  // comment). Production flag files are what this guard protects.
  return out
    .split('\n')
    .filter(Boolean)
    .filter((f) => !/__tests__\//.test(f) && !/\.(test|spec)\.tsx?$/.test(f));
}

/** Strips block and line comments — same shape vitest's env-static-read tests use, so a docstring describing the old broken pattern (e.g. zaiTeresaFlag.ts's header) never false-positives here. */
function stripComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Matches `const <ident> = import.meta as ...;` (any cast shape) capturing
// the identifier, so we can check whether that identifier is later accessed
// as `<ident>?.env` / `<ident>.env` in a SEPARATE statement (the bug).
const DECL_RE = /\bconst\s+(\w+)\s*=\s*import\.meta\s+as\s+[^;\n]*;/g;

function scanFileForSplitPattern(relFile) {
  const abs = path.join(REPO_ROOT, relFile);
  const content = stripComments(readFileSync(abs, 'utf8'));
  const violations = [];
  let match;
  DECL_RE.lastIndex = 0;
  while ((match = DECL_RE.exec(content)) !== null) {
    const ident = match[1];
    const declEnd = match.index + match[0].length;
    const rest = content.slice(declEnd);
    const usageRe = new RegExp(`\\b${ident}\\??\\.env\\b`);
    if (usageRe.test(rest)) {
      const lineNo = content.slice(0, match.index).split('\n').length;
      violations.push(
        `${relFile}:${lineNo} rozdzielony odczyt import.meta.env — ` +
          `\`const ${ident} = import.meta as ...\` i \`${ident}?.env\` sa w OSOBNYCH ` +
          `wyrazeniach; sklej je w jedno: (import.meta as ...).env?.[KLUCZ]`
      );
    }
  }
  return violations;
}

function runScan() {
  const files = listSourceFiles();
  const violations = files.flatMap(scanFileForSplitPattern);
  if (violations.length > 0) {
    console.error(`[check-flags-env-static] ${violations.length} naruszenie(a):`);
    for (const v of violations) console.error(`  - ${v}`);
    return false;
  }
  console.log(`[check-flags-env-static] (a) skan OK — 0 rozdzielonych wzorcow (sprawdzono ${files.length} plikow).`);
  return true;
}

// ---------------------------------------------------------------------------
// (b) Build proof via esbuild — the actual bundler behavior, not vitest's.
// ---------------------------------------------------------------------------
function runBuildProof() {
  let esbuild;
  try {
    esbuild = createRequire(import.meta.url)('esbuild');
  } catch {
    console.error('[check-flags-env-static] (b) esbuild niedostepny (node_modules brak/niekompletny) — pomijam dowod builda.');
    console.error('   Zainstaluj zaleznosci (npm install) albo podlinkuj node_modules, zeby ten krok zadzialal.');
    return false;
  }

  const entry = path.join(REPO_ROOT, 'scripts/dev/probe/envFlagsBuildProof.entry.ts');
  const definedEnv = {
    VITE_ASSESSMENT_DOCX_ENABLED: 'true',
    VITE_FINANCE_VALUE_PANELS: 'true',
    VITE_INITIATIVE_BRIDGE: 'true',
  };

  let result;
  try {
    result = esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      platform: 'browser',
      format: 'cjs',
      target: 'es2020',
      write: false,
      logLevel: 'silent',
      define: {
        'import.meta.env': JSON.stringify(definedEnv),
      },
    });
  } catch (err) {
    console.error('[check-flags-env-static] (b) esbuild build FAILED:');
    console.error(String(err && err.message ? err.message : err));
    return false;
  }

  const bundledCode = result.outputFiles[0].text;

  // Sanity: esbuild's `--define:import.meta.env=...` substitution leaves a
  // `// <define:import.meta.env>` marker comment plus an object literal
  // holding the defined keys (`define_import_meta_env_default`). If that
  // object literal is MISSING, the define never matched any `import.meta.env`
  // expression in the bundle — exactly the failure mode of the split pattern
  // (`import.meta` and `.env` in separate statements never form the
  // `import.meta.env` MemberExpression esbuild's define looks for).
  const hasSubstitutedEnvObject =
    /var\s+define_import_meta_env_default\s*=\s*\{[^}]*VITE_ASSESSMENT_DOCX_ENABLED[^}]*\}/.test(
      bundledCode
    );
  if (!hasSubstitutedEnvObject) {
    console.error(
      '[check-flags-env-static] (b) DOWOD NIEUDANY: zbundlowany kod nie zawiera podstawionego obiektu env —'
    );
    console.error('   define nie trafil w zaden `import.meta.env` (rozdzielony wzorzec albo inna regresja).');
    return false;
  }

  // Execute the bundle and read back the probe result.
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'check-flags-env-static-'));
  const tmpFile = path.join(tmpDir, 'probe-bundle.cjs');
  writeFileSync(tmpFile, bundledCode, 'utf8');
  let probeResult;
  try {
    const require2 = createRequire(import.meta.url);
    delete require2.cache[require2.resolve(tmpFile)];
    require2(tmpFile);
    probeResult = globalThis.__ENV_FLAGS_PROBE_RESULT__;
  } catch (err) {
    console.error('[check-flags-env-static] (b) uruchomienie zbundlowanego probnika FAILED:');
    console.error(String(err && err.stack ? err.stack : err));
    return false;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  const expectedTrue = ['assessmentDocx', 'financeValuePanels', 'initiativeBridge'];
  const failed = expectedTrue.filter((key) => probeResult?.[key] !== true);
  if (failed.length > 0) {
    console.error('[check-flags-env-static] (b) DOWOD NIEUDANY: flagi ktore powinny byc true po --define VITE_*=true:');
    console.error(`   ${JSON.stringify(probeResult)}`);
    console.error(`   nie-true: ${failed.join(', ')}`);
    return false;
  }

  console.log(
    `[check-flags-env-static] (b) dowod builda OK — esbuild bundle (platform browser) z ` +
      `--define:import.meta.env=${JSON.stringify(definedEnv)} daje ${JSON.stringify(probeResult)}.`
  );
  return true;
}

const scanOk = runScan();
if (!scanOk) {
  process.exit(1);
}

if (SCAN_ONLY) {
  process.exit(0);
}

const buildOk = runBuildProof();
process.exit(buildOk ? 0 : 1);
