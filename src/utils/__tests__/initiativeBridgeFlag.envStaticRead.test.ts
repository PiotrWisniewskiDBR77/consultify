/**
 * Naprawa 2026-09-05 (wave3 defekt 5, dyzur "flagi-env-statyczny-odczyt") —
 * patrz `assessmentDocxFlag.envStaticRead.test.ts` dla pelnego wyjasnienia
 * mechanizmu (`import.meta` i `.env` musza byc w JEDNYM wyrazeniu, zeby
 * Vite/esbuild podstawily obiekt env w `vite build`).
 *
 * SKORYGOWANE 2026-09-06 (zlecenie Z5 — pomiar empiryczny): fix z 05.09
 * (cast NA `import.meta` przed `.env`) dziala w build/dev, ale zwraca
 * `undefined` w Vitest z `vi.stubEnv` (Vitest/vite-node skanuje SUROWE
 * zrodlo, gdzie cast rozdziela "import.meta" i ".env"). Naprawa Z5: cast
 * przeniesiony na WYNIK `.env` — dziala WSZEDZIE.
 *
 * DOWOD MUTACYJNY (Z5, wykonany na tym pliku): przywrocenie w
 * `initiativeBridgeFlag.ts` ksztaltu
 * `(import.meta as unknown as { env?: ... }).env?.[ENV_KEY]` -> test
 * "flaga czyta env dynamicznie (vi.stubEnv)" ponizej czerwienieje
 * (evidence/z5/mutacja-initiativeBridgeFlag.txt).
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INITIATIVE_BRIDGE_FLAG_KEYS,
  isInitiativeBridgeEnabled,
  resetInitiativeBridgeFlagCache,
} from '../initiativeBridgeFlag';

/** Kod bez komentarzy — dokładnie to, co widzi Vite przy decyzji o preambule. */
function executableSource(relativePath: string): string {
  const raw = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('initiativeBridgeFlag — odczyt env musi być jednym wyrażeniem', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetInitiativeBridgeFlagCache();
  });

  const source = executableSource('../initiativeBridgeFlag.ts');

  it(`kod wykonywalny odczytuje klucz ${INITIATIVE_BRIDGE_FLAG_KEYS.env} przez import.meta.env w jednym wyrażeniu (cast na WYNIKU .env)`, () => {
    expect(source).toMatch(/import\.meta\.env as unknown as Record<string, string \| undefined>\)\?\.\[ENV_KEY\]/);
  });

  it('kod wykonywalny NIE rozdziela import.meta i .env na dwa wyrażenia (cast NA import.meta przed .env)', () => {
    expect(source).not.toMatch(/\(import\.meta\s+as\s+unknown\s+as\s*\{[^}]*env[^}]*\}\)\.env/);
    expect(source).not.toMatch(/\bconst\s+\w+\s*=\s*import\.meta\s+as\s+unknown\s+as\s*\{[^}]*\};/);
  });

  it('flaga czyta env DYNAMICZNIE w Vitest (vi.stubEnv) — dowód, że cast na WYNIKU .env nie łamie Vitest', () => {
    resetInitiativeBridgeFlagCache();
    vi.stubEnv(INITIATIVE_BRIDGE_FLAG_KEYS.env, 'true');
    expect(isInitiativeBridgeEnabled()).toBe(true);
    resetInitiativeBridgeFlagCache();
    vi.stubEnv(INITIATIVE_BRIDGE_FLAG_KEYS.env, 'false');
    expect(isInitiativeBridgeEnabled()).toBe(false);
  });
});
