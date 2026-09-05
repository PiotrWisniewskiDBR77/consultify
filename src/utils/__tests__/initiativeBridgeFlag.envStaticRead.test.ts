/**
 * Naprawa 2026-09-05 (wave3 defekt 5, dyzur "flagi-env-statyczny-odczyt") —
 * patrz `assessmentDocxFlag.envStaticRead.test.ts` dla pelnego wyjasnienia
 * mechanizmu (`import.meta` i `.env` musza byc w JEDNYM wyrazeniu, zeby
 * Vite/esbuild podstawily obiekt env w `vite build`).
 *
 * DOWOD MUTACYJNY (wykonany recznie przy pisaniu tego testu): przywrocenie
 * `const meta = import.meta as unknown as {...}; ... meta.env?.[ENV_KEY]`
 * -> drugi test ponizej czerwienieje.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { INITIATIVE_BRIDGE_FLAG_KEYS } from '../initiativeBridgeFlag';

/** Kod bez komentarzy — dokładnie to, co widzi Vite przy decyzji o preambule. */
function executableSource(relativePath: string): string {
  const raw = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('initiativeBridgeFlag — odczyt env musi być jednym wyrażeniem', () => {
  const source = executableSource('../initiativeBridgeFlag.ts');

  it(`kod wykonywalny odczytuje klucz ${INITIATIVE_BRIDGE_FLAG_KEYS.env} przez import.meta.env w jednym wyrażeniu`, () => {
    expect(source).toMatch(/\)\.env\??\.\[ENV_KEY\]/);
  });

  it('kod wykonywalny NIE deklaruje osobnej zmiennej trzymającej samo import.meta', () => {
    expect(source).not.toMatch(/\bconst\s+\w+\s*=\s*import\.meta\s+as\s+unknown\s+as\s*\{[^}]*\};/);
  });
});
