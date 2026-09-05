/**
 * Naprawa 2026-09-05 (wave3 defekt 5, dyzur "flagi-env-statyczny-odczyt"):
 * `readEnvFlag()` czytal env przez `const meta = import.meta as unknown as
 * {...}; ... meta?.env?.[ENV_KEY]` — dwa OSOBNE wyrazenia po transpilacji TS
 * (`const meta = import.meta;` + `meta?.env`). Vite/esbuild podstawiaja
 * obiekt `import.meta.env` TYLKO gdy `import.meta` i `.env` sa w JEDNYM
 * wyrazeniu (`import.meta.env` jako pojedynczy MemberExpression) — rozdzielone
 * na dwa wyrazenia, `import.meta` zostaje natywnym obiektem bez `.env`, wiec
 * `VITE_ASSESSMENT_DOCX_ENABLED` ustawiony na Railway nigdy nie dzialal w
 * `vite build`.
 *
 * Test RUNTIME'owy tego by nie obronil: vitest sam podstawia prawdziwe
 * `import.meta.env`, wiec obie wersje (zepsuta i naprawiona) przechodzą.
 * Bronimy wiec KSZTALTU ODCZYTU W ZRODLE (po zdjeciu komentarzy) — dokladnie
 * tak jak `zaiTeresaFlag.envStaticRead.test.ts`.
 *
 * DOWOD MUTACYJNY (wykonany recznie przy pisaniu tego testu): przywrocenie
 * `const meta = import.meta as unknown as {...}; ... meta?.env?.[ENV_KEY]`
 * -> test "NIE ma rozdzielonego..." czerwienieje.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ASSESSMENT_DOCX_FLAG_KEYS } from '../assessmentDocxFlag';

/** Kod bez komentarzy — dokładnie to, co widzi Vite przy decyzji o preambule. */
function executableSource(relativePath: string): string {
  const raw = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('assessmentDocxFlag — odczyt env musi być jednym wyrażeniem', () => {
  const source = executableSource('../assessmentDocxFlag.ts');

  it(`kod wykonywalny odczytuje klucz ${ASSESSMENT_DOCX_FLAG_KEYS.env} przez import.meta.env w jednym wyrażeniu`, () => {
    // `).env` bezpośrednio po zamknięciu castu = import.meta i .env w JEDNYM
    // MemberExpression (to właśnie ten kształt Vite/esbuild podstawiają).
    expect(source).toMatch(/\)\.env\??\.\[ENV_KEY\]/);
  });

  it('kod wykonywalny NIE deklaruje osobnej zmiennej trzymającej samo import.meta', () => {
    // Ten kształt (`const X = import.meta as ...;` jako WŁASNA instrukcja,
    // kończąca się `};` zaraz po typie castu, bez `.env` w tej samej
    // instrukcji) jest dokładnie tym, co rozdziela import.meta i .env na dwa
    // wyrażenia i psuje podstawienie Vite/esbuild w vite build.
    expect(source).not.toMatch(/\bconst\s+\w+\s*=\s*import\.meta\s+as\s+unknown\s+as\s*\{[^}]*\};/);
  });
});
