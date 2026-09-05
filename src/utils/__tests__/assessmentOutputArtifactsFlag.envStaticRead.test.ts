/**
 * Weryfikacja 2026-09-05 (wave3 defekt 5, dyzur "flagi-env-statyczny-odczyt").
 * Ten plik BYL JUZ poprawny przed dyzurem (`readEnv()` trzyma `.env` w TYM
 * SAMYM wyrazeniu co cast: `const env = (import.meta as unknown as
 * {...}).env;`), ale wchodzil do listy "na pewno obejmij" zlecenia — ten test
 * blokuje regresje do rozdzielonego wzorca (`const meta = import.meta as
 * ...;` jako WŁASNA instrukcja, potem `meta?.env` gdzie indziej), ktory w
 * `vite build` nigdy nie podstawia obiektu `import.meta.env` (patrz
 * `assessmentDocxFlag.envStaticRead.test.ts` po pelne wyjasnienie).
 *
 * DOWOD MUTACYJNY (wykonany recznie przy pisaniu tego testu): zamiana
 * `const env = (import.meta as unknown as {...}).env;` na
 * `const meta = import.meta as unknown as {...}; const env = meta?.env;`
 * -> drugi test ponizej czerwienieje.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ASSESSMENT_OUTPUT_ARTIFACTS_FLAG_KEYS } from '../assessmentOutputArtifactsFlag';

/** Kod bez komentarzy — dokładnie to, co widzi Vite przy decyzji o preambule. */
function executableSource(relativePath: string): string {
  const raw = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('assessmentOutputArtifactsFlag — odczyt env musi być jednym wyrażeniem', () => {
  const source = executableSource('../assessmentOutputArtifactsFlag.ts');

  it(`readEnv() odczytuje ${ASSESSMENT_OUTPUT_ARTIFACTS_FLAG_KEYS.env} — .env jest w TYM SAMYM wyrażeniu co cast import.meta`, () => {
    // `).env` bezpośrednio po zamknięciu castu = import.meta i .env w JEDNYM
    // MemberExpression (dokładnie to, co Vite/esbuild podstawiają).
    expect(source).toMatch(/\(import\.meta as unknown as \{[^}]*\}\)\.env\b/);
  });

  it('kod wykonywalny NIE deklaruje osobnej zmiennej trzymającej samo import.meta (bez .env w tej samej instrukcji)', () => {
    expect(source).not.toMatch(/\bconst\s+\w+\s*=\s*import\.meta\s+as\s+unknown\s+as\s*\{[^}]*\};/);
  });
});
