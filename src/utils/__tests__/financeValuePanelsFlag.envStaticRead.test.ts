/**
 * Naprawa 2026-09-05 (wave3 defekt 5, dyzur "flagi-env-statyczny-odczyt"),
 * SKORYGOWANA 2026-09-06 (zlecenie Z5 — pomiar empiryczny).
 *
 * Poprzedni ksztalt tego testu bronil `(import.meta as unknown as {...}).env`
 * (cast NA `import.meta`, `.env` odczytane OSOBNO na wyniku castu) jako
 * "jedynego wyrazenia". To bylo CZESCIOWO poprawne: napisany tak kod
 * dziala w `vite build` i w przegladarce `vite dev` (esbuild usuwa cast z
 * AST PRZED podstawieniem `import.meta.env`), ALE zmierzone 2026-09-06:
 * ten sam ksztalt zwraca `undefined` w Vitest przy `vi.stubEnv` — Vitest/
 * vite-node decyduje o wstrzyknieciu `import.meta.env` na podstawie SUROWEGO
 * tekstu zrodla (przed odcieciem typow TS), a w tym surowym tekscie
 * "import.meta" i ".env" NIE SASIADUJA (dzieli je " as unknown as {...})").
 * Komentarz poprzedniej wersji tego testu ("test runtime'owy tego nie
 * obroni: vitest sam podstawia prawdziwe import.meta.env, wiec obie wersje
 * kodu przechodza") byl hipoteza nigdy nie zweryfikowana `vi.stubEnv` —
 * OBALONA ponizszym testem behawioralnym.
 *
 * Naprawa Z5: cast przeniesiony NA WYNIK `import.meta.env` (nie na `import.meta`
 * przed `.env`) — `(import.meta.env as unknown as Record<...>)`. Literalny
 * token `import.meta.env` zostaje spojny w zrodle, wiec dziala WSZEDZIE:
 * `vite build`, `vite dev`, Vitest.
 *
 * DOWOD MUTACYJNY (Z5, wykonany na tym pliku): przywrocenie w
 * `financeValuePanelsFlag.ts` starego ksztaltu
 * `(import.meta as unknown as { env?: ... }).env?.[ENV_KEY]` -> test
 * "flaga czyta env dynamicznie (vi.stubEnv)" ponizej czerwienieje
 * (evidence/z5/mutacja-financeValuePanelsFlag.txt).
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { FINANCE_VALUE_PANELS_FLAG_KEYS, isFinanceValuePanelsEnabled } from '../financeValuePanelsFlag';

/** Kod bez komentarzy — dokładnie to, co widzi Vite przy decyzji o preambule. */
function executableSource(relativePath: string): string {
  const raw = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
  return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('financeValuePanelsFlag — odczyt env musi być jednym wyrażeniem', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const source = executableSource('../financeValuePanelsFlag.ts');

  it(`kod wykonywalny odczytuje klucz ${FINANCE_VALUE_PANELS_FLAG_KEYS.env} przez import.meta.env w jednym wyrażeniu (cast na WYNIKU .env, nie na import.meta)`, () => {
    expect(source).toMatch(/import\.meta\.env as unknown as Record<string, string \| undefined>\)\?\.\[ENV_KEY\]/);
  });

  it('kod wykonywalny NIE rozdziela import.meta i .env na dwa wyrażenia (cast NA import.meta przed .env)', () => {
    expect(source).not.toMatch(/\(import\.meta\s+as\s+unknown\s+as\s*\{[^}]*env[^}]*\}\)\.env/);
    expect(source).not.toMatch(/\bconst\s+\w+\s*=\s*import\.meta\s+as\s+unknown\s+as\s*\{[^}]*\};/);
  });

  it('flaga czyta env DYNAMICZNIE w Vitest (vi.stubEnv) — dowód, że cast nie łamie Vitest/vite-node', () => {
    vi.stubEnv(FINANCE_VALUE_PANELS_FLAG_KEYS.env, 'true');
    expect(isFinanceValuePanelsEnabled()).toBe(true);
    vi.stubEnv(FINANCE_VALUE_PANELS_FLAG_KEYS.env, 'false');
    expect(isFinanceValuePanelsEnabled()).toBe(false);
  });
});
