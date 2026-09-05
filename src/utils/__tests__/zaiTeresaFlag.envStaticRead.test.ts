/**
 * ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały, różnica #7) — „flaga z env nie
 * działa". Zmierzone: warstwa `import.meta.env` była MARTWA, bo odczyt szedł
 * przez indeks (`meta?.env?.[ENV_KEY]`):
 *   - w `vite build` podstawienie jest TEKSTOWE dla wyrażenia
 *     `import.meta.env.KLUCZ`, więc dynamiczny indeks nie jest podstawiany, a
 *     natywne `import.meta` w bundlu nie ma własności `env` → `undefined`;
 *   - w `vite dev` preambuła `import.meta.env = {...}` jest wstrzykiwana TYLKO
 *     do modułów, których kod (po transformacji, bez komentarzy) zawiera
 *     dosłowny napis `import.meta.env` — ten plik go nie zawierał, więc również
 *     lokalnie flaga z env nigdy nie działała.
 *
 * Test RUNTIME'owy tego NIE obroni: vitest sam podstawia prawdziwe
 * `import.meta.env`, więc obie wersje kodu przechodzą. Bronimy więc tego, co
 * naprawdę decyduje — KSZTAŁTU ODCZYTU W ŹRÓDLE, po odjęciu komentarzy
 * (komentarz z `import.meta.env.…` nie ratuje: esbuild go usuwa, zanim Vite
 * sprawdzi warunek wstrzyknięcia preambuły).
 *
 * DOWÓD MUTACYJNY (wykonany): przywrócenie `meta?.env?.[ENV_KEY]` → oba
 * przypadki czerwienieją.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ZAI_TERESA_FLAG_KEYS } from '../zaiTeresaFlag';

/** Kod bez komentarzy — dokładnie to, co widzi Vite przy decyzji o preambule. */
function executableSource(relativePath: string): string {
  const raw = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('zaiTeresaFlag — odczyt env musi być statyczny', () => {
  const source = executableSource('../zaiTeresaFlag.ts');

  it('kod wykonywalny zawiera dosłowne import.meta.env.<KLUCZ>', () => {
    expect(source).toContain(`import.meta.env.${ZAI_TERESA_FLAG_KEYS.env}`);
  });

  it('kod wykonywalny NIE czyta env przez indeks (meta.env[...])', () => {
    // Wzorzec obejmuje warianty z `?.` i bez, oraz aliasowanie `import.meta`
    // do zmiennej — to właśnie te kształty nie są podstawiane przez Vite.
    expect(source).not.toMatch(/\.env\s*\??\.\s*\[/);
    expect(source).not.toMatch(/\bconst\s+\w+\s*=\s*import\.meta\b/);
  });
});
